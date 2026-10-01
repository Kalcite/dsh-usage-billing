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
function newState(generation) {
    return {
        currentModel: null,
        currentModelSource: 'unknown',
        sessionId: null,
        cwd: null,
        generation,
        seq: null,
        totalLines: 0,
        malformedLines: 0,
        duplicates: 0,
        samples: new Map(),
    };
}
/** 从一条已解析的行里提取 token 四元组；没有 usage 时返回 `null`。 */
function usageOf(row) {
    const data = row.data;
    if (data === null || data === undefined || typeof data !== 'object')
        return null;
    const usage = data.usage;
    if (usage === null || usage === undefined || typeof usage !== 'object')
        return null;
    return {
        input: typeof usage.inputTokens === 'number' ? usage.inputTokens : 0,
        output: typeof usage.outputTokens === 'number' ? usage.outputTokens : 0,
        cacheRead: typeof usage.cacheReadTokens === 'number' ? usage.cacheReadTokens : 0,
        cacheWrite: typeof usage.cacheWriteTokens === 'number' ? usage.cacheWriteTokens : 0,
    };
}
/** 该行是否真的是一次可计费的 token 记账（而非嵌套结构里的偶然同名字段）。 */
function carriesUsage(row) {
    const type = row.type;
    if (type === 'assistant/message')
        return true;
    if (type === 'assistant/chunk') {
        const data = row.data;
        const chunk = data?.chunk;
        return chunk?.type === 'usage';
    }
    // 未知行类型但带 usage：保守接受，交给 (turn,step) 去重兜底。
    return true;
}
/** 更新模型归因；返回是否命中。 */
function applyModelRow(state, row) {
    const data = row.data;
    // 1. 最可靠：usage 行自身携带 message.source.model
    if (row.type === 'assistant/message') {
        const message = data?.message;
        const source = message?.source;
        const model = source?.model;
        if (typeof model === 'string' && model !== '') {
            state.currentModel = model;
            state.currentModelSource = 'message.source';
            return;
        }
    }
    // 2. request/context：只带 provider/model/contextWindow，比 header 便宜且稳定
    if (row.type === 'request/context') {
        const model = data?.model;
        if (typeof model === 'string' && model !== '') {
            state.currentModel = model;
            state.currentModelSource = 'request/context';
            return;
        }
    }
    // 3. request/header：config.model，附带宽大的 tool schema
    if (row.type === 'request/header') {
        const header = data?.header;
        const config = header?.config;
        const model = config?.model;
        if (typeof model === 'string' && model !== '') {
            state.currentModel = model;
            state.currentModelSource = 'request/header';
        }
    }
}
/** 读取日志头（第一行）。 */
function applyHeaderRow(state, row) {
    if (typeof row.id === 'string')
        state.sessionId = row.id;
    if (typeof row.cwd === 'string')
        state.cwd = row.cwd;
    if (typeof row.version === 'number')
        state.generation = row.version;
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
export function parseSessionLog(text, generation) {
    const state = newState(generation);
    let lineStart = 0;
    for (let index = 0; index <= text.length; index += 1) {
        const isEnd = index === text.length;
        const char = isEnd ? 0 : text.charCodeAt(index);
        if (!isEnd && char !== 10 /* \n */)
            continue;
        let end = index;
        if (end > lineStart && text.charCodeAt(end - 1) === 13 /* \r */)
            end -= 1;
        const line = lineStart === end ? '' : text.slice(lineStart, end);
        lineStart = index + 1;
        if (line === '' || (line.length === 1 && line.charCodeAt(0) === 13))
            continue;
        // 廉价预筛：日志里绝大多数字节是流式增量（reasoning / text / tool-call
        // chunk），它们既不带用量也不带模型。所有结构化事件行都是
        // `{"type":"…"` 开头，因此先看这一小段即可跳过绝大部分 JSON.parse。
        if (!line.includes('"type":"'))
            continue;
        state.totalLines += 1;
        let row;
        try {
            row = JSON.parse(line);
        }
        catch {
            state.malformedLines += 1;
            continue;
        }
        if (row === null || typeof row !== 'object')
            continue;
        if (row.type === 'session') {
            applyHeaderRow(state, row);
            continue;
        }
        applyModelRow(state, row);
        if (!carriesUsage(row))
            continue;
        const tokens = usageOf(row);
        if (tokens === null)
            continue;
        const data = row.data;
        const turn = typeof data?.turn === 'number' ? data.turn : null;
        const step = typeof data?.step === 'number' ? data.step : null;
        const ts = typeof row.time === 'number' ? row.time : null;
        const seq = typeof row.seq === 'number' ? row.seq : null;
        const sample = {
            ...tokens,
            turn,
            step,
            ts,
            seq,
            model: state.currentModel ?? 'unknown',
            modelSource: state.currentModel === null ? 'unknown' : state.currentModelSource,
        };
        // 无 (turn,step) 的采样无法去重，直接累计（各算一次）。
        if (turn === null || step === null) {
            state.samples.set(`\u0000${state.samples.size}`, sample);
            continue;
        }
        const key = `${turn}|${step}`;
        const isReplacement = state.samples.has(key);
        if (isReplacement)
            state.duplicates += 1;
        // Map 保持插入顺序：覆盖已有键不会改变它在序列中的位置。
        state.samples.set(key, sample);
    }
    return {
        sessionId: state.sessionId,
        generation: state.generation,
        cwd: state.cwd,
        samples: [...state.samples.values()],
        duplicateSamples: state.duplicates,
        malformedLines: state.malformedLines,
        totalLines: state.totalLines,
    };
}
