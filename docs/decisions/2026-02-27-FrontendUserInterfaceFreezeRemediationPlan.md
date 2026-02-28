# 2026-02-27 Frontend User Interface Freeze Remediation Plan

## Context

The frontend experiences visible freezes during high update activity.

Network requests are asynchronous, but several expensive operations still execute on the browser main thread:

1. transport payload parse and schema validation
2. stream-event parse and refresh decision logic
3. thread-list regrouping and sorting
4. debug and presentation derivations
5. broad React reconciliation fan-out

Asynchronous request boundaries do not guarantee non-blocking user interaction when post-response processing is CPU-heavy on the main thread.

This work must preserve existing product capability and user experience semantics, while eliminating freeze behavior under burst traffic and normal refresh cycles.

## Decision

Adopt a four-phase remediation plan that keeps all existing features and interaction behavior while moving heavy work off the critical interaction path.

### Phase 1: Parse Once At Boundary Owners

Scope:

1. `apps/WebApplication/Source/Shared/Transport/*`
2. `apps/WebApplication/Source/Features/*/DataAccess/*Api.ts`

Changes:

1. Decode JSON once per inbound payload.
2. Validate once against owner schema for the concrete endpoint contract.
3. Remove repeated structured-data validation passes for the same payload shape.

Acceptance criteria:

1. Endpoint behavior and error semantics remain unchanged for valid and invalid payloads.
2. Deterministic side-effect tests assert bounded parse/validation call counts on hot paths.

### Phase 2: Stream Event Decisioning Off Main Thread

Scope:

1. `apps/WebApplication/Source/Application/StateManagement/EventStreamConnectionCoordinator.ts`
2. `apps/WebApplication/Source/Application/StateManagement/EventStreamRefreshDecisionEngine.ts`
3. New worker owner under `apps/WebApplication/Source/Application/StateManagement/`

Changes:

1. Move event envelope parse and refresh-scope decisioning into a worker owner.
2. Post typed decision contracts back to the UI thread.
3. Keep current refresh semantics and deterministic merge policy unchanged.

Acceptance criteria:

1. Replay-equivalence tests prove worker decision output matches current canonical decision output for identical event streams.
2. Cursor reset and replay tests remain deterministic.

### Phase 3: Thread List Work Proportional To Delta Size

Scope:

1. `apps/WebApplication/Source/Features/Threads/StateManagement/*`
2. `apps/WebApplication/Source/Features/Threads/UserInterface/*`
3. `apps/WebApplication/Source/Application/StateManagement/UseApplicationDerivedState.ts`

Changes:

1. Introduce incremental grouped-thread owner state keyed by stable identifiers.
2. Avoid full regroup/sort/reallocation when incoming data changes are small.
3. Virtualize rendered thread rows while preserving existing keyboard/mouse/touch behavior.

Acceptance criteria:

1. Large-state small-delta tests verify work scales with delta size, not total collection size.
2. Integration tests confirm preserved selection, unread indicators, search behavior, and archived section semantics.

### Phase 4: Reduce Broad Rerender Fan-Out

Scope:

1. `apps/WebApplication/Source/App.tsx`
2. `apps/WebApplication/Source/Application/StateManagement/UseApplicationShellViewProperties.ts`
3. `apps/WebApplication/Source/Application/StateManagement/UseApplicationPresentationHelpers.tsx`
4. `apps/WebApplication/Source/Application/UserInterface/ApplicationShellLayout.tsx`
5. `apps/WebApplication/Source/Features/Debugging/*`

Changes:

1. Gate debug-heavy derivations to active debug views.
2. Memoize shell property object construction at owner boundaries.
3. Prevent hidden surfaces from performing unnecessary heavy rendering work.

Acceptance criteria:

1. Chat stream updates do not trigger debug-heavy derivation work while debug view is inactive.
2. Thread sidebar and chat surface interaction behavior remains unchanged.

### Non-Negotiable Preservation Rules

1. Do not remove or weaken any existing capability.
2. Do not reduce existing user-visible functionality.
3. Keep strict schema ownership and hard failure behavior for contract mismatches.
4. Keep deterministic stream cursor and merge semantics.

## Verification Gates

All phases require explicit performance and correctness evidence before merge.

### Performance Readouts

1. Burst stream scenario: explicit latency and queue-delay readouts under sustained event bursts.
2. Large thread-set scenario: measure interaction responsiveness during active refresh and search.
3. Core refresh scenario: measure main-thread blocking windows during payload ingestion and state apply.

### Deterministic Test Gates

1. Stream replay/reset-required/missing-cursor recovery tests.
2. Adversarial index-shift patch sequence tests.
3. Reference-equivalence tests for optimized reducer paths versus canonical paths.
4. Hot-path side-effect budget tests for parse/validation/log-call counts.
5. Large-state small-delta regression tests for thread-list and stream owners.

## Alternatives Considered

1. Lower data limits and truncate behavior aggressively.
   - Rejected: reduces capability and can degrade user experience under real usage.

2. Keep current architecture and increase debounce delays.
   - Rejected: can hide symptoms but does not resolve main-thread contention.

3. Disable debug-heavy surfaces during activity spikes.
   - Rejected: removes available functionality and hurts observability workflows.

