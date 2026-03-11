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
- when `E2E_REAL_OUTPUT_PROFILE` is set, the same files are written under `.runtime/end-to-end-sentinel/<profile>/`

Freeze and performance:

- `.runtime/end-to-end-performance/latest.json`
- `.runtime/end-to-end-performance/<label>.json`
- when `E2E_REAL_OUTPUT_PROFILE` is set, the same files are written under `.runtime/end-to-end-performance/<profile>/`

Playwright failure context:

- `test-results/real-app/<scenario>/error-context.md`
- `test-results/real-app/<scenario>/trace.zip`
- `test-results/real-app/<scenario>/video.webm`
- when `E2E_REAL_OUTPUT_PROFILE` is set, Playwright outputs move under `test-results/<profile>/real-app/` and `playwright-report/<profile>/real-app/`

Stable verification path:

- `bun run dev:stable` serves the validated stable web shell on `http://127.0.0.1:4312` by default
- `bun run end-to-end:real:mobile-soak:stable` targets that stable web shell and writes isolated artifacts with `E2E_REAL_OUTPUT_PROFILE=stable-dev`
- verified on Sunday, March 8, 2026: the stable Chromium soak wrote to `.runtime/end-to-end-performance/stable-dev/`, `.runtime/end-to-end-sentinel/stable-dev/`, `test-results/stable-dev/real-app/`, and `playwright-report/stable-dev/real-app/`, and the run passed with `freezeCount=0`
- stable builds now install the client freeze probe too; direct browser evaluation on Sunday, March 8, 2026, confirmed `window.__farfieldClientPerformanceFreezeProbeOwner` exists on the stable shell and returns populated instant events, completed operations, long tasks, and freeze windows

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

### March 7, 2026: Chat Mutation Refresh Uses Active-Thread-Only Reload Path

Changed owner modules:

1. [ActiveThreadLoader.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/ActiveThreadLoader.ts)
2. [UseCoreDataLoaders.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseCoreDataLoaders.ts)
3. [UseChatActionHandlers.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/StateManagement/UseChatActionHandlers.ts)

Implementation summary:

1. added a tracked active-thread-list refresh owner path that reloads sidebar thread data without invoking the broader deferred core-data capability bundle
2. switched chat mutation refresh flows to use that active-thread-only refresh before reloading the selected thread

User-visible impact:

1. sending a message or handling chat follow-up actions does less unrelated refresh work before the selected thread settles again
2. sidebar thread ordering and preview refresh can still converge after chat mutations without dragging health, agents, models, modes, and defaults behind every action

Verification evidence:

1. [UseCoreDataLoaders.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseCoreDataLoaders.test.tsx)
2. [UseChatActionHandlers.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseChatActionHandlers.test.tsx)

### March 7, 2026: Soak Logs Iteration Substep Timings

Changed owner modules:

1. [mobile-soak.spec.ts](/Users/matthewfrench/GitHub/farfield/end-to-end/real/scenarios/mobile-soak.spec.ts)

Implementation summary:

1. each soak iteration now logs separate browse, open, send, and reload timings in addition to total readiness time
2. the soak can now localize slow-path behavior without requiring manual trace inspection first

User-visible impact:

1. no direct product behavior changed for users
2. runtime investigations can now tell whether slowness is mostly in thread browsing, thread opening, agent reply wait, or reload restore

Verification evidence:

1. [browser-mobile-soak.json](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-performance/browser-mobile-soak.json)

### March 7, 2026: Connected Chat Actions Stop Blocking On Explicit Selected-Thread Reload

Changed owner modules:

1. [UseChatActionHandlers.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/StateManagement/UseChatActionHandlers.ts)
2. [ApplicationRuntimeCompositionDependencyBuilders.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/ApplicationRuntimeCompositionDependencyBuilders.ts)

Implementation summary:

1. connected selected-thread chat actions now prefer the live stream path and stop waiting on an explicit selected-thread reload before clearing the action path
2. active thread-list refresh still runs, but it no longer blocks the common connected-thread send path

User-visible impact:

1. sends, steers, and approval responses on an already-open connected thread return control faster
2. the app avoids one more blocking selected-thread reread in the common connected-thread case

Verification evidence:

1. [UseChatActionHandlers.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseChatActionHandlers.test.tsx)
2. [browser-mobile-soak.json](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-performance/browser-mobile-soak.json)

### March 7, 2026: Selected-Thread Teardown Stops Unsubscribing On Unmount

Changed owner modules:

1. [UseSelectedThreadLifecycleEffects.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/StateManagement/UseSelectedThreadLifecycleEffects.ts)
2. [UseSelectedThreadLifecycleEffects.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseSelectedThreadLifecycleEffects.test.tsx)

Implementation summary:

1. selected-thread lifecycle cleanup now cancels in-flight refresh work during teardown without posting `/api/threads/:threadId/unsubscribe`
2. explicit selection changes still unsubscribe the previous thread, so running-session thread switches keep their existing cleanup semantics

User-visible impact:

1. reload-heavy mobile flows avoid one extra thread-unsubscribe mutation per page teardown
2. the real soak preserved assistant reply rendering while cutting unsubscribe churn from `11` to `8` requests in the observed Chromium run

Verification evidence:

1. [UseSelectedThreadLifecycleEffects.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseSelectedThreadLifecycleEffects.test.tsx)
2. [browser-mobile-soak.json](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-performance/browser-mobile-soak.json)
3. [mobile-soak-spec-ts-mobile-managed-thread-soak-behavior.ndjson](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-sentinel/mobile-soak-spec-ts-mobile-managed-thread-soak-behavior.ndjson)

### March 7, 2026: Codex Read Resumes Missing Threads Before Returning 404

Changed owner modules:

1. [CodexThreadManagementOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexThreadManagementOwner.ts)
2. [CodexAgentAdapterOwnerFactory.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexAgentAdapterOwnerFactory.ts)
3. [CodexAgentAdapter.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexAgentAdapter.ts)
4. [CodexAgentAdapterContracts.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexAgentAdapterContracts.ts)
5. [CodexThreadManagementOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/CodexThreadManagementOwner.test.ts)
6. [CodexAgentAdapter.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/CodexAgentAdapter.test.ts)

Implementation summary:

1. the Codex thread-management read owner now resumes a thread with extended history and retries once when `readThread` fails with `conversation not found`, `thread not loaded`, or the rollout-missing runtime error text currently emitted by app-server
2. the read path keeps returning the original error for unrelated failures, so the recovery scope stays limited to the missing-thread race

User-visible impact:

1. mobile thread open and reload flows are less likely to surface transient `404` read failures after app-server drops in-memory thread state
2. users should see more thread reads recover in place instead of bouncing through a runtime request error path

Verification evidence:

1. [CodexThreadManagementOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/CodexThreadManagementOwner.test.ts)
2. [CodexAgentAdapter.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/CodexAgentAdapter.test.ts)
3. [browser-mobile-soak.json](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-performance/browser-mobile-soak.json)
4. [mobile-soak-spec-ts-mobile-managed-thread-soak-behavior.ndjson](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-sentinel/mobile-soak-spec-ts-mobile-managed-thread-soak-behavior.ndjson)

### March 7, 2026: Thread Read And Unsubscribe Routes Keep Missing-Thread Errors Explicit

Changed owner modules:

1. [ThreadMemberReadRouteOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/ThreadMemberReadRouteOwner.ts)
2. [ThreadMemberUnsubscribeMutationRouteOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/ThreadMemberUnsubscribeMutationRouteOwner.ts)
3. [ThreadMemberReadRouteOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadMemberReadRouteOwner.test.ts)
4. [ThreadMemberMutationRouteOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadMemberMutationRouteOwner.test.ts)

Implementation summary:

1. thread read routes now normalize adapter-owned `conversation not found` errors to the same `404` missing-thread contract already used for `thread not loaded`
2. unsubscribe routes still coerce known missing-thread cases to `notLoaded`, but unrelated unsubscribe failures now return `500` instead of being rewritten into a fake success

User-visible impact:

1. mobile read flows get a more consistent missing-thread response contract when Codex reports either missing-thread variant
2. real unsubscribe failures are now visible to clients and logs instead of silently looking like successful cleanup

Verification evidence:

1. [ThreadMemberReadRouteOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadMemberReadRouteOwner.test.ts)
2. [ThreadMemberMutationRouteOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadMemberMutationRouteOwner.test.ts)
3. [browser-mobile-soak.json](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-performance/browser-mobile-soak.json)
4. [mobile-soak-spec-ts-mobile-managed-thread-soak-behavior.ndjson](/Users/matthewfrench/GitHub/farfield/.runtime/end-to-end-sentinel/mobile-soak-spec-ts-mobile-managed-thread-soak-behavior.ndjson)

### March 7, 2026: Thread List Startup Clears Unreadable Persisted Snapshots

Changed owner modules:

1. [ThreadListStateController.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListStateController.ts)
2. [ThreadOwnership.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ThreadOwnership.test.ts)

Implementation summary:

1. thread-list controller reads from persisted snapshot storage now treat parse failures as stale cache data, clear the broken snapshot key, and continue with a network read
2. invalid persisted sidebar snapshots no longer bubble through the runtime request error path during startup or refresh-baseline reads

User-visible impact:

1. browsers carrying older thread-list snapshot shapes should recover by dropping the stale cache instead of rendering a startup error banner
2. sidebar startup can proceed from the network even when persisted thread-list storage contains obsolete schema data

Verification evidence:

1. [ThreadOwnership.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ThreadOwnership.test.ts)
2. [ThreadSidebarSyncApi.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ThreadSidebarSyncApi.test.ts)

### March 7, 2026: Selected Thread Reissues Full Read When Delta-Only Refresh Returns No Snapshot

Changed owner modules:

1. [UseSelectedThreadLoaders.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/StateManagement/UseSelectedThreadLoaders.ts)
2. [UseSelectedThreadLoaders.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseSelectedThreadLoaders.test.tsx)

Implementation summary:

1. selected-thread loading now retries once with an explicit thread read when the delta-only refresh path returns neither live conversation state nor a read-thread snapshot
2. this keeps the incremental path for healthy stream-cursor cases, but avoids settling into a route-selected thread with no hydrated thread state after restart or stale-cache recovery

User-visible impact:

1. after a dev-stack restart, a thread URL is less likely to degrade into a `No thread selected` style state driven only by `stream-events?sinceSequence=0`
2. manual thread re-entry can recover with a full read instead of remaining stuck on empty selected-thread state

Verification evidence:

1. [UseSelectedThreadLoaders.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseSelectedThreadLoaders.test.tsx)

### March 7, 2026: Stale Selected-Thread Routes Clear Without Runtime Error Banner

Changed owner modules:

1. [ReadThreadErrorClassifier.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/DomainModel/ReadThreadErrorClassifier.ts)
2. [UseSelectedThreadLifecycleEffects.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/StateManagement/UseSelectedThreadLifecycleEffects.ts)
3. [UseApplicationRuntimeRefreshOrchestration.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseApplicationRuntimeRefreshOrchestration.ts)
4. [UseEventStreamEffects.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseEventStreamEffects.ts)

Implementation summary:

1. plain thread-read `404` responses are no longer classified as retryable transient selected-thread refresh errors, so dead-thread routes stop looping the same `/api/threads/:threadId?includeTurns=true` read
2. selected-thread lifecycle, runtime refresh, and event-stream scheduled refresh paths now clear stale route selection instead of surfacing `runtime-request-error` after the thread is already gone

User-visible impact:

1. opening a stale thread URL on phone or remote browser now settles on `No thread selected` without a red runtime error banner
2. stale-thread recovery now emits one read-thread `404` instead of the earlier repeated read burst, reducing reload noise and visible roughness

Verification evidence:

1. [ReadThreadErrorClassifier.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ReadThreadErrorClassifier.test.ts)
2. [SelectedThreadDataRefreshCoordinator.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/SelectedThreadDataRefreshCoordinator.test.ts)
3. [UseEventStreamEffects.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseEventStreamEffects.test.tsx)
4. [UseSelectedThreadLifecycleEffects.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseSelectedThreadLifecycleEffects.test.tsx)
5. [UseSelectedThreadLoaders.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseSelectedThreadLoaders.test.tsx)
6. [ApplicationRuntimeComposition.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ApplicationRuntimeComposition.test.tsx)
7. real browser run on `https://farfield.matthewfrench.io/threads/019cc17a-1b65-7ef3-9c15-e7cfc6494273` redirected to `/`, showed `No thread selected`, emitted no fresh `runtime-request-error`, and reduced the thread-read request sequence to one `GET /api/threads/:threadId?includeTurns=true => 404`

### March 7, 2026: Deferred Startup Retries Restart-Window Capability Churn

Changed owner modules:

1. [CoreDataStartupLoader.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/CoreDataStartupLoader.ts)

Implementation summary:

1. deferred startup reads now treat restart-window `502/503/504`, failed-fetch, and transient invalid-JSON responses as retryable for a bounded number of attempts instead of surfacing them immediately as runtime banners
2. successful deferred startup reads still apply on the first pass, and only the still-failing deferred surfaces are retried under the same startup sequence guard

User-visible impact:

1. remote dev-server rebuilds are less likely to leave the app stuck with a `startup-deferred.*` error banner after the server comes back
2. non-critical startup capability data can recover on its own after brief restart churn instead of requiring a manual reload to clear the banner

Verification evidence:

1. [UseCoreDataLoaders.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseCoreDataLoaders.test.tsx)
2. real browser run on `https://farfield.matthewfrench.io/` after the restart-window banner repro settled with no visible deferred-startup error banner, all deferred startup routes returning `200`, and no fresh client-error entries after `2026-03-07T08:20:09Z`

### March 7, 2026: Notification Projection Restart Errors Stop Surfacing Runtime Banner

Changed owner modules:

1. [UseEventStreamEffects.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseEventStreamEffects.ts)

Implementation summary:

1. restart-window `502/503/504`, failed-fetch, and empty-response notification projection reads now stay noncritical inside the event-stream scheduled refresh path
2. transient errors for `/api/notifications/events`, `/api/account`, `/api/account/rate-limits`, `/api/apps`, and `/api/server-requests/pending` no longer promote to sticky `runtime-request-error` banner state during runtime summary refresh

User-visible impact:

1. mobile-width remote sessions are less likely to show a red runtime error banner after the dev server briefly restarts while runtime summary reads are in flight
2. the page can settle back to usable state on its own once the next notification projection read succeeds

