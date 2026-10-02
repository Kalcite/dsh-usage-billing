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
import { type UsageOverview } from './ledger.js';
/** 缓存格式版本；结构变化时递增即可让旧缓存自然失效。 */
export declare const CACHE_VERSION = 1;
/** 数据指纹：任一项变化都意味着必须重扫。 */
export interface DataFingerprint {
    /** 会话目录数 */
    sessionDirs: number;
    /** 找到的日志数 */
    logs: number;
    /** 日志总字节数 */
    bytes: number;
    /** 最新的日志修改时间（epoch 毫秒） */
    newestMtimeMs: number;
}
/** 缓存文件的结构。 */
export interface CacheFile {
    version: number;
    /** 数据目录 */
    home: string;
    /** 写入时间（epoch 毫秒） */
    writtenAt: number;
    /** 计费规则指纹（JSON 串的哈希） */
    pricingKey: string;
    /** 数据指纹 */
    fingerprint: DataFingerprint;
    /** 扫描产物 */
    overview: UsageOverview;
}
/**
 * 计算数据指纹。
 *
 * 用 `listSessionLogs`（只做目录遍历 + stat），不读内容、不解压。
 * `mtimeMs` 取所有日志里最新的一个：追加写入必然更新它。
 *
 * @param home - 数据目录。
 * @returns 指纹（不含会话内容）。
 */
export declare function fingerprintOf(home: string): DataFingerprint;
/** 两个指纹是否相同。 */
export declare function sameFingerprint(a: DataFingerprint, b: DataFingerprint): boolean;
/** 计费规则的指纹。 */
export declare function pricingKeyOf(pricing: unknown): string;
/**
 * 缓存文件路径。
 *
 * 放在系统临时目录下（而不是 `$DSH_HOME`），这样可以按数据目录区分，且不会污染
 * 用户的仓库或 profile：缓存是纯派生数据，丢了只是重扫一次。
 *
 * @param home - 数据目录。
 * @returns 缓存的绝对路径。
 */
export declare function cachePathFor(home: string): string;
/**
 * 读取缓存。
 * @param home - 数据目录；`cacheDir` 可覆盖缓存目录（测试用）。
 * @returns 缓存内容；不存在、版本不符或损坏时为 `null`。
 */
export declare function readCache(home: string, cacheDir?: string): CacheFile | null;
/**
 * 写入缓存（原子替换：先写临时文件再 rename，避免读到半截 JSON）。
 * @param home - 数据目录。
 * @param entry - 除 `version`/`home`/`writtenAt` 之外的内容。
 * @param cacheDir - 覆盖缓存目录（测试用）。
 * @returns 是否写入成功（失败只影响性能，不影响正确性）。
 */
export declare function writeCache(home: string, entry: {
    pricingKey: string;
    fingerprint: DataFingerprint;
    overview: UsageOverview;
}, cacheDir?: string): boolean;
/** 删除缓存。 */
export declare function dropCache(home: string, cacheDir?: string): void;