## Consequences

### Positive

1. Substantially lower freeze risk during stream bursts and refresh cycles.
2. Better scalability for large thread collections and long-lived sessions.
3. Stronger deterministic test coverage for hot-path correctness and performance.

### Costs And Risks

1. Requires coordinated updates across transport, state owners, and user interface owners.
2. Worker-based event decisioning adds serialization contracts that must remain tightly versioned.
3. Virtualization introduces edge-case risks around keyboard focus and accessibility semantics.

### Risk Mitigations

1. Preserve strict owner contracts and single mutable-state ownership.
2. Add replay-equivalence and interaction smoke tests before enabling each phase by default.
3. Roll out by phase with explicit before/after performance evidence per phase.

## Implementation Update (2026-02-27)

Completed in repository:

1. Phase 4 partial:
   - gated stream-event card derivation to active debug stream view only
   - introduced stable stream-event card keys backed by event-reference ownership to prevent remount churn when retention windows shift
   - added unit coverage asserting retained card node identity stability

2. Stream debug rendering hot-path reduction:
   - memoized `StreamEventCard`
   - deferred diff-payload schema parsing until a card is expanded

3. Phase 2 partial:
   - introduced staged event-stream decision parsing:
     - type envelope parse first
     - activity and thread-id scoped parse second
     - full strict delta parse only when selected-thread delta must be applied
   - preserved existing refresh decision semantics and invalid-payload hard-refresh behavior
   - added focused decision-engine tests for staged parsing paths

4. Verification additions:
   - added Playwright scenario coverage for debug stream card node identity stability during retention-window shifts

5. Phase 4 continuation:
   - memoized `useApplicationShellViewProperties` owner outputs for header, chat pane, debug pane, and bootstrap overlay contracts
   - added unit coverage asserting unaffected pane-property identity stability across unrelated rerenders

6. Performance verification continuation:
   - extended `scripts/operations/stream-burst.mjs` to read `/api/debug/observability` route-timing summaries
   - added queue-delay budget checks and summary readouts for:
     - `GET /api/threads/:threadId/stream-events`
     - `GET /api/health`

7. Phase 1 completion:
   - removed the remaining web thread-creation double-parse path in `ThreadApi.createThread`
   - preserved strict boundary contract parsing while reducing repeated parse work
   - added deterministic parse-budget coverage in `FarfieldHttpTransport.test.ts` asserting one `JSON.parse` and one `StructuredDataValueSchema.safeParse` call for successful payloads

8. Phase 2 completion:
   - added explicit worker decision contracts:
     - `EventStreamRefreshDecisionWorkerRequestSchema`
     - `EventStreamRefreshDecisionWorkerResponseSchema`
   - added `EventStreamRefreshDecisionWorkerOwner` and `EventStreamRefreshDecisionWorkerRuntime`
   - updated `EventStreamConnectionCoordinator` to process event messages through an ordered async chain
   - added deterministic hard-refresh behavior when worker decision reads fail
   - wired execution mode through `ApplicationBehaviorConfiguration` and `App.tsx`:
     - test mode: `"in-thread"`
     - runtime mode: `"worker"`
   - added replay-equivalence, out-of-order correlation, and dispose-rejection tests for worker-owner behavior
   - added coordinator test coverage for decision-read rejection and hard-refresh scheduling

9. Phase 3 completion:
   - added `ThreadProjectGroupingStateOwner` as an explicit mutable owner keyed by stable thread identifiers
   - implemented incremental group patching for small deltas with controlled full rebuild for large deltas
   - wired incremental grouping into `ThreadListPresentationStateResolver` and exposed computation stats through `ThreadListStateController`
   - added large-state small-delta regression coverage in `ThreadListPresentationStateResolver.test.ts`
   - added row-level render containment in:
     - `ThreadListActiveSection.tsx`
     - `ThreadListArchivedSection.tsx`
   - preserved existing pointer and keyboard interactions by keeping row identity and interaction handlers unchanged

10. Stream burst contract and evidence closure:
    - aligned strict burst-script schemas to current server route contracts:
      - `GET /api/threads` includes `nextCursor`, `pages`, `truncated`
      - `GET /api/threads/:threadId/stream-events` includes `nextSequence`, `firstAvailableSequence`, `resetRequired`
    - captured successful burst evidence:
      - `streamRequests=51919`
      - `streamFailures=0`
      - `healthProbes=30`
      - `healthFailures=0`
      - `healthNotReady=0`
      - `healthP95=16ms`
      - `healthMax=20ms`
      - `streamRouteP95=2.667ms`
      - `streamRouteP95QueueDelay=6ms`
      - `streamRouteMaxQueueDelay=6ms`
      - `healthRouteP95QueueDelay=15ms`
      - `healthRouteMaxQueueDelay=24ms`

11. Verification gate completion:
    - targeted web tests for transport, stream decisioning, stream coordinator, thread-list projection, and related owners passed
    - repository lint and typecheck passed
    - real end-to-end verification passed through `bun run verify:end-to-end:real` (9 Playwright scenarios)

## Owners

1. Web application runtime ownership
2. Stream and refresh ownership
3. Thread list ownership
4. Debug workspace ownership
5. Architecture governance owner

## Review Date

2026-04-15
