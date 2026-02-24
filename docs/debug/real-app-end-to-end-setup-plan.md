# Real App End-to-End Setup Plan (Detailed)

## Goal

Provide a real-app test setup that lets us:

1. Manually debug the running Farfield app like a user.
2. Re-run the same flows quickly during development.
3. Write and run anti-regression tests from those same flows.

This plan is setup and workflow only. It does not include turning manual sessions into generated tests.

## Current Codebase Baseline

### Runtime topology already in place

- Frontend Vite dev server runs on `127.0.0.1:4312` (`apps/WebApplication/vite.config.ts`).
- Backend server runs on `127.0.0.1:4311` (`apps/ServerApplication/Source/Index.ts`).
- Frontend proxies `/api` and `/events` to backend (`apps/WebApplication/vite.config.ts`).
- API token injection in dev proxy is restricted to trusted origins (`localhost` defaults, configurable via `VITE_DEV_PROXY_TRUSTED_ORIGINS`) when `API_TOKEN` or `PUSH_API_TOKEN` is set (`apps/WebApplication/vite.config.ts`).
- When `API_TOKEN` is configured, `/events` requires the same token as `/api/*`; browser flows should run through the trusted dev proxy/Caddy path.
- `scripts/with-env.mjs` already loads `.env` and `.env.local` for wrapped commands.

### Existing observability and smoke checks

- Runtime endpoint smoke command exists: `pnpm smoke:app` (`scripts/app-smoke.mjs`).
- Real-device iOS smoke commands exist:
  - `pnpm smoke:ios-device` (single target)
  - `pnpm smoke:ios-matrix` (multi-target matrix via `IOS_DEVICE_SMOKE_MATRIX`)
- Real-runtime mutation safety is enforced in end-to-end fixture:
  - baseline thread IDs are captured at test start
  - browser mutations on pre-existing threads fail the scenario
  - managed test threads must be created via `stateGuard.createManagedThread()`
  - managed test threads are archived during fixture teardown (`POST /api/threads/:threadId/archive`)
- Backend already exposes debug error endpoints:
  - `POST /api/debug/client-errors`
  - `GET /api/debug/client-errors`
  - `GET /api/debug/client-errors/:errorId`
  - `GET /api/debug/client-errors/session-log`
- Session logs are already persisted under `.runtime/logs/errors/session-*.ndjson`.

### Current UI anchors and pain points

- Sidebar and chat already show loading/empty text:
  - `Loading threads...`
  - `No threads`
  - `No thread selected`
  - `No messages yet`
  - `Select a thread from the sidebar`
- Red error banner already includes operation, message, requestId/errorId, and `Open in Debug`.
- There are very few stable automation hooks (`data-testid`), so selectors are currently text-driven and brittle.

## Scope

### In scope

- Playwright project configured to target a running Farfield app (no mocked backend).
- Concrete local command set for debug and regression runs.
- Reusable helper layer for actions, assertions, and diagnostics.
- First baseline scenarios that work with empty or populated thread lists.
- Failure artifacts: trace, screenshot, console, network.
- Documentation for both human loop and Codex MCP loop.

### Out of scope

- Auto-generation of tests from recorded manual sessions.
- Browser matrix expansion beyond one local Chromium baseline.
- CI rollout beyond a local-first flow for now.

## Design Constraints

- Real runtime only: tests run against live `/api` and `/events`.
- Strictly deterministic checks: assert user-visible states plus error signals.
- Fast iteration: scenario-level rerun by grep.
- Account-agnostic behavior: tests must pass with zero threads and with existing threads.
- High diagnostics quality: failures must include enough context to fix quickly.
- Loading-state SLOs are mandatory: critical loading states must settle within a bounded timeout or hard-fail.

## Mandatory AI Dev Loop Policy

This section is normative and required for all feature work.

For every feature branch:

1. Run the real app (`pnpm dev`) and confirm baseline runtime health (`pnpm smoke:app`).
2. Execute the target user flow in the live UI (Playwright UI mode or MCP-driven browser control).
3. Keep a continuous error sentinel active while interacting with the app.
4. Treat any unexpected warning/error signal as a blocking issue.
5. Patch and re-run the same flow until the run is clean.
6. Re-run once from a fresh page load before marking done.

A clean run means:

- no unexpected red error banner appearance, including very short-lived flashes
- no unexpected `console.warn` or `console.error`
- no uncaught `pageerror`
- no unexpected failed `/api/*` responses
- no unexpected new entries in `/api/debug/client-errors`
- no loading-state timeout breaches

## Deliverables (Concrete)

1. Playwright wiring
   - Add Playwright dev dependency at workspace root.
   - Add `playwright.real.config.ts` at repo root.
   - Add `.gitignore` entries for Playwright outputs.
2. Command surface in root `package.json`
   - `end-to-end:real:install`
   - `end-to-end:real:run`
   - `end-to-end:real:ui`
   - `end-to-end:real:debug`
   - `verify:end-to-end:real` (`smoke:app` + `end-to-end:real:run`)
3. Test structure under `end-to-end/real/`
   - `fixtures/real-app.fixture.ts`
   - `helpers/app-actions.ts`
   - `helpers/app-assertions.ts`
   - `helpers/error-sentinel.ts`
   - `helpers/signal-allowlist.ts`
   - `helpers/diagnostics.ts`
   - `scenarios/app-load.spec.ts`
   - `scenarios/thread-open.spec.ts`
   - `scenarios/debug-tab.spec.ts`
   - `coverage-matrix.md`
   - `README.md`
4. Selector hardening in `apps/WebApplication/Source/App.tsx`
   - Add explicit test IDs and data attributes for key UI states.
5. Docs pass
   - Update `README.md`, `AGENTS.md`, and `docs/debug/client-error-triage.md` references as needed.
6. Enforced quality gates
   - Add a standard "no unexpected warnings/errors" post-scenario assertion shared by all specs.
   - Add transient red-banner capture to ensure short-lived errors are not missed.
   - Enforce timeout-based loading-settle assertions.
7. Coverage governance
   - Add and maintain `end-to-end/real/coverage-matrix.md` so every feature area maps to at least one scenario.

## Proposed Command Surface

- `pnpm end-to-end:real:install`
  - Installs Playwright browser dependency (`chromium`) locally.
- `pnpm end-to-end:real:run`
  - Headless run of real-app scenarios against already-running app.
- `pnpm end-to-end:real:ui`
  - Playwright UI mode for local iteration.
- `pnpm end-to-end:real:debug -- --grep "thread-open"`
  - Debug one scenario interactively.
- `pnpm verify:end-to-end:real`
  - `pnpm smoke:app` then `pnpm end-to-end:real:run`.

Note: these commands should be wrapped via `scripts/with-env.mjs` so `.env.local` token config is respected.

## File-by-File Implementation Plan

### 1) Root tooling

#### `package.json`

- Add Playwright commands listed above.
- Keep existing `smoke:app` unchanged.
- Add `verify:end-to-end:real` composite script for one-shot verification.
- Ensure each `end-to-end:real:*` script is executed via `scripts/with-env.mjs` for env parity with `pnpm dev`.

#### `.gitignore`

- Add:
  - `playwright-report/`
  - `test-results/`

#### `playwright.real.config.ts` (new)

- `testDir`: `end-to-end/real/scenarios`
- `timeout`: `45_000`
- `expect.timeout`: `10_000`
- `retries`: `0`
- `workers`: `1`
- `fullyParallel`: `false`
- `use.baseURL`: `process.env.E2E_REAL_BASE_URL ?? "http://127.0.0.1:4312"`
- `use.trace`: `"retain-on-failure"`
- `use.screenshot`: `"only-on-failure"`
- `use.video`: `"retain-on-failure"`
- `reporter`: `list` + `html` (open off by default)
- No `webServer` auto-start. Tests should fail fast with a clear message if app is not running.

