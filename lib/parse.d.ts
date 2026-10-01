/**
 * 会话日志的 usage 事件解析。
 *
 * ## 两种记账载体
 *
 * DSH 会话日志里的 token 记账有两种写法，实际文件会随格式代号（generation）变化：
 *
 * 1. **generation 4（当前）**：只有 `assistant/message` 行携带 `data.usage`。
 * 2. **generation 0（旧）**：`assistant/chunk` 行（`data.chunk.type === 'usage'`）
 *    与紧随其后的 `assistant/message` 行**携带同一份 usage**。
 *
 * ## 为什么必须按 (turn, step) 去重
 *
 * 旧的参考实现直接对每一行做 `if (chunk.type === 'usage') … else if (data.usage) …`，
 * 于是 generation 0 的同一份用量被计两次——`assistant/chunk` 走第一个分支，
 * 它的兄弟行 `assistant/message` 走第二个分支。
 *
 * 实测（`$DSH_HOME/sessions` 下全部 generation 0 会话）：朴素解析的结果与去重
 * 结果之比**恒为 2.000**。也就是说旧口径把历史费用整体翻了一倍。
 *
 * 本模块按 `(turn, step)` 归一：同一个 step 的多个采样只保留最后一次
 * （`assistant/message` 是最终的、完整的采样，而 `assistant/chunk` 可能只是流式
 * 中间态），因此既修掉了双计，又保留了「重试后取最终值」的正确语义。
 *
 * @module dsh-usage-billing/src/parse
 */
import type { TokenBuckets } from './pricing.js';
/** 一次 usage 采样。 */
export interface UsageSample extends TokenBuckets {
    /** 该采样所属轮次 */
    turn: number | null;
    /** 该采样所属步 */
    step: number | null;
    /** epoch 毫秒；日志未记录时为 `null` */
    ts: number | null;
    /** 归因到的模型 id */
    model: string;
    /** usage 事件所在行的 `seq` */
    seq: number | null;
    /** 模型归因的来源，便于排障 */
    modelSource: ModelSource;
}
/** 模型归因的来源。 */
export type ModelSource = 'message.source' | 'request/context' | 'request/header' | 'log-header' | 'unknown';
/** 一个会话日志的解析结果。 */
export interface ParsedSessionLog {
    /** 会话 id（来自日志头或目录名） */
    sessionId: string | null;
    /** 日志格式代号 */
    generation: number;
    /** 日志头里记录的工作目录 */
    cwd: string | null;
    /** 去重后的采样，按日志出现顺序排列 */
    samples: UsageSample[];
    /** 解析过程中丢弃的重复采样数（同一 turn/step 的较早采样） */
    duplicateSamples: number;
    /** 无法解析为 JSON 的行数（截断或损坏） */
    malformedLines: number;
    /** 扫描过的总行数 */
    totalLines: number;
}
/**
 * 解析一个会话日志文件的内容。
 *
 * 先按行扫描、边扫边归因模型，再输出去重后的采样。内存里只保留每个
 * `(turn, step)` 的最后一份采样，因此可以在 GB 级文本上运行。
 *
 * @param text - 解压后的日志文本。
 * @param generation - 由文件名得出的格式代号（日志头的 `version` 优先）。
 * @returns 解析结果。
 */
export declare function parseSessionLog(text: string, generation: number): ParsedSessionLog;
