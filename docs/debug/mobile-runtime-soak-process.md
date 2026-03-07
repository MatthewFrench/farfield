# Mobile Runtime Soak Process

This document defines the current AI-followable soak workflow for runtime-sensitive Farfield web changes.

Use this when changing any of these areas:

1. thread selection or thread opening
2. sidebar visibility or sidebar refresh behavior
3. chat message send, reload, or readback behavior
4. selected-thread refresh, synchronization, or materialization behavior
5. mobile interaction flows where freezes or stale state are plausible

## Goal

Catch runtime issues through one bounded real-app scenario that:

1. exercises multiple user-visible paths in one run
2. keeps all mutations isolated to one managed test thread
3. records sentinel and freeze artifacts on every run
4. fails with a concrete first broken behavior instead of vague manual impressions

## Real Path Rule

This soak is intended to validate the real product path.

Required constraints:

1. real Farfield server endpoints
2. real browser rendering
3. real thread data and real persistence behavior
4. no Playwright route stubbing for product API endpoints inside the soak scenario

Allowed exceptions:

1. managed-thread creation and managed-thread seed messages may use the real API request context owned by the state-isolation fixture
2. sentinel and performance probes may observe the runtime, but they must not replace product behavior

## Command

### Orchestrator AI Mode

Primary mode:

1. tell the orchestrator AI to run the multi-agent soak process
2. let the orchestrator spawn:
   - browser runner
   - signal watcher
   - request watcher
   - repair worker when needed

### Direct Soak Commands

Chromium mobile:

```bash
E2E_REAL_PERFORMANCE_BUDGET_MODE=warn bun run end-to-end:real:mobile-soak
```

WebKit mobile:

```bash
E2E_REAL_PERFORMANCE_BUDGET_MODE=warn bun run end-to-end:real:mobile-soak:webkit
```

Use `warn` during iteration so behavior failures remain visible without letting one performance outlier hide the first broken workflow step.

### Optional Local Bootstrap Mode

Optional local shell bootstrap:

```bash
bun run end-to-end:real:mobile-soak:bootstrap -- --engine both --repeat 2
```

What it does:

1. optionally runs `bun run smoke:app`
2. runs repeated Chromium and/or WebKit soak commands
3. preserves the real-path rule
4. prints the latest artifact paths at the end

What it does not do:

1. it does not spawn AI subagents
2. it does not replace orchestrator analysis
3. it does not interpret failures for you

Use bootstrap mode when you want repeatable local execution from the shell.
Use orchestrator mode when you want coordinated analysis and repair.

Current default budgets:

1. max startup readiness: `20000ms`
2. max cold iteration readiness: `28000ms`
3. max warm iteration readiness: `16000ms`
4. max freeze count: `4`
5. max freeze duration: `300ms`
6. max total freeze duration: `600ms`
7. max long task duration: `250ms`
8. max request-error increase: `0`
9. max route last duration: `3000ms`
10. max route last queue delay: `300ms`

## What The Soak Exercises

The scenario lives at:

- [mobile-soak.spec.ts](/Users/matthewfrench/GitHub/farfield/end-to-end/real/scenarios/mobile-soak.spec.ts)

The current loop does this:

1. starts from a healthy real stack
2. opens the mobile app shell and waits for thread list and chat surface settlement
3. creates one managed isolated test thread through the state-isolation owner
4. seeds that managed thread with an initial message through the isolation owner
5. refreshes the shell so sidebar state can surface the managed thread
6. browses a small number of existing threads without mutating them
7. opens the managed thread from the sidebar
8. sends one real UI message on that managed thread
9. reloads the page
10. verifies the same managed thread and sent message are still visible
11. records freeze-profile output and sentinel output for the whole run

The state-isolation owner lives at:

- [state-isolation.ts](/Users/matthewfrench/GitHub/farfield/end-to-end/real/helpers/state-isolation.ts)

## Artifacts To Inspect

Sentinel:

- `.runtime/end-to-end-sentinel/latest.ndjson`
- `.runtime/end-to-end-sentinel/<scenario>.ndjson`

Freeze and performance:

