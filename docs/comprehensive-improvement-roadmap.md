# Comprehensive Improvement Roadmap

## Context

This document turns the current high-value improvement audit into an executable task list.

The scope spans:

1. architecture debt reduction
2. code-quality and maintainability improvements
3. frontend and backend performance work
4. protocol and adapter hardening
5. user-facing product usefulness improvements
6. test and CI coverage expansion

This is intentionally phased. The work is too large and too cross-cutting to land safely as one change set while preserving deterministic behavior, strict schemas, and existing user-visible capability.

## Goals

1. Reduce change-amplification hotspots.
2. Improve hot-path performance under burst traffic and large-state small-delta scenarios.
3. Tighten ownership boundaries so strict typed contracts remain explicit.
4. Move proven internal tooling value into real product workflows.
5. Expand verification so hot-path regressions are caught before merge.

## Non-Negotiable Rules

1. Preserve strict Zod boundary ownership and hard-failure behavior.
2. Do not weaken internal typing or add ad-hoc runtime shape checks outside boundaries.
3. Preserve deterministic stream merge, cursor, and cache behavior.
4. Preserve user-visible capability while refactoring internal ownership.
5. Land work in owner-aligned phases with focused tests and performance evidence.

## Global Verification Gates

Every phase must satisfy all applicable checks:

1. `bun run ci:targeted:typecheck`
2. `bun run ci:targeted:performance`
3. focused unit and integration suites for changed owners
4. applicable Playwright coverage for changed interaction paths
5. explicit performance evidence for hot-path changes

Required evidence for hot-path work:

1. deterministic side-effect budget tests where possible
2. replay-equivalence or reference-equivalence tests where optimized paths diverge from canonical paths
3. large-state small-delta regression tests for stream or list-heavy changes
4. queue-delay and route-latency readouts where server hot paths are changed

## Phase 1: Capability Surface Decomposition

### Objective

Reduce the biggest cross-layer maintenance hotspot by splitting the monolithic capability route/client/api surface into feature-owned modules.

### Scope

1. `apps/ServerApplication/Source/Network/Routes/CapabilityRoutes.ts`
2. `apps/ServerApplication/Tests/CapabilityRoutes.test.ts`
3. `packages/CodexInterfaceAdapter/Source/AppServerClient.ts`
4. `packages/CodexInterfaceAdapter/Source/AppServerClientRequestBuilders.ts`
5. `apps/WebApplication/Source/Features/Capabilities/DataAccess/CapabilityApi.ts`

### Tasks

- [ ] Create feature-owned server route owners for config, account, diagnostics, skills, apps, MCP, fuzzy search, realtime, and command execution.
- [ ] Move query/body parsing into explicit owner-aligned schema modules.
- [ ] Split `CapabilityRoutes.test.ts` into owner-aligned test suites with shared typed fixtures.
- [ ] Split `AppServerClient` into feature clients with an explicit operation registry.
- [ ] Split web `CapabilityApi` into owner-aligned API modules or classes.
- [ ] Centralize method token, request builder, timeout policy, and response parser metadata.
- [ ] Remove duplicated response-schema ownership from the adapter where the protocol package should own it.

### Acceptance Criteria

1. No production owner in this phase exceeds the preferred file-size budget unless documented.
2. Capability additions/changes can be made in one owner family without touching unrelated capability families.
3. Route and client tests remain owner-aligned and readable.
4. Transport contract parsing still happens exactly once at the boundary.

### Tests

- [ ] Add owner-aligned tests for every extracted route family.
- [ ] Add adapter client tests per feature client.
- [ ] Add operation-registry coverage asserting request builder and response parser wiring.

## Phase 2: Debug Surface Separation And Bundle Reduction

### Objective

Remove debug-heavy product surface from the main interactive path and reduce the oversized web entry bundle.

### Scope

1. `apps/WebApplication/Source/Features/Debugging/UserInterface/DebugWorkspacePane.tsx`
2. `apps/WebApplication/Source/Features/Debugging/UserInterface/DebugAppServerCoveragePanel.tsx`
3. `apps/WebApplication/Source/Application/StateManagement/UseApplicationShellViewProperties.ts`
4. `apps/WebApplication/Source/Application/StateManagement/UseApplicationShellComposition.ts`
5. `apps/WebApplication/vite.config.ts`

