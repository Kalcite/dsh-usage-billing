// 日志解析测试：文件名选版、zstd 多帧、usage 去重、模型归因、容错。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zstdCompressSync } from 'node:zlib'

import { parseSessionLogName, pickSessionLog, projectDisplayName } from '../lib/filenames.js'
import { decodeSessionLog, looksLikeZstd, scanZstdFrames } from '../lib/zstd.js'
import { parseSessionLog } from '../lib/parse.js'

/* --------------------------------------------------------- 文件名与选版 */

test('parseSessionLogName 识别代号与压缩后缀', () => {
  assert.deepEqual(parseSessionLogName('session.jsonl'), { name: 'session.jsonl', generation: 0, compressed: false })
  assert.deepEqual(parseSessionLogName('session.jsonl.zstd'), { name: 'session.jsonl.zstd', generation: 0, compressed: true })
  assert.deepEqual(parseSessionLogName('session.v2.jsonl'), { name: 'session.v2.jsonl', generation: 2, compressed: false })
  assert.deepEqual(parseSessionLogName('session.v4.jsonl.zstd'), { name: 'session.v4.jsonl.zstd', generation: 4, compressed: true })
  // 代号不设上限：参考实现只认到 v2，会把当前的 v4 整个漏掉
  assert.deepEqual(parseSessionLogName('session.v10.jsonl.zstd'), { name: 'session.v10.jsonl.zstd', generation: 10, compressed: true })
})

test('parseSessionLogName 忽略非日志文件', () => {
  for (const name of ['session.migrating.tmp', 'notes.txt', 'counts.json', 'session.jsonl.bak', 'session.v.jsonl', '']) {
    assert.equal(parseSessionLogName(name), null, `${name} 不应被识别`)
  }
})

test('pickSessionLog 取代号最高者，同代号优先 zstd', () => {
  assert.equal(pickSessionLog(['session.jsonl.zstd'])?.name, 'session.jsonl.zstd')
  assert.equal(pickSessionLog(['session.jsonl.zstd', 'session.v4.jsonl'])?.name, 'session.v4.jsonl')
  // 同代号 zstd 胜出
  assert.equal(pickSessionLog(['session.v4.jsonl', 'session.v4.jsonl.zstd'])?.name, 'session.v4.jsonl.zstd')
  assert.equal(pickSessionLog(['session.v4.jsonl.zstd', 'session.v4.jsonl'])?.name, 'session.v4.jsonl.zstd')
  // 混合场景：必须选 v4 而不是 v2（参考实现的 bug）
  assert.equal(pickSessionLog(['session.jsonl.zstd', 'session.v2.jsonl.zstd', 'session.v4.jsonl.zstd'])?.name, 'session.v4.jsonl.zstd')
  assert.equal(pickSessionLog(['notes.txt', 'counts.json']), null)
  assert.equal(pickSessionLog([]), null)
})

test('projectDisplayName 解出可读路径', () => {
  assert.equal(projectDisplayName('--home-user-code-acme--'), 'home/user/code/acme')
  assert.equal(projectDisplayName('--C-Users-user-Documents--'), 'C/Users/user/Documents')
  // ~XXXX 是非法码元的转义，解码回原字符（并保留原有的连字符）
  assert.equal(projectDisplayName('--home-user-src-~6536~7EB3~76D2--'), 'home/user/src/收纳盒')
  assert.equal(projectDisplayName('--'), '--')
})

/* --------------------------------------------------------------- zstd */

/** 编码成一行测试日志。 */
function line(obj) {
  return JSON.stringify(obj) + '\n'
}

test('scanZstdFrames 找出全部帧（多帧拼接）', () => {
  const a = zstdCompressSync(Buffer.from('alpha'))
  const b = zstdCompressSync(Buffer.from('beta'))
  const c = zstdCompressSync(Buffer.from('gamma'))
  const joined = Buffer.concat([a, b, c])
  const { frames } = scanZstdFrames(joined)
  assert.equal(frames.length, 3)
  assert.equal(frames[0].start, 0)
  assert.equal(frames[0].end, a.length)
  assert.equal(frames[1].start, a.length)
  assert.equal(frames[2].end, joined.length)
})

