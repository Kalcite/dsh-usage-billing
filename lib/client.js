window.__ModuleLoader__.load({
	id: "dsh-usage-billing",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
var __ub_modules = {};
function __ub_external(spec) { if (!(spec in __ub_modules)) __ub_modules[spec] = require(spec); return __ub_modules[spec]; }
var __ub_internal_defs = {};

/* ---- styles.cjs.js ---- */
__ub_internal_defs["styles.cjs.js"] = (function () {
var exports = {};
/**
 * 面板样式（内联注入）。
 *
 * DSH 的官方 `tsdown` 预设用 lightningcss 处理 `*.module.css` 并把编译结果做成
 * 带 hash 的类名映射；本包不依赖那套未发布的预设，改为把一段普通 CSS 在
 * factory 首次执行时插进 `<head>`，类名手工加 `ub-` 前缀避免与页面冲突。
 *
 * 颜色全部走 DSH 的主题变量并带兜底值，因此跟随明/暗主题。
 *
 * @module dsh-usage-billing/src/client/styles
 */

'use strict'

/** style 标签的唯一标识，保证热重载时不会重复注入。 */
const STYLE_TAG_ID = 'dsh-usage-billing/panel.css'

/** 面板样式文本。 */
const PANEL_CSS = `
.ub-root{display:flex;flex-direction:column;gap:18px;font-size:13px;color:var(--dsw-alias-text-primary,inherit)}
.ub-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.ub-title{display:flex;flex-direction:column;gap:2px}
.ub-title h2{margin:0;font-size:15px;font-weight:600}
.ub-sub{margin:0;font-size:12px;opacity:.6;word-break:break-all}
.ub-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ub-btn{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;font:inherit;font-size:12px;cursor:pointer;
  color:var(--dsw-alias-text-primary,inherit);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12));
  border:1px solid var(--dsw-alias-border-secondary,rgba(127,127,127,.3));border-radius:6px}
.ub-btn:hover{background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.2))}
.ub-btn:disabled{opacity:.5;cursor:default}
.ub-btn-sm{padding:2px 8px;font-size:11px}
.ub-err{padding:8px 10px;border-radius:6px;font-size:12px;
  color:var(--dsw-alias-state-error-primary,#f2a1a1);border:1px solid var(--dsw-alias-state-error-primary,#f2a1a1)}
.ub-hint{margin:0;font-size:11.5px;opacity:.65;line-height:1.6}
.ub-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:10px}
.ub-card{display:flex;flex-direction:column;gap:3px;padding:10px 12px;border-radius:8px;
  background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));border:1px solid var(--dsw-alias-border-secondary,rgba(127,127,127,.18))}
.ub-card-l{font-size:11px;opacity:.7;display:flex;align-items:center;gap:4px}
.ub-card-v{font-size:17px;font-weight:600;font-variant-numeric:tabular-nums}
.ub-card-v.accent{color:var(--dsw-alias-brand-primary,#7c9cff)}
.ub-card-v.warn{color:var(--dsw-alias-state-warning-primary,#e0a33e)}
.ub-sec{display:flex;flex-direction:column;gap:10px}
.ub-sec-t{margin:0;font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:6px;opacity:.9}
.ub-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.ub-bill{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
.ub-bill-c{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border-radius:8px;
  background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));border-left:3px solid var(--dsw-alias-border-secondary,rgba(127,127,127,.4))}
.ub-bill-c.peak{border-left-color:var(--dsw-alias-state-warning-primary,#e0a33e)}
.ub-bill-c.off{border-left-color:var(--dsw-alias-brand-primary,#7c9cff)}
.ub-bill-c.save{border-left-color:var(--dsw-alias-state-success-primary,#4caf82)}
.ub-bill-l{font-size:11px;opacity:.7}
.ub-bill-v{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}
.ub-pie-w{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.ub-pie{position:relative;width:132px;height:132px;border-radius:50%;flex:0 0 auto}
.ub-pie-hole{position:absolute;inset:26px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:var(--dsw-alias-bg-base,#17171c)}
.ub-pie-n{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}
.ub-pie-s{font-size:10px;opacity:.6}
.ub-legend{display:flex;flex-direction:column;gap:5px;min-width:216px;flex:1}
.ub-leg-row{display:grid;grid-template-columns:9px 1fr auto auto;gap:8px;align-items:center;font-size:12px}
.ub-dot{width:9px;height:9px;border-radius:2px;flex:0 0 auto}
.ub-leg-v,.ub-leg-p{font-variant-numeric:tabular-nums;opacity:.8;font-size:11.5px}
.ub-bars{display:flex;align-items:flex-end;gap:2px;height:132px;padding-top:4px}
.ub-bar-c{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;min-width:0}
.ub-bar{width:100%;border-radius:2px 2px 0 0;background:var(--dsw-alias-brand-primary,#7c9cff);min-height:1px}
.ub-bar.peak{background:var(--dsw-alias-state-warning-primary,#e0a33e)}
.ub-bar-x{font-size:9px;opacity:.55;white-space:nowrap}
.ub-table{display:flex;flex-direction:column;border-radius:8px;overflow:hidden;
  border:1px solid var(--dsw-alias-border-secondary,rgba(127,127,127,.18))}
.ub-tr{display:grid;gap:8px;padding:6px 10px;font-size:12px;align-items:center;font-variant-numeric:tabular-nums}
.ub-tr+.ub-tr{border-top:1px solid var(--dsw-alias-border-secondary,rgba(127,127,127,.12))}
.ub-tr.h{font-size:11px;opacity:.65;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08))}
.ub-tr.hover:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1))}
.ub-tr.warn{color:var(--dsw-alias-state-warning-primary,#e0a33e)}
.ub-r-day{grid-template-columns:1fr 1fr 1fr 1fr 1fr}
.ub-r-model{grid-template-columns:1.6fr 1fr 1fr 1fr}
.ub-r-sess{grid-template-columns:2fr 1.4fr 1fr 1fr 1fr 1fr auto}
.ub-ell{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ub-heat{display:flex;flex-direction:column;gap:3px;overflow-x:auto;padding-bottom:4px}
.ub-heat-r{display:flex;gap:2px;align-items:center}
.ub-heat-l{width:78px;flex:0 0 auto;font-size:10px;opacity:.6;white-space:nowrap}
.ub-heat-l.wk{color:var(--dsw-alias-state-warning-primary,#e0a33e);opacity:.85}
.ub-cell{width:15px;height:13px;border-radius:2px;flex:0 0 auto;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12))}
.ub-cell.l1{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#7c9cff) 28%,transparent)}
.ub-cell.l2{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#7c9cff) 52%,transparent)}
.ub-cell.l3{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#7c9cff) 76%,transparent)}
.ub-cell.l4{background:var(--dsw-alias-brand-primary,#7c9cff)}
.ub-cell.peak{outline:1px solid var(--dsw-alias-state-warning-primary,#e0a33e);outline-offset:-1px}
.ub-cell.wk{box-shadow:inset 0 0 0 1px var(--dsw-alias-state-success-primary,#4caf82)}
.ub-hl{display:flex;gap:4px;align-items:center;flex-wrap:wrap;font-size:10.5px;opacity:.7}
.ub-hm{display:flex;gap:2px;overflow-x:auto;padding-bottom:4px}
.ub-hm-c{display:flex;flex-direction:column;gap:2px}
.ub-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:12px}
.ub-kv dt{opacity:.65}
.ub-kv dd{margin:0;font-variant-numeric:tabular-nums;text-align:right}
.ub-detail{padding:10px 12px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.07));
  border-top:1px solid var(--dsw-alias-border-secondary,rgba(127,127,127,.15))}
.ub-loading{padding:24px;text-align:center;opacity:.6;font-size:12.5px}
.ub-pill{display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:10px;font-size:10.5px;
  background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.2))}
`

exports.STYLE_TAG_ID = STYLE_TAG_ID
exports.PANEL_CSS = PANEL_CSS

return exports;
})();

/* ---- styles-inject.cjs.js ---- */
__ub_internal_defs["styles-inject.cjs.js"] = (function () {
var exports = {};
/**
 * 样式注入。
 *
 * 与官方 `tsdown` 客户端预设的做法一致（该预设会把 `*.module.css` 编译结果
 * 在 factory 首次执行时插进 `<head>` 并打上 `data-plugin-css` 标记），本包
 * 自带一段普通 CSS 文本，用同样的标记去重，避免热重载重复注入。
 *
 * @module dsh-usage-billing/src/client/styles-inject
 */

'use strict'

const { PANEL_CSS, STYLE_TAG_ID } = { PANEL_CSS: __ub_internal_defs["styles.cjs.js"].PANEL_CSS, STYLE_TAG_ID: __ub_internal_defs["styles.cjs.js"].STYLE_TAG_ID }

/** 是否已经注入过。 */
let injected = false

/** 把面板样式插进文档（幂等）。 */
function injectStyles() {
  if (injected) return
  injected = true
  if (typeof document === 'undefined') return
  if (document.querySelector('style[data-plugin-css=' + JSON.stringify(STYLE_TAG_ID) + ']') !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-usage-billing'
  tag.dataset.pluginCss = STYLE_TAG_ID
  tag.textContent = PANEL_CSS
  document.head.appendChild(tag)
}

exports.injectStyles = injectStyles

return exports;
})();

/* ---- panel.cjs.js ---- */
__ub_internal_defs["panel.cjs.js"] = (function () {
var exports = {};
/**
 * 「用量计费」看板面板（浏览器半边）。
 *
 * 与主机半边 `/usage-billing/summary` 返回的 {@link UsageOverview} 对接，
 * 在线重算峰谷费用：主机只负责给出 `byDayHour`（日期 × 小时 × 模型）的原始
 * token，这一层用同一套规则算钱，因此改单价 / 峰谷规则后无需重新读盘就能看到
 * 新账单。
 *
 * 本文件以 CommonJS 片段的形式参与拼接（见 `scripts/build-client.mjs`）：
 * 顶层 `__ub_external("react")` 由 shell 的模块表提供，其余一切自包含，
 * 因此不需要任何打包器。
 */

'use strict'

const React = __ub_external("react")

const h = React.createElement

/* ---------------------------------------------------------------- 格式化 */

/** 大数字缩写：1.2K / 3.4M / 5.6B。 */
function fmtTokens(n) {
  if (!Number.isFinite(n) || n === 0) return '0'
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(n)
}

/** 精确保留千分位。 */
function fmtExact(n) {
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-US')
}

/** 金额；币种由模型决定（DeepSeek 走人民币，其余走美元）。 */
function fmtCost(n, currency) {
  const symbol = currency === 'USD' ? '$' : currency === 'CNY' ? '\u00a5' : ''
  const value = Math.abs(n)
  const digits = value > 0 && value < 0.01 ? 4 : 2
  return symbol + n.toFixed(digits)
}

/** 百分比。 */
function fmtPct(n) {
  return (n * 100).toFixed(1) + '%'
}

/** 字节缩写。 */
function fmtBytes(n) {
  if (!Number.isFinite(n) || n === 0) return '0 B'
  if (n >= 1024 * 1024 * 1024) return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB'
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB'
  return n + ' B'
}

/** 时间戳 → `MM/DD HH:mm`。 */
function fmtTime(ts) {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return '—'
  const d = new Date(ts)
  const p = (v) => String(v).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 时长。 */
function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
}

/** 模型展示名（主机已给出 label，这里只做兜底）。 */
function modelLabel(row) {
  return row && row.label ? row.label : (row && row.model) || '未知模型'
}

/** 该模型的计价币种。 */
function currencyOf(modelId) {
  return typeof modelId === 'string' && modelId.indexOf('deepseek') === 0 ? 'CNY' : 'USD'
}

/* ------------------------------------------------------------ 计费（同构） */

const DEFAULT_PRICE = { inputPerM: 3, outputPerM: 9, cacheReadPerM: 0.1, cacheWritePerM: 3 }

function priceOfModel(model, pricing) {
  const models = (pricing && pricing.models) || {}
  return models[model] || models._default || DEFAULT_PRICE
}

function inPeakSlot(hour, pricing) {
  const slots = (pricing && pricing.peakSlots) || []
  return slots.some((s) => hour >= s.start && hour < s.end)
}

function weekendRelaxActive(date, pricing) {
  if (!pricing || !pricing.weekendRelax) return false
  const from = pricing.weekendRelaxFrom
  if (!from) return true
  return date >= from
}

function isPeakAt(date, weekday, hour, pricing) {
  if ((weekday === 0 || weekday === 6) && weekendRelaxActive(date, pricing)) return false
  return inPeakSlot(hour, pricing)
}

/** 一个日期×小时桶在「全高峰」口径下的费用。 */
function baselineCostOfBucket(bucket, pricing) {
  let cost = 0
  for (const model of Object.keys(bucket.models || {})) {
    const t = bucket.models[model]
    const p = priceOfModel(model, pricing)
    cost += (t.input * p.inputPerM + t.output * p.outputPerM
      + t.cacheRead * p.cacheReadPerM + t.cacheWrite * p.cacheWritePerM) / 1e6
  }
  return cost
}

/** 一个日期×小时桶的实际费用（含峰谷系数）。 */
function costOfBucket(bucket, pricing) {
  const multiplier = isPeakAt(bucket.date, bucket.weekday, bucket.hour, pricing)
    ? 1
    : (pricing && typeof pricing.offPeakMultiplier === 'number' ? pricing.offPeakMultiplier : 0.5)
  return baselineCostOfBucket(bucket, pricing) * multiplier
}

function bucketTokens(b) {
  return b.input + b.output + b.cacheRead + b.cacheWrite
}

/**
 * 用当前规则重算全部账单。
 *
 * 账单只能按 `byDayHour` 重算：只有这一层同时带 `date` / `weekday` / `hour`
 * 和按模型拆分的 token，才能正确套用峰谷与周末规则。
 */
function recompute(overview, pricing) {
  const buckets = overview.byDayHour || []
  let total = 0
  let peakCost = 0
  let offPeakCost = 0
  let baseline = 0
  let peakTokens = 0
  let offPeakTokens = 0
  const dayCost = new Map()
  const modelCost = new Map()

  for (const bucket of buckets) {
    const cost = costOfBucket(bucket, pricing)
    const base = baselineCostOfBucket(bucket, pricing)
    const peak = isPeakAt(bucket.date, bucket.weekday, bucket.hour, pricing)
    const tokens = bucketTokens(bucket)

    total += cost
    baseline += base
    if (peak) { peakCost += cost; peakTokens += tokens } else { offPeakCost += cost; offPeakTokens += tokens }
    dayCost.set(bucket.date, (dayCost.get(bucket.date) || 0) + cost)

    const multiplier = peak ? 1 : (pricing && typeof pricing.offPeakMultiplier === 'number' ? pricing.offPeakMultiplier : 0.5)
    for (const model of Object.keys(bucket.models || {})) {
      const t = bucket.models[model]
      const p = priceOfModel(model, pricing)
      const raw = (t.input * p.inputPerM + t.output * p.outputPerM
        + t.cacheRead * p.cacheReadPerM + t.cacheWrite * p.cacheWritePerM) / 1e6
      modelCost.set(model, (modelCost.get(model) || 0) + raw * multiplier)
    }
  }

  const tokenTotal = peakTokens + offPeakTokens
  return {
    savings: Math.max(0, baseline - total),
    peakShare: tokenTotal > 0 ? peakTokens / tokenTotal : 0,
  }
}

/** 单会话的实时费用（用会话自己的 dayHour）。 */
function sessionCost(session, pricing) {
  if (!session.dayHour || session.dayHour.length === 0) return session.cost || 0
  let sum = 0
  for (const bucket of session.dayHour) sum += costOfBucket(bucket, pricing)
  return sum
}

/* -------------------------------------------------------------- 小部件 */

function Card(props) {
  return h('div', { className: 'ub-card' },
    h('span', { className: 'ub-card-l' }, props.label),
    h('span', { className: 'ub-card-v' + (props.tone ? ' ' + props.tone : '') }, props.value),
  )
}

function Section(props) {
  return h('section', { className: 'ub-sec' },
    h('h3', { className: 'ub-sec-t' }, props.title),
    props.children,
  )
}

/** Token 构成饼图（conic-gradient）+ 图例。 */
function CompositionPie(props) {
  const pricing = props.pricing
  const fallback = (pricing && pricing.models && pricing.models._default) || DEFAULT_PRICE
  const items = [
    { key: 'cacheRead', label: '缓存命中输入', value: props.cacheRead, price: fallback.cacheReadPerM },
    { key: 'input', label: '输入（未命中）', value: props.input, price: fallback.inputPerM },
    { key: 'output', label: '输出', value: props.output, price: fallback.outputPerM },
    { key: 'cacheWrite', label: '缓存写入', value: props.cacheWrite, price: fallback.cacheWritePerM },
  ]
  const colors = {
    cacheRead: 'var(--dsw-alias-brand-primary,#7c9cff)',
    input: 'var(--dsw-alias-state-warning-primary,#e0a33e)',
    output: 'var(--dsw-alias-state-success-primary,#4caf82)',
    cacheWrite: 'var(--dsw-alias-state-error-primary,#f2a1a1)',
  }
  const total = items.reduce((s, i) => s + (i.value || 0), 0)
  const shown = items.filter((i) => i.value > 0)

  if (total === 0) return h('p', { className: 'ub-hint' }, '暂无用量数据。')

  let acc = 0
  const stops = shown.map((i) => {
    const start = (acc / total) * 100
    acc += i.value
    const end = (acc / total) * 100
    return `${colors[i.key]} ${start}% ${end}%`
  }).join(', ')

  return h('div', { className: 'ub-pie-w' },
    h('div', { className: 'ub-pie', style: { background: `conic-gradient(${stops})` } },
      h('div', { className: 'ub-pie-hole' },
        h('span', { className: 'ub-pie-n' }, fmtTokens(total)),
        h('span', { className: 'ub-pie-s' }, '总 tokens'),
      ),
    ),
    h('div', { className: 'ub-legend' },
      shown.map((i) => h('div', { key: i.key, className: 'ub-leg-row' },
        h('span', { className: 'ub-dot', style: { background: colors[i.key] } }),
        h('span', { className: 'ub-ell' }, i.label),
        h('span', { className: 'ub-leg-v' }, fmtTokens(i.value) + ' · ' + fmtPct(i.value / total)),
        h('span', { className: 'ub-leg-p' }, '¥' + i.price + '/M'),
      )),
    ),
  )
}

/** 逐日柱状图。 */
function DayBars(props) {
  const days = (props.days || []).slice(-30)
  const cost = props.dayCost
  const currency = props.currency
  const max = Math.max(1, ...days.map((d) => d.input + d.output))
  return h('div', { className: 'ub-bars' },
    days.map((d) => {
      const value = d.input + d.output
      const height = value > 0 ? Math.max(3, (value / max) * 118) : 1
      const c = cost.get(d.date)
      const title = `${d.date}\n输入 ${fmtExact(d.input)} · 输出 ${fmtExact(d.output)}\n缓存读 ${fmtExact(d.cacheRead)}\n费用 ${c === undefined ? fmtCost(d.cost, currency) : fmtCost(c, currency)}`
      return h('div', { key: d.date, className: 'ub-bar-c', title },
        h('div', { className: 'ub-bar', style: { height } }),
        h('span', { className: 'ub-bar-x' }, d.date.slice(8)),
      )
    }),
  )
}

/** 24 小时分布（高峰时段高亮）。 */
function HourBars(props) {
  const hours = props.hours || []
  const pricing = props.pricing
  const currency = props.currency
  const max = Math.max(1, ...hours.map((x) => x.input + x.output + x.cacheRead + x.cacheWrite))
  return h('div', { className: 'ub-bars' },
    hours.map((x) => {
      const peak = inPeakSlot(x.hour, pricing)
      const tokens = x.input + x.output + x.cacheRead + x.cacheWrite
      const height = tokens > 0 ? Math.max(3, (tokens / max) * 118) : 1
      const title = `${String(x.hour).padStart(2, '0')}:00 · ${peak ? '高峰时段' : '空闲时段'}\n总 ${fmtExact(tokens)}\n费用 ${fmtCost(x.cost, currency)}`
      return h('div', { key: x.hour, className: 'ub-bar-c', title },
        h('div', { className: 'ub-bar' + (peak ? ' peak' : ''), style: { height } }),
        h('span', { className: 'ub-bar-x' }, x.hour % 6 === 0 ? String(x.hour) : ''),
      )
    }),
  )
}

/** 日期 × 小时消耗热力（近 30 个有数据的日期）。 */
function DayHourHeatmap(props) {
  const buckets = props.buckets || []
  const pricing = props.pricing
  const currency = props.currency
  const map = new Map()
  let max = 1
  for (const b of buckets) {
    map.set(b.date + '|' + b.hour, b)
    max = Math.max(max, bucketTokens(b))
  }
  const dates = [...new Set(buckets.map((b) => b.date))].sort().slice(-30)
  const WK = ['日', '一', '二', '三', '四', '五', '六']

  return h('div', null,
    h('div', { className: 'ub-heat' },
      dates.map((date) => {
        const wd = new Date(date + 'T00:00:00').getDay()
        const isWeekend = wd === 0 || wd === 6
        const flatNow = weekendRelaxActive(date, pricing)
        return h('div', { key: date, className: 'ub-heat-r' },
          h('span', { className: 'ub-heat-l' + (isWeekend ? ' wk' : '') },
            date.slice(5).replace('-', '/') + ' 周' + WK[wd]),
          Array.from({ length: 24 }, (_, hour) => {
            const b = map.get(date + '|' + hour)
            const value = b ? bucketTokens(b) : 0
            const level = value > 0 ? Math.min(4, Math.ceil((value / max) * 4)) : 0
            const peak = isPeakAt(date, wd, hour, pricing)
            const cls = 'ub-cell l' + level + (peak ? ' peak' : '') + (isWeekend && flatNow ? ' wk' : '')
            const title = b
              ? `${date} ${String(hour).padStart(2, '0')}:00 周${WK[wd]} · ${peak ? '高峰' : '空闲'}\n输入 ${fmtExact(b.input)} · 输出 ${fmtExact(b.output)}\n缓存读 ${fmtExact(b.cacheRead)}\n费用 ${fmtCost(costOfBucket(b, pricing), currency)}`
              : `${date} ${String(hour).padStart(2, '0')}:00`
            return h('div', { key: hour, className: cls, title })
          }),
        )
      }),
    ),
    h('div', { className: 'ub-hl' },
      h('span', null, '少'),
      [0, 1, 2, 3, 4].map((l) => h('span', { key: l, className: 'ub-cell l' + l })),
      h('span', null, '多'),
      h('span', { className: 'ub-pill' }, '描边 = 高峰时段'),
      h('span', { className: 'ub-pill' }, '绿框 = 周末全天空闲生效'),
    ),
  )
}

/** GitHub 风格年度热力图。 */
function YearHeatmap(props) {
  const byDay = props.byDay || []
  const currency = props.currency
  const map = new Map(byDay.map((d) => [d.date, d]))

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - 364)

  const values = byDay.map((d) => d.input + d.output).sort((a, b) => a - b)
  const quantile = (p) => values[Math.min(values.length - 1, Math.floor(values.length * p))] || 0
  const t1 = quantile(0.25) || 1
  const t2 = quantile(0.5) || 1
  const t3 = quantile(0.75) || 1

  const weeks = []
  let week = []
  for (let i = 0; i < 365; i += 1) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const day = map.get(key)
    const total = day ? day.input + day.output : 0
    let level = 0
    if (total > 0) level = total > t3 ? 4 : total > t2 ? 3 : total > t1 ? 2 : 1
    const title = day
      ? `${key}\n输入 ${fmtExact(day.input)} · 输出 ${fmtExact(day.output)}\n费用 ${fmtCost(day.cost, currency)}`
      : key
    week.push({ key, level, title })
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) weeks.push(week)

  return h('div', null,
    h('div', { className: 'ub-hm' },
      weeks.map((w, wi) => h('div', { key: wi, className: 'ub-hm-c' },
        w.map((c) => h('div', { key: c.key, className: 'ub-cell l' + c.level, title: c.title })),
      )),
    ),
    h('div', { className: 'ub-hl' },
      h('span', null, '少'),
      [0, 1, 2, 3, 4].map((l) => h('span', { key: l, className: 'ub-cell l' + l })),
      h('span', null, '多'),
      h('span', { className: 'ub-pill' }, '近 365 天'),
    ),
  )
}

/* ------------------------------------------------------------------ 面板 */

/**
 * 主面板组件。
 *
 * @param props.ctx - 客户端 cordis 上下文（用于读活动会话的实时投影，可选）。
 */
function UsagePanel(props) {
  const [state, setState] = React.useState({ status: 'loading', overview: null, error: null, fetchedAt: 0 })
  const [expanded, setExpanded] = React.useState(null)
  const [refreshing, setRefreshing] = React.useState(false)

  const load = React.useCallback(async (force) => {
    setRefreshing(true)
    try {
      const url = '/usage-billing/summary' + (force ? '?refresh=1' : '')
      const res = await fetch(url, { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok || !body || body.ok !== true) {
        throw new Error((body && body.error) || `HTTP ${res.status}`)
      }
      setState({ status: 'ready', overview: body.overview, error: null, fetchedAt: Date.now() })
    } catch (error) {
      setState((prev) => ({
        status: prev.overview ? 'ready' : 'error',
        overview: prev.overview,
        error: error instanceof Error ? error.message : String(error),
        fetchedAt: prev.fetchedAt,
      }))
    } finally {
      setRefreshing(false)
    }
  }, [])

  React.useEffect(() => { void load(false) }, [load])

  const overview = state.overview

  const pricing = overview ? overview.pricing : null
  const billing = React.useMemo(
    () => (overview ? recompute(overview, pricing) : null),
    [overview, pricing],
  )

  if (state.status === 'loading' && !overview) {
    return h('div', { className: 'ub-root' }, h('div', { className: 'ub-loading' }, '正在扫描会话日志…'))
  }

  const head = h('div', { className: 'ub-head' },
    h('div', { className: 'ub-title' },
      h('h2', null, '用量计费'),
      h('p', { className: 'ub-sub' },
        overview
          ? `数据源 ${overview.home} · 读取 ${overview.scan.logsRead} 个日志（${fmtBytes(overview.scan.bytes)}，${overview.scan.elapsedMs} ms）`
          : '数据源未知'),
    ),
    h('div', { className: 'ub-actions' },
      h('button', {
        type: 'button',
        className: 'ub-btn',
        disabled: refreshing,
        onClick: () => { void load(true) },
      }, refreshing ? '刷新中…' : '重新扫描'),
    ),
  )

  if (state.status === 'error' && !overview) {
    return h('div', { className: 'ub-root' }, head,
      h('div', { className: 'ub-err' }, '读取用量失败：' + state.error),
      h('p', { className: 'ub-hint' },
        '请确认插件主机半边已加载（设置 → 插件），以及当前 profile 能读到会话目录。'),
    )
  }

  const t = overview.totals
  const currency = 'CNY'
  const peakText = (pricing.peakSlots || []).map((s) => `${s.start}:00-${s.end}:00`).join(' / ') || '未设置'
  const maxSessionCost = Math.max(0.01, ...overview.bySession.map((s) => sessionCost(s, pricing)))
  const last30 = (overview.byDay || []).slice(-30).reverse()

  return h('div', { className: 'ub-root' },

    state.error ? h('div', { className: 'ub-err' }, '刷新失败（显示上次结果）：' + state.error) : null,

    // ---- 概览卡片 ----
    h('div', { className: 'ub-cards' },
      h(Card, { label: '总费用（峰谷实时）', value: fmtCost(billing.total, currency), tone: 'accent' }),
      h(Card, { label: '输入 tokens', value: fmtTokens(t.input) }),
      h(Card, { label: '输出 tokens', value: fmtTokens(t.output) }),
      h(Card, { label: '缓存读取', value: fmtTokens(t.cacheRead) }),
      h(Card, { label: '会话数', value: String(t.sessions) }),
      h(Card, { label: '活跃天数', value: String(t.activeDays) }),
    ),

    // ---- 构成 + 峰谷账单 ----
    h('div', { className: 'ub-cols' },
      h(Section, { title: 'Token 构成' },
        h(CompositionPie, {
          input: t.input, output: t.output, cacheRead: t.cacheRead, cacheWrite: t.cacheWrite, pricing,
        }),
      ),
      h(Section, { title: '峰谷账单（随单价规则实时重算）' },
        h('div', { className: 'ub-bill' },
          h('div', { className: 'ub-bill-c peak' },
            h('span', { className: 'ub-bill-l' }, '高峰费用'),
            h('span', { className: 'ub-bill-v' }, fmtCost(billing.peakCost, currency)),
          ),
          h('div', { className: 'ub-bill-c off' },
            h('span', { className: 'ub-bill-l' }, '空闲费用'),
            h('span', { className: 'ub-bill-v' }, fmtCost(billing.offPeakCost, currency)),
          ),
          h('div', { className: 'ub-bill-c save' },
            h('span', { className: 'ub-bill-l' }, '相对全高峰节省'),
            h('span', { className: 'ub-bill-v' }, fmtCost(billing.savings, currency)),
          ),
          h('div', { className: 'ub-bill-c' },
            h('span', { className: 'ub-bill-l' }, '高峰 token 占比'),
            h('span', { className: 'ub-bill-v' }, fmtPct(billing.peakShare)),
          ),
        ),
        h('p', { className: 'ub-hint' },
          `高峰：${peakText}（北京时间） · 空闲 = 高峰 × ${pricing.offPeakMultiplier}`,
          h('br'),
          pricing.weekendRelax
            ? (pricing.weekendRelaxFrom
              ? `周末全天空闲自 ${pricing.weekendRelaxFrom} 起生效（此前周末仍分峰谷）`
              : '周末全天空闲（始终生效）')
            : '周末区分峰谷',
          h('br'),
          '改单价 / 峰谷规则：设置 → 插件 → dsh-usage-billing。',
        ),
      ),
    ),

    // ---- 模型构成 ----
    h(Section, { title: '模型构成（多模型分别计价）' },
      h('div', { className: 'ub-table' },
        h('div', { className: 'ub-tr h ub-r-model' },
          h('span', null, '模型'), h('span', null, 'tokens'), h('span', null, '费用'), h('span', null, '占比'),
        ),
        overview.byModel.length === 0
          ? h('div', { className: 'ub-tr' }, h('span', { className: 'ub-hint' }, '暂无数据'))
          : overview.byModel.map((m) => {
            const cost = billing.modelCost.get(m.model)
            const cur = currencyOf(m.model)
            return h('div', { key: m.model, className: 'ub-tr ub-r-model hover' },
              h('span', { className: 'ub-ell', title: m.model }, modelLabel(m)),
              h('span', null, fmtTokens(m.input + m.output + m.cacheRead + m.cacheWrite)),
              h('span', null, fmtCost(cost === undefined ? m.cost : cost, cur)),
              h('span', null, fmtPct(m.share)),
            )
          }),
      ),
      h('p', { className: 'ub-hint' },
        '「占比」按全部 token 计。历史日志里的模型 id 与当前目录可能不同，两者都在默认单价表中。'),
    ),

    // ---- 30 天柱状图 ----
    h(Section, { title: '最近 30 天消耗（输入 + 输出）' },
      overview.byDay.length === 0
        ? h('p', { className: 'ub-hint' }, '暂无数据')
        : h(DayBars, { days: overview.byDay, dayCost: billing.dayCost, currency }),
    ),

    // ---- 24 小时分布 ----
    h(Section, { title: '24 小时消耗分布（高峰时段高亮）' },
      h(HourBars, { hours: overview.byHour, pricing, currency }),
    ),

    // ---- 日期 × 小时热力 ----
    h(Section, { title: '日期 × 小时 消耗热力' },
      overview.byDayHour.length === 0
        ? h('p', { className: 'ub-hint' }, '暂无数据')
        : h(DayHourHeatmap, { buckets: overview.byDayHour, pricing, currency }),
    ),

    // ---- 年度热力图 ----
    h(Section, { title: 'Token 消耗热力图' },
      overview.byDay.length === 0
        ? h('p', { className: 'ub-hint' }, '暂无数据')
        : h(YearHeatmap, { byDay: overview.byDay, currency }),
    ),

    // ---- 按日明细 ----
    h(Section, { title: '最近 30 天明细' },
      h('div', { className: 'ub-table' },
        h('div', { className: 'ub-tr h ub-r-day' },
          h('span', null, '日期'), h('span', null, '输入'), h('span', null, '输出'), h('span', null, '缓存读'), h('span', null, '费用'),
        ),
        last30.map((d) => {
          const cost = billing.dayCost.get(d.date)
          const value = cost === undefined ? d.cost : cost
          return h('div', { key: d.date, className: 'ub-tr ub-r-day' + (value > 5 ? ' warn' : '') },
            h('span', null, d.date),
            h('span', null, fmtTokens(d.input)),
            h('span', null, fmtTokens(d.output)),
            h('span', null, fmtTokens(d.cacheRead)),
            h('span', null, fmtCost(value, currency)),
          )
        }),
      ),
    ),

    // ---- 会话分析 ----
    h(Section, { title: '会话分析（按费用排序，点击展开）' },
      overview.bySession.length === 0
        ? h('p', { className: 'ub-hint' }, '暂无数据')
        : h('div', { className: 'ub-table' },
          h('div', { className: 'ub-tr h ub-r-sess' },
            h('span', null, '项目 / 会话'), h('span', null, '模型'),
            h('span', null, '输入'), h('span', null, '输出'), h('span', null, '缓存读'),
            h('span', null, '费用'), h('span', null, ''),
          ),
          [...overview.bySession]
            .sort((a, b) => sessionCost(b, pricing) - sessionCost(a, pricing))
            .map((s) => {
              const cost = sessionCost(s, pricing)
              const open = expanded === s.id
              return h('div', { key: s.id },
                h('div', { className: 'ub-tr ub-r-sess hover' },
                  h('span', { className: 'ub-ell', title: s.cwd || s.project }, s.projectLabel + ' · ' + s.id.slice(0, 8)),
                  h('span', { className: 'ub-ell', title: s.models.join(', ') }, (s.modelLabels || []).join(', ') || '—'),
                  h('span', null, fmtTokens(s.input)),
                  h('span', null, fmtTokens(s.output)),
                  h('span', null, fmtTokens(s.cacheRead)),
                  h('span', { className: cost > 5 ? 'warn' : '' }, fmtCost(cost, currency)),
                  h('span', null,
                    h('button', {
                      type: 'button',
                      className: 'ub-btn ub-btn-sm',
                      onClick: () => setExpanded(open ? null : s.id),
                    }, open ? '收起' : '分析'),
                  ),
                ),
                open ? h(SessionDetail, { session: s, pricing, currency, maxCost: maxSessionCost }) : null,
              )
            }),
        ),
    ),

    // ---- 扫描信息 ----
    h(Section, { title: '扫描信息' },
      h('dl', { className: 'ub-kv' },
        h('dt', null, '数据目录'), h('dd', null, overview.home),
        h('dt', null, '会话目录 / 日志'), h('dd', null, `${overview.scan.sessionDirs} / ${overview.scan.logsRead}`),
        h('dt', null, '读取失败 / 缺日志'), h('dd', null, `${overview.scan.logsFailed} / ${overview.scan.logsMissing}`),
        h('dt', null, '日志格式分布'), h('dd', null, Object.keys(overview.scan.generations).sort()
          .map((g) => `gen${g}×${overview.scan.generations[g]}`).join('  ')),
        h('dt', null, '压缩体积 / 耗时'), h('dd', null, `${fmtBytes(overview.scan.bytes)} / ${overview.scan.elapsedMs} ms`),
        h('dt', null, '去重合并的采样'), h('dd', null, fmtExact(t.duplicateSamples)),
      ),
      h('p', { className: 'ub-hint' },
        '同一 (轮次, 步) 的用量只计一次。旧格式（gen 0）会把同一份用量同时写在流式行与消息行上，',
        '按空白解析会正好翻倍；本插件按 (turn, step) 归一，同一份用量只算一次。'),
    ),
  )
}

/** 单个会话的展开详情。 */
function SessionDetail(props) {
  const s = props.session
  const pricing = props.pricing
  const currency = props.currency

  const bill = React.useMemo(() => {
    let peak = 0
    let off = 0
    let baseline = 0
    for (const bucket of s.dayHour || []) {
      const cost = costOfBucket(bucket, pricing)
      if (isPeakAt(bucket.date, bucket.weekday, bucket.hour, pricing)) peak += cost
      else off += cost
      baseline += baselineCostOfBucket(bucket, pricing)
    }
    return { peak, off, total: peak + off, savings: Math.max(0, baseline - (peak + off)) }
  }, [s, pricing])

  const hours = React.useMemo(() => {
    const out = Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0 }))
    for (const bucket of s.dayHour || []) out[bucket.hour].total += bucketTokens(bucket)
    return out
  }, [s])

  const max = Math.max(1, ...hours.map((x) => x.total))
  const duration = s.firstTs && s.lastTs ? s.lastTs - s.firstTs : 0

  return h('div', { className: 'ub-detail' },
    h('div', { className: 'ub-cols' },
      h('div', null,
        h(CompositionPie, {
          input: s.input, output: s.output, cacheRead: s.cacheRead, cacheWrite: s.cacheWrite, pricing,
        }),
      ),
      h('div', null,
        h('div', { className: 'ub-bill' },
          h('div', { className: 'ub-bill-c peak' },
            h('span', { className: 'ub-bill-l' }, '高峰费用'),
            h('span', { className: 'ub-bill-v' }, fmtCost(bill.peak, currency)),
          ),
          h('div', { className: 'ub-bill-c off' },
            h('span', { className: 'ub-bill-l' }, '空闲费用'),
            h('span', { className: 'ub-bill-v' }, fmtCost(bill.off, currency)),
          ),
          h('div', { className: 'ub-bill-c save' },
            h('span', { className: 'ub-bill-l' }, '合计（峰谷）'),
            h('span', { className: 'ub-bill-v' }, fmtCost(bill.total, currency)),
          ),
          h('div', { className: 'ub-bill-c' },
            h('span', { className: 'ub-bill-l' }, '相对全高峰节省'),
            h('span', { className: 'ub-bill-v' }, fmtCost(bill.savings, currency)),
          ),
        ),
        h('dl', { className: 'ub-kv', style: { marginTop: 10 } },
          h('dt', null, '工作目录'), h('dd', { className: 'ub-ell', title: s.cwd || '' }, s.cwd || '—'),
          h('dt', null, '用量事件'), h('dd', null, fmtExact(s.events)),
          h('dt', null, '时长'), h('dd', null, fmtDuration(duration)),
          h('dt', null, '时间'), h('dd', null, `${fmtTime(s.firstTs)} → ${fmtTime(s.lastTs)}`),
          h('dt', null, '日志格式 / 体积'), h('dd', null, `gen ${s.generation} / ${fmtBytes(s.bytes)}`),
        ),
      ),
    ),
    h('div', { className: 'ub-sec', style: { marginTop: 12 } },
      h('h3', { className: 'ub-sec-t' }, '本会话 24 小时分布'),
      h('div', { className: 'ub-bars', style: { height: 100 } },
        hours.map((x) => {
          const peak = inPeakSlot(x.hour, pricing)
          return h('div', { key: x.hour, className: 'ub-bar-c', title: `${String(x.hour).padStart(2, '0')}:00 · ${peak ? '高峰' : '空闲'} · ${fmtExact(x.total)}` },
            h('div', { className: 'ub-bar' + (peak ? ' peak' : ''), style: { height: x.total > 0 ? Math.max(3, (x.total / max) * 88) : 1 } }),
          )
        }),
      ),
    ),
  )
}

/**
 * 模块导出面。
 *
 * 本文件会作为 IIFE 片段拼进 `lib/client.js`，因此导出必须写成对**本作用域内**
 * `exports` 的赋值（`exports.X = X`），不能用简写——简写会读成同名局部变量。
 * `panelInternals` 只用于自测，不参与界面。
 */
exports.UsagePanel = UsagePanel
exports.panelInternals = {
  fmtTokens, fmtExact, fmtCost, fmtPct, fmtBytes, fmtTime, fmtDuration,
  priceOfModel, inPeakSlot, weekendRelaxActive, isPeakAt,
  baselineCostOfBucket, costOfBucket, bucketTokens, recompute, sessionCost,
}

return exports;
})();

