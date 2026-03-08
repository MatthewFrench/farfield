# Runtime Bad Design Follow-ups

This document tracks confirmed or strongly suspected design decisions that harmed Farfield runtime behavior, especially on mobile web.

Use it as:

1. a shortlist of high-impact follow-up targets
2. a reminder of which bad patterns already had partial mitigation
3. a review checklist for future runtime-sensitive changes

## Current Goal

Bring the mobile web experience closer to:

1. immediate sidebar rendering
2. near-zero visible freezes
3. delta-proportional data processing
4. minimal broad rerender after network completion

## Confirmed High-Impact Bad Decisions

### 1. Thread list presentation started empty while worker output was pending

Files:

1. [UseThreadListPresentationDerivedState.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseThreadListPresentationDerivedState.ts)
2. [ThreadListPresentationWorkerOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListPresentationWorkerOwner.ts)

Why it was bad:

1. the sidebar could have active thread data in memory but still render no project groups and no rows until an async worker roundtrip completed
2. this created visible row pop-in and made scrolling/reveal feel delayed even before any real heavy work occurred

Current status:

1. mitigated
2. the sidebar now computes immediate in-thread presentation state first

### 2. Optional worker execution was overused for normal web runtime paths

Files:

1. [ApplicationBehaviorConfiguration.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/Configuration/ApplicationBehaviorConfiguration.ts)
2. [UseApplicationOwnerDependencies.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseApplicationOwnerDependencies.ts)
3. [FarfieldHttpTransport.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransport.ts)

Why it was bad:

1. event refresh decisions, thread-list presentation, debug issue derivation, conversation flattening, and HTTP decode all had worker-mode execution paths in normal runtime
2. this added message-passing, async ordering complexity, and extra failure/reload surfaces for work that is not clearly large enough to justify it
3. it made debugging freezes harder because work was split across too many execution surfaces

Current status:

1. mitigated
2. normal runtime defaults are now in-thread, while service worker behavior remains for push/PWA/update

### 3. Selected thread stream event equality uses JSON serialization on event objects

Files:

1. [SelectedThreadStreamEventStateResolver.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/DomainModel/SelectedThreadStreamEventStateResolver.ts)

Why it is bad:

1. equality falls back to `JSON.stringify` per event when object identity differs
2. this is a hot-path pattern that scales work by payload size rather than by explicit stable event identity
3. it is exactly the kind of design that can turn small stream updates into unnecessary main-thread work

Current status:

1. open

### 4. Conversation flattening still recomputes from the full turn list

Files:

1. [ConversationItemFlattener.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/DomainModel/ConversationItemFlattener.ts)
2. [UseFlatConversationItemsDerivedState.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseFlatConversationItemsDerivedState.ts)

Why it is risky:

1. the UI only needs visible conversation items, but flattening still walks the full turn collection
2. large thread histories can make post-request state application and chat rerender broader than necessary
3. this violates the desired delta-proportional update model

Current status:

1. partially mitigated
2. visible chat derivation now materializes only the visible suffix instead of constructing flattened item records for the entire hidden history
3. remaining follow-up is to review whether total renderable-count scans can also be reduced further under large histories

### 5. Thread/project grouping still does broad collection work

Files:

1. [ThreadListPresentationStateResolver.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListPresentationStateResolver.ts)
2. [ThreadProjectGroupingStateOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Threads/StateManagement/ThreadProjectGroupingStateOwner.ts)

Why it is risky:

1. grouping is incremental-aware, but group sorting and merged presentation work still operate at collection scope
2. for current sidebar sizes this is probably not the dominant freeze source, but it is broader than ideal
3. it should stay under scrutiny if sidebar counts grow or if request bursts land repeatedly

Current status:

1. open

### 6. Selected-thread state application still updates broad state slices after request completion

Files:

1. [SelectedThreadSnapshotStateOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/StateManagement/SelectedThreadSnapshotStateOwner.ts)

Why it is risky:

1. request completion can still replace `liveState`, `readThreadState`, and `streamEvents` slices rather than patching a narrower owner model
2. even when correctness checks skip identical state, the design still encourages broad follow-up work after data lands

