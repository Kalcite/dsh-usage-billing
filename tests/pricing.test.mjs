// 计费规则测试：默认值、兜底、峰谷判定、周末规则、金额计算。
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_PRICING,
  baselineCost,
  costOfBucket,
  costOfModelBuckets,
  inPeakSlot,
  isPeakAt,
  localParts,
  modelLabel,
  multiplierAt,
  priceOf,
  resolvePricing,
  totalTokens,
  weekendRelaxActive,
} from '../lib/pricing.js'

const PRICING = resolvePricing()

test('默认单价表覆盖当前与历史模型 id，并有 _default 兜底', () => {
  assert.ok(DEFAULT_PRICING.models['deepseek-flash'], '当前目录 id 必须在表里')
  assert.ok(DEFAULT_PRICING.models['deepseek-v4-pro'], 'pro 必须在表里')
  assert.ok(DEFAULT_PRICING.models['deepseek-v4-flash'], '历史 id 必须在表里')
  assert.ok(DEFAULT_PRICING.models._default, '必须有兜底')
})

test('resolvePricing 合并用户覆盖并保留其余默认', () => {
  const merged = resolvePricing({ offPeakMultiplier: 0.4, models: { 'deepseek-flash': { inputPerM: 1, outputPerM: 2, cacheReadPerM: 0.01, cacheWritePerM: 1 } } })
  assert.equal(merged.offPeakMultiplier, 0.4)
  assert.equal(merged.models['deepseek-flash'].inputPerM, 1)
  assert.equal(merged.models['deepseek-flash'].outputPerM, 2)
  // 未被覆盖的模型仍在
  assert.equal(merged.models['deepseek-v4-pro'].inputPerM, 9)
  assert.equal(merged.weekendRelax, DEFAULT_PRICING.weekendRelax)
})

test('resolvePricing 支持空 / null 入参', () => {
  assert.equal(resolvePricing().offPeakMultiplier, 0.5)
  assert.equal(resolvePricing(null).offPeakMultiplier, 0.5)
  assert.equal(resolvePricing(undefined).offPeakMultiplier, 0.5)
})

test('priceOf 对未知模型回落到 _default', () => {
  assert.deepEqual(priceOf('no-such-model', PRICING), PRICING.models._default)
  assert.equal(priceOf('deepseek-v4-pro', PRICING).outputPerM, 27)
})

test('modelLabel 对未知 id 原样返回', () => {
  assert.equal(modelLabel('deepseek-v4-pro'), 'V4 Pro')
  assert.equal(modelLabel('someone-elses-model'), 'someone-elses-model')
})

test('inPeakSlot 含起点不含终点（官方 9-12 / 14-18）', () => {
  assert.equal(inPeakSlot(8, PRICING), false)
  assert.equal(inPeakSlot(9, PRICING), true)
  assert.equal(inPeakSlot(11, PRICING), true)
  assert.equal(inPeakSlot(12, PRICING), false)
  assert.equal(inPeakSlot(13, PRICING), false)
  assert.equal(inPeakSlot(14, PRICING), true)
  assert.equal(inPeakSlot(17, PRICING), true)
  assert.equal(inPeakSlot(18, PRICING), false)
  assert.equal(inPeakSlot(23, PRICING), false)
})

test('weekendRelaxActive 以 YYYY-MM-DD 为界', () => {
  assert.equal(weekendRelaxActive('2026-08-22', PRICING), false)
  assert.equal(weekendRelaxActive('2026-08-23', PRICING), true)
  assert.equal(weekendRelaxActive('2027-01-01', PRICING), true)
  // 关闭周末规则后一律为 false
  assert.equal(weekendRelaxActive('2027-01-01', resolvePricing({ weekendRelax: false })), false)
  // 生效日期留空 = 始终生效
  assert.equal(weekendRelaxActive('1970-01-01', resolvePricing({ weekendRelaxFrom: '' })), true)
})

test('isPeakAt：工作日分峰谷，周末在生效期后全天空闲', () => {
  // 工作日
  assert.equal(isPeakAt('2026-01-05', 1, 10, PRICING), true)
  assert.equal(isPeakAt('2026-01-05', 1, 13, PRICING), false)
  // 生效期之前的周末仍分峰谷
  assert.equal(isPeakAt('2026-01-10', 6, 10, PRICING), true)
  assert.equal(isPeakAt('2026-01-11', 0, 15, PRICING), true)
  assert.equal(isPeakAt('2026-01-11', 0, 13, PRICING), false)
  // 生效期之后的周末全天空闲
  assert.equal(isPeakAt('2026-09-05', 6, 10, PRICING), false)
  assert.equal(isPeakAt('2026-09-06', 0, 15, PRICING), false)
  // 生效期之后的工作日不受影响
  assert.equal(isPeakAt('2026-09-07', 1, 15, PRICING), true)
})

