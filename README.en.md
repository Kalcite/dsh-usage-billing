# dsh-usage-billing

Token usage and billing for **DeepSeek Harness**. It scans DSH session logs, computes token consumption, prices it against a multi-model rate table with peak / off-peak windows, and renders the bill as a dashboard page inside the DSH settings panel.

Ported from the `dsh-launcher-webui` launcher's embedded usage plugin (`server/usage.mjs` + `src/components/UsageCard.tsx`), with two real defects fixed (see [Differences from the original](#differences-from-the-original)).

Zero runtime dependencies: `dependencies` is empty; everything comes from `peerDependencies` supplied by the DSH process.

> 📖 中文文档见 [README.md](./README.md)。

---

## What it gives you

A new section at **Settings → 用量计费** (Usage & Billing):

- **Overview cards** — total cost (peak/off-peak, recomputed live), input / output / cache-read tokens, session count, active days.
- **Token composition** — donut of cache-hit input, uncached input, output, and cache writes, with each bucket's unit price.
- **Peak / off-peak bill** — peak cost, off-peak cost, savings versus an all-peak baseline, peak token share.
- **Per-model breakdown** — tokens and cost per model, priced separately.
- **Last 30 days** — daily bar chart plus a detail table.
- **24-hour distribution** — hour histogram with peak windows highlighted.
- **Date × hour heatmap** — last 30 active dates × 24 hours; peak hours outlined, weekend-flat days green-framed.
- **Year heatmap** — GitHub-style, last 365 days.
- **Session analysis** — sessions sorted by cost, expandable into a per-session donut, peak/off-peak bill, duration, and 24-hour distribution.
- **Scan info** — data directory, logs read, generation distribution (gen 0 / gen 4), compressed bytes, elapsed time.

Every pricing rule (rates, peak windows, weekend rule, timezone) is editable live at **Settings → Plugins → dsh-usage-billing**. Those fields are schemastery `.volatile()` fields, so the Loader persists them into the profile patch and the bill recomputes immediately — no restart.

---

## Install

```bash
dsh plugin --profile web add dsh-usage-billing
```

Substitute the profile you actually run (`dsh plugin --profile desktop add dsh-usage-billing` for the desktop profile). The command installs the package into that profile's `node_modules`, adds it to the profile `package.json` `dependencies`, and — because the package declares `dsh.bundle.patch` — appends it to `dsh.profile.bundles` so its `cordis.patch.yml` is merged at next boot. **No profile file needs manual editing.**

Restart DSH, then open **Settings → 用量计费**.

### From source

```bash
git clone <this repo> dsh-usage-billing
cd dsh-usage-billing
pnpm install
pnpm run build          # emits lib/client.js and lib/*.js
dsh plugin --profile web add "file:$PWD"
```

`lib/` **must be prebuilt and published**: DSH never builds third-party plugin code, and the client module system only serves the existing file named by `exports["./client"]`.

### Verifying the install

```bash
# Host half: should return {"ok":true,...}
curl http://127.0.0.1:3080/usage-billing/health

# Client artifact: should return 200 and a JS body
curl -I 'http://127.0.0.1:3080/plugins/??dsh-usage-billing/client.js&rev=0'
```

The **URL shape matters**: the client module system addresses plugin resources with a
**combo query** (`/plugins/??<id>/client.js&rev=<hash>`), **not** `/plugins/<id>/client.js`.
The latter always 404s — that is a wrong path shape, not a broken plugin. Read the real
URL from the page console:

```js
window.__DSH_BOOT__.entries.find(e => e.id === 'dsh-usage-billing')
```

A CLI report that needs no client-plugin system is also included:

```bash
node bin/usage-report.mjs --port 3080
```

