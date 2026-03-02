# Playwright MCP Manual Smoke

Use this when validating fixes against the real running app with interactive MCP control.

## Preconditions

1. Preferred: start full manual session bootstrap:

```bash
pnpm end-to-end:real:manual:session
```

This reuses a healthy runtime when one is already running, otherwise starts runtime, runs `smoke:app`, and starts live manual guard monitoring in one terminal.

Alternative (manual split):

2. Start Farfield runtime:

```bash
pnpm dev
```

3. Confirm runtime endpoint health:

```bash
pnpm smoke:app
```

4. Ensure `API_TOKEN` is set in the same shell:

```bash
export API_TOKEN="${API_TOKEN:-$(grep '^API_TOKEN=' .env.local | cut -d'=' -f2-)}"
```

5. Create an isolated ephemeral smoke thread (do not use existing threads for mutating checks):

```bash
SMOKE_THREAD_ID="$(node -e 'const token=process.env.API_TOKEN; if(!token){throw new Error(\"API_TOKEN missing\");} fetch(\"http://127.0.0.1:4311/api/threads\",{method:\"POST\",headers:{\"Content-Type\":\"application/json\",\"X-Farfield-Token\":token},body:JSON.stringify({agentId:\"codex\",ephemeral:true})}).then(async(r)=>{const j=await r.json(); if(!r.ok||j.ok!==true||typeof j.threadId!==\"string\"){throw new Error(JSON.stringify(j));} process.stdout.write(j.threadId);});')"
echo "SMOKE_THREAD_ID=$SMOKE_THREAD_ID"
```

6. In a separate terminal, start live timing/error guard monitoring:

```bash
pnpm end-to-end:real:manual:guard
```

Keep this process running during the full MCP flow. Stop it with `Ctrl+C` only after finishing all steps below.

Skip this step when using `pnpm end-to-end:real:manual:session`, because guard monitoring is already running.

## Manual MCP flow

Run these MCP browser tool calls in order:

1. `browser_navigate` with `url: "http://127.0.0.1:4312"`
2. `browser_snapshot` and confirm `data-testid="app-shell"` is present.
3. `browser_navigate` with `url: "http://127.0.0.1:4312/threads/$SMOKE_THREAD_ID"`.
4. `browser_snapshot` and locate the row with `data-thread-id="$SMOKE_THREAD_ID"` (`data-testid="thread-list-item"`), then `browser_click` it if needed.
5. `browser_snapshot` and confirm chat area is no longer `No thread selected`.
6. `browser_click` on Debug tab (`data-testid="tab-debug"`).
7. `browser_snapshot` and confirm debug panels are visible (`data-testid="debug-history-panel"` and `data-testid="debug-stream-events-panel"`).
8. `browser_evaluate` with:

```ts
() => {
  const banner = document.querySelector('[data-testid="error-banner"]');
  const events = Array.isArray((window as Window & { __farfieldBannerEvents?: object[] }).__farfieldBannerEvents)
    ? (window as Window & { __farfieldBannerEvents?: object[] }).__farfieldBannerEvents!.length
    : 0;
  return {
    bannerVisible: banner !== null,
    bannerEvents: events
  };
}
```

9. `browser_console_messages` with `level: "warn"` and verify no unexpected errors/warnings.
10. `browser_network_requests` with `includeStatic: false` and verify no unexpected failed `/api/*` requests.
11. `browser_evaluate` and capture render metrics:

```ts
() => {
  const layoutShiftEntries = performance.getEntriesByType("layout-shift");
  let cumulativeLayoutShift = 0;
  for (const entry of layoutShiftEntries) {
    const typedEntry = entry;
    if (!typedEntry.hadRecentInput) {
      cumulativeLayoutShift += typedEntry.value;
    }
  }
  const navigationEntries = performance.getEntriesByType("navigation");
  const navigationEntry = navigationEntries[0];
  const paintEntries = performance.getEntriesByType("paint");
  let firstContentfulPaintMs = null;
  for (const entry of paintEntries) {
    if (entry.name === "first-contentful-paint") {
      firstContentfulPaintMs = Math.round(entry.startTime);
    }
  }
  return {
    firstContentfulPaintMs,
    largestContentfulPaintMs: null,
    domContentLoadedMs:
      navigationEntry === undefined ? null : Math.round(navigationEntry.domContentLoadedEventEnd),
    loadEventMs: navigationEntry === undefined ? null : Math.round(navigationEntry.loadEventEnd),
    cumulativeLayoutShift: Number(cumulativeLayoutShift.toFixed(4))
  };
}
```

Compare captured values against real e2e budgets used in automated scenarios and flag regressions immediately.

## Pass criteria

- App shell loads and stays responsive.
- A thread can be selected and chat content is visible.
- Debug tab renders history and client error panels.
- Error banner is absent unless intentionally reproduced.
- No unexpected console or `/api/*` failures appear during the flow.
- Manual guard summary reports:
  - `new debug errors: 0`
  - `new request errors: 0`
  - `budget violations: 0`

## Cleanup

Archive the isolated smoke thread:

```bash
curl -sS -X POST "http://127.0.0.1:4311/api/threads/$SMOKE_THREAD_ID/archive" \
  -H "X-Farfield-Token: $API_TOKEN"
```

## Regression follow-up

After manual MCP pass, run:

```bash
pnpm end-to-end:real:safe-run
pnpm verify:end-to-end:real
```
