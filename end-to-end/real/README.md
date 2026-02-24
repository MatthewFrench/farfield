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
- `APP_SMOKE_TIMEOUT_MS` (default `120000`) controls per-request smoke timeout for `pnpm smoke:app`.
- `APP_SMOKE_RETRIES` (default `2`) controls retry count per smoke endpoint request.
- `APP_SMOKE_BUDGET_MODE` (`fail` or `warn`, default `fail`) controls smoke latency budget enforcement.
- `APP_SMOKE_BUDGET_HEALTH_MS` (default `5000`) and related `APP_SMOKE_BUDGET_*` variables tune endpoint budgets.

## Commands

```bash
pnpm end-to-end:real:install
pnpm end-to-end:real:run
pnpm end-to-end:real:ui
pnpm end-to-end:real:debug -- --grep "thread"
pnpm verify:end-to-end:real
pnpm stress:stream-burst
```

## Sentinel artifacts

Each scenario writes a signal summary to:

- `.runtime/end-to-end-sentinel/<scenario>.ndjson`
- `.runtime/end-to-end-sentinel/latest.ndjson`

Use this for fast triage while iterating:

```bash
tail -f .runtime/end-to-end-sentinel/latest.ndjson
```

## Manual MCP smoke

For interactive real-app validation in the agent loop, run the scripted MCP flow in:

- `docs/debug/playwright-mcp-smoke.md`

## Coverage matrix

Update `end-to-end/real/coverage-matrix.md` whenever feature-surface behavior changes.

Open gaps must include owner, due date, and tracking issue.

## Governance check

Run governance validation for open-gap policy:

```bash
pnpm validate:end-to-end:governance
```
