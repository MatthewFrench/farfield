# Real App End-to-End

These scenarios validate Farfield against a running real stack.

## State isolation rule

- Real end-to-end scenarios must not mutate pre-existing threads.
- If a scenario needs to send messages, set mode, submit input, or interrupt:
  - create a managed ephemeral thread via `stateGuard.createManagedThread()`
  - run all mutations only on that managed thread
  - allow fixture teardown to archive that managed thread
- Browser-side `POST /api/threads` is disallowed in scenarios. Use `stateGuard.createManagedThread()` instead so cleanup is deterministic.

## Prerequisites

1. Start the app stack:

```bash
pnpm dev
```

2. Ensure baseline runtime health:

```bash
pnpm smoke:app
```

## Runtime env knobs

- `E2E_REAL_BASE_URL` (default `http://127.0.0.1:4312`) controls Playwright UI navigation.
- `E2E_REAL_API_URL` (default `http://127.0.0.1:4311`) controls sentinel API probes.
- `E2E_REAL_API_TOKEN` overrides the API auth token used by sentinel. If unset, sentinel uses `API_TOKEN`, then `APP_SMOKE_TOKEN`, then `PUSH_API_TOKEN`.
- `E2E_REAL_PERFORMANCE_BUDGET_MODE` (`fail` or `warn`, default `fail`) controls real end-to-end readiness/render budget enforcement behavior.
- `APP_SMOKE_TIMEOUT_MS` (default `120000`) controls per-request smoke timeout for `pnpm smoke:app`.
- `APP_SMOKE_RETRIES` (default `2`) controls retry count per smoke endpoint request.
- `APP_SMOKE_BUDGET_MODE` (`fail` or `warn`, default `fail`) controls smoke latency budget enforcement.
- `APP_SMOKE_BUDGET_HEALTH_MS` (default `5000`) and related `APP_SMOKE_BUDGET_*` variables tune endpoint budgets.

## Commands

```bash
pnpm end-to-end:real:install
pnpm end-to-end:real:run
pnpm end-to-end:real:run:webkit
pnpm end-to-end:real:safe-run
pnpm end-to-end:real:mobile-freeze-profile
pnpm end-to-end:real:mobile-freeze-profile:webkit
pnpm end-to-end:real:manual:guard
pnpm end-to-end:real:manual:session
pnpm end-to-end:real:ui
pnpm end-to-end:real:debug -- --grep "thread"
pnpm end-to-end:real:debug:webkit -- --grep "mobile sidebar"
pnpm verify:end-to-end:real
pnpm stress:stream-burst
```

`pnpm end-to-end:real:safe-run` captures pre/post thread snapshots under `.runtime/end-to-end-sentinel/` and fails if any pre-existing thread disappears during the run.

Unexpected signal enforcement:

- Real-app fixture sentinel now asserts `assertNoUnexpectedSignals()` automatically for passing scenarios.
- Scenarios that intentionally induce errors (for example error-banner behavior checks) must explicitly opt out with `test.use({ enforceUnexpectedSignals: false })` and assert expected behavior directly.

## Sentinel artifacts

Each scenario writes a signal summary to:

- `.runtime/end-to-end-sentinel/<scenario>.ndjson`
- `.runtime/end-to-end-sentinel/latest.ndjson`
- when `E2E_REAL_OUTPUT_PROFILE` is set, the same files are written under `.runtime/end-to-end-sentinel/<profile>/`

Use this for fast triage while iterating:

```bash
tail -f .runtime/end-to-end-sentinel/latest.ndjson
```

Freeze-profile artifacts are written to:

- `.runtime/end-to-end-performance/<label>.json`
- `.runtime/end-to-end-performance/latest.json`
- when `E2E_REAL_OUTPUT_PROFILE` is set, the same files are written under `.runtime/end-to-end-performance/<profile>/`

Stable-mode convenience:

```bash
bun run dev:stable
bun run end-to-end:real:mobile-soak:stable
```

Use the dedicated mobile freeze run for repeated sidebar open/close profiling:

```bash
pnpm end-to-end:real:mobile-freeze-profile
```

