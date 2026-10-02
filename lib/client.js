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
/* 整页容器：作为 main 槽里的一个面板挂载，自己滚动。 */
.ub-page{display:flex;flex-direction:column;gap:18px;font-size:13px;
  padding:18px 22px 36px;overflow-y:auto;height:100%;box-sizing:border-box;
  color:var(--dsw-alias-text-primary,inherit)}
.ub-page-title{margin:0 0 2px;font-size:17px;font-weight:600;letter-spacing:.2px}
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
.ub-bar-x{font-size:9px;opacity:.55;white-space:nowrap;line-height:1}
/* 24 小时的刻度是独立一行：柱子只占满自己的列，刻度用百分比对齐到整点边界，
   这样高峰/空闲柱高不会因为刻度文字的有无而错位。 */
.ub-axis{position:relative;height:14px;margin-top:2px}
.ub-axis-l{position:absolute;top:0;transform:translateX(-50%);font-size:9px;opacity:.55;white-space:nowrap}
.ub-axis-l-end{transform:translateX(-100%)}
/* 热力图时间窗控件 */
.ub-win{display:flex;flex-direction:column;gap:6px;padding:8px 10px;margin-bottom:8px;border-radius:8px;
  background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.07));border:1px solid var(--dsw-alias-border-secondary,rgba(127,127,127,.14))}
.ub-win-row{display:flex;align-items:center;gap:8px;font-size:11.5px;flex-wrap:wrap}
.ub-win-lbl{opacity:.7;min-width:32px}
.ub-win-val{opacity:.7;margin-left:auto;font-variant-numeric:tabular-nums}
.ub-win-num{opacity:.8;min-width:62px;text-align:right;font-variant-numeric:tabular-nums}
.ub-range{flex:1;min-width:120px;height:16px;accent-color:var(--dsw-alias-brand-primary,#7c9cff);cursor:pointer}
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

return { STYLE_TAG_ID, PANEL_CSS }

})();

/* ---- styles-inject.cjs.js ---- */
__ub_internal_defs["styles-inject.cjs.js"] = (function () {
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

return { injectStyles }

})();

