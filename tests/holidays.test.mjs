// 法定节假日 / 调休上班日历与计费口径测试。
//
// 数据来源：国务院办公厅「关于2026年部分节假日安排的通知」国办发明电〔2025〕7号
// https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  BUILTIN_HOLIDAY_CALENDAR,
  costOfBucket,
  dayKind,
  dayRelaxReason,
  holidayCalendarCoverage,
  isHoliday,
  isMakeupWorkday,
  isPeakAt,
  mergeHolidayCalendar,
  pricingCalendarCoverage,
  resolvePricing,
} from '../lib/pricing.js'

const PRICING = resolvePricing()

/* --------------------------------------------------- 官方数据逐条核对 */

test('2026 年放假安排与官方通知逐条一致', () => {
  const expected = [
    { name: '元旦', from: '2026-01-01', to: '2026-01-03' },
    { name: '春节', from: '2026-02-15', to: '2026-02-23' },
    { name: '清明节', from: '2026-04-04', to: '2026-04-06' },
    { name: '劳动节', from: '2026-05-01', to: '2026-05-05' },
    { name: '端午节', from: '2026-06-19', to: '2026-06-21' },
    { name: '中秋节', from: '2026-09-25', to: '2026-09-27' },
    { name: '国庆节', from: '2026-10-01', to: '2026-10-07' },
  ]
  assert.deepEqual(
    BUILTIN_HOLIDAY_CALENDAR.holidays.map((r) => ({ name: r.name, from: r.from, to: r.to })),
    expected,
  )
  assert.deepEqual(
    [...BUILTIN_HOLIDAY_CALENDAR.makeupWorkdays].sort(),
    ['2026-01-04', '2026-02-14', '2026-02-28', '2026-05-09', '2026-09-20', '2026-10-10'],
  )
})

test('调休上班日全部落在周末（都需要覆盖）', () => {
  for (const d of BUILTIN_HOLIDAY_CALENDAR.makeupWorkdays) {
    const wd = new Date(d + 'T00:00:00').getDay()
    assert.ok(wd === 0 || wd === 6, `${d} 是周${wd}，若不是周末就不需要特别处理`)
  }
})

/* ------------------------------------------------------------ 判定 */

test('isHoliday 覆盖区间两端与区间外', () => {
  assert.equal(isHoliday('2026-09-30', PRICING.calendar), false)
  assert.equal(isHoliday('2026-10-01', PRICING.calendar), true, '国庆第一天')
  assert.equal(isHoliday('2026-10-07', PRICING.calendar), true, '国庆最后一天')
  assert.equal(isHoliday('2026-10-08', PRICING.calendar), false, '国庆后第一天要上班')
  assert.equal(isHoliday('2026-02-14', PRICING.calendar), false, '情人节不是假期（是调休上班）')
  assert.equal(isHoliday('2026-02-15', PRICING.calendar), true, '春节第一天')
  assert.equal(isHoliday('2026-02-23', PRICING.calendar), true, '春节最后一天')
})

test('isMakeupWorkday 只认调休上班日', () => {
  assert.equal(isMakeupWorkday('2026-09-20', PRICING.calendar), true)
  assert.equal(isMakeupWorkday('2026-10-10', PRICING.calendar), true)
  assert.equal(isMakeupWorkday('2026-10-11', PRICING.calendar), false)
})

test('dayKind 优先级：节日 > 调休 > 周末 > 工作日', () => {
  // 2026-10-01 是周四，且是国庆
  assert.equal(dayKind('2026-10-01', 4, PRICING.calendar), 'holiday')
  // 2026-10-10 是周六，且是调休上班
  assert.equal(dayKind('2026-10-10', 6, PRICING.calendar), 'makeup')
  // 2026-10-11 是周日，普通周末
  assert.equal(dayKind('2026-10-11', 0, PRICING.calendar), 'weekend')
  // 2026-10-12 是周一
  assert.equal(dayKind('2026-10-12', 1, PRICING.calendar), 'weekday')
})