/* ---- index.cjs.js ---- */
__ub_internal_defs["index.cjs.js"] = (function () {
var exports = {};
/**
 * 浏览器半边：把自己注册进 DSH 设置页的一个独立分区。
 *
 * 契约（见 `docs/cookbook/adding-a-settings-card.md`）：
 *   - 主机 Loader 扫描声明了 `dsh.client` 的包，并把 `exports["./client"]`
 *     指到的预构建产物挂在 `/plugins/<包名>/client.js` 上；
 *   - 该产物的模块必须导出 `inject`（浏览器侧可用的 cordis 服务键）与
 *     `apply(ctx)`；
 *   - 页面通过 `ctx.slots.inject('settings.section', …)` 贡献，
 *     `label` 由注册方本地化。
 *
 * 数据全部通过主机半边的只读 JSON 路由取得（`/usage-billing/summary`），
 * 不读取任何其它插件的代码。
 *
 * @module dsh-usage-billing/client
 */

'use strict'

const { injectStyles } = { injectStyles: __ub_internal_defs["styles-inject.cjs.js"].injectStyles }
const { UsagePanel } = { UsagePanel: __ub_internal_defs["panel.cjs.js"].UsagePanel }

/** 面板在设置导航里的标识。 */
const SECTION_ID = 'usage-billing'

/**
 * 浏览器侧需要就绪的服务。
 *
 * 只依赖 `slots`：数据来自自己的 HTTP 路由，不读会话投影，也不读写
 * `settings`（主机侧 Config 表单由 Loader / 设置页自动生成）。
 */
const inject = ['slots']

/**
 * 客户端插件主体。
 * @param ctx - 客户端 cordis 上下文。
 */
function apply(ctx) {
  injectStyles()

  ctx.effect(
    () => ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: SECTION_ID,
      order: 60,
      label: () => '用量计费',
      inject: () => ({ ctx }),
    }, UsagePanel)),
    'dsh-usage-billing: settings section',
  )
}

exports.inject = inject
exports.apply = apply
exports.SECTION_ID = SECTION_ID

return exports;
})();

/* ---- exports ---- */
var __ub_entry = __ub_internal_defs["index.cjs.js"];
exports.inject = __ub_entry.inject;
exports.apply = __ub_entry.apply;
exports.SECTION_ID = __ub_entry.SECTION_ID;
		return module.exports;
	} });
