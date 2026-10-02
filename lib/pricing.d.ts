/**
 * 计费规则与单价计算（主机侧与浏览器侧共用同一份纯逻辑）。
 *
 * 默认值取自 DeepSeek 官方定价文档（人民币 / 百万 token）：
 *   https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
 *
 * 峰谷规则：
 *   - 高峰时段 09:00-12:00、14:00-18:00（北京时间，含起点不含终点）
 *   - 空闲时段 = 高峰价 × offPeakMultiplier（官方 0.5）
 *   - `weekendRelaxFrom` 当日 00:00 起，周末（周六/周日）全天按空闲价；
 *     该日期之前周末仍区分峰谷时段。
 *
 * 本模块不依赖任何运行时依赖，也不触碰文件系统：它只做纯函数计算，
 * 因此 `lib/pricing.js` 可以同时被主机侧与手工打包的浏览器端引用。
 *
 * @module dsh-usage-billing/pricing
 */
import { type HolidayCalendar, type HolidayCoverage } from './holidays.js';
export { BUILTIN_HOLIDAY_CALENDAR, dayKind, holidayCalendarCoverage, isHoliday, isMakeupWorkday, mergeHolidayCalendar, } from './holidays.js';
export type { HolidayCalendar, HolidayCoverage, HolidayRange } from './holidays.js';
/** 单个模型的单价，单位「元 / 百万 token」，均为高峰价。 */
export interface ModelPrice {
    /** 高峰：输入（缓存未命中） */
    inputPerM: number;
    /** 高峰：输出 */
    outputPerM: number;
    /** 高峰：输入（缓存命中） */
    cacheReadPerM: number;
    /** 高峰：缓存写入 */
    cacheWritePerM: number;
}
/** 一个高峰时段（北京时间整点小时，含 start、不含 end）。 */
export interface PeakSlot {
    start: number;
    end: number;
}
/** 完整的计费规则（经归一化后所有字段都有确定值）。 */
export interface PricingRule {
    /** 空闲价 = 高峰价 × 该系数 */
    offPeakMultiplier: number;
    /** 高峰时段列表（北京时间小时） */
    peakSlots: readonly PeakSlot[];
    /** 是否启用「周末全天空闲」 */
    weekendRelax: boolean;
    /**
     * 周末规则生效日期（`YYYY-MM-DD`，北京时间当日 00:00 起）。
     * 空字符串 = 始终生效。
     */
    weekendRelaxFrom: string;
    /**
     * 用于判定「日期 / 星期 / 小时」的时区（IANA 名称）。
     * 缺省用运行环境的本地时区；峰谷时段本身始终按北京时间定义。
     */
    timezone?: string;
    /**
     * 节假日 / 调休日历（已与内置数据合并）。
     *
     * 判定优先级：**法定节假日 > 调休上班日 > 周末 > 工作日**。
     * 节假日与调休上班日**不受 `weekendRelax` 开关影响**——春节、国庆的折扣语义
     * 与「周末打折」无关，关掉周末规则不应让假期涨价。
     */
    calendar: HolidayCalendar;
    /** 模型单价表；`_default` 是未列出模型的兜底 */
    models: Readonly<Record<string, ModelPrice>>;
}
/** 一次计费所涉及的 token 四元组。 */
export interface TokenBuckets {
    /** 输入（缓存未命中） */
    input: number;
    /** 输出 */
    output: number;
    /** 输入（缓存命中） */
    cacheRead: number;
    /** 缓存写入 */
    cacheWrite: number;
}
/** token 四元组的零值。 */
export declare function emptyBuckets(): TokenBuckets;
/**
 * 官方默认单价与峰谷规则。
 *
 * 注意 `deepseek-flash` 与 `deepseek-v4-flash` 同时保留：前者是当前 DSH
 * 模型目录里的 id，后者出现在较早的会话日志中，两者单价相同。
 */
export declare const DEFAULT_PRICING: PricingRule;
/** 模型 id 的展示名（未知 id 原样显示）。 */
export declare const MODEL_LABELS: Readonly<Record<string, string>>;
/**
 * 模型的展示名。
 * @param model - 日志中的模型 id。
 * @returns 展示名，未知 id 原样返回。
 */
export declare function modelLabel(model: string): string;
/**
 * 归一化用户配置：缺省字段回落到官方默认，`models` 与默认表合并。
 * @param overrides - 来自 Loader 配置的部分规则。
 * @returns 字段完整的计费规则。
 */
export declare function resolvePricing(overrides?: Partial<PricingRule> | null | undefined): PricingRule;
/**
 * 取模型单价，未列出时用 `_default` 兜底。
 * @param model - 模型 id。
 * @param pricing - 归一化后的规则。
 * @returns 该模型的单价。
 */