/* ---- panel.cjs.js ---- */
__ub_internal_defs["panel.cjs.js"] = (function () {
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
    total,
    peakCost,
    offPeakCost,
    baseline,
    savings: Math.max(0, baseline - total),
    peakShare: tokenTotal > 0 ? peakTokens / tokenTotal : 0,
    dayCost,
    modelCost,
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

/**
 * 24 小时分布的刻度。小时列很窄（24 列），把每个数字都塞在柱下会互相挤，
 * 因此只标 4 个主刻度，用百分比定位对齐到整点边界。
 * @param props.count - 列数（24）。
 * @param props.every - 每几小时一个刻度。
 * @returns 刻度条。
 */
function HourAxis(props) {
  const count = props.count || 24
  const every = props.every || 6
  const pct = (hour) => ((hour + 0.5) / count) * 100
  const labels = []
  for (let hour = 0; hour < count; hour += every) {
    labels.push({ hour, left: pct(hour) })
  }
  labels.push({ hour: count, left: 100, edge: 'end' })

  return h('div', { className: 'ub-axis' },
    labels.map((l) => h('span', {
      key: l.hour,
      className: 'ub-axis-l' + (l.edge === 'end' ? ' ub-axis-l-end' : ''),
      style: l.edge === 'end' ? { left: '100%' } : { left: l.left + '%' },
    }, String(l.hour).padStart(2, '0'))),
  )
}

/**
 * 24 小时分布（高峰时段高亮）。
 *
 * 柱子与刻度分成两行：柱子只占满自己的列（`flex:1`），刻度单独一条对齐轴，
 * 与逐日柱状图一致——这样高峰/空闲柱高不会因刻度文字的有无而错位。
 */
function HourBars(props) {
  const hours = props.hours || []
  const pricing = props.pricing
  const currency = props.currency
  const max = Math.max(1, ...hours.map((x) => x.input + x.output + x.cacheRead + x.cacheWrite))
  return h('div', null,
    h('div', { className: 'ub-bars' },
      hours.map((x) => {
        const peak = inPeakSlot(x.hour, pricing)
        const tokens = x.input + x.output + x.cacheRead + x.cacheWrite
        const height = tokens > 0 ? Math.max(3, (tokens / max) * 118) : 1
        const title = `${String(x.hour).padStart(2, '0')}:00 · ${peak ? '高峰时段' : '空闲时段'}\n总 ${fmtExact(tokens)}\n费用 ${fmtCost(x.cost, currency)}`
        return h('div', { key: x.hour, className: 'ub-bar-c', title },
          h('div', { className: 'ub-bar' + (peak ? ' peak' : ''), style: { height } }),
        )
      }),
    ),
    h(HourAxis, { count: hours.length || 24, every: 6 }),
  )
}

/** 把连续日期补全成 `YYYY-MM-DD` 序列（含端点）。 */
function dateRange(from, to) {
  const out = []
  const start = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return out
}

/** 有数据的日期（升序）。 */
function activeDatesOf(overview) {
  return [...new Set((overview.byDayHour || []).map((b) => b.date))].sort()
}

/**
 * 热力图的时间窗。返回窗口大小与右端点在「有数据日期」列表里的索引，以及 setter。
 *
 * 两个刻意的设计：
 *
 * 1. **状态里存的是「请求值」，不夹回**。首帧数据还没到（`total === 0`），若此时
 *    按 `total` 夹一次，请求的 30 天会被压成 1 天并永久留在 state 里——后面数据到了
 *    也回不去（我实测踩过：窗口卡在「1 天」）。夹回只在渲染期做。
 * 2. **右端用相对锚点**，不存绝对索引。用户没动过滑块时，右端应始终跟着「最新
 *    一天」走；存绝对索引会让「最新」停在数据第一次到达的那一天。
 *
 * @param dates - 有数据的日期（升序）。
 * @param initial - 可选初始值 `{ size, end }`（自测用；界面不传）。
 * @returns `{ size, end, setSize, setEnd, slice, from, total }`。
 */
function useHeatWindow(dates, initial) {
  const total = dates.length
  const maxSize = Math.max(1, total)
  const maxEnd = Math.max(0, total - 1)
  const clamp = (v, lo, hi) => Math.min(Math.max(lo, v), hi)

  // size：`null` = 跟随默认（30 天，上限为全部）
  const [sizeRaw, setSizeRaw] = React.useState(() =>
    initial && Number.isFinite(initial.size) ? initial.size : null)
  // end：`null` = 跟随最新；数字 = 用户手动选定的右端
  const [endRaw, setEndRaw] = React.useState(() =>
    initial && Number.isFinite(initial.end) ? initial.end : null)

  const size = sizeRaw === null ? Math.min(30, maxSize) : clamp(sizeRaw, 1, maxSize)
  const end = endRaw === null ? maxEnd : clamp(endRaw, 0, maxEnd)
  const from = Math.max(0, end - size + 1)

  const setSize = (next) => setSizeRaw(clamp(next, 1, maxSize))
  const setEnd = (next) => setEndRaw(clamp(next, 0, maxEnd))
  return { size, end, setSize, setEnd, slice: dates.slice(from, end + 1), from, total }
}

/**
 * 热力图的时间窗控件：预设 + 窗口大小 + 右端点。
 *
 * 逐日柱状图只画 30 天，但热力图能一屏放下更多；更早的时段靠这里的滑块平移查看。
 * 右端点用日期标签显示，避免用户对着裸索引猜。
 */
function HeatWindow(props) {
  const dates = props.dates
  const win = props.win
  if (dates.length <= 1) return null

  const label = (i) => (dates[i] === undefined ? '' : dates[i].slice(5).replace('-', '/'))
  const presets = [30, 90, 180]
  const shown = win.slice

  return h('div', { className: 'ub-win' },
    h('div', { className: 'ub-win-row' },
      h('span', { className: 'ub-win-lbl' }, '时段'),
      h('button', {
        type: 'button',
        className: 'ub-btn ub-btn-sm',
        onClick: () => { win.setSize(Math.min(30, dates.length)); win.setEnd(dates.length - 1) },
      }, '最近 30 天'),
      presets.slice(1).map((n) => h('button', {
        key: n,
        type: 'button',
        className: 'ub-btn ub-btn-sm',
        onClick: () => { win.setSize(Math.min(n, dates.length)); win.setEnd(dates.length - 1) },
      }, `最近 ${n} 天`)),
      h('button', {
        type: 'button',
        className: 'ub-btn ub-btn-sm',
        onClick: () => win.setSize(dates.length),
      }, `全部（${dates.length} 天）`),
      h('span', { className: 'ub-win-val' },
        `${shown.length} 天 · ${shown[0] || '—'} → ${shown[shown.length - 1] || '—'}`),
    ),
    h('label', { className: 'ub-win-row' },
      h('span', { className: 'ub-win-lbl' }, '窗口'),
      h('input', {
        type: 'range', min: 1, max: dates.length, step: 1, value: win.size,
        className: 'ub-range',
        onChange: (e) => win.setSize(Number(e.target.value)),
      }),
      h('span', { className: 'ub-win-num' }, `${win.size} 天`),
    ),
    h('label', { className: 'ub-win-row' },
      h('span', { className: 'ub-win-lbl' }, '右端'),
      h('input', {
        type: 'range', min: 0, max: Math.max(0, dates.length - 1), step: 1, value: win.end,
        className: 'ub-range',
        onChange: (e) => win.setEnd(Number(e.target.value)),
      }),
      h('span', { className: 'ub-win-num' }, label(win.end)),
    ),
  )
}

/** 日期 × 小时消耗热力（窗口由滑块决定）。 */
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
  // `dates` 由调用方裁好窗口后传入；缺省回落到「近 30 个有数据的日期」。
  const dates = props.dates || [...new Set(buckets.map((b) => b.date))].sort().slice(-30)
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

/**
 * GitHub 风格年度热力图。
 *
 * 分档阈值按**当前窗口内**的数据重算，否则放大到某一段时间后整片都会是同一档。
 */
function YearHeatmap(props) {
  const byDay = props.byDay || []
  const currency = props.currency
  const map = new Map(byDay.map((d) => [d.date, d]))

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const to = props.to || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const from = props.from || (() => {
    const start = new Date(today)
    start.setDate(start.getDate() - 364)
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  })()

  const allDates = dateRange(from, to)
  // 分档只看窗口内的数据，跨度大时整片同色的问题因此消失。
  const values = allDates
    .map((key) => map.get(key))
    .filter(Boolean)
    .map((d) => d.input + d.output)
    .sort((a, b) => a - b)
  const quantile = (p) => values[Math.min(values.length - 1, Math.floor(values.length * p))] || 0
  const t1 = quantile(0.25) || 1
  const t2 = quantile(0.5) || 1
  const t3 = quantile(0.75) || 1

  const weeks = []
  let week = []
  for (const key of allDates) {
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
      h('span', { className: 'ub-pill' }, `${allDates.length} 天 · ${from} → ${to}`),
    ),
  )
}

/* ------------------------------------------------------------------ 面板 */

/**
 * 主面板组件 —— 作为 `main` 槽里由侧栏导航选中的整页，不是设置小节。
 *
 * `main` 槽的 owner 调用是 `renderSlot('main', {}, { entryKey })`，**不传任何
 * owner props**；业务数据全部由注册方自己的 `inject` face 送进来。本页不需要
 * 任何来自 ctx 的东西（数据走自己的 HTTP 路由），因此 inject 返回空对象即可，
 * 组件也不再接收 `ctx`。
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

  // 热力图的时间窗。Hook 必须在任何提前 return 之前调用（Rules of Hooks），
  // 因此即使在 loading / error 分支下也照常求值。
  const heatDates = React.useMemo(
    () => (overview ? activeDatesOf(overview) : []),
    [overview],
  )
  const heatWin = useHeatWindow(heatDates, props && props.initialWindow)

  if (state.status === 'loading' && !overview) {
    return h('div', { className: 'ub-page' },
      h('div', { className: 'ub-page-head' },
        h('h1', { className: 'ub-page-title' }, '用量计费'),
      ),
      h('div', { className: 'ub-loading' }, '正在扫描会话日志…（首次约 4–5 秒）'),
    )
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
    return h('div', { className: 'ub-page' }, head,
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

  return h('div', { className: 'ub-page' },
    head,

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
          '改单价 / 峰谷规则：设置 → 插件 → dsh-usage-billing。',        ),
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

    // ---- 日期 × 小时热力（窗口由滑块控制） ----
    h(Section, { title: '日期 × 小时 消耗热力' },
      overview.byDayHour.length === 0
        ? h('p', { className: 'ub-hint' }, '暂无数据')
        : h('div', null,
          h(HeatWindow, { dates: heatDates, win: heatWin }),
          h(DayHourHeatmap, {
            buckets: overview.byDayHour,
            pricing,
            currency,
            dates: heatWin.slice,
          }),
        ),
    ),

    // ---- 年度热力图（同样受滑块控制，与上图共用窗口） ----
    h(Section, { title: 'Token 消耗热力图' },
      overview.byDay.length === 0
        ? h('p', { className: 'ub-hint' }, '暂无数据')
        : h(YearHeatmap, {
          byDay: overview.byDay,
          currency,
          from: heatWin.slice[0] || undefined,
          to: heatWin.slice[heatWin.slice.length - 1] || undefined,
        }),
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
 * 本文件会作为 IIFE 片段拼进 `lib/client.js`，导出通过**函数返回值**交出去
 * （而不是 `exports.X = …` 赋值），这样拼装脚本无需解析赋值语句，也躲开了
 * 模板字符串里换行 / 分号的歧义。`panelInternals` 只用于自测，不参与界面。
 */
return {
  UsagePanel,
  panelInternals: {
    fmtTokens, fmtExact, fmtCost, fmtPct, fmtBytes, fmtTime, fmtDuration,
    priceOfModel, inPeakSlot, weekendRelaxActive, isPeakAt,
    baselineCostOfBucket, costOfBucket, bucketTokens, recompute, sessionCost,
    dateRange, activeDatesOf, useHeatWindow,
  },
}

})();

