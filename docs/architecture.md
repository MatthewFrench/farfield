# Farfield Architecture Standards

This is the normative architecture contract for Farfield code.

## Scope

1. Applies to all hand-authored source code.
2. Generated and vendored files are exempt from naming and size rules:
   - `packages/CodexProtocol/Source/Generated/**`
   - `packages/CodexProtocol/Vendor/**`
   - `**/dist/**`

## Goals

1. Keep responsibilities isolated so changes are local and predictable.
2. Keep runtime contracts explicit and validated.
3. Keep user interface, business logic, and data access clearly separated.
4. Keep mutable state owned by explicit modules/classes.
5. Keep naming explicit, descriptive, and consistent.
6. Keep caching explicit, bounded, and owned by named modules/classes.
7. Keep concurrent behavior deterministic and safe under load.

## Repository Surface Ownership

1. Repository source roots remain lowercase for ecosystem convention:
   - `apps`
   - `packages`
2. Source folders and files beneath those roots use `PascalCase`.
3. Each application/package uses `Source` for hand-authored implementation code and `Tests` for test code.
4. Lowercase `src` and `test` roots are disallowed for hand-authored application/package code.
5. Non-source root folders remain lowercase:
   - `docs`
   - `public`
   - `traces`
   - `scripts`
   - `operations`
   - `end-to-end`
6. Runtime artifact folders are never import targets:
   - `.runtime`
   - `playwright-report`
   - `test-results`
7. Top-level folder names must avoid abbreviations.
8. Test files in `Tests` roots use PascalCase owner-aligned naming:
   - `<OwnerName>.test.ts`
   - `<OwnerName>.test.tsx`
   - `<OwnerName>.integration.test.ts`

## Monorepo Boundaries

### Deployable applications

- `apps/WebApplication`
- `apps/ServerApplication`

### Shared packages

- `packages/CodexProtocol`
- `packages/CodexInterfaceAdapter`
- `packages/OpenCodeInterfaceAdapter`

### Tooling and support

- `scripts`
- `end-to-end`
- `operations`
- `docs`

## Module Dependency Matrix

| Source Layer | May Depend On | Must Not Depend On |
| --- | --- | --- |
| `apps/WebApplication/Source/Features/*/UserInterface` | `StateManagement`, `DomainModel`, `Components/UserInterface`, `Shared` | `DataAccess` internals, `apps/ServerApplication` |
| `apps/WebApplication/Source/Features/*/StateManagement` | `DomainModel`, `DataAccess`, `Shared`, `packages/CodexProtocol` | unrelated feature state internals |
| `apps/WebApplication/Source/Features/*/DataAccess` | `packages/CodexProtocol`, browser/network APIs | user interface modules |
| `apps/ServerApplication/Source/Network/Routes` | `Network/RequestSchemas`, `Modules`, `Shared` | direct persistence mutation |
| `apps/ServerApplication/Source/Modules/*` | `Shared`, `Agents`, `packages/*` | route-only network concerns |
| `apps/ServerApplication/Source/Agents/*` | `packages/*`, `Shared` | application user interface modules |
| `packages/CodexInterfaceAdapter` | `packages/CodexProtocol`, local package modules | `apps/*`, other package internals except published APIs |
| `packages/OpenCodeInterfaceAdapter` | external SDK, local package modules | `apps/*`, other package internals except published APIs |
| `packages/CodexProtocol` | local package modules | `apps/*` |

## Composition Roots

1. Web composition root owns startup wiring only.
2. Server composition root owns startup wiring only.
3. Business logic and mutable state ownership must live outside composition roots.

## Runtime Boundary Rules

1. Parse untrusted input at boundaries only.
2. Boundary input includes:
   - network request bodies, query values, and path values
   - inter-process communication frames
   - service worker and worker message payloads
   - external SDK/API payloads
   - persisted JSON from disk
