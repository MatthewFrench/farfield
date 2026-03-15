# Client Error Triage

Farfield records both client-side and server-side errors to a session NDJSON log.

## Where errors are stored

- Runtime directory: `.runtime/logs/errors/`
- Session log filename pattern: `session-<iso-timestamp>-<pid>.ndjson`
- Stable current-session mirror: `.runtime/logs/errors/latest-session.ndjson`
- Stable current-session metadata: `.runtime/logs/errors/latest-session.json`
- One JSON object per line, validated by `DebugErrorEventSchema` in `@farfield/protocol`

## Fastest way to inspect errors

1. Open Farfield Debug tab and select an error.
2. Use `errorId` from the banner or Debug panel.
3. Download the current session log from `/api/debug/client-errors/session-log`.

## API endpoints

- `POST /api/debug/client-errors`
  - Records a client error event (`origin: "client"`).
- `GET /api/debug/client-errors?limit=120`
  - Lists recent in-memory error events (client + server) for the active server session.
- `GET /api/debug/client-errors/:errorId`
  - Returns one error event by `errorId`.
- `GET /api/debug/client-errors/session-log`
  - Downloads the session NDJSON file.
- `GET /api/health`
  - Includes `state.appServerOperations` with live per-operation stats for:
    - `thread/list`
    - `model/list`
    - `collaborationMode/list`
  - Each operation includes counts + last latency/error fields (`lastDurationMs`, `lastStatus`, `lastError`, `timeoutCount`).
  - Includes `state.appServerStderr` with stderr suppression/rate-limit counters (`benignSuppressedCount`, `rateLimitedSuppressedCount`, `rateLimitedSuppressedInWindow`).
  - Includes `state.ipcHistoryRateLimit` with incoming IPC history suppression counters and current window stats.
  - Includes `state.trackedThreadEventCount` and `state.untrackedThreadEventCount` for stream-event capture pressure and tracking behavior.
  - Includes `state.appServerRequestTimeoutMs` for current app-server RPC timeout configuration.

## Useful local commands

```bash
# Show newest session logs
ls -lt .runtime/logs/errors

# Read the active session log without guessing the timestamped filename
tail -n 200 .runtime/logs/errors/latest-session.ndjson

# Read the active session metadata
cat .runtime/logs/errors/latest-session.json

# Read recent events from the newest session log
tail -n 200 "$(ls -t .runtime/logs/errors/session-*.ndjson | head -n 1)"

# Filter by operation
rg '"operation":"push:auto-heal"' .runtime/logs/errors/session-*.ndjson

# Filter by a known errorId
rg '"errorId":"error_' .runtime/logs/errors/session-*.ndjson

# Real-app end-to-end sentinel summary (latest scenario)
tail -n 200 .runtime/end-to-end-sentinel/latest.ndjson
```

## Event fields

Each event includes:

- `errorId`, `sessionId`
- `origin` (`client` or `server`)
- `source`, `operation`, `message`
- `name`, `stack`, `requestId`, `threadId`, `url`
- `occurredAt`, `recordedAt`
- `details` (JSON object)

## Recommended triage flow

1. Start from `errorId` shown in the red banner.
2. Open Debug tab and inspect the full event.
3. Correlate timestamp/operation with Debug History and Stream Events.
4. Use `.runtime/logs/errors/latest-session.ndjson` for current-session context.
5. If needed, parse `.runtime/logs/errors/session-*.ndjson` for older session context.