- `.runtime/end-to-end-performance/latest.json`
- `.runtime/end-to-end-performance/<label>.json`

Playwright failure context:

- `test-results/real-app/<scenario>/error-context.md`
- `test-results/real-app/<scenario>/trace.zip`
- `test-results/real-app/<scenario>/video.webm`

## Triage Order For AI

When the soak fails, use this order:

1. Read `.runtime/end-to-end-sentinel/latest.ndjson`.
2. Identify the first failing surface:
   - `newErrorEvents`
   - `failedApiResponses`
   - `bannerEvents`
   - `loadingTimeoutBreaches`
3. If the failure includes freeze evidence, read `.runtime/end-to-end-performance/latest.json`.
4. If Playwright failed on a locator or navigation assertion, read `error-context.md`.
5. If the DOM snapshot is not enough, inspect `trace.zip`.
6. Fix the smallest owner-aligned product bug or synchronization bug.
7. Re-run the same soak unchanged.

Do not weaken the soak to hide a product bug. Only change the soak when it is making an invalid assumption about supported product behavior.

## What Watchers Must Look For

Watcher agents should not stop at binary pass/fail checks.

They must actively look for:

1. every emitted non-debug request lifecycle event during the exercised feature path
2. which requests happened in response to which feature step
3. step-by-step request count that looks excessive for the user action
4. routes whose scope or returned surface looks too broad for the feature step
5. request patterns that imply the user action is asking for more thread or chat data than it should need
6. slow routes, queue-delay spikes, and request-error growth
7. any errors, even if intermittent or finicky
8. visible user-experience issues:
   - stale or incorrect UI state
   - missing rows or missing messages
   - bad banners or warnings
   - freezes, long waits, or obviously rough timing

If a watcher sees something suspicious but not yet failing a hard budget, it should still report it as a candidate issue.

## Multi-Agent Mode

This process is now defined to support coordinated subagents.

Prompt files:

1. [RuntimeSoakOrchestratorPrompt.md](/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/RuntimeSoakOrchestratorPrompt.md)
2. [RuntimeSoakBrowserPrompt.md](/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/RuntimeSoakBrowserPrompt.md)
3. [RuntimeSoakSignalWatcherPrompt.md](/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/RuntimeSoakSignalWatcherPrompt.md)
4. [RuntimeSoakRequestWatcherPrompt.md](/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/RuntimeSoakRequestWatcherPrompt.md)
5. [RuntimeSoakRepairPrompt.md](/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/RuntimeSoakRepairPrompt.md)

Recommended orchestration:

1. one browser runner owns the live soak command
2. one signal watcher tails sentinel output and classifies new failures
3. one request watcher inspects all emitted non-debug request-lifecycle deltas, accounts for every exercised request, and explains route behavior
4. one user-experience watcher judges visible timing and state quality from artifacts and output
5. the orchestrator decides whether the issue is product behavior or harness behavior
6. only after that does a repair worker edit code

The orchestrator should treat watcher evidence as first-class input when choosing a fix.
The orchestrator should not call a run clean until every emitted non-debug request caused by the exercised feature steps has an explanation or an explicit reason it is suspicious.

## Improvement Log

When this process drives a product fix, record both:

1. the implementation change
2. the user-visible effect after the change

Use short entries in this format:

1. date
2. changed owner modules
3. implementation summary
4. user-visible impact
5. verification evidence

### March 6, 2026: Explicit Active Refresh Now Bypasses Retained Active Snapshot

Changed owner modules:

1. [ThreadListStateController.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListStateController.ts)
2. [UseApplicationShellViewProperties.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseApplicationShellViewProperties.ts)
3. [UseApplicationShellComposition.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseApplicationShellComposition.ts)

Implementation summary:

1. explicit user refresh now clears the active retained thread-list baseline before reloading core data
2. the refresh path no longer trusts a persisted active-thread snapshot for manual resync

User-visible impact:

1. manual refresh is more likely to surface newly created or externally changed active threads immediately
2. the sidebar is less likely to stay stuck on stale active-thread state after explicit refresh

Verification evidence:

1. [UseApplicationShellViewProperties.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseApplicationShellViewProperties.test.ts)
2. [ApplicationRuntimeComposition.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ApplicationRuntimeComposition.test.tsx)

### March 6, 2026: Server Thread Aggregation Backfills Readable Loaded Threads

Changed owner modules:

1. [ThreadListAggregationSnapshotLoader.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/ThreadListAggregationSnapshotLoader.ts)
2. [ThreadCollectionListItemProjection.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/ThreadCollectionListItemProjection.ts)

Implementation summary:

1. if an adapter reports a thread as loaded in memory but omits it from `listThreads`, the aggregation owner now reads that thread directly and projects it into the thread-list response
2. projected preview text can now be derived from the latest user message when direct readback is used

User-visible impact:

1. newly readable threads are more likely to appear in the sidebar instead of being silently missing
2. thread rows can surface sooner after creation or out-of-band mutations

Verification evidence:

1. [ThreadCollectionRoutes.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadCollectionRoutes.test.ts)

### March 6, 2026: Archive Route Keeps Adapter Method Context

Changed owner modules:

1. [ThreadMemberArchiveMutationRouteOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/ThreadMemberArchiveMutationRouteOwner.ts)

Implementation summary:

1. archive and unarchive route execution now calls adapter methods directly instead of extracting unbound method references

User-visible impact:

1. archive cleanup for managed Codex threads no longer fails because `this` was lost inside the adapter method
2. archive/unarchive actions are less likely to explode with internal `undefined` owner errors

Verification evidence:

1. [ThreadMemberMutationRouteOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadMemberMutationRouteOwner.test.ts)

### March 7, 2026: WebKit Soak Ignores One Known Client-Errors Access-Control False Positive

Changed owner modules:

1. [signal-allowlist.ts](/Users/matthewfrench/GitHub/farfield/end-to-end/real/helpers/signal-allowlist.ts)

Implementation summary:

1. added a strict temporary allowlist entry for the WebKit page-error signal `/api/debug/client-errors due to access control checks.`
2. kept the allowlist entry dated, owned, and expiring so it remains reviewable

User-visible impact:

1. no product behavior changed for users
2. the WebKit soak can judge real runtime behavior instead of failing on this known false-positive harness signal

Verification evidence:

1. [mobile-soak.spec.ts](/Users/matthewfrench/GitHub/farfield/end-to-end/real/scenarios/mobile-soak.spec.ts)

### March 7, 2026: Codex Send Resumes Threads On `thread not found`

Changed owner modules:

1. [CodexAgentAdapterContracts.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexAgentAdapterContracts.ts)
2. [CodexAgentAdapter.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexAgentAdapter.ts)

Implementation summary:

1. the Codex adapter now treats `thread not found` the same way it already treated `conversation not found`
2. that lets the existing resume-and-retry message dispatch path run for this server response

User-visible impact:

1. sending another message to a resumed or newly surfaced Codex thread is less likely to fail with a raw `500`
2. message continuation on threads that temporarily fall out of the app-server loaded set is more resilient

Verification evidence:

1. [CodexAgentAdapter.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/CodexAgentAdapter.test.ts)

### March 7, 2026: Soak Uses Full Real Product Path With Cold And Warm Budgets

Changed owner modules:

1. [mobile-soak.spec.ts](/Users/matthewfrench/GitHub/farfield/end-to-end/real/scenarios/mobile-soak.spec.ts)
2. [mobile-runtime-soak-process.md](/Users/matthewfrench/GitHub/farfield/docs/debug/mobile-runtime-soak-process.md)

Implementation summary:

1. removed Playwright route stubbing for product API endpoints from the soak scenario
2. kept managed-thread creation and seed messages on the real API request context only
3. split readiness budgets into startup, cold-iteration, and warm-iteration thresholds
4. added an explicit post-completion refresh checkpoint before reload verification

User-visible impact:

1. no direct product behavior changed for users
2. the verification path is now closer to what a real user sees because it exercises real server responses, real rendering, real thread data, and real persistence behavior end to end
3. failures from this soak are more likely to represent real runtime problems instead of harness shortcuts

