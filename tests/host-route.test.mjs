// 主机侧集成测试：把真实插件挂进真实的 cordis 应用 + 真实 webserver，
// 针对合成的会话目录做端到端 HTTP 验证。
//
// 这是最接近 DSH 自身加载方式的验证：同样的 schemastery Config 校验、
// 同样的 ctx.effect 生命周期、同样的 ctx.webServer.register 路由载体。
import { test, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http from 'node:http'
import { zstdCompressSync } from 'node:zlib'
import { Context } from '@deepseek-ai/cordis'
import WebServer from '@deepseek-ai/dsh-host-webserver'

import * as plugin from '../lib/index.js'
import { Config, ROUTE_PREFIX, isTrustedRequest } from '../lib/index.js'

/**
 * 原生 fetch 的引用。
 *
 * 测试入口让所有文件共享同一进程，因此**别的测试文件可能替换 `globalThis.fetch`**
 * （jsdom 渲染测试就会）。这里在模块加载时抓住原生实现，之后的回环 HTTP 全用它，
 * 免得被同进程的桩接管——症状是这些用例单独跑全绿、进套件后集体失败。
 */
const realFetch = globalThis.fetch
void realFetch

/**
 * 每个用例前把 `fetch` 复位为原生实现。
 *
 * 同进程里别的测试文件（jsdom 渲染测试）会用 before 钩子替换 `globalThis.fetch`，
 * 而钩子的执行时机不受本文件的用例边界约束。这里逐用例复位，保证本文件的回环
 * HTTP 永远打到真实实现，而不是别人留下的桩。
 */
beforeEach(() => { globalThis.fetch = realFetch })

/* ------------------------------------------------------------ 合成会话库 */

const ROOT = mkdtempSync(join(tmpdir(), 'dsh-ub-'))
after(() => { rmSync(ROOT, { recursive: true, force: true }) })

const line = (obj) => JSON.stringify(obj) + '\n'

/** 写一份压缩会话日志到 <root>/sessions/<project>/<sid>/。 */
function writeSession(project, sid, fileName, rows) {
  const dir = join(ROOT, 'sessions', project, sid)
  mkdirSync(dir, { recursive: true })
  // 分多个帧写入，覆盖真实的追加式布局
  const chunkSize = Math.max(1, Math.ceil(rows.length / 3))
  const frames = []
  for (let i = 0; i < rows.length; i += chunkSize) {
    frames.push(zstdCompressSync(Buffer.from(rows.slice(i, i + chunkSize).join(''))))
  }
  writeFileSync(join(dir, fileName), Buffer.concat(frames))
}

// generation 4（当前格式）：用量只写在 assistant/message 上
writeSession('--home-user-code-acme--', 'session-alpha', 'session.v4.jsonl.zstd', [
  line({ type: 'session', version: 4, id: 'session-alpha', createdAt: 1, cwd: '/home/user/code/acme' }),
  line({ type: 'request/header', seq: 1, time: Date.UTC(2026, 0, 5, 1, 0, 0), data: { header: { config: { provider: 'deepseek-official', model: 'deepseek-flash' } } } }),
  // 北京时间周一 09:00 → 高峰时段
  line({ type: 'assistant/message', seq: 2, time: Date.UTC(2026, 0, 5, 1, 0, 0), data: { turn: 1, step: 1, usage: { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' } } } }),
])

// generation 0（旧格式）：chunk 行与 message 行携带同一份用量
const legacyUsage = { inputTokens: 2_000_000, outputTokens: 0, cacheReadTokens: 0 }
writeSession('--home-user-code-legacy--', 'session-beta', 'session.jsonl.zstd', [
  line({ type: 'session', version: 0, id: 'session-beta', createdAt: 1, cwd: '/home/user/code/legacy' }),
  // 北京时间周一 13:00 → 空闲时段
  line({ type: 'assistant/chunk', seq: 1, time: Date.UTC(2026, 0, 5, 5, 0, 0), data: { turn: 1, step: 1, usage: legacyUsage, chunk: { type: 'usage', usage: legacyUsage } } }),
  line({ type: 'assistant/message', seq: 2, time: Date.UTC(2026, 0, 5, 5, 0, 1), data: { turn: 1, step: 1, usage: legacyUsage, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-v4-flash' } } } }),
])

/* ---------------------------------------------------------------- 夹具 */

/**
 * 挂载一个 webserver（绑定到系统分配的端口）并装上本插件。
 *
 * 返回的 `dispose()` 先卸载插件（释放路由）再卸载 webserver（释放端口）。
 * cordis 4 没有 `ctx.stop()`：卸载就是 `fiber.dispose()`，而留着监听中的
 * socket 会吊住测试进程。
 */
async function mount(config, homeOverride) {
  const ctx = new Context()
  const serverFiber = await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0, compression: 'none' })
  const pluginFiber = await ctx.plugin({
    name: plugin.name,
    inject: plugin.inject,
    Config,
    apply: plugin.apply,
  }, { home: homeOverride ?? ROOT, ...config })
  return {
    ctx,
    port: ctx.webServer.port,
    dispose: async () => {
      await pluginFiber.dispose()
      await serverFiber.dispose()
    },
  }
}

/** 对绑定端口发一个 GET。 */
async function get(port, path, init) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, init)
  const text = await response.text()
  let body = null
  try { body = JSON.parse(text) } catch { body = text }
  return { status: response.status, body }
}

/**
 * 用 `node:http` 发一个可以伪造 `Host` 的 GET。
 *
 * `fetch`（undici）会**静默丢弃**调用方传入的 `Host` 头，因此无法用它验证
 * 浏览器信任围栏——请求会带着真实的 `127.0.0.1:port` 到达服务端，看起来永远
 * 可信。只有底层的 `http.request` 才真的把自定义 Host 发出去。
 */
function getWithHost(port, path, host) {
  return new Promise((done, fail) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET', headers: { host } }, (res) => {
      let raw = ''
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        let body = null
        try { body = JSON.parse(raw) } catch { body = raw }
        done({ status: res.statusCode, body })
      })
    })
    req.on('error', fail)
    req.end()
  })
}

