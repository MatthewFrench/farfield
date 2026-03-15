# Rust Server Rewrite Implementation Plan

## Purpose

This document is the execution plan and tracking checklist for rewriting the Farfield server runtime from TypeScript to Rust while preserving current product behavior.

This plan extends [docs/decisions/2026-02-25-RustTransitionArchitecture.md](/Users/matthewfrench/GitHub/farfield/docs/decisions/2026-02-25-RustTransitionArchitecture.md) with concrete sequencing, acceptance criteria, and an execution checklist.

## Working Assumptions

1. The web application remains TypeScript.
2. The current server behavior and wire contracts remain the acceptance target unless a later decision record says otherwise.
3. The rewrite is a real ownership rewrite, not a code generation project.
4. Protocol and route contracts will be implemented manually in Rust and verified by parity tests.
5. Every rewritten non-trivial owner must have direct unit coverage in Rust before cutover.
6. The TypeScript runtime remains the reference implementation until the Rust runtime passes the cutover gates.

## Scope

Current implementation inventory:

1. `apps/ServerApplication/Source`: 127 source files
2. `apps/ServerApplication/Tests`: 80 test files
3. `packages/CodexInterfaceAdapter/Source`: 41 source files
4. `packages/CodexInterfaceAdapter/Tests`: 11 test files
5. `packages/OpenCodeInterfaceAdapter/Source`: 21 source files
6. `packages/OpenCodeInterfaceAdapter/Tests`: 5 test files
7. `packages/CodexProtocol/Source`: 35 source files
8. `packages/CodexProtocol/Tests`: 15 test files

Server source inventory by root:

1. `Application`: 11 files
2. `Network`: 72 files
3. `Agents`: 28 files
4. `Modules`: 14 files
5. `Shared`: 2 files

In practical terms, the rewrite scope includes:

1. Server bootstrap, configuration, logging, and lifecycle ownership
2. HTTP route parsing, auth, error mapping, SSE, and observability
3. Thread list, thread read, thread mutation, cache, and concurrency owners
4. Activity history, debug, and trace owners
5. Push notification stores, delivery, and concurrency owners
6. Codex and OpenCode adapter runtime ownership
7. Protocol parity for all server request, response, and event shapes used by the unchanged web application

## Rewrite Principles

1. Preserve owner boundaries from the current TypeScript architecture unless a new decision record explicitly changes them.
2. Rewrite mutable state owners as whole units.
3. Keep one explicit Rust owner for each mutable state, cache, and concurrency surface.
4. Port tests before or with the corresponding owner rewrite; do not defer owner-level coverage.
5. Use fixture-driven parity tests for wire contracts because TypeScript and Rust contracts will be maintained manually.
6. Treat the TypeScript runtime as the behavior oracle until final cutover.

## Target Rust Layout

The current preferred layout remains the one established in the Rust transition decision:

1. `apps/RustServerApplication`
2. `crates/RuntimeConfigurationOwner`
3. `crates/ProtocolBoundary`
4. `crates/ThreadStreamStateOwner`
5. `crates/ThreadListAggregationOwner`
6. `crates/RequestRoutingOwner`
7. `crates/RequestObservabilityOwner`
8. `crates/EventLoopObservabilityOwner`
9. `crates/PushNotificationsOwner`
10. `crates/AdapterProcessBridge`

For execution tracking, the TypeScript to Rust ownership mapping should follow this shape:

| TypeScript ownership area | Primary Rust crate or module target | Notes |
| --- | --- | --- |
| `Application/Configuration/*` | `RuntimeConfigurationOwner` | Environment parsing, defaults, path resolution, startup contracts |
| `Application/Bootstrap/*` | `apps/RustServerApplication` and `RequestRoutingOwner` | Process lifecycle and top-level composition |
| `Network/ServerRequest*.ts` | `RequestRoutingOwner` | Request lifecycle, auth, dispatch, response/error mapping |
| `Network/Routes/*` | `RequestRoutingOwner` route modules | Route owners should remain explicit and owner-aligned |
| `Network/EventStreamClientRegistry.ts` | `RequestRoutingOwner` SSE owner | Preserve event sequence and keepalive semantics |
| `Network/*Observability*.ts` | `RequestObservabilityOwner` and `EventLoopObservabilityOwner` | Request/event-loop/send progress metrics |
| `Network/Thread*Cache*.ts` and `Sidebar*Cache*.ts` | `ThreadListAggregationOwner` | Cache key strategy, TTL, invalidation, projection ownership |
| `Network/*ConcurrencyCoordinator.ts` | owner-specific concurrency modules | Preserve deterministic sequencing |
| `Modules/Activity/*` | `RequestObservabilityOwner` and activity modules | History retention, replay payloads, trace lifecycle |
| `Modules/PushNotifications/*` | `PushNotificationsOwner` | Stores, payload validation, delivery, retry, pruning |
| `Agents/*` and adapter packages | `AdapterProcessBridge` and follow-on adapter crates | Highest-risk rewrite surface |

