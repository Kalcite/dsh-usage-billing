// Verify the client panel's in-browser recompute agrees with the host's numbers,
// and that the panel's pure functions behave on the real overview payload.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import assert from 'node:assert/strict'

import { usageOverview, defaultHome } from '../lib/ledger.js'
import { resolvePricing } from '../lib/pricing.js'

// ---- build the same overview the host route would return ----
const home = defaultHome()
const pricing = resolvePricing()
const overview = await usageOverview({ home, pricing })

// ---- load lib/client.js through a simulated module table, then reach into panel ----
const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const reactStub = {
  createElement: () => ({}),
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
}
const moduleTable = { react: reactStub, 'react/jsx-runtime': {} }

let registered = null
const sandbox = {
  window: { __ModuleLoader__: { load: (r) => { registered = r } } },
  console,
  document: { head: { appendChild: () => {} }, createElement: () => ({ dataset: {} }), querySelector: () => null },
}
sandbox.globalThis = sandbox
vm.createContext(sandbox)
vm.runInContext(source, sandbox, { filename: 'lib/client.js' })

const exportsObj = registered.factory((spec) => {
  if (Object.prototype.hasOwnProperty.call(moduleTable, spec)) return moduleTable[spec]
  throw new Error(`module table cannot answer ${spec}`)
})
assert.equal(typeof exportsObj.apply, 'function')

// Reach the panel internals: they are exported from the panel module, which the
// entry module does not re-export, so re-register to capture the registration
// and instead re-evaluate the bundle with panelInternals wired through.
// Simpler: the entry exports only the plugin face, so evaluate the panel module
// directly from source for logic checks.
const panelSource = readFileSync(new URL('../src/client/panel.cjs.js', import.meta.url), 'utf8')
const panelSandbox = { require: (spec) => { if (spec === 'react') return reactStub; throw new Error(spec) }, exports: {}, console }
panelSandbox.globalThis = panelSandbox
vm.createContext(panelSandbox)
vm.runInContext(panelSource.replace(/^'use strict'$/m, ''), panelSandbox, { filename: 'panel.cjs.js' })
const panel = panelSandbox.exports.panelInternals
assert.ok(panel, 'panelInternals must be exported for self-test')

console.log('=== client recompute vs host totals ===')
const billing = panel.recompute(overview, overview.pricing)

const rows = [
  ['total cost', billing.total, overview.totals.cost],
  ['peak cost', billing.peakCost, overview.totals.peakCost],
  ['offPeak cost', billing.offPeakCost, overview.totals.offPeakCost],
  ['baseline cost', billing.baseline, overview.totals.baselineCost],
]
let allMatch = true
for (const [label, clientValue, hostValue] of rows) {
  const delta = Math.abs(clientValue - hostValue)
  const rel = hostValue === 0 ? delta : delta / hostValue
  const ok = rel < 1e-9
  if (!ok) allMatch = false
  console.log(`  ${label.padEnd(14)} client=${clientValue.toFixed(8).padStart(14)} host=${hostValue.toFixed(8).padStart(14)} relDelta=${rel.toExponential(2)} ${ok ? 'OK' : 'MISMATCH'}`)
}
console.log(`  peakShare      client=${(billing.peakShare * 100).toFixed(6)}% host=${(overview.totals.peakShare * 100).toFixed(6)}%`)
assert.ok(allMatch, 'client recompute must match the host numbers exactly')

console.log('\n=== per-model cost agreement ===')
for (const m of overview.byModel) {
  const clientCost = billing.modelCost.get(m.model)
  const delta = Math.abs(clientCost - m.cost)
  const rel = m.cost === 0 ? delta : delta / m.cost
  console.log(`  ${m.model.padEnd(28)} client=Y${clientCost.toFixed(6)} host=Y${m.cost.toFixed(6)} relDelta=${rel.toExponential(2)} ${rel < 1e-9 ? 'OK' : 'MISMATCH'}`)
  assert.ok(rel < 1e-9, `model cost mismatch for ${m.model}`)
}

console.log('\n=== per-day cost agreement ===')
let worstDay = 0
for (const d of overview.byDay) {
  const clientCost = billing.dayCost.get(d.date)
  const delta = Math.abs(clientCost - d.cost)
  worstDay = Math.max(worstDay, d.cost === 0 ? delta : delta / d.cost)
}
console.log(`  worst relative delta across ${overview.byDay.length} day(s): ${worstDay.toExponential(2)}`)
assert.ok(worstDay < 1e-9, 'per-day costs must agree')

