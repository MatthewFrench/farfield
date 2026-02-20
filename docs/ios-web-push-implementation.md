# iOS Home Screen + Push Notifications Implementation Plan

## Objective

Add standards-compliant iOS Home Screen web app support and background push notifications for Codex completion events, while preserving all current Farfield behavior.

## Success Criteria

1. Farfield can be installed to iOS Home Screen and launches in standalone mode.
2. The app can request notification permission from user interaction.
3. Push subscriptions are created and stored by the server with strict Zod validation.
4. The server sends a push notification when a Codex turn completes.
5. Existing live UX (`/events` SSE + periodic refresh) remains unchanged.
6. Local LAN HTTPS and real-domain HTTPS are both easy to run with Caddy.
7. Default README quick start remains unchanged (`pnpm install`, `pnpm dev`).

## Non-Goals

1. Continuous arbitrary background JavaScript execution on iOS.
2. Replacing the existing SSE architecture.
3. Adding a native iOS wrapper.

## Known iOS Limits

1. Web app background execution is suspended aggressively; do not rely on continuous SSE while app is not foregrounded.
2. Push delivery timing is best-effort and can be delayed by Focus mode, battery conditions, connectivity, or OS policy.
3. Notification permission and push subscription must be initiated from explicit user interaction.
4. Push support requires Home Screen install flow and HTTPS secure origin.
5. Notification display behavior can vary by iOS version and system settings.

## Current Codebase Baseline

1. Frontend is Vite + React in `apps/web`.
2. Backend is Node HTTP server in `apps/server/src/index.ts`.
3. Live updates currently depend on `EventSource("/events")` in `apps/web/src/App.tsx`.
4. Thread stream events are already available from IPC broadcasts and reduced with `reduceThreadStreamEvents`.

## Proposed Architecture

1. Keep current SSE flow for foreground responsiveness.
2. Add a PWA shell (manifest + service worker) in `apps/web`.
3. Add Web Push subscription API + persistence + send pipeline in `apps/server`.
4. Trigger push on strict completion transition detection from `thread-stream-state-changed` events.
5. Put Caddy in front as the single HTTPS origin for web + API + SSE.
6. Add lightweight API auth for `/api/*` and `/events` when remote access is enabled.

## Implementation Scope by Package

## `packages/codex-protocol`

Add strict schemas and typed parsers for push-related payloads.

### New file

`packages/codex-protocol/src/push.ts`

### Schemas

1. `PushSubscriptionKeysSchema`
2. `PushSubscriptionSchema`
3. `CreatePushSubscriptionBodySchema`
4. `DeletePushSubscriptionBodySchema`
5. `PushSettingsSchema`
6. `PushNotificationPayloadSchema`
7. `VapidPublicKeyResponseSchema`

All schemas must be `.strict()` and parsed via dedicated parser functions that throw `ProtocolValidationError` with clear context.

### Exports

Update `packages/codex-protocol/src/index.ts` to export `push.ts`.

## `apps/server`

### Dependencies

1. Add `web-push`.
2. Add type declarations if needed by TS config.

### Environment variables

1. `PUSH_VAPID_PUBLIC_KEY`
2. `PUSH_VAPID_PRIVATE_KEY`
3. `PUSH_VAPID_SUBJECT` (for example `mailto:you@example.com`)
4. `PUSH_ENABLED` (`true` or `false`)

The server should fail fast at startup with a clear error if `PUSH_ENABLED=true` and required VAPID configuration is missing.

### Persistence

Add `apps/server/src/push-store.ts`.

Responsibilities:

1. Load subscriptions from disk at startup.
2. Validate every record with protocol schemas.
3. Persist updates atomically (write temp file, fsync, rename).
4. Support upsert/remove/list operations by stable key.
5. Persist completion notification watermarks to prevent duplicate notifications after server restart.

Storage location:

`apps/server/push-subscriptions.json` (gitignored) or an app data directory path from env.

### Push delivery service

Add `apps/server/src/push-service.ts`.

Responsibilities:

1. Configure VAPID once.
2. Send notification payloads to each subscription.
3. Remove invalid subscriptions on `404` / `410`.
4. Surface structured logs and metrics.

### Completion detector

Add `apps/server/src/completion-detector.ts`.

Responsibilities:

1. Consume reduced conversation state by thread.
2. Track last notified completion marker per thread.
3. Emit exactly-once notification trigger per completion.

