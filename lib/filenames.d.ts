/**
 * 会话日志文件名解析。
 *
 * DSH 会话目录（`$DSH_HOME/sessions/<projectKey>/<sessionId>/`）里的日志按
 * 「格式代号（generation）」命名：
 *
 *   - `session.jsonl`      generation 0（旧格式，usage 同时写在 assistant/chunk
 *                          与 assistant/message 两行上，需要按 (turn,step) 去重）
 *   - `session.v4.jsonl`   generation 4（当前格式，usage 只写 assistant/message）
 *
 * 压缩存储时追加 `.zstd` 后缀。同一会话目录里可能同时残留多个代号的文件，
 * 读取时必须挑**代号最高**的那个，否则会漏掉最新数据。
 *
 * > 注意：启动器参考实现（`dsh-launcher-webui/server/usage.mjs`）的正则只认到
 * > `.v2`，因此把当前 `.v4` 日志整个漏掉了——本模块用不设上限的代号匹配修正它。
 *
 * @module dsh-usage-billing/src/filenames
 */
/** 被识别为会话日志的文件名 → 格式代号；非日志名返回 `null`。 */
export interface SessionLogName {
    /** 原始文件名 */
    name: string;
    /** 格式代号：`session.jsonl` 为 0，`session.vN.jsonl` 为 N */
    generation: number;
    /** 是否为 zstd 压缩存储 */
    compressed: boolean;
}
/**
 * 解析一个文件名。
 * @param name - 目录项名称（不是完整路径）。
 * @returns 解析结果；不是会话日志时为 `null`。
 */
export declare function parseSessionLogName(name: string): SessionLogName | null;
/**
 * 在候选文件名中挑出应当读取的那一个。
 *
 * 规则：代号最高者胜出；同代号时优先 `.zstd`（与写入方的偏好一致）。
 * 迁移临时文件与生成中的计数文件不匹配 {@link SESSION_LOG_PATTERN}，天然被忽略。
 *
 * @param names - 同一会话目录下的全部目录项名称。
 * @returns 选中的日志；目录里没有日志时为 `null`。
 */
export declare function pickSessionLog(names: readonly string[]): SessionLogName | null;
/** 项目目录名 → 人类可读的展示名（用于界面里的「项目」列）。 */
export declare function projectDisplayName(projectKey: string): string;
