// 界面渲染冒烟测试：在 jsdom 里**真正挂载**面板，让它跑完 useEffect + fetch，
// 捕捉静态检查与 SSR 都抓不到的运行时问题（hook 顺序、状态更新、DOM 结构）。
//
// SSR 不够用：useEffect 在服务端渲染时根本不执行，组件会永远停在 loading 态。
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'

import { usageOverview, defaultHome } from '../lib/ledger.js'

const require = createRequire(import.meta.url)
const React = require('react')
const { JSDOM } = require('jsdom')

/* ------------------------------------------------------- DOM 环境 */

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
  url: 'http://127.0.0.1:3080/',
  pretendToBeVisual: true,
})

/** 真实数据只算一次，fetch 桩复用它。 */
const realOverview = await usageOverview({ home: defaultHome() })

/** 汇总成断言要用的计数。 */
let fetchCalls = 0

/**
 * 注入 jsdom 环境，并记下还原动作。
 *
 * 注意 `fetch`：bundle 在 vm 沙箱里执行，沙箱的全局对象**不继承宿主全局**，
 * 所以必须把 fetch 显式放进沙箱对象，否则面板里 `typeof fetch === 'undefined'`
 * （这个坑我踩过一次，症状是界面永远停在加载态）。
 */
const restorers = []
globalThis.__ubRestore = restorers

/** 真实 fetch：桩只拦 summary，其余透传（同一进程里还有别的 HTTP 用例）。 */
const realFetch = globalThis.fetch

/** 覆盖一个全局并在 after 时还原。 */
function overrideGlobal(name, value) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, name)
  const previous = globalThis[name]
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  restorers.push(() => {
    if (had) Object.defineProperty(globalThis, name, { value: previous, configurable: true, writable: true })
    else delete globalThis[name]
  })
}

overrideGlobal('window', dom.window)
overrideGlobal('document', dom.window.document)
overrideGlobal('HTMLElement', dom.window.HTMLElement)
overrideGlobal('Node', dom.window.Node)
overrideGlobal('IS_REACT_ACT_ENVIRONMENT', true)
// Node 24 自带的 globalThis.navigator 只有 getter，不能直接赋值；react-dom 只需要
// 一个存在 navigator.userAgent 的对象，因此按需补属性而不是替换整个对象。
if (globalThis.navigator === undefined || globalThis.navigator.userAgent === undefined) {
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
}

/**
 * 面板要用的 HTTP 桩。
 *
 * **必须只拦 `/usage-billing/summary`，其余请求透传给真实 fetch**：测试入口让所有
 * 测试文件在同一个进程里、共享同一套全局，而这个桩会替换 `globalThis.fetch`。
 * 如果无差别返回本文件的 overview，同进程里别的用例（host-route 打真实回环
 * HTTP）就会收到错的数据——症状是它们单独跑全绿、进套件后集体失败。
 */
const fetchStub = async (url, init) => {
  if (!String(url).includes('/usage-billing/summary')) return realFetch(url, init)
  fetchCalls += 1
  const body = JSON.stringify({ ok: true, overview: realOverview })
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(body),
    text: async () => body,
  }
}
overrideGlobal('fetch', fetchStub)

const { createRoot } = require('react-dom/client')
const { act } = require('react')

/* ------------------------------------------------------- 载入 bundle */

/** 通过 bundle 注册的 factory 取到它的模块导出面。 */
function loadClient() {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const registry = { react: React, 'react/jsx-runtime': require('react/jsx-runtime') }
  let registered = null
  dom.window.__ModuleLoader__ = { load: (r) => { registered = r } }
  // fetch 必须显式交给沙箱：vm 上下文的全局对象不继承宿主全局。
  const sandbox = { window: dom.window, document: dom.window.document, console, fetch: fetchStub }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox, { filename: 'lib/client.js' })
  assert.ok(registered, 'bundle must register with __ModuleLoader__')
  return registered.factory((spec) => {
    if (Object.prototype.hasOwnProperty.call(registry, spec)) return registry[spec]
    throw new Error(`module table cannot answer require(${JSON.stringify(spec)})`)
  })
}

const client = loadClient()

const { UsagePanel, UsageBillingIcon, PANEL_ID, panelInternals } = client
void loadClient

/* ------------------------------------------------------------ 挂载 */

const container = document.getElementById('root')
let root
let html = ''

