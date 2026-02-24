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

Agents must follow both architecture docs for all code changes:

1. `/Users/matthewfrench/GitHub/farfield/docs/architecture.md`
2. `/Users/matthewfrench/GitHub/farfield/docs/proposed-structure-and-migration.md`

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
