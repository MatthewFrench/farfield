# Mobile Freeze Baseline Log

This document records the mobile-freeze baselines and follow-up improvements for Farfield.

Use it as the durable history for:

1. the exact command that was run
2. the commit under test
3. the generated artifact path
4. the measured freeze and latency metrics
5. the most likely hotspots or user-visible issues

## Update Protocol

For every meaningful profiling run, append a new dated entry with:

1. date
2. commit
3. scenario
4. browser/engine
5. viewport or device profile
6. iteration count
7. artifact path
8. key metrics
9. top overlapping operations
10. conclusions and follow-up

Do not overwrite earlier entries. Improvements should be documented as new entries so regression and improvement trends stay visible.

## 2026-03-06 Baseline

Commit under test:

1. `16fc837` `Allow real-app profile env overrides`

Commands used:

```bash
bun run smoke:app
bun run end-to-end:real:mobile-freeze-profile
bun run end-to-end:real:mobile-freeze-profile:webkit
```

Notes:

1. The mobile sidebar profile was the primary repeated regression scenario.
2. The thread-open flow was also spot-checked with direct mobile probes to compare sidebar-open cost against thread-selection cost.
3. Browser-specific artifacts are now separate so Chromium and WebKit results can be compared directly.

### Chromium Mobile Sidebar Repeated Profile

Artifact:

1. `.runtime/end-to-end-performance/browser-mobile-sidebar-freeze-profile.json`

Observed metrics:

1. Iterations observed: `16`
2. Max sidebar iteration readiness: `4945ms`
3. Freeze count: `65`
4. Total freeze duration: `13100ms`
5. Max freeze duration: `651ms`
6. Long-task count: `83`
7. Total long-task duration: `12389ms`
8. Max long-task duration: `388ms`

Top overlapping operations:

1. `http-request` total overlap `21366ms`, max single overlap `1015ms`
2. `thread-list-presentation-worker-roundtrip` total overlap `234ms`, max `234ms`

Most expensive repeated request paths during the loop:

1. `/api/threads?limit=80&archived=false&all=true&maxPages=20&sortKey=updated_at`
   - count `25`
   - total `11146ms`
   - max `1015ms`
2. `/api/agents`
   - count `25`
   - total `4332ms`
   - max `773ms`
3. `/api/health`
   - count `25`
   - total `4328ms`
   - max `773ms`

Interpretation:

1. Mobile sidebar open/close on Chromium is bad enough to fail the current freeze budget by a wide margin.
2. The path is dominated by repeated background request traffic rather than worker cost.
3. The sidebar interaction appears to be competing with generic core-refresh activity, especially repeated `/api/threads`, `/api/agents`, and `/api/health` requests.
4. The worst Chromium freeze windows frequently overlap long tasks, which points to main-thread render or response-processing work in addition to raw network latency.

### WebKit Mobile Sidebar Repeated Profile

Artifact:

1. `.runtime/end-to-end-performance/webkit-mobile-sidebar-freeze-profile.json`

Observed metrics:

1. Iterations observed: `16`
2. Max sidebar iteration readiness: `14466ms`
3. Freeze count: `8`
4. Total freeze duration: `17512ms`
5. Max freeze duration: `11536ms`
6. Long-task count: `0`
7. Total long-task duration: `0ms`
8. Max long-task duration: `0ms`

Top overlapping operations:

1. `http-request` total overlap `61800ms`, max single overlap `15450ms`

Most expensive overlapping request paths:

1. `/api/account/rate-limits?agentId=codex`
   - duration `15450ms`
2. `/api/apps?limit=100`
   - duration `15450ms`

Interpretation:

1. WebKit mobile sidebar behavior is worse than Chromium in worst-case user-visible stall duration.
2. The largest freeze window is an `11536ms` stall, which is catastrophic from a user perspective.
3. The dominant WebKit issue is not long-task reporting; it is extremely slow sidebar-runtime-summary request work overlapping the interaction window.
4. Sidebar runtime summary hydration looks too expensive to tie closely to mobile sidebar-open behavior.

### Mobile Thread Selection Spot Check

These were direct one-off live probes, not repeated artifact-backed scenario runs.

Chromium mobile direct thread-open probe:

1. Thread count visible in sidebar: `41`
2. Selection/open elapsed: `1915ms`
3. Freeze count: `2`
4. Max freeze duration: `151ms`
5. Long-task count: `4`
6. Max long-task duration: `140ms`
7. Dominant request:
   - `/api/threads/<threadId>?includeTurns=true` about `525ms`