/* ---- index.cjs.js ---- */
__ub_internal_defs["index.cjs.js"] = (function () {
/**
 * 浏览器半边：把「用量计费」做成一个**主导航面板**。
 *
 * 座次（对照 DSH 自己的 ui-schedule / ui-plugin-manager）：
 *   - `main`（keyed by panel id）——侧栏导航选中时占据中间主列的那一页；
 *   - `sidebar.panellist`（list）——左栏导航里的一行，其 `id` 必须等于
 *     `main` 的 key，点击即 `layout.selectPanel(id)`。
 *
 * 契约要点（均已按源码核对）：
 *   - `main` 槽的 owner 调用是 `renderSlot('main', {}, { entryKey })`
 *     （`ui-layout/src/client/AppFrame.tsx:42`）——**owner 不传任何业务 props**，
 *     数据一律由注册方自己的 `inject` face 提供，所以这里 `inject: () => ({})`。
 *   - `sidebar.panellist` 的行组件只收到 `{ size, active }`
 *     （`ui-sidebar/src/client/contract/slots.ts:70-75`），渲染一个图标即可；
 *     导航标签来自 `label`，无障碍名由侧栏负责。
 *   - 行组件的 id 是品牌化的 `MainPanelId`，`selectPanel` 要求该 id 已在 layout
 *     注册，否则抛 `main panel "…" is not registered`，因此 `main` 的注册要在
 *     行注册之前生效（下面按此顺序）。
 *
 * 数据全部来自本插件主机半边的只读 JSON 路由，不读取任何其它插件的代码。
 *
 * @module dsh-usage-billing/client
 */

'use strict'

const React = __ub_external("react")
const { injectStyles } = { injectStyles: __ub_internal_defs["styles-inject.cjs.js"].injectStyles }
const { UsagePanel, panelInternals } = { UsagePanel: __ub_internal_defs["panel.cjs.js"].UsagePanel, panelInternals: __ub_internal_defs["panel.cjs.js"].panelInternals }

/** 主导航 id，同时是 `main` 槽的 key。 */
const PANEL_ID = 'usage-billing'

/** 左栏导航标签。 */
const PANEL_LABEL = '用量计费'

/**
 * 浏览器侧需要就绪的服务。
 *
 * 只依赖 `slots`：数据来自自己的 HTTP 路由，不读会话投影，也不读写
 * `settings`（主机侧 Config 表单由 Loader / 设置页自动生成）。
 */
const inject = ['slots']

/**
 * 侧栏导航图标：内联 SVG。
 *
 * 特意**不**引入 `@deepseek-ai/dsh-client-ui-primitives` —— 那需要往
 * `dsh.client.external` 里加一个外部依赖，而一个柱状图图标不值得；
 * 用 `currentColor` 跟随主题与选中态。
 *
 * @param props - 侧栏给的 `{ size, active }`（只用到 size）。
 * @returns 装饰性柱状图图标。
 */
function UsageBillingIcon(props) {
  const size = (props && props.size) || 16
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    React.createElement('path', { d: 'M3 20.5h18' }),
    React.createElement('rect', { x: 5, y: 12, width: 3.2, height: 6.5, rx: 0.7 }),
    React.createElement('rect', { x: 10.4, y: 7.5, width: 3.2, height: 11, rx: 0.7 }),
    React.createElement('rect', { x: 15.8, y: 3.5, width: 3.2, height: 15, rx: 0.7 }),
  )
}

/**
 * 客户端插件主体。
 * @param ctx - 客户端 cordis 上下文。
 */
function apply(ctx) {
  injectStyles()

  // 主列面板：侧栏导航选中本面板时渲染。
  ctx.effect(
    () => ctx.slots.inject('main', () => ctx.slots.register({
      name: 'main',
      key: PANEL_ID,
      inject: () => ({}),
    }, UsagePanel)),
    'dsh-usage-billing: main panel',
  )

  // 左栏导航行：id 与上面 main 的 key 相同，点击即切换主列。
  ctx.effect(
    () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
      name: 'sidebar.panellist',
      id: PANEL_ID,
      order: 20,
      label: () => PANEL_LABEL,
    }, UsageBillingIcon)),
    'dsh-usage-billing: sidebar entry',
  )
}

return { inject, apply, PANEL_ID, PANEL_LABEL, UsageBillingIcon, UsagePanel, panelInternals }

})();

/* ---- exports ---- */
var __ub_entry = __ub_internal_defs["index.cjs.js"];
exports.inject = __ub_entry.inject;
exports.apply = __ub_entry.apply;
exports.PANEL_ID = __ub_entry.PANEL_ID;
exports.PANEL_LABEL = __ub_entry.PANEL_LABEL;
exports.UsageBillingIcon = __ub_entry.UsageBillingIcon;
exports.UsagePanel = __ub_entry.UsagePanel;
exports.panelInternals = __ub_entry.panelInternals;
		return module.exports;
	} });
