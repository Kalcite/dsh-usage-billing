/**
 * 会话日志扫描与用量聚合。
 *
 * 读取 `$DSH_HOME/sessions/<projectKey>/<sessionId>/` 下的会话日志，聚合成
 * 「日期 × 小时 × 模型」的计费桶以及按模型 / 日 / 小时 / 会话的视图。
 *
 * 计费桶（`byDayHour`）是唯一携带 `date` / `weekday` / `hour` 的粒度，因此也是
 * 唯一能正确应用「按时段与周末浮动」的粒度：界面把规则改动后的重算压在这一层，
 * 就可以做到改单价即时生效，而不必重新读盘。
 *
 * @module dsh-usage-billing/src/ledger
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decodeSessionLogWithStats } from './zstd.js';
import { pickSessionLog, projectDisplayName } from './filenames.js';
import { parseSessionLog } from './parse.js';
import { costOfBucket, emptyBuckets, isPeakAt, localParts, modelLabel, priceOf, resolvePricing, totalTokens, } from './pricing.js';
function newAccumulator() {
    return { ...emptyBuckets(), cost: 0 };
}
function addTokens(target, tokens) {
    target.input += tokens.input;
    target.output += tokens.output;
    target.cacheRead += tokens.cacheRead;
    target.cacheWrite += tokens.cacheWrite;
}
/**
 * 默认的 DSH 数据目录。
 * @returns `$DSH_HOME`，未设置时回落到 `~/.dsh`。
 */
export function defaultHome() {
    const fromEnv = process.env.DSH_HOME;
    if (typeof fromEnv === 'string' && fromEnv.trim() !== '')
        return fromEnv;
    return path.join(os.homedir(), '.dsh');
}
/**
 * 枚举 `sessions` 下的全部会话日志。
 * @param home - DSH 数据目录。
 * @returns 每个会话目录选中的那份日志。
 */
export function listSessionLogs(home) {
    const root = path.join(home, 'sessions');
    const locations = [];
    let missing = 0;
    let dirs = 0;
    if (!existsSync(root))
        return { locations, missing, dirs };
    for (const projectKey of readdirSync(root)) {
        const projectDir = path.join(root, projectKey);
        let projectIsDir = false;
        try {
            projectIsDir = statSync(projectDir).isDirectory();
        }
        catch {
            continue;
        }
        if (!projectIsDir)
            continue;
        for (const sessionId of readdirSync(projectDir)) {
            const sessionDir = path.join(projectDir, sessionId);
            let sessionIsDir = false;
            try {
                sessionIsDir = statSync(sessionDir).isDirectory();
            }
            catch {
                continue;
            }
            if (!sessionIsDir)
                continue;
            dirs += 1;
            let names;
            try {
                names = readdirSync(sessionDir);
            }
            catch {
                missing += 1;
                continue;
            }
            const picked = pickSessionLog(names);
            if (picked === null) {
                missing += 1;
                continue;
            }
            const logPath = path.join(sessionDir, picked.name);
            let bytes = 0;
            try {
                bytes = statSync(logPath).size;
            }
            catch {
                continue;
            }
            locations.push({
                projectKey,
                sessionId,
                dir: sessionDir,
                logPath,
                generation: picked.generation,
                bytes,
            });
        }
    }
    return { locations, missing, dirs };
}
/**
 * 读取并解压一份会话日志。
 * @param location - 会话定位结果。
 * @returns 文本与 zstd 帧数；读取或解压失败时返回 `null`。
 */
async function readSessionLog(location) {
    try {
        const buffer = readFileSync(location.logPath);
        const decoded = await decodeSessionLogWithStats(buffer);
        return { text: decoded.text, frames: decoded.stats.frames };
    }
    catch {
        return null;
    }
}
/**
 * 扫描并聚合全部会话用量。
 *
 * @param options - `home` 覆盖数据目录；`pricing` 覆盖计费规则。
 * @returns 完整总览。
 */
