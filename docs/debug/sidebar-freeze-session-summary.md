# Sidebar Freeze Session Summary

This document is the quickest handoff for another agent working on Farfield mobile freeze and delay issues.

Use this together with:

1. [mobile-freeze-profiling.md](/Users/matthewfrench/GitHub/farfield/docs/debug/mobile-freeze-profiling.md)
2. [mobile-freeze-baseline-log.md](/Users/matthewfrench/GitHub/farfield/docs/debug/mobile-freeze-baseline-log.md)
3. [sidebar-thread-sync-plan.md](/Users/matthewfrench/GitHub/farfield/docs/debug/sidebar-thread-sync-plan.md)

## Scope

This session focused on:

1. mobile sidebar freezes and visible delay
2. request volume and request breadth during sidebar interaction
3. repeated real-app profiling on Chromium mobile and WebKit mobile
4. comparing sidebar-open against thread-open

## Best Stable Checkpoint

The best measured committed checkpoint from this session is:

1. `13351aa` `Retain sidebar baselines and dedupe runtime summary reads`

Why that checkpoint matters:

1. It removed most duplicate sidebar work.
2. It reduced the sidebar loop to one request each for:
   - `/api/sidebar/threads/sync`
   - `/api/apps`
   - `/api/account`
   - `/api/account/rate-limits`
3. It kept the cache-first sidebar behavior intact.

Measured-good state at that checkpoint:

Chromium mobile repeated sidebar profile:

1. freeze count: `4`
2. total freeze duration: `1201ms`
3. max freeze duration: `684ms`

WebKit mobile repeated sidebar profile:

1. freeze count: `4`
2. total freeze duration: `3911ms`
3. max freeze duration: `3404ms`

If you need to reproduce the best committed result, start from a clean tree at `13351aa` or later, but ignore newer uncommitted experiments until they are revalidated.

## Committed Improvement Sequence

These commits are the main sidebar-freeze improvement chain from this session:

1. `3f0ec10` `Add mobile freeze profiling and WebKit mobile automation`
   - added the real-app mobile freeze profiling loop and artifact pipeline
2. `c26f062` `Fix real-app mobile profiling helpers`
   - fixed the profiling helpers so artifacts and sentinel output were usable
3. `16fc837` `Allow real-app profile env overrides`
   - made repeated profiling easier to tune and rerun
4. `478aa22` `Render only the active sidebar viewport on mobile`
   - stopped mounting both sidebar trees on mobile
5. `78a8d53` `Cut mobile sidebar duplicate and deferred work`
   - visibility-gated and deferred noncritical sidebar work
6. `3594649` `Extend thread-list cache lifetimes for passive refreshes`
   - lengthened thread-list cache TTLs for passive refresh paths
7. `9e844ee` `Move sidebar refresh onto a Farfield sync endpoint`
   - introduced `POST /api/sidebar/threads/sync`
   - removed generic `/api/threads` from the normal sidebar refresh loop
8. `13351aa` `Retain sidebar baselines and dedupe runtime summary reads`
   - retained stale baselines for sync reuse
   - deduped sidebar runtime-summary requests

## Baseline Versus Improvement

Primary baseline used in this session:

1. commit under test: `16fc837`

Baseline Chromium mobile sidebar repeated profile:

1. freeze count: `65`
2. total freeze duration: `13100ms`
3. max freeze duration: `651ms`
4. dominant repeated paths:
   - `/api/threads`
   - `/api/agents`
   - `/api/health`

Baseline WebKit mobile sidebar repeated profile:

1. freeze count: `8`
2. total freeze duration: `17512ms`
3. max freeze duration: `11536ms`
4. dominant overlapping paths:
   - `/api/account/rate-limits`
   - `/api/apps`

Most important improvement achieved:

1. The sidebar is no longer primarily blocked by broad `/api/threads` refreshes.
2. Duplicate sidebar requests were cut dramatically.
3. The remaining problem moved from data breadth into UI-side churn.

## What We Measured

The main scenario for this session was:

1. repeated mobile sidebar open/close

Supporting scenario:

1. repeated mobile thread open/selection

The repeated mobile thread-open profile was added in this session:

1. [thread-open-freeze-profile.spec.ts](/Users/matthewfrench/GitHub/farfield/end-to-end/real/scenarios/thread-open-freeze-profile.spec.ts)

Useful result from the repeated thread-open profile:

1. `2` iterations
2. `1` freeze
3. `150ms` total freeze
4. `150ms` max freeze

Interpretation:

1. Thread open is materially healthier than sidebar open.
2. The sidebar remains the dominant mobile interaction problem.

## How To Reproduce

Start the stack:

```bash
pnpm dev
pnpm smoke:app
```

Run the main mobile sidebar profiles:

```bash
E2E_REAL_PERFORMANCE_BUDGET_MODE=warn pnpm end-to-end:real:mobile-freeze-profile
E2E_REAL_PERFORMANCE_BUDGET_MODE=warn pnpm end-to-end:real:mobile-freeze-profile:webkit
```

Run the repeated thread-open profile:

```bash
E2E_REAL_MOBILE_THREAD_OPEN_PROFILE_ITERATIONS=2 \
E2E_REAL_PERFORMANCE_BUDGET_MODE=warn \
pnpm end-to-end:real:mobile-thread-open-freeze-profile
```

Useful artifact paths:

1. `.runtime/end-to-end-performance/browser-mobile-sidebar-freeze-profile.json`
2. `.runtime/end-to-end-performance/webkit-mobile-sidebar-freeze-profile.json`
3. `.runtime/end-to-end-performance/browser-mobile-thread-open-freeze-profile.json`
4. `.runtime/end-to-end-sentinel/latest.ndjson`

## Fast Artifact Queries

Count request paths:

```bash
jq '[.snapshot.completedOperations[] | select(.name=="http-request") | .details.path] | group_by(.) | map({path: .[0], count: length})' .runtime/end-to-end-performance/browser-mobile-sidebar-freeze-profile.json
```

List slow request paths:

```bash
jq '.snapshot.completedOperations | map(select(.name=="http-request") | {path:.details.path,duration:(.completedAtEpochMilliseconds - .startedAtEpochMilliseconds)}) | sort_by(.duration) | reverse | .[0:20]' .runtime/end-to-end-performance/browser-mobile-sidebar-freeze-profile.json
```

Inspect pane render-cause sampling:

```bash
jq '[.snapshot.instantEvents[] | select(.name=="thread-list-pane-committed") | .details.changedFields[]] | group_by(.) | map({field: .[0], count: length})' .runtime/end-to-end-performance/browser-mobile-sidebar-freeze-profile.json
```

Inspect event marker counts:

```bash
jq '[.snapshot.instantEvents[].name] | group_by(.) | map({name: .[0], count: length})' .runtime/end-to-end-performance/browser-mobile-sidebar-freeze-profile.json
```

## Important Findings

By the end of the committed work:

1. Broad thread-list API shape was no longer the main issue.
2. The active-row subtree was no longer the main issue.
3. The remaining issue was mostly pane-parent and shell-side rerender churn.

Strong evidence:

1. sampled pane rerenders often reported `changedFields: ["stable-props-parent-rerender"]`
2. `thread-list-active-section-committed` fired only a couple of times in better runs
3. request count dropped while freezes still remained

## Current Remaining Hotspot

The highest remaining area to investigate is:

1. parent-pane and shell composition rerender churn above [ThreadListPane.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Threads/UserInterface/ThreadListPane.tsx)

Most likely owners to inspect next:

1. [UseApplicationShellViewProperties.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseApplicationShellViewProperties.ts)
2. [UseApplicationShellComposition.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseApplicationShellComposition.ts)
3. [UseThreadListPaneProperties.ts](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Threads/StateManagement/UseThreadListPaneProperties.ts)
4. [ApplicationShellLayout.tsx](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/UserInterface/ApplicationShellLayout.tsx)

## Current Worktree Note

The current worktree contains additional exploratory render-side changes beyond the last clearly measured-good checkpoint.

Those experiments were useful for localization, but not all of them produced a clean win.

Before committing further changes, another agent should:

1. rerun the real mobile profiles
2. compare against the `13351aa` checkpoint
3. trim back any exploratory changes that do not clearly improve the measured interaction
