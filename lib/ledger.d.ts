/**
 * 会话日志扫描与用量聚合。
 *
 * 读取 `$DSH_HOME/sessions/<projectKey>/<sessionId>/` 下的会话日志，聚合成
 * 「日期 × 小时 × 模型」的计费桶以及按模型 / 日 / 小时 / 会话的视图。
 *
 * 计费桶（`byDayHour`）是唯一携带 `date` / `weekday` / `hour` 的粒度，因此也是
 * 唯一能正确应用「按时段与周末浮动」的粒度：界面把规则改动后的重算压在这一层，
 * 就可以做到改单价即时生效，而不必重新读盘。
 *
 * @module dsh-usage-billing/src/ledger
 */
import { type PricingRule, type TokenBuckets } from './pricing.js';
/** 按模型拆分的一个计费桶（日期 × 小时）。 */
export interface DayHourBucket {
    /** `YYYY-MM-DD`（在 `pricing.timezone` 下） */
    date: string;
    /** 0 = 周日 */
    weekday: number;
    /** 0-23 */
    hour: number;
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    /** 该桶内按模型拆分的 token */
    models: Record<string, TokenBuckets>;
    /** 按当前规则算出的费用（元） */
    cost: number;
}
/** 单一维度（模型 / 日期 / 小时）的聚合行。 */
export interface UsageRow extends TokenBuckets {
    /** 该行的费用（元）；`byDay` 的行为当日全部桶之和 */
    cost: number;
}
/** 按模型聚合的一行。 */
export interface ModelRow extends UsageRow {
    model: string;
    /** 展示名 */
    label: string;
    /** 该模型占全部 token 的比例（0-1） */
    share: number;
    /** 命中该模型的会话数 */
    sessions: number;
    /** 是否在单价表里显式列出（false = 走了 `_default` 兜底） */
    priced: boolean;
}
/** 按日期聚合的一行。 */
export interface DayRow extends UsageRow {
    date: string;
    /** 当日高峰 / 空闲费用拆分 */
    peakCost: number;
    offPeakCost: number;
}
/** 按小时聚合的一行（跨全部日期）。 */
export interface HourRow extends UsageRow {
    hour: number;
    /** 该小时是否属于高峰时段定义 */
    peakSlot: boolean;
}
/** 会话级汇总行。 */
export interface SessionRow extends UsageRow {
    id: string;
    /** 项目键（目录名） */
    project: string;
    /** 项目展示名 */
    projectLabel: string;
    /** 工作目录（日志头 `cwd`） */
    cwd: string | null;
    /** 出现过的模型 id */
    models: string[];
    /** 展示名列表 */
    modelLabels: string[];
    /** usage 事件数（去重后） */
    events: number;
    /** 首次 / 末次 usage 时间（epoch 毫秒） */
    firstTs: number | null;
    lastTs: number | null;
    /** 日志格式代号 */
    generation: number;
    /** 存储字节数 */
    bytes: number;
    /** zstd 帧数 */
    frames: number;
    /** 该会话自身的日期 × 小时桶（供会话钻取实时计费） */
    dayHour: DayHourBucket[];
    /** 因同一 (turn,step) 重复而丢弃的采样数 */
    duplicateSamples: number;
}
/** 全量总览。 */
export interface UsageOverview {
    /** 数据来源根目录 */
    home: string;
    /** 归一化后的计费规则 */
    pricing: PricingRule;
    /** 生成时间（epoch 毫秒） */
    generatedAt: number;
    /** 出现过的模型 id（含历史 id），按 token 总量降序 */
    knownModels: string[];
    totals: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        /** input + output + cacheRead + cacheWrite */
        tokens: number;
        /** 费用（元） */
        cost: number;
        /** 全高峰口径的费用（用于算「相对全高峰节省」） */
        baselineCost: number;
        /** 高峰费用 */
        peakCost: number;
        /** 空闲费用 */
        offPeakCost: number;
        /** 高峰 token 占比（0-1） */
        peakShare: number;
        sessions: number;
        /** 有用量的天数 */
        activeDays: number;
        /** 去重丢弃的采样总数 */
        duplicateSamples: number;
    };
    byModel: ModelRow[];
    byDay: DayRow[];
    byHour: HourRow[];
    byDayHour: DayHourBucket[];
    bySession: SessionRow[];
    /** 扫描统计 */
    scan: {
        /** 找到的会话目录数 */
        sessionDirs: number;
        /** 成功读取的日志数 */
        logsRead: number;
        /** 读取失败的日志数 */
        logsFailed: number;
        /** 无日志文件的会话目录数 */
        logsMissing: number;
        /** 总压缩字节数 */
        bytes: number;
        /** 解析耗时（毫秒） */
        elapsedMs: number;
        /** cargo：按格式代号统计的会话数 */
        generations: Record<string, number>;
    };
}
/** 一个会话目录的定位结果。 */
interface SessionLocation {
    projectKey: string;
    sessionId: string;
    dir: string;
    logPath: string;
    generation: number;
    bytes: number;
}
/**
 * 默认的 DSH 数据目录。
 * @returns `$DSH_HOME`，未设置时回落到 `~/.dsh`。
 */
export declare function defaultHome(): string;
/**
 * 枚举 `sessions` 下的全部会话日志。
 * @param home - DSH 数据目录。
 * @returns 每个会话目录选中的那份日志。
 */
export declare function listSessionLogs(home: string): {
    locations: SessionLocation[];
    missing: number;
    dirs: number;
};
/**
 * 扫描并聚合全部会话用量。
 *
 * @param options - `home` 覆盖数据目录；`pricing` 覆盖计费规则。
 * @returns 完整总览。
 */
export declare function usageOverview(options?: {
    home?: string;
    pricing?: Partial<PricingRule> | null;
}): Promise<UsageOverview>;
export {};
