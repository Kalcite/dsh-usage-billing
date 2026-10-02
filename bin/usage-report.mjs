#!/usr/bin/env node
/**
 * dsh-usage-billing 命令行用量报告。
 *
 * 用途：当 DSH 客户端插件系统不可用（设置页里看不到「用量计费」）时，直接读取
 * 主机半边已经算好的聚合结果并打印成文本报表——数据与看板完全同源。
 *
 * 用法：
 *   node bin/usage-report.mjs                    # 连默认端口 19387
 *   node bin/usage-report.mjs --port 3080        # 指定端口（dsh web 默认 3080）
 *   node bin/usage-report.mjs --json             # 输出原始 JSON
 *   node bin/usage-report.mjs --days 30          # 明细天数（默认 30）
 *
 * @module dsh-usage-billing/bin/usage-report
 */

const args = process.argv.slice(2)

/** 读取 `--flag value` 形式的参数。 */
function argOf(name, fallback) {
  const index = args.indexOf('--' + name)
  if (index === -1) return fallback
  const value = args[index + 1]
  return value === undefined || value.startsWith('--') ? fallback : value
}

const port = Number(argOf('port', '19387'))
const days = Number(argOf('days', '30'))
const asJson = args.includes('--json')
const home = argOf('home', '')

const base = `http://127.0.0.1:${port}`

/** 大数字缩写。 */
function fmtTokens(n) {
  if (!Number.isFinite(n) || n === 0) return '0'
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(n)
}

/** 千分位整数。 */
function fmtExact(n) {
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '0'
}

/** 金额（DeepSeek 模型为人民币）。 */
function fmtCost(n) {
  return '\u00a5' + Number(n).toFixed(2)
}

/** 字节缩写。 */
function fmtBytes(n) {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB'
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB'
  return n + ' B'
}

/** 在终端里对齐的一行。 */
function row(cells, widths) {
  return cells.map((cell, i) => String(cell).padEnd(widths[i])).join('  ')
}

/** 取一个字符串的显示宽度（CJK 记 2）。 */
function width(text) {
  let total = 0
  for (const ch of String(text)) total += /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/.test(ch) ? 2 : 1
  return total
}

/** 按显示宽度补空格。 */
function pad(text, target) {
  const s = String(text)
  return s + ' '.repeat(Math.max(0, target - width(s)))
}