test('scanZstdFrames 在非 zstd 内容上返回空', () => {
  assert.deepEqual(scanZstdFrames(Buffer.from('plain text, not zstd')).frames, [])
  assert.deepEqual(scanZstdFrames(Buffer.alloc(2)).frames, [])
})

test('looksLikeZstd 只认魔数', () => {
  assert.equal(looksLikeZstd(zstdCompressSync(Buffer.from('x'))), true)
  assert.equal(looksLikeZstd(Buffer.from('nope')), false)
  assert.equal(looksLikeZstd(Buffer.alloc(0)), false)
})

test('decodeSessionLog 还原多帧拼接的完整文本', async () => {
  const p1 = line({ type: 'session', version: 0, id: 's1' })
  const p2 = line({ type: 'assistant/message', seq: 1, time: 1_700_000_000_000, data: { turn: 1, step: 1, usage: { inputTokens: 10, outputTokens: 5 } } })
  const p3 = line({ type: 'assistant/message', seq: 2, time: 1_700_000_060_000, data: { turn: 1, step: 2, usage: { inputTokens: 20, outputTokens: 7 } } })
  const buf = Buffer.concat([
    zstdCompressSync(Buffer.from(p1)),
    zstdCompressSync(Buffer.from(p2)),
    zstdCompressSync(Buffer.from(p3)),
  ])
  const text = await decodeSessionLog(buf)
  assert.equal(text, p1 + p2 + p3)
})

test('decodeSessionLog 直接返回明文 jsonl', async () => {
  const text = '{"type":"session","version":4}\n'
  assert.equal(await decodeSessionLog(Buffer.from(text)), text)
})

test('decodeSessionLog 完整帧全部还原（帧结构校验语义与 DSH 一致）', async () => {
  const good1 = zstdCompressSync(Buffer.from('{"a":1}\n'))
  const good2 = zstdCompressSync(Buffer.from('{"b":2}\n'))
  const full = Buffer.concat([good1, good2])
  assert.equal(await decodeSessionLog(full), '{"a":1}\n{"b":2}\n')
})

test('decodeSessionLog 遇到损坏的中段帧会停止（DSH 的日志是追加式，只容忍尾部截断）', async () => {
  // DSH 自己的 scanZstdFrames 在遇到非法帧头 / 保留位 / 保留块类型时直接抛错，
  // 只对「尾部被截断的最后一个帧」提供恢复（decompressZstdPrefix）。追加写的
  // 日志正常情况下不会有中间空洞，因此中段损坏等价于「此后不可读」。
  // 这里确认我们与之一致，并且不会静默产出错乱的拼接结果。
  const good = zstdCompressSync(Buffer.from('{"a":1}\n'))
  const bad = Buffer.from(zstdCompressSync(Buffer.from('{"broken":true}\n')))
  bad.fill(0, 5, bad.length - 2) // 破坏帧头结构，使其无法被扫描
  const text = await decodeSessionLog(Buffer.concat([good, bad]))
  assert.ok(text.includes('{"a":1}'), '损坏点之前的内容必须还原')
  assert.ok(!text.includes('broken'), '损坏帧不能产出内容')
})

test('decodeSessionLog 尾部截断的帧不会影响已完整的帧', async () => {
  const good = zstdCompressSync(Buffer.from('{"a":1}\n'))
  const tail = zstdCompressSync(Buffer.from('{"b":2}\n'))
  // 去掉尾部帧的最后一截，模拟写入被中断
  const truncated = Buffer.concat([good, tail.subarray(0, Math.max(1, tail.length - 6))])
  const text = await decodeSessionLog(truncated)
  assert.ok(text.includes('{"a":1}'), '完整帧必须还原')
})

