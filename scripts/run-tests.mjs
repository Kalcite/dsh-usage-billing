#!/usr/bin/env node
/**
 * 测试入口。
 *
 * 为什么不用 `node --test <dir>`：内置 runner 会为每个测试文件 **spawn 一个子
 * 进程**，在受限环境里创建子进程会被直接拒绝（`spawn EPERM`，Windows 沙箱与部分
 * CI token 都会这样），于是一条测试都跑不起来。
 *
 * 这里用 `run({ files, isolation: 'none' })`：在**当前进程内**、**按顺序**执行
 * 全部测试文件。
 *
 * 顺序执行是必须的，不是优化：`node:test` 在 `test()` 注册时就立即调度，所以
 * 「自己 for 循环 await import 每个文件」会让所有文件**并发**跑——某个文件替换的
 * 全局（例如 jsdom 渲染测试把 `globalThis.fetch` 换成桩）会污染另一个正在跑的
 * 文件的 HTTP 断言。症状很有迷惑性：每个文件单独跑全绿，进套件后集体失败。
 *
 * @module dsh-usage-billing/scripts/run-tests
 */

import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { run } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const TESTS_DIR = resolve(HERE, '..', 'tests')

/** `run()` 要文件系统路径（Windows 上传 `file://` URL 会被当相对路径）。 */
const files = readdirSync(TESTS_DIR)
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => join(TESTS_DIR, name))

if (files.length === 0) {
  console.error('no test files found in', TESTS_DIR)
  process.exitCode = 1
} else {
  console.log(`running ${files.length} test file(s) in-process, sequentially:`)
  for (const file of files) console.log('  ' + file.slice(TESTS_DIR.length + 1))

  /**
   * 在当前进程里跑测试，就必须自己管住全局污染。
   *
   * 有的文件（jsdom 渲染测试）会替换 `globalThis.fetch` / `document` / `window`
   * 来挂载组件。所有文件共享同一个全局对象，一旦某个文件忘了还原，后面的文件就会
   * 拿到桩——症状极具迷惑性：单文件跑全绿，进套件后 HTTP 用例集体失败。这里在
   * 加载任何测试文件之前抓住原生句柄，并在跑完后无条件还原。
   */
  const nativeFetch = globalThis.fetch
  const nativeGlobals = new Map(
    ['document', 'window', 'HTMLElement', 'Node'].map((name) => [name, globalThis[name]]),
  )
  const restoreGlobals = () => {
    globalThis.fetch = nativeFetch
    for (const [name, value] of nativeGlobals) {
      if (value === undefined) delete globalThis[name]
      else Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
    }
  }

  let passed = 0
  let failed = 0
  const failures = []
  const stream = run({ files, isolation: 'none' })

  stream.on('test:pass', (data) => { if (!data.skip) passed += 1 })
  stream.on('test:fail', (data) => {
    failed += 1
    failures.push({ name: data.name, error: data.details?.error })
  })

  /**
   * 等完成信号。不同 Node 版本给的是 `completed()` / `end` / `close`，逐个探测；
   * 各自加一个上限，避免某个信号缺失时把整个测试挂死。
   */
  const settle = async () => {
    const cap = new Promise((r) => setTimeout(r, 180_000))
    if (typeof stream.completed === 'function') {
      await Promise.race([stream.completed(), cap])
      return
    }
    await Promise.race([
      new Promise((done) => {
        let settled = false
        const finish = () => { if (!settled) { settled = true; done() } }
        stream.once('end', finish)
        stream.once('close', finish)
      }),
      cap,
    ])
  }
  await settle()
  restoreGlobals()

  for (const failure of failures) {
    console.error(`\nFAIL: ${failure.name}`)
    if (failure.error) console.error(failure.error.stack ?? failure.error.message)
  }

  console.log(`\ntest files: ${files.length}  passed: ${passed}  failed: ${failed}`)
  if (failed > 0) process.exitCode = 1
}