Safari-like mobile automation is available through Playwright WebKit with an iPhone device profile:

```bash
pnpm end-to-end:real:run:webkit
pnpm end-to-end:real:mobile-freeze-profile:webkit
pnpm end-to-end:real:debug:webkit -- --grep "mobile sidebar"
```

Use the default Chromium mobile profile for fast iteration and the WebKit path when you need a closer Safari-like signal before moving to iOS Simulator or a real device.

Runtime knobs for the mobile freeze profile:

- `E2E_REAL_MOBILE_SIDEBAR_PROFILE_ITERATIONS` (default `16`)
- `E2E_REAL_MOBILE_SIDEBAR_READY_BUDGET_MS` (default `12000`)
- `E2E_REAL_MOBILE_SIDEBAR_MAX_FREEZE_COUNT` (default `20`)
- `E2E_REAL_MOBILE_SIDEBAR_MAX_FREEZE_DURATION_MS` (default `600`)
- `E2E_REAL_MOBILE_SIDEBAR_MAX_TOTAL_FREEZE_DURATION_MS` (default `2500`)
- `E2E_REAL_MOBILE_SIDEBAR_MAX_LONG_TASK_DURATION_MS` (default `400`)

For a full workflow and live mobile investigation notes, see:

- `docs/debug/mobile-freeze-profiling.md`

## Manual MCP smoke

For interactive real-app validation in the agent loop, run the scripted MCP flow in:

- `docs/debug/playwright-mcp-smoke.md`

Fast bootstrap for manual MCP sessions (reuse a healthy runtime when available; otherwise start runtime, then run smoke baseline and live guard):

```bash
pnpm end-to-end:real:manual:session
```

Manual session runtime knobs:

- `PLAYWRIGHT_MANUAL_SESSION_HEALTH_TIMEOUT_MS` (default `120000`)
- `PLAYWRIGHT_MANUAL_SESSION_HEALTH_POLL_MS` (default `1000`)
- `PLAYWRIGHT_MANUAL_SESSION_SHUTDOWN_GRACE_MS` (default `5000`)
- `PLAYWRIGHT_MANUAL_SESSION_SMOKE_ATTEMPTS` (default `3`)
- `PLAYWRIGHT_MANUAL_SESSION_SMOKE_RETRY_DELAY_MS` (default `1500`)

If you start runtime manually instead of the session bootstrap command, run this in a second terminal while MCP browser actions are in progress:

```bash
pnpm end-to-end:real:manual:guard
```

Manual guard runtime knobs:

- `PLAYWRIGHT_MANUAL_GUARD_DURATION_SECONDS` (`0` means run continuously until Ctrl+C)
- `PLAYWRIGHT_MANUAL_GUARD_POLL_MS` (poll interval, default `2000`)
- `PLAYWRIGHT_MANUAL_GUARD_BUDGET_MODE` (`fail` or `warn`, default `fail`)
- `PLAYWRIGHT_MANUAL_GUARD_BUDGET_WARMUP_SECONDS` (default `8`)
- `PLAYWRIGHT_MANUAL_GUARD_MAX_FETCH_FAILURES` (default `3`)
- `PLAYWRIGHT_MANUAL_GUARD_ROUTE_LAST_DURATION_MS` (default `3000`)
- `PLAYWRIGHT_MANUAL_GUARD_ROUTE_LAST_QUEUE_DELAY_MS` (default `300`)
- `PLAYWRIGHT_MANUAL_GUARD_EVENT_LOOP_LAST_LAG_MS` (default `80`)

Stress mode runtime knobs:

- `CI_STRESS_GUARD_DURATION_SECONDS` (default `120`)
- `CI_STRESS_SAFE_RUN_PERFORMANCE_BUDGET_MODE` (`warn` or `fail`, default `warn`)

## Coverage matrix

Update `end-to-end/real/coverage-matrix.md` whenever feature-surface behavior changes.

Open gaps must include owner, due date, and tracking issue.

## Governance check

Run governance validation for open-gap policy:

```bash
pnpm validate:end-to-end:governance
```