> The client-plugin route is registered by `@deepseek-ai/dsh-client-modules`, which the
> Web profile mounts. If a reduced assembly omits that row, **every** client bundle
> (including DSH's own) 404s and this UI cannot appear; the host half and the CLI report
> above keep working.

---

## Configuration

Every field has a default, so **no configuration is required** (the defaults are DeepSeek's official pricing). To customise, put it in the profile's `cordis.patch.yml`:

```yaml
- id: usage-billing
  name: 'dsh-usage-billing'
  config:
    offPeakMultiplier: 0.5          # off-peak = peak × this factor
    peakSlots:                      # Beijing time, whole hours, start inclusive / end exclusive
      - { start: 9, end: 12 }
      - { start: 14, end: 18 }
    weekendRelax: true              # weekends all-day off-peak
    weekendRelaxFrom: '2026-08-23'  # effective from this date 00:00; empty = always
    # timezone: 'Asia/Shanghai'     # defaults to the host's local zone
    # home: 'C:\Users\you\.dsh'     # session store; defaults to $DSH_HOME
    models:
      deepseek-flash:    { inputPerM: 3, outputPerM: 9,  cacheReadPerM: 0.1, cacheWritePerM: 3 }
      deepseek-v4-pro:   { inputPerM: 9, outputPerM: 27, cacheReadPerM: 0.3, cacheWritePerM: 9 }
      deepseek-v4-flash: { inputPerM: 3, outputPerM: 9,  cacheReadPerM: 0.1, cacheWritePerM: 3 }
      _default:          { inputPerM: 3, outputPerM: 9,  cacheReadPerM: 0.1, cacheWritePerM: 3 }
```

> `ctx.settings` namespaces by Loader **row id** (`usage-billing`), not package name. Saved rates are written back to the `id: usage-billing` row — don't rename that id, or previously saved rates stop matching.

### Default rates

CNY per million tokens, peak price:

| Model id | Input (miss) | Output | Input (hit) | Cache write |
| --- | --- | --- | --- | --- |
| `deepseek-flash` | 3 | 9 | 0.1 | 3 |
| `deepseek-v4-pro` | 9 | 27 | 0.3 | 9 |
| `deepseek-v4-flash` (legacy id) | 3 | 9 | 0.1 | 3 |
| `deepseek-v4-flash-vision-exp` | 3 | 9 | 0.1 | 3 |
| `_default` (fallback) | 3 | 9 | 0.1 | 3 |

`deepseek-flash` is the id in DSH's current model catalog; `deepseek-v4-flash` appears in older session logs. Both are kept, at the same rates. Unlisted models fall back to `_default`.

### Peak / off-peak

- Peak windows default to **09:00–12:00 and 14:00–18:00 Beijing time**, start inclusive, end exclusive.
- Off-peak = peak × `offPeakMultiplier` (default 0.5).
- **Weekends (Sat/Sun) are all-day off-peak** from `weekendRelaxFrom` (default `2026-08-23`) at 00:00; weekends *before* that date still split by window.
- Each **date × hour × model** bucket decides peak/off-peak independently, so usage crossing a window boundary is billed correctly.

```
bucket cost = Σ_models (in×inPerM + out×outPerM + cacheRead×cacheReadPerM + cacheWrite×cacheWritePerM) / 1e6 × multiplier
multiplier  = peak ? 1 : offPeakMultiplier
```

---

## Data source

Session logs live in `$DSH_HOME/sessions/<projectKey>/<sessionId>/`:

- `session.jsonl.zstd` — **generation 0** (legacy)
- `session.v4.jsonl.zstd` — **generation 4** (current)

A session directory can retain several generations; the **highest generation wins** (`.zstd` preferred at equal generation). Each file is a concatenation of **independent, checksummed zstd frames** (that's how DSH appends without rewriting), so there is no frame-length index — frames must be scanned, then decompressed one by one.

Usage is recorded in two shapes:

- **generation 4** — only `assistant/message` → `data.usage`.
- **generation 0** — the `assistant/chunk` row (`data.chunk.type === 'usage'`) *and* the following `assistant/message` row carry **the same** usage.

Model attribution, best first: `data.message.source.model` → nearest `request/context.data.model` → nearest `request/header.data.header.config.model` → `unknown`.

---

## Differences from the original

Two real defects in the launcher's embedded plugin are fixed, plus some hardening. Both fixes are measured, not assumed.

### 1. Legacy logs were counted twice (fixed)

The reference parser decided per line:

```js
if (chunk && chunk.type === 'usage' && chunk.usage) u = chunk.usage;            // assistant/chunk takes this
else if (j?.data?.usage && typeof j.data.usage === 'object') u = j.data.usage;  // its sibling assistant/message takes this
```

So one generation-0 usage record was counted twice. Measured across every generation-0 session on the original machine, **naive / deduped is exactly 2.000**:

| Session | Naive (input) | Deduped (input) | Ratio |
| --- | --- | --- | --- |
| Session 1 | 243,390 | 121,695 | 2.000 |
| Session 2 | 116,520 | 58,260 | 2.000 |
| Session 3 | 161,358 | 80,679 | 2.000 |
| Session 4 | 284,674 | 142,337 | 2.000 |
| Session 5 | 148,340 | 74,170 | 2.000 |

This plugin normalises by **`(turn, step)`**: the last sample for a step wins (`assistant/message` is the final, complete sample). That removes the double count while keeping "a retried attempt settles on its final value".

> Consequence: for historical (generation-0) sessions this plugin reports **lower** cost than the launcher. The lower half is the true usage.

### 2. Current-format (generation 4) logs were missed entirely (fixed)

The reference implementation was written around v0/v1/v2 and never considered v4. On the original machine, **5 of 21 session directories were already `session.v4.jsonl.zstd`** and contributed nothing. This plugin matches the generation without an upper bound and picks the highest.

### 3. Hardening

- **Explicit timezone** — date/weekday/hour are resolved with `Intl.DateTimeFormat` in a named zone instead of `Date#getHours()`. The latter reads the host's local zone, which would make the same log classify peak/off-peak differently on the server and in the browser.
- **Tolerant reads** — one failed frame or a handful of corrupt JSON lines no longer removes a whole session from the statistics.
- **Zero dependencies** — no bundler, no third-party runtime deps; the client artifact is generated by hand in the official format.

> Boundary note: DSH's own `scanZstdFrames` **throws** on an invalid frame header / reserved bit / reserved block type and only recovers a *torn final frame* (`decompressZstdPrefix`). Append-only logs have no mid-file holes, so this plugin matches DSH: mid-file corruption means "unreadable from there on". There is a test for this.

---

## Implementation notes

### Host half (Node)

`src/index.ts` exports `name` / `inject` / `Config` / `apply`. Every `Config` field is `.volatile()`, so it is live-editable and persisted by the Loader. It registers one read-only route:

| Path | Purpose |
| --- | --- |
| `GET /usage-billing/summary` | full aggregate (`?refresh=1` bypasses the 5 s cache) |
| `GET /usage-billing/pricing` | currently effective pricing rule |
| `GET /usage-billing/health` | route and data-directory self-check |

The route is wrapped in a **browser-trust fence** (loopback, or the deployment's `webRuntime.trustedHosts`) so other origins on the LAN can't read local usage. There is no write path at all.

Aggregation uses `date × hour × model` (`byDayHour`) as the only granularity where peak/off-peak and weekend rules can be applied correctly; the browser half recomputes cost from that layer, so changing a rate needs no re-scan.

### Browser half (Web)

`src/client/` is concatenated into `lib/client.js` by `scripts/build-client.mjs`.

DSH's official client bundling preset (`packages/client/tsdown.client.ts`) **is not published to npm**; the official cookbook tells out-of-tree packages to reproduce that build themselves (`docs/cookbook/adding-a-settings-card.md`). This package's browser half is a few modules whose only external is `react` (already shared into the shell's module table), so it uses no bundler: it concatenates the sources and wraps them in the official banner/footer:

```js
window.__ModuleLoader__.load({
  id: "dsh-usage-billing",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    /* sources */
    return module.exports;
  } });
```

The build script statically asserts that every `require()` is answerable by the module table (baseline externals or `dsh.client.external`) and that no cross-plugin `@deepseek-ai/*` **value** import appears.

The browser half contributes its settings section via `ctx.slots.inject('settings.section', …)`, injects only `slots`, and takes all data from its own HTTP route.

---

## Development

```bash
pnpm install
pnpm run typecheck      # tsc --noEmit
pnpm run build:client   # rebuild lib/client.js only
pnpm run build          # client artifact + tsc
pnpm test               # 55 cases, including a real cordis + webserver integration test
pnpm run verify         # tests + client-artifact contract + real session-store reconciliation
```

`pnpm test` deliberately avoids `node --test <dir>`: that runner spawns a child process per test file, which restricted environments (Windows sandbox, some CI tokens) refuse with `spawn EPERM`. The entry point imports the test files in-process instead, so it runs anywhere.

### Coverage

- `tests/pricing.test.mjs` — rate fallback/merge, peak boundaries (inclusive start, exclusive end), weekend effective date, cross-timezone date/hour resolution, cost formulas.
- `tests/parse.test.mjs` — log filename selection (incl. v4 and unbounded generations), multi-frame zstd scanning and corrupt-frame tolerance, `(turn, step)` dedupe, model-attribution priority, corrupt-line tolerance, CRLF.
- `tests/host-route.test.mjs` — mounts the plugin into a real cordis app with the real `dsh-host-webserver` and a synthetic compressed session store, verifying the route, the billed numbers, live config changes, the trust fence, and route release on unload.

---

## Compatibility

- Node `^22.19.0 || >=24.0.0` (matching DSH; synchronous zstd decompression exists from Node 22.19 and the plugin falls back to the async path when absent).
- `peerDependencies`: `@deepseek-ai/cordis` ^4.0.4, `@deepseek-ai/dsh-host-webserver` ^0.2.0-rc.1, `@deepseek-ai/schemastery` ^3.18.4.
- If a DSH upgrade moves outside those peer ranges the plugin is blocked at load until the user grants a per-version exemption.

## License

MIT