### Tasks

- [ ] Lazy-load debug workspace panes and coverage diagnostics surface.
- [ ] Split debug-only contracts from always-on shell contracts.
- [ ] Shrink the shell view-properties owner into smaller pane-specific builders.
- [ ] Avoid constructing large debug prop objects when debug workspace is inactive.
- [ ] Add explicit bundle-budget checks for the main web chunk.
- [ ] Capture before/after production build output and preserve the result in docs or CI assertions.

### Acceptance Criteria

1. Main entry bundle is materially smaller than the current baseline.
2. Debug panes do not load until requested.
3. Chat and thread-list interaction does not trigger inactive debug derivation work.
4. Debug routing and state restoration remain correct.

### Tests

- [ ] Add tests for inactive debug pane non-construction where practical.
- [ ] Add Playwright coverage for first-open debug lazy loading.
- [ ] Add build/bundle gate in CI.

## Phase 3: Thread List Virtualization And Search Scalability

### Objective

Complete thread-list scaling work so large workspaces do not force full render or filter cost on the main thread.

### Scope

1. `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadListPane.tsx`
2. `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadListActiveSection.tsx`
3. `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadListArchivedSection.tsx`
4. `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListStateController.ts`
5. thread-list search/filtering owners

### Tasks

- [ ] Introduce virtualization for active and archived thread rows.
- [ ] Preserve stable row identity during selection, rename, unread changes, and maintenance actions.
- [ ] Move search/filter work toward owner-managed incremental paths where practical.
- [ ] Ensure archived counts, search summaries, and section expansion behavior remain correct under virtualization.
- [ ] Measure large-thread-set behavior before and after.

### Acceptance Criteria

1. Large thread sets render without full DOM row creation.
2. Row identity remains stable across in-place updates.
3. Search behavior remains correct with active and archived sections.
4. Keyboard, pointer, and touch behavior remain correct.

### Tests

- [ ] Add virtualization behavior tests for selection persistence and row identity stability.
- [ ] Add large-state small-delta tests for thread-list search and presentation.
- [ ] Add Playwright coverage for large-list interaction with no visible flicker.

## Phase 4: Codex Stream Reducer Hot-Path Fix

### Objective

Eliminate per-patch full clone and full-schema validation work from the shared Codex live-state reducer hot path.

### Scope

1. `packages/CodexInterfaceAdapter/Source/LiveStateEventReductionOwner.ts`
2. `packages/CodexInterfaceAdapter/Source/LiveStatePatchApplicationOwner.ts`
3. `packages/CodexInterfaceAdapter/Tests/LiveState.test.ts`

### Tasks

- [ ] Replace per-patch `applyStrictPatch` reduction with batched trusted-patch application and controlled validation checkpoints.
- [ ] Preserve deterministic event and patch localization metadata on failures.
- [ ] Keep the canonical strict path available for reference-equivalence and failure localization.
- [ ] Add reference-equivalence tests between optimized and canonical paths.
- [ ] Add large-state small-delta regression coverage.
- [ ] Add parse/serialize/validation side-effect budget tests for the optimized reducer.

### Acceptance Criteria

1. Optimized reduction output matches canonical output for valid event streams.
2. Failure localization remains deterministic.
3. Hot-path work is proportional to changed data, not patch count times full state size.
4. Existing server projection behavior remains compatible with the shared reducer contract.

### Tests

- [ ] Replay-equivalence tests.
- [ ] Reset-required and missing-cursor recovery tests where applicable.
- [ ] Adversarial index-shift patch tests.
- [ ] Large-state small-delta tests.
- [ ] Side-effect budget tests.

## Phase 5: Thread Ownership And Cache Invalidation Precision

### Objective

Reduce unnecessary adapter fan-out and cache rebuilds during normal thread activity.

### Scope

1. `apps/ServerApplication/Source/Application/Bootstrap/ThreadListCacheInvalidationOwner.ts`
2. `apps/ServerApplication/Source/Network/ThreadListAggregationCache.ts`
3. `apps/ServerApplication/Source/Agents/ThreadAdapterResolver.ts`
4. `apps/ServerApplication/Source/Agents/ThreadIndex.ts`
5. `apps/ServerApplication/Source/Network/Routes/ThreadCollectionRoutes.ts`

