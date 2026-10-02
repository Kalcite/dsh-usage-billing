#!/usr/bin/env node
/**
 * 构建浏览器半边的产物 `lib/client.js`。
 *
 * ## 为什么不用打包器
 *
 * DSH 的官方客户端预设（`packages/client/tsdown.client.ts`）**不在任何已发布的
 * npm 包里**，官方文档（`docs/cookbook/adding-a-settings-card.md`）明确说仓库外
 * 的包要自己复现这个构建。而本插件在浏览器侧只有几个模块、唯一的外部依赖是
 * shell 已经共享进模块表的 `react`，引入 rolldown/tsdown 只会多几百个依赖。
 *
 * ## 拼装方式
 *
 * 每个 `src/client/*.cjs.js` 就是一个 **IIFE 的函数体**：它内部 `require()` 本包
 * 其它模块、并以 `return { … }` 交出自己的导出面。构建脚本只做三件事：
 *
 *   1. 把 `require('./x.cjs.js')` 重写成对已定义模块的属性读取（`TARGETS.require`）；
 *   2. 把 `require('react')` 这类基线说明符重写成向 shell 模块表取；
 *   3. 用官方预设的 banner / footer 包起来。
 *
 * 导出走**返回值**而不是 `exports.X = …` 赋值是刻意的：这样脚本完全不必解析
 * 赋值语句，也就不会在模板字符串里的换行 / 分号上踩坑。
 *
 * 静态校验：任何 `require` 都必须能由模块表回答（基线外部依赖或
 * `dsh.client.external`），从而保证不出现跨插件的值引用。
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
 * `require` 是本模块 `require('./x')` 到「要取的名字」的映射；`./` 前缀可写可不写。
 * 每个模块的导出面由它自己的 `return { … }` 给出，脚本不解析。
 */
const TARGETS = [
  { file: 'styles.cjs.js', require: {} },
  { file: 'styles-inject.cjs.js', require: { 'styles.cjs.js': ['PANEL_CSS', 'STYLE_TAG_ID'] } },
  { file: 'panel.cjs.js', require: {} },
  {
    file: 'index.cjs.js',
    require: {
      'styles-inject.cjs.js': ['injectStyles'],
      'panel.cjs.js': ['UsagePanel', 'panelInternals'],
    },
  },
]

/**
 * 拼接后的 factory 里，入口模块导出的名字。
 *
 * 官方只要求 `inject` + `apply`；`UsagePanel` / `PANEL_ID` 是为了让渲染测试
 * 能直接拿到组件（模块私有作用域外部拿不到），运行时多挂两个键无副作用。
 */
const ENTRY_EXPORTS = ['inject', 'apply', 'PANEL_ID', 'PANEL_LABEL', 'UsageBillingIcon', 'UsagePanel', 'panelInternals']

/** 把 `./x` 与 `x` 归一成同一个模块键。 */
function normalizeSpec(spec) {
  return spec.startsWith('./') ? spec.slice(2) : spec
}

/** 校验并重写 `require()`。 */
function rewriteRequires(source, file, mapping) {
  return source.replace(/require\(\s*['"]([^'"]+)['"]\s*\)/g, (match, spec) => {
    const key = normalizeSpec(spec)
    if (Object.prototype.hasOwnProperty.call(mapping, key)) {
      // 展开成显式属性读取：不能用 `{ a, b }` 解构简写，那会读成同名局部变量。
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
  chunks.push('function __ub_external(spec) { if (!(spec in __ub_modules)) __ub_modules[spec] = require(spec); return __ub_modules[spec]; }')
  chunks.push('var __ub_internal_defs = {};')

  for (const target of TARGETS) {
    const source = readFileSync(join(CLIENT_DIR, target.file), 'utf8')
    const body = rewriteRequires(source, target.file, target.require ?? {})
    chunks.push(`\n/* ---- ${target.file} ---- */`)
    chunks.push(`__ub_internal_defs[${JSON.stringify(target.file)}] = (function () {`)
    chunks.push(body)
    chunks.push('})();')
  }

  const entryFile = TARGETS[TARGETS.length - 1].file
  chunks.push('\n/* ---- exports ---- */')
  chunks.push(`var __ub_entry = __ub_internal_defs[${JSON.stringify(entryFile)}];`)
  for (const name of ENTRY_EXPORTS) chunks.push(`exports.${name} = __ub_entry.${name};`)

  return chunks.join('\n')
}

/** 纯净化检查：任何未被重写的 `require(<bare>)` 都必须能由模块表回答。 */
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
