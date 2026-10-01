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

const { injectStyles } = require('./styles-inject.cjs.js')
const { UsagePanel } = require('./panel.cjs.js')

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
