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

const { PANEL_CSS, STYLE_TAG_ID } = require('./styles.cjs.js')

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
