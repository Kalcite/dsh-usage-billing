// End-to-end check against the real DSH session store, run on compiled lib/.
import { usageOverview, listSessionLogs, defaultHome } from '../lib/ledger.js'
import { resolvePricing } from '../lib/pricing.js'
import { decodeSessionLogWithStats } from '../lib/zstd.js'
import { parseSessionLog } from '../lib/parse.js'
import { pickSessionLog, parseSessionLogName } from '../lib/filenames.js'
import { readFileSync } from 'node:fs'

const fmt = (n) => n.toLocaleString('en-US')

// ---- 1. filename/version picker regression: v4 must be recognised ----
console.log('=== 1. session log filename picker ===')
const cases = [
  'session.jsonl',
  'session.v2.jsonl',
  'session.v4.jsonl',
  'session.jsonl.zstd',
  'session.v4.jsonl.zstd',
  'session.v10.jsonl.zstd',
  'session.migrating.tmp',
  'notes.txt',
]
for (const name of cases) {
  const parsed = parseSessionLogName(name)
  console.log(`  ${name.padEnd(26)} -> ${parsed === null ? 'ignored' : `gen=${parsed.generation} zstd=${parsed.compressed}`}`)
}
const mixed = ['session.jsonl.zstd', 'session.v4.jsonl', 'session.v4.jsonl.zstd', 'session.v2.jsonl.zstd']
console.log(`  pick from [${mixed.join(', ')}] -> ${pickSessionLog(mixed)?.name}`)
console.log(`  launcher's old regex would have picked: session.v2.jsonl.zstd (MISSES v4)`)

// ---- 2. real store ----
const home = defaultHome()
console.log('\n=== 2. real store ===')
console.log('DSH home      :', home)
const { locations, missing, dirs } = listSessionLogs(home)
console.log('session dirs  :', dirs, ' logs picked:', locations.length, ' missing:', missing)
const gens = new Map()
for (const l of locations) gens.set(l.generation, (gens.get(l.generation) ?? 0) + 1)
console.log('generations   :', [...gens].sort((a, b) => a[0] - b[0]).map(([g, n]) => `gen${g}=${n}`).join(' '))

const pricing = resolvePricing()
const t0 = Date.now()
const overview = await usageOverview({ home, pricing })
const t = overview.totals

console.log('\n=== 3. totals ===')
console.log('input        :', fmt(t.input))
console.log('output       :', fmt(t.output))
console.log('cacheRead    :', fmt(t.cacheRead))
console.log('cacheWrite   :', fmt(t.cacheWrite))
console.log('tokens       :', fmt(t.tokens))
console.log('cost         : Y' + t.cost.toFixed(4))
console.log('baselineCost : Y' + t.baselineCost.toFixed(4), '(all-peak)')
console.log('peak/offPeak : Y' + t.peakCost.toFixed(4) + ' / Y' + t.offPeakCost.toFixed(4))
console.log('savings      : Y' + (t.baselineCost - t.cost).toFixed(4))
console.log('peakShare    :', (t.peakShare * 100).toFixed(2) + '%')
console.log('sessions     :', t.sessions, ' activeDays:', t.activeDays)
console.log('dupSamples   :', t.duplicateSamples, '(dropped by (turn,step) dedupe)')
console.log('scan         :', JSON.stringify(overview.scan))
console.log('wall clock   :', Date.now() - t0, 'ms')

console.log('\n=== 4. by model ===')
for (const m of overview.byModel) {
  console.log(`  ${m.model.padEnd(30)} tok=${fmt(m.input + m.output + m.cacheRead + m.cacheWrite).padStart(15)} cost=Y${m.cost.toFixed(4).padStart(11)} share=${(m.share * 100).toFixed(1).padStart(5)}% sessions=${m.sessions} explicitlyPriced=${m.priced}`)
}