3. Zod schemas are the runtime validation source of truth.
4. Parse once at the edge, then pass typed values inward.
5. No manual shape checks outside parser/schema modules.
6. Envelope normalization (for example removing transport `ok` flags) must be schema-driven, not ad-hoc object introspection helpers.
7. Event-stream payload parsing and refresh-decision classification must be owned by explicit parser/decision modules, not duplicated inline in UI event handlers.
8. Request-body ingress parsing uses explicit structured-data contracts (`JsonValue` + strict boundary schemas), and parsed route inputs must never remain untyped after boundary parsing.
9. Route response writers accept explicit object contracts from owner modules; response typing must not force index-signature coupling onto domain response contracts.
10. IPC and JSON-RPC transport payloads must use schema-owned structured-data contracts (`JsonValueSchema`) at decode and encode boundaries, with explicit parse failures for contract mismatches.
11. Stream-event read routes must expose explicit cursor metadata contracts (`nextSequence`, `firstAvailableSequence`, `resetRequired`) so clients can append incrementally without ad-hoc payload introspection.
12. HTTP response decoders must parse full response bodies before any truncation or sampling; response-size controls are allowed only on diagnostic/observability copies after parse.

## Configuration Ownership Rules

1. Runtime configuration must be owned by explicit configuration modules in `Application/Configuration`.
2. Environment inputs are parsed once at startup with strict Zod schemas.
3. `process.env` reads are prohibited outside configuration owner modules.
4. Configuration owners expose typed immutable configuration objects to the rest of the system.
5. Configuration defaults and precedence order must be documented in owner modules.
6. Invalid configuration must fail startup with clear actionable errors.
7. Browser-side `import.meta.env` reads are restricted to explicit web configuration owners.
8. Browser configuration owners may expose only non-secret values.
9. Child-process environment construction must use explicit allowlisted contracts owned by transport/configuration modules; direct `process.env` spreading is prohibited.

## Schema Rules

1. Application-owned request/response schemas default to `.strict()`.
2. If upstream payloads contain extra keys, parse once and map into strict domain shapes.
3. Schema and parser names must state purpose clearly.

## Error Model Rules

1. Use explicit typed error classes for predictable categories:
   - validation
   - domain conflict
   - external dependency
   - permission/authentication
   - unexpected internal failure
2. Error mapping to transport responses must happen at route/transport boundaries.
3. Domain and service modules must not leak raw unclassified errors across module boundaries.
4. Errors crossing boundaries must include operation context and correlation identifiers when available.
5. Retry logic is permitted only for explicitly transient error categories.

## Type System Rules

1. Use explicit types everywhere practical for exported APIs and cross-module boundaries.
2. Every exported function must declare an explicit return type.
3. Every class public method must declare explicit parameter and return types.
4. Every class property must use an explicit type annotation.
5. Avoid broad catch-all types when a precise domain type exists.
6. Prefer discriminated unions over flag combinations for variant behavior.
7. Keep inference for obvious short-lived local variables only.
8. Cross-module contracts must use explicitly named request/response types; do not use type-introspection utilities (`Parameters`, `ReturnType`, and similar utilities) to derive public contract shapes.
9. Data-access layer boundaries may expose full schema-aligned response contracts; coordinator and owner boundaries should expose minimal, explicitly named contracts containing only consumed fields.
10. The same no-introspection rule applies to tests and test harnesses; test contracts and mocks must use explicit named types.
11. When payload shape is intentionally flexible, modules must use a named structured-data contract and schema owner instead of exporting broad `unknown`-typed interfaces.
12. Hand-authored source module contracts must not expose broad `unknown`-typed parameters, properties, or return values; use named structured-data contracts and schema parsing at boundaries.

## Runtime And Compile-Time Pairing Rules

1. Every external payload must have both:
   - runtime validation schema
   - compile-time type derived from schema or strict domain mapping
2. Prefer `z.infer<typeof Schema>` (or mapped domain types) so runtime and compile-time contracts stay aligned.
3. Do not pass raw parsed JSON through multiple layers untyped.
4. Convert transport types to domain types at module boundaries.

## Test And Comment Rules

1. When changing non-trivial function logic, add or update high-value unit tests that cover behavior contracts and critical edge cases.
2. Test names align to source owner names and stay in PascalCase under `Tests`.
3. Comments are required only where they add engineering value:
   - purpose and ownership intent
   - non-obvious invariants and edge cases
   - caveats and operational context
4. Do not add low-value commentary that restates obvious code.
5. Data-access owners and subscription lifecycle owners must include high-value module/class comments that describe boundary ownership, refresh/caching ownership, and key caveats.
6. Transport-boundary tests must include large-payload decode coverage (for example multi-kilobyte JSON) so diagnostics limits cannot corrupt parse behavior.

