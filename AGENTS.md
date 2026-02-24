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