## Acceptance Strategy

Because the rewrite will not use shared code generation, acceptance must be enforced with tests at three levels.

### Contract Parity

1. The unchanged web application must receive the same HTTP status codes, JSON response shapes, and SSE event envelopes.
2. Invalid request inputs must map to the same explicit error categories and response bodies unless a later decision record changes behavior intentionally.
3. Cursor semantics for stream and notification reads must remain deterministic:
   - `nextSequence`
   - `firstAvailableSequence`
   - `resetRequired`

### Owner-Level Unit Coverage

1. Every Rust equivalent of a current non-trivial owner must have direct unit coverage.
2. Owners with existing TypeScript unit tests should not be considered complete until equivalent Rust coverage exists.
3. Performance-sensitive owners must include deterministic bounded-work tests, not only output-equality tests.

### Integration And Runtime Gates

1. HTTP route integration tests must pass against the Rust runtime.
2. Real-stack end-to-end flows must pass with the unchanged web application.
3. Runtime soak scenarios remain required for thread selection, loading, sending, and synchronization behavior.

## Phase Plan

### Phase 0: Baseline And Migration Control

Deliverables:

1. Finalize this execution plan and keep it as the canonical tracker.
2. Confirm current TypeScript baseline passes its critical server, protocol, and adapter tests.
3. Build a source owner inventory that maps every current TypeScript owner file to:
   - Rust target module
   - required unit tests
   - parity fixtures
   - cutover dependency
4. Identify TypeScript owners that do not yet have strong direct tests and add them before rewrite work starts.

Exit criteria:

1. The rewrite backlog is owner-complete.
2. Every high-risk owner has explicit acceptance criteria.
3. The current TypeScript runtime is green and considered the reference baseline.

### Phase 1: Parity Harness

Deliverables:

1. Create a parity fixture pack for route inputs, route outputs, and SSE events.
2. Create fixture-driven differential tests that validate the TypeScript server behavior.
3. Create the matching Rust test harness that consumes the same fixture pack.
4. Add explicit parity coverage for:
   - health and runtime routes
   - auth behavior
   - thread collection and thread member routes
   - capability routes
   - push routes
   - debug routes
   - stream and notification cursor contracts

Exit criteria:

1. New route and SSE changes can be validated against the same fixture corpus in both runtimes.
2. The fixture pack is sufficient to detect contract drift without code generation.

### Phase 2: Rust Runtime Foundation

Deliverables:

1. Create the Rust workspace and crate layout.
2. Implement startup wiring, structured logging, and configuration parsing.
3. Implement health endpoints and runtime snapshot plumbing.
4. Implement typed error categories and boundary response mapping.
5. Add unit coverage for configuration, logging, and startup failure behavior.

Exit criteria:

1. Rust runtime boots cleanly with explicit configuration failures.
2. Health and runtime snapshot routes match TypeScript behavior.

### Phase 3: Request Lifecycle, Auth, And SSE

Deliverables:

1. Port request lifecycle tracking, correlation headers, and metrics classification.
2. Port authentication behavior and browser session issuance rules.
3. Port SSE client registration, broadcast, keepalive, and teardown semantics.
4. Port request error response ownership and transport error classification.

Primary TypeScript owners:

1. `Network/ServerRequestHandler.ts`
2. `Network/ServerRequestLifecycleOwner.ts`
3. `Network/ServerRequestAuthenticationOwner.ts`
4. `Network/ServerRequestErrorResponder.ts`
5. `Network/EventStreamClientRegistry.ts`
6. `Network/BrowserSessionAuthOwner.ts`

Exit criteria:

1. Request context headers and auth responses match current behavior.
2. SSE sequencing and connection cleanup behavior match current behavior under reconnects and disconnects.

### Phase 4: Read Routes, Caches, And Projections

Deliverables:

1. Port runtime, capability, local-image, and debug read route owners.
2. Port thread collection listing, sidebar sync, projection builders, and cache owners.
3. Port route query parsing and cursor encoding or decoding behavior.
4. Add cache invalidation and cache statistics observability.