/* ---------------------------------------------------------------- 用例 */

test('插件导出面符合 DSH 主机插件契约', () => {
  assert.equal(plugin.name, 'dsh-usage-billing')
  assert.deepEqual(plugin.inject, ['webServer'])
  assert.equal(typeof plugin.apply, 'function')
  assert.equal(typeof Config, 'function', 'Config 必须是 schemastery schema（可 new）')
  assert.equal(ROUTE_PREFIX, '/usage-billing')
})

test('Config schema 解析空对象后每个字段都是 volatile 引用', () => {
  const parsed = new Config({})
  for (const key of ['offPeakMultiplier', 'peakSlots', 'weekendRelax', 'weekendRelaxFrom', 'timezone', 'home', 'models']) {
    assert.ok(key in parsed, `缺少字段 ${key}`)
    assert.equal(typeof parsed[key].get, 'function', `${key} 应为 volatile 引用`)
  }
  assert.equal(parsed.offPeakMultiplier.get(), 0.5)
  assert.equal(parsed.weekendRelax.get(), true)
  assert.equal(parsed.weekendRelaxFrom.get(), '2026-08-23')
  const slots = parsed.peakSlots.get()
  assert.deepEqual({ ...slots[0] }, { start: 9, end: 12 })
  assert.deepEqual({ ...slots[1] }, { start: 14, end: 18 })
})

test('Config schema 接受用户覆盖并保留其余默认', () => {
  const parsed = new Config({
    offPeakMultiplier: 0.4,
    peakSlots: [{ start: 20, end: 22 }],
    models: { 'deepseek-flash': { inputPerM: 1, outputPerM: 2, cacheReadPerM: 0.01, cacheWritePerM: 1 } },
  })
  assert.equal(parsed.offPeakMultiplier.get(), 0.4)
  assert.deepEqual({ ...parsed.peakSlots.get()[0] }, { start: 20, end: 22 })
  assert.equal(parsed.models.get()['deepseek-flash'].inputPerM, 1)
  assert.equal(parsed.weekendRelaxFrom.get(), '2026-08-23')
})

