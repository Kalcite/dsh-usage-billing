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

/** 单个模型的单价，单位「元 / 百万 token」，均为高峰价。 */
export interface ModelPrice {
  /** 高峰：输入（缓存未命中） */
  inputPerM: number
  /** 高峰：输出 */
  outputPerM: number
  /** 高峰：输入（缓存命中） */
  cacheReadPerM: number
  /** 高峰：缓存写入 */
  cacheWritePerM: number
}

/** 一个高峰时段（北京时间整点小时，含 start、不含 end）。 */
export interface PeakSlot {
  start: number
  end: number
}

/** 完整的计费规则（经归一化后所有字段都有确定值）。 */
export interface PricingRule {
  /** 空闲价 = 高峰价 × 该系数 */
  offPeakMultiplier: number
  /** 高峰时段列表（北京时间小时） */
  peakSlots: readonly PeakSlot[]
  /** 是否启用「周末全天空闲」 */
  weekendRelax: boolean
  /**
   * 周末规则生效日期（`YYYY-MM-DD`，北京时间当日 00:00 起）。
   * 空字符串 = 始终生效。
   */
  weekendRelaxFrom: string
  /**
   * 用于判定「日期 / 星期 / 小时」的时区（IANA 名称）。
   * 缺省用运行环境的本地时区；峰谷时段本身始终按北京时间定义。
   */
  timezone?: string
  /** 模型单价表；`_default` 是未列出模型的兜底 */
  models: Readonly<Record<string, ModelPrice>>
}

/** 一次计费所涉及的 token 四元组。 */
export interface TokenBuckets {
  /** 输入（缓存未命中） */
  input: number
  /** 输出 */
  output: number
  /** 输入（缓存命中） */
  cacheRead: number
  /** 缓存写入 */
  cacheWrite: number
}

/** token 四元组的零值。 */
export function emptyBuckets(): TokenBuckets {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
}

/**
 * 官方默认单价与峰谷规则。
 *
 * 注意 `deepseek-flash` 与 `deepseek-v4-flash` 同时保留：前者是当前 DSH
 * 模型目录里的 id，后者出现在较早的会话日志中，两者单价相同。
 */
export const DEFAULT_PRICING: PricingRule = {
  offPeakMultiplier: 0.5,
  peakSlots: [
    { start: 9, end: 12 },
    { start: 14, end: 18 },
  ],
  weekendRelax: true,
  weekendRelaxFrom: '2026-08-23',
  models: {
    // 当前模型目录 id
    'deepseek-flash': { inputPerM: 3, outputPerM: 9, cacheReadPerM: 0.1, cacheWritePerM: 3 },
    'deepseek-v4-pro': { inputPerM: 9, outputPerM: 27, cacheReadPerM: 0.3, cacheWritePerM: 9 },
    // 历史日志中的 id
    'deepseek-v4-flash': { inputPerM: 3, outputPerM: 9, cacheReadPerM: 0.1, cacheWritePerM: 3 },
    'deepseek-v4-flash-vision-exp': { inputPerM: 3, outputPerM: 9, cacheReadPerM: 0.1, cacheWritePerM: 3 },
    // 未列出模型的兜底
    _default: { inputPerM: 3, outputPerM: 9, cacheReadPerM: 0.1, cacheWritePerM: 3 },
  },
}

/** 模型 id 的展示名（未知 id 原样显示）。 */
export const MODEL_LABELS: Readonly<Record<string, string>> = {
  'deepseek-flash': 'V4 Flash',
  'deepseek-v4-flash': 'V4 Flash（历史 id）',
  'deepseek-v4-pro': 'V4 Pro',
  'deepseek-v4-flash-vision-exp': 'V4 Flash Vision',
  _default: '默认（未列出的模型）',
  unknown: '未知模型',
}

/**
 * 模型的展示名。
 * @param model - 日志中的模型 id。
 * @returns 展示名，未知 id 原样返回。
 */