Recommended marker:

`{ threadId, turnIdOrId, lastAgentMessageId }`

No heuristics outside strict typed state. The detector should operate only on parsed `ThreadConversationState`.

### HTTP API additions

Add routes in `apps/server/src/index.ts`:

1. `GET /api/push/vapid-public-key`
2. `GET /api/push/status`
3. `POST /api/push/subscriptions`
4. `DELETE /api/push/subscriptions`
5. Optional: `POST /api/push/test` (dev only)

All request bodies must use `parseBody` with strict Zod schemas from protocol/server schemas.

### API Contract Examples

Use one strict JSON envelope style across all new endpoints.

Success envelope:

```json
{
  "ok": true
}
```

Error envelope:

```json
{
  "ok": false,
  "error": "clear actionable message"
}
```

`GET /api/push/vapid-public-key`:

```json
{
  "ok": true,
  "publicKey": "BElidedBase64Url"
}
```

`GET /api/push/status`:

```json
{
  "ok": true,
  "enabled": true,
  "permissionRequired": true,
  "subscriptionCount": 3,
  "privateModeDefault": true
}
```

`POST /api/push/subscriptions` request:

```json
{
  "subscription": {
    "endpoint": "https://example.push.service/...",
    "keys": {
      "p256dh": "Base64UrlValue",
      "auth": "Base64UrlValue"
    }
  },
  "settings": {
    "privateMode": true
  }
}
```

`POST /api/push/subscriptions` response:

```json
{
  "ok": true,
  "subscriptionId": "sub_01J..."
}
```

`DELETE /api/push/subscriptions` request:

```json
{
  "endpoint": "https://example.push.service/..."
}
```

`DELETE /api/push/subscriptions` response:

```json
{
  "ok": true,
  "deleted": true
}
```

### API auth

Protect `/api/*` with an optional shared secret header.

1. Env: `API_TOKEN` (`PUSH_API_TOKEN` remains accepted as a compatibility alias).
2. Header: `X-Farfield-Token: <token>`
3. Behavior:
   - When `API_TOKEN` is set, missing/invalid token returns `401` with strict JSON envelope.
   - When `API_TOKEN` is unset, `/api/*` remains open for development compatibility.
4. Validation remains strict and explicit; auth check happens before body parsing.
5. `/events` uses the same token requirement when `API_TOKEN` is set. In browser flows, trusted reverse proxies inject `X-Farfield-Token` upstream.

### Event hook integration

In the existing IPC frame handler where `thread-stream-state-changed` is processed:

1. Parse broadcast with existing parser.
2. Reduce state with existing reducer path.
3. Run completion detector.
4. On trigger, send push payload using push service.

The `/events` SSE path remains the same endpoint and stream contract.

## `apps/web`

### PWA shell

Add:

1. `apps/web/public/manifest.webmanifest`
2. `apps/web/public/icons/*` (maskable + standard sizes)
3. Service worker entry: `apps/web/public/sw.js` (manual registration, current implementation).

### Service worker behavior

1. Handle `push` event and show notification.
2. Handle `notificationclick` and focus/open Farfield.
3. Explicitly exclude `/api/*` and `/events` from runtime caching.
4. Keep runtime behavior minimal and explicit.

### Client push API module

Add `apps/web/src/lib/push.ts`.

Responsibilities:

1. Register service worker.
2. Request notification permission from explicit user action.
3. Fetch VAPID public key from server.
4. Subscribe via `PushManager`.
5. POST subscription to server.
6. Unsubscribe and DELETE on server when disabled.

### UI integration

Add a compact notifications control in existing settings area (without redesigning main interaction model):

1. `Enable Notifications` button.
2. Current status badge:
   - permission
   - service worker registered
   - server subscription present
3. Optional `Send Test Notification` button in debug tab.
4. Add privacy mode toggle:
   - `Private`: generic completion text only.
   - `Detailed`: include assistant snippet preview.

No change to chat rendering or existing polling/SSE behavior.

## Caddy HTTPS Setup

Use Caddy as the single entrypoint for both local LAN and real domain deployments.

### Local LAN (trusted internal CA)

Tracked template: `ops/caddy/Caddyfile.local.template`  
Generated runtime file (gitignored): `ops/caddy/Caddyfile.local`