test('Config schema 拒绝越界与错误类型', () => {
  assert.throws(() => new Config({ offPeakMultiplier: 5 }))
  assert.throws(() => new Config({ offPeakMultiplier: -1 }))
  assert.throws(() => new Config({ peakSlots: [{ start: 99, end: 12 }] }))
  assert.throws(() => new Config({ models: { x: { inputPerM: -5 } } }))
})

test('挂载后路由可达并返回聚合结果', async () => {
  const harness = await mount({})
  try {
    const { port } = harness
    assert.ok(port > 0, 'webserver 必须已绑定端口')

    const health = await get(port, `${ROUTE_PREFIX}/health`)
    assert.equal(health.status, 200)
    assert.equal(health.body.ok, true)
    assert.equal(health.body.home, ROOT)

    const pricing = await get(port, `${ROUTE_PREFIX}/pricing`)
    assert.equal(pricing.status, 200)
    assert.equal(pricing.body.pricing.offPeakMultiplier, 0.5)
    assert.ok(pricing.body.pricing.models['deepseek-flash'])

    const summary = await get(port, `${ROUTE_PREFIX}/summary`)
    assert.equal(summary.status, 200)
    const overview = summary.body.overview
    for (const key of ['home', 'pricing', 'totals', 'byModel', 'byDay', 'byHour', 'byDayHour', 'bySession', 'scan']) {
      assert.ok(key in overview, `overview 缺少 ${key}`)
    }
    assert.equal(overview.home, ROOT)
    assert.equal(overview.scan.logsRead, 2, '两个合成会话都应被读到')
    assert.equal(overview.scan.logsFailed, 0)

    // 计费正确性：高峰 1M 输入 @3 = 3 元；空闲 2M 输入 @3 ×0.5 = 3 元
    assert.equal(overview.totals.input, 3_000_000)
    assert.ok(Math.abs(overview.totals.cost - 6) < 1e-9, `总费用应为 6，实际 ${overview.totals.cost}`)
    assert.ok(Math.abs(overview.totals.peakCost - 3) < 1e-9)
    assert.ok(Math.abs(overview.totals.offPeakCost - 3) < 1e-9)
    assert.ok(Math.abs(overview.totals.baselineCost - 9) < 1e-9, '全高峰口径应为 9')

    // 两个模型各自归因
    assert.deepEqual(overview.byModel.map((m) => m.model).sort(), ['deepseek-flash', 'deepseek-v4-flash'])

    // generation 0 的成对载体行没有翻倍
    const beta = overview.bySession.find((s) => s.id === 'session-beta')
    assert.ok(beta, '应能按会话 id 找到 session-beta')
    assert.equal(beta.input, 2_000_000, 'gen 0 的用量必须只计一次（而不是 4,000,000）')
    assert.equal(beta.generation, 0)
    assert.equal(beta.duplicateSamples, 1, 'chunk 行应被 message 行取代')

    const alpha = overview.bySession.find((s) => s.id === 'session-alpha')
    assert.equal(alpha.input, 1_000_000)
    assert.equal(alpha.generation, 4)
    assert.equal(alpha.cwd, '/home/user/code/acme')
  } finally {
    await harness.dispose()
  }
})

test('配置覆盖会改变计费结果', async () => {
  const harness = await mount({ offPeakMultiplier: 1 })
  try {
    const summary = await get(harness.port, `${ROUTE_PREFIX}/summary`)
    // 高峰 1M×3 = 3；空闲 2M×3×1 = 6 → 合计 9
    assert.ok(Math.abs(summary.body.overview.totals.cost - 9) < 1e-9,
      `取消空闲折扣后总费用应为 9，实际 ${summary.body.overview.totals.cost}`)
  } finally {
    await harness.dispose()
  }
})