export function modelLabel(model: string): string {
  return MODEL_LABELS[model] ?? model
}

/**
 * 归一化用户配置：缺省字段回落到官方默认，`models` 与默认表合并。
 * @param overrides - 来自 Loader 配置的部分规则。
 * @returns 字段完整的计费规则。
 */
export function resolvePricing(overrides?: Partial<PricingRule> | null | undefined): PricingRule {
  const source = overrides ?? {}
  const models: Record<string, ModelPrice> = { ...DEFAULT_PRICING.models }
  for (const [id, price] of Object.entries(source.models ?? {})) {
    models[id] = { ...(DEFAULT_PRICING.models._default as ModelPrice), ...price }
  }
  return {
    offPeakMultiplier: source.offPeakMultiplier ?? DEFAULT_PRICING.offPeakMultiplier,
    peakSlots: source.peakSlots ?? DEFAULT_PRICING.peakSlots,
    weekendRelax: source.weekendRelax ?? DEFAULT_PRICING.weekendRelax,
    weekendRelaxFrom: source.weekendRelaxFrom ?? DEFAULT_PRICING.weekendRelaxFrom,
    ...(source.timezone === undefined ? {} : { timezone: source.timezone }),
    models,
  }
}

/**
 * 取模型单价，未列出时用 `_default` 兜底。
 * @param model - 模型 id。
 * @param pricing - 归一化后的规则。
 * @returns 该模型的单价。
 */
export function priceOf(model: string, pricing: PricingRule): ModelPrice {
  return pricing.models[model] ?? (pricing.models._default as ModelPrice)
}

/** 某个时间点在指定时区里的「日期 / 星期 / 小时」分解。 */
export interface LocalParts {
  /** `YYYY-MM-DD` */
  date: string
  /** 0 = 周日 … 6 = 周六 */
  weekday: number
  /** 0-23 */
  hour: number
}

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timezone?: string): Intl.DateTimeFormat {
  const key = timezone ?? ''
  let formatter = partsFormatterCache.get(key)
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-US', {
      ...(timezone === undefined ? {} : { timeZone: timezone }),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
    partsFormatterCache.set(key, formatter)
  }
  return formatter
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
export function localParts(ts: number, timezone?: string): LocalParts {
  let formatter: Intl.DateTimeFormat
  try {
    formatter = partsFormatter(timezone)
  } catch {
    formatter = partsFormatter(undefined)
  }
  const parts = formatter.formatToParts(new Date(ts))
  let year = '1970', month = '01', day = '01', hour = '00', weekday = 'Thu'
  for (const part of parts) {
    switch (part.type) {
      case 'year': year = part.value; break
      case 'month': month = part.value; break
      case 'day': day = part.value; break
      case 'hour': hour = part.value; break
      case 'weekday': weekday = part.value; break
      default: break
    }
  }
  // `hourCycle: 'h23'` 仍可能在个别实现下给出 24，统一折回 0。
  const hourValue = Number(hour) % 24
  return {
    date: `${year}-${month}-${day}`,
    weekday: WEEKDAY_INDEX[weekday] ?? 0,
    hour: Number.isFinite(hourValue) ? hourValue : 0,
  }
}

/**
 * 该日期是否已进入「周末全天空闲」的生效期。
 * @param date - `YYYY-MM-DD`。
 * @param pricing - 归一化后的规则。
 * @returns 生效中为 true。
 */
export function weekendRelaxActive(date: string, pricing: PricingRule): boolean {
  if (!pricing.weekendRelax) return false
  const from = pricing.weekendRelaxFrom
  if (from === '') return true
  // 同宽 `YYYY-MM-DD` 字符串可直接按字典序比较。
  return date >= from
}

/**
 * 小时是否落在任一高峰时段内。
 * @param hour - 0-23。
 * @param pricing - 归一化后的规则。
 * @returns 命中高峰为 true。
 */