```caddyfile
{{SITE_ADDRESS}} {
  tls internal

  @api path /api/*
  reverse_proxy @api 127.0.0.1:4311 {
    header_up X-Farfield-Token {env.API_TOKEN}
  }

  @events path /events
  reverse_proxy @events 127.0.0.1:4311 {
    flush_interval -1
  }

  reverse_proxy 127.0.0.1:4312
}
```

Notes:

1. Prefer stable local hostname (for example `farfield.local`) mapped via router/DNS; use raw IP only if needed.
2. Install and trust Caddy internal root CA on iOS device once.
3. Run Farfield with `pnpm dev` and let Caddy expose the HTTPS LAN origin.

### Real Domain (public CA)

Tracked template: `ops/caddy/Caddyfile.domain.template`  
Generated runtime file (gitignored): `ops/caddy/Caddyfile.domain`

```caddyfile
{{DOMAIN_HOST}} {
  @api path /api/*
  reverse_proxy @api 127.0.0.1:4311 {
    header_up X-Farfield-Token {env.API_TOKEN}
  }

  @events path /events
  reverse_proxy @events 127.0.0.1:4311 {
    flush_interval -1
  }

  reverse_proxy 127.0.0.1:4312
}
```

Notes:

1. Point DNS A/AAAA record to host.
2. Caddy handles certificate issuance automatically.
3. Use this for the simplest long-term setup.

## Ops Runbook

Local HTTPS:

1. Run setup once: `pnpm setup:ios-push`.
2. Trust local Caddy CA on macOS: `pnpm ios:trust-local-ca`.
3. Start stack: `pnpm ios:local`.
4. On iOS, trust Caddy root CA once.
5. Open HTTPS origin in Safari, then add to Home Screen.
6. Launch from Home Screen and enable notifications.

Domain HTTPS:

1. Point DNS to host IP.
2. Generate domain config: `pnpm setup:domain-https`
3. Start Farfield: `pnpm dev`
4. Start Caddy with domain config: `caddy run --config ops/caddy/Caddyfile.domain`
5. Open domain in Safari, add to Home Screen, enable notifications.

Incident quick checks:

1. `push:doctor` passes.
2. VAPID env vars are present.
3. `/api/push/status` returns `ok: true`.
4. Subscription count is non-zero.
5. Server logs show completion trigger and push send attempt.
6. For failed sends, confirm invalid subscriptions are pruned.

## Build and Runtime Ergonomics

Add convenience scripts in root `package.json`:

1. `setup:ios-push` (writes `.env.local` with generated keys/token)
2. `setup:domain-https` (generates `ops/caddy/Caddyfile.domain` from template)
3. `ios:trust-local-ca` (runs explicit local CA trust setup before launching local HTTPS stack)
4. `ios:local` (starts app stack + Caddy local config)
5. `push:keys` (generate VAPID keypair)
6. `push:doctor` (checks env vars, Caddy template/runtime config presence, and live `/api/health` + `/api/push/status` reachability)
7. `rotate:api-token` (rotates `API_TOKEN` and `PUSH_DOCTOR_TOKEN` in `.env.local`)
8. `smoke:ios-device` (single-device interactive push smoke using an isolated ephemeral thread, archived on completion)
9. `smoke:ios-matrix` (run the same smoke flow across two or more iOS targets using `IOS_DEVICE_SMOKE_MATRIX`)

Provide `.env.example` entries for push config.

## README Simplicity

Keep README onboarding minimal:

1. Do not change existing quick start section.
2. Add one optional section: `iOS Push (HTTPS)`.
3. Include only:
   - one local Caddy command path
   - one real-domain Caddy command path
   - a short verification checklist
4. Keep all advanced troubleshooting in `docs/ios-web-push-implementation.md`.

## Data Contracts and Strictness Rules

1. Every new payload crossing HTTP boundaries must have strict Zod schema validation.
2. No shape probing logic outside Zod parsers.
3. No untyped objects in push modules.
4. Clear, actionable validation errors for malformed payloads.

## Security and Privacy Defaults

1. Default notification mode is `Private`.
2. `Private` mode body must not include assistant content snippets.
3. Recommend `API_TOKEN` whenever binding to non-loopback host.
4. Do not log full subscription payloads; log redacted endpoint hash only.
5. Keep subscription store file out of git and restricted to process owner permissions.

## Notification Trigger Rules

Send a push notification only when all conditions are true:

1. A thread conversation state exists.
2. The latest turn transitioned to a completed terminal status.
3. The latest turn contains a new `agentMessage` item not previously notified.
4. The event corresponds to a selected notification preference (global or per-thread).

