#!/usr/bin/env node
/**
 * 测试入口。
 *
 * 为什么不用 `node --test <dir>`：内置 runner 会为每个测试文件 **spawn 一个子
 * 进程**，在受限环境里创建子进程会被直接拒绝（`spawn EPERM`，Windows 沙箱与部分
 * CI token 都会这样），于是一条测试都跑不起来。`run({ isolation: 'none' })`
 * 虽然不 spawn，但它的完成信号在这些 Node 版本上不触发，同样会挂住。
 *
 * 这里的做法：在当前进程里**逐个 import 测试文件**，Node 的测试运行钩子在进程内
 * 本就是激活的。结论文由 `node:test` 自己打印的汇总行给出（`ℹ tests` / `ℹ pass`
 * / `ℹ fail`），退出码取 `process.exitCode`——`node:test` 在有失败时会把它置为 1。
 * 本脚本不重复统计（进程级 `test:pass` 事件在动态 import 期间到达得不完整，
 * 自己数只会得到误导性的数字）。
 *
 * @module dsh-usage-billing/scripts/run-tests
 */

import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const TESTS_DIR = resolve(HERE, '..', 'tests')

const files = readdirSync(TESTS_DIR)
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()

if (files.length === 0) {
  console.error('no test files found in', TESTS_DIR)
  process.exitCode = 1
} else {
  console.log(`running ${files.length} test file(s) in-process:`)
  for (const file of files) console.log('  ' + file)

  let importFailure = null
  for (const file of files) {
    try {
      await import(pathToFileURL(join(TESTS_DIR, file)).href)
    } catch (error) {
      // import 期抛错（例如模块解析失败）不会被 node:test 记为失败的用例。
      importFailure = { file, error }
      console.error(`\nFAILED TO LOAD: ${file}`)
      console.error(error?.stack ?? error?.message ?? String(error))
      break
    }
  }

  console.log(`\n${files.length} test file(s) executed; 结论见上方 node:test 汇总行。`)
  if (importFailure !== null) process.exitCode = 1
}
