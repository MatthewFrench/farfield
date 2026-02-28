# AGENTS.md

This repo is Farfield — a local UI for Codex desktop threads.

## Absolutely Immutable Extremely Important Rules

ABSOLUTELY NO FALLBACKS. Do not even SAY the word "fallback" to me.
The types must be absolutely precise. You must NEVER write type introspection code.
Schema must be iron clad in Zod, and everything should fail hard with clear errors if anything mismatches the schema.
No code outside of Zod can EVER do type introspection. Everything MUST operate on strict types ONLY.
You CANNOT use `as any` or `unknown` in this codebase, they are FORBIDDEN.
You must check these rules at the end of every turn. If not satisfied, you are not done: find a better solution that does not
violate the rules. If you think that is impossible, STOP and ask the user.

## Basic Workflow

1. Read the request and inspect the current code before changing anything.
2. Make the smallest clean change that solves the issue.
3. Run focused checks for the files you changed.
4. Keep commits small and scoped to one logical change.
5. Before committing, review the staged diff carefully.

## Architecture Rules For Agents

Agents must follow architecture governance docs for all code changes:

1. `/Users/matthewfrench/GitHub/farfield/docs/architecture.md`
2. `/Users/matthewfrench/GitHub/farfield/docs/proposed-structure-and-migration.md`
3. `/Users/matthewfrench/GitHub/farfield/docs/decisions/README.md`

Architecture standards quick links:

1. `/Users/matthewfrench/GitHub/farfield/docs/architecture.md` (`Repository Surface Ownership`, `Module Dependency Matrix`, `Type System Rules`, `User Interface, Logic, and Data Separation`, `Data Ownership Rules`, `Cache Architecture`, `Concurrency Architecture`)
2. `/Users/matthewfrench/GitHub/farfield/docs/proposed-structure-and-migration.md` (`Naming Baseline`, `Index File Policy (End-State)`, `Ownership Contracts (End-State)`, ownership registries, cleanup tracker)
3. `/Users/matthewfrench/GitHub/farfield/docs/decisions/README.md` (`Architecture Decisions`, decision record template expectations)

Mandatory rules:

1. Respect package and layer boundaries.
2. Parse untrusted runtime data with Zod at boundaries only.
3. Keep app-owned contracts strict and explicit.
4. Keep modules single-purpose and within size budgets when possible.
5. Place new feature code in feature-oriented folders, not catch-all files.
6. Do not introduce new broad utility buckets (`helpers`, `misc`, `common`) for new modules.
7. React components must be one component per file.
8. Avoid internal barrel imports/exports; import concrete modules directly.
9. When using class-based services/stores/managers, keep one class per file.
10. Separate UI, logic/state, and data-access into distinct modules.
11. Only data-access modules may import transport request utilities; UI and state modules must consume typed feature owner APIs.
12. Use classes where possible for non-trivial stateful behavior.
13. Every mutable state must have one explicit owner module/class.
14. Do not allow arbitrary utility functions to read/write shared mutable state.
15. Keep non-app surfaces (`scripts`, `end-to-end`, `operations`, `docs`) under explicit ownership and avoid mixing concerns.
16. Treat repo-root `public/*` as legacy; do not place new product behavior there.
17. Avoid abbreviations in all forms; prefer clear, explicit names for files, classes, functions, variables, and types.
18. Source folders and source files must use PascalCase naming, except repository roots `apps` and `packages`.
19. Source folder names must use full words and avoid abbreviations.
20. Non-source root folders remain lowercase.
21. Application and package code roots must be `Source` and `Tests` (do not introduce lowercase `src` or `test` roots).
22. Use `Index.ts` only for package-level public API boundaries; internal source files must use descriptive names.
23. When canonical owner modules replace legacy behavior, remove deprecated compatibility behavior instead of preserving both paths.
24. Every mutable state, cache, and persistence surface must have one explicit owner class/module.
25. Every cache must define key strategy, invalidation rules, bounds, and owner APIs.
26. Concurrency-sensitive flows must use explicit coordinator/owner modules with deterministic behavior.
27. Preferred file limit is 400 lines; hard file limit is 600 lines.
28. Preferred function/method limit is 120 lines; hard limit is 300 lines with rare documented exceptions.
29. Runtime configuration must be owned by configuration modules and parsed once with strict schemas.
30. Secrets and sensitive data handling must follow explicit security-boundary ownership.
31. Error categories and boundary response mapping must remain explicit and typed.
32. Owner modules must expose observability for key cache and concurrency behavior.
33. Dependencies must follow explicit ownership and package boundary rules.
34. Architecture decisions and temporary exceptions must be recorded either in `docs/decisions` or in the decision-log section of `docs/proposed-structure-and-migration.md`.
35. Do not couple components through DOM element IDs or selector lookups; use props, refs, context, and owned state APIs.
36. Restrict direct document/window DOM lookup operations to explicit bootstrap/composition owners.
37. Treat HTML IDs as accessibility/integration semantics, not as cross-component state channels.
38. Browser persistence tier choices must be explicit and owner-driven: memory for volatile state, browser local storage for preferences, browser indexed storage for offline metadata.
39. Background refresh flows must prioritize immediate non-blocking cache reads when safe and perform asynchronous refresh through explicit concurrency owners.
40. Persistence writes must not block interaction-critical user interface paths.
41. Do not use `Parameters`, `ReturnType`, or similar type-introspection utilities for cross-module contracts; declare explicit named request/response contract types.
42. Do not use type-introspection utilities in tests; test contracts and mocks must use explicit named types.
43. Test file names in every `Tests` folder must use PascalCase and explicit owner-aligned names.
44. Test naming format is `<OwnerName>.test.ts` or `<OwnerName>.test.tsx`; integration tests use `<OwnerName>.integration.test.ts`.
45. When modifying logic in a code function, ensure high-value unit tests exist for behavior/contracts/edge cases and add or update tests when coverage is insufficient.
46. When modifying a code file, ensure the file has a high-value top comment when needed (purpose, context, edge cases, caveats, and key tribal knowledge); do not add low-value or unnecessary comments. Apply the same standard to modified non-trivial classes and functions.
47. Child-process environment construction must use explicit allowlisted schema-owned contracts; never spread `process.env` directly into spawned-process configuration.
48. Generic refresh paths must not invalidate all caches; cache invalidation must be explicit, scoped, and owned by mutation paths.
49. Data-access and subscription lifecycle owners must include high-value ownership comments that explain boundary contract, caching/refresh ownership, and important caveats.
50. Stream-event read contracts must use explicit cursor metadata (`nextSequence`, `firstAvailableSequence`, `resetRequired`) and client owners must apply deterministic append-or-reset merge behavior from that contract.
51. Transport-boundary parsing must occur once per inbound payload; owner modules must not re-parse the same payload shape inside high-frequency loops.
52. High-frequency stream owners must project transport payloads into internal owner-managed models; raw transport envelopes must not be the primary mutable state model.
53. Mutable collection state must declare an explicit identity strategy (stable identifiers plus ordered identifier lists); positional indexes are synchronization cursors, not durable identity.
54. Stream patch application paths must be proportional to changed data and must avoid full-state clone, full-state serialization, or full-state validation on each micro update.
55. Any required full-state validation must run at controlled checkpoints (snapshot load, batch boundary, or explicit resynchronization) with deterministic typed error behavior.
56. High-frequency observability must be bounded and summarized (batching, rate limits, or sampling windows); raw per-event payload logging is only allowed in explicit debug-only owners.
57. Changes to stream reducers, cache owners, or subscription owners must include focused performance evidence (latency and queue-delay measurements under burst traffic).
58. Data model changes must define three explicit contracts: boundary payload contract, internal owner model contract, and transformation-owner contract.
59. Unit tests for stream reduction owners must cover deterministic replay, cursor reset-required behavior, and missing-cursor recovery behavior.
60. Unit tests for patch processors must cover append, middle replace, middle remove, and index-shift sequences across non-trivial collections.
61. Unit tests for reduction failure behavior must assert deterministic localization metadata (event index and patch index when available).
62. Stream-heavy integration or smoke tests must include burst-traffic scenarios with explicit latency and queue-delay budgets.
63. Performance-sensitive high-frequency reducers must include reference-implementation equivalence tests (optimized path output must match canonical validation path output for the same event stream).
64. High-frequency patch tests must include adversarial index-shift sequences (prepend/insert/remove before target, then mutate target) and assert deterministic results.
65. Cursor synchronization tests must cover replay, dropped-range reset signaling, and deterministic resynchronization behavior.
66. Hot-path unit tests must assert bounded side effects with deterministic fakes and counters (for example parse, serialize, and log call budgets), not only output equality.
67. High-frequency logging tests must assert bounded emission behavior (batch/rate-limited/sampled) and confirm raw per-event payload emission is disabled by default.
68. Stream-owner tests must include large-state small-delta scenarios to prevent regressions that scale work by total state size.
69. Data-model tests must assert explicit boundary-payload to internal-owner-model mapping stability when payloads include passthrough or extra fields.
70. Performance-sensitive unit tests must prefer deterministic side-effect counters over wall-clock timing assertions; duration budgets belong in integration and smoke performance tests.
71. In frontend code, avoid deleting and recreating UI elements when an in-place state update can preserve identity and behavior; prefer owner-managed state transitions over remount-style replacement.

