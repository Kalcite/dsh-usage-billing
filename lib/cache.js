/**
 * 用量总览的磁盘缓存。
 *
 * ## 为什么需要
 *
 * 扫描全部会话日志要读几十 MB 压缩数据并逐帧解压，实测约 4–5 秒。数据本身只在
 * 会话推进时变化，所以每次打开界面都重扫一遍纯属浪费。
 *
 * ## 缓存思路
 *
 * 扫描产物（整个 overview）落到磁盘，并记录一份**廉价指纹**：会话日志的数量 +
 * 总字节数 + 最新修改时间。命中的条件是「指纹没变 + 计费规则没变」——
 *
 *   - 指纹只需遍历目录取 stat，不读文件内容、不解压（实测毫秒级）；
 *   - 计费规则参与键，因为费用是按当时的单价算好存进 overview 的，规则一变必须重算。
 *
 * 因此：**首次打开**慢一次并写入缓存；**之后打开**直接读缓存（毫秒级）；
 * 用户点「重新扫描」时绕过缓存并重写。
 *
 * 缓存是纯派生数据，任何异常（损坏、权限、版本不符）都只是退回重扫，不影响正确性。
 *
 * @module dsh-usage-billing/src/cache
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listSessionLogs } from './ledger.js';
/** 缓存格式版本；结构变化时递增即可让旧缓存自然失效。 */
export const CACHE_VERSION = 1;
/**
 * 计算数据指纹。
 *
 * 用 `listSessionLogs`（只做目录遍历 + stat），不读内容、不解压。
 * `mtimeMs` 取所有日志里最新的一个：追加写入必然更新它。
 *
 * @param home - 数据目录。
 * @returns 指纹（不含会话内容）。
 */
export function fingerprintOf(home) {
    const { locations, dirs } = listSessionLogs(home);
    let bytes = 0;
    let newestMtimeMs = 0;
    for (const location of locations) {
        bytes += location.bytes;
        try {
            const mtime = location.mtimeMs;
            if (mtime > newestMtimeMs)
                newestMtimeMs = mtime;
        }
        catch {
            // stat 失败：忽略该文件的 mtime，但字节数已计入，指纹仍会变。
        }
    }
    return { sessionDirs: dirs, logs: locations.length, bytes, newestMtimeMs };
}
/** 两个指纹是否相同。 */
export function sameFingerprint(a, b) {
    return a.sessionDirs === b.sessionDirs
        && a.logs === b.logs
        && a.bytes === b.bytes
        && a.newestMtimeMs === b.newestMtimeMs;
}
/** 计费规则的指纹。 */
export function pricingKeyOf(pricing) {
    return createHash('sha1').update(JSON.stringify(pricing)).digest('hex').slice(0, 16);
}
/**
 * 缓存文件路径。
 *
 * 放在系统临时目录下（而不是 `$DSH_HOME`），这样可以按数据目录区分，且不会污染
 * 用户的仓库或 profile：缓存是纯派生数据，丢了只是重扫一次。
 *
 * @param home - 数据目录。
 * @returns 缓存的绝对路径。
 */
export function cachePathFor(home) {
    const digest = createHash('sha1').update(home).digest('hex').slice(0, 12);
    return path.join(os.tmpdir(), 'dsh-usage-billing', `overview-${digest}.json`);
}
/**
 * 读取缓存。
 * @param home - 数据目录；`cacheDir` 可覆盖缓存目录（测试用）。
 * @returns 缓存内容；不存在、版本不符或损坏时为 `null`。
 */
export function readCache(home, cacheDir) {
    const file = cacheFile(home, cacheDir);
    if (!existsSync(file))
        return null;
    try {
        const parsed = JSON.parse(readFileSync(file, 'utf8'));
        if (parsed === null || typeof parsed !== 'object')
            return null;
        if (parsed.version !== CACHE_VERSION)
            return null;
        if (parsed.home !== home)
            return null;
        if (parsed.overview === null || typeof parsed.overview !== 'object')
            return null;
        if (parsed.fingerprint === null || typeof parsed.fingerprint !== 'object')
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
/**
 * 写入缓存（原子替换：先写临时文件再 rename，避免读到半截 JSON）。
 * @param home - 数据目录。
 * @param entry - 除 `version`/`home`/`writtenAt` 之外的内容。
 * @param cacheDir - 覆盖缓存目录（测试用）。
 * @returns 是否写入成功（失败只影响性能，不影响正确性）。
 */
export function writeCache(home, entry, cacheDir) {
    const file = cacheFile(home, cacheDir);
    try {
        mkdirSync(path.dirname(file), { recursive: true });
        const payload = {
            version: CACHE_VERSION,
            home,
            writtenAt: Date.now(),
            pricingKey: entry.pricingKey,
            fingerprint: entry.fingerprint,
            overview: entry.overview,
        };
        const tmp = `${file}.${process.pid}.tmp`;
        writeFileSync(tmp, JSON.stringify(payload), 'utf8');
        renameSync(tmp, file);
        return true;
    }
    catch {
        return false;
    }
}
/** 删除缓存。 */
export function dropCache(home, cacheDir) {
    const file = cacheFile(home, cacheDir);
    try {
        if (existsSync(file))
            unlinkSync(file);
    }
    catch {
        // 删除失败无所谓：内容会被下一次写入覆盖。
    }
}
/** 解析缓存文件路径（`cacheDir` 覆盖时用其拼接）。 */
function cacheFile(home, cacheDir) {
    if (cacheDir === undefined)
        return cachePathFor(home);
    const digest = createHash('sha1').update(home).digest('hex').slice(0, 12);
    return path.join(cacheDir, `overview-${digest}.json`);
}