## User Interface, Logic, and Data Separation

1. User interface components render and emit intents; they do not own network calls.
2. Feature state and side effects belong in `StateManagement`.
3. Transport/data access belongs in `DataAccess`.
4. Domain behavior belongs in `DomainModel` or services.
5. No module may directly mutate another module's state.
6. User interface and state-management modules consume feature-owned server client classes instead of importing generic transport helpers directly.
7. Only `DataAccess` modules may import transport request utilities; `UserInterface` and `StateManagement` modules consume typed feature-owner APIs instead.
8. Endpoint schemas/functions are owned by feature `DataAccess` modules, while request execution utilities are owned by shared transport modules.

## React Standards

1. Exactly one React component per file.
2. React component files use `PascalCase.tsx`.
3. Feature code lives under `Features/<FeatureName>`.
4. App shell composition stays in `Application`.
5. Large workspace sections (for example debug panels) must be extracted into feature `UserInterface` components instead of staying inline in app composition files.

## User Interface Reference And Interaction Rules

1. Component-to-component coordination must use typed props, lifted owner state, or explicit React context.
2. Component-level DOM access must use React refs owned by the component/hook that needs the node.
3. Runtime behavior must not depend on `id` lookups (`document.getElementById`) or broad selectors (`querySelector`) across component boundaries.
4. HTML `id` attributes are for accessibility semantics and controlled integration points, not as cross-component data channels.
5. If direct document/window listeners are required, they must be isolated in explicit owner hooks/modules with deterministic setup/cleanup.
6. Shared mutable user interface state must never be encoded in DOM attributes/classes and re-read as source of truth.
7. Global DOM queries are allowed only in composition/bootstrap boundaries or external integration boundaries with documented ownership.

## Class Standards

1. Use classes where possible for non-trivial stateful behavior.
2. One class per file.
3. Class file names must match class responsibility.
4. Class state must be encapsulated and mutated only through class methods.
5. Do not create files with unrelated exported functions that share no ownership boundary.
6. Pure stateless transforms should remain pure functions.
7. Shared request utilities and payload builders must be grouped under explicit owner classes instead of spread across composition files.

## Data Ownership Rules

