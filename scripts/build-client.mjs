#!/usr/bin/env node
/**
 * 构建浏览器半边的产物 `lib/client.js`。
 *
 * ## 为什么不用打包器
 *
 * DSH 的官方客户端预设（`packages/client/tsdown.client.ts`）**不在任何已发布的
 * npm 包里**，官方文档（`docs/cookbook/adding-a-settings-card.md`）明确说仓库外
 * 的包要自己复现这个构建。而本插件在浏览器侧只有三个模块、唯一的外部依赖是
 * shell 已经共享进模块表的 `react`，引入 rolldown/tsdown 只会多几百个依赖。
 *
 * 因此这里直接拼接源码并套上官方预设那段 banner / footer：
 *
 * ```js
 * window.__ModuleLoader__.load({
 *   id: "<包名>",
 *   factory: (require) => {
 *     var module = { exports: {} }; var exports = module.exports;
 *     …源码…
 *     return module.exports; } });
 * ```
 *
 * 拼接顺序由源码里的显式标记决定（见 TARGETS），并做两项静态校验：
 *   1. 只允许 require 模块表提供的基线说明符（默认只有 `react`）；
 *   2. 不允许出现任何 `@deepseek-ai/*` 的**值**引用（跨插件值引用被官方纯洁性
 *      门禁禁止）。
 *
 * @module dsh-usage-billing/scripts/build-client
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const CLIENT_DIR = join(ROOT, 'src', 'client')
const OUT_FILE = join(ROOT, 'lib', 'client.js')

/** 包名：必须是模块表注册的 id，且与 package.json 的 name 完全一致。 */
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const BUNDLE_ID = pkg.name

/**
 * 模块表（`PLATFORM_MODULES`）在浏览器里共享给插件的说明符。
 * 只有这些 `require()` 能被回答，其余的都会在运行时抛错。
 */
const BASELINE_EXTERNALS = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])

/** 本包额外声明的外部说明符（`dsh.client.external`）。 */
const EXTRA_EXTERNALS = new Set(pkg.dsh?.client?.external ?? [])

/**
 * 参与拼接的源文件，**按依赖顺序**（被依赖者在前）。
 *
 * - `defines`：该模块对外提供的名字，拼接时作为 IIFE 的返回值。
 * - `require`：本模块 `require('./x')` 到「要取的名字」的映射；`./` 前缀可写可不写。
 */
const TARGETS = [
  { file: 'styles.cjs.js', defines: ['STYLE_TAG_ID', 'PANEL_CSS'], require: {} },
  {
    file: 'styles-inject.cjs.js',
    defines: ['injectStyles'],
    require: { 'styles.cjs.js': ['PANEL_CSS', 'STYLE_TAG_ID'] },
  },
  { file: 'panel.cjs.js', defines: ['UsagePanel', 'panelInternals'], require: {} },
  {
    file: 'index.cjs.js',
    defines: ['inject', 'apply', 'SECTION_ID'],
    require: { 'styles-inject.cjs.js': ['injectStyles'], 'panel.cjs.js': ['UsagePanel'] },
  },
]

/** 把 `./x` 与 `x` 归一成同一个模块键。 */
function normalizeSpec(spec) {
  return spec.startsWith('./') ? spec.slice(2) : spec
}

/**
 * 去掉模块源码里「返回值式」的导出行。
 *
 * 每个模块源文件末尾可能有裸的 `Foo,\n  Bar,` 这类仅用于返回的标识符列表，
 * 它们在被包进 IIFE 后没有任何语句上下文，会直接变成语法错误。这里按行剔除
 * 那些「只有标识符 + 逗号」的行（多行对象字面量/数组内部的元素行不受影响，
 * 因为它们不满足整行仅标识符的形态）。
 *
 * 真正的导出由各模块自己对作用域内 `exports` 赋值完成，见各 `src/client/*.cjs.js`。
 */
