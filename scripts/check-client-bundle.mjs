// Verify the built client bundle against the DSH client-module-system contract:
// syntax, banner/footer, and that it registers and exports { inject, apply }.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const file = new URL('../lib/client.js', import.meta.url)
const source = readFileSync(file, 'utf8')

console.log('=== 1. artifact contract ===')
const lines = source.trimEnd().split('\n')
const firstLine = lines[0]
const secondToLast = lines[lines.length - 2]
const lastLine = lines[lines.length - 1]
console.log('  first        :', firstLine)
console.log('  second-last  :', secondToLast)
console.log('  last         :', lastLine)
assert.equal(firstLine, 'window.__ModuleLoader__.load({', 'banner must open the loader registration')
assert.equal(secondToLast, '\t\treturn module.exports;', 'factory must return its exports')
assert.equal(lastLine, '\t} });', 'footer must close factory + loader call')
assert.ok(source.includes('id: "dsh-usage-billing"'), 'id must be the exact package name')
console.log('  OK    : banner/footer/id match the official preset')

console.log('\n=== 2. syntax check ===')
// Node parses the whole file as a script; a syntax error throws here.
new vm.Script(source, { filename: 'lib/client.js' })
console.log('  OK    : parses as a script')

console.log('\n=== 3. load through a simulated DSH module table ===')
/** Minimal stand-ins for the shell baseline externals the bundle may require. */
const reactStub = {
  createElement: (...args) => ({ __element: true, args }),
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
}
const moduleTable = {
  react: reactStub,
  'react/jsx-runtime': { jsx: () => ({}), jsxs: () => ({}), Fragment: 'Fragment' },
}

let registered = null
const sandbox = {
  window: {
    __ModuleLoader__: {
      load: (registration) => { registered = registration },
    },
  },
  console,
  document: {
    head: { appendChild: () => {} },
    createElement: () => ({ dataset: {}, style: {} }),
    querySelector: () => null,
  },
  fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, overview: null }) }),
}
sandbox.globalThis = sandbox

vm.createContext(sandbox)
vm.runInContext(source, sandbox, { filename: 'lib/client.js' })

assert.ok(registered !== null, 'the bundle must call window.__ModuleLoader__.load')
console.log('  registered id :', registered.id)
assert.equal(registered.id, 'dsh-usage-billing')

const requireShim = createRequire(import.meta.url)
const exportsObj = registered.factory((spec) => {
  if (Object.prototype.hasOwnProperty.call(moduleTable, spec)) return moduleTable[spec]
  throw new Error(`module table cannot answer require(${JSON.stringify(spec)})`)
})

console.log('  exports keys  :', Object.keys(exportsObj).sort().join(', '))
assert.ok(Array.isArray(exportsObj.inject), 'client half must export `inject`')
assert.equal(typeof exportsObj.apply, 'function', 'client half must export `apply`')
console.log('  inject        :', JSON.stringify(exportsObj.inject))
void requireShim

console.log('\n=== 4. apply() against a stub client context ===')
const injected = []
const registrations = []
const effects = []
const stubCtx = {
  slots: {
    inject: (name, fn) => {
      injected.push(name)
      const disposer = fn()
      if (typeof disposer === 'function') disposer()
      return () => {}
    },
    register: (options, component) => {
      registrations.push({ options, component })
      return () => {}
    },
  },
  effect: (fn, label) => { effects.push(label); fn(); return () => {} },
}
exportsObj.apply(stubCtx)
console.log('  effects       :', JSON.stringify(effects))
console.log('  injected slots:', JSON.stringify(injected))

// 主导航面板：main 槽，key = panel id，owner 不传业务 props，故 inject face 必须存在但为空。
const main = registrations.find((r) => r.options.name === 'main')
assert.ok(main, 'apply() must register the `main` panel')
assert.equal(main.options.key, 'usage-billing', 'main key is the panel id')
assert.equal(typeof main.component, 'function')
assert.equal(typeof main.options.inject, 'function', 'main registration must supply an inject factory')
// 注意：inject() 的返回值来自 vm 里的另一个 realm，原型不同，
// 因此不能用 deepEqual 比较，改看键集合。
assert.deepEqual(Object.keys(main.options.inject()), [], 'main inject face is empty (page needs no ctx)')

// 侧栏导航行：sidebar.panellist，id 必须与 main 的 key 相同。
const row = registrations.find((r) => r.options.name === 'sidebar.panellist')
assert.ok(row, 'apply() must register the `sidebar.panellist` row')
assert.equal(row.options.id, 'usage-billing', 'row id must equal the main panel key')
assert.equal(row.options.id, main.options.key, 'row id and main key must address the same panel')
assert.equal(typeof row.component, 'function')
assert.equal(row.options.label(), '用量计费')
console.log('  main panel    : key =', main.options.key, '/ inject() =', JSON.stringify(main.options.inject()))
console.log('  sidebar row   : id =', row.options.id, '/ order =', row.options.order, '/ label =', JSON.stringify(row.options.label()))
console.log('  icon renders  :', JSON.stringify(row.component({ size: 16, active: false }) !== undefined))
console.log('\nALL CLIENT BUNDLE CHECKS PASSED')
