# Client Error Triage

Farfield records both client-side and server-side errors to a session NDJSON log.

## Where errors are stored

- Runtime directory: `.runtime/logs/errors/`
- Session log filename pattern: `session-<iso-timestamp>-<pid>.ndjson`
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

## Useful local commands

```bash
# Show newest session logs
ls -lt .runtime/logs/errors

# Read recent events from the newest session log
tail -n 200 "$(ls -t .runtime/logs/errors/session-*.ndjson | head -n 1)"

# Filter by operation
rg '"operation":"push:auto-heal"' .runtime/logs/errors/session-*.ndjson

# Filter by a known errorId
rg '"errorId":"error_' .runtime/logs/errors/session-*.ndjson
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
4. If needed, parse `.runtime/logs/errors/session-*.ndjson` for full-session context.