Verification evidence:

1. [UseEventStreamEffects.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseEventStreamEffects.test.tsx)
2. real browser mobile-width run on `https://farfield.matthewfrench.io/` after `2026-03-07T08:43:09Z` settled with no visible banner and no fresh client-error entries, including no new `/api/notifications/events` runtime-request-error record

### March 7, 2026: Event-Stream First Open Stops Re-Reading Already Hydrated Selected Thread

Changed owner modules:

1. [SelectedThreadSnapshotStateOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/StateManagement/SelectedThreadSnapshotStateOwner.ts)
2. [UseSelectedThreadLoaders.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/StateManagement/UseSelectedThreadLoaders.ts)
3. [UseEventStreamEffects.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseEventStreamEffects.ts)
4. [EventStreamConnectionCoordinator.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/EventStreamConnectionCoordinator.ts)

Implementation summary:

1. selected-thread snapshot ownership now exposes whether the currently selected thread already has an applied snapshot
2. the first EventSource open now skips the extra selected-thread refresh when that snapshot is already hydrated, while later reconnects still refresh selected thread state

User-visible impact:

1. opening a thread on mobile or remote browser now avoids one immediate extra `stream-events?sinceSequence=0` reread after the full selected-thread hydrate
2. thread-open recovery stays intact on reconnects, but the initial open path does less redundant work and should feel less rough

Verification evidence:

1. [EventStreamConnectionCoordinator.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/EventStreamConnectionCoordinator.test.ts)
2. [UseEventStreamEffects.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseEventStreamEffects.test.tsx)
3. [ApplicationRuntimeComposition.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ApplicationRuntimeComposition.test.tsx)
4. real browser mobile-width thread-open run on `https://farfield.matthewfrench.io/threads/019cc4e3-c181-7341-bc1e-8fc70b578415` reduced the non-debug selected-thread read sequence to one `GET /api/threads/:threadId?includeTurns=true`, one `GET /live-state`, and one `GET /stream-events?limit=80`, with no follow-up `stream-events?sinceSequence=0` reread

### March 8, 2026: Selected-Thread Snapshot Owner Skips No-Op Reapplies

Changed owner modules:

1. [SelectedThreadSnapshotStateOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/StateManagement/SelectedThreadSnapshotStateOwner.ts)
2. [SelectedThreadSnapshotStateOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/SelectedThreadSnapshotStateOwner.test.ts)

Implementation summary:

1. selected-thread snapshot application now compares the effective live-state signature, read-thread signature, stream-event snapshot, and stored cursor before persisting or setting state
2. when the incoming snapshot is equivalent to the already applied selected-thread snapshot, the owner now skips persistence and avoids re-running `setLiveState`, `setReadThreadState`, and `setStreamEvents`

User-visible impact:

1. repeated selected-thread reads that return equivalent data now do less post-request apply work on the client
2. this should reduce unnecessary selected-thread state churn during reconnects and rereads, even though it does not address the larger send-latency outliers by itself

Verification evidence:

1. [SelectedThreadSnapshotStateOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/SelectedThreadSnapshotStateOwner.test.ts)
2. [SelectedThreadStreamEventStateResolver.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/SelectedThreadStreamEventStateResolver.test.ts)
3. `bun run --cwd apps/WebApplication test -- Tests/SelectedThreadSnapshotStateOwner.test.ts Tests/SelectedThreadStreamEventStateResolver.test.ts`
4. `bun run --cwd apps/WebApplication typecheck`
5. unchanged Chromium real soak on Sunday, March 8, 2026, stayed green with `freeze count=1 totalFreezeMs=167`, `sendMs=1952`, `13422`, `14745`; treat this as a selected-thread work-reduction fix, not a send-latency fix

### March 8, 2026: EventSource First Open Stops Forcing A Second Core Sidebar Refresh

Changed owner modules:

1. [EventStreamConnectionCoordinator.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/EventStreamConnectionCoordinator.ts)
2. [EventStreamConnectionCoordinator.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/EventStreamConnectionCoordinator.test.ts)

Implementation summary:

1. first EventSource open now reserves `refreshCore` for reconnect recovery instead of always forcing a core refresh on startup
2. startup still refreshes selected thread, debug history, and notification projections through the existing owned paths, but it no longer immediately invalidates and rereads the active sidebar query a second time just because the event stream connected

User-visible impact:

1. startup should perform less duplicate active-sidebar reread work before the page settles
2. reconnect recovery still refreshes core data, so disconnect healing behavior is preserved while initial startup does less redundant sidebar churn

Verification evidence:

1. [EventStreamConnectionCoordinator.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/EventStreamConnectionCoordinator.test.ts)
2. [UseEventStreamEffects.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseEventStreamEffects.test.tsx)
3. [ApplicationRuntimeComposition.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ApplicationRuntimeComposition.test.tsx)
4. `bun run --cwd apps/WebApplication test -- Tests/EventStreamConnectionCoordinator.test.ts Tests/UseEventStreamEffects.test.tsx Tests/ApplicationRuntimeComposition.test.tsx`
5. `bun run --cwd apps/WebApplication typecheck`
6. unchanged Chromium real soak rerun on Sunday, March 8, 2026, was interrupted by `dev:remote` watch restarts triggered by the soak command's required protocol build, so use the focused tests plus the startup revalidation audit as the trustworthy signal for this change

### March 8, 2026: Main Region Memo Stops Committing For Inactive Pane Prop Churn

Changed owner modules:

1. [ApplicationShellMainRegion.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/UserInterface/ApplicationShellMainRegion.tsx)
2. [ApplicationShellMainRegion.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ApplicationShellMainRegion.test.ts)

Implementation summary:

1. the main shell region now uses a tab-aware memo comparator instead of default shallow prop equality
2. while the chat tab is visible, settings-pane prop churn no longer forces a main-region commit; while the debug tab is visible, chat-pane prop churn no longer forces a main-region commit
3. hidden API-session overlay prop churn is also ignored until the overlay is actually shown

User-visible impact:

1. sidebar and runtime-summary updates should cause less unnecessary main-region rerender pressure when the user is not looking at the pane whose props changed
2. this specifically targets the mobile roughness where sidebar refresh activity broadened into `application-shell-main-region-committed` even though the visible tab content did not need to change

Verification evidence:

1. [ApplicationShellMainRegion.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ApplicationShellMainRegion.test.ts)
2. [ApplicationRuntimeComposition.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ApplicationRuntimeComposition.test.tsx)
3. `bun run --cwd apps/WebApplication test -- Tests/ApplicationShellMainRegion.test.ts Tests/ApplicationRuntimeComposition.test.tsx`
4. `bun run --cwd apps/WebApplication typecheck`
5. unchanged Chromium real soak rerun on Sunday, March 8, 2026, still hit `dev:remote` watch restarts from the required protocol build and surfaced unrelated `runtime-request-error` banners, so use the focused tests plus the prior commit-fan-out probe output as the trustworthy signal for this change

### March 8, 2026: Inbound Codex IPC History Stops Retaining Raw Frame Payloads

Changed owner modules:

1. [CodexIpcFrameHistoryPayloadBuilder.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexIpcFrameHistoryPayloadBuilder.ts)
2. [ServerBootstrap.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Application/ServerBootstrap.ts)
3. [CodexIpcFrameHistoryPayloadBuilder.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/CodexIpcFrameHistoryPayloadBuilder.test.ts)

