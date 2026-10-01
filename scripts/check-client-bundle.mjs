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
const registrations = []
const effects = []
const stubCtx = {
  slots: {
    inject: (name, fn) => { registrations.push(name); fn(); return () => {} },
    register: (options, component) => {
      registrations.push({ options, component })
      return () => {}
    },
  },
  effect: (fn, label) => { effects.push(label); fn(); return () => {} },
}
exportsObj.apply(stubCtx)
console.log('  effects       :', JSON.stringify(effects))
const reg = registrations.find((r) => typeof r === 'object' && r.options)
assert.ok(reg, 'apply() must register into a slot')
assert.equal(reg.options.name, 'settings.section')
assert.equal(reg.options.id, 'usage-billing')
assert.equal(typeof reg.component, 'function', 'the registered component must be a function')
console.log('  slot          :', reg.options.name, '/ id =', reg.options.id, '/ label =', JSON.stringify(reg.options.label()))
console.log('  component     :', reg.component.name || '(anonymous)')
console.log('\nALL CLIENT BUNDLE CHECKS PASSED')