1. Every mutable state surface must have one explicit owner class.
2. Only the owner may mutate its state.
3. Other modules interact through typed owner APIs.
4. Random helper functions must not read/write shared mutable state.
5. Module-level mutable singletons are not allowed unless created in composition roots.
6. Shared state updates must be traceable to named owner methods.
7. Runtime adapter composition and event wiring must be owned by a dedicated class (for example `AgentRuntimeOwner`), not spread across bootstrap files.
8. Owner read APIs should return snapshots or readonly views, not mutable references to internal state.
9. Shared in-memory snapshots (for example capability/model metadata) must be owned by feature cache classes, not ad-hoc refs in composition components.
10. Multi-endpoint fetch normalization (for example related history/error payload reads) must be owned by dedicated reader/service modules, not duplicated across component effects.
11. Snapshot-to-state diff/apply policies (for example history/error list update rules) must be owned by state-store modules, not duplicated across refresh paths.
12. Mode-selection normalization and signature computation must be owned by dedicated domain modules/classes, not copied across UI effects and helpers.
13. URL route-state parse/build behavior must be owned by explicit route-mapper modules/classes rather than inline component helpers.
14. Conversation sync-signature computation for stale-state detection must be owned by dedicated domain modules/classes, not inline component helpers.
15. Runtime viewport sizing, keyboard-open detection, and safe-area CSS variable mutation must be owned by explicit coordinator modules/classes, not inline composition-file helper functions.
16. Incremental read-thread merge policy (for partial read payloads vs. existing turn snapshots) must be owned by explicit state-merger modules/classes, not inline composition helpers.
17. Conversation item visibility/filtering and flattening layout derivation must be owned by dedicated chat domain modules/classes, not inline composition helpers.
18. Event stream connection lifecycle (open/error/reconnect backoff) and refresh-decision dispatch orchestration must be owned by explicit coordinator modules/classes, not inline composition effects.
19. Mode-selection synchronization transition logic between remote conversation state and local UI state must be owned by explicit state-management coordinator modules/classes, not inline effect branches.
20. Chat scroll-bottom detection, bottom-state synchronization, and pin-to-bottom behavior must be owned by explicit state-management coordinator modules/classes, not duplicated inline across effects and handlers.
21. User-interface action request metadata creation (action identifier + request options) must be owned by explicit builder modules/classes, not duplicated inline across action handlers.
22. Tracked user-interface error reporting and banner-message formatting orchestration must be owned by explicit debugging state-management modules/classes, not duplicated inline across action handlers.
23. Pending user-input answer payload derivation from question/draft state must be owned by explicit chat domain modules/classes, not duplicated inline in action handlers.
24. Chat request action orchestration (send-message, submit-user-input, skip-user-input, interrupt-thread) must be owned by explicit chat state-management coordinator modules/classes, not duplicated inline across composition handlers.
25. Thread mutation action orchestration (create-thread, archive-thread, unarchive-thread) must be owned by explicit threads state-management coordinator modules/classes, not duplicated inline across composition handlers.
26. Collaboration-mode mutation action orchestration (`set-collaboration-mode`) must be owned by explicit chat state-management coordinator modules/classes, not duplicated inline across composition handlers.
27. Debug workspace command orchestration (`load-history-detail`, `replay-history-entry`, `start-trace`, `mark-trace`, `stop-trace`) must be owned by explicit debugging state-management coordinator modules/classes, not duplicated inline across composition handlers.
28. Thread list project-section grouping, selected-thread projection, and archived-section counting must be owned by explicit threads state-management modules/classes, not duplicated inline across composition files.
29. Push toolbar client refresh/enable action orchestration must be owned by explicit push state-management and data-access modules/classes, not duplicated inline across composition handlers.
30. Debug issue derivation/filtering/selection policy must be owned by explicit debugging domain modules/classes, not duplicated inline across composition memo/effect branches.
31. Thread sidebar shell layout and footer status rendering must be owned by explicit thread feature user-interface modules/components, not duplicated inline across composition files.
32. Error and live-state warning banner rendering must be owned by explicit debugging feature user-interface modules/components, not duplicated inline across composition files.
33. Top header bar rendering and header action wiring must be owned by explicit application user-interface modules/components, not duplicated inline across composition files.
34. Chat mode/model/reasoning toolbar rendering and interaction wiring must be owned by explicit chat feature user-interface modules/components, not duplicated inline across composition files.
35. Debug workspace shell composition (header, section tabs, and panel routing) must be owned by explicit debugging feature user-interface modules/components, not duplicated inline across composition files.
36. Chat workspace shell composition (conversation container, empty states, jump-to-bottom control, pending-input card, and composer region) must be owned by explicit chat feature user-interface modules/components, not duplicated inline across composition files.
37. Thread sidebar viewport wrapper composition (desktop/mobile animation shells) must be owned by explicit thread feature user-interface modules/components, not duplicated inline across composition files.
38. Shared cross-feature request and identifier contracts (for example `AgentId` and request option contracts) must be owned under explicit shared contracts modules, not in transport implementation modules.
39. Coarse-pointer touch overscroll guard and pull-to-refresh blocking behavior must be owned by explicit application state-management coordinator modules/classes, not inline composition effects.
40. Browser API session bootstrap ownership (auth requirement detection, token challenge state, and session freshness) must be owned by explicit application state-management coordinator modules/classes, not inline composition refs/effects.

## Bad Practice Prohibitions

1. Do not use the DOM as an implicit state store for application behavior.
2. Do not couple sibling or distant components through ad-hoc element IDs or selector strings.
3. Do not introduce global utility modules that both read and mutate unrelated state surfaces.
4. Do not mix user interface rendering, transport calls, and persistence mutation in the same module.
5. Do not bypass owner modules with direct state mutation, even when mutation is small.

## Security Boundary Rules

1. Trust boundaries must be explicit:
   - browser runtime
   - server runtime
   - external systems