async function main() {
  const query = home === '' ? '' : `?home=${encodeURIComponent(home)}`
  const url = `${base}/usage-billing/summary${query}`

  let response
  try {
    response = await fetch(url)
  } catch (error) {
    console.error(`无法连接 ${url}`)
    console.error('请确认 DSH 正在运行，且 dsh-usage-billing 已装载到当前 profile。')
    console.error(String(error?.message ?? error))
    process.exitCode = 1
    return
  }

  const body = await response.json().catch(() => null)
  if (!response.ok || body?.ok !== true) {
    console.error(`请求失败：HTTP ${response.status}${body?.error ? ' — ' + body.error : ''}`)
    process.exitCode = 1
    return
  }

  const o = body.overview
  if (asJson) {
    console.log(JSON.stringify(o, null, 2))
    return
  }

  const t = o.totals
  const p = o.pricing
  const line = '─'.repeat(66)

  console.log(line)
  console.log('DSH 用量与计费报告')
  console.log(line)
  console.log(`数据目录   ${o.home}`)
  console.log(`会话日志   ${o.scan.logsRead} 个（读取失败 ${o.scan.logsFailed}、缺日志 ${o.scan.logsMissing}）`)
  console.log(`格式分布   ${Object.keys(o.scan.generations).sort().map((g) => `gen${g}×${o.scan.generations[g]}`).join('  ')}`)
  console.log(`压缩体积   ${fmtBytes(o.scan.bytes)}   扫描耗时 ${o.scan.elapsedMs} ms`)
  console.log(`生成时间   ${new Date(o.generatedAt).toLocaleString()}`)

  console.log(`\n${line}\n总览\n${line}`)
  console.log(`总费用（峰谷实时）   ${fmtCost(t.cost)}`)
  console.log(`相对全高峰节省       ${fmtCost(Math.max(0, t.baselineCost - t.cost))}   （全高峰口径 ${fmtCost(t.baselineCost)}）`)
  console.log(`高峰 / 空闲费用      ${fmtCost(t.peakCost)} / ${fmtCost(t.offPeakCost)}`)
  console.log(`高峰 token 占比      ${(t.peakShare * 100).toFixed(1)}%`)
  console.log(`输入（未命中）       ${fmtExact(t.input)}`)
  console.log(`输出                 ${fmtExact(t.output)}`)
  console.log(`输入（缓存命中）     ${fmtExact(t.cacheRead)}`)
  console.log(`缓存写入             ${fmtExact(t.cacheWrite)}`)
  console.log(`token 合计           ${fmtExact(t.tokens)}`)
  console.log(`会话数 / 活跃天数    ${t.sessions} / ${t.activeDays}`)

  const slots = (p.peakSlots ?? []).map((s) => `${s.start}:00-${s.end}:00`).join(' / ')
  console.log(`\n计费规则   高峰 ${slots}（北京时间） · 空闲 = 高峰 × ${p.offPeakMultiplier}`)
  console.log(`           ${p.weekendRelax
    ? (p.weekendRelaxFrom ? `周末全天空闲自 ${p.weekendRelaxFrom} 起` : '周末全天空闲')
    : '周末区分峰谷'}`)
  console.log(`           去重归并的采样 ${fmtExact(t.duplicateSamples)} 个（旧格式日志的双计已消除）`)

  console.log(`\n${line}\n按模型\n${line}`)
  const mw = [30, 14, 12, 12, 12]
  console.log(pad('模型', mw[0]) + '  ' + pad('tokens', mw[1]) + '  ' + pad('费用', mw[2]) + '  ' + pad('占比', mw[3]) + '  ' + pad('会话', mw[4]))
  for (const m of o.byModel) {
    console.log(
      pad(m.model, mw[0]) + '  '
      + pad(fmtTokens(m.input + m.output + m.cacheRead + m.cacheWrite), mw[1]) + '  '
      + pad(fmtCost(m.cost), mw[2]) + '  '
      + pad((m.share * 100).toFixed(1) + '%', mw[3]) + '  '
      + pad(m.sessions, mw[4]),
    )
  }

  console.log(`\n${line}\n最近 ${days} 天明细\n${line}`)
  const dw = [14, 14, 12, 14, 12]
  console.log(pad('日期', dw[0]) + '  ' + pad('输入', dw[1]) + '  ' + pad('输出', dw[2]) + '  ' + pad('缓存读', dw[3]) + '  ' + pad('费用', dw[4]))
  for (const d of o.byDay.slice(-days).reverse()) {
    console.log(
      pad(d.date, dw[0]) + '  '
      + pad(fmtTokens(d.input), dw[1]) + '  '
      + pad(fmtTokens(d.output), dw[2]) + '  '
      + pad(fmtTokens(d.cacheRead), dw[3]) + '  '
      + pad(fmtCost(d.cost), dw[4]),
    )
  }

  console.log(`\n${line}\n会话（按费用降序，最多 20 条）\n${line}`)
  const sw = [40, 14, 12, 12, 14, 6]
  console.log(pad('项目 / 会话', sw[0]) + '  ' + pad('tokens', sw[1]) + '  ' + pad('输入', sw[2]) + '  ' + pad('输出', sw[3]) + '  ' + pad('费用', sw[4]) + '  ' + pad('gen', sw[5]))
  const sessions = [...o.bySession].sort((a, b) => b.cost - a.cost).slice(0, 20)
  for (const s of sessions) {
    const label = `${s.projectLabel} · ${s.id.slice(0, 8)}`
    console.log(
      pad(label.length > 38 ? label.slice(0, 37) + '…' : label, sw[0]) + '  '
      + pad(fmtTokens(s.input + s.output + s.cacheRead + s.cacheWrite), sw[1]) + '  '
      + pad(fmtTokens(s.input), sw[2]) + '  '
      + pad(fmtTokens(s.output), sw[3]) + '  '
      + pad(fmtCost(s.cost), sw[4]) + '  '
      + pad(s.generation, sw[5]),
    )
  }
  if (o.bySession.length > sessions.length) {
    console.log(`… 其余 ${o.bySession.length - sessions.length} 个会话未列出（用 --json 取全量）`)
  }

  console.log(`\n${line}`)
  console.log('提示：入口在左侧导航栏「用量计费」；改单价 / 峰谷规则 → 设置 → 插件 → dsh-usage-billing，')
  console.log('      或直接改 profile 的 cordis.patch.yml 里 id: usage-billing 那一行。')
  console.log(line)
}

await main()

// Node 的 fetch 会保留 keep-alive 连接，事件循环因此不会自己结束，
// 进程会以「仍有活跃句柄」的非零码退出。这里显式收尾，让退出码只反映成败。
process.exit(process.exitCode ?? 0)