Implementation summary:

1. inbound Codex IPC frames now enter activity history as compact metadata summaries instead of full raw frame payloads
2. outbound preview frames still keep their raw payloads so debug replay continues to have request bodies when the operator explicitly replays a request or broadcast
3. activity history now retains bounded detail payloads separately from replay payloads, with explicit byte budgets and oldest-first eviction
4. server observability now exposes activity-history entry counts, byte counts, and eviction counters so retention growth is visible in `/api/debug/observability`

User-visible impact:

1. long-lived stable API sessions should be less likely to hit heap growth from large inbound IPC frame history retention
2. debug history still shows inbound IPC activity, but as bounded summaries instead of giant raw frame bodies
3. debug replay keeps working for outbound preview frames, while older replay payloads can now age out independently when the replay budget is exceeded

Verification evidence:

1. [CodexIpcFrameHistoryPayloadBuilder.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/CodexIpcFrameHistoryPayloadBuilder.test.ts)
2. [ActivityHistoryService.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ActivityHistoryService.test.ts)
3. [ServerBootstrap.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ServerBootstrap.test.ts)
4. [ServerObservabilitySnapshotOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ServerObservabilitySnapshotOwner.test.ts)
5. [ServerRuntimeConfiguration.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ServerRuntimeConfiguration.test.ts)
6. [ProtocolAppServerSchemas.test.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexProtocol/Tests/ProtocolAppServerSchemas.test.ts)
7. `bun run --cwd apps/ServerApplication test -- Tests/ActivityHistoryService.test.ts Tests/CodexIpcFrameHistoryPayloadBuilder.test.ts Tests/ServerBootstrap.test.ts Tests/ServerObservabilitySnapshotOwner.test.ts Tests/ServerRuntimeConfiguration.test.ts`
8. `bun run --cwd apps/ServerApplication typecheck`
9. `bun run --cwd packages/CodexProtocol test -- Tests/ProtocolAppServerSchemas.test.ts`
10. stable development rebuild after this change returned to `ready` with no immediate crash summary, but multi-minute OOM absence still needs longer observation

### March 8, 2026: Create Route Seeds Short-Lived Active List Projections

Changed owner modules:

1. [CreatedThreadListProjectionOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/CreatedThreadListProjectionOwner.ts)
2. [ThreadCollectionRoutes.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/ThreadCollectionRoutes.ts)
3. [ThreadListAggregationSnapshotLoader.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/ThreadListAggregationSnapshotLoader.ts)
4. [SidebarThreadSyncRoutes.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/SidebarThreadSyncRoutes.ts)

Implementation summary:

1. the create-thread route now remembers a bounded short-lived active-thread projection for the just-created thread
2. active `/api/threads` aggregation and `/api/sidebar/threads/sync` now merge that remembered projection when adapter list reads have not caught up yet
3. the projection is forgotten once the adapter list includes the thread, so it is explicitly a temporary create-freshness bridge rather than a second long-lived cache

User-visible impact:

1. newly created active threads should appear in the active thread list and sidebar sync sooner instead of waiting for adapter list eventual consistency
2. this specifically targets the stable soak failure where a managed thread existed and was directly readable but had not yet appeared in the active list

Verification evidence:

1. [ThreadCollectionRoutes.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadCollectionRoutes.test.ts)
2. [SidebarThreadSyncRoutes.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/SidebarThreadSyncRoutes.test.ts)
3. [ServerRequestHandler.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ServerRequestHandler.test.ts)
4. `bun run --cwd apps/ServerApplication test -- Tests/ThreadCollectionRoutes.test.ts Tests/SidebarThreadSyncRoutes.test.ts Tests/ServerRequestHandler.test.ts`
5. `bun run --cwd apps/ServerApplication typecheck`

### March 9, 2026: Deferred Startup Bundle Becomes One-Time Only

Changed owner modules:

1. [CoreDataStartupLoader.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/CoreDataStartupLoader.ts)
2. [UseCoreDataLoaders.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseCoreDataLoaders.test.tsx)

Implementation summary:

1. the full deferred startup bundle now runs only on the first startup-driven core load
2. later tracked core refreshes still reload critical thread data, but they no longer re-run startup-only deferred capability and active-thread revalidation work
3. this specifically stops repeated reuse of `startup-deferred.*` semantics on later core refresh cycles

User-visible impact:

1. recurring core refreshes should do less hidden startup-style work after the first page bootstrap
2. this targets the long-tail revalidate churn that kept showing up in stable observability as repeated `startup-deferred.threads.active.revalidate`

Verification evidence:

1. [UseCoreDataLoaders.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseCoreDataLoaders.test.tsx)
2. [ApplicationRuntimeComposition.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ApplicationRuntimeComposition.test.tsx)
3. `bun run --cwd apps/WebApplication test -- Tests/UseCoreDataLoaders.test.tsx Tests/ApplicationRuntimeComposition.test.tsx`
4. `bun run --cwd apps/WebApplication typecheck`
5. stable Chromium soak rerun on Monday, March 9, 2026, completed all three iterations with flatter send timings (`5452`, `5428`, `9529`) and no UI/banner failures, but the final assertion still failed on separate push-route queue-delay budgets; treat the focused tests as the trustworthy signal for this specific loader change

### March 9, 2026: Chat Mount Stops Refreshing Push State Unnecessarily

Changed owner modules:

1. [UseApplicationRefreshEffects.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseApplicationRefreshEffects.ts)
2. [UseApplicationRefreshEffects.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseApplicationRefreshEffects.test.tsx)

Implementation summary:

1. normal chat-surface mount no longer calls `refreshPushClientState()`
2. push diagnostics still refresh when the notifications settings surface is active through the owned push feature composition path

User-visible impact:

1. the default chat/sidebar path does less hidden push work on startup
2. this removed the stable soak budget failure from hidden push diagnostics routes (`/api/push/status`, `/api/push/local-ca`, `/api/push/receipts/latest`, `/api/push/sends/latest`)

Verification evidence:

1. [UseApplicationRefreshEffects.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseApplicationRefreshEffects.test.tsx)
2. [UseApplicationPushFeatureComposition.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseApplicationPushFeatureComposition.test.tsx)
3. `bun run --cwd apps/WebApplication test -- Tests/UseApplicationRefreshEffects.test.tsx Tests/UseApplicationPushFeatureComposition.test.tsx`
4. `bun run --cwd apps/WebApplication typecheck`
5. stable Chromium soak rerun on Monday, March 9, 2026, passed clean with no push-route budget violations

### March 9, 2026: App-Server Notification Buffer Gains Byte Budget

Changed owner modules:

1. [AppServerNotificationBufferOwner.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerNotificationBufferOwner.ts)
2. [AppServerTransport.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerTransport.ts)
3. [AppServerChildProcessTransportOptionsContract.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerChildProcessTransportOptionsContract.ts)
4. [AppServerTransportConstants.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerTransportConstants.ts)
5. [AppServerNotificationBufferOwner.test.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Tests/AppServerNotificationBufferOwner.test.ts)

Implementation summary:

1. app-server notification retention is now owned by a dedicated bounded buffer instead of a raw unbounded event array
2. the buffer enforces both event-count and total-byte budgets with oldest-first eviction
3. `readNotificationEvents()` still preserves the same cursor/reset contract while reading from the bounded owner