Current status:

1. open

### 7. Server-side thread list backfill violated query semantics

Files:

1. [ThreadListAggregationSnapshotLoader.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/ThreadListAggregationSnapshotLoader.ts)
2. [SidebarThreadSyncRoutes.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/SidebarThreadSyncRoutes.ts)
3. [ThreadCollectionRoutes.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/ThreadCollectionRoutes.ts)

Why it was bad:

1. loaded in-memory thread IDs missing from adapter list results were previously backfilled by direct thread reads without re-checking `archived` or `cwd` query semantics
2. this let active list/sidebar queries surface archived or otherwise out-of-scope threads

User-visible impact:

1. tapping a thread from the active sidebar could select an archived or stale target by mistake
2. active and archived sidebar surfaces could disagree with intended query semantics

Current status:

1. mitigated

### 8. Archived-query freshness relied too heavily on TTL and cache luck

Files:

1. [ThreadListCacheInvalidationOwner.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Application/Bootstrap/ThreadListCacheInvalidationOwner.ts)
2. [SidebarThreadSyncSnapshotCache.ts](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/SidebarThreadSyncSnapshotCache.ts)

Why it was bad:

1. archived-thread names and other archived-query changes could remain stale until cache expiry when invalidation scope only targeted active queries
2. sidebar sync could affirm a cached archived snapshot as `notModified` even when the user really needed fresh archived data

User-visible impact:

1. archived names or stale archived entries could stay visible longer than expected
2. manual recovery often felt inconsistent because cache freshness depended on invalidation timing

Current status:

1. partially mitigated
2. archived name invalidation and proven-missing archived pruning were fixed
3. archived freshness policy should still be reviewed when more sidebar/runtime work is done

## Confirmed Mitigations Already Landed

### Sidebar freshness and stale selection

Landed:

1. cache-hit sidebar reads now revalidate asynchronously
2. stale archived-thread selections clear instead of trapping the UI behind `runtime-request-error`
3. proven-missing archived entries are pruned from later sidebar responses
4. manual refresh now refreshes both active and archived thread lists
5. the sidebar now shows a subtle `Refreshing` indicator

### Rename route correctness

Landed:

1. thread naming now preserves adapter instance context

### Blocking telemetry

Landed:

1. server observability now exposes coordinator blocking wait for:
   - per-thread serialized operations
   - push mutation serialization
2. client performance probe now exposes named in-thread operations for former worker work

## Strong Current Hypothesis About Remaining Freezes

The remaining mobile freezes look more like:

1. bursty request completion followed by broad state apply and commit work
2. not one single obviously catastrophic computation function

Evidence so far:

1. recent clean freeze artifacts were dominated by overlapping `http-request` windows rather than one named in-thread computation surface
2. named former-worker computations are now visible, but they have not yet shown up as the dominant overlap in the clean soak artifacts

## Next Remediation Order

1. remove `JSON.stringify`-based stream-event equality from [SelectedThreadStreamEventStateResolver.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/DomainModel/SelectedThreadStreamEventStateResolver.ts)
2. reduce full-conversation flattening for large chats
3. reduce bursty post-request apply and rerender fan-out
4. keep sidebar rendering immediate and in-place under mobile scroll

## Fine-Tooth-Comb Audit Prompts

Use subagents/explorers to look for:

1. whole-state replacement after small deltas
2. JSON serialization or text diffing in hot paths
3. broad `map/filter/sort` work in render-critical paths
4. derived state that starts empty while async refinement is pending
5. request bursts that update unrelated state together
6. expensive equality/signature checks that scale with total payload size

Completed audit passes already identified:

1. hot-path stream equality and refresh trigger issues in selected-thread refresh ownership
2. server/sidebar query-semantic violations and archived-cache freshness asymmetry

## Review Rule

For runtime-sensitive code, prefer:

1. immediate cached state
2. async freshness revalidation
3. delta-proportional apply
4. in-place render updates
5. explicit, named telemetry for every non-trivial computation surface