export async function usageOverview(options) {
    const startedAt = Date.now();
    const home = options?.home ?? defaultHome();
    const pricing = resolvePricing(options?.pricing);
    const { locations, missing, dirs } = listSessionLogs(home);
    // 全局聚合器
    const byModel = new Map();
    const byModelSessions = new Map();
    const byDay = new Map();
    const byHour = Array.from({ length: 24 }, newAccumulator);
    const byDayHour = new Map();
    const bySession = [];
    const totals = {
        ...newAccumulator(),
        baselineCost: 0,
        peakCost: 0,
        offPeakCost: 0,
        peakTokens: 0,
        offPeakTokens: 0,
    };
    let logsRead = 0;
    let logsFailed = 0;
    let totalBytes = 0;
    let totalDuplicateSamples = 0;
    const generations = {};
    for (const location of locations) {
        const read = await readSessionLog(location);
        if (read === null) {
            logsFailed += 1;
            continue;
        }
        const { text, frames } = read;
        logsRead += 1;
        totalBytes += location.bytes;
        generations[String(location.generation)] = (generations[String(location.generation)] ?? 0) + 1;
        const parsed = parseSessionLog(text, location.generation);
        totalDuplicateSamples += parsed.duplicateSamples;
        const sessionAcc = newAccumulator();
        const sessionModels = new Set();
        const sessionDayHour = new Map();
        let firstTs = null;
        let lastTs = null;
        for (const sample of parsed.samples) {
            const model = sample.model;
            sessionModels.add(model);
            addTokens(sessionAcc, sample);
            addTokens(totals, sample);
            // 按模型
            let modelAcc = byModel.get(model);
            if (modelAcc === undefined) {
                modelAcc = newAccumulator();
                byModel.set(model, modelAcc);
                byModelSessions.set(model, new Set());
            }
            addTokens(modelAcc, sample);
            byModelSessions.get(model)?.add(location.sessionId);
            if (sample.ts === null)
                continue;
            if (firstTs === null || sample.ts < firstTs)
                firstTs = sample.ts;
            if (lastTs === null || sample.ts > lastTs)
                lastTs = sample.ts;
            const parts = localParts(sample.ts, pricing.timezone);
            // 按日
            let day = byDay.get(parts.date);
            if (day === undefined) {
                day = { acc: newAccumulator(), peakCost: 0, offPeakCost: 0 };
                byDay.set(parts.date, day);
            }
            addTokens(day.acc, sample);
            // 按小时
            addTokens(byHour[parts.hour], sample);
            // 日期 × 小时 × 模型
            const bucketKey = `${parts.date}|${parts.hour}`;
            let bucket = byDayHour.get(bucketKey);
            if (bucket === undefined) {
                bucket = {
                    date: parts.date,
                    weekday: parts.weekday,
                    hour: parts.hour,
                    ...emptyBuckets(),
                    models: {},
                    cost: 0,
                };
                byDayHour.set(bucketKey, bucket);
            }
            addTokens(bucket, sample);
            const modelBucket = bucket.models[model] ?? emptyBuckets();
            modelBucket.input += sample.input;
            modelBucket.output += sample.output;
            modelBucket.cacheRead += sample.cacheRead;
            modelBucket.cacheWrite += sample.cacheWrite;
            bucket.models[model] = modelBucket;
            // 会话自己的桶
            let sessionBucket = sessionDayHour.get(bucketKey);
            if (sessionBucket === undefined) {
                sessionBucket = {
                    date: parts.date,
                    weekday: parts.weekday,
                    hour: parts.hour,
                    ...emptyBuckets(),
                    models: {},
                    cost: 0,
                };
                sessionDayHour.set(bucketKey, sessionBucket);
            }
            addTokens(sessionBucket, sample);
            const sessionModelBucket = sessionBucket.models[model] ?? emptyBuckets();
            sessionModelBucket.input += sample.input;
            sessionModelBucket.output += sample.output;
            sessionModelBucket.cacheRead += sample.cacheRead;
            sessionModelBucket.cacheWrite += sample.cacheWrite;
            sessionBucket.models[model] = sessionModelBucket;
        }
        const sessionBuckets = [...sessionDayHour.values()].sort(compareDayHour);
        let sessionCost = 0;
        for (const bucket of sessionBuckets) {
            bucket.cost = costOfBucket(bucket, pricing);
            sessionCost += bucket.cost;
        }
        const sessionTotal = totalTokens(sessionAcc);
        if (sessionTotal > 0) {
            bySession.push({
                id: location.sessionId,
                project: location.projectKey,
                projectLabel: projectDisplayName(location.projectKey),
                cwd: parsed.cwd,
                models: [...sessionModels].sort(),
                modelLabels: [...sessionModels].sort().map(modelLabel),
                input: sessionAcc.input,
                output: sessionAcc.output,
                cacheRead: sessionAcc.cacheRead,
                cacheWrite: sessionAcc.cacheWrite,
                cost: sessionCost,
                events: parsed.samples.length,
                firstTs,
                lastTs,
                generation: parsed.generation,
                bytes: location.bytes,
                frames,
                dayHour: sessionBuckets,
                duplicateSamples: parsed.duplicateSamples,
            });
        }
    }
    // 计费桶排序后统一算费用，并把费用摊回模型 / 日 / 小时维度。
    const dayHourList = [...byDayHour.values()].sort(compareDayHour);
    for (const bucket of dayHourList) {
        bucket.cost = costOfBucket(bucket, pricing);
        const peak = isPeakAt(bucket.date, bucket.weekday, bucket.hour, pricing);
        const bucketTokens = totalTokens(bucket);
        if (peak) {
            totals.peakCost += bucket.cost;
            totals.peakTokens += bucketTokens;
        }
        else {
            totals.offPeakCost += bucket.cost;
            totals.offPeakTokens += bucketTokens;
        }
        let bucketBaseline = 0;
        for (const [model, tokens] of Object.entries(bucket.models)) {
            const price = priceOf(model, pricing);
            const raw = (tokens.input * price.inputPerM
                + tokens.output * price.outputPerM
                + tokens.cacheRead * price.cacheReadPerM
                + tokens.cacheWrite * price.cacheWritePerM) / 1e6;
            bucketBaseline += raw;
            const modelAcc = byModel.get(model);
            if (modelAcc !== undefined)
                modelAcc.cost += raw * (peak ? 1 : pricing.offPeakMultiplier);
        }
        totals.baselineCost += bucketBaseline;
        const day = byDay.get(bucket.date);
        if (day !== undefined) {
            day.acc.cost += bucket.cost;
            if (peak)
                day.peakCost += bucket.cost;
            else
                day.offPeakCost += bucket.cost;
        }
        const hourRow = byHour[bucket.hour];
        hourRow.cost += bucket.cost;
    }
    totals.cost = dayHourList.reduce((sum, bucket) => sum + bucket.cost, 0);
    // ---- 组装输出 ----
    const grandTokens = totalTokens(totals);
    const modelRows = [...byModel.entries()]
        .map(([model, acc]) => {
        const tokens = totalTokens(acc);
        return {
            model,
            label: modelLabel(model),
            input: acc.input,
            output: acc.output,
            cacheRead: acc.cacheRead,
            cacheWrite: acc.cacheWrite,
            cost: acc.cost,
            share: grandTokens > 0 ? tokens / grandTokens : 0,
            sessions: byModelSessions.get(model)?.size ?? 0,
            priced: Object.prototype.hasOwnProperty.call(pricing.models, model) && model !== '_default',
        };
    })
        .sort((left, right) => right.input + right.output - (left.input + left.output));
    const dayRows = [...byDay.entries()]
        .map(([date, entry]) => ({
        date,
        input: entry.acc.input,
        output: entry.acc.output,
        cacheRead: entry.acc.cacheRead,
        cacheWrite: entry.acc.cacheWrite,
        cost: entry.acc.cost,
        peakCost: entry.peakCost,
        offPeakCost: entry.offPeakCost,
    }))
        .sort((left, right) => (left.date < right.date ? -1 : left.date > right.date ? 1 : 0));
    const hourRows = byHour.map((acc, hour) => ({
        hour,
        input: acc.input,
        output: acc.output,
        cacheRead: acc.cacheRead,
        cacheWrite: acc.cacheWrite,
        cost: acc.cost,
        peakSlot: pricing.peakSlots.some((slot) => hour >= slot.start && hour < slot.end),
    }));
    bySession.sort((left, right) => (right.lastTs ?? 0) - (left.lastTs ?? 0));
    const peakTokenTotal = totals.peakTokens + totals.offPeakTokens;
    return {
        home,
        pricing,
        generatedAt: Date.now(),
        knownModels: modelRows.map((row) => row.model),
        totals: {
            input: totals.input,
            output: totals.output,
            cacheRead: totals.cacheRead,
            cacheWrite: totals.cacheWrite,
            tokens: grandTokens,
            cost: totals.cost,
            baselineCost: totals.baselineCost,
            peakCost: totals.peakCost,
            offPeakCost: totals.offPeakCost,
            peakShare: peakTokenTotal > 0 ? totals.peakTokens / peakTokenTotal : 0,
            sessions: bySession.length,
            activeDays: dayRows.length,
            duplicateSamples: totalDuplicateSamples,
        },
        byModel: modelRows,
        byDay: dayRows,
        byHour: hourRows,
        byDayHour: dayHourList,
        bySession,
        scan: {
            sessionDirs: dirs,
            logsRead,
            logsFailed,
            logsMissing: missing,
            bytes: totalBytes,
            elapsedMs: Date.now() - startedAt,
            generations,
        },
    };
}
function compareDayHour(left, right) {
    if (left.date !== right.date)
        return left.date < right.date ? -1 : 1;
    return left.hour - right.hour;
}