export declare function priceOf(model: string, pricing: PricingRule): ModelPrice;
/** 某个时间点在指定时区里的「日期 / 星期 / 小时」分解。 */
export interface LocalParts {
    /** `YYYY-MM-DD` */
    date: string;
    /** 0 = 周日 … 6 = 周六 */
    weekday: number;
    /** 0-23 */
    hour: number;
}
/**
 * 把时间戳分解为某个时区下的日期、星期与小时。
 *
 * 用 `Intl` 而不是 `Date#getHours()`：后者读的是运行环境本地时区，
 * 服务器与浏览器可能不同，会让同一份日志在两边算出不同的峰谷归属。
 *
 * @param ts - epoch 毫秒。
 * @param timezone - IANA 时区名；缺省用本地时区。
 * @returns 该时间点的本地分解；时区名非法时回落到本地时区。
 */
export declare function localParts(ts: number, timezone?: string): LocalParts;
/**
 * 该日期是否已进入「周末全天空闲」的生效期。
 * @param date - `YYYY-MM-DD`。
 * @param pricing - 归一化后的规则。
 * @returns 生效中为 true。
 */
export declare function weekendRelaxActive(date: string, pricing: PricingRule): boolean;
/**
 * 小时是否落在任一高峰时段内。
 * @param hour - 0-23。
 * @param pricing - 归一化后的规则。
 * @returns 命中高峰为 true。
 */
export declare function inPeakSlot(hour: number, pricing: PricingRule): boolean;
/**
 * 某个「日期 / 星期 / 小时」是否按高峰价计费。
 *
 * 判定顺序（这一条就是计费口径的唯一出处）：
 *
 *   1. **法定节假日** → 全天空闲。与 `weekendRelax` 开关无关。
 *   2. **调休上班日** → 按工作日走峰谷（不再因为是周末而全天空闲）。
 *   3. **周六 / 周日** → 若 `weekendRelax` 生效则全天空闲。
 *   4. 其余 → 按高峰时段。
 *
 * @param date - `YYYY-MM-DD`。
 * @param weekday - 0 = 周日。
 * @param hour - 0-23。
 * @param pricing - 归一化后的规则。
 * @returns 高峰价为 true，空闲价为 false。
 */
export declare function isPeakAt(date: string, weekday: number, hour: number, pricing: PricingRule): boolean;
/**
 * 某一天为什么按高峰或空闲计费（用于界面标注与排障）。
 * @param date - `YYYY-MM-DD`。
 * @param weekday - 0 = 周日。
 * @param pricing - 归一化后的规则。
 * @returns 当天的性质，以及是否全天空闲。
 */
export declare function dayRelaxReason(date: string, weekday: number, pricing: PricingRule): {
    kind: 'holiday' | 'makeup' | 'weekend' | 'weekday';
    allDayOffPeak: boolean;
};
/**
 * 日历覆盖情况（暴露给界面，提醒用户补充后续年份）。
 * @param pricing - 归一化后的规则。
 * @returns 覆盖到的年份、最后一个假期日期、以及冲突项。
 */
export declare function pricingCalendarCoverage(pricing: PricingRule): HolidayCoverage;
/**
 * 一组 token 在不含峰谷系数时的「全高峰」费用。
 * @param tokens - token 四元组。
 * @param price - 该模型的单价。
 * @returns 费用（元）。
 */
export declare function baselineCost(tokens: TokenBuckets, price: ModelPrice): number;
/**
 * 按模型分别计价后叠加峰谷系数，得到一个计费桶的费用。
 * @param models - 桶内按模型拆分的 token。
 * @param multiplier - 峰谷系数（高峰 1，空闲 `offPeakMultiplier`）。
 * @param pricing - 归一化后的规则。
 * @returns 费用（元）。
 */
export declare function costOfModelBuckets(models: Readonly<Record<string, TokenBuckets>>, multiplier: number, pricing: PricingRule): number;
/**
 * 某个计费桶的峰谷系数。
 * @param date - 桶所属日期。
 * @param weekday - 桶所属星期。
 * @param hour - 桶所属小时。
 * @param pricing - 归一化后的规则。
 * @returns 高峰 1，空闲 `offPeakMultiplier`。
 */
export declare function multiplierAt(date: string, weekday: number, hour: number, pricing: PricingRule): number;
/**
 * 一个计费桶（日期 × 小时 × 模型）的费用。
 * @param bucket - 含 `date` / `weekday` / `hour` / `models` 的桶。
 * @param pricing - 归一化后的规则。
 * @returns 费用（元）。
 */
export declare function costOfBucket(bucket: {
    date: string;
    weekday: number;
    hour: number;
    models: Readonly<Record<string, TokenBuckets>>;
}, pricing: PricingRule): number;
/**
 * 桶内全部 token 之和。
 * @param tokens - token 四元组。
 * @returns input + output + cacheRead + cacheWrite。
 */
export declare function totalTokens(tokens: TokenBuckets): number;
/**
 * 把 `ModelPrice` 摊平成适合 schemastery 表单的展示文本键顺序。
 * 仅用于界面渲染，不参与计算。
 */
export declare const PRICE_FIELD_LABELS: ReadonlyArray<{
    key: keyof ModelPrice;
    label: string;
}>;