### 2) Testability hooks in web app

#### `apps/WebApplication/Source/App.tsx`

Add explicit hooks for stable selectors:

- Shell and navigation
  - `data-testid="app-shell"`
  - `data-testid="sidebar-toggle-open"`
  - `data-testid="sidebar-toggle-close"`
  - `data-testid="tab-chat"`
  - `data-testid="tab-debug"`
  - `data-testid="tab-preflight"`
  - `data-testid="refresh-button"`
- Thread list
  - `data-testid="thread-list-status"`
  - `data-testid="thread-list-loading"`
  - `data-testid="thread-list-empty"`
  - `data-testid="thread-list-item"` + `data-thread-id="<id>"`
- Header and chat empty states
  - `data-testid="selected-thread-label"`
  - `data-testid="chat-empty-state"`
  - `data-testid="chat-empty-loading-threads"`
  - `data-testid="chat-empty-no-thread"`
  - `data-testid="chat-empty-no-messages"`
- Error banner
  - `data-testid="error-banner"`
  - `data-testid="error-banner-operation"`
  - `data-testid="error-banner-message"`
  - `data-testid="error-banner-open-debug"`
  - `data-testid="error-banner-dismiss"`
- Debug tab
  - `data-testid="debug-history-panel"`
  - `data-testid="debug-errors-panel"`
  - `data-testid="debug-errors-refresh"`
  - `data-testid="debug-errors-empty"`
  - `data-testid="debug-errors-session-log-link"`

This keeps Playwright selectors stable through copy/visual changes.

### 3) Real-app fixture and helpers

#### `end-to-end/real/fixtures/real-app.fixture.ts`

Create a custom fixture that:

- Validates app availability before each test:
  - UI shell reachable at `/`
  - API reachable at `/api/health`
- Captures baseline debug errors:
  - `GET /api/debug/client-errors?limit=120` before scenario.
- Tracks runtime signals during scenario:
  - `page.on("response")` for non-2xx on `/api/*`
  - `page.on("pageerror")`
  - `page.on("console")` for `warning` and `error` levels
  - transient error-banner appearances via DOM observer
- Captures post-scenario debug errors and computes delta.
- Writes scenario signal summary to `.runtime/end-to-end-sentinel/<scenario>.ndjson` and prints a compact terminal summary.
- Refreshes `.runtime/end-to-end-sentinel/latest.ndjson` for live monitoring during iterative runs.

Expose a scenario context object:

- `baselineErrorIds: Set<string>`
- `newErrorEvents: DebugErrorEvent[]`
- `failedApiResponses: Array<{ url: string; status: number }>`
- `consoleWarnings: string[]`
- `consoleErrors: string[]`
- `pageErrors: string[]`
- `bannerEvents: Array<{ at: string; operation: string; message: string; requestId: string | null; errorId: string | null }>`
- `loadingTimeoutBreaches: Array<{ surface: string; timeoutMs: number; observedState: string }>`

#### `end-to-end/real/helpers/error-sentinel.ts`

Create one shared sentinel utility that every scenario uses.

Responsibilities:

- start/stop page-level signal capture
- install and read transient banner observer state
- read baseline and post-run debug error snapshots
- produce a normalized scenario signal summary
- expose one assertion entry point that fails on unexpected signals

The sentinel should be test-framework-first (Playwright helper), not app-runtime code.

#### `end-to-end/real/helpers/signal-allowlist.ts`

Define one strict, centralized allowlist schema used by sentinel assertions.

Entry shape:

- `id: string`
- `signalType: "console-warning" | "console-error" | "page-error" | "api-failure" | "banner-event" | "debug-error" | "loading-timeout"`
- `matcher`: exact or tightly-scoped pattern fields only (for example operation + message fragment + endpoint)
- `reason: string`
- `owner: string`
- `createdAt: string` (ISO date)
- `expiresAt: string` (ISO date, required)
- `trackingIssue: string`