Primary TypeScript owners:

1. `Network/Routes/RuntimeRoutes.ts`
2. `Network/Routes/CapabilityRoutes.ts`
3. `Network/Routes/LocalImageRoutes.ts`
4. `Network/Routes/ThreadCollectionRoutes.ts`
5. `Network/Routes/SidebarThreadSyncRoutes.ts`
6. `Network/ThreadListAggregationCache.ts`
7. `Network/SidebarThreadSyncSnapshotCache.ts`
8. `Network/Routes/CreatedThreadListProjectionOwner.ts`

Exit criteria:

1. Read routes pass parity fixtures.
2. Cache invalidation, TTL, and snapshot semantics are deterministic and observable.

### Phase 5: Mutation Routes And Concurrency Owners

Deliverables:

1. Port thread member mutation owners.
2. Port per-thread concurrency coordination and request sequencing.
3. Port mutation-scoped cache invalidation.
4. Port send-progress observability and stream delta publication triggers.

Primary TypeScript owners:

1. `Network/Routes/ThreadMemberMutationRouteOwner.ts`
2. `Network/Routes/ThreadMember*MutationRouteOwner.ts`
3. `Network/ThreadConcurrencyCoordinator.ts`
4. `Network/ThreadStreamDeltaEventPublisher.ts`
5. `Application/Bootstrap/ThreadListCacheInvalidationOwner.ts`

Exit criteria:

1. Mutation ordering is deterministic under concurrent access.
2. Thread list invalidation remains scoped to mutation paths.
3. Stream delta publication semantics match current behavior.

### Phase 6: Activity, Debugging, And Push

Deliverables:

1. Port activity history storage, summary projection, trace lifecycle, and replay retention.
2. Port client error logging and debug route owners.
3. Port push stores, push receipt and send stores, and push service delivery policy.
4. Port push-related concurrency coordinators and completion notification service.

Primary TypeScript owners:

1. `Modules/Activity/*`
2. `Modules/Debugging/ClientErrorStore.ts`
3. `Modules/PushNotifications/*`
4. `Network/PushDispatchConcurrencyCoordinator.ts`
5. `Network/PushMutationConcurrencyCoordinator.ts`
6. `Modules/Threads/ThreadCompletionNotificationService.ts`

Exit criteria:

1. Activity retention and replay behavior match current policy.
2. Push delivery, retry, and prune classification match current behavior.
3. Debug and client error routes preserve current contract and storage semantics.

### Phase 7: Adapter Runtime Rewrite

Deliverables:

1. Port adapter registry, adapter resolution, thread index ownership, and runtime composition.
2. Port Codex connection lifecycle, IPC ingress handling, thread state projection, and message dispatch.
3. Port OpenCode adapter behavior.
4. Port explicit spawn environment allowlisting and child-process lifecycle behavior.
5. Port adapter package behavior currently owned in:
   - `packages/CodexInterfaceAdapter`
   - `packages/OpenCodeInterfaceAdapter`

Primary TypeScript owners:

1. `Agents/AgentRuntimeOwner.ts`
2. `Agents/ThreadAdapterResolver.ts`
3. `Agents/ThreadIndex.ts`
4. `Agents/Adapters/*`
5. `packages/CodexInterfaceAdapter/Source/*`
6. `packages/OpenCodeInterfaceAdapter/Source/*`

Exit criteria:

1. Rust adapter runtime behavior matches current TypeScript behavior for connection, reconnection, IPC, thread ownership, and error classification.
2. Adapter-related parity and integration suites are green.

### Phase 8: Cutover, Soak, And Cleanup

Deliverables:

1. Make the Rust runtime the canonical server path in development, test, and production workflows.
2. Run full route parity, integration, end-to-end, and runtime soak validation.
3. Remove obsolete TypeScript server runtime code once the Rust runtime is canonical.
4. Update architecture and migration documents to reflect the new canonical runtime.

Exit criteria:

1. Rust runtime passes all defined gates.
2. The TypeScript server runtime is no longer the canonical implementation.
3. Obsolete compatibility code and docs are removed or explicitly retained by decision record.

## Tracking Checklist

Legend:

- `[ ]` not started
- `[~]` in progress
- `[x]` complete
- `[!]` blocked

### Program Control

- [ ] Confirm owners, review cadence, and cutover authority
- [ ] Freeze current server behavior as the acceptance baseline
- [ ] Create TypeScript owner-to-Rust module mapping inventory
- [ ] Create rewrite dependency graph by owner
- [ ] Record any behavior changes as explicit decision records before implementation