test('multiplierAt：高峰 1、空闲为配置系数', () => {
  assert.equal(multiplierAt('2026-01-05', 1, 10, PRICING), 1)
  assert.equal(multiplierAt('2026-01-05', 1, 13, PRICING), 0.5)
  assert.equal(multiplierAt('2026-01-05', 1, 13, resolvePricing({ offPeakMultiplier: 0.25 })), 0.25)
})

test('localParts 在指定时区下分解日期与小时（跨时区一致性）', () => {
  // 2026-01-05T02:00:00Z = 北京 10:00（周一）
  const ts = Date.UTC(2026, 0, 5, 2, 0, 0)
  const beijing = localParts(ts, 'Asia/Shanghai')
  assert.equal(beijing.date, '2026-01-05')
  assert.equal(beijing.hour, 10)
  assert.equal(beijing.weekday, 1)

  const utc = localParts(ts, 'UTC')
  assert.equal(utc.date, '2026-01-05')
  assert.equal(utc.hour, 2)

  // 时区名非法时回落到本地时区而不是抛错
  const bogus = localParts(ts, 'Not/AZone')
  assert.match(bogus.date, /^\d{4}-\d{2}-\d{2}$/)
  assert.ok(bogus.hour >= 0 && bogus.hour < 24)
})

test('localParts 跨日边界：UTC 深夜在北京已是次日', () => {
  // 2026-01-05T17:00:00Z = 北京 2026-01-06 01:00（周二）
  const ts = Date.UTC(2026, 0, 5, 17, 0, 0)
  assert.equal(localParts(ts, 'Asia/Shanghai').date, '2026-01-06')
  assert.equal(localParts(ts, 'Asia/Shanghai').hour, 1)
  assert.equal(localParts(ts, 'UTC').date, '2026-01-05')
})

test('baselineCost：四个 token 桶按各自单价相加', () => {
  const price = { inputPerM: 3, outputPerM: 9, cacheReadPerM: 0.1, cacheWritePerM: 3 }
  const tokens = { input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheWrite: 1_000_000 }
  // (3 + 9 + 0.1 + 3) = 15.1
  assert.ok(Math.abs(baselineCost(tokens, price) - 15.1) < 1e-12)
  assert.equal(baselineCost({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, price), 0)
})

test('costOfModelBuckets：多模型分别计价后统一乘峰谷系数', () => {
  const models = {
    'deepseek-flash': { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 },
    'deepseek-v4-pro': { input: 0, output: 1_000_000, cacheRead: 0, cacheWrite: 0 },
  }
  // flash 输入 3 + pro 输出 27 = 30；空闲 ×0.5 = 15
  assert.ok(Math.abs(costOfModelBuckets(models, 1, PRICING) - 30) < 1e-12)
  assert.ok(Math.abs(costOfModelBuckets(models, 0.5, PRICING) - 15) < 1e-12)
})

test('costOfBucket：高峰桶与空闲桶费用成倍数关系', () => {
  const models = { 'deepseek-flash': { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } }
  const peak = costOfBucket({ date: '2026-01-05', weekday: 1, hour: 10, models }, PRICING)
  const off = costOfBucket({ date: '2026-01-05', weekday: 1, hour: 13, models }, PRICING)
  assert.ok(Math.abs(peak - 3) < 1e-12)
  assert.ok(Math.abs(off - 1.5) < 1e-12)
})

test('costOfBucket：周末全天空闲生效后与工作日空闲同价', () => {
  const models = { 'deepseek-flash': { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } }
  const saturdayPeakHour = costOfBucket({ date: '2026-09-05', weekday: 6, hour: 10, models }, PRICING)
  assert.ok(Math.abs(saturdayPeakHour - 1.5) < 1e-12, '周末 10 点应按空闲价 1.5')
})

test('totalTokens 求和四个桶', () => {
  assert.equal(totalTokens({ input: 1, output: 2, cacheRead: 3, cacheWrite: 4 }), 10)
})

test('自定义 peakSlots 被完整采用', () => {
  const custom = resolvePricing({ peakSlots: [{ start: 20, end: 23 }] })
  assert.equal(inPeakSlot(21, custom), true)
  assert.equal(inPeakSlot(10, custom), false)
})