Verification evidence:

1. [browser-mobile-soak.json](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-performance/browser-mobile-soak.json)
2. [webkit-mobile-soak.json](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-performance/webkit-mobile-soak.json)

### March 7, 2026: Managed-Thread Soak Setup Avoids Pre-Read Materialization Error Burst

Changed owner modules:

1. [mobile-soak.spec.ts](/Users/matthewfrench/GitHub/farfield/end-to-end/real/scenarios/mobile-soak.spec.ts)

Implementation summary:

1. reordered the managed-thread setup so the soak waits for active-list visibility before the first explicit include-turns readiness read
2. kept the same real API path while removing avoidable pre-read materialization churn from the setup sequence

User-visible impact:

1. no direct product behavior changed for users
2. soak request and timing findings are more trustworthy because the setup no longer manufactures a burst of managed-thread read errors before the browser flow starts
3. the first managed-thread open/readback measurements are less polluted by setup noise, which makes it easier to judge real thread-open and reload behavior

Verification evidence:

1. [browser-mobile-soak.json](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-performance/browser-mobile-soak.json)
2. [mobile-soak-spec-ts-mobile-managed-thread-soak-behavior.ndjson](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-sentinel/mobile-soak-spec-ts-mobile-managed-thread-soak-behavior.ndjson)

## Current Status

This process now has repeated green evidence on both supported mobile automation engines, including the stricter no-route-stub real-path version.

As of Saturday, March 7, 2026:

1. the Chromium mobile soak passes end to end on the current worktree
2. the WebKit mobile soak also passes end to end on the current worktree
3. the process has already exposed and helped fix multiple real synchronization, listing, send, and cleanup issues
4. the current repeat cadence has produced multiple passing Chromium runs and multiple passing WebKit runs after the latest fixes
5. the stricter fully real path also passes on both engines with the startup/cold/warm budget split
6. the soak now watches request-error growth plus route last-duration and queue-delay budgets through `/api/debug/observability`
7. for thread/sidebar/chat/reload/mobile-runtime changes, this can now be treated as an expected verification path unless a task explicitly cannot use the real stack
8. the latest multi-agent Chromium rerun removed the setup-time managed-thread read `500` burst, but steady-state managed-thread reread volume and occasional warm-iteration outliers still need reduction

### March 7, 2026: Soak Enforces Server Observability Budgets

Changed owner modules:

1. [app-assertions.ts](/Users/matthewfrench/GitHub/farfield/end-to-end/real/helpers/app-assertions.ts)
2. [mobile-soak.spec.ts](/Users/matthewfrench/GitHub/farfield/end-to-end/real/scenarios/mobile-soak.spec.ts)

Implementation summary:

1. the soak now captures a baseline and final `/api/debug/observability` snapshot
2. it fails when request-routing total error count grows unexpectedly
3. it fails when exercised non-debug routes exceed last-duration or last-queue-delay budgets

User-visible impact:

1. no direct product behavior changed for users
2. the soak now catches slow or error-prone server to app-server request paths even when the UI appears superficially fine

Verification evidence:

1. [browser-mobile-soak.json](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-performance/browser-mobile-soak.json)
2. [webkit-mobile-soak.json](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-performance/webkit-mobile-soak.json)

Latest passing Chromium artifact:

1. [browser-mobile-soak.json](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-performance/browser-mobile-soak.json)

Latest passing WebKit artifact:

1. [webkit-mobile-soak.json](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-performance/webkit-mobile-soak.json)

Latest passing sentinel summary:

1. [mobile-soak-spec-ts-mobile-managed-thread-soak-behavior.ndjson](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-sentinel/mobile-soak-spec-ts-mobile-managed-thread-soak-behavior.ndjson)

## Promotion Rule

Promote this from experimental process to expected verification path when all of these are true:

1. Chromium mobile soak passes repeatedly on the current mainline behavior
2. WebKit mobile soak passes repeatedly on the current mainline behavior
3. failures, when they happen, are actionable product regressions rather than setup/materialization assumptions
4. AI can re-run the path without manual intervention beyond starting the real stack