export function inPeakSlot(hour: number, pricing: PricingRule): boolean {
  return pricing.peakSlots.some((slot) => hour >= slot.start && hour < slot.end)
}

/**
 * 某个「日期 / 星期 / 小时」是否按高峰价计费。
 * @param date - `YYYY-MM-DD`。
 * @param weekday - 0 = 周日。
 * @param hour - 0-23。
 * @param pricing - 归一化后的规则。
 * @returns 高峰价为 true，空闲价为 false。
 */
export function isPeakAt(date: string, weekday: number, hour: number, pricing: PricingRule): boolean {
  if ((weekday === 0 || weekday === 6) && weekendRelaxActive(date, pricing)) return false
  return inPeakSlot(hour, pricing)
}

/**
 * 一组 token 在不含峰谷系数时的「全高峰」费用。
 * @param tokens - token 四元组。
 * @param price - 该模型的单价。
 * @returns 费用（元）。
 */
export function baselineCost(tokens: TokenBuckets, price: ModelPrice): number {
  return (
    tokens.input * price.inputPerM
    + tokens.output * price.outputPerM
    + tokens.cacheRead * price.cacheReadPerM
    + tokens.cacheWrite * price.cacheWritePerM
  ) / 1e6
}

/**
 * 按模型分别计价后叠加峰谷系数，得到一个计费桶的费用。
 * @param models - 桶内按模型拆分的 token。
 * @param multiplier - 峰谷系数（高峰 1，空闲 `offPeakMultiplier`）。
 * @param pricing - 归一化后的规则。
 * @returns 费用（元）。
 */
export function costOfModelBuckets(
  models: Readonly<Record<string, TokenBuckets>>,
  multiplier: number,
  pricing: PricingRule,
): number {
  let cost = 0
  for (const [model, tokens] of Object.entries(models)) {
    cost += baselineCost(tokens, priceOf(model, pricing)) * multiplier
  }
  return cost
}

/**
 * 某个计费桶的峰谷系数。
 * @param date - 桶所属日期。
 * @param weekday - 桶所属星期。
 * @param hour - 桶所属小时。
 * @param pricing - 归一化后的规则。
 * @returns 高峰 1，空闲 `offPeakMultiplier`。
 */
export function multiplierAt(
  date: string,
  weekday: number,
  hour: number,
  pricing: PricingRule,
): number {
  return isPeakAt(date, weekday, hour, pricing) ? 1 : pricing.offPeakMultiplier
}

/**
 * 一个计费桶（日期 × 小时 × 模型）的费用。
 * @param bucket - 含 `date` / `weekday` / `hour` / `models` 的桶。
 * @param pricing - 归一化后的规则。
 * @returns 费用（元）。
 */
export function costOfBucket(
  bucket: { date: string; weekday: number; hour: number; models: Readonly<Record<string, TokenBuckets>> },
  pricing: PricingRule,
): number {
  return costOfModelBuckets(
    bucket.models,
    multiplierAt(bucket.date, bucket.weekday, bucket.hour, pricing),
    pricing,
  )
}

/**
 * 桶内全部 token 之和。
 * @param tokens - token 四元组。
 * @returns input + output + cacheRead + cacheWrite。
 */
export function totalTokens(tokens: TokenBuckets): number {
  return tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite
}

/**
 * 把 `ModelPrice` 摊平成适合 schemastery 表单的展示文本键顺序。
 * 仅用于界面渲染，不参与计算。
 */
export const PRICE_FIELD_LABELS: ReadonlyArray<{ key: keyof ModelPrice; label: string }> = [
  { key: 'inputPerM', label: '输入（缓存未命中）' },
  { key: 'outputPerM', label: '输出' },
  { key: 'cacheReadPerM', label: '输入（缓存命中）' },
  { key: 'cacheWritePerM', label: '缓存写入' },
]
