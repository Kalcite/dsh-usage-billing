/**
 * 中国法定节假日 / 调休上班日历。
 *
 * 计费规则要求两类日期被特殊对待：
 *
 *   - **法定节假日**：全天按空闲价（与周末同待遇，且不受 `weekendRelax` 开
 *     关影响——春节、国庆这类假期的折扣语义与「周末打折」无关）。
 *   - **调休上班日**：本是周六/周日但要上班，因此**按工作日**区分峰谷，
 *     不再享受「周末全天空闲」。
 *
 * ## 数据来源
 *
 * 2026 年取自国务院办公厅通知：
 * 「国务院办公厅关于2026年部分节假日安排的通知」国办发明电〔2025〕7号，
 * https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm
 *
 * 逐条转录（原文为准）：
 *   元旦   1月1日（周四）至3日（周六）放假，共3天；1月4日（周日）上班。
 *   春节   2月15日（周日）至23日（周一）放假，共9天；2月14日（周六）、2月28日（周六）上班。
 *   清明   4月4日（周六）至6日（周一）放假，共3天。
 *   劳动节 5月1日（周五）至5日（周二）放假，共5天；5月9日（周六）上班。
 *   端午   6月19日（周五）至21日（周日）放假，共3天。
 *   中秋   9月25日（周五）至27日（周日）放假，共3天。
 *   国庆   10月1日（周四）至7日（周三）放假，共7天；9月20日（周日）、10月10日（周六）上班。
 *
 * ## 后续年份的维护
 *
 * 国务院每年 11 月左右公布次年的安排，**内置数据因此有个明确的截止点**。之后
 * 的年份需要用户补充：在配置里加 `holidays` / `makeupWorkdays`（见 README），
 * 或直接改本文件的 `BUILTIN_HOLIDAY_CALENDAR`。两者都会生效，配置里的条目优先。
 *
 * 若不补充，未覆盖的年份会**静默退回「只看周六周日」**的老行为——这正是需要
 * 明确告知用户的行为，因此 `holidayCalendarCoverage()` 会报告覆盖区间，界面与
 * `/usage-billing/health` 都会显示它。
 *
 * @module dsh-usage-billing/src/holidays
 */
/** `YYYY-MM-DD` 形态校验。 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/**
 * 内置日历（2026 年，官方通知逐条转录）。
 *
 * 注意 2026 年**没有**需要特殊处理的调休上班日恰好落在工作日的情况：
 * 1/4、2/14、2/28、5/9、9/20、10/10 全部是周六或周日，因此都必须覆盖。
 */
export const BUILTIN_HOLIDAY_CALENDAR = {
    holidays: [
        { name: '元旦', from: '2026-01-01', to: '2026-01-03' },
        { name: '春节', from: '2026-02-15', to: '2026-02-23' },
        { name: '清明节', from: '2026-04-04', to: '2026-04-06' },
        { name: '劳动节', from: '2026-05-01', to: '2026-05-05' },
        { name: '端午节', from: '2026-06-19', to: '2026-06-21' },
        { name: '中秋节', from: '2026-09-25', to: '2026-09-27' },
        { name: '国庆节', from: '2026-10-01', to: '2026-10-07' },
    ],
    makeupWorkdays: [
        '2026-01-04',
        '2026-02-14',
        '2026-02-28',
        '2026-05-09',
        '2026-09-20',
        '2026-10-10',
    ],
};
/** 把 `YYYY-MM-DD` 解析成可比较的序数（同宽字符串本身也可比，这里用于兜底校验）。 */
function parseDate(date) {
    if (!DATE_PATTERN.test(date))
        return null;
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    const day = Number(date.slice(8, 10));
    if (month < 1 || month > 12 || day < 1 || day > 31)
        return null;
    return Date.UTC(year, month - 1, day);
}
/** 合并内置日历与用户覆盖（用户条目追加，不改内置）。 */
export function mergeHolidayCalendar(overrides) {
    const extraHolidays = (overrides?.holidays ?? []).filter((r) => r !== null && typeof r === 'object'
        && typeof r.from === 'string' && typeof r.to === 'string'
        && parseDate(r.from) !== null && parseDate(r.to) !== null
        // 区间倒置的条目直接丢弃：它匹配不到任何日期，留着只会让覆盖统计产生幻觉。
        && r.to >= r.from);
    const extraMakeup = (overrides?.makeupWorkdays ?? []).filter((d) => typeof d === 'string' && parseDate(d) !== null);
    return {
        holidays: [...BUILTIN_HOLIDAY_CALENDAR.holidays, ...extraHolidays],
        makeupWorkdays: [...new Set([...BUILTIN_HOLIDAY_CALENDAR.makeupWorkdays, ...extraMakeup])],
    };
}
/**
 * 该日期是否为法定节假日（含调休连休期间的全部日期）。
 * @param date - `YYYY-MM-DD`。
 * @param calendar - 已合并的日历。
 * @returns 落在任一假期区间内为 true。
 */
export function isHoliday(date, calendar) {
    for (const range of calendar.holidays) {
        // 同宽 `YYYY-MM-DD` 可直接按字典序比较。
        if (date >= range.from && date <= range.to)
            return true;
    }
    return false;
}
/**
 * 该日期是否为调休上班日。
 * @param date - `YYYY-MM-DD`。
 * @param calendar - 已合并的日历。
 * @returns 是调休上班日为 true。
 */
export function isMakeupWorkday(date, calendar) {
    return calendar.makeupWorkdays.includes(date);
}
/**
 * 该日期当天的计费性质。
 *
 * 优先级：**节日 > 调休 > 周末**。把同一天同时写进两个列表时以节日为准
 * （`conflicts` 中会报出来，便于用户发现笔误）。
 *
 * @param date - `YYYY-MM-DD`。
 * @param weekday - 0 = 周日。
 * @param calendar - 已合并的日历。
 * @returns 当天的性质。
 */
export function dayKind(date, weekday, calendar) {
    if (isHoliday(date, calendar))
        return 'holiday';
    if (isMakeupWorkday(date, calendar))
        return 'makeup';
    if (weekday === 0 || weekday === 6)
        return 'weekend';
    return 'weekday';
}
/**
 * 汇总覆盖区间与冲突项。
 * @param calendar - 已合并的日历。
 * @returns 覆盖情况。
 */
export function holidayCalendarCoverage(calendar) {
    const years = new Set();
    let lastDate = null;
    for (const range of calendar.holidays) {
        years.add(Number(range.from.slice(0, 4)));
        years.add(Number(range.to.slice(0, 4)));
        if (lastDate === null || range.to > lastDate)
            lastDate = range.to;
    }
    const conflicts = calendar.makeupWorkdays.filter((d) => isHoliday(d, calendar));
    return {
        years: [...years].sort((a, b) => a - b),
        lastDate,
        conflicts,
    };
}