function stripTrailingExportLines(source) {
  const out = []
  for (const line of source.split('\n')) {
    if (/^\s*[A-Za-z_$][A-Za-z0-9_$]*\s*,\s*$/.test(line)) continue
    if (/^\s*[A-Za-z_$][A-Za-z0-9_$]*\s*,\s*\/\//.test(line)) continue
    out.push(line)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}

/** 校验并重写 `require()`。 */
function rewriteRequires(source, file, mapping) {
  return source.replace(/require\(\s*['"]([^'"]+)['"]\s*\)/g, (match, spec) => {
    const key = normalizeSpec(spec)
    if (Object.prototype.hasOwnProperty.call(mapping, key)) {
      // 展开成显式的属性读取：不能用 `{ a, b }` 解构简写，那会读成同名局部变量
      // （正是被替换掉的那一行），在初始化前就抛 ReferenceError。
      const defs = JSON.stringify(key)
      return '{ ' + mapping[key].map((name) => `${name}: __ub_internal_defs[${defs}].${name}`).join(', ') + ' }'
    }
    if (BASELINE_EXTERNALS.has(spec) || EXTRA_EXTERNALS.has(spec)) {
      return `__ub_external(${JSON.stringify(spec)})`
    }
    throw new Error(
      `client bundle: ${file} requires "${spec}", which the DSH module table cannot answer. `
      + 'Baseline externals are: ' + [...BASELINE_EXTERNALS].join(', ')
      + '. Declare dsh.client.external to add one, or inline the dependency.',
    )
  })
}

/** 拼接所有源文件。 */
function buildFactoryBody() {
  const chunks = []

  // 模块表（`react` 等）的取用口：每个说明符只向 shell 取一次。
  chunks.push('var __ub_modules = {};')
  chunks.push("function __ub_external(spec) { if (!(spec in __ub_modules)) __ub_modules[spec] = require(spec); return __ub_modules[spec]; }")
  chunks.push('var __ub_internal_defs = {};')

  for (const target of TARGETS) {
    const source = readFileSync(join(CLIENT_DIR, target.file), 'utf8')
    const body = rewriteRequires(stripTrailingExportLines(source), target.file, target.require ?? {})

    chunks.push(`\n/* ---- ${target.file} ---- */`)
    // 每个模块包一层 IIFE，避免同名局部变量互相踩；模块自己对 `exports`
    // 赋值来暴露导出面。
    chunks.push(`__ub_internal_defs[${JSON.stringify(target.file)}] = (function () {`)
    chunks.push('var exports = {};')
    chunks.push(body)
    chunks.push('return exports;')
    chunks.push('})();')
  }

  // 入口模块（最后一个 target）的导出面直接成为整个包的导出。
  const entry = TARGETS[TARGETS.length - 1]
  chunks.push('\n/* ---- exports ---- */')
  chunks.push(`var __ub_entry = __ub_internal_defs[${JSON.stringify(entry.file)}];`)
  for (const name of entry.defines) {
    chunks.push(`exports.${name} = __ub_entry.${name};`)
  }

  return chunks.join('\n')
}

/**
 * 纯净化检查：浏览器半边不得对其它 `@deepseek-ai/*` 做值引用
 * （跨插件值引用被官方的客户端纯洁性门禁禁止，只能用 `import type`）。
 */
function assertOnlyBaselineExternals(body) {
  const offenders = []
  const pattern = /require\(\s*['"]([^'"]+)['"]\s*\)/g
  let match
  while ((match = pattern.exec(body)) !== null) {
    const spec = match[1]
    if (spec.startsWith('./')) continue
    if (BASELINE_EXTERNALS.has(spec) || EXTRA_EXTERNALS.has(spec)) continue
    offenders.push(spec)
  }
  if (offenders.length > 0) {
    throw new Error(`client bundle: unresolved require(s): ${[...new Set(offenders)].join(', ')}`)
  }
}

const body = buildFactoryBody()
assertOnlyBaselineExternals(body)

const usedExternals = [...new Set([...BASELINE_EXTERNALS, ...EXTRA_EXTERNALS])]
  .filter((spec) => body.includes(`__ub_external(${JSON.stringify(spec)})`))

const bundle = [
  'window.__ModuleLoader__.load({',
  `\tid: ${JSON.stringify(BUNDLE_ID)},`,
  '\tfactory: (require) => {',
  '\t\tvar module = { exports: {} };',
  '\t\tvar exports = module.exports;',
  body,
  '\t\treturn module.exports;',
  '\t} });',
  '',
].join('\n')

mkdirSync(dirname(OUT_FILE), { recursive: true })
writeFileSync(OUT_FILE, bundle, 'utf8')

console.log(`client bundle written: ${OUT_FILE} (${Buffer.byteLength(bundle)} bytes)`)
console.log(`  id        : ${BUNDLE_ID}`)
console.log(`  externals : ${usedExternals.join(', ') || '(none)'}`)
console.log(`  modules   : ${TARGETS.map((t) => t.file).join(' -> ')}`)
