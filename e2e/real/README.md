# Real App E2E

These scenarios validate Farfield against a running real stack.

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
pnpm e2e:real:install
pnpm e2e:real:run
pnpm e2e:real:ui
pnpm e2e:real:debug -- --grep "thread"
pnpm verify:real
pnpm stress:stream-burst
```

## Sentinel artifacts

Each scenario writes a signal summary to:

- `.runtime/e2e-sentinel/<scenario>.ndjson`
- `.runtime/e2e-sentinel/latest.ndjson`

Use this for fast triage while iterating:

```bash
tail -f .runtime/e2e-sentinel/latest.ndjson
```

## Manual MCP smoke

For interactive real-app validation in the agent loop, run the scripted MCP flow in:

- `docs/debug/playwright-mcp-smoke.md`

## Coverage matrix

Update `e2e/real/coverage-matrix.md` whenever feature-surface behavior changes.

Open gaps must include owner, due date, and tracking issue.