User-visible impact:

1. no direct UI change
2. long-lived adapter sessions should be less likely to retain multi-megabyte notification payload windows in memory

Verification evidence:

1. [AppServerNotificationBufferOwner.test.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Tests/AppServerNotificationBufferOwner.test.ts)
2. [AppServerTransport.test.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Tests/AppServerTransport.test.ts)
3. [AppServerClient.test.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Tests/AppServerClient.test.ts)
4. `bun run --cwd packages/CodexInterfaceAdapter test -- Tests/AppServerNotificationBufferOwner.test.ts Tests/AppServerTransport.test.ts Tests/AppServerClient.test.ts`
5. `bun run --cwd packages/CodexInterfaceAdapter build`

### March 9, 2026: App-Server Ingress Rejects Oversized Lines Before Parse

Changed owner modules:

1. [AppServerTransport.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerTransport.ts)
2. [AppServerIncomingLineParser.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerIncomingLineParser.ts)
3. [AppServerNotificationBufferOwner.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerNotificationBufferOwner.ts)
4. [AppServerChildProcessTransportOptionsContract.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerChildProcessTransportOptionsContract.ts)
5. [AppServerTransportConstants.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerTransportConstants.ts)
6. [AppServerTransport.test.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Tests/AppServerTransport.test.ts)
7. [AppServerNotificationBufferOwner.test.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Tests/AppServerNotificationBufferOwner.test.ts)

Implementation summary:

1. the app-server transport now enforces a strict maximum incoming stdout line size before JSON parsing continues
2. oversized JSON-RPC lines now fail hard with a transport error and close the transport instead of flowing into deeper parse and retention paths
3. notification retention now uses the already-available raw line length estimate from the transport instead of calling `JSON.stringify` on parsed notification payloads just to measure retention cost

User-visible impact:

1. long-lived stable API sessions should be less likely to climb toward heap OOM from a single oversized app-server line or repeated large notification payloads
2. if the app-server emits an oversized protocol line, the failure should now be immediate and explicit rather than surfacing later as memory pressure

Verification evidence:

1. [AppServerTransport.test.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Tests/AppServerTransport.test.ts)
2. [AppServerNotificationBufferOwner.test.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Tests/AppServerNotificationBufferOwner.test.ts)
3. [AppServerClient.test.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Tests/AppServerClient.test.ts)
4. `bun run --cwd packages/CodexInterfaceAdapter test -- Tests/AppServerNotificationBufferOwner.test.ts Tests/AppServerTransport.test.ts Tests/AppServerClient.test.ts`
5. `bun run --cwd packages/CodexInterfaceAdapter build`
6. `bun run end-to-end:real:mobile-soak:stable`
7. stable Chromium soak on Monday, March 9, 2026, passed clean on build `2026-03-09T23-13-31-894Z` with `freezeCount=0`, no sentinel API/banner/page failures, and stable status returned to `ready` with `crashSummary: null`
8. this is a bounded-ingress mitigation, not full proof that multi-hour stable OOM is eliminated; longer stable observation is still needed

### March 9, 2026: Hidden Mobile Sidebar Stops Re-rendering On Non-Readiness Churn

Changed owner modules:

1. [ApplicationShellSidebarRegion.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/UserInterface/ApplicationShellSidebarRegion.tsx)
2. [ApplicationShellSidebarRegion.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ApplicationShellSidebarRegion.test.ts)

Implementation summary:

1. the sidebar shell region now uses a visibility-aware memo comparator similar to the main region
2. while the mobile sidebar is closed, heavy thread-list/runtime-summary prop churn no longer forces sidebar-region commits
3. hidden-sidebar suppression still allows readiness-critical `threadListState` and `isCoreLoading` transitions through, so the mobile sidebar can move from `loading` to `ready` before it is opened

User-visible impact:

1. mobile browsing should do less hidden sidebar commit work while the user stays in the chat surface
2. the sidebar no longer regresses into a stuck `Loading threads...` state from over-aggressive hidden-tree memo suppression

Verification evidence:

1. [ApplicationShellSidebarRegion.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ApplicationShellSidebarRegion.test.ts)
2. [ApplicationShellMainRegion.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ApplicationShellMainRegion.test.ts)
3. `bun run --cwd apps/WebApplication typecheck`
4. stable Chromium soak rerun on Monday, March 9, 2026, completed all three iterations with `freezeCount=0` and no sentinel API/banner/page failures; the only remaining failure was the already-known push-route queue-delay budget on hidden push diagnostics routes

### March 9, 2026: App-Server Notification Identity Is Projected Once At Ingress

Changed owner modules:

1. [AppServerNotificationIdentityContract.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerNotificationIdentityContract.ts)
2. [AppServerNotificationBufferOwner.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerNotificationBufferOwner.ts)
3. [AppServerTransport.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerTransport.ts)
4. [CodexThreadInteractionOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexThreadInteractionOwner.ts)
5. [AppServerNotificationIdentityContract.test.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Tests/AppServerNotificationIdentityContract.test.ts)
6. [CodexThreadInteractionOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/CodexThreadInteractionOwner.test.ts)

Implementation summary:

1. app-server notification `threadId` and `turnId` are now parsed once at transport ingress and stored on the typed notification event
2. the app-server `readStreamEvents` path no longer Zod-parses notification envelopes inside its hot filter loop on every selected-thread read
3. downstream stream-frame creation now consumes strict projected notification identity instead of reparsing raw payloads

User-visible impact:

1. app-server selected-thread stream reads should do less repeated parse work under notification-heavy sessions
2. this reduces one concrete source of send-path and selected-thread reread variance when the adapter is in app-server mode

Verification evidence:

1. [AppServerNotificationIdentityContract.test.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Tests/AppServerNotificationIdentityContract.test.ts)
2. [AppServerNotificationBufferOwner.test.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Tests/AppServerNotificationBufferOwner.test.ts)
3. [AppServerTransport.test.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Tests/AppServerTransport.test.ts)
4. [AppServerClient.test.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Tests/AppServerClient.test.ts)
5. [CodexThreadInteractionOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/CodexThreadInteractionOwner.test.ts)
6. `bun run --cwd packages/CodexInterfaceAdapter build`
7. `bun run --cwd apps/ServerApplication typecheck`
8. stable Chromium soak rerun on Monday, March 9, 2026, completed all three iterations with zero sentinel API/banner/page failures; the remaining failure was the separate push-route queue-delay budget


### March 7, 2026: Send Path Stops Blocking On Full Thread Read For Turn Template

Changed owner modules:

1. [CodexMessageDispatchOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexMessageDispatchOwner.ts)

Implementation summary:

1. server-side send now uses the projected turn-start template when it already exists in stream-owned state
2. if projected state does not expose a template, the send path starts the turn immediately without doing a blocking `thread/read` first

User-visible impact:

1. `POST /api/threads/:threadId/messages` no longer spends route-critical time rereading the full thread just to recover a turn-start template
2. raw send HTTP should return faster in template-missing cases, even though total user-visible turn completion time still depends on Codex turn execution

Verification evidence:

1. [CodexMessageDispatchOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/CodexMessageDispatchOwner.test.ts)
2. [ThreadMemberMutationRouteOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadMemberMutationRouteOwner.test.ts)
3. `bun run --cwd apps/ServerApplication typecheck`
4. unchanged real soak stayed green on Saturday, March 7, 2026, with no new sentinel errors

### March 7, 2026: Thread Delta Publisher Emits Live-State-Only First Updates

Changed owner modules:

1. [ThreadStreamDeltaEventPublisher.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ThreadStreamDeltaEventPublisher.ts)

Implementation summary:

1. server-side thread delta publication no longer suppresses an update solely because the stream-event batch is empty
2. if live thread state changed and the last broadcast snapshot differs, the publisher now emits a delta even when `stream-events` is temporarily empty

User-visible impact:

1. the first visible thread-state update after turn start no longer has to wait for a non-empty stream-event batch when live conversation state already advanced
2. managed-thread soak send timings still vary with turn execution, but the clean-stack rerun reduced the first iteration send step to `2822ms` and kept the run green

Verification evidence:

1. [ThreadStreamDeltaEventPublisher.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadStreamDeltaEventPublisher.test.ts)
2. `bun run --cwd apps/ServerApplication test -- Tests/ThreadStreamDeltaEventPublisher.test.ts Tests/CodexMessageDispatchOwner.test.ts`
3. `bun run --cwd apps/ServerApplication typecheck`
4. unchanged real soak passed on Saturday, March 7, 2026, with step timings `sendMs=2822`, `7122`, `7345` and no new sentinel errors

### March 7, 2026: Accepted Send Now Stages Optimistic In-Progress Turn Before First Inbound Stream Frame

Changed owner modules:

1. [CodexMessageDispatchOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexMessageDispatchOwner.ts)
2. [CodexThreadLiveStateProjectionOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexThreadLiveStateProjectionOwner.ts)
3. [CodexThreadStreamStateOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexThreadStreamStateOwner.ts)
4. [ThreadMemberMessageMutationRouteOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/ThreadMemberMessageMutationRouteOwner.ts)

Implementation summary:

1. after send acceptance, Codex server projection now stages a minimal optimistic in-progress turn in live state when a projected conversation baseline already exists
2. the message mutation route now schedules one immediate thread delta publish after successful send so web clients can observe that optimistic state before the first inbound `thread-stream-state-changed` frame arrives

User-visible impact:

1. assistant-visible progression can begin earlier on accepted sends because the client no longer waits solely for the first upstream stream-state event before seeing an in-progress turn
2. latest clean-stack real soak improved the first iteration send step to `1885ms`, with later iterations at `5365ms` and `8477ms`, while keeping the run green

Verification evidence:

1. [CodexMessageDispatchOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/CodexMessageDispatchOwner.test.ts)
2. [CodexThreadStreamStateOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/CodexThreadStreamStateOwner.test.ts)
3. [ThreadMemberMutationRouteOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadMemberMutationRouteOwner.test.ts)
4. [ThreadMemberReadRouteOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadMemberReadRouteOwner.test.ts)
5. [ThreadRoutes.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadRoutes.test.ts)
6. [ThreadMemberRoutes.integration.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadMemberRoutes.integration.test.ts)
7. `bun run --cwd apps/ServerApplication typecheck`
8. unchanged real soak passed on Saturday, March 7, 2026, with step timings `sendMs=1885`, `5365`, `8477` and no new sentinel errors

### March 7, 2026: Debug Observability Now Measures Send-To-Progression Milestones

Changed owner modules:

1. [ThreadSendProgressObservabilityOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ThreadSendProgressObservabilityOwner.ts)
2. [ThreadStreamDeltaEventPublisher.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ThreadStreamDeltaEventPublisher.ts)
3. [ThreadMemberMessageMutationRouteOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/ThreadMemberMessageMutationRouteOwner.ts)
4. [ServerObservabilitySnapshotOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ServerObservabilitySnapshotOwner.ts)
5. [FarfieldServer.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexProtocol/Source/FarfieldServer.ts)

Implementation summary:

1. server debug observability now records accepted send, first inbound `thread-stream-state-changed`, first published `thread-stream-delta`, and first assistant-visible progress as one bounded per-thread progression timeline
2. `/api/debug/observability` now exposes summarized `threadSendProgression` metrics so later latency work can distinguish Farfield-side delay from upstream Codex/app-server delay

User-visible impact:

1. this is a diagnostics-only improvement, but it makes the remaining send latency measurable instead of inferred from coarse soak timings alone
2. follow-up latency work can now target the actual slow segment instead of continuing to guess between route latency, publish latency, and upstream turn execution latency

Verification evidence:

1. [ThreadSendProgressObservabilityOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadSendProgressObservabilityOwner.test.ts)
2. [ThreadStreamDeltaEventPublisher.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadStreamDeltaEventPublisher.test.ts)
3. [ServerObservabilitySnapshotOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ServerObservabilitySnapshotOwner.test.ts)
4. [ProtocolAppServerSchemas.test.ts](/Users/matthewfrench/GitHub/farfield/packages/CodexProtocol/Tests/ProtocolAppServerSchemas.test.ts)
5. unchanged real soak passed on Saturday, March 7, 2026, with step timings `sendMs=2230`, `6244`, `6949` and no new sentinel errors
6. direct local probe after `POST /api/threads/:threadId/messages` recorded `lastAcceptedToFirstInboundThreadStreamStateChangedMs=141` and `lastAcceptedToFirstPublishedThreadDeltaMs=177` in `/api/debug/observability`

### March 7, 2026: Stop Sidebar Active-List Leaks From Loaded Archived Threads

Changed owner modules:

1. [ThreadListAggregationSnapshotLoader.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/ThreadListAggregationSnapshotLoader.ts)
2. [ThreadListCacheInvalidationOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Application/Bootstrap/ThreadListCacheInvalidationOwner.ts)
3. [ThreadCollectionRoutes.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadCollectionRoutes.test.ts)
4. [SidebarThreadSyncRoutes.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/SidebarThreadSyncRoutes.test.ts)
5. [ThreadListCacheInvalidationOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadListCacheInvalidationOwner.test.ts)

Implementation summary:

1. thread-list aggregation no longer backfills loaded in-memory threads that were omitted from the adapter list response
2. this keeps `/api/threads` and `/api/sidebar/threads/sync` aligned with the requested query semantics instead of leaking loaded archived or out-of-scope threads into the active sidebar
3. thread-name mutations now invalidate both active and archived thread-list caches so archived-thread titles do not stay stale behind sidebar sync snapshots after rename

User-visible impact:

1. active sidebar lists stop surfacing archived threads just because they were still loaded in memory
2. tapping an older active-sidebar thread is less likely to jump into an invalid archived target and trigger `runtime-request-error`
3. archived-thread titles refresh after rename instead of staying stale until cache expiry

Verification evidence:

1. [ThreadCollectionRoutes.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadCollectionRoutes.test.ts)
2. [SidebarThreadSyncRoutes.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/SidebarThreadSyncRoutes.test.ts)
3. [ThreadListCacheInvalidationOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadListCacheInvalidationOwner.test.ts)
4. `bun run --cwd apps/ServerApplication typecheck`
5. unchanged real soak passed on Saturday, March 7, 2026, with step timings `sendMs=3124`, `7193`, `9290`, one `166ms` freeze window, and zero new sentinel API/banner/page errors
6. live remote verification on `https://farfield.matthewfrench.io` after restart showed `POST /api/sidebar/threads/sync` returning `activeCount=49`, `archivedCount=188`, and `duplicatedThreadIds=[]`
7. live remote verification also opened `https://farfield.matthewfrench.io/threads/019cc584-3d22-7500-91f4-37199ccb1ade` from the active sidebar without a visible `runtime-request-error`, and `/api/debug/client-errors?limit=10` only contained restart-window `503` entries

