/**
 * zstd 多帧流的读取。
 *
 * DSH 的会话日志把每个写入批次压成**一个独立的、带校验和的 zstd 帧**，然后
 * 直接把这些帧首尾拼接起来（`compressZstdFrame` + `ZSTD_c_checksumFlag`）。
 * 这样追加写入不必重写整个文件，被截断的尾部也仍可识别。
 *
 * 代价是文件里没有帧长度索引，`zlib.zstdDecompress` 只认第一帧。因此这里先
 * 用帧头解析扫出每个帧的字节区间，再逐帧解压后拼接。
 *
 * 逻辑与 DSH 自身的 `scanZstdFrames`（`session-persistence-jsonl/src/zstd.ts`）
 * 保持同构；这里的实现是独立的 JS 版本，不引入任何依赖。
 *
 * @module dsh-usage-billing/src/zstd
 */
import { zstdDecompress, zstdDecompressSync } from 'node:zlib';
import { promisify } from 'node:util';
const zstdDecompressAsync = promisify(zstdDecompress);
/**
 * 同步解压是否可用。
 *
 * `zstdDecompressSync` 在 Node 22.19 / 23.8 才有；DSH 自身要求
 * `^22.19.0 || >=24.0.0`，所以实际上总是可用。这里仍然探测一次并在缺失时
 * 退回异步路径：一个会话动辄上万个帧，异步逐帧解压要多付约一倍的时间
 * （每帧一个 promise 往返），能在同步路径上跑就跑同步。
 */
const HAS_SYNC_ZSTD = typeof zstdDecompressSync === 'function';
/** zstd 帧魔数（小端读取为 `0xFD2FB528`）。 */
export const ZSTD_MAGIC = 0xfd2fb528;
/**
 * 扫描缓冲区里的全部 zstd 帧区间，不解压任何数据。
 * @param buffer - 完整的文件内容。
 * @returns 帧区间列表；遇到结构损坏时返回已扫描到的部分。
 */
export function scanZstdFrames(buffer) {
    const frames = [];
    let offset = 0;
    while (offset < buffer.length) {
        const frameStart = offset;
        if (buffer.length - offset < 4)
            return { frames, tornStart: frameStart };
        if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC)
            return { frames, tornStart: frameStart };
        offset += 4;
        if (offset === buffer.length)
            return { frames, tornStart: frameStart };
        const descriptor = buffer.readUInt8(offset);
        offset += 1;
        // 保留位必须为 0，否则说明这里已经不是帧头了。
        if ((descriptor & 0x18) !== 0)
            return { frames, tornStart: frameStart };
        const contentSizeFlag = descriptor >>> 6;
        const singleSegment = (descriptor & 0x20) !== 0;
        const checksum = (descriptor & 0x04) !== 0;
        const dictionaryFlag = descriptor & 0x03;
        const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
        const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag;
        const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
        if (buffer.length - offset < remainingHeaderBytes)
            return { frames, tornStart: frameStart };
        offset += remainingHeaderBytes;
        for (;;) {
            if (buffer.length - offset < 3)
                return { frames, tornStart: frameStart };
            const blockHeader = buffer.readUIntLE(offset, 3);
            offset += 3;
            const lastBlock = (blockHeader & 1) !== 0;
            const blockType = (blockHeader >>> 1) & 0x03;
            const blockSize = blockHeader >>> 3;
            if (blockType === 0x03)
                return { frames, tornStart: frameStart };
            // RLE 块的载荷只有 1 字节，其余块的载荷等于 blockSize。
            const payloadBytes = blockType === 0x01 ? 1 : blockSize;
            if (buffer.length - offset < payloadBytes)
                return { frames, tornStart: frameStart };
            offset += payloadBytes;
            if (lastBlock)
                break;
        }
        if (checksum) {
            if (buffer.length - offset < 4)
                return { frames, tornStart: frameStart };
            offset += 4;
        }
        frames.push({ start: frameStart, end: offset });
    }
    return { frames };
}
/**
 * 判断缓冲区是否以 zstd 魔数开头。
 * @param buffer - 待检查的内容。
 * @returns 是 zstd 流为 true。
 */
export function looksLikeZstd(buffer) {
    return buffer.length >= 4 && buffer.readUInt32LE(0) === ZSTD_MAGIC;
}
/**
 * 把一个会话日志缓冲区解成 UTF-8 文本。
 *
 * 逐帧解压并跳过坏帧：单个损坏批次不应让整个会话从统计里消失。
 * 非 zstd 内容（明文 jsonl，测试或旧部署可能出现）直接按文本返回。
 *
 * @param buffer - 文件内容。
 * @returns 解压后的文本。
 */
export async function decodeSessionLog(buffer) {
    if (!looksLikeZstd(buffer))
        return buffer.toString('utf8');
    const { frames } = scanZstdFrames(buffer);
    const parts = [];
    for (const frame of frames) {
        try {
            parts.push(await zstdDecompressAsync(buffer.subarray(frame.start, frame.end)));
        }
        catch {
            // 坏帧跳过：其余批次仍然可用。
        }
    }
    return Buffer.concat(parts).toString('utf8');
}
/**
 * 与 {@link decodeSessionLog} 相同，但同时返回解码统计。
 * @param buffer - 文件内容。
 * @returns 文本与统计。
 */
export async function decodeSessionLogWithStats(buffer) {
    const compressed = looksLikeZstd(buffer);
    if (!compressed) {
        const text = buffer.toString('utf8');
        return {
            text,
            stats: {
                frames: 0,
                failedFrames: 0,
                compressed: false,
                compressedBytes: buffer.length,
                textLength: text.length,
            },
        };
    }
    const { frames } = scanZstdFrames(buffer);
    const parts = [];
    let failedFrames = 0;
    if (HAS_SYNC_ZSTD) {
        for (const frame of frames) {
            try {
                parts.push(zstdDecompressSync(buffer.subarray(frame.start, frame.end)));
            }
            catch {
                failedFrames += 1;
            }
        }
    }
    else {
        for (const frame of frames) {
            try {
                parts.push((await zstdDecompressAsync(buffer.subarray(frame.start, frame.end))));
            }
            catch {
                failedFrames += 1;
            }
        }
    }
    const text = Buffer.concat(parts).toString('utf8');
    return {
        text,
        stats: {
            frames: frames.length,
            failedFrames,
            compressed: true,
            compressedBytes: buffer.length,
            textLength: text.length,
        },
    };
}
