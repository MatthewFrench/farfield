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

3. Ensure `API_TOKEN` is set in the same shell:

```bash
export API_TOKEN="${API_TOKEN:-$(grep '^API_TOKEN=' .env.local | cut -d'=' -f2-)}"
```

4. Create an isolated ephemeral smoke thread (do not use existing threads for mutating checks):

```bash
SMOKE_THREAD_ID="$(node -e 'const token=process.env.API_TOKEN; if(!token){throw new Error(\"API_TOKEN missing\");} fetch(\"http://127.0.0.1:4311/api/threads\",{method:\"POST\",headers:{\"Content-Type\":\"application/json\",\"X-Farfield-Token\":token},body:JSON.stringify({agentId:\"codex\",ephemeral:true})}).then(async(r)=>{const j=await r.json(); if(!r.ok||j.ok!==true||typeof j.threadId!==\"string\"){throw new Error(JSON.stringify(j));} process.stdout.write(j.threadId);});')"
echo "SMOKE_THREAD_ID=$SMOKE_THREAD_ID"
```

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

## Pass criteria

- App shell loads and stays responsive.
- A thread can be selected and chat content is visible.
- Debug tab renders history and client error panels.
- Error banner is absent unless intentionally reproduced.
- No unexpected console or `/api/*` failures appear during the flow.

## Cleanup

Archive the isolated smoke thread:

```bash
curl -sS -X POST "http://127.0.0.1:4311/api/threads/$SMOKE_THREAD_ID/archive" \
  -H "X-Farfield-Token: $API_TOKEN"
```

## Regression follow-up

After manual MCP pass, run:

```bash
pnpm end-to-end:real:run
pnpm verify:end-to-end:real
```