## DOM Rendering Policy (Non-Negotiable)

1. Create once and update in place for persistent Farfield interface records (for example thread rows keyed by thread id, conversation entries keyed by item id, and stream event cards keyed by stable event identity).
2. Do not use rebuild-driven rendering loops for routine refreshes (for example create new node, insert, then remove old node) in owner-managed user interface surfaces; use explicit patch/update paths instead.
3. Preserve element identity for media and expensive descendants (`img`, previews, progress indicators, code/render surfaces); do not reset `src` or equivalent properties unless the resolved value changed.
4. Do not require cloning for normal transitions; use class toggles, transform/opacity transitions, and layout-safe animation on existing nodes.
5. For rendering-logic changes, add or update unit tests asserting node identity stability across updates, and add at least one Playwright check for the changed interaction path with no visible flicker regression.
6. For Farfield-owned user interface subtrees, do not use descendant selector lookup (`querySelector*`, `getElement*`, class token scans, id lookups) to find owned descendants.
7. Selector lookup exceptions are limited to explicit bootstrap/composition owners discovering root containers or non-owned external/native elements.
8. Owner modules must expose stable refs and typed patch/update APIs for owned descendants and must not depend on implicit class-name contracts for owned-element mutation.

Before finalizing a change, agents must confirm:

1. Imports follow allowed dependency direction.
2. Data contracts are validated by schema and propagated as strict types.
3. Route/UI wiring is separate from domain logic.
4. Tests were updated where behavior or schema changed.
5. Mutable state ownership is explicit and enforced via module/class APIs.
6. Naming is explicit and clear with no non-standard abbreviations.
7. Source path naming follows PascalCase and full-word folder rules.
8. Application/package roots use `Source` and `Tests`, not lowercase `src` and `test`.
9. `Index.ts` usage is limited to package public API boundaries only.
10. Canonical owner replacements remove deprecated compatibility behavior.
11. Cache ownership and invalidation/bounds policy are explicit.
12. Concurrency behavior is deterministic and owned by explicit modules.
13. File/function size limits are respected or explicitly documented.
14. Configuration access is centralized through typed owner modules.
15. Security and sensitive-data handling rules are followed.
16. Error/observability behavior follows owner contracts.
17. Any rule exception is documented with owner and review/removal date.
18. No cross-component behavior depends on ad-hoc DOM ID/selector lookup.
19. Browser persistence usage follows explicit ownership, retention, and schema rules.
20. Cache and background refresh behavior is non-blocking and deterministic.
21. Test code does not rely on type-introspection utilities.
22. Test file naming matches source naming style and owner naming contracts.
23. Modified function logic has necessary high-value unit test coverage.
24. Modified code files include necessary high-value top comments where useful, and modified non-trivial functions/classes include necessary high-value comments where useful.
25. Spawned-process environment contracts are schema-owned and allowlisted (no direct full-environment propagation).
26. Cache invalidation remains mutation-scoped and is not triggered by broad refresh helpers.
27. External data-source and subscription owner modules have high-value ownership comments where needed.
28. Stream-event cursor ownership remains explicit from route/data-access contracts through client merge policy (no ad-hoc event-shape checks for synchronization).
29. Modified high-frequency paths do not perform repeated parse, safeParse, or serialize calls for the same payload shape inside loops.
30. Modified features with stream data clearly separate boundary payload models from internal owner models when access patterns differ.
31. Stream reducer tests were added or updated for deterministic replay, index-shift patch sequences, and reset-required cursor behavior.
32. Reduction failure tests assert deterministic localization metadata (event index and patch index when available).
33. Burst-load performance readouts were captured and reviewed for modified stream paths (latency and queue delay).
34. High-frequency logging is bounded by default and avoids raw per-event payload emission outside debug-only flows.
35. Performance-sensitive reducers include reference-equivalence tests against canonical validation behavior.
36. Adversarial index-shift patch sequence tests exist for modified patch or reducer owners.
37. Hot-path deterministic side-effect budget tests exist (parse, serialize, and log calls are bounded).
38. Large-state small-delta regression tests exist for modified high-frequency stream or subscription owners.
39. Cursor replay/drop/resync tests exist and assert deterministic reset signaling and merge behavior.
40. Frontend updates preserve element identity where possible and avoid unnecessary delete/recreate remount patterns.
41. Frontend rendering changes follow the DOM Rendering Policy section above, including identity-stability tests and a Playwright flicker check for the modified path.