/* ------------------------------------------------------------ 计费 */

test('工作日假期：全天按空闲价（这才是用户要的口径）', () => {
  // 2026-10-01 周四 10:00 —— 落在高峰时段定义内，但因为是国庆，必须按空闲价
  assert.equal(isPeakAt('2026-10-01', 4, 10, PRICING), false, '假期 10:00 应为空闲')
  assert.equal(isPeakAt('2026-10-01', 4, 15, PRICING), false, '假期 15:00 应为空闲')
  assert.equal(isPeakAt('2026-10-01', 4, 13, PRICING), false, '假期 13:00 本就是空闲')
})

test('调休上班的周末：按工作日分峰谷，不再全天空闲', () => {
  // 2026-09-20 周日（调休上班）、2026-10-10 周六（调休上班）
  assert.equal(isPeakAt('2026-09-20', 0, 10, PRICING), true, '调休日 10:00 应为高峰')
  assert.equal(isPeakAt('2026-09-20', 0, 15, PRICING), true, '调休日 15:00 应为高峰')
  assert.equal(isPeakAt('2026-09-20', 0, 13, PRICING), false, '调休日 13:00 仍是空闲时段')
  assert.equal(isPeakAt('2026-10-10', 6, 10, PRICING), true, '调休日 10:00 应为高峰')
})

test('普通周末仍然全天空闲（回归：别把周末规则改坏）', () => {
  assert.equal(isPeakAt('2026-09-19', 6, 10, PRICING), false, '普通周六 10:00 空闲')
  assert.equal(isPeakAt('2026-10-11', 0, 15, PRICING), false, '普通周日 15:00 空闲')
})

test('工作日非假期仍按高峰时段（回归）', () => {
  assert.equal(isPeakAt('2026-10-12', 1, 10, PRICING), true)
  assert.equal(isPeakAt('2026-10-12', 1, 13, PRICING), false)
})

test('国庆假期把两个工作日的费用降到空闲价', () => {
  const models = { 'deepseek-flash': { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } }
  // 10:00 高峰时段内：假期应为 3 × 0.5 = 1.5；若按工作日则是 3
  const holiday = costOfBucket({ date: '2026-10-01', weekday: 4, hour: 10, models }, PRICING)
  const plainWorkday = costOfBucket({ date: '2026-10-12', weekday: 1, hour: 10, models }, PRICING)
  assert.ok(Math.abs(holiday - 1.5) < 1e-12, `假期费用应为 1.5，实际 ${holiday}`)
  assert.ok(Math.abs(plainWorkday - 3) < 1e-12, `普通工作日同小时应为 3，实际 ${plainWorkday}`)
})

test('调休上班的周末费用按工作日峰谷，而不是周末空闲价', () => {
  const models = { 'deepseek-flash': { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } }
  // 2026-10-10 周六调休上班，10:00 → 高峰 3；普通周六 10:00 → 1.5
  const makeup = costOfBucket({ date: '2026-10-10', weekday: 6, hour: 10, models }, PRICING)
  const plainSaturday = costOfBucket({ date: '2026-10-17', weekday: 6, hour: 10, models }, PRICING)
  assert.ok(Math.abs(makeup - 3) < 1e-12, `调休日应为高峰价 3，实际 ${makeup}`)
  assert.ok(Math.abs(plainSaturday - 1.5) < 1e-12, `普通周六应为 1.5，实际 ${plainSaturday}`)
})

test('节假日折扣不受 weekendRelax 开关影响', () => {
  const noWeekendRelax = resolvePricing({ weekendRelax: false })
  // 关掉周末规则：普通周末要涨价，但法定假期仍应全天空闲
  assert.equal(isPeakAt('2026-09-19', 6, 10, noWeekendRelax), true, '普通周六应恢复分峰谷')
  assert.equal(isPeakAt('2026-10-01', 4, 10, noWeekendRelax), false, '国庆仍应全天空闲')
})