before(async () => {
  root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(UsagePanel, { initialWindow: { size: 30, end: 10_000 } }))
  })
  // 让 fetch → setState → 重渲染走完
  await act(async () => { await Promise.resolve() })
  html = container.innerHTML
})

after(() => {
  root?.unmount()
  // 必须还原全局：测试入口在**同一进程内**依次 import 所有测试文件，而这个文件
  // 把 fetch / document / window 换成了桩。不还原的话，后面跑的 host-route 用例
  // 会拿到桩 fetch —— 症状是它们单独跑全绿、进套件后集体失败（踩过一次）。
  const restorers = globalThis.__ubRestore
  if (Array.isArray(restorers)) for (const restore of restorers.reverse()) restore()
})

/* ------------------------------------------------------------ 断言 */

test('面板真实挂载后渲染出完整页面', () => {
  assert.ok(fetchCalls >= 1, '必须向 /usage-billing/summary 取数')
  assert.ok(html.length > 3000, `渲染结果过短：${html.length}`)
  assert.ok(html.includes('用量计费'), '标题必须在')
  for (const section of [
    'Token 构成',
    '峰谷账单',
    '模型构成',
    '24 小时消耗分布',
    '日期 × 小时 消耗热力',
    'Token 消耗热力图',
    '最近 30 天明细',
    '会话分析',
    '扫描信息',
  ]) {
    assert.ok(html.includes(section), `缺少区块：${section}`)
  }
  console.log(`  渲染 ${html.length} 字符，fetch ${fetchCalls} 次，全部区块齐备`)
})

/** 取某个区块标题之后的 HTML 片段（到下一个区块标题为止）。 */
function sectionHtml(title) {
  const start = html.indexOf(title)
  if (start === -1) return ''
  const nextTitles = ['Token 构成', '峰谷账单', '模型构成', '24 小时消耗分布', '日期 × 小时 消耗热力', 'Token 消耗热力图', '最近 30 天明细', '会话分析', '扫描信息']
  let end = html.length
  for (const other of nextTitles) {
    if (other === title) continue
    const i = html.indexOf(other, start + title.length)
    if (i !== -1 && i < end) end = i
  }
  return html.slice(start, end)
}

test('24 小时刻度是独立一行，柱子行里不再有刻度', () => {
  const hourSection = sectionHtml('24 小时消耗分布')
  assert.ok(hourSection.length > 200, '应能切出 24 小时分布区块')
  assert.ok(hourSection.includes('ub-axis'), '必须有独立的刻度行 .ub-axis')

  // 刻度文字在独立轴上
  const axisHtml = hourSection.slice(hourSection.indexOf('ub-axis'))
  for (const label of ['00', '06', '12', '18']) {
    assert.ok(axisHtml.includes(`>${label}<`), `刻度缺少 ${label}`)
  }

  // 关键回归：24 小时区块的柱子行内不得再有刻度元素（错位的根因）
  const barsStart = hourSection.indexOf('ub-bars')
  const axisStart = hourSection.indexOf('ub-axis')
  assert.ok(barsStart !== -1 && axisStart > barsStart, '刻度应排在柱子之后')
  const barRegion = hourSection.slice(barsStart, axisStart)
  assert.ok(!barRegion.includes('ub-bar-x'), '24 小时柱子行里不应再出现刻度元素')
  assert.ok(barRegion.split('ub-bar-c').length - 1 === 24, '应有 24 根柱子')
  console.log('  刻度 00/06/12/18 在独立轴上；24 根柱子的行内无刻度')
})

test('热力图时间窗控件存在且范围正确', () => {
  const heatSection = sectionHtml('日期 × 小时 消耗热力')
  assert.ok(heatSection.includes('ub-win'), '必须有时间窗控件')
  const ranges = heatSection.match(/type="range"/g) || []
  assert.equal(ranges.length, 2, '应有「窗口」与「右端」两个滑块')
  assert.ok(heatSection.includes('全部（'), '应有「全部」预设')
  for (const preset of ['最近 30 天', '最近 90 天', '最近 180 天']) {
    assert.ok(heatSection.includes(preset), `缺少预设：${preset}`)
  }
  const activeDates = new Set(realOverview.byDayHour.map((b) => b.date)).size
  assert.ok(heatSection.includes(`max="${activeDates}"`), `窗口滑块 max 应为 ${activeDates}`)
  console.log(`  两个滑块 + 3 个预设 + 全部；max = ${activeDates}`)
})