### Baseline Quality

- [ ] Run and record current critical server, protocol, and adapter test baselines
- [ ] Audit current TypeScript owners for missing direct unit tests
- [ ] Add missing TypeScript baseline tests before rewriting corresponding owners
- [ ] Capture baseline runtime soak and burst-load readouts for later comparison

### Parity Harness

- [ ] Create shared route fixture corpus
- [ ] Create shared SSE fixture corpus
- [ ] Add TypeScript differential test runner over the fixture corpus
- [ ] Add Rust differential test runner over the fixture corpus
- [ ] Add cursor replay, drop-range, and reset-required parity fixtures
- [ ] Add invalid-input and boundary-error parity fixtures

### Rust Foundation

- [ ] Create Rust workspace and canonical crate layout
- [ ] Implement runtime configuration owner
- [ ] Implement startup bootstrap and lifecycle owner
- [ ] Implement structured logging and error categories
- [ ] Implement health and runtime snapshot routes
- [ ] Add Rust unit tests for configuration and startup behavior

### Request Lifecycle, Auth, And SSE

- [ ] Port request lifecycle owner
- [ ] Port auth owner and browser session semantics
- [ ] Port request error responder
- [ ] Port request route dispatch owner
- [ ] Port SSE client registry
- [ ] Add Rust unit and integration tests for request lifecycle, auth, and SSE

### Read Routes And Caches

- [ ] Port runtime read routes
- [ ] Port capability routes
- [ ] Port local-image routes
- [ ] Port thread collection list route
- [ ] Port sidebar sync route
- [ ] Port thread list aggregation cache owner
- [ ] Port sidebar snapshot cache owner
- [ ] Port created-thread projection owner
- [ ] Add Rust unit and integration tests for read-route and cache behavior

### Mutation Routes And Thread Concurrency

- [ ] Port thread member read route owner
- [ ] Port thread member mutation route owner
- [ ] Port thread mutation sub-owners
- [ ] Port thread concurrency coordinator
- [ ] Port thread unreadable state owner
- [ ] Port thread stream delta event publisher
- [ ] Port send-progress observability owner
- [ ] Add Rust unit and integration tests for deterministic mutation sequencing

### Activity, Debugging, And Push

- [ ] Port activity history store owner
- [ ] Port activity trace lifecycle owner
- [ ] Port activity history service
- [ ] Port client error store
- [ ] Port debug route owners
- [ ] Port push store
- [ ] Port push receipt store
- [ ] Port push send store
- [ ] Port push service
- [ ] Port push mutation concurrency coordinator
- [ ] Port push dispatch concurrency coordinator
- [ ] Port thread completion notification service
- [ ] Add Rust unit and integration tests for activity, debug, and push behavior

### Adapter Runtime

- [ ] Port agent registry
- [ ] Port thread adapter resolver
- [ ] Port thread index
- [ ] Port agent runtime owner
- [ ] Port Codex connection lifecycle owner
- [ ] Port Codex IPC ingress wiring
- [ ] Port Codex thread stream state owner
- [ ] Port Codex thread management owner
- [ ] Port Codex message dispatch owner
- [ ] Port Codex thread interaction owner
- [ ] Port OpenCode adapter owner set
- [ ] Port explicit spawn environment allowlist behavior
- [ ] Add Rust unit and integration tests for adapter runtime behavior

### Cutover

- [ ] Switch development workflow to the Rust runtime
- [ ] Switch integration and end-to-end workflows to the Rust runtime
- [ ] Re-run runtime soak scenarios against the Rust runtime
- [ ] Compare burst-load metrics against the TypeScript baseline
- [ ] Remove obsolete TypeScript server runtime code
- [ ] Update architecture and migration docs to reflect the new canonical runtime

## Required Gates Before Final Cutover

1. Parity fixtures pass for all supported route and SSE contracts.
2. Owner-level Rust unit coverage exists for all rewritten non-trivial owners.
3. Integration suites pass against the Rust runtime.
4. Real-stack end-to-end and runtime soak scenarios pass against the Rust runtime.
5. Burst-load behavior meets approved latency and queue-delay budgets.
6. The remaining TypeScript runtime-only code, if any, is either removed or explicitly documented with owner and review date.

## Tracking Notes

1. Update this document in the same change as any major rewrite milestone.
2. If scope changes, add a decision record before changing execution assumptions.
3. If a current TypeScript owner is intentionally not ported 1:1, record the replacement owner and reason here and in the relevant decision record.
