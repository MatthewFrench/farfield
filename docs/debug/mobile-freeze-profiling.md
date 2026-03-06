# Mobile Freeze Profiling

This document defines the Farfield workflow for diagnosing mobile freezes, especially sidebar-open stalls.

## Goal

Measure user-visible freezes, not only function durations.

For each freeze incident, capture:

1. how long the UI stopped advancing
2. which long tasks overlapped that stop
3. which Farfield-owned operations were running during the same window
4. which network requests were active at the same time

The output must be reviewable, repeatable, and suitable for iterative optimization.

## Signals Collected

Farfield now records these browser-side signals during development sessions:

1. Freeze windows
   - Derived from `requestAnimationFrame` gaps.
   - A freeze window is recorded when the frame gap exceeds the configured threshold.
2. Long tasks
   - Captured through `PerformanceObserver` with `type: "longtask"`.
3. App-owned operation intervals
   - HTTP request timing from the shared Farfield transport.
   - Thread-list presentation worker round trips.
   - Sidebar open requests and thread-list pane commit markers.
4. Standard render metrics
   - FP, FCP, LCP, CLS, long-task count, total long-task duration.

These signals are available live in dev sessions through:

```js
window.__farfieldClientPerformanceFreezeProbeOwner?.readSnapshot()
```

## Automated Loop

The repeatable automated profile is:

```bash
pnpm dev
pnpm smoke:app
pnpm end-to-end:real:mobile-freeze-profile
```

For a Safari-like automated run, use:

```bash
pnpm end-to-end:real:mobile-freeze-profile:webkit
```

This run:

1. opens the real app with a mobile viewport
2. waits for initial shell readiness
3. resets the client freeze probe after startup
4. repeatedly opens and closes the mobile sidebar
5. reads the client freeze probe snapshot
6. correlates freeze windows with overlapping operations and long tasks
7. writes a structured artifact

Artifacts:

1. `.runtime/end-to-end-performance/<label>.json`
2. `.runtime/end-to-end-performance/latest.json`
3. `.runtime/end-to-end-sentinel/latest.ndjson`

The performance artifact includes:

1. raw client probe snapshot
2. derived freeze report
3. longest freeze window
4. overlapping operation aggregates

## Budgets

The mobile freeze profile supports these environment variables:

1. `E2E_REAL_MOBILE_SIDEBAR_PROFILE_ITERATIONS`
2. `E2E_REAL_MOBILE_SIDEBAR_READY_BUDGET_MS`
3. `E2E_REAL_MOBILE_SIDEBAR_MAX_FREEZE_COUNT`
4. `E2E_REAL_MOBILE_SIDEBAR_MAX_FREEZE_DURATION_MS`
5. `E2E_REAL_MOBILE_SIDEBAR_MAX_TOTAL_FREEZE_DURATION_MS`
6. `E2E_REAL_MOBILE_SIDEBAR_MAX_LONG_TASK_DURATION_MS`

Example:

```bash
E2E_REAL_MOBILE_SIDEBAR_PROFILE_ITERATIONS=30 \
E2E_REAL_MOBILE_SIDEBAR_MAX_FREEZE_DURATION_MS=350 \
pnpm end-to-end:real:mobile-freeze-profile
```

## How To Read Results

Focus on the longest freeze incident first.

Look for:

1. `freezeWindow.durationMilliseconds`
2. `overlappingOperations`
3. `overlappingLongTaskCount`
4. `overlappingLongTaskTotalDurationMilliseconds`
5. aggregate operation names with the highest total overlap

Typical interpretations:

1. Freeze overlaps `http-request` only
   - The UI may be waiting on synchronous response processing after the request completes.
2. Freeze overlaps `http-request` and `thread-list-presentation-worker-roundtrip`
   - The stall likely includes transport decode, structured clone, worker message handling, or follow-up render work.
3. Freeze overlaps `thread-list-pane-committed`
   - The stall is likely render/commit heavy rather than network bound.

## Live Devtools Loop

For iterative debugging without leaving the app:

1. Start `pnpm dev`
2. Open the app on a mobile-sized viewport
3. Reproduce the sidebar interaction
4. In DevTools console, inspect:

```js
window.__farfieldClientPerformanceFreezeProbeOwner?.readSnapshot()
```

5. If needed, clear accumulated records between reproductions:

```js
window.__farfieldClientPerformanceFreezeProbeOwner?.resetRecordedEntries()
```

This is the fastest loop for patching and rechecking without waiting for a full automated run.

## Realistic Mobile Options

### 1. Playwright mobile viewport on Chromium

Best for:

1. repeatability
2. artifact capture
3. automated regression budgets

Limitations:

1. not Safari/WebKit
2. not a true iOS event pipeline

Use this first for fast iteration.

### 2. Playwright WebKit with an iPhone device profile

Best for:

1. Safari-like browser behavior without leaving automation
2. repeatable regression runs against a mobile WebKit engine
3. comparing Chromium and WebKit freeze artifacts side by side

Commands:

```bash
pnpm end-to-end:real:run:webkit
pnpm end-to-end:real:mobile-freeze-profile:webkit
pnpm end-to-end:real:debug:webkit -- --grep "mobile sidebar"
```

Limitations:

1. still not the iOS Simulator Safari shell
2. still not a real device

This is the best automated approximation of Safari in the current repo.

### 3. Playwright UI mode for live interactive runs

Best for:

1. watching the interaction live
2. rerunning the same scenario quickly
3. reading the generated artifacts while editing

Commands:

```bash
pnpm end-to-end:real:ui
pnpm end-to-end:real:debug -- --grep "mobile sidebar"
```

### 4. iOS Simulator with Safari Web Inspector

Best for:

1. WebKit-specific behavior
2. seeing freezes live with a more realistic mobile browser engine

Recommended setup:

1. serve the app with HTTPS or a reachable LAN host
2. trust the local certificate authority if needed
3. open the app in iOS Simulator Safari
4. use Safari Web Inspector from macOS
5. read the in-app probe state from the console

Helpful repo commands:

```bash
pnpm setup:domain-https
pnpm ios:trust-local-ca
```

### 5. Real iPhone / iPad device

Best for:

1. actual device performance
2. actual touch/thermal/background behavior
3. final confirmation before declaring the issue fixed

Helpful repo commands:

```bash
pnpm smoke:ios-device
pnpm smoke:ios-matrix
```

The current repo automation around iOS is strongest for connectivity and push flows, not full browser UI automation. For mobile-freeze investigation, the practical approach today is:

1. iterate automatically with Playwright Chromium mobile profiling
2. compare against Playwright WebKit mobile profiling
3. confirm live behavior with iOS Simulator Safari
4. confirm final behavior on a real device

## Iteration Workflow

1. Run `pnpm end-to-end:real:mobile-freeze-profile`
2. Open `.runtime/end-to-end-performance/latest.json`
3. Find the longest freeze incident
4. Patch the overlapping owner or render path
5. Re-run the mobile freeze profile
6. Compare:
   - freeze count
   - longest freeze duration
   - total freeze duration
   - top overlapping operations

Do not optimize blindly. Always compare before and after artifacts for the same scenario.
