# AGENTS.md

This repo is Farfield — a local UI for Codex desktop threads.

## Absolutely Immutable Extremely Important Rules

ABSOLUTELY NO FALLBACKS. Do not even SAY the word "fallback" to me.
The types must be absolutely precise. You must NEVER write type instrospection code.
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
   - `packages/codex-protocol/test/fixtures/sanitized/`
4. Manually inspect sanitized files before any commit.
5. Run a sensitive-data scan before staging or committing:
   - `rg -n "/Users/|\\\\Users\\\\|github\\.com|git@|https?://|token|api[_-]?key|PRIVATE KEY|rollout-" packages/codex-protocol/test/fixtures/sanitized`
6. Review what is staged:
   - `git diff --staged -- packages/codex-protocol/test/fixtures/sanitized`

If there is any personal data, secrets, URLs, paths, or conversation text that should not be public, do not commit. Fix sanitization first.

## Commit Rule for Trace-Based Tests

If a unit test uses trace-derived fixtures, the commit must include:

- Sanitized fixture files only.
- A quick note in the commit message that traces were sanitized and manually checked.