test('时段窗口真的限制热力图行数', () => {
  const activeDates = [...new Set(realOverview.byDayHour.map((b) => b.date))].sort()
  if (activeDates.length < 2) return
  const heatSection = sectionHtml('日期 × 小时 消耗热力')
  // 只数「日期行」：每行有 24 个格子，用专有的行类名，避免把年度热力图算进来
  const rows = (heatSection.match(/class="ub-heat-r"/g) || []).length
  assert.ok(rows > 0, '应有热力行')
  assert.ok(rows <= activeDates.length, `热力行数 ${rows} 不应超过有数据日期数 ${activeDates.length}`)
  // 行标签形如 `MM/DD 周X`（.ub-heat-l），据此确认右端日期确实在窗口里
  const lastLabel = activeDates[activeDates.length - 1].slice(5).replace('-', '/')
  assert.ok(heatSection.includes(lastLabel), `行标签应包含右端日期 ${lastLabel}`)
  // 窗口摘要里也应有可读区间
  assert.ok(/class="ub-win-val"[^>]*>[^<]*\d{4}-\d{2}-\d{2}/.test(heatSection), '窗口摘要应显示日期区间')
  console.log(`  热力图 ${rows} 行，右端 ${lastLabel}（有数据日期共 ${activeDates.length} 天）`)
})

test('时间窗切片逻辑（尾巴 / 前移 / 全部 / 越界夹回）', () => {
  const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05']
  const { useHeatWindow } = panelInternals
  assert.equal(typeof useHeatWindow, 'function', 'useHeatWindow 必须导出以便自测')

  /** 用小面板把 hook 的状态读成文本。 */
  function Probe(props) {
    const win = useHeatWindow(dates, props.initial)
    return React.createElement('span', null, win.slice.join(','))
  }
  const render = (initial) => {
    const box = document.createElement('div')
    const r = createRoot(box)
    act(() => { r.render(React.createElement(Probe, { initial })) })
    const text = box.textContent
    act(() => { r.unmount() })
    return text
  }

  assert.equal(render({ size: 2, end: 4 }), '2026-01-04,2026-01-05')
  assert.equal(render({ size: 2, end: 2 }), '2026-01-02,2026-01-03')
  assert.equal(render({ size: 5, end: 4 }), dates.join(','))
  // 越界只在渲染期夹回：size 超过全部 → 全部；end 超过末尾 → 末尾。
  assert.equal(render({ size: 999, end: 999 }), dates.join(','), '越界应夹回而不是产生空窗口')
  assert.equal(render({ size: 0, end: 0 }), '2026-01-01', 'size 下界为 1')
  // 未指定 → 默认跟随：30 天窗口 + 最新一天
  assert.equal(render(undefined), dates.join(','), '默认应显示全部（上限 = 全部天数）')
  console.log('  切片：尾巴 / 前移 / 全部 / 越界夹回 / 下界 / 默认 均正确')
})

test('导航图标渲染与尺寸', () => {
  const box = document.createElement('div')
  const r = createRoot(box)
  act(() => { r.render(React.createElement(UsageBillingIcon, { size: 20, active: false })) })
  const svg = box.querySelector('svg')
  assert.ok(svg, '必须渲染 svg')
  assert.equal(svg.getAttribute('width'), '20')
  assert.equal(box.querySelectorAll('rect').length, 3, '三根柱子')
  assert.equal(svg.getAttribute('aria-hidden'), 'true', '装饰性图标应 aria-hidden')
  act(() => { r.unmount() })
  console.log('  图标：svg + 3 rect，size=20 生效')
})

test('main 槽注册与侧栏行 id 一致', () => {
  const injected = []
  const registrations = []
  const stubCtx = {
    slots: {
      inject: (name, fn) => { injected.push(name); fn(); return () => {} },
      register: (options, component) => { registrations.push({ options, component }); return () => {} },
    },
    effect: (fn) => { fn(); return () => {} },
  }
  client.apply(stubCtx)
  const main = registrations.find((r) => r.options.name === 'main')
  const row = registrations.find((r) => r.options.name === 'sidebar.panellist')
  assert.ok(main && row, '必须同时注册 main 与 sidebar.panellist')
  assert.equal(row.options.id, main.options.key, '侧栏行 id 必须等于 main 的 key')
  assert.equal(main.options.key, 'usage-billing')
  assert.deepEqual(injected, ['main', 'sidebar.panellist'])
  assert.equal(PANEL_ID, 'usage-billing')
  console.log('  main(key) 与 sidebar.panellist(id) 一致 = usage-billing')
})