test('自定义单价立刻反映在结果里', async () => {
  const harness = await mount({
    models: { 'deepseek-flash': { inputPerM: 100, outputPerM: 0, cacheReadPerM: 0, cacheWritePerM: 0 } },
  })
  try {
    const summary = await get(harness.port, `${ROUTE_PREFIX}/summary`)
    const flash = summary.body.overview.byModel.find((m) => m.model === 'deepseek-flash')
    // 1M 输入 × 100 元/M × 高峰系数 1 = 100 元
    assert.ok(Math.abs(flash.cost - 100) < 1e-9, `deepseek-flash 费用应为 100，实际 ${flash.cost}`)
  } finally {
    await harness.dispose()
  }
})

test('未知路由返回 404', async () => {
  const harness = await mount({})
  try {
    const response = await get(harness.port, `${ROUTE_PREFIX}/nope`)
    assert.equal(response.status, 404)
    assert.equal(response.body.ok, false)
  } finally {
    await harness.dispose()
  }
})

test('未受信来源被拒绝（浏览器信任围栏）', async () => {
  const harness = await mount({})
  try {
    // 伪造 Host 必须走底层 http.request：fetch 会把 Host 丢掉。
    const rejected = await getWithHost(harness.port, `${ROUTE_PREFIX}/health`, 'evil.example.com')
    assert.equal(rejected.status, 403)
    assert.equal(rejected.body.error, 'forbidden')

    // 回环 Host 仍然放行（对照组）。
    const allowed = await getWithHost(harness.port, `${ROUTE_PREFIX}/health`, `127.0.0.1:${harness.port}`)
    assert.equal(allowed.status, 200)
  } finally {
    await harness.dispose()
  }
})

test('isTrustedRequest 认回环与显式受信主机', () => {
  const trusted = ['192.168.1.10', 'dsh.lan']
  assert.equal(isTrustedRequest({ headers: { host: '127.0.0.1:3080' } }, trusted), true)
  assert.equal(isTrustedRequest({ headers: { host: 'localhost:3080' } }, trusted), true)
  assert.equal(isTrustedRequest({ headers: { host: '[::1]:3080' } }, trusted), true)
  assert.equal(isTrustedRequest({ headers: { host: '192.168.1.10:3080' } }, trusted), true)
  assert.equal(isTrustedRequest({ headers: { host: 'dsh.lan' } }, trusted), true)
  assert.equal(isTrustedRequest({ headers: { host: 'evil.example.com' } }, trusted), false)
  assert.equal(isTrustedRequest({ headers: {} }, trusted), false)
  assert.equal(isTrustedRequest({ headers: { host: '' } }, trusted), false)
})

test('卸载插件后路由被释放，但 webserver 仍在（ctx.effect 生命周期）', async () => {
  const ctx = new Context()
  const serverFiber = await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0, compression: 'none' })
  const pluginFiber = await ctx.plugin({
    name: plugin.name,
    inject: plugin.inject,
    Config,
    apply: plugin.apply,
  }, { home: ROOT })
  const port = ctx.webServer.port
  try {
    const before = await get(port, `${ROUTE_PREFIX}/health`)
    assert.equal(before.status, 200)

    // 只卸载插件：effect 的 disposer 应注销路由
    await pluginFiber.dispose()

    const gone = await get(port, `${ROUTE_PREFIX}/health`)
    assert.equal(gone.status, 404, '插件卸载后该路由应不再被接管')
  } finally {
    await serverFiber.dispose()
  }
})

test('不存在的会话目录返回空结果而不是抛错', async () => {
  const harness = await mount({}, join(ROOT, 'definitely-not-here'))
  try {
    const summary = await get(harness.port, `${ROUTE_PREFIX}/summary`)
    assert.equal(summary.status, 200)
    assert.equal(summary.body.overview.scan.logsRead, 0)
    assert.equal(summary.body.overview.totals.cost, 0)
    assert.deepEqual(summary.body.overview.bySession, [])
  } finally {
    await harness.dispose()
  }
})
