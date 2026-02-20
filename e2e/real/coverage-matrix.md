# Real App Coverage Matrix

## Covered Flows

| Feature/Screen | Primary User Flow | Spec | Manual Flow ID | Owner | Last Validated |
| --- | --- | --- | --- | --- | --- |
| App shell load | Open app and verify stable shell + no runtime regressions | `e2e/real/scenarios/app-load.spec.ts` (`app load health`) | `MANUAL-APP-LOAD` | `@farfield` | `2026-02-19` |
| Loading threads UX | During initial `/api/threads` delay, main pane shows loading spinner and settles cleanly | `e2e/real/scenarios/loading-threads.spec.ts` (`loading threads UX in main pane`) | `MANUAL-LOADING-THREADS` | `@farfield` | `2026-02-19` |
| Thread list + chat routing | Open first thread when available, otherwise validate empty states | `e2e/real/scenarios/thread-open.spec.ts` (`thread list and open behavior`) | `MANUAL-THREAD-OPEN` | `@farfield` | `2026-02-19` |
| Debug tab visibility | Open Debug tab and verify history + trace/stream panels | `e2e/real/scenarios/debug-tab.spec.ts` (`debug tab accessibility`) | `MANUAL-DEBUG-TAB` | `@farfield` | `2026-02-19` |
| Error banner persistence + dismiss | Force a deterministic API failure, verify banner persists and closes only via manual dismiss | `e2e/real/scenarios/error-banner.spec.ts` (`error banner persists until manual dismiss`) | `MANUAL-ERROR-BANNER` | `@farfield` | `2026-02-20` |
| Mobile sidebar toggles | Open and close the mobile sidebar via close button and backdrop | `e2e/real/scenarios/mobile-sidebar.spec.ts` (`mobile sidebar open and close behavior`) | `MANUAL-MOBILE-SIDEBAR` | `@farfield` | `2026-02-20` |

## Open Gaps

| Gap | Impact | Owner | Due Date | Tracking Issue |
| --- | --- | --- | --- | --- |