console.log('\n=== per-session cost agreement ===')
let worstSession = 0
for (const s of overview.bySession) {
  const clientCost = panel.sessionCost(s, overview.pricing)
  const delta = Math.abs(clientCost - s.cost)
  worstSession = Math.max(worstSession, s.cost === 0 ? delta : delta / s.cost)
}
console.log(`  worst relative delta across ${overview.bySession.length} session(s): ${worstSession.toExponential(2)}`)
assert.ok(worstSession < 1e-9, 'per-session costs must agree')

console.log('\n=== formatting helpers ===')
const fmtRows = [
  ['fmtTokens(0)', panel.fmtTokens(0)],
  ['fmtTokens(999)', panel.fmtTokens(999)],
  ['fmtTokens(1500)', panel.fmtTokens(1500)],
  ['fmtTokens(2_500_000)', panel.fmtTokens(2500000)],
  ['fmtTokens(1_360_125_312)', panel.fmtTokens(1360125312)],
  ['fmtCost(0.0001)', panel.fmtCost(0.0001, 'CNY')],
  ['fmtCost(101.6446)', panel.fmtCost(101.6446, 'CNY')],
  ['fmtCost(1.5,USD)', panel.fmtCost(1.5, 'USD')],
  ['fmtPct(0.1073)', panel.fmtPct(0.1073)],
  ['fmtBytes(47614677)', panel.fmtBytes(47614677)],
  ['fmtTime(null)', panel.fmtTime(null)],
  ['fmtDuration(3_720_000)', panel.fmtDuration(3720000)],
]
for (const [label, value] of fmtRows) console.log(`  ${label.padEnd(24)} -> ${value}`)

console.log('\n=== peak/off-peak parity (client vs sampled truth) ===')
const peaks = [
  ['2026-01-05', 1, 10, true], ['2026-01-05', 1, 13, false], ['2026-01-05', 1, 15, true],
  ['2026-01-10', 6, 10, true], ['2026-09-05', 6, 10, false], ['2026-09-06', 0, 15, false],
  ['2026-09-07', 1, 15, true],
]
for (const [date, wd, hour, expected] of peaks) {
  const actual = panel.isPeakAt(date, wd, hour, overview.pricing)
  const ok = actual === expected
  console.log(`  ${date} wd=${wd} ${String(hour).padStart(2, '0')}:00 -> ${actual ? 'PEAK' : 'off-peak'} ${ok ? 'OK' : 'MISMATCH'}`)
  assert.equal(actual, expected)
}

console.log('\n=== empty / degenerate payloads must not throw ===')
const empties = [
  { label: 'no buckets', value: { pricing: overview.pricing, byDayHour: [], byDay: [], bySession: [], byModel: [], byHour: [], totals: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, sessions: 0, activeDays: 0, duplicateSamples: 0 } } },
  { label: 'bucket with no models', value: { pricing: overview.pricing, byDayHour: [{ date: '2026-01-05', weekday: 1, hour: 10, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, models: {}, cost: 0 }], byDay: [], bySession: [], byModel: [], byHour: [], totals: {} } },
  { label: 'pricing without models', value: { pricing: { offPeakMultiplier: 0.5, peakSlots: [], models: {} }, byDayHour: [{ date: '2026-01-05', weekday: 1, hour: 10, input: 100, output: 10, cacheRead: 0, cacheWrite: 0, models: { x: { input: 100, output: 10, cacheRead: 0, cacheWrite: 0 } }, cost: 0 }], byDay: [], bySession: [], byModel: [], byHour: [], totals: {} } },
]
for (const { label, value } of empties) {
  const result = panel.recompute(value, value.pricing)
  console.log(`  ${label.padEnd(26)} -> total=${result.total} peakShare=${result.peakShare}`)
  assert.ok(Number.isFinite(result.total), `${label}: total must be finite`)
  assert.ok(Number.isFinite(result.peakShare), `${label}: peakShare must be finite`)
}

console.log('\nALL CLIENT PANEL LOGIC CHECKS PASSED')
