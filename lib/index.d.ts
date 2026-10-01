/**
 * dsh-usage-billing 主机侧插件。
 *
 * 组成：
 *   - `Config`：计费规则。全部字段标记 `.volatile()`，因此在 Settings 的
 *     「插件」页可以实时改单价与峰谷时段，Loader 负责写回 profile patch。
 *   - 一条只读 JSON 路由 `/usage-billing/*`，供浏览器半边读取聚合结果。
 *
 * 路由只读：扫描 `$DSH_HOME/sessions` 下的会话日志，按当前计费规则算出用量与
 * 费用，没有任何写入路径。仍然套一层浏览器信任围栏，避免同一局域网内的其它
 * 来源读到本机用量。
 *
 * > schemastery 的约束：`volatile()` 必须标在**最外层**字段上，其内部元素
 * > schema 保持 plain（否则会抛 `volatile fields require a fixed object path
 * > without an enclosing volatile field`）。因此 `peakSlots` / `models` 是
 * > volatile 的数组 / 字典，元素本身不标 volatile。
 *
 * @module dsh-usage-billing
 */
import type { Context, Volatile } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type ModelPrice, type PricingRule } from './pricing.js';
export { DEFAULT_PRICING, MODEL_LABELS, modelLabel, resolvePricing } from './pricing.js';
export type { ModelPrice, PeakSlot, PricingRule, TokenBuckets } from './pricing.js';
export { defaultHome, listSessionLogs, usageOverview } from './ledger.js';
export type { DayHourBucket, DayRow, HourRow, ModelRow, SessionRow, UsageOverview, UsageRow, } from './ledger.js';
export { parseSessionLog } from './parse.js';
export type { ParsedSessionLog, UsageSample } from './parse.js';
export { parseSessionLogName, pickSessionLog, projectDisplayName } from './filenames.js';
export { decodeSessionLog, scanZstdFrames } from './zstd.js';
/** 插件在 cordis.yml 里的行名。 */
export declare const name = "dsh-usage-billing";
/** 路由前缀；浏览器半边按同一常量拼接请求地址。 */
export declare const ROUTE_PREFIX = "/usage-billing";
/**
 * 模块增强：本插件读取的事件与可选服务。
 *
 * `loader/volatile-update` 由 Loader 在 volatile 配置合并后触发，用来让派生
 * 的缓存失效；它不在 cordis 的内置事件表里，因此在这里声明。`webRuntime` 由
 * `@deepseek-ai/dsh-web-app` 在 Web 装配里提供（桌面 / headless 装配可能没有），
 * 所以按可选服务声明，用 `ctx.get` 读取。
 */
declare module '@deepseek-ai/cordis' {
    interface Events {
        /** volatile 配置已合并；监听者据此丢弃派生缓存。 */
        'loader/volatile-update'(paths: string[][]): void;
    }
    interface Context {
        /** Web 装配的绑定派生值（受信主机名等）；非 Web 装配下为 undefined。 */
        webRuntime?: {
            trustedHosts?: readonly string[];
        };
    }
}
/**
 * 挂载前必须就绪的服务：路由载体。
 *
 * 数据全部来自文件系统，不依赖会话 / 设置服务，因此即使一次会话都没跑过、
 * 或部署里没有 `ctx.settings`，也能正常出账单。
 */
export declare const inject: string[];
/**
 * 插件配置：计费规则。
 *
 * 所有字段都是 `.volatile()`，可在 Settings 里实时编辑；留空 / 未设置的字段
 * 回落到 {@link DEFAULT_PRICING}（DeepSeek 官方定价）。
 */
export interface Config {
    /** 空闲价 = 高峰价 × 该系数（官方 0.5） */
    offPeakMultiplier: Volatile<number>;
    /** 高峰时段列表（北京时间整点小时，含 start 不含 end） */
    peakSlots: Volatile<{
        start: number;
        end: number;
    }[]>;
    /** 是否启用「周末全天空闲」 */
    weekendRelax: Volatile<boolean>;
    /** 周末规则生效日期（`YYYY-MM-DD`，当日 00:00 起）；留空 = 始终生效 */
    weekendRelaxFrom: Volatile<string>;
    /** 统计时区（IANA 名称）；留空 = 跟随运行环境本地时区 */
    timezone: Volatile<string>;
    /** 会话数据目录；留空 = `$DSH_HOME`（再回落 `~/.dsh`） */
    home: Volatile<string>;
    /** 模型单价表；键是模型 id，`_default` 是兜底。留空则用官方默认表 */
    models: Volatile<Record<string, ModelPrice>>;
}
/**
 * 计费规则的 schema。
 *
 * 断言说明：`.volatile()` 会把输出类型变成 `Volatile<T>` 引用，但同一 schema
 * 的 `meta.default` 仍按「输入字面量」类型标注，两者的协变在 schemastery
 * 当前的泛型定义下无法同时满足 `Schema<Config>`（`Volatile<number>` 不能赋给
 * `number`）。核心包用「类静态属性」声明 Config，走的是宽松一些的检查路径；
 * 这里作为普通常量导出，需要显式断言一次。运行时形状与 {@link Config}
 * 完全一致（已用 `new Config({})` 实测：每个字段都是带 `.get()` 的引用）。
 */
export declare const Config: z<Config>;
/** 把插件配置折叠成 {@link PricingRule} 的部分覆盖。 */
export declare function pricingFromConfig(config: Config): Partial<PricingRule>;
/** 请求头的最小结构。 */
interface HeadersLike {
    headers: Record<string, unknown>;
}
/**
 * 浏览器信任围栏：本机回环，或部署声明的受信主机名。
 * @param req - 入站请求。
 * @param trustedHosts - 额外受信主机名（回环之外）。
 * @returns 可信为 true。
 */
export declare function isTrustedRequest(req: HeadersLike, trustedHosts: readonly string[]): boolean;
/**
 * 插件主体。
 * @param ctx - 主机侧 cordis 上下文。
 * @param config - 经 Loader 校验并填充默认值的计费配置。
 */
export declare function apply(ctx: Context, config: Config): void;