WebKit mobile direct thread-open probe:

1. Thread count visible in sidebar: `40`
2. Selection/open elapsed: `2382ms`
3. Freeze count: `0`
4. Long-task count: `0`
5. Dominant request:
   - `/api/threads/<threadId>?includeTurns=true` about `373ms`

Interpretation:

1. Thread selection/open is materially better than repeated mobile sidebar opening.
2. The sidebar path is the primary regression hotspot right now.

## Baseline Conclusions

As of 2026-03-06:

1. The mobile sidebar is the worst current mobile interaction path.
2. Chromium mobile shows many medium freezes plus heavy long-task activity.
3. WebKit mobile shows fewer but much larger stalls, dominated by very slow sidebar-runtime-summary requests.
4. Thread selection/open is not good, but it is substantially less pathological than sidebar open/close.

## Recommended Improvement Targets

1. Stop doing duplicate sidebar work on mobile layouts.
2. Reduce or scope background core refresh traffic during mobile sidebar interaction.
3. Decouple or cache sidebar runtime-summary requests, especially account rate limits and app listing.
4. After each fix, rerun both:
   - `browser-mobile-sidebar-freeze-profile`
   - `webkit-mobile-sidebar-freeze-profile`

## 2026-03-06 Follow-Up: Single Active Sidebar Viewport

Change under test:

1. Working tree change after `16fc837`
2. Mobile layout now renders only the active sidebar viewport instead of mounting both desktop and mobile sidebar trees simultaneously.

Commands used:

```bash
E2E_REAL_PERFORMANCE_BUDGET_MODE=warn bun run end-to-end:real:mobile-freeze-profile
E2E_REAL_PERFORMANCE_BUDGET_MODE=warn bun run end-to-end:real:mobile-freeze-profile:webkit
```

### Chromium Mobile Sidebar Repeated Profile After Fix

Artifact:

1. `.runtime/end-to-end-performance/browser-mobile-sidebar-freeze-profile.json`

Observed metrics:

1. Iterations observed: `16`
2. Max sidebar iteration readiness: `3504ms`
3. Freeze count: `11`
4. Total freeze duration: `2602ms`
5. Max freeze duration: `683ms`
6. Max long-task duration: `402ms`

Top request paths after fix:

1. `/api/threads?limit=80&archived=false&all=true&maxPages=20&sortKey=updated_at`
   - count `10`
   - total `2951ms`
   - max `956ms`
2. `/api/agents`
   - count `12`
   - total `1588ms`
   - max `256ms`
3. `/api/health`
   - count `12`
   - total `1583ms`
   - max `256ms`

Change from baseline:

1. Freeze count improved from `65` to `11`
2. Total freeze duration improved from `13100ms` to `2602ms`
3. Max sidebar iteration improved from `4945ms` to `3504ms`
4. `/api/threads` total time improved from `11146ms` to `2951ms`
5. `/api/agents` total time improved from `4332ms` to `1588ms`
6. `/api/health` total time improved from `4328ms` to `1583ms`

Interpretation:

1. Rendering only one sidebar tree on mobile materially improved the Chromium path.
2. The mobile sidebar is still not good, but it is substantially less pathological.
3. Background core refresh traffic remains a visible cost center.

### WebKit Mobile Sidebar Repeated Profile After Fix

Artifact:

1. `.runtime/end-to-end-performance/webkit-mobile-sidebar-freeze-profile.json`

Observed metrics:

1. Iterations observed: `16`
2. Max sidebar iteration readiness: `6682ms`
3. Freeze count: `2`
4. Total freeze duration: `5653ms`
5. Max freeze duration: `5268ms`
6. Max long-task duration: `0ms`

Top request paths after fix:

1. `/api/apps?limit=100`
   - count `1`
   - total `1828ms`
   - max `1828ms`
2. `/api/account/rate-limits?agentId=codex`
   - count `1`
   - total `1744ms`
   - max `1744ms`
3. `/api/threads?limit=80&archived=false&all=true&maxPages=20&sortKey=updated_at`
   - count `7`
   - total `1480ms`
   - max `564ms`

Change from baseline:

1. Freeze count improved from `8` to `2`
2. Total freeze duration improved from `17512ms` to `5653ms`
3. Max freeze duration improved from `11536ms` to `5268ms`
4. Max sidebar iteration improved from `14466ms` to `6682ms`

Interpretation:

1. The single-viewport render change helped WebKit substantially too.
2. WebKit is still worse than Chromium for worst-case sidebar stall duration.
3. The dominant remaining WebKit hotspot is sidebar runtime summary work, especially apps and account rate-limit fetches.

## 2026-03-06 Follow-Up: Sidebar Visibility Gating And Deferred Refresh Throttling

Changes under test:

1. Cache and visibility-gate the network-derived sidebar runtime summary slices.
2. Keep the thread list visually `ready` while cached rows are shown during background core refresh.
3. Throttle deferred thread-list revalidation after cached core-data reads.

Commands used:

```bash
E2E_REAL_PERFORMANCE_BUDGET_MODE=warn bun run end-to-end:real:mobile-freeze-profile
E2E_REAL_PERFORMANCE_BUDGET_MODE=warn bun run end-to-end:real:mobile-freeze-profile:webkit
```

### Chromium Mobile Sidebar Repeated Profile After Change

Artifact:

1. `.runtime/end-to-end-performance/browser-mobile-sidebar-freeze-profile.json`

Observed metrics:

1. Iterations observed: `16`
2. Freeze count: `20`
3. Total freeze duration: `6184ms`
4. Max freeze duration: `668ms`
5. Max long-task duration: `399ms`

Top request paths:

1. `/api/threads?limit=80&archived=false&all=true&maxPages=20&sortKey=updated_at`
   - count `19`
   - total `7126ms`
   - max `1309ms`
2. `/api/notifications/events?limit=80&agentId=codex`
   - count `1`
   - total `87ms`
3. `/api/health`
   - count `1`
   - total `85ms`

Interpretation:

1. The request mix is much cleaner than the original baseline and the earlier single-viewport rerun.
2. Chromium still is not acceptable, but the remaining dominant cost is now clearly `/api/threads`.
3. Health, agents, apps, and account rate-limit traffic are no longer the main Chromium problem during sidebar interaction.
4. This strengthens the case for a cheaper thread-list change-detection path or a more aggressive client-side thread-list freshness policy.

### WebKit Mobile Sidebar Repeated Profile After Change

Artifact:

1. `.runtime/end-to-end-performance/webkit-mobile-sidebar-freeze-profile.json`

Observed metrics:

1. Iterations observed: `16`
2. Freeze count: `2`
3. Total freeze duration: `5098ms`
4. Max freeze duration: `4296ms`
5. Max long-task duration: `0ms`
6. Max sidebar iteration readiness: `6012ms`

Top request paths:

1. `/api/threads?limit=80&archived=false&all=true&maxPages=20&sortKey=updated_at`
   - count `5`
   - total `853ms`
   - max `411ms`
2. `/api/apps?limit=100`
   - count `1`
   - total `372ms`
3. `/api/account/rate-limits?agentId=codex`
   - count `1`
   - total `290ms`

Interpretation:

1. The sidebar runtime summary traffic is much less severe than the original WebKit baseline.
2. WebKit still has large freeze windows, but the apps and rate-limit requests are no longer the catastrophic 15s-scale events seen in the first baseline.
3. As with Chromium, the remaining dominant work is now the thread-list path itself.

## 2026-03-06 Follow-Up: Longer Thread-List Cache TTLs

Changes under test:

1. Increase the web thread-list query cache TTL from `1.5s` to `15s`.
2. Increase the server thread-list aggregation cache TTL from `2s` to `15s`.

Command used:

```bash
E2E_REAL_PERFORMANCE_BUDGET_MODE=warn bun run end-to-end:real:mobile-freeze-profile
```

### Chromium Mobile Sidebar Repeated Profile After TTL Increase

Artifact:

1. `.runtime/end-to-end-performance/browser-mobile-sidebar-freeze-profile.json`

Observed metrics:

1. Iterations observed: `16`
2. Freeze count: `5`
3. Total freeze duration: `1266ms`
4. Max freeze duration: `683ms`
5. Total long-task duration: `4555ms`
6. Max long-task duration: `391ms`

Top request paths:

1. `/api/threads?limit=80&archived=false&all=true&maxPages=20&sortKey=updated_at`
   - count `19`
   - total `7126ms`
   - max `1309ms`
2. `/api/notifications/events?limit=80&agentId=codex`
   - count `1`
   - total `87ms`
3. `/api/health`
   - count `1`
   - total `85ms`

Change from the previous Chromium follow-up:

1. Freeze count improved from `20` to `5`
2. Total freeze duration improved from `6184ms` to `1266ms`
3. Total long-task duration improved from `9117ms` to `4555ms`

Interpretation:

1. Longer thread-list cache TTLs reduced the number of user-visible sidebar freezes substantially on Chromium.
2. The dominant remaining cost is still the thread-list path itself, but it now appears far less often as a user-visible stall.
3. The next structural step should be a cheaper thread-list change-detection path so even the remaining `/api/threads` work can be reduced.

## 2026-03-06 Follow-Up: Farfield Sidebar Sync Endpoint

Changes under test:

1. Add Farfield-owned `POST /api/sidebar/threads/sync`.
2. Switch the web thread-list owner to use sidebar sync instead of `/api/threads` for normal sidebar refresh.
3. Use deterministic `snapshotVersion` matching for `notModified`.
4. Add a dedicated bounded sidebar snapshot cache with mutation-driven invalidation.

Commands used:

```bash
bun run smoke:app
E2E_REAL_PERFORMANCE_BUDGET_MODE=warn bun run end-to-end:real:mobile-freeze-profile
E2E_REAL_PERFORMANCE_BUDGET_MODE=warn bun run end-to-end:real:mobile-freeze-profile:webkit
node scripts/tooling/with-env.mjs "bun run --filter @farfield/protocol build && bunx playwright test -c playwright.real.config.ts end-to-end/real/scenarios/thread-open.spec.ts"
```

### Chromium Mobile Sidebar Repeated Profile After Sidebar Sync Migration

Artifact:

1. `.runtime/end-to-end-performance/browser-mobile-sidebar-freeze-profile.json`

Observed metrics:

1. Iterations observed: `16`
2. Freeze count: `14`
3. Total freeze duration: `4153ms`
4. Max freeze duration: `684ms`
5. Long-task count: `102`
6. Total long-task duration: `8715ms`
7. Max long-task duration: `400ms`

Observed request mix:

1. `/api/sidebar/threads/sync`
   - count `21`
   - top single observed duration about `801ms`
2. `/api/apps?limit=100`
   - count `1`
3. `/api/account/rate-limits?agentId=codex`
   - count `1`
4. `/api/account?agentId=codex`
   - count `1`
5. `/api/health`
   - count `1`

Interpretation:

1. The sidebar loop no longer pays the generic `/api/threads` route cost.
2. The remaining Chromium issue is repeated sidebar sync request activity plus render churn around sidebar open.
3. This follow-up is a route-ownership win, but it is not yet a pure performance win compared with the earlier Chromium TTL-only run.

### WebKit Mobile Sidebar Repeated Profile After Sidebar Sync Migration

Artifact:

1. `.runtime/end-to-end-performance/webkit-mobile-sidebar-freeze-profile.json`

Observed metrics:

1. Iterations observed: `16`
2. Freeze count: `15`
3. Total freeze duration: `37352ms`
4. Max freeze duration: `7368ms`
5. Long-task count: `0`
6. Total long-task duration: `0ms`

Observed request mix:

1. `/api/sidebar/threads/sync`
   - count `33`
   - top observed durations about `8724ms`, `8635ms`, and `8000ms`
2. `/api/health`
   - count `2`
3. `/api/notifications/events?limit=80&agentId=codex`
   - count `1`

Interpretation:

1. The data-path migration succeeded on WebKit too: `/api/threads` is out of the sidebar loop.
2. WebKit is still catastrophically bad, but the remaining problem is now concentrated in `/api/sidebar/threads/sync` request behavior rather than generic thread-list payload breadth.
3. Because direct shell timing for the new endpoint is fast, the next investigation should focus on browser-side request behavior, duplicate sync scheduling, or render churn rather than raw server data retrieval cost.

### Direct Endpoint Benchmark

Direct authenticated shell timing against the live Farfield server:

1. Cold `/api/sidebar/threads/sync` snapshot response: about `236ms`
2. `notModified` response with matching `snapshotVersion`: about `2ms`
3. Warm cached snapshot response with `knownSnapshotVersion: null`: about `2ms`

Interpretation:

1. The server-side sidebar sync path is cheap when measured directly.
2. The remaining browser-side freezes are not explained by the server still pulling or returning full thread payloads.

### Thread-Open Scenario Spot Check After Sidebar Sync Migration

Observed result:

1. Scenario passed.
2. `thread-open-behavior` reported:
   - `lcp=7848ms`
   - `cls=0.1582`
   - `longTasks=9`
   - `longTaskDurationMs=1369`

Interpretation:

1. Thread open is currently healthier than the repeated sidebar loop because it passed its scenario budgets.
2. It still is not especially fast, and the LCP readout is worth watching while sidebar work continues.