Recommended payload fields:

1. `title`
2. `body`
3. `threadId`
4. `turnId`
5. `url` (for direct navigation)
6. `createdAt`

## Observability Requirements

Required structured counters:

1. `push_subscription_upsert_total`
2. `push_subscription_delete_total`
3. `push_send_attempt_total`
4. `push_send_success_total`
5. `push_send_failure_total`
6. `push_send_pruned_total`
7. `push_completion_trigger_total`
8. `push_completion_dedup_suppressed_total`

Required structured logs:

1. Push subscribe/unsubscribe with subscription identifier hash.
2. Completion trigger decision with thread and turn identifiers.
3. Push send result with status code and prune decision.
4. Auth rejection for `/api/*` with source IP and route.

## Rollout Plan

1. Phase 1: protocol schemas + server push store/service + API endpoints + `/api/*` auth.
2. Phase 2: web manifest + service worker + subscribe/unsubscribe UI.
3. Phase 3: completion detector integration + watermark persistence + notification preferences.
4. Phase 4: local HTTPS and domain docs + scripts.
5. Phase 5: test hardening and manual iOS validation.
6. Phase 6: developer UX hardening (`setup:ios-push`, token rotation, CI checks).

Each phase should land in a separate commit.

## Dry-Run Rollout Sequence

1. Developer machine over loopback HTTPS.
2. Developer machine over LAN HTTPS with one iOS device.
3. Domain HTTPS in a controlled test environment.
4. Day-long soak test with normal Codex usage.
5. Production use after zero duplicate-notification and zero regression checks.

## Test Plan

## Protocol tests

1. Valid payload parse success for each new schema.
2. Invalid payload parse failure with expected context.

## Server tests

1. Subscription create/delete/status endpoints.
2. Persistence load/save and atomic write behavior.
3. Completion detector emits once per completion marker.
4. Push send path handles invalid subscription cleanup.
5. API auth accepts valid token and rejects invalid/missing token.
6. Completion watermark survives restart and prevents duplicate send.

## Web tests

1. Push module permission/subscription flows (mocked).
2. UI state reflects permission and subscription transitions.
3. No regression in existing thread/chat rendering tests.

## Manual iOS tests

1. Open over HTTPS.
2. Install to Home Screen.
3. Launch from Home Screen.
4. Enable notifications from explicit button.
5. Trigger Codex completion.
6. Confirm notification delivery with app foregrounded and backgrounded.
7. Tap notification and verify deep link opens target thread.

## Definition of Done

Pass all items before merge:

1. `pnpm typecheck` passes for all workspaces.
2. `pnpm test` passes for protocol, server, and web packages.
3. Existing thread read/send/mode/user-input flows behave exactly as before.
4. Home Screen install works on iOS test device.
5. Notification permission prompt is shown only on explicit user action.
6. Completion notification is delivered at least once in foreground and background scenarios.
7. Tapping notification opens correct thread route.
8. Restarting server does not re-send old completion notifications.
9. Invalid push subscriptions are removed automatically after send failures indicating invalid endpoint.
10. README quick start remains unchanged and optional HTTPS section is concise.

## Regression Guardrails

1. Keep existing `/events` and `/api/*` contracts stable.
2. Keep current dev workflows (`pnpm dev`, `pnpm dev:remote`) intact.
3. Do not cache or intercept SSE/API in service worker.
4. Treat push as additive capability; existing UX remains functional without push permission.
5. Keep README default quick start unchanged.

## Remaining Priority Improvements (Ranked)

1. Add explicit integration tests for auth + push endpoint contracts (`/api/push/*`, `/api/events/session`, `/api/debug/client-errors/*`).
2. Add explicit iOS-version/device-matrix smoke coverage (real device).
3. Expand docs for non-localhost trusted dev origins (`VITE_DEV_PROXY_TRUSTED_ORIGINS`) with concrete examples.

## Open Decisions

1. Global notifications vs per-thread opt-in.
2. Notification content policy (include message snippet or generic completion text).
3. Storage location policy for subscription persistence.
4. Whether to show notifications for user-input requests in addition to completed turns.

## Minimal First Release Recommendation

1. Global opt-in only.
2. Completion notifications only.
3. Single notification template.
4. Caddy local + domain templates committed under `ops/caddy/`; generated runtime files are gitignored.
5. Expand preferences after first production validation.
