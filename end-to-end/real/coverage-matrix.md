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

## Open Gaps

| Gap | Impact | Owner | Due Date | Tracking Issue |
| --- | --- | --- | --- | --- |