/* ---------------------------------------------------------------- 解析 */

const HEADER = { type: 'session', version: 0, id: 'session-abc', cwd: 'D:\\proj' }

/** 构造 generation 0 风格的一对行：assistant/chunk 与其后的 assistant/message 携带同一份 usage。 */
function v0Pair(turn, step, usage, time, model) {
  return line({ type: 'assistant/chunk', seq: step * 10, time, data: { turn, step, usage, chunk: { type: 'usage', usage } } })
    + line({ type: 'assistant/message', seq: step * 10 + 1, time: time + 1, data: { turn, step, usage, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'deepseek-official', model } } } })
}

test('generation 0：同一 (turn,step) 的重复用量只计一次（修复 2 倍虚高）', () => {
  const usage = { inputTokens: 1000, outputTokens: 100, cacheReadTokens: 5000 }
  const text = line(HEADER) + v0Pair(1, 1, usage, 1_700_000_000_000, 'deepseek-v4-flash')
  const parsed = parseSessionLog(text, 0)
  assert.equal(parsed.samples.length, 1, '两个载体行必须归并成一条采样')
  const only = parsed.samples[0]
  assert.equal(only.input, 1000)
  assert.equal(only.output, 100)
  assert.equal(only.cacheRead, 5000)
  // 若按行朴素累加会得到 2000 / 200 / 10000，正好翻倍
})

test('generation 0：多个 step 各自独立计数', () => {
  // 每个 step 只出现一次（真实的 gen 0 会成对出现，那由下一个用例覆盖）
  const msg = (turn, step, usage, time, model) => line({
    type: 'assistant/message',
    seq: step,
    time,
    data: { turn, step, usage, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'deepseek-official', model } } },
  })
  const text = line(HEADER)
    + msg(1, 1, { inputTokens: 100, outputTokens: 10 }, 1_700_000_000_000, 'deepseek-v4-flash')
    + msg(1, 2, { inputTokens: 200, outputTokens: 20 }, 1_700_000_060_000, 'deepseek-v4-flash')
    + msg(2, 1, { inputTokens: 300, outputTokens: 30 }, 1_700_000_120_000, 'deepseek-v4-flash')
  const parsed = parseSessionLog(text, 0)
  assert.equal(parsed.samples.length, 3)
  assert.deepEqual(parsed.samples.map((s) => s.input), [100, 200, 300])
  assert.equal(parsed.duplicateSamples, 0, '每个 step 只出现一次时没有可归并的重复')
})

test('generation 0：成对载体行按 step 归并（不会翻倍）', () => {
  const text = line(HEADER)
    + v0Pair(1, 1, { inputTokens: 100, outputTokens: 10 }, 1_700_000_000_000, 'deepseek-v4-flash')
    + v0Pair(1, 2, { inputTokens: 200, outputTokens: 20 }, 1_700_000_060_000, 'deepseek-v4-flash')
  const parsed = parseSessionLog(text, 0)
  assert.equal(parsed.samples.length, 2, '两个 step → 两条采样（而不是四条）')
  assert.equal(parsed.samples.reduce((s, x) => s + x.input, 0), 300, '总和为 300 而不是 600')
  assert.equal(parsed.duplicateSamples, 2, '每个 step 的 chunk 行都被 message 行取代')
})

