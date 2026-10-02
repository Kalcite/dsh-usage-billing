// 磁盘缓存测试：指纹、命中、失效、原子写入、损坏容错。
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, utimesSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'

import {
  CACHE_VERSION,
  cachePathFor,
  dropCache,
  fingerprintOf,
  pricingKeyOf,
  readCache,
  sameFingerprint,
  writeCache,
} from '../lib/cache.js'
import { usageOverview } from '../lib/ledger.js'
import { resolvePricing } from '../lib/pricing.js'

const line = (obj) => JSON.stringify(obj) + '\n'

const ROOT = mkdtempSync(join(tmpdir(), 'dsh-ub-cache-'))
const CACHE_DIR = join(ROOT, 'cache')
const HOME = join(ROOT, 'home')
after(() => { rmSync(ROOT, { recursive: true, force: true }) })

/** 写一个合成会话日志。 */
function writeSession(project, sid, rows) {
  const dir = join(HOME, 'sessions', project, sid)
  mkdirSync(dir, { recursive: true })
  const buf = zstdCompressSync(Buffer.from(rows.join('')))
  const file = join(dir, 'session.v4.jsonl.zstd')
  writeFileSync(file, buf)
  return file
}

const HEADER = { type: 'session', version: 4, id: 'session-c1', cwd: '/tmp/x' }

before(() => {
  writeSession('--tmp-x--', 'session-c1', [
    line(HEADER),
    line({ type: 'assistant/message', seq: 1, time: Date.UTC(2026, 0, 5, 1, 0, 0), data: { turn: 1, step: 1, usage: { inputTokens: 1_000_000, outputTokens: 0 }, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'p', model: 'deepseek-flash' } } } }),
  ])
})

/* ------------------------------------------------------------ 指纹 */

test('fingerprintOf 随日志变化（数量 / 字节 / mtime）', () => {
  const a = fingerprintOf(HOME)
  assert.equal(a.logs, 1)
  assert.ok(a.bytes > 0)
  assert.ok(a.newestMtimeMs > 0)
  assert.equal(a.sessionDirs, 1)

  // 追加一个会话 → 数量与字节都变
  const extra = writeSession('--tmp-y--', 'session-c2', [
    line({ ...HEADER, id: 'session-c2' }),
    line({ type: 'assistant/message', seq: 1, time: Date.UTC(2026, 0, 6, 1, 0, 0), data: { turn: 1, step: 1, usage: { inputTokens: 5, outputTokens: 1 }, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'p', model: 'deepseek-flash' } } } }),
  ])
  const b = fingerprintOf(HOME)
  assert.equal(b.logs, 2)
  assert.ok(b.bytes > a.bytes)
  assert.equal(sameFingerprint(a, b), false, '指纹必须变得不同')

  // 只改 mtime（内容不变）也要被发现：追加写入一定更新 mtime
  const future = new Date(Date.now() + 60_000)
  utimesSync(extra, future, future)
  const c = fingerprintOf(HOME)
  assert.equal(c.bytes, b.bytes, '字节数没变')
  assert.ok(c.newestMtimeMs > b.newestMtimeMs, 'mtime 变大')
  assert.equal(sameFingerprint(b, c), false, '仅 mtime 变化也必须让指纹失效')

  rmSync(join(HOME, 'sessions', '--tmp-y--'), { recursive: true, force: true })
})

test('sameFingerprint 逐字段比较', () => {
  const a = { sessionDirs: 1, logs: 2, bytes: 3, newestMtimeMs: 4 }
  assert.equal(sameFingerprint(a, { ...a }), true)
  for (const key of ['sessionDirs', 'logs', 'bytes', 'newestMtimeMs']) {
    assert.equal(sameFingerprint(a, { ...a, [key]: a[key] + 1 }), false, `${key} 变化应导致不等`)
  }
})

test('指纹不依赖会话内容，只做目录与 stat', () => {
  const fp = fingerprintOf(HOME)
  assert.deepEqual(Object.keys(fp).sort(), ['bytes', 'logs', 'newestMtimeMs', 'sessionDirs'])
})

/* ------------------------------------------------------ 读写与命中 */

test('写入后可读回，字段完整', () => {
  const pricing = resolvePricing()
  const overview = { home: HOME, note: 'x' }
  const ok = writeCache(HOME, {
    pricingKey: pricingKeyOf(pricing),
    fingerprint: fingerprintOf(HOME),
    overview,
  }, CACHE_DIR)
  assert.equal(ok, true)

  const back = readCache(HOME, CACHE_DIR)
  assert.ok(back, '应能读回')
  assert.equal(back.version, CACHE_VERSION)
  assert.equal(back.home, HOME)
  assert.ok(back.writtenAt > 0)
  assert.equal(back.overview.note, 'x')
  assert.equal(sameFingerprint(back.fingerprint, fingerprintOf(HOME)), true)
})

