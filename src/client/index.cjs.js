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

const React = require('react')
const { injectStyles } = require('./styles-inject.cjs.js')
const { UsagePanel } = require('./panel.cjs.js')

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

return { inject, apply, PANEL_ID, PANEL_LABEL, UsageBillingIcon }
