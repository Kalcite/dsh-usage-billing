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
/** zstd 帧魔数（小端读取为 `0xFD2FB528`）。 */
export declare const ZSTD_MAGIC = 4247762216;
/** 一个帧在缓冲区中的字节区间 `[start, end)`。 */
export interface ZstdFrameRange {
    start: number;
    end: number;
}
/** 扫描结果；`tornStart` 是被截断的尾部帧的起点（若存在）。 */
export interface ZstdScanResult {
    frames: ZstdFrameRange[];
    tornStart?: number;
}
/**
 * 扫描缓冲区里的全部 zstd 帧区间，不解压任何数据。
 * @param buffer - 完整的文件内容。
 * @returns 帧区间列表；遇到结构损坏时返回已扫描到的部分。
 */
export declare function scanZstdFrames(buffer: Buffer): ZstdScanResult;
/**
 * 判断缓冲区是否以 zstd 魔数开头。
 * @param buffer - 待检查的内容。
 * @returns 是 zstd 流为 true。
 */
export declare function looksLikeZstd(buffer: Buffer): boolean;
/**
 * 把一个会话日志缓冲区解成 UTF-8 文本。
 *
 * 逐帧解压并跳过坏帧：单个损坏批次不应让整个会话从统计里消失。
 * 非 zstd 内容（明文 jsonl，测试或旧部署可能出现）直接按文本返回。
 *
 * @param buffer - 文件内容。
 * @returns 解压后的文本。
 */
export declare function decodeSessionLog(buffer: Buffer): Promise<string>;
/** 一次解码的统计信息，用于界面显示与排障。 */
export interface DecodeStats {
    /** 扫描到的帧数 */
    frames: number;
    /** 解压失败的帧数 */
    failedFrames: number;
    /** 是否为 zstd 存储 */
    compressed: boolean;
    /** 压缩字节数 */
    compressedBytes: number;
    /** 解压后的字符数 */
    textLength: number;
}
/**
 * 与 {@link decodeSessionLog} 相同，但同时返回解码统计。
 * @param buffer - 文件内容。
 * @returns 文本与统计。
 */
export declare function decodeSessionLogWithStats(buffer: Buffer): Promise<{
    text: string;
    stats: DecodeStats;
}>;