test('dayRelaxReason 说明当天为何全天空闲', () => {
  assert.deepEqual(dayRelaxReason('2026-10-01', 4, PRICING), { kind: 'holiday', allDayOffPeak: true })
  assert.deepEqual(dayRelaxReason('2026-10-10', 6, PRICING), { kind: 'makeup', allDayOffPeak: false })
  assert.deepEqual(dayRelaxReason('2026-09-19', 6, PRICING), { kind: 'weekend', allDayOffPeak: true })
  assert.deepEqual(dayRelaxReason('2026-10-12', 1, PRICING), { kind: 'weekday', allDayOffPeak: false })
})

/* -------------------------------------------------- 合并 / 覆盖 / 冲突 */

test('mergeHolidayCalendar 在内置数据之上追加用户条目', () => {
  const merged = mergeHolidayCalendar({
    holidays: [{ name: '自定义', from: '2027-01-01', to: '2027-01-03' }],
    makeupWorkdays: ['2027-01-04'],
  })
  assert.equal(merged.holidays.length, BUILTIN_HOLIDAY_CALENDAR.holidays.length + 1)
  assert.equal(isHoliday('2027-01-02', merged), true, '用户补充的假期应生效')
  assert.equal(isHoliday('2026-10-01', merged), true, '内置数据不能被覆盖掉')
  assert.equal(isMakeupWorkday('2027-01-04', merged), true)
})

test('mergeHolidayCalendar 丢弃形态非法或区间倒置的条目', () => {
  const merged = mergeHolidayCalendar({
    holidays: [
      { name: 'bad', from: '2027-1-1', to: '2027-01-03' },   // 非零填充
      { name: 'bad', from: '2027-13-01', to: '2027-13-05' }, // 月份越界
      { name: 'reversed', from: '2027-05-05', to: '2027-05-01' },
      { name: 'ok', from: '2027-06-01', to: '2027-06-03' },
    ],
    makeupWorkdays: ['nope', '2027-06-04'],
  })
  assert.equal(merged.holidays.length, BUILTIN_HOLIDAY_CALENDAR.holidays.length + 1, '只保留合法条目')
  assert.equal(isHoliday('2027-06-02', merged), true)
  // 区间倒置的条目即便被保留也不会匹配任何日期
  assert.equal(isHoliday('2027-05-03', merged), false)
  assert.deepEqual(merged.makeupWorkdays.filter((d) => d.startsWith('2027')), ['2027-06-04'])
})

test('resolvePricing 始终给出日历（默认即内置）', () => {
  assert.equal(resolvePricing().calendar.holidays.length, BUILTIN_HOLIDAY_CALENDAR.holidays.length)
  assert.equal(resolvePricing(null).calendar.holidays.length, BUILTIN_HOLIDAY_CALENDAR.holidays.length)
  assert.equal(resolvePricing({}).calendar.makeupWorkdays.length, BUILTIN_HOLIDAY_CALENDAR.makeupWorkdays.length)
})

test('holidayCalendarCoverage 报告覆盖年份与冲突', () => {
  const cov = holidayCalendarCoverage(PRICING.calendar)
  assert.deepEqual(cov.years, [2026])
  assert.equal(cov.lastDate, '2026-10-07')
  assert.deepEqual(cov.conflicts, [], '内置数据不应有假期/调休冲突')

  // 故意把某天同时标为假期与调休 → 应被报为冲突，且按节日计（优先级更高）
  const conflicting = mergeHolidayCalendar({
    holidays: [{ name: 'x', from: '2027-03-01', to: '2027-03-03' }],
    makeupWorkdays: ['2027-03-02'],
  })
  assert.deepEqual(holidayCalendarCoverage(conflicting).conflicts, ['2027-03-02'])
  assert.equal(isPeakAt('2027-03-02', 2, 10, resolvePricing({ calendar: conflicting })), false,
    '冲突时按节日（空闲）处理')
})

test('pricingCalendarCoverage 可从规则直接取覆盖情况', () => {
  assert.deepEqual(pricingCalendarCoverage(PRICING).years, [2026])
})