2. Secrets and privileged credentials are server-only and must not be exposed to browser bundles.
3. Logs, traces, and debug surfaces must redact sensitive fields.
4. Authentication and authorization checks must execute at route/transport boundaries before domain mutation.
5. Persisted sensitive files must be written with restrictive file permissions.
6. Security-relevant configuration and runtime behavior changes must update architecture documentation.
7. Browser and service-worker modules must not source API authentication tokens from runtime environment variables.
8. `X-Farfield-Token` header injection is owned by trusted server-side infrastructure (for example dev proxy or reverse proxy), not browser bundle code.
9. Direct browser-to-Farfield-server operation is supported with `API_TOKEN` unset; authenticated operation with `API_TOKEN` set requires trusted header injection infrastructure in front of protected routes.

## Ownership Contract Rules

1. Every state, cache, and persistence surface must declare an owner in architecture docs.
2. Owner declarations must include:
   - owner class/module name
   - owning file path
   - mutation API surface
   - lifecycle scope (request, session, process, persisted)
3. Ownership must be exclusive:
   - one write owner per surface
   - all non-owner modules access through typed owner APIs only
4. If ownership changes, update both architecture docs in the same change.
5. Route handlers and UI components orchestrate owners; they do not become owners of shared mutable data.
6. Route handlers must not mutate owner-managed internal references directly; they must invoke owner methods for lifecycle changes.

## Data Flow Rules

1. Web flow: `UserInterface -> StateManagement -> Service -> DataAccess -> Transport`.
2. Server flow: `Route -> ModuleService -> Repository -> Persistence or ExternalClient`.
3. Cross-feature data access goes through owner services, not direct structure mutation.
4. Side effects belong to owner services/repositories only.

## Cache Rules

1. Every cache must have one explicit owner class/module.
2. Cache keys and cache value shapes must be typed and validated at boundaries.
3. Cache policy must be explicit:
   - cache key strategy
   - freshness/TTL strategy
   - invalidation triggers
   - eviction strategy and size bounds
4. No ad-hoc module-level caches outside declared owner modules.
5. Request coalescing must be implemented for duplicate in-flight loads of the same key.
6. Cache writes must preserve data consistency (no partial writes to shared caches).
7. Stale data behavior must be explicit and testable.
8. Observability for cache hit/miss/invalidation paths must be available in debug flows.
9. Generic refresh paths must not invalidate all caches; invalidation must be explicit and scoped to mutation owners.
10. Thread-list-affecting mutations (message send/submit/skip/interrupt and thread create/archive/unarchive) must invalidate active or archived list cache keys explicitly before triggering refresh flows.
11. High-frequency stream events must not trigger per-event global cache clears; cache owners must debounce event-triggered invalidation and scope invalidation to affected query families.

## Browser Persistence Tier Rules

1. Choose persistence by ownership and risk, not convenience:
   - process memory for volatile and sensitive runtime state
   - browser local storage for small user preferences
   - browser indexed storage for large non-sensitive offline datasets with explicit retention
2. Data-access owners are the only modules allowed to read or write browser persistence surfaces.
3. Persistent writes must not block rendering-critical interaction paths.
4. Progressively loaded screens should render from owner cache first, then refresh in the background through owner concurrency coordinators.
5. Sensitive conversation and debug payloads are memory-only unless an explicit security-reviewed requirement is documented.
6. Every persisted key space must define:
   - owner module
   - schema
   - retention policy
   - migration strategy for shape changes
7. State-management and user-interface layers must consume persisted data through typed owner APIs only.

## Concurrency Rules

1. Every shared mutable surface must define a concurrency contract in its owner module.
2. Concurrent writes to the same logical key must be serialized or conflict-resolved deterministically.
3. Async flows must support cancellation where user intent can invalidate stale work.
4. Out-of-order async completions must not overwrite newer state.
5. Idempotency keys are required for retriable or repeated side-effect operations.
6. Fire-and-forget async work is allowed only for best-effort telemetry/logging with explicit error handling.
7. File persistence writes must be atomic and durable when persistence correctness matters.
8. Background refresh loops must enforce single-flight behavior per scope/key.
9. Long-running operations must expose timeout and cancellation control.
10. User-interface refresh flows that can retarget entities (for example selected-thread changes) must use explicit concurrency owner classes that merge queued intent and cancel stale in-flight work.
11. Periodic or event-triggered refresh loops must use explicit concurrency owner modules/classes instead of ad-hoc in-flight/queued refs in composition components.
12. Debounced refresh scheduling and flag accumulation must be owned by scheduler modules/classes rather than inline timer/ref logic in large components.
13. Incremental stream refresh must use explicit cursor contracts and reset signaling; client merge behavior must append only cursor-confirmed deltas and replace state when reset is required.
14. Push-subscription and completion-watermark mutations must execute through an explicit concurrency owner so subscription pruning and send-watermark writes remain deterministic across routes and background services.