## Runtime Safety, Complexity, and Maintainability Playbook

Purpose:
Reduce defects and debugging cost by pushing uncertainty to boundaries, keeping internal logic explicit, and preserving high-signal observability and test coverage.

General guidelines:

1. Resolve all inbound data uncertainty at boundaries, then pass trusted application-owned contracts inward.
2. Keep internal owners deterministic and explicit: avoid scattered runtime shape checks for external uncertainty.
3. Prefer stable identity keys over positional indexes for mutable collections and patch targets.
4. Centralize repeated literals (event names, operation names, route tokens, threshold values) in owner-owned constants/contracts.
5. Add high-value comments only for non-obvious behavior, invariants, and threshold rationale.
6. Keep mutable state ownership singular: one owner module/class per mutable state surface.
7. Keep code paths proportional to changed data in high-frequency flows; avoid full-state work for small deltas.
8. Preserve strict layering: composition and user interface wiring, state and logic ownership, then data-access and boundaries.
9. Keep observability actionable: operation identity, correlation/request id, start time, end state, and duration.
10. Prefer explicit named helpers over dense inline expressions when logic is non-trivial or reused.

Execution protocol (when this, do this):

1. If non-boundary code adds `typeof`, property-existence checks, or optional probing on required fields, stop and move uncertainty handling to the ingress boundary mapper.
2. If domain owners directly consume transport payload shapes, introduce an explicit mapping function and internal contract type before domain usage.
3. If a literal string or number appears in multiple places, extract an owner constant and replace inline duplication.
4. If a timing or size threshold is not obvious, name the constant and add a short rationale comment near declaration.
5. If a function or hook mixes timers, async I/O, state transitions, and error handling, split orchestration into a dedicated owner with named methods.
6. If anonymous callbacks contain branching business logic, extract named functions to improve readability and testability.
7. If environment variable names/defaults are inline in multiple modules, centralize keys/defaults in configuration owners.
8. If observability event names are inline strings, define and reuse typed event name constants.
9. If request/route normalization logic repeats or embeds sentinel strings, create owner-level utilities/constants and test them.
10. If stream or patch reducers re-parse, re-serialize, or deep-clone within tight loops, redesign to incremental update paths and checkpoint validation.
11. If a contract guarantee cannot be established without weakening types, stop and escalate the design concern.
12. If changing hot paths, collect before/after performance readouts (latency and queue delay) for the modified operations.

Testing expectations:

1. Boundary tests must prove invalid input rejection with explicit contextual error behavior.
2. Mapper tests must prove normalization of optionality, default handling, and identity semantics.
3. Domain tests must operate on trusted internal contracts and validate deterministic behavior.
4. Stream and patch tests must cover replay, index-shift sequences, reset-required behavior, and missing-cursor recovery.
5. Hot-path tests must include deterministic side-effect budgets (for parse, serialize, and logging call counts).
6. Large-state small-delta tests must verify work remains proportional to changed data.
7. Observability tests must confirm bounded logging behavior in high-frequency paths.

Examples (generic pattern plus explicit style example):

1. Pattern: Inline regex with unclear intent in business logic.
   Example style: Extract a named regex constant for request-id parsing, add a short comment for expected formats, and add unit tests for valid and invalid samples.
2. Pattern: Branching on raw transport method strings in multiple places.
   Example style: Promote method names to protocol constants/contracts and use exhaustive switches over owned discriminants.
3. Pattern: Inline observability event key strings.
   Example style: Create an owner-level event name registry and reference named constants for error and success emissions.