Rules:

- broad wildcards are disallowed
- `expiresAt` is mandatory and short-lived
- expired entries fail CI/local runs until removed or renewed with justification

#### `end-to-end/real/helpers/app-actions.ts`

Create reusable actions:

- `openAppHome(page)`
- `openSidebarIfHidden(page)`
- `openDebugTab(page)`
- `openPreflightTab(page)`
- `selectFirstThreadIfAny(page)` returning `{ selected: boolean; threadId?: string }`

#### `end-to-end/real/helpers/app-assertions.ts`

Create shared assertions:

- `expectNoErrorBanner(page)`
- `expectNoLoadFailedText(page)`
- `expectThreadListSettled(page)`:
  - waits until either loading indicator disappears or stable empty/list state appears
  - default timeout: `15_000ms`
  - on timeout: records sentinel breach + fails with last observed UI state
- `expectChatSurfaceSettled(page)`:
  - waits for chat empty/loading state to stabilize
  - default timeout: `15_000ms`
  - on timeout: records sentinel breach + fails with current selected-thread and empty-state text
- `expectNoUnexpectedClientErrors(context)`:
  - compare post-run error delta vs baseline
  - allow only explicitly-accepted transient operations (kept as a strict allowlist)
- `expectNoFailedApiResponses(context)` with explicit allowlist if required
- `expectNoUnexpectedWarningsOrErrors(context)`:
  - asserts no unexpected console warnings/errors, page errors, or transient banner events

#### `end-to-end/real/helpers/diagnostics.ts`

Helper methods for readable failure output:

- dump recent client error summaries (operation + message + errorId)
- dump failed API responses
- include current URL and selected thread label state

## Baseline Scenario Specs (v1)

### `app-load.spec.ts`

Flow:

1. Navigate to `/`.
2. Wait for app shell and thread list status to settle.
3. Wait for chat surface to settle.
4. Assert no error banner.
5. Assert no `Load failed` text.
6. Assert no unexpected new debug errors.
7. Assert no failed `/api/*` responses.
8. Assert no unexpected warning/error sentinel signals.

### `thread-open.spec.ts`

Flow:

1. Navigate to `/`.
2. Open sidebar if hidden.
3. Wait for thread list and chat surfaces to settle.
4. Branch:
   - If thread items exist: click first item, assert selected-thread label changed, assert chat container renders.
   - If no thread items: assert thread list empty state and chat no-thread state.
5. Assert no error banner.
6. Assert no unexpected new debug errors.
7. Assert no unexpected warning/error sentinel signals.

### `debug-tab.spec.ts`

Flow:

1. Navigate to `/`.
2. Wait for thread list and chat surfaces to settle.
3. Open Debug tab.
4. Assert history panel and errors panel render.
5. Trigger errors refresh button.
6. If errors exist, open first detail and assert detail metadata visible.
7. Assert session log link is present.
8. Assert no transport/API failures.
9. Assert no unexpected warning/error sentinel signals.

## Coverage Expansion Contract

Baseline scenarios are minimum coverage, not final coverage.

Add `end-to-end/real/coverage-matrix.md` with rows mapping:

- feature/screen
- primary user flow
- spec file and scenario name
- manual verification flow id
- owner
- last validated date

Policy:

1. Every feature PR that changes user-visible behavior must update the matrix.
2. Every new feature area must either:
   - add at least one automated real-app scenario, or
   - add a temporary tracked gap with owner + due date.
3. Gap entries without owner/due date are not allowed.
4. Gap entries past due date fail verification until resolved.

## Continuous Error Sentinel Specification

The sentinel is always active during scenario execution and interactive debug sessions.

### Signals that must be captured

