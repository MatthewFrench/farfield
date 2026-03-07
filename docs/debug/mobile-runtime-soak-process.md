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