### Tasks

- [ ] Replace broad cache invalidation with scoped invalidation keyed by thread, agent, archive state, and workspace where possible.
- [ ] Evaluate direct cache patching for simple single-thread mutations.
- [ ] Persist thread ownership or carry stronger owner hints through route/UI contracts.
- [ ] Reduce repeated adapter probe work for unregistered thread reads.
- [ ] Add observability for adapter probe counts and cache rebuild counts.

### Acceptance Criteria

1. Common single-thread mutations do not invalidate unrelated thread-list cache entries.
2. First-open latency for existing threads improves in mixed-agent mode.
3. Ownership recovery after restart or deep-link entry is deterministic.
4. Observability clearly shows cache hit/miss/coalesced and probe patterns.

### Tests

- [ ] Add scoped invalidation tests per mutation type.
- [ ] Add adapter discovery budget tests.
- [ ] Add cache fan-out tests proving fewer adapter calls after scoped invalidation.

## Phase 6: SSE Delivery, Persistence, And Bootstrap Efficiency

### Objective

Improve server responsiveness by reducing avoidable serialization work, honoring backpressure, and removing sync disk writes from live flows.

### Scope

1. `apps/ServerApplication/Source/Network/EventStreamClientRegistry.ts`
2. `apps/ServerApplication/Source/Modules/PushNotifications/PushReceiptStore.ts`
3. `apps/ServerApplication/Source/Modules/PushNotifications/PushSendStore.ts`
4. `apps/ServerApplication/Source/Modules/Debugging/ClientErrorStore.ts`
5. startup bootstrap endpoints

### Tasks

- [ ] Serialize SSE frames once per broadcast, not once per client.
- [ ] Honor write backpressure and track queued bytes per client.
- [ ] Add resumable SSE support using replay metadata where feasible.
- [ ] Convert sync persistence owners to ordered async durable-write owners.
- [ ] Add a typed startup bootstrap/batch endpoint for deferred startup reads.
- [ ] Capture route timing and queue-delay evidence before and after.

### Acceptance Criteria

1. Slow SSE clients do not silently accumulate unbounded buffered writes.
2. Push and debug persistence do not block interaction-critical request paths with sync IO.
3. Startup performs fewer round trips for deferred data.
4. Observability shows improved queue delay and stable route timing.

### Tests

- [ ] Event-stream registry tests for backpressure and replay behavior.
- [ ] Persistence-owner tests for queued write ordering and crash-safe semantics.
- [ ] Startup bootstrap contract tests.

## Phase 7: Protocol Boundary Tightening

### Objective

Preserve permissive transport ingress where needed while exposing strict internal contracts to application owners.

### Scope

1. `packages/CodexProtocol/Source/AppServer.ts`
2. protocol boundary test suites
3. adapter and app consumers of app-server response contracts

### Tasks

- [ ] Keep raw transport schemas permissive only where upstream drift requires it.
- [ ] Introduce strict normalized owner contracts for app-owned consumption.
- [ ] Move duplicated response-schema ownership out of adapters.
- [ ] Add explicit mapping owners from raw upstream contracts to strict internal contracts.
- [ ] Ensure test fixtures assert mapping stability when passthrough fields are present.

### Acceptance Criteria

1. Application owners consume strict normalized contracts.
2. Upstream extra fields do not leak into internal mutable owner models by default.
3. Protocol and adapter boundaries remain aligned and explicit.

### Tests

- [ ] Add mapping-stability tests with passthrough fields.
- [ ] Add invalid-input rejection coverage for new strict owner contracts.

## Phase 8: OpenCode Parity And Surface Hardening

### Objective

Bring OpenCode closer to Codex in live-state efficiency, API cleanliness, and mapped feature usefulness.

### Scope

1. `packages/OpenCodeInterfaceAdapter/Source/Service.ts`
2. `packages/OpenCodeInterfaceAdapter/Source/EventPayloadMapper.ts`
3. `packages/OpenCodeInterfaceAdapter/Source/Index.ts`
4. OpenCode mapping owners and tests

### Tasks

