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

- `pnpm dev`
- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`

## Error Debugging Workflow

When investigating Farfield runtime issues, use:

1. `docs/debug/client-error-triage.md` for the current triage flow and endpoints.
2. `.runtime/logs/errors/session-*.ndjson` for per-session error events.
3. Error IDs from the UI banner/Debug tab to correlate with history and stream events.

## Real App Debug Loop (Agent)

When a user reports UI/runtime breakage, validate against the real running app before saying it is fixed.

1. Start/reuse the live stack (`pnpm dev`).
2. Run `pnpm smoke:app` and resolve failures first.
3. Use Playwright MCP tools to drive the real UI (not mocked tests) and reproduce the issue.
4. For Playwright control, use MCP browser tool calls (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_press_key`, `browser_console_messages`, `browser_network_requests`).
5. After a fix, rerun the same real UI flow and `pnpm smoke:app`.
6. Include in your final report:
   - exact real-user flow validated
   - whether red banner / `Load failed` / client-error logging reproduced
   - which command/tool checks passed

## Environment-Specific Files (Strict)

Never commit machine-specific runtime config files.

1. Commit templates only for environment-specific config.
2. Generate runtime files from templates via setup scripts.
3. Keep generated runtime files gitignored.
4. Current Caddy pattern:
   - Commit: `ops/caddy/Caddyfile.local.template`, `ops/caddy/Caddyfile.domain.template`
   - Generate + ignore: `ops/caddy/Caddyfile.local`, `ops/caddy/Caddyfile.domain`
5. If you add another environment-specific config, follow this same template + generated + gitignored model.

## Trace Privacy Rules (Strict)

Never commit raw traces from `traces/`.

If you need traces for tests:

1. Put raw trace files in `traces/` only.
2. Run `pnpm sanitize:traces`.
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