### March 7, 2026: Clear Stale Archived Thread Selections And Prune Proven-Missing Entries

Changed owner modules:

1. [UseSelectedThreadLifecycleEffects.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/StateManagement/UseSelectedThreadLifecycleEffects.ts)
2. [ApplicationRuntimeCompositionDependencyBuilders.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/ApplicationRuntimeCompositionDependencyBuilders.ts)
3. [UseSelectedThreadLifecycleEffects.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseSelectedThreadLifecycleEffects.test.tsx)
4. [ThreadUnreadableStateOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ThreadUnreadableStateOwner.ts)
5. [ThreadMemberReadRouteOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/ThreadMemberReadRouteOwner.ts)
6. [ThreadListAggregationSnapshotLoader.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/ThreadListAggregationSnapshotLoader.ts)
7. [ServerRequestRouteDispatchOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ServerRequestRouteDispatchOwner.ts)
8. [ServerRequestHandler.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ServerRequestHandler.ts)
9. [ServerBootstrap.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Application/ServerBootstrap.ts)
10. [ThreadCollectionRoutes.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadCollectionRoutes.test.ts)
11. [SidebarThreadSyncRoutes.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/SidebarThreadSyncRoutes.test.ts)
12. [ThreadMemberReadRouteOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadMemberReadRouteOwner.test.ts)

Implementation summary:

1. selected-thread lifecycle recovery now treats plain read `404` and `thread not loaded` responses as stale selection even when the bad thread still exists in cached sidebar state
2. the lifecycle owner clears the selected thread, clears the runtime error banner, and refreshes thread lists instead of preserving the stale archived selection and surfacing `runtime-request-error`
3. the server now records thread IDs proven unreadable by direct read routes and filters them out of later `/api/threads` and `/api/sidebar/threads/sync` projections until a later successful direct read clears them
4. missing-thread reads now invalidate thread-list caches with explicit all-scope invalidation so the archived sidebar can drop the stale entry promptly

User-visible impact:

1. tapping a stale archived thread no longer leaves the app stuck behind the red `runtime-request-error` banner
2. after that stale thread is proven missing once, it is pruned out of archived sidebar data instead of remaining tappable on later reloads
3. mobile remote sessions recover back to `No thread selected` / the root route instead of preserving a dead archived thread route

Verification evidence:

1. [UseSelectedThreadLifecycleEffects.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseSelectedThreadLifecycleEffects.test.tsx)
2. [ApplicationRuntimeComposition.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ApplicationRuntimeComposition.test.tsx)
3. [ThreadCollectionRoutes.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadCollectionRoutes.test.ts)
4. [SidebarThreadSyncRoutes.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/SidebarThreadSyncRoutes.test.ts)
5. [ThreadMemberReadRouteOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadMemberReadRouteOwner.test.ts)
6. [ThreadListCacheInvalidationOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Tests/ThreadListCacheInvalidationOwner.test.ts)
7. `bun run --cwd apps/WebApplication typecheck`
8. `bun run --cwd apps/ServerApplication typecheck`
9. unchanged real soak passed on Saturday, March 7, 2026, with step timings `sendMs=5005`, `6777`, `6540`, one `149ms` freeze window, and zero new sentinel API/banner/page errors
10. live remote verification on `https://farfield.matthewfrench.io/threads/019cc17a-1b65-7ef3-9c15-e7cfc6494273` now redirects to `/`, shows no selected thread, and `/api/debug/client-errors?limit=10` stays empty after the correction
11. live remote verification now reports `archivedHasMissingThread=false` for `019cc17a-1b65-7ef3-9c15-e7cfc6494273` in archived sidebar sync after the stale route is exercised once

### March 7, 2026: Sidebar Cache Hits Now Revalidate Asynchronously

Changed owner modules:

1. [CoreDataStartupLoader.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/CoreDataStartupLoader.ts)
2. [ArchivedThreadLoader.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/ArchivedThreadLoader.ts)
3. [UseCoreDataLoaders.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseCoreDataLoaders.ts)
4. [UseCoreDataLoaders.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseCoreDataLoaders.test.tsx)

Implementation summary:

1. startup active-thread loads still apply cached sidebar data immediately when available, but cached startup hits now schedule a deferred network revalidation using `startup-deferred.threads.active.revalidate`
2. archived-thread loads now follow the same pattern: apply cached archived data immediately, then revalidate from network in the background without blocking the visible sidebar
3. explicit active-thread refreshes remain network-first, so mutation-driven sidebar refresh paths still bypass cache when they already requested a tracked refresh

User-visible impact:

1. sidebar data now appears immediately on refresh while still getting a guaranteed freshness pass soon after load
2. active and archived thread names/previews are less likely to stay stale just because the initial sidebar read hit cache
3. this reduces the window where old cached sidebar data can linger until some unrelated invalidation or TTL expiry

Verification evidence:

1. [UseCoreDataLoaders.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseCoreDataLoaders.test.tsx)
2. `bun run --cwd apps/WebApplication typecheck`
3. unchanged real soak passed on Saturday, March 7, 2026, with step timings `sendMs=1765`, `6442`, `6197`, zero new sentinel API/banner/page errors, and no visible runtime banner regressions

### March 7, 2026: Manual Sidebar Refresh Now Refreshes Both Lists And Shows Activity

Changed owner modules:

1. [ThreadListStateController.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListStateController.ts)
2. [UseApplicationShellViewProperties.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseApplicationShellViewProperties.ts)
3. [UseApplicationShellComposition.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseApplicationShellComposition.ts)
4. [ThreadListActiveSection.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Threads/UserInterface/ThreadListActiveSection.tsx)
5. [UseApplicationShellViewProperties.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseApplicationShellViewProperties.test.ts)
6. [ThreadListPane.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ThreadListPane.test.tsx)

Implementation summary:

1. the settings-panel refresh action now clears both active and archived thread-query baselines before running the tracked core refresh
2. this prevents manual refresh from only forcing the active list while leaving archived sidebar data on stale cached snapshots
3. the active thread-list header now shows a subtle `Refreshing` indicator while sidebar/core thread data is reloading

User-visible impact:

1. manual refresh from settings now targets the whole sidebar instead of only the active-thread slice
2. sidebar refresh work is visibly indicated without needing the user to infer that anything is happening
3. thread list changes are less likely to appear “stuck” until a full page reload after a manual refresh

Verification evidence:

1. [UseApplicationShellViewProperties.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseApplicationShellViewProperties.test.ts)
2. [ThreadListPane.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ThreadListPane.test.tsx)
3. [UseCoreDataLoaders.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseCoreDataLoaders.test.tsx)
4. `bun run --cwd apps/WebApplication typecheck`
5. unchanged real soak passed on Saturday, March 7, 2026, with step timings `sendMs=2158`, `6741`, `11752`, zero new sentinel API/banner/page errors, and no refresh-path banner regressions