## Route Query Contract Rules

1. Route query parsing is untrusted input parsing and must use strict Zod schemas.
2. Numeric query parameters must declare explicit minimum and maximum bounds.
3. Boolean query parameters must parse from explicit accepted wire values.
4. Route handlers must reject invalid query payloads with clear validation issue details.

## Observability Rules

1. Owner modules must emit structured logs with correlation metadata when available (`requestId`, `threadId`, `operation`).
2. Cache owners must expose hit/miss/invalidation/eviction visibility.
3. Concurrency owners must expose queue depth, in-flight counts, and contention/duplicate-request visibility.
4. Error logs must include typed error category and boundary mapping context.
5. Sensitive data must never be emitted in logs or traces.
6. Debug/diagnostic routes must remain read-oriented and scoped to explicit owner modules.

## Dependency Management Rules

1. Every new third-party dependency must declare owning module and purpose.
2. Shared cross-application logic belongs in `packages/*`, not duplicated under application folders.
3. Duplicate libraries for the same concern should be avoided unless explicitly justified.
4. Imports from internal non-public package paths are prohibited across package boundaries.
5. Unused or obsolete dependencies must be removed during maintenance updates.

## Tooling Direction

1. Keep documentation as the primary architecture enforcement surface.
2. Keep type safety enforcement through TypeScript (`tsc`) and strict schema validation boundaries.
3. Prefer a single formatter/linter stack for consistency and speed when tooling consolidation work is scheduled.
4. Biome is an approved candidate for future formatter/linter consolidation, with migration design required before adoption.

## Import and Export Rules

1. No internal barrel files (`Index.ts`) under feature/module folders.
2. Import concrete module files directly.
3. Package root `Index.ts` is allowed only as the public package API boundary.

## Index File Policy

1. Use `Index.ts` only for package public API entry points.
2. Internal modules must use descriptive file names that state ownership and intent.
3. If a file contains implementation logic, it must not be named `Index.ts`.
4. Replacing internal `Index.ts` files with descriptive names improves navigation, searchability, and refactor safety.

## Anti-Spaghetti Rules

1. No feature logic in generic catch-all utility files.
2. No hidden coupling through shared mutable objects.
3. No direct global state mutation from arbitrary functions.
4. No function may fetch data and mutate unrelated feature state in the same module.
5. Generic transport helper modules must not own feature-domain selectors or derivation logic.
6. When canonical owner modules replace legacy behavior, remove the legacy behavior instead of retaining deprecated compatibility layers.

## Naming Rules

1. Source folders and source files use `PascalCase`.
2. Exception: repository roots `apps` and `packages` remain lowercase.
3. Source folder names use full words and must not use abbreviations.
4. Source file names use full words and must not use abbreviations when practical.
5. Type and interface names use `PascalCase`.
6. Function and variable names use `camelCase`.
7. Names must communicate ownership and intent without ambiguity.
8. Relative import specifiers must use canonical segments (`./` and `../`); duplicate segments (`././`, `.././`) are disallowed.
9. Generated and vendored files are tooling-owned and exempt from manual import-specifier normalization.

## Naming Glossary

Preferred source folder names:

1. `UserInterface`
2. `StateManagement`
3. `DataAccess`
4. `DomainModel`
5. `RequestSchemas`
6. `Middleware`
7. `Repositories`

Disallowed folder abbreviations:

1. `UI`
2. `API`
3. `HTTP`
4. `IPC`
5. `E2E`
6. `Ops`
7. `Lib`
8. `Util`
9. `Cfg`
10. `Svc`
11. `Repo`
12. `Msg`
13. `Ctx`

Naming quality checks:

1. Names must communicate ownership (`PushSubscriptionRepository`, `ThreadStateController`).
2. Names must communicate behavior (`ComputeUnreadThreadIdentifiers`, `ParsePushReceiptEnvelope`).
3. Avoid vague names (`Helper`, `Manager`, `Common`) without domain context.