test('同一 (turn,step) 出现多次时保留最后一次采样并计入归并数', () => {
  const text = line(HEADER)
    + line({ type: 'assistant/chunk', seq: 1, time: 1_700_000_000_000, data: { turn: 1, step: 1, usage: { inputTokens: 111, outputTokens: 1 }, chunk: { type: 'usage', usage: { inputTokens: 111, outputTokens: 1 } } } })
    + line({ type: 'assistant/chunk', seq: 2, time: 1_700_000_000_500, data: { turn: 1, step: 1, usage: { inputTokens: 222, outputTokens: 2 }, chunk: { type: 'usage', usage: { inputTokens: 222, outputTokens: 2 } } } })
    + line({ type: 'assistant/message', seq: 3, time: 1_700_000_001_000, data: { turn: 1, step: 1, usage: { inputTokens: 333, outputTokens: 3 }, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' } } } })
  const parsed = parseSessionLog(text, 0)
  assert.equal(parsed.samples.length, 1)
  assert.equal(parsed.samples[0].input, 333, '最终值应来自最后的采样')
  assert.equal(parsed.duplicateSamples, 2, '两次被覆盖')
})

test('generation 4：只有 assistant/message 携带用量', () => {
  const text = line({ type: 'session', version: 4, id: 'session-v4', cwd: 'D:\\p' })
    + line({ type: 'request/header', seq: 1, time: 1, data: { header: { config: { provider: 'deepseek-official', model: 'deepseek-flash' } } } })
    + line({ type: 'assistant/message', seq: 2, time: 1_700_000_000_000, data: { turn: 1, step: 1, usage: { inputTokens: 6885, outputTokens: 222, cacheReadTokens: 768, cacheWriteTokens: 0, totalTokens: 7875 }, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' } } } })
  const parsed = parseSessionLog(text, 4)
  assert.equal(parsed.samples.length, 1)
  assert.equal(parsed.generation, 4, '日志头的 version 优先于文件名代号')
  assert.equal(parsed.samples[0].input, 6885)
  assert.equal(parsed.samples[0].cacheRead, 768)
  assert.equal(parsed.samples[0].model, 'deepseek-flash')
  assert.equal(parsed.samples[0].modelSource, 'message.source')
})

test('模型归因优先级：message.source > request/context > request/header', () => {
  const text = line({ type: 'session', version: 4, id: 's' })
    // 只有 header
    + line({ type: 'request/header', seq: 1, time: 1, data: { header: { config: { model: 'from-header' } } } })
    + line({ type: 'assistant/message', seq: 2, time: 1_700_000_000_000, data: { turn: 1, step: 1, usage: { inputTokens: 1 } } })
    // header + context，context 胜出
    + line({ type: 'request/header', seq: 3, time: 2, data: { header: { config: { model: 'from-header-2' } } } })
    + line({ type: 'request/context', seq: 4, time: 3, data: { provider: 'p', model: 'from-context' } })
    + line({ type: 'assistant/message', seq: 5, time: 1_700_000_060_000, data: { turn: 1, step: 2, usage: { inputTokens: 2 } } })
    // message.source 覆盖之前的归因
    + line({ type: 'assistant/message', seq: 6, time: 1_700_000_120_000, data: { turn: 1, step: 3, usage: { inputTokens: 3 }, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'p', model: 'from-source' } } } })
  const parsed = parseSessionLog(text, 4)
  const byStep = new Map(parsed.samples.map((s) => [`${s.turn}|${s.step}`, s]))
  assert.equal(byStep.get('1|1').model, 'from-header')
  assert.equal(byStep.get('1|1').modelSource, 'request/header')
  assert.equal(byStep.get('1|2').model, 'from-context')
  assert.equal(byStep.get('1|2').modelSource, 'request/context')
  assert.equal(byStep.get('1|3').model, 'from-source')
  assert.equal(byStep.get('1|3').modelSource, 'message.source')
})

test('没有任何模型线索时归因为 unknown', () => {
  const text = line({ type: 'session', version: 4, id: 's' })
    + line({ type: 'assistant/message', seq: 1, time: 1_700_000_000_000, data: { turn: 1, step: 1, usage: { inputTokens: 5 } } })
  const parsed = parseSessionLog(text, 4)
  assert.equal(parsed.samples[0].model, 'unknown')
  assert.equal(parsed.samples[0].modelSource, 'unknown')
})

test('缺少 cache / total 字段时按 0 处理，不产生 NaN', () => {
  const text = line(HEADER)
    + line({ type: 'assistant/message', seq: 1, time: 1_700_000_000_000, data: { turn: 1, step: 1, usage: { inputTokens: 8162, outputTokens: 252, cacheReadTokens: 0, reasoningTokens: 170 } } })
  const parsed = parseSessionLog(text, 0)
  const s = parsed.samples[0]
  assert.equal(s.cacheWrite, 0)
  assert.ok(Number.isFinite(s.input) && Number.isFinite(s.output) && Number.isFinite(s.cacheRead) && Number.isFinite(s.cacheWrite))
})

test('损坏的 JSON 行被跳过并计数，不影响其余行', () => {
  const text = line(HEADER)
    + '{"type":"assistant/message","seq":1,"data":{"turn":1,"step":1,"usage":{"inputTokens":10}}}\n'
    + '{"type":"assistant/message","seq":2,"data":{"turn":1,"step":2,"usage":{"inp\n'  // 截断
    + line({ type: 'assistant/message', seq: 3, time: 1_700_000_000_000, data: { turn: 1, step: 3, usage: { inputTokens: 30 } } })
  const parsed = parseSessionLog(text, 4)
  assert.equal(parsed.samples.length, 2, '两条完好行必须保留')
  assert.equal(parsed.malformedLines, 1)
  assert.equal(parsed.samples.reduce((s, x) => s + x.input, 0), 40)
})

test('流式增量行（reasoning / text chunk）不参与计量', () => {
  const text = line(HEADER)
    + line({ type: 'assistant/chunk', seq: 1, time: 1, data: { turn: 1, step: 1, chunk: { type: 'reasoning-chunks', chunks: ['thinking…'] } } })
    + line({ type: 'assistant/chunk', seq: 2, time: 2, data: { turn: 1, step: 1, chunk: { type: 'text-chunks', chunks: ['hello'] } } })
    + line({ type: 'assistant/chunk', seq: 3, time: 3, data: { turn: 1, step: 1, usage: { inputTokens: 7 }, chunk: { type: 'usage', usage: { inputTokens: 7 } } } })
  const parsed = parseSessionLog(text, 0)
  assert.equal(parsed.samples.length, 1)
  assert.equal(parsed.samples[0].input, 7)
})

test('没有 (turn,step) 的用量行各自计一次，不会互相覆盖', () => {
  const text = line(HEADER)
    + line({ type: 'assistant/message', seq: 1, time: 1_700_000_000_000, data: { usage: { inputTokens: 10 } } })
    + line({ type: 'assistant/message', seq: 2, time: 1_700_000_060_000, data: { usage: { inputTokens: 20 } } })
  const parsed = parseSessionLog(text, 0)
  assert.equal(parsed.samples.length, 2)
  assert.equal(parsed.samples.reduce((s, x) => s + x.input, 0), 30)
})

test('CRLF 换行与空行被正确处理', () => {
  const text = [
    JSON.stringify(HEADER),
    '',
    JSON.stringify({ type: 'assistant/message', seq: 1, time: 1_700_000_000_000, data: { turn: 1, step: 1, usage: { inputTokens: 42 } } }),
    '',
  ].join('\r\n')
  const parsed = parseSessionLog(text, 4)
  assert.equal(parsed.samples.length, 1)
  assert.equal(parsed.samples[0].input, 42)
})

test('空输入返回空结果而不是抛错', () => {
  const parsed = parseSessionLog('', 4)
  assert.equal(parsed.samples.length, 0)
  assert.equal(parsed.totalLines, 0)
})

test('sessionId 与 cwd 从日志头提取', () => {
  const parsed = parseSessionLog(line(HEADER), 0)
  assert.equal(parsed.sessionId, 'session-abc')
  assert.equal(parsed.cwd, 'D:\\proj')
})
