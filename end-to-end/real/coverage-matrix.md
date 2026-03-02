# Real App Coverage Matrix

## Covered Flows

| Feature/Screen | Primary User Flow | Spec | Manual Flow ID | Owner | Last Validated |
| --- | --- | --- | --- | --- | --- |
| App shell load | Open app and verify stable shell + no runtime regressions | `end-to-end/real/scenarios/app-load.spec.ts` (`app load health`) | `MANUAL-APP-LOAD` | `@farfield` | `2026-02-19` |
| Loading threads UX | During initial `/api/threads` delay, main pane shows loading spinner and settles cleanly | `end-to-end/real/scenarios/loading-threads.spec.ts` (`loading threads UX in main pane`) | `MANUAL-LOADING-THREADS` | `@farfield` | `2026-02-19` |
| Thread list + chat routing | Open first thread when available, otherwise validate empty states | `end-to-end/real/scenarios/thread-open.spec.ts` (`thread list and open behavior`) | `MANUAL-THREAD-OPEN` | `@farfield` | `2026-02-19` |
| Debug tab visibility | Open Debug tab and verify history + trace/stream panels | `end-to-end/real/scenarios/debug-tab.spec.ts` (`debug tab accessibility`) | `MANUAL-DEBUG-TAB` | `@farfield` | `2026-02-19` |
| Error banner persistence + dismiss | Force a deterministic API failure, verify banner persists and closes only via manual dismiss | `end-to-end/real/scenarios/error-banner.spec.ts` (`error banner persists until manual dismiss`) | `MANUAL-ERROR-BANNER` | `@farfield` | `2026-02-20` |
| Mobile sidebar toggles | Open and close the mobile sidebar via close button and backdrop | `end-to-end/real/scenarios/mobile-sidebar.spec.ts` (`mobile sidebar open and close behavior`) | `MANUAL-MOBILE-SIDEBAR` | `@farfield` | `2026-02-20` |
| Startup refresh + header refresh | Validate startup settle and manual header refresh settle without runtime regressions | `end-to-end/real/scenarios/startup-and-header-refresh.spec.ts` (`startup and header refresh behavior`) | `MANUAL-STARTUP-HEADER-REFRESH` | `@farfield` | `2026-02-24` |
| Startup under deferred-load pressure | Slow deferred startup endpoints and verify shell/thread list remain interactive without startup banner | `end-to-end/real/scenarios/startup-under-load.spec.ts` (`startup remains interactive when deferred startup requests are slow`) | `MANUAL-STARTUP-UNDER-LOAD` | `@farfield` | `2026-02-25` |
| Thread row maintenance actions + identity stability | Trigger row-menu maintenance actions and verify thread row, runtime-status badge, and sidebar runtime summary chips keep stable node identity | `end-to-end/real/scenarios/thread-row-menu-maintenance-actions.spec.ts` (`row-menu compact and clean actions keep row and runtime-summary identity stable`) | `MANUAL-THREAD-ROW-MAINTENANCE` | `@farfield` | `2026-03-01` |
| Runtime warning banner identity stability | Project runtime warning notifications and verify header warning banner node identity remains stable through manual refresh | `end-to-end/real/scenarios/runtime-notification-banner-stability.spec.ts` (`runtime warning banner keeps stable node identity across header refresh`) | `MANUAL-RUNTIME-WARNING-BANNER-STABILITY` | `@farfield` | `2026-03-01` |
| Performance and readiness budgets | Enforce readiness time budgets plus render metrics (CLS, long-task, FCP) on core startup/open/debug flows | `end-to-end/real/scenarios/app-load.spec.ts`, `thread-open.spec.ts`, `debug-tab.spec.ts`, `startup-under-load.spec.ts`, `startup-and-header-refresh.spec.ts` | `MANUAL-PERFORMANCE-BUDGETS` | `@farfield` | `2026-03-01` |
| Manual MCP live timing/error guard | Continuously monitor new debug errors, request-error deltas, route p95 latency/queue-delay, and event-loop lag while interactive MCP browser actions run | `scripts/operations/playwright-manual-guard.mjs`, `pnpm end-to-end:real:manual:guard` | `MANUAL-MCP-LIVE-GUARD` | `@farfield` | `2026-03-01` |
| Manual MCP session bootstrap | One-command startup for manual sessions with runtime reuse-or-start, smoke baseline gating, and live guard process ownership | `scripts/operations/playwright-manual-session.mjs`, `pnpm end-to-end:real:manual:session` | `MANUAL-MCP-SESSION-BOOTSTRAP` | `@farfield` | `2026-03-01` |

## Open Gaps

| Gap | Impact | Owner | Due Date | Tracking Issue |
| --- | --- | --- | --- | --- |