- UI surface:
  - Red banner visible at any time, even if removed quickly.
- Browser runtime:
  - `console.warn`
  - `console.error`
  - uncaught page exceptions (`pageerror`)
- Network:
  - failed `/api/*` responses (non-2xx/3xx)
- Server-observed errors:
  - new entries from `/api/debug/client-errors` since scenario start

### Transient red-banner capture details

Implement a page-side observer in Playwright fixture setup:

- Observe document subtree mutations.
- Detect insertion/update/removal of `[data-testid="error-banner"]`.
- On detection, capture:
  - timestamp (ISO)
  - operation text
  - message text
  - requestId/errorId text when present
- Store the events in `window.__farfieldBannerEvents` for later retrieval by the fixture.
- Record event type (`appeared`, `updated`, `removed`) and a monotonic sequence number.

This guarantees short-lived top-of-screen errors are retained for assertions and diagnostics.

### Banner buffer lifecycle

- Initialize `window.__farfieldBannerEvents = []` at scenario start.
- Enforce cap of last `200` events per scenario.
- Clear buffer at scenario end in fixture teardown.
- Never read stale data across scenarios.

### Signal severity policy

- Default rule: any unexpected signal fails the scenario.
- Exception handling: permitted known signals must be explicitly declared in one central policy map used by the sentinel helper.
- Exceptions must be narrow (operation/message pattern + justification), reviewed, and removable.

### Sentinel output channels

- Terminal summary:
  - always print concise signal counts and first N entries per type.
- Artifact file:
  - write full structured signal report to `.runtime/end-to-end-sentinel/<scenario>.ndjson`.
  - update `.runtime/end-to-end-sentinel/latest.ndjson` with the most recent scenario summary for live tailing.
- Playwright attachments:
  - attach signal report to failed test output along with trace/screenshot/video.
- MCP loop:
  - query browser/runtime streams during execution (`browser_console_messages`, `browser_network_requests`)
  - read transient banner buffer via `browser_evaluate`
  - correlate with `/api/debug/client-errors` results

## Observability Contract for E2E

Use existing backend debug endpoints as the source of truth for scenario health.

- Before each scenario:
  - capture `errorId` set from `/api/debug/client-errors`
- After each scenario:
  - read `/api/debug/client-errors` again
  - compute new events and fail test if any are not in explicit allowlist
  - assert zero loading-timeout breaches recorded by sentinel

This gives immediate protection against regressions that still "render" but emit runtime errors.

Additionally, the browser-level sentinel catches issues that may not persist in the final UI state.

## Manual Dev Loop (Human + Playwright)

This section is procedural and implements the mandatory policy above.

1. Start stack: `pnpm dev`
2. Verify runtime: `pnpm smoke:app`
3. Run interactive tests: `pnpm end-to-end:real:ui`
4. Keep the sentinel feed visible during manual interaction:
   - console warning/error stream
   - failed API responses
   - transient banner events
   - tail `.runtime/end-to-end-sentinel/latest.ndjson` in a parallel terminal
5. Reproduce, patch, let HMR refresh, rerun target scenario.
6. For targeted rerun:
   - `pnpm end-to-end:real:run -- --grep "app-load"`
7. If failing, inspect:
   - Playwright trace/screenshot/video
   - sentinel summary (warnings/errors/banner/API failures)
   - `.runtime/logs/errors/session-*.ndjson`
   - Debug tab error entry by `errorId`
8. Confirm loading-state settle checks pass (no timeout breaches) before marking fix complete.

Stop rule:

- If a new unexpected signal appears at any point in the loop, do not proceed to "done"; fix and re-run.

## Codex MCP Loop (How Control Works)

Playwright MCP control is through Codex tool calls, not shell commands.

Example loop for the same scenario steps:

1. `browser_navigate` to `http://127.0.0.1:4312`
2. `browser_snapshot` to get visible element refs
3. `browser_click` using returned refs (for Debug tab, thread rows, etc.)
4. Poll `browser_console_messages` and `browser_network_requests` during and after interactions, not only after visible failures
5. `browser_evaluate` to read transient banner event buffer from `window.__farfieldBannerEvents`
6. `browser_take_screenshot` for visual evidence
7. Repeat after local code edit while Vite HMR updates
8. If unexpected signal appears, stop progression and fix before continuing feature work.

The manual MCP flow and Playwright spec flow should use the same scenario definitions so reproductions stay aligned.

## Rollout Sequence

### Phase 1: Tooling + hooks

- Add Playwright scripts/config.
- Add `.gitignore` entries.
- Add test IDs to key UI regions in `App.tsx`.

### Phase 2: Fixtures + helpers

- Build real-app fixture.
- Add shared action/assertion helpers.
- Add error-sentinel helper and transient banner observer.
- Wire diagnostics output.

### Phase 3: Baseline scenarios

- Implement `app-load`, `thread-open`, `debug-tab`.
- Ensure account-agnostic behavior in every test.
- Require sentinel-clean assertions in all scenarios.

### Phase 4: Documentation + guardrails

- Add `end-to-end/real/README.md` with run/debug instructions.
- Update root docs to point to the same loop.

### Phase 5: Coverage governance

- Add `end-to-end/real/coverage-matrix.md`.
- Add policy checks that reject missing owner/due date for open coverage gaps.
- Add checks that reject expired or structurally-invalid allowlist entries.

## Acceptance Criteria

Implementation is complete when:

1. `pnpm smoke:app` passes on healthy runtime.
2. `pnpm end-to-end:real:run` passes locally with both:
   - empty thread account
   - account with existing threads
3. `pnpm end-to-end:real:ui` supports fast reruns while `pnpm dev` is active.
4. Baseline scenarios emit Playwright artifacts on failure.
5. Scenario failure output includes:
   - API failures
   - new debug error delta
   - console warnings/errors
   - page errors
   - transient banner events
   - sentinel NDJSON artifact path
6. The formal AI dev loop policy is documented and enforced in scenario helpers.
7. Loading-state settle assertions are enforced with bounded timeouts.
8. `end-to-end/real/coverage-matrix.md` exists and is updated for feature-surface changes.
9. Docs clearly define both human loop and MCP loop, including how control is executed.

## Risks and Mitigations

- Runtime slowness on large local datasets
  - Use bounded waits and scenario-level time budgets.
- Data-dependent variability
  - Keep explicit branch logic for empty vs populated thread lists.
- Selector drift from UI refactors
  - Use test IDs instead of text-only selectors.
- Hidden regressions that do not break rendering
  - Enforce debug-error delta checks in every scenario.
- Short-lived UI errors that disappear before manual observation
  - Enforce transient banner capture via mutation observer.
- Allowlist creep reducing signal quality
  - Require strict allowlist schema with owner + expiry + tracking issue.
- Test suite passes while new feature surfaces stay uncovered
  - Enforce coverage matrix updates and explicit tracked gaps.

## Definition of Done

Developers can run one command for runtime health (`pnpm smoke:app`), one command for headless real UI checks (`pnpm end-to-end:real:run`), and one interactive command for live repro/debug (`pnpm end-to-end:real:ui`), with continuous warning/error surveillance, enforced loading-settle timeouts, maintained coverage mapping, and failure diagnostics that directly point to root cause.

## Potential Ideas (Estimated Value)

These are candidate improvements prioritized by estimated practical return on value.

1. Auto end-to-end failure diagnostics attachments (sentinel + health snapshot on fail): `90%`
2. Debug UI runtime counters (health + queue/rate-limit visibility): `80%`
3. `smoke:app` latency budgets (warn/fail modes): `72%`
4. Server integration tests for queue/rate-limit/observability fields: `68%`
5. Stream-burst stress command for thread/event pressure: `58%`