## 2026-03-06 Follow-Up: Retained Sidebar Baselines And Runtime-Summary Single-Flight

Changes under test:

1. Keep invalidated thread-list cache entries as stale retained baselines instead of deleting them.
2. Keep persisted thread-list snapshots available across active and archived invalidation.
3. Add capability-aware single-flight dedupe for sidebar runtime summary network reads.
4. Reuse one process-lifetime sidebar runtime summary cache owner so remount churn does not duplicate `/api/apps` and `/api/account/*` requests.

Commands used:

```bash
bun run test -- Tests/ThreadQueryCache.test.ts Tests/ThreadOwnership.test.ts Tests/UseCoreDataLoaders.test.tsx
bun run test -- Tests/ThreadSidebarRuntimeSummaryNetworkCacheOwner.test.ts Tests/UseCoreDataLoaders.test.tsx
E2E_REAL_PERFORMANCE_BUDGET_MODE=warn bun run end-to-end:real:mobile-freeze-profile
E2E_REAL_PERFORMANCE_BUDGET_MODE=warn bun run end-to-end:real:mobile-freeze-profile:webkit
```

### Chromium Mobile Sidebar Repeated Profile After Baseline Retention And Single-Flight

Artifact:

1. `.runtime/end-to-end-performance/browser-mobile-sidebar-freeze-profile.json`

Observed metrics:

1. Iterations observed: `16`
2. Freeze count: `4`
3. Total freeze duration: `1201ms`
4. Max freeze duration: `684ms`
5. Total long-task duration: `5477ms`
6. Max long-task duration: `409ms`
7. LCP: `1080ms`

Observed request mix:

1. `/api/sidebar/threads/sync`
   - count `1`
   - duration about `429ms`
2. `/api/apps?limit=100`
   - count `1`
   - duration about `462ms`
3. `/api/account/rate-limits?agentId=codex`
   - count `1`
   - duration about `380ms`
4. `/api/account?agentId=codex`
   - count `1`
   - duration about `147ms`
5. `/api/health`
   - count `1`
6. `/api/notifications/events?limit=80&agentId=codex`
   - count `1`

Change from the previous sidebar-sync follow-up:

1. Freeze count improved from `14` to `4`
2. Total freeze duration improved from `4153ms` to `1201ms`
3. `/api/sidebar/threads/sync` request count improved from `21` to `1`
4. `/api/apps`, `/api/account`, and `/api/account/rate-limits` each improved from `2` requests to `1`

Interpretation:

1. Preserving stale baselines after invalidation was the right move for the sidebar.
2. The app now keeps enough sidebar state to make the sync endpoint cheap in practice, not just in theory.
3. Chromium is now close to passing the current freeze budget; the remaining failures are one max-freeze outlier and one max-long-task outlier.

### WebKit Mobile Sidebar Repeated Profile After Baseline Retention And Single-Flight

Artifact:

1. `.runtime/end-to-end-performance/webkit-mobile-sidebar-freeze-profile.json`

Observed metrics:

1. Iterations observed: `16`
2. Freeze count: `4`
3. Total freeze duration: `3911ms`
4. Max freeze duration: `3404ms`
5. Long-task count: `0`
6. Total long-task duration: `0ms`
7. LCP: `1302ms`

Observed request mix:

1. `/api/sidebar/threads/sync`
   - count `1`
   - duration about `430ms`
2. `/api/apps?limit=100`
   - count `1`
   - duration about `428ms`
3. `/api/account/rate-limits?agentId=codex`
   - count `1`
   - duration about `335ms`
4. `/api/account?agentId=codex`
   - count `1`
   - duration about `86ms`
5. `/api/notifications/events?limit=80&agentId=codex`
   - count `1`
6. `/api/health`
   - count `1`

Change from the previous sidebar-sync follow-up:

1. Freeze count improved from `15` to `4`
2. Total freeze duration improved from `37352ms` to `3911ms`
3. Max freeze duration improved from `7368ms` to `3404ms`
4. `/api/sidebar/threads/sync` request count improved from `33` to `1`
5. `/api/apps`, `/api/account`, and `/api/account/rate-limits` each improved from `2` requests to `1`

Interpretation:

1. The duplicate sidebar work is now largely gone on WebKit too.
2. The remaining WebKit problem is no longer repeated app work; it is a smaller number of larger browser-visible stalls.
3. The next high-value investigation should target the remaining commit or animation churn around sidebar open rather than broad request duplication.
