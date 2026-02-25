# Startup Latency Runbook

Use this runbook when frontend startup shows `startup-critical.*` or `runtime-request-error` banners, or when startup/load Playwright scenarios are slow/flaky.

## Signals to check first

1. `GET /api/debug/observability`
2. `GET /api/debug/history?limit=120`
3. `GET /api/health`
4. Startup request telemetry under `snapshot.performance.requestRouting.startupRequestTimings`
5. Request lifecycle timeline under `snapshot.performance.requestRouting.requestLifecycleEvents`

## Fast triage flow

1. Reproduce once with real end-to-end scenario:
   - `bun run end-to-end:real:run -- --grep "startup"`
2. Query observability snapshot:
   - `curl -sS http://127.0.0.1:4311/api/debug/observability | jq`
3. Inspect:
   - `snapshot.performance.eventLoop.p95LagMs`
   - `snapshot.performance.requestRouting.routeTimings[]` sorted by `p95DurationMs`
   - `snapshot.performance.requestRouting.startupRequestTimings[]`
   - `snapshot.performance.requestRouting.requestLifecycleEvents[]` for `started` and `completed` request events
4. Inspect history payload pressure:
   - `curl -sS "http://127.0.0.1:4311/api/debug/history?limit=120" | jq '.history | length'`

## Request timeline readouts

Use these to correlate every request start and completion with timing and status.

1. Last 80 lifecycle events:
   - `curl -sS http://127.0.0.1:4311/api/debug/observability | jq '.snapshot.performance.requestRouting.requestLifecycleEvents | .[-80:]'`
2. Last 40 completed events with route, status, duration, and action:
   - `curl -sS http://127.0.0.1:4311/api/debug/observability | jq -r '.snapshot.performance.requestRouting.requestLifecycleEvents | map(select(.phase=="completed")) | .[-40:][] | "\(.completedAt) \(.method) \(.pathname) status=\(.statusCode) durationMs=\(.durationMs) queueDelayMs=\(.queueDelayMs) action=\(.actionName // "-") requestId=\(.requestId)"'`
3. Highest-latency completed requests in current window:
   - `curl -sS http://127.0.0.1:4311/api/debug/observability | jq -r '.snapshot.performance.requestRouting.requestLifecycleEvents | map(select(.phase=="completed")) | sort_by(.durationMs) | reverse | .[:20][] | "\(.durationMs)ms \(.method) \(.pathname) status=\(.statusCode) action=\(.actionName // "-") requestId=\(.requestId)"'`

## Interpretation guide

- High `eventLoop.p95LagMs` with broad route slowdowns:
  - Runtime scheduling pressure is likely dominating.
- Route-specific high p95 with low event-loop lag:
  - Isolated route owner or downstream dependency latency.
- Startup timing out on `startup-critical.events-session`:
  - Session/bootstrap path blocked by runtime pressure or auth path issue.
- Startup timing out on `startup-critical.threads.active`:
  - Thread-list owner/adapter path is bottleneck.

## CPU profiling (Node idiomatic)

Use built-in V8 CPU profiles and correlate profile timestamps with request lifecycle events.

1. Run server with CPU profiling enabled:
   - `NODE_OPTIONS="--cpu-prof --cpu-prof-dir=.runtime/profiles --cpu-prof-name=farfield.cpuprofile" bun run --cwd apps/ServerApplication dev`
2. Reproduce the slow flow, then stop the server cleanly.
3. Open `.runtime/profiles/farfield.cpuprofile` in Chrome DevTools Performance panel.
4. Correlate hot spans with request IDs/actions from:
   - `snapshot.performance.requestRouting.requestLifecycleEvents[]`
5. On macOS, capture a fast point-in-time sample for active PID:
   - `sample <pid> 5 -file .runtime/server-cpu-sample.txt`

## Known stabilizers in this repo

- Startup split keeps only critical requests on initial blocking path.
- Deferred startup requests run isolated (`allSettled`) and do not block startup completion.
- Activity history list payloads are size-bounded to avoid oversized debug-history responses.
- Runtime observability includes route timing percentiles and event-loop lag.

## Regression checks before merge

1. `bun run test:ci:mocked`
2. `bun run --cwd apps/WebApplication typecheck`
3. `bun run --cwd apps/ServerApplication typecheck`
4. `bun run end-to-end:real:run -- --grep "startup"`