## Folder Structure Rules

### `apps/WebApplication/Source`

- `Application`
- `Features/<FeatureName>/UserInterface`
- `Features/<FeatureName>/StateManagement`
- `Features/<FeatureName>/DataAccess`
- `Features/<FeatureName>/DomainModel`
- `Components/UserInterface`
- `Shared`

### `apps/ServerApplication/Source`

- `Application`
- `Network` (root-level coordinators and owners)
- `Network/Routes`
- `Network/RequestSchemas`
- `Modules/<ModuleName>`
- `Agents`
- `Shared`

### `packages/*/Source`

- `packages/CodexProtocol/Source/Contracts`
- `packages/CodexProtocol/Source/Parsers`
- `packages/CodexProtocol/Source/Generated` (generator-owned)
- `packages/CodexInterfaceAdapter/Source/*` (flat explicit owners; for example `AppServerClient.ts`, `AppServerTransport.ts`, `IpcClient.ts`, `LiveState.ts`, `Service.ts`)
- `packages/OpenCodeInterfaceAdapter/Source/*` (flat explicit owners; for example `Client.ts`, `Schemas.ts`, `SessionMapper.ts`, `ConversationTurnMapper.ts`, `Service.ts`)

## Non-Source Structure Rules

1. Non-source root folders remain lowercase (`docs`, `public`, `traces`, `scripts`, `operations`, `end-to-end`).
2. Non-source root folder names must avoid abbreviations.
3. Architecture updates must update `docs/proposed-structure-and-migration.md`.

## Size and Complexity Budgets

1. Preferred file limit: 400 lines.
2. Hard file limit: 600 lines.
3. Class files may approach the hard limit only when cohesion and ownership remain clear.
4. Preferred function/method limit: 120 lines.
5. Hard function/method limit: 300 lines, with rare exceptions documented inline.
6. Split modules with more than one reason to change.

## Performance Budget Rules

1. Each feature/module owner must define measurable latency and throughput expectations for critical flows.
2. Cache owners must define target hit-rate expectations and maximum memory/entry bounds.
3. Concurrency owners must define maximum in-flight work per key/scope.
4. Performance regressions in critical flows require explicit owner review and mitigation notes.
5. Budget exceptions must be documented with rationale and ownership.

## Testing Standards

1. Unit tests for parsers, mappers, reducers, and pure logic.
2. Integration tests for route behavior and critical flows.
3. Schema changes require success and failure tests.
4. Keep tests close to owning package/application.
5. Configuration owners require tests for invalid, missing, and valid configuration paths.
6. Cache owners require tests for keying, invalidation, eviction, and request coalescing.
7. Concurrency owners require tests for cancellation, stale completion handling, and deterministic ordering.
8. Error boundary mapping requires tests for typed error-to-response behavior.
9. Browser storage owner tests must use isolated storage mocks or adapters to avoid cross-test state races.

## Testing Surface Structure

1. Application tests stay under `apps/*/Tests`.
2. Package tests stay under `packages/*/Tests`.
3. End-to-end scenarios stay under `end-to-end/real/scenarios`.
4. Test helper modules must not become production dependency targets.

## Enforcement

Documentation-driven review checks:

1. Every new mutable state surface has a documented owner class.
2. Every new external payload path has schema + type pairing.
3. Naming glossary compliance is verified in review.
4. Module dependency matrix compliance is verified in review.
5. Every new cache has explicit key, invalidation, and bound policy.
6. Concurrency-sensitive paths define and follow deterministic concurrency contracts.
7. File and function budgets are respected, or exceptions are explicitly documented.

## Decision Records And Exceptions

1. Major architecture decisions must be documented either:
   - as decision records under `docs/decisions`
   - or in a dedicated decision-log section in `docs/proposed-structure-and-migration.md`
2. Each decision record must include context, alternatives considered, decision, and consequences.
3. Any exception to architecture rules must include:
   - owner
   - rationale
   - affected modules
   - expiration/review date
4. Exceptions are temporary and must be reviewed on the documented date.

## Related Planning Document

See `docs/proposed-structure-and-migration.md` for the target folder layout and end-state blueprint.
