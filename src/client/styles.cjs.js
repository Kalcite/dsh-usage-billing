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

return { STYLE_TAG_ID, PANEL_CSS }