4. Pattern: Inline threshold value such as `1_000` without context.
   Example style: Declare a named constant like `BUFFERED_HISTORY_FLUSH_INTERVAL_MILLISECONDS` with a one-line rationale comment.
5. Pattern: Route pathname derivation with inline sentinel literals.
   Example style: Move normalization into a small owner utility and centralize sentinel values such as missing-path tokens.
6. Pattern: Large orchestration hook with nested async callbacks.
   Example style: Keep a thin hook wrapper and move orchestration into a state owner/coordinator class with named methods.
7. Pattern: Deep optional chaining against payload internals across internal modules.
   Example style: Map payloads at ingress to explicit contracts that encode nullable variants once.
8. Pattern: Index-based patch targeting treated as durable identity.
   Example style: Maintain stable identifier maps plus ordered identifier lists; treat indexes as synchronization cursors only.

Quick review heuristics:

1. If internal modules still reason about payload shape, boundary ownership is incomplete.
2. If readers cannot explain why a threshold exists, the code needs a named constant and rationale.
3. If hot paths are correct but hard to measure, observability ownership is incomplete.
4. If tests prove only outputs, add tests that prove bounded work and deterministic side effects.
5. If small changes require touching many layers, ownership boundaries need simplification.

## Repository Structure Guide For Agents

Use this tree and ownership summary to locate code quickly and keep changes in the right place.
This tree and file map are intentionally non-exhaustive; not every file is listed.

```text
/
  apps/
    WebApplication/
      Source/
      Tests/
      public/
    ServerApplication/
      Source/
      Tests/
  packages/
    CodexProtocol/
      Source/
      Tests/
    CodexInterfaceAdapter/
      Source/
      Tests/
    OpenCodeInterfaceAdapter/
      Source/
      Tests/
  docs/
  scripts/
  end-to-end/
  operations/
  public/
  traces/
```

Folder ownership and purpose:

1. `apps/WebApplication/Source`
   - Browser product implementation.
   - `Application` contains composition/bootstrap and app-wide owners.
   - `Features` contains feature-owned `UserInterface`, `StateManagement`, `DataAccess`, and `DomainModel`.
   - `Components` contains shared reusable user interface building blocks.
   - `Shared` contains cross-feature contracts, transport primitives, and shared errors/styling.
2. `apps/WebApplication/Tests`
   - Web unit/integration tests.
   - Filenames must be PascalCase and owner-aligned.
3. `apps/WebApplication/public`
   - Web static assets owned by the web app package.
4. `apps/ServerApplication/Source`
   - Server product implementation.
   - `Application` contains runtime bootstrap/configuration/state owners.
   - `Network` contains request handling, schemas, route owners, and server transport boundaries.
   - `Modules` contains domain/service owners (threads, push notifications, debugging, activity).
   - `Agents` contains adapter/runtime ownership for Codex/OpenCode integrations.
   - `Shared` contains server-shared logging and low-level shared contracts.
5. `apps/ServerApplication/Tests`
   - Server unit/integration tests.
   - Filenames must be PascalCase and owner-aligned.
6. `packages/CodexProtocol/Source`
   - Shared protocol contracts/parsers and generated schema outputs.
   - Public package API boundary is `Source/Index.ts`.
7. `packages/CodexProtocol/Tests`
   - Protocol tests and sanitized fixture validation.
8. `packages/CodexInterfaceAdapter/Source`
   - Codex interface adapter ownership (transport, client, service, live state).
   - Public package API boundary is `Source/Index.ts`.
9. `packages/CodexInterfaceAdapter/Tests`
   - Adapter behavior and contract tests.
10. `packages/OpenCodeInterfaceAdapter/Source`
   - OpenCode interface adapter ownership (mapping, service, schemas, client).
   - Public package API boundary is `Source/Index.ts`.
11. `packages/OpenCodeInterfaceAdapter/Tests`
   - OpenCode adapter behavior and contract tests.
12. `docs`
   - Normative architecture standards and migration/proposal documents.
   - Any ownership-rule change must update docs before completion.
13. `scripts`
   - Development/setup/smoke/operational command ownership only.
   - No product business logic should live here.
14. `end-to-end`
   - End-to-end scenario ownership and fixtures/helpers.
15. `operations`
   - Runtime/deployment environment operations assets.
16. `public`
   - Root legacy static surface only; do not introduce new product behavior here.
17. `traces`
   - Runtime artifacts only; never commit raw trace data.

Important files (non-exhaustive) and why they matter:

1. `/Users/matthewfrench/GitHub/farfield/AGENTS.md`
   - Agent operating contract for architecture, naming, typing, testing, and workflow expectations.
2. `/Users/matthewfrench/GitHub/farfield/docs/architecture.md`
   - Normative architecture standard; source of truth for boundaries and ownership rules.
3. `/Users/matthewfrench/GitHub/farfield/docs/proposed-structure-and-migration.md`
   - End-state structure, ownership mapping, and migration checklist/progress tracker.
4. `/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Main.tsx`
   - Web runtime entry point and bootstrap wiring.
5. `/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseApplicationRuntimeComposition.ts`
   - Primary application composition owner that wires feature coordinators and effects.
6. `/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseApplicationShellState.ts`
   - Central web application state owner surface and state reference wiring.
7. `/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseCoreDataLoaders.ts`
   - Core web refresh/data-loading orchestration and caching entry points.
8. `/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Threads/DataAccess/ThreadApi.ts`
   - Thread HTTP contract boundary for list/read/mutation calls.
9. `/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/DataAccess/ChatApi.ts`
   - Chat HTTP contract boundary for thread actions and message sends.
10. `/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Application/ServerBootstrap.ts`
    - Server runtime bootstrap/composition root.
11. `/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ServerRequestHandler.ts`
    - Top-level HTTP routing and request lifecycle orchestration.
12. `/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/ThreadCollectionRoutes.ts`
    - Thread list/create endpoint ownership and query contract enforcement.
13. `/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/ThreadMemberRoutes.ts`
    - Thread member endpoint ownership for read and mutation route dispatch.
14. `/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/PushRoutes.ts`
    - Push registration/status/test/receipt endpoint ownership and payload policies.
15. `/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/PushDispatchConcurrencyCoordinator.ts`
    - Concurrency owner for completion-triggered notification dispatch scheduling.
16. `/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Modules/Threads/ThreadCompletionNotificationService.ts`
    - Completion detection and notification side-effect orchestration.
17. `/Users/matthewfrench/GitHub/farfield/packages/CodexProtocol/Source/Index.ts`
    - Public protocol package entry boundary and shared schema contract exports.
18. `/Users/matthewfrench/GitHub/farfield/.github/workflows/ios-setup-checks.yml`
    - iOS setup CI guardrail for script/Caddy path validation.

## Commands You Will Use Often

- `bun run dev`
- `bun run typecheck`
- `bun run test`
- `bun run lint`

## Client Error Session Log

Browser crash reports and server-side runtime debug errors are written to an NDJSON session log.

- Default path: `<workspace>/.runtime/logs/errors/session-<timestamp>-<pid>.ndjson`
- Override path: set `DEBUG_CLIENT_ERROR_LOG_PATH`
- Entry limit: set `DEBUG_CLIENT_ERROR_MAX_ENTRIES` (default `2000`)

How to use this log:

1. Trigger or reproduce the issue.
2. Open the current session file above, or download it from `GET /api/debug/client-errors/session-log`.
3. Correlate by `requestId`, `threadId`, `operation`, and `recordedAt`.

Why this file is valuable:

- Captures uncaught browser crashes (`window` error and unhandled promise rejection) plus server runtime debug errors in one timeline.
- Preserves structured context needed to trace action flows without scraping terminal output.

## Trace Privacy Rules (Strict)

Never commit raw traces from `traces/`.

If you need traces for tests:

1. Put raw trace files in `traces/` only.
2. Run `bun run sanitize:traces`.
3. Use only sanitized files from:
   - `packages/CodexProtocol/Tests/fixtures/sanitized/`
4. Manually inspect sanitized files before any commit.
5. Run a sensitive-data scan before staging or committing:
   - `rg -n "/Users/|\\\\Users\\\\|github\\.com|git@|https?://|token|api[_-]?key|PRIVATE KEY|rollout-" packages/CodexProtocol/Tests/fixtures/sanitized`
6. Review what is staged:
   - `git diff --staged -- packages/CodexProtocol/Tests/fixtures/sanitized`

If there is any personal data, secrets, URLs, paths, or conversation text that should not be public, do not commit. Fix sanitization first.

## Commit Rule for Trace-Based Tests

If a unit test uses trace-derived fixtures, the commit must include:

- Sanitized fixture files only.
- A quick note in the commit message that traces were sanitized and manually checked.