- [ ] Add an incremental OpenCode live-state/projection owner.
- [ ] Reduce full session + full message re-reads where event deltas can be merged.
- [ ] Replace broad `export *` surface in `Index.ts` with explicit exports.
- [ ] Add an index-surface lock test.
- [ ] Improve mapped tool/file-change richness and typed boundary errors.

### Acceptance Criteria

1. OpenCode live-state refresh cost is materially lower for incremental updates.
2. Public API surface is explicit and stable.
3. Tool-call and file-change mappings retain more useful semantics for the UI.

### Tests

- [ ] Incremental projection tests.
- [ ] Surface lock test for `Index.ts`.
- [ ] Tool/file-change mapping contract tests.

## Phase 9: Productization Of High-Value Internal Tools

### Objective

Move proven internal capabilities out of the debug coverage workspace into user-facing product workflows.

### Scope

1. settings workspace
2. thread actions
3. command palette or operator workflow surfaces
4. notification and pending-request experiences

### Tasks

- [ ] Identify which debug-only capabilities are stable enough for product exposure.
- [ ] Promote apps, skills, MCP, account, config, fuzzy search, and git-diff workflows into real UI surfaces where appropriate.
- [ ] Add “needs attention” and “recently completed” views driven by pending requests and notification history.
- [ ] Preserve debug coverage surface as an operator/testing tool, not the only path to useful capability.

### Acceptance Criteria

1. High-value capabilities are reachable without entering debug coverage panels.
2. Existing debug workflows remain available for diagnostics.
3. New product surfaces remain typed, owner-aligned, and tested.

### Tests

- [ ] Add user-flow Playwright coverage for promoted features.
- [ ] Add owner-aligned unit tests for new state/action coordinators.

## Phase 10: CI And Governance Expansion

### Objective

Bring CI coverage closer to the real product risk surface and enforce measurable performance/bundle expectations.

### Scope

1. `.github/workflows/mock-runtime-checks.yml`
2. real end-to-end workflows
3. build and bundle gates
4. performance evidence capture

### Tasks

- [ ] Add production build and bundle-budget verification to CI.
- [ ] Add scheduled or affected-surface real-app verification coverage.
- [ ] Expand performance gates beyond the existing targeted suites when hot-path owners change.
- [ ] Add validation that oversized temporary exceptions remain documented and current.

### Acceptance Criteria

1. CI fails when the main bundle regresses past agreed budgets.
2. Real product flows run automatically on a reasonable cadence.
3. Temporary large-file exceptions remain explicit and reviewable.

### Tests

- [ ] Add tooling governance tests for bundle budgets and documented exception alignment where applicable.

## Execution Order

Recommended order:

1. Phase 1: capability surface decomposition
2. Phase 4: Codex stream reducer hot-path fix
3. Phase 5: thread ownership and cache invalidation precision
4. Phase 6: SSE delivery, persistence, and bootstrap efficiency
5. Phase 2: debug surface separation and bundle reduction
6. Phase 3: thread list virtualization and search scalability
7. Phase 7: protocol boundary tightening
8. Phase 8: OpenCode parity and surface hardening
9. Phase 9: productization of internal tools
10. Phase 10: CI and governance expansion

## Current Status

- [ ] Phase 1 planned
- [ ] Phase 2 planned
- [ ] Phase 3 planned
- [ ] Phase 4 planned
- [ ] Phase 5 planned
- [ ] Phase 6 planned
- [ ] Phase 7 planned
- [ ] Phase 8 planned
- [ ] Phase 9 planned
- [ ] Phase 10 planned

## Implementation Update (2026-03-05)

Completed in repository:

1. Phase 1 partial, server route decomposition:
   - added shared capability-route contracts in
     `apps/ServerApplication/Source/Network/Routes/CapabilityRouteContracts.ts`
   - extracted configuration route ownership into
     `apps/ServerApplication/Source/Network/Routes/CapabilityConfigurationRouteOwner.ts`
   - extracted account route ownership into
     `apps/ServerApplication/Source/Network/Routes/CapabilityAccountRouteOwner.ts`
   - extracted model/collaboration catalog route ownership into
     `apps/ServerApplication/Source/Network/Routes/CapabilityCatalogRouteOwner.ts`
   - updated `CapabilityRoutes.ts` to dispatch through the new owners

