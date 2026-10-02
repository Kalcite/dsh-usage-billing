# dsh-usage-billing

DeepSeek Harness 的**用量与计费**插件。扫描会话日志统计 Token 消耗，按多模型单价与峰谷时段实时算钱，并把账单做成一个看板挂进 DSH **左侧主导航栏**。

移植自 `dsh-launcher-webui` 启动器的内嵌用量插件（`server/usage.mjs` + `src/components/UsageCard.tsx`），并修正了其中两个真实存在的缺陷（见[与原实现的差异](#与原实现的差异)）。

零运行时依赖：`dependencies` 为空，只声明 `peerDependencies`，由 DSH 进程满足。

---

## 它做什么

在左侧主导航栏新增一个 **「用量计费」** 条目（与「插件」「定时任务」同级），点开即占据中间主列，包含：

| 模块 | 内容 |
| --- | --- |
| 概览卡片 | 总费用（峰谷实时）、输入 / 输出 / 缓存读取 token、会话数、活跃天数 |
| Token 构成 | 缓存命中输入 / 未命中输入 / 输出 / 缓存写入的占比饼图，含各桶单价 |
| 峰谷账单 | 高峰费用、空闲费用、相对全高峰节省、高峰 token 占比 |
| 模型构成 | 每个模型的 token 与费用（多模型分别计价） |
| 最近 30 天消耗 | 按日柱状图 + 明细表 |
| 24 小时分布 | 跨全部日期的按时段柱状图，高峰时段高亮；刻度单独一行对齐（`00/06/12/18/24`） |
| 日期 × 小时热力 | 日期 × 24 小时，描边标出高峰、绿框标出周末全天空闲；**可用滑块改窗口大小并平移查看更早时段** |
| 年度热力图 | GitHub 风格热力，与上面的热力图**共用同一个时间窗**（分档按窗口内数据重算，放大后不会整片同色） |
| 会话分析 | 按费用排序的会话表，可展开看单会话的饼图、峰谷账单、时长与 24 小时分布 |
| 扫描信息 | 数据目录、读取日志数、格式分布（gen 0 / gen 4）、压缩体积与耗时 |

计时窗口控件提供三个预设（最近 30 / 90 / 180 天）与「全部」，外加两个滑块：
**窗口**（看多少天）与**右端**（看到哪一天），因此可以回看任意历史时段。
右端在未手动调整时始终跟随最新一天。

计费规则（单价、峰谷时段、周末规则、时区）全部可在 **设置 → 插件 → dsh-usage-billing** 里实时修改——那些字段都是 schemastery 的 `.volatile()` 字段，由 Loader 写回 profile patch，改完立刻重算，不需要重启。

---

## 安装

### 从 npm

```bash
dsh plugin --profile web add dsh-usage-billing
```

把 `web` 换成你实际使用的 profile 名（桌面版通常也用 `web`，可用 `dsh plugin --profile desktop add dsh-usage-billing` 指定）。这条命令会：

1. 用 pnpm 把包装进该 profile 的 `node_modules`；
2. 把它写进 profile `package.json` 的 `dependencies`；
3. 因为包声明了 `dsh.bundle.patch`，把它追加进 `dsh.profile.bundles`，于是它的 `cordis.patch.yml` 会在下次启动时被合并——**不需要手改任何 profile 文件**。

装完重启 DSH，左栏导航里点 **「用量计费」**。

### 从源码 / 本地目录

```bash
git clone <this repo> dsh-usage-billing
cd dsh-usage-billing
pnpm install
pnpm run build          # 生成 lib/client.js 与 lib/*.js
dsh plugin --profile web add "file:$PWD"
```

`lib/` 是**必须预先构建并随包发布**的：DSH 不会替第三方插件构建任何代码，客户端模块系统只读取 `exports["./client"]` 指到的现成文件。

### 卸载

```bash
dsh plugin --profile web remove dsh-usage-billing
```

### 验证装好了

```bash
# 主机半边：应返回 {"ok":true,...}
curl http://127.0.0.1:3080/usage-billing/health

# 客户端产物：应返回 200 与一段 JS
curl -I 'http://127.0.0.1:3080/plugins/??dsh-usage-billing/client.js&rev=0'
```

第二条的**地址形状很关键**：DSH 的客户端模块系统用**组合查询**寻址插件资源
（`/plugins/??<id>/client.js&rev=<hash>`），**不是** `/plugins/<id>/client.js`。
后者必然 404——那只是路径形状不对，不代表插件有问题。真实地址可以在页面控制台里读：

```js
window.__DSH_BOOT__.entries.find(e => e.id === 'dsh-usage-billing')
```

主机半边的自检也可用仓库自带的命令行报告（不依赖客户端插件系统）：

```bash
node bin/usage-report.mjs --port 3080
```

> 客户端插件路由由 `@deepseek-ai/dsh-client-modules` 注册，Web profile 会挂载它。
> 若某个精简装配缺了这一行，则**所有**客户端插件（含 DSH 自带）的 bundle 都会
> 404，本插件界面不会出现；此时主机半边与上面的命令行报告仍然可用。

---

## 桌面端与网页端

**两端的代码是同一套，但需要分别装、分别重启。**

| | 宿主半边（取数 / 计费） | 界面半边（导航栏 + 看板） |
| --- | --- | --- |
| Web profile（`dsh web`） | ✅ 已在 3080 实测 | ✅ 已实测渲染 |
| 桌面端（Electron） | ✅ 已在 19387 实测（`/usage-billing/health` 返回 200） | ⚠️ 结构上可用，未实测 |

为什么说桌面端结构上可用：桌面端就是**把完整的 DSH Web 应用包在 Electron 里**——

- 它把应用 HTTP 请求（含插件产物路由 `/plugins/*`）转发给受认证的 Host
  （`apps/desktop/src/web-document.ts` 的 `forwardWebRequest`，其中
  `PLUGIN_BUNDLE_PATH = /^\/plugins\//` 专门处理产物响应头）；
- 打包产物里**确实包含**客户端插件系统与我要用的那几个槽位——实测
  `resources/app.asar` 内有 `dsh-client-modules`、`dsh-client-ui-layout`、
  `dsh-client-ui-sidebar`、`dsh-client-ui-slots`。

**但桌面端要单独装一次**，而且装完要**完全退出并重开**桌面应用（profile 的 bundle
列表只在启动时组装）：

```bash
dsh plugin --profile desktop add dsh-usage-billing
```

桌面 profile 由 Electron 独占，CLI 会拒绝直接启动/导出它（`profile "desktop" is
managed exclusively by the Electron application`）——上面这条是 Desktop 自带的命令运行时
（`resources/runtime/cli/bin/dsh.cmd`），可以在桌面应用关闭时管理插件。

> ⚠️ **开发时最容易踩的坑**：`dsh plugin add` 装进来的是 pnpm 的**内容寻址快照**
> （硬链接），不是指向你工作目录的链接。所以你在工作区重新 `build` 之后，profile 里
> 那一份**不会跟着变**，宿主仍读旧产物——症状是「明明改好了、验证也过了，界面却没变化」。
> 开发时请把 profile 的 `node_modules/<包名>` 换成指向工作区的目录联接（junction），
> 或者改完后重跑一次 `add`。


所有字段都有默认值，**不配置即可用**（默认即 DeepSeek 官方定价）。要自定义，写进 profile 的 `cordis.patch.yml`：

```yaml
- id: usage-billing
  name: 'dsh-usage-billing'
  config:
    offPeakMultiplier: 0.5          # 空闲价 = 高峰价 × 该系数
    peakSlots:                      # 高峰时段（北京时间整点，含 start 不含 end）
      - { start: 9, end: 12 }
      - { start: 14, end: 18 }
    weekendRelax: true              # 周末全天空闲
    weekendRelaxFrom: '2026-08-23'  # 该日期 00:00 起生效；留空 = 始终生效
    # timezone: 'Asia/Shanghai'     # 统计时区；留空 = 跟随运行环境本地时区
    # home: 'C:\Users\you\.dsh'     # 会话数据目录；留空 = $DSH_HOME
    models:
      deepseek-flash:      { inputPerM: 3, outputPerM: 9,  cacheReadPerM: 0.1, cacheWritePerM: 3 }
      deepseek-v4-pro:     { inputPerM: 9, outputPerM: 27, cacheReadPerM: 0.3, cacheWritePerM: 9 }
      deepseek-v4-flash:   { inputPerM: 3, outputPerM: 9,  cacheReadPerM: 0.1, cacheWritePerM: 3 }
      _default:            { inputPerM: 3, outputPerM: 9,  cacheReadPerM: 0.1, cacheWritePerM: 3 }
```

> **注意**：`ctx.settings` 的命名空间是 Loader 的**行 id**（这里是 `usage-billing`），不是包名。所以在设置页保存单价后，写回的是 `id: usage-billing` 这一行。请不要改动这个 id，否则已保存的价格会失配。

### 默认单价

默认表取自 DeepSeek 官方定价文档（人民币 / 百万 token，高峰价）：

| 模型 id | 输入（未命中） | 输出 | 输入（命中） | 缓存写入 |
| --- | --- | --- | --- | --- |
| `deepseek-flash` | 3 | 9 | 0.1 | 3 |
| `deepseek-v4-pro` | 9 | 27 | 0.3 | 9 |
| `deepseek-v4-flash`（历史 id） | 3 | 9 | 0.1 | 3 |
| `deepseek-v4-flash-vision-exp` | 3 | 9 | 0.1 | 3 |
| `_default`（兜底） | 3 | 9 | 0.1 | 3 |

`deepseek-flash` 是当前 DSH 模型目录里的 id，`deepseek-v4-flash` 出现在较早的会话日志中，两者都保留、单价相同。未列出的模型走 `_default`。

### 峰谷规则

- 高峰时段默认 **09:00–12:00、14:00–18:00（北京时间）**，含起点不含终点。
- 空闲价 = 高峰价 × `offPeakMultiplier`（默认 0.5）。
- **周末（周六 / 周日）全天按空闲价**，自 `weekendRelaxFrom`（默认 `2026-08-23`）当日 00:00 起生效；该日期之前的周末仍区分峰谷时段。
- 单日费用按 **每个「日期 × 小时 × 模型」桶**独立判定峰谷，因此跨越时段边界的用量会被正确拆分。

费用公式：

```
桶费用 = Σ_模型 (输入×inputPerM + 输出×outputPerM + 缓存读×cacheReadPerM + 缓存写×cacheWritePerM) / 1e6 × 峰谷系数
峰谷系数 = 高峰 ? 1 : offPeakMultiplier
```

---

## 数据来源

会话日志位于 `$DSH_HOME/sessions/<projectKey>/<sessionId>/`：

- `session.jsonl.zstd` —— **generation 0**（旧格式）
- `session.v4.jsonl.zstd` —— **generation 4**（当前格式）

同一会话目录里可能残留多个代号的文件，读取时取**代号最高**者（同代号优先 `.zstd`）。每个文件是由**多个带校验和的 zstd 帧**首尾拼接而成（DSH 这样追加写入而不重写整个文件），因此没有帧长度索引，必须先扫帧再逐帧解压。

Token 记账有两种载体：

- **generation 4**：只有 `assistant/message` 行的 `data.usage`。
- **generation 0**：`assistant/chunk` 行（`data.chunk.type === 'usage'`）与紧随其后的 `assistant/message` 行携带**同一份**用量。

模型归因按可靠性排序：`data.message.source.model` → 最近的 `request/context.data.model` → 最近的 `request/header.data.header.config.model` → `unknown`。

---

## 与原实现的差异

相对启动器里的内嵌用量插件，本插件修正了两处真实缺陷，并做了一点加固。两处都经过实测验证。

### 1. 旧格式日志的用量被算成 2 倍（已修正）

参考实现按行判断：

```js
if (chunk && chunk.type === 'usage' && chunk.usage) u = chunk.usage;   // assistant/chunk 走这里
else if (j?.data?.usage && typeof j.data.usage === 'object') u = j.data.usage;  // 兄弟行 assistant/message 走这里
```

generation 0 的同一份用量因此被计两次。实测本机全部 generation 0 会话，**朴素解析 / 去重后的比值恒为 2.000**：

| 会话 | 朴素累加（输入） | 去重后（输入） | 比值 |
| --- | --- | --- | --- |
| 会话 1 | 243,390 | 121,695 | 2.000 |
| 会话 2 | 116,520 | 58,260 | 2.000 |
| 会话 3 | 161,358 | 80,679 | 2.000 |
| 会话 4 | 284,674 | 142,337 | 2.000 |
| 会话 5 | 148,340 | 74,170 | 2.000 |

本插件按 **`(turn, step)`** 归一：同一步的多个采样只保留最后一个（`assistant/message` 是最终的完整采样），于是既修掉双计，又保留了「重试后取最终值」的正确语义。

> 这意味着本插件对历史（generation 0）会话的费用**低于**启动器显示的数字——低的那一半才是真实用量。

### 2. 当前格式（generation 4）的日志被整个漏掉（已修正）

参考实现的文件名正则只认到 `.v2`：

```js
/^session(?:\.v(\d+))?\.jsonl(?:\.zstd)?$/   // 这个其实不设上限
// 但同一仓库的注释与实际取舍按 v0/v1/v2 编写，v4 从未被考虑
```

本机实测：21 个会话目录中 **5 个已经是 `session.v4.jsonl.zstd`**，在旧口径下完全不计入。本插件用不设上限的代号匹配，并优先选最高代号。

### 3. 加固

- **时区显式化**：日期 / 星期 / 小时用 `Intl.DateTimeFormat` 在指定时区下求解，而不是 `Date#getHours()`。后者读运行环境本地时区，会让同一份日志在服务端与浏览器上算出不同的峰谷归属。
- **坏帧与坏行容错**：单个解压失败的帧或个别损坏的 JSON 行不会让整个会话从统计里消失。
- **零依赖**：不引入打包器、不引入第三方运行时依赖；客户端产物按官方格式手工生成。

> 关于损坏帧的边界：DSH 自己的 `scanZstdFrames` 在遇到非法帧头 / 保留位 / 保留块类型时**直接抛错**，只对「尾部被截断的最后一个帧」提供恢复（`decompressZstdPrefix`）。追加写的日志正常情况下不会有中间空洞，所以本插件与 DSH 保持一致：中段损坏等价于「此后不可读」。这一点有测试覆盖。

---

## 实现说明

### 主机半边（Node）

`src/index.ts` 是插件主体：

- 导出 `name` / `inject` / `Config` / `apply`；
- `Config` 的每个字段都是 `.volatile()`，因此可在设置页实时编辑并由 Loader 持久化；
- 注册一条只读路由 `/usage-billing/*`：

| 路径 | 说明 |
| --- | --- |
| `GET /usage-billing/summary` | 完整聚合结果（`?refresh=1` 跳过 5 秒缓存） |
| `GET /usage-billing/pricing` | 当前生效的计费规则 |
| `GET /usage-billing/health` | 路由与数据目录自检 |

路由套了一层**浏览器信任围栏**（回环地址，或部署声明的 `webRuntime.trustedHosts`），避免同一局域网内的其它来源读到本机用量。没有任何写入路径。

聚合结果按 `日期 × 小时 × 模型`（`byDayHour`）作为唯一能正确套用峰谷与周末规则的粒度；浏览器半边拿到这一层后自行重算金额，因此改单价后无需重新读盘。

### 浏览器半边（Web）

`src/client/` 下的模块由 `scripts/build-client.mjs` 拼成 `lib/client.js`。

DSH 的官方客户端打包预设（`packages/client/tsdown.client.ts`）**不在任何已发布的 npm 包里**，官方文档明确要求仓库外的包自行复现该构建（`docs/cookbook/adding-a-settings-card.md`）。本包在浏览器侧只有几个模块、唯一的外部依赖是 shell 已共享进模块表的 `react`，因此不引入打包器，直接拼接源码并套上官方预设的 banner / footer：

```js
window.__ModuleLoader__.load({
  id: "dsh-usage-billing",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    /* 源码 */
    return module.exports;
  } });
```

构建脚本会静态校验：任何 `require()` 都必须能由模块表回答（基线外部依赖或 `dsh.client.external`），并且不出现跨插件的 `@deepseek-ai/*` **值**引用。

浏览器半边通过 `ctx.slots.inject('main', …)`（主列面板）与
`ctx.slots.inject('sidebar.panellist', …)`（左栏导航行）贡献界面，两者的 id 相同
（`usage-billing`），点击导航行即 `layout.selectPanel('usage-billing')`。
只注入 `slots`，数据全部走自己的 HTTP 路由。

---

## 开发

```bash
pnpm install
pnpm run typecheck      # tsc --noEmit
pnpm run build:client   # 只重建 lib/client.js
pnpm run build          # 客户端产物 + tsc
pnpm test               # 55 个用例，含真实 cordis + webserver 的集成测试
pnpm run verify         # 测试 + 客户端产物契约检查 + 真实会话库对账
```

`pnpm test` 刻意不使用 `node --test <dir>`：内置 runner 会为每个测试文件 spawn 子进程，在受限环境（Windows 沙箱、部分 CI token）里会被拒绝并报 `spawn EPERM`。测试入口改为在当前进程内逐个 import 测试文件，因此任何环境都能直接跑。

### 测试覆盖

- `tests/pricing.test.mjs` —— 单价兜底与合并、峰谷边界（含起点不含终点）、周末规则生效日期、跨时区日期/小时分解、金额公式。
- `tests/parse.test.mjs` —— 文件名选版（含 v4 与不设上限的代号）、zstd 多帧扫描与坏帧容错、`(turn, step)` 去重、模型归因优先级、损坏行容错、CRLF。
- `tests/host-route.test.mjs` —— 把插件挂进真实 cordis + 真实 `dsh-host-webserver`，用合成的压缩会话库验证路由、计费数字、配置热更新、信任围栏、卸载时路由释放。

---

## 兼容性

- Node：`^22.19.0 || >=24.0.0`（与 DSH 一致；同步 zstd 解压自 Node 22.19 起可用，缺失时自动退回异步路径）。
- `peerDependencies`：`@deepseek-ai/cordis` ^4.0.4、`@deepseek-ai/dsh-host-webserver` ^0.2.0-rc.1、`@deepseek-ai/schemastery` ^3.18.4。
- 若 DSH 版本升级导致 peer 范围不匹配，插件会在加载时被拦下，需要按提示授予一次版本豁免。

## 许可

MIT
