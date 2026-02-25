# 2026-02-25 Rust Transition Architecture

## Context

Farfield currently runs core backend behavior in a Node.js TypeScript runtime (`apps/ServerApplication`) with shared protocol and adapter packages.

Recent incident analysis showed that correctness-safe logic can still create major latency issues when high-frequency stream paths perform repeated whole-state work. The root issue was ownership and hot-path architecture discipline, not language capability alone.

The team wants a Rust transition path that:

1. Preserves current product behavior and API contracts.
2. Improves latency consistency under burst stream traffic.
3. Keeps architecture ownership explicit and testable through migration.
4. Avoids a one-shot rewrite that delays delivery for months.

## Decision

Adopt a phased Rust transition with explicit boundary ownership and contract compatibility testing. Keep the web application in TypeScript, move server runtime ownership to Rust incrementally, and treat transport contracts as stable product interfaces.

### Target end-state

1. `apps/WebApplication` remains TypeScript/React.
2. A Rust server runtime owns request routing, stream projection, cache/concurrency owners, and observability surfaces now handled by `apps/ServerApplication`.
3. TypeScript adapter logic is either:
   - ported to Rust where practical, or
   - isolated behind a narrow process boundary during transition.
4. Contract definitions remain schema-owned and versioned with explicit compatibility tests across implementations.

### Transition principles

1. Boundary-first migration: migrate transport boundaries and read-only routes before mutation-heavy owners.
2. Owner-by-owner migration: each mutable state owner moves as one unit (state + cache + concurrency + observability).
3. Behavior equivalence by tests: optimized Rust paths must match canonical TypeScript behavior for shared fixtures.
4. No hidden dual ownership: at any point, each mutable state/cache/concurrency surface has one active runtime owner.

### Proposed Rust crate layout

1. `apps/RustServerApplication` (workspace root for Rust runtime).
2. `crates/RuntimeConfigurationOwner`
3. `crates/ProtocolBoundary`
4. `crates/ThreadStreamStateOwner`
5. `crates/ThreadListAggregationOwner`
6. `crates/RequestRoutingOwner`
7. `crates/RequestObservabilityOwner`
8. `crates/EventLoopObservabilityOwner`
9. `crates/PushNotificationsOwner`
10. `crates/AdapterProcessBridge` (temporary while adapter behavior remains in TypeScript).

### Contract strategy

1. Keep current HTTP and stream envelopes stable during migration.
2. Add contract fixture packs (request/response/event fixtures) used by both TypeScript and Rust tests.
3. Require differential tests:
   - same fixture input -> same status/body/stream semantics
   - same invalid input -> same explicit error category mapping
4. Add protocol versioning only when behavior intentionally changes.

### Data and stream model strategy

1. Parse transport payloads once at boundary owners.
2. Project transport payloads to internal owner models optimized for read/write patterns.
3. Use stable identifiers for durable identity and ordered identifier lists for presentation order.
4. Keep cursor-based stream synchronization deterministic (`nextSequence`, `firstAvailableSequence`, `resetRequired`).
5. Bound high-frequency logging with batching/rate policies by default.

### Migration phases

1. Phase 0: Foundation
   - Stand up Rust runtime skeleton with health endpoint and structured logging.
   - Add shared fixture-driven compatibility test harness.

2. Phase 1: Read-only route parity
   - Migrate low-risk read routes (`health`, static capability descriptors, debug summaries).
   - Keep parity tests green before expanding scope.

3. Phase 2: Observability and cache owners
   - Migrate request observability and event-loop observability owners.
   - Migrate thread-list aggregation cache owner with explicit invalidation contracts.

4. Phase 3: Stream state ownership
   - Migrate stream projection owners and cursor contracts.
   - Add burst-load suite as a release gate.

5. Phase 4: Mutation routes and concurrency owners
   - Migrate mutation handlers and their concurrency coordinators.
   - Validate deterministic sequencing and error mapping parity.

6. Phase 5: Adapter bridge reduction
   - Move adapter behavior owner-by-owner into Rust or keep a narrow bridge where justified.
   - Remove temporary bridge surfaces as Rust owners become canonical.

7. Phase 6: Cutover and cleanup
   - Make Rust runtime canonical production path.
   - Remove deprecated TypeScript runtime-only paths and obsolete compatibility code.

### Release and cutover gates

1. Functional parity: differential contract suite passes at 100% for targeted routes/streams.
2. Stream integrity: cursor replay/drop/resync tests pass with deterministic outcomes.
3. Performance: burst-load budgets pass for p95/p99 queue delay and request latency.
4. Operability: structured logs/metrics/traces are available for every migrated owner.
5. Safety: rollback plan validated for each phase gate before production cutover.

## Alternatives considered

1. Stay fully on TypeScript and optimize hot paths only.
   - Pros: lowest transition complexity, immediate throughput gains.
   - Cons: does not address strategic goals for runtime-level control and long-term memory/concurrency model preferences.

2. One-shot full rewrite to Rust.
   - Pros: single target architecture.
   - Cons: high delivery risk, long integration freeze, difficult behavior parity verification.

3. Migrate to another managed-runtime backend stack.
   - Pros: potential operational familiarity.
   - Cons: does not directly align with the team request for Rust ownership and may repeat similar migration risks.

## Consequences

### Positive

1. Better control of high-frequency runtime paths and memory behavior.
2. Stronger performance discipline through fixture parity and burst-load gates.
3. Clear owner-by-owner migration tracking and reduced rewrite risk.

### Costs and risks

1. Dual-runtime operational complexity during transition.
2. Additional engineering investment in compatibility fixtures and differential testing.
3. Temporary bridge maintenance cost until adapter owners are fully migrated.

### Risk mitigations

1. Keep migration phases small and owner-scoped.
2. Enforce parity harness as a required gate for every migrated owner.
3. Require explicit observability coverage before each phase cutover.

## Owners

1. Server architecture owner (primary)
2. Protocol/contracts owner
3. Runtime observability owner
4. Adapter integration owner

## Review date

2026-03-31