test('缓存未命中：数据变化或计费规则变化', () => {
  const pricing = resolvePricing()
  writeCache(HOME, {
    pricingKey: pricingKeyOf(pricing),
    fingerprint: fingerprintOf(HOME),
    overview: { home: HOME, note: 'y' },
  }, CACHE_DIR)

  const cached = readCache(HOME, CACHE_DIR)
  assert.ok(cached)

  // 1. 计费规则变化 → 键不同 → 不命中
  assert.notEqual(cached.pricingKey, pricingKeyOf(resolvePricing({ offPeakMultiplier: 0.4 })))

  // 2. 数据变化 → 指纹不同 → 不命中
  const p = writeSession('--tmp-z--', 'session-c3', [
    line({ ...HEADER, id: 'session-c3' }),
    line({ type: 'assistant/message', seq: 1, time: Date.UTC(2026, 0, 7, 1, 0, 0), data: { turn: 1, step: 1, usage: { inputTokens: 7, outputTokens: 2 }, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'p', model: 'deepseek-flash' } } } }),
  ])
  assert.equal(sameFingerprint(cached.fingerprint, fingerprintOf(HOME)), false)
  rmSync(join(HOME, 'sessions', '--tmp-z--'), { recursive: true, force: true })
  void p
})

test('缓存缺失 / 损坏 / 版本不符时返回 null，而不是抛错', () => {
  // 不存在
  dropCache(HOME, CACHE_DIR)
  assert.equal(readCache(HOME, CACHE_DIR), null)

  // 损坏的 JSON
  mkdirSync(CACHE_DIR, { recursive: true })
  const file = join(CACHE_DIR, cachePathFor(HOME).split(/[\\/]/).pop())
  writeFileSync(file, '{not json', 'utf8')
  assert.equal(readCache(HOME, CACHE_DIR), null)

  // 版本不符
  writeFileSync(file, JSON.stringify({ version: CACHE_VERSION + 1, home: HOME, overview: {}, fingerprint: {} }), 'utf8')
  assert.equal(readCache(HOME, CACHE_DIR), null)

  // 结构缺字段
  writeFileSync(file, JSON.stringify({ version: CACHE_VERSION, home: HOME }), 'utf8')
  assert.equal(readCache(HOME, CACHE_DIR), null)
})

test('写入是原子替换，不留下半截文件', () => {
  writeCache(HOME, { pricingKey: 'k', fingerprint: fingerprintOf(HOME), overview: { home: HOME, note: 'atomic' } }, CACHE_DIR)
  const back = readCache(HOME, CACHE_DIR)
  assert.equal(back.overview.note, 'atomic')
  // 再写一次（覆盖），仍应可读
  writeCache(HOME, { pricingKey: 'k2', fingerprint: fingerprintOf(HOME), overview: { home: HOME, note: 'atomic2' } }, CACHE_DIR)
  assert.equal(readCache(HOME, CACHE_DIR).overview.note, 'atomic2')
  assert.equal(readCache(HOME, CACHE_DIR).pricingKey, 'k2')
})

test('pricingKeyOf 对同一规则稳定、对不同规则不同', () => {
  assert.equal(pricingKeyOf(resolvePricing()), pricingKeyOf(resolvePricing()))
  assert.notEqual(pricingKeyOf(resolvePricing()), pricingKeyOf(resolvePricing({ offPeakMultiplier: 0.4 })))
})

/* -------------------------------------------------- 端到端：真的省时间 */

test('端到端：首次扫描写缓存，第二次读缓存且金额一致', async () => {
  const pricing = resolvePricing()
  dropCache(HOME, CACHE_DIR)

  // 第一次：无缓存 → 扫描
  const t0 = Date.now()
  const first = await usageOverview({ home: HOME, pricing })
  const scanMs = Date.now() - t0
  writeCache(HOME, { pricingKey: pricingKeyOf(pricing), fingerprint: fingerprintOf(HOME), overview: first }, CACHE_DIR)

  // 第二次：指纹与规则都没变 → 命中
  const cached = readCache(HOME, CACHE_DIR)
  assert.ok(cached, '应命中缓存')
  assert.equal(cached.pricingKey, pricingKeyOf(pricing))
  assert.equal(sameFingerprint(cached.fingerprint, fingerprintOf(HOME)), true)

  const t1 = Date.now()
  const second = readCache(HOME, CACHE_DIR).overview
  const cacheMs = Date.now() - t1

  assert.ok(cacheMs <= scanMs, `读缓存(${cacheMs}ms)不应慢于扫描(${scanMs}ms)`)
  assert.equal(second.totals.input, first.totals.input, '缓存金额必须与扫描一致')
  assert.equal(second.totals.cost, first.totals.cost)
  assert.equal(second.totals.sessions, first.totals.sessions)
  console.log(`  扫描 ${scanMs}ms → 缓存 ${cacheMs}ms；input=${first.totals.input} cost=${first.totals.cost}`)
})

test('缓存文件是 UTF-8 JSON 且包含 fingerprint', () => {
  writeCache(HOME, { pricingKey: 'k', fingerprint: fingerprintOf(HOME), overview: { home: HOME } }, CACHE_DIR)
  const raw = readFileSync(join(CACHE_DIR, cachePathFor(HOME).split(/[\\/]/).pop()), 'utf8')
  const parsed = JSON.parse(raw)
  assert.ok(parsed.fingerprint)
  assert.ok(typeof parsed.writtenAt === 'number')
})