console.log('\n=== 5. by session (top 8 by tokens) ===')
const topSessions = [...overview.bySession].sort((a, b) => (b.input + b.output + b.cacheRead + b.cacheWrite) - (a.input + a.output + a.cacheRead + a.cacheWrite)).slice(0, 8)
for (const s of topSessions) {
  console.log(`  ${s.projectLabel.slice(0, 34).padEnd(36)} ${s.id.slice(0, 10)} gen=${s.generation} ev=${String(s.events).padStart(4)} dup=${String(s.duplicateSamples).padStart(4)} tok=${fmt(s.input + s.output + s.cacheRead + s.cacheWrite).padStart(15)} cost=Y${s.cost.toFixed(4)}`)
}

console.log('\n=== 6. by day (last 5) ===')
for (const d of overview.byDay.slice(-5)) {
  console.log(`  ${d.date}  in=${fmt(d.input).padStart(12)} out=${fmt(d.output).padStart(10)} cost=Y${d.cost.toFixed(4).padStart(10)} peak=Y${d.peakCost.toFixed(4)} off=Y${d.offPeakCost.toFixed(4)}`)
}

console.log('\n=== 7. peak/off-peak rule sanity (Beijing peak 9-12,14-18, weekend flat from 2026-08-23) ===')
const { isPeakAt, inPeakSlot } = await import('../lib/pricing.js')
for (const [date, wd, hour, label] of [
  ['2026-01-05', 1, 10, 'Mon 10:00 -> peak'],
  ['2026-01-05', 1, 13, 'Mon 13:00 -> off-peak'],
  ['2026-01-05', 1, 15, 'Mon 15:00 -> peak'],
  ['2026-01-10', 6, 10, 'Sat(before relax) 10:00 -> peak'],
  ['2026-09-05', 6, 10, 'Sat(after relax) 10:00 -> off-peak'],
  ['2026-09-06', 0, 15, 'Sun(after relax) 15:00 -> off-peak'],
  ['2026-09-07', 1, 15, 'Mon(after relax) 15:00 -> peak'],
]) {
  console.log(`  ${label.padEnd(44)} => ${isPeakAt(date, wd, hour, pricing) ? 'PEAK' : 'off-peak'}`)
}

console.log('\n=== 8. dedupe correctness on generation-0 logs ===')
let checked = 0
for (const l of locations.filter((x) => x.generation === 0).slice(0, 5)) {
  const { text } = await decodeSessionLogWithStats(readFileSync(l.logPath))
  const parsed = parseSessionLog(text, l.generation)
  const deduped = parsed.samples.reduce((s, x) => s + x.input, 0)
  let naive = 0
  for (const line of text.split('\n')) {
    if (!line.includes('"usage"')) continue
    try {
      const j = JSON.parse(line)
      const u = j?.data?.usage ?? j?.data?.chunk?.usage
      if (u) naive += u.inputTokens ?? 0
    } catch {}
  }
  const ratio = deduped > 0 ? (naive / deduped).toFixed(3) : 'n/a'
  const verdict = Math.abs(naive / deduped - 2) < 0.001 ? 'OK (launcher double-counts 2x, we do not)' : 'UNEXPECTED'
  console.log(`  ${l.sessionId.slice(0, 12)} naive=${fmt(naive).padStart(12)} deduped=${fmt(deduped).padStart(12)} ratio=${ratio} dropped=${parsed.duplicateSamples} ${verdict}`)
  checked++
}
console.log(`  checked ${checked} generation-0 log(s)`)

console.log('\n=== 9. per-sample model attribution ===')
for (const l of locations.filter((x) => x.generation === 4).slice(0, 2)) {
  const { text } = await decodeSessionLogWithStats(readFileSync(l.logPath))
  const parsed = parseSessionLog(text, l.generation)
  const bySource = new Map()
  for (const s of parsed.samples) {
    const key = `${s.model} via ${s.modelSource}`
    bySource.set(key, (bySource.get(key) ?? 0) + 1)
  }
  console.log(`  ${l.sessionId.slice(0, 12)} gen=${l.generation} samples=${parsed.samples.length}`)
  for (const [k, n] of bySource) console.log(`      ${k} x${n}`)
}