### March 7, 2026: Sidebar No Longer Starts Empty While Thread Presentation Worker Runs

Changed owner modules:

1. [UseThreadListPresentationDerivedState.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseThreadListPresentationDerivedState.ts)
2. [UseApplicationDerivedState.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseApplicationDerivedState.test.tsx)

Implementation summary:

1. worker-backed thread-list presentation now computes an immediate in-thread presentation state instead of starting from an empty placeholder state
2. the worker result still applies later, but it no longer gates the initial existence of sidebar project groups and rows
3. this removes one source of sidebar row pop-in where items appeared only after the presentation worker responded

User-visible impact:

1. sidebar thread rows and project groups appear immediately from current app state instead of popping in from an empty baseline
2. mobile sidebar scrolling and initial reveal should feel less like the list is rendering late while content catches up asynchronously
3. this reduces one avoidable main-thread/UI perception issue without weakening the worker optimization path

Verification evidence:

1. [UseApplicationDerivedState.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseApplicationDerivedState.test.tsx)
2. `bun run --cwd apps/WebApplication typecheck`
3. unchanged real soak passed on Saturday, March 7, 2026, with step timings `sendMs=1842`, `7947`, `6709`, zero new sentinel API/banner/page errors, and freeze summary `count=1 totalFreezeMs=150`

### March 7, 2026: Non-PWA Web Worker Defaults Removed

Changed owner modules:

1. [ApplicationBehaviorConfiguration.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/Configuration/ApplicationBehaviorConfiguration.ts)
2. [FarfieldHttpTransport.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransport.ts)

Implementation summary:

1. event-stream refresh decisions now default to in-thread execution instead of a dedicated worker
2. derived web computation defaults now run in-thread instead of worker mode:
   thread-list presentation, debug issue derivation, and conversation item flattening
3. HTTP response decode now defaults to in-thread execution instead of a dedicated decode worker
4. service worker behavior remains unchanged for push/PWA/update handling

User-visible impact:

1. removes worker roundtrip overhead and worker-lifecycle complexity from normal web runtime paths
2. keeps the same features while simplifying the execution model behind sidebar, chat, and debug derived-state flows
3. reduces the number of moving concurrency surfaces that can contribute to mobile roughness while preserving the service worker path that is actually needed

Verification evidence:

1. [UseApplicationDerivedState.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseApplicationDerivedState.test.tsx)
2. [UseCoreDataLoaders.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseCoreDataLoaders.test.tsx)
3. [ThreadListPane.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ThreadListPane.test.tsx)
4. [UseApplicationShellViewProperties.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseApplicationShellViewProperties.test.ts)
5. `bun run --cwd apps/WebApplication typecheck`
6. unchanged real soak passed on Saturday, March 7, 2026, with step timings `sendMs=2710`, `7304`, `6108`, zero new sentinel API/banner/page errors, and freeze summary `count=1 totalFreezeMs=167`

### March 7, 2026: Former Worker Work Now Emits Named In-Thread Performance Operations

Changed owner modules:

1. [EventStreamRefreshDecisionEngine.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/EventStreamRefreshDecisionEngine.ts)
2. [UseApplicationDebugIssueDerivedState.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseApplicationDebugIssueDerivedState.ts)
3. [ConversationItemFlattener.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/DomainModel/ConversationItemFlattener.ts)
4. [ThreadListPresentationStateResolver.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListPresentationStateResolver.ts)
5. [FarfieldHttpResponseDecodeOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Shared/Transport/FarfieldHttpResponseDecodeOwner.ts)

Implementation summary:

1. the client performance probe now records named in-thread operations for the work that was previously delegated to optional web workers
2. current operation names include:
   `event-stream-refresh-decision-in-thread`
   `debug-issue-derive-in-thread`
   `conversation-item-flatten-in-thread`
   `thread-list-presentation-in-thread`
   `http-response-decode-in-thread`
3. this makes freeze artifacts and manual browser probe snapshots easier to correlate with concrete in-thread computation surfaces instead of only broad request or commit timing

User-visible impact:

1. no direct user-facing behavior changed from this telemetry alone
2. freeze debugging is easier because formerly worker-owned work now appears under explicit names in the client performance probe

Verification evidence:

1. [EventStreamRefreshDecisionEngine.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/EventStreamRefreshDecisionEngine.test.ts)
2. [FarfieldHttpResponseDecodeWorkerOwner.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/FarfieldHttpResponseDecodeWorkerOwner.test.ts)
3. [UseApplicationDerivedState.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseApplicationDerivedState.test.tsx)
4. [UseCoreDataLoaders.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseCoreDataLoaders.test.tsx)
5. [ThreadListPane.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ThreadListPane.test.tsx)
6. [UseApplicationShellViewProperties.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseApplicationShellViewProperties.test.ts)
7. `bun run --cwd apps/WebApplication typecheck`
8. manual browser probe on Saturday, March 7, 2026, showed client performance operation names including `conversation-item-flatten-in-thread`, `debug-issue-derive-in-thread`, `event-stream-refresh-decision-in-thread`, and `http-response-decode-in-thread`

### March 7, 2026: Chat Visible-Item Derivation Stops Materializing Hidden History Entries

Changed owner modules:

1. [ConversationItemFlattener.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/DomainModel/ConversationItemFlattener.ts)
2. [UseFlatConversationItemsDerivedState.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseFlatConversationItemsDerivedState.ts)
3. [UseApplicationDerivedState.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseApplicationDerivedState.ts)
4. [UseApplicationDerivedStateContracts.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseApplicationDerivedStateContracts.ts)
5. [ConversationItemFlattener.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ConversationItemFlattener.test.ts)
6. [UseFlatConversationItemsDerivedState.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseFlatConversationItemsDerivedState.test.tsx)
7. [UseApplicationDerivedState.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseApplicationDerivedState.test.tsx)

Implementation summary:

1. chat derived state now computes total renderable conversation item count separately from visible item materialization
2. the flattener now creates `FlattenedConversationItem` records only for the visible suffix needed by the UI instead of materializing the full hidden history and slicing afterward
3. this reduces object creation and per-item derivation work for large threads where most older items are currently hidden behind `Show older messages`

User-visible impact:

1. large chat histories should do less post-request work before rendering the currently visible conversation section
2. hidden older messages still contribute to the count shown in the `Show older messages` affordance, but they no longer require full visible-item object materialization on every update

Verification evidence:

1. [ConversationItemFlattener.test.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/ConversationItemFlattener.test.ts)
2. [UseFlatConversationItemsDerivedState.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseFlatConversationItemsDerivedState.test.tsx)
3. [UseApplicationDerivedState.test.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Tests/UseApplicationDerivedState.test.tsx)
4. `bun run --cwd apps/WebApplication typecheck`
5. unchanged real soak rerun after this change did not produce a clean comparison signal because the local app-server hit upstream timeout churn and emitted `500` thread/runtime route errors during the scenario; treat the focused tests as valid and re-run the real soak on a settled stack before using this change as freeze evidence

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
9. the latest Chromium rerun with substep timing showed the dominant iteration cost is currently the send-and-wait path, not sidebar open or reload restore
10. the latest connected-thread send-path change reduced the `POST /api/threads/:threadId/messages` duration and shortened later iteration send timings, although total route volume still varies run to run

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
