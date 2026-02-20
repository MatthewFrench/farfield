# Playwright MCP Manual Smoke

Use this when validating fixes against the real running app with interactive MCP control.

## Preconditions

1. Start Farfield runtime:

```bash
pnpm dev
```

2. Confirm runtime endpoint health:

```bash
pnpm smoke:app
```

## Manual MCP flow

Run these MCP browser tool calls in order:

1. `browser_navigate` with `url: "http://127.0.0.1:4312"`
2. `browser_snapshot` and confirm `data-testid="app-shell"` is present.
3. `browser_snapshot` and locate the first visible thread row (`data-testid="thread-list-item"`).
4. `browser_click` on that thread row.
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

## Pass criteria

- App shell loads and stays responsive.
- A thread can be selected and chat content is visible.
- Debug tab renders history and client error panels.
- Error banner is absent unless intentionally reproduced.
- No unexpected console or `/api/*` failures appear during the flow.

## Regression follow-up

After manual MCP pass, run:

```bash
pnpm e2e:real:run
pnpm verify:real
```