2. Phase 1 partial, web capability data-access decomposition:
   - added configuration endpoint ownership in
     `apps/WebApplication/Source/Features/Capabilities/DataAccess/CapabilityConfigurationApi.ts`
   - added account endpoint ownership in
     `apps/WebApplication/Source/Features/Capabilities/DataAccess/CapabilityAccountApi.ts`
   - added model/collaboration metadata ownership in
     `apps/WebApplication/Source/Features/Capabilities/DataAccess/CapabilityCatalogApi.ts`
   - updated `CapabilityServerClient.ts` and focused tests to consume the new concrete modules
   - replaced the legacy `CapabilityApi.ts` implementation with a canonical composition module that
     re-exports the extracted owners and keeps only the remaining shared reads

3. Phase 1 partial, adapter capability decomposition:
   - added catalog capability ownership in
     `packages/CodexInterfaceAdapter/Source/AppServerCapabilityCatalogClient.ts`
   - added configuration capability ownership in
     `packages/CodexInterfaceAdapter/Source/AppServerCapabilityConfigurationClient.ts`
   - added account capability ownership in
     `packages/CodexInterfaceAdapter/Source/AppServerCapabilityAccountClient.ts`
   - updated `packages/CodexInterfaceAdapter/Source/AppServerClient.ts` to delegate account,
     configuration, and catalog methods through the new capability owners

4. Verification for this slice:
   - `bun run --cwd apps/ServerApplication typecheck`
   - `bun run --cwd apps/WebApplication typecheck`
   - `bun run --cwd packages/CodexInterfaceAdapter typecheck`
   - `bun run --cwd packages/CodexInterfaceAdapter test -- Tests/AppServerClient.test.ts`
   - `bun run --cwd apps/ServerApplication test -- Tests/CapabilityRoutes.test.ts`
   - `bun run --cwd apps/ServerApplication test -- Tests/CodexThreadManagementOwner.test.ts`
   - `bun run --cwd apps/WebApplication test -- Tests/Api.test.ts Tests/CapabilityServerClient.test.ts`
   - focused Biome check/write on touched files

5. Selected-thread UX and cache-hydration improvement:
   - added an in-memory selected-thread snapshot mirror in
     `apps/WebApplication/Source/Features/Chat/DataAccess/SelectedThreadSnapshotIndexedDatabaseStore.ts`
   - added synchronous cached snapshot application in
     `apps/WebApplication/Source/Features/Chat/StateManagement/UseSelectedThreadLoaders.ts`
   - updated selected-thread lifecycle behavior in
     `apps/WebApplication/Source/Features/Chat/StateManagement/UseSelectedThreadLifecycleEffects.ts`
     so cached content stays visible during refresh instead of dropping into the empty-state path
   - updated selected-thread snapshot state application in
     `apps/WebApplication/Source/Features/Chat/StateManagement/SelectedThreadSnapshotStateOwner.ts`
     so applied snapshots are written through to the selected-thread snapshot store immediately,
     including delta-driven updates that do not carry a fresh read-thread payload
   - updated thread selection wiring in
     `apps/WebApplication/Source/Features/Threads/StateManagement/UseThreadListPaneProperties.ts`
     so thread-open interactions mark loading immediately and apply any cached snapshot in the same
     interaction path
   - updated runtime/shell composition wiring and focused tests for the new cached-hydration path

6. Additional verification for selected-thread UX:
   - `bun run --cwd apps/WebApplication typecheck`
   - `bun run --cwd apps/WebApplication test -- Tests/UseSelectedThreadLoaders.test.tsx Tests/UseSelectedThreadLifecycleEffects.test.tsx`

Remaining Phase 1 work:

1. split the remaining capability route families out of `CapabilityRoutes.ts`
2. split `CapabilityRoutes.test.ts` into owner-aligned suites
3. extract the remaining capability families out of `packages/CodexInterfaceAdapter/Source/AppServerClient.ts`
4. continue shrinking `packages/CodexInterfaceAdapter/Source/AppServerClient.ts` by moving the
   still-local response-schema blocks and related public contract types into owner-aligned modules

## Notes

1. This roadmap is intentionally comprehensive and should be implemented as multiple reviewed changes, not one monolithic patch.
2. Each phase should update this document with completion notes, test evidence, and any newly discovered dependencies.
