# Farfield

A local UI for the [Codex](https://openai.com/codex) app — read your conversations, send messages, switch models, and monitor agent activity, all from a clean web interface running on your machine.

Built by [@anshuchimala](https://x.com/anshuchimala).

This is an independent project and is not affiliated with, endorsed by, or sponsored by OpenAI. I'm just an indie dev who likes to build with AI!

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=000000)](https://buymeacoffee.com/achimalap)

<img src="./screenshot.png" alt="Farfield screenshot" width="500" />

## What it does

Farfield connects to the Codex desktop app over its local IPC socket and app-server API, then exposes a polished web UI at `localhost:4312`. You get:

- **Thread browser** — sidebar grouped by project with all your active Codex threads
- **Chat view** — read and send messages, switch collaboration mode, model, and reasoning effort
- **Plan mode toggle** — flip Codex into plan mode for any thread
- **Agent monitoring** — live stream events, pending user input requests, and interrupt controls
- **Debug tab** — full IPC history, payload inspection, and replay

## Requirements

- Node.js 20+
- pnpm 10+
- Codex desktop app installed and running locally

## Install

```bash
pnpm install
```

## Run

```bash
pnpm dev
```

That's it. Both the backend and frontend start in parallel.

- Backend: `http://127.0.0.1:4311`
- Frontend: `http://127.0.0.1:4312` — open this in your browser

The frontend proxies `/api` and `/events` to the backend automatically.

Push runtime state persists at an OS-specific app state location by default:
- macOS: `~/Library/Application Support/farfield/push-state.json`
- Linux: `$XDG_STATE_HOME/farfield/push-state.json` (or `~/.local/state/farfield/push-state.json`)
- Windows: `%APPDATA%/farfield/push-state.json`

Push receipt telemetry persists beside the push state file by default:
- macOS: `~/Library/Application Support/farfield/push-receipts.json`
- Linux: `$XDG_STATE_HOME/farfield/push-receipts.json` (or `~/.local/state/farfield/push-receipts.json`)
- Windows: `%APPDATA%/farfield/push-receipts.json`

Latest push send telemetry persists beside the push state file by default:
- macOS: `~/Library/Application Support/farfield/push-sends.json`
- Linux: `$XDG_STATE_HOME/farfield/push-sends.json` (or `~/.local/state/farfield/push-sends.json`)
- Windows: `%APPDATA%/farfield/push-sends.json`

Client/server error session logs are written to:
- `.runtime/logs/errors/session-<iso-timestamp>-<pid>.ndjson`

For triage workflow and API endpoints, see:
- `docs/debug/client-error-triage.md`

Set `PUSH_STATE_PATH` to override this path.
Set `PUSH_RECEIPTS_PATH` to override the receipts path.
Set `PUSH_SENDS_PATH` to override the latest sends path.
Set `PUSH_RECEIPTS_MAX_COUNT` to cap retained receipts (default `100`).
Set `PUSH_RECEIPTS_MAX_AGE_DAYS` to prune old receipts by age (default `7` days).
Set `APP_SERVER_REQUEST_TIMEOUT_MS` to override app-server RPC timeout (default `60000`).

## Make it available remotely

To access Farfield from another machine (e.g. a phone or tablet on the same network), use `dev:remote`:

```bash
pnpm dev:remote
```

This binds both the backend and frontend to `0.0.0.0` instead of `127.0.0.1`, making them reachable from any device on your local network via your machine's IP address.

> **Warning:** `dev:remote` exposes Farfield on your local network with no authentication. Only use it on trusted networks. You are responsible for securing access.

## iOS Push (HTTPS, optional)

If you want Home Screen install + iOS notifications on your iPhone:

1. Run setup once (interactive; writes `.env.local` and generates `ops/caddy/Caddyfile.local` from template):

```bash
pnpm setup:ios-push
```

When prompted for `Push contact subject`, use a real operator contact value:

- `mailto:you@yourdomain.com` (recommended, including localhost/LAN testing)
- or `https://yourdomain.com/contact`

This value is part of VAPID Web Push identity and is not shown to end users.

2. Install/trust local Caddy CA on macOS (one-time; may prompt for password):

```bash
pnpm ios:trust-local-ca
```

3. Start local HTTPS in one command:

```bash
pnpm ios:local
```

`pnpm dev`, `pnpm dev:remote`, `pnpm ios:trust-local-ca`, `pnpm ios:local`, and `pnpm push:doctor` auto-load `.env.local`.

`ops/caddy/Caddyfile.local.template` and `ops/caddy/Caddyfile.domain.template` are tracked.
`ops/caddy/Caddyfile.local` and `ops/caddy/Caddyfile.domain` are generated and gitignored.

Home Screen runtime behavior:
- While hidden, Farfield reduces live polling and reconnects live updates on foreground.
- Farfield stores and restores your last visited route (`/threads/...`) for faster resume.
- Push payloads include declarative metadata (`web_push.notification`) plus standard fields.
- Push delivery uses retry with exponential backoff for transient provider/network errors.
- Each push payload and receipt is correlated by `notificationId` for precise diagnostics.
- Preflight shows send/receipt correlation and delivery lag for the latest `notificationId`.
- Service worker update prompts appear in the header (`Update app`) when a new worker is ready.
- Push receipts are recorded (`shown`, `clicked`, `error`) and surfaced in Preflight.
- Preflight includes a `Recover push` action to refresh worker + subscription state in one step.

### Local LAN HTTPS (same Wi-Fi)

1. Run `pnpm setup:ios-push` to regenerate `ops/caddy/Caddyfile.local` with the correct host.
2. Run `pnpm ios:trust-local-ca` (macOS trust step; prompt is expected on first run).
3. Run `pnpm ios:local` (it starts Farfield + Caddy and prints the exact HTTPS origin).
4. Open that HTTPS origin in iPhone Safari.
5. If iOS shows a certificate warning, install/trust Caddy local root CA on the iPhone (one-time).
6. Add to Home Screen.
7. Launch from Home Screen and click `Enable Notifs`.
8. In `Preflight`, use `Download CA cert` if iOS trust setup still needs the local root certificate.

#### Trust Local Caddy Cert (one-time)

1. On your Mac, open the Caddy CA folder:

```bash
open "$HOME/Library/Application Support/Caddy/pki/authorities/local"
```

2. Send `root.crt` to iPhone (AirDrop or iCloud Files).
3. On iPhone, install the profile from `Settings` -> `General` -> `VPN & Device Management`.
4. Enable full trust in `Settings` -> `General` -> `About` -> `Certificate Trust Settings`.
5. Re-open your `https://...` Farfield origin and confirm no certificate warning.
6. Or open Farfield `Preflight` and use `Download CA cert` to fetch `root.crt` directly from `/api/push/local-ca/root.crt`.
7. If Caddy prints `certutil is not available`, install it with `brew install nss`.

### Public Domain HTTPS

1. Point DNS for your domain to the machine running Farfield.
2. Generate the domain Caddy config:

```bash
pnpm setup:domain-https
```
3. Start Farfield:

```bash
pnpm dev
```

4. In another terminal, run:

```bash
caddy run --config ops/caddy/Caddyfile.domain
```

5. Open your domain in iPhone Safari.
6. Add to Home Screen.
7. Launch from Home Screen and click `Enable Notifs`.

`Caddyfile.domain` injects `X-Farfield-Token` upstream from `API_TOKEN`, so browser-side token env is not required.

### Manual iOS Verification

1. In Farfield, open a thread and click `Push test` in the Debug tab.
2. Confirm a notification appears while app is foregrounded.
3. Press Home, send another `Push test`, and confirm a background notification appears.
4. Tap the notification and confirm the target thread opens.
5. Open the `Preflight` tab and confirm `background push ready`.
6. Confirm `Push receipt signal` shows a recent `shown`/`clicked` timestamp.

### Auto-heal + Updates

- After notifications are enabled once, Farfield auto-reconciles push subscription state when the app returns to foreground.
- If a service worker update is available, click `Update app` in the header to activate it immediately.

### iOS Troubleshooting

| Symptom | Most likely cause | Fix |
| --- | --- | --- |
| `notif:unsupported` in header | Not running from Safari/Home Screen secure context | Open the HTTPS origin in Safari, add to Home Screen, relaunch from Home Screen |
| Permission prompt never appears | Permission was previously denied | iOS Settings -> Notifications -> Safari (or web app) and re-enable, then try `Enable Notifs` again |
| No background notification | App is not installed to Home Screen, or no active push subscription | Install to Home Screen, ensure `Enable Notifs` is active, and verify in Preflight page |
| Bottom gap in app shell | App is running in Safari tab mode or stale service worker assets are still active | Launch from Home Screen, then click `Update app` in header so latest layout logic takes effect |
| Preflight receipt signal stays empty | Notification not shown/clicked yet, or service worker is stale | Run `Push test`, tap notification, then refresh Preflight; if update banner appears, click `Update app` |
| `Password:` appears in `pnpm ios:local` logs | Caddy is trying to install/trust local CA in keychain | Stop the run, execute `pnpm ios:trust-local-ca`, then rerun `pnpm ios:local` |
| `certutil is not available` appears in Caddy logs | NSS tools are missing on macOS | Install once with `brew install nss` |
| `push:doctor` shows unauthorized | Token mismatch between server and doctor env | Set matching `API_TOKEN` and `PUSH_DOCTOR_TOKEN` values |
| Local HTTPS page does not load on iPhone | Generated `Caddyfile.local` host is wrong or CA not trusted | Re-run `pnpm setup:ios-push`, restart `pnpm ios:local`, trust Caddy local CA on iPhone |

Use `pnpm push:doctor` to validate env + Caddy files + live `/api/health` and `/api/push/status` checks.

Rotate API token when needed:

```bash
pnpm rotate:api-token
```

For remote checks, point doctor at your running origin:

```bash
PUSH_DOCTOR_URL=https://your-host-or-domain \
PUSH_DOCTOR_TOKEN=your-secret-token \
pnpm push:doctor
```

## Other commands

```bash
pnpm build       # Build all packages
pnpm test        # Run all tests
pnpm typecheck   # TypeScript type checking across all packages
pnpm lint        # Lint all packages
pnpm smoke:app   # Smoke-check key Farfield runtime endpoints
pnpm ios:trust-local-ca  # One-time macOS local CA trust setup for Caddy
pnpm stress:stream-burst  # Burst /stream-events load + health latency budget check
pnpm e2e:real:governance  # Validate coverage matrix/open-gap governance
pnpm e2e:real:install  # Install Playwright Chromium for real-app scenarios
pnpm e2e:real:run      # Headless real-app Playwright scenarios
pnpm e2e:real:ui       # Interactive Playwright UI for real-app scenarios
pnpm e2e:real:debug -- --grep "thread"  # Debug targeted scenario
pnpm verify:real       # smoke:app + governance checks + real-app scenarios
pnpm premerge:check    # required local gate: lint + test + verify:real
```

Real-app test env knobs:
- `E2E_REAL_BASE_URL` (default `http://127.0.0.1:4312`) for UI navigation host.
- `E2E_REAL_API_URL` (default `http://127.0.0.1:4311`) for sentinel API checks.
- `E2E_REAL_API_TOKEN` for sentinel API auth (defaults to `API_TOKEN`).
- `APP_SMOKE_TIMEOUT_MS` (default `120000`) to tune `pnpm smoke:app` per-request timeout.
- `APP_SMOKE_RETRIES` (default `2`) to tune retry count per `pnpm smoke:app` endpoint call.
- `APP_SMOKE_BUDGET_MODE` (`fail` or `warn`, default `fail`) to control latency budget enforcement.
- `APP_SMOKE_BUDGET_HEALTH_MS` (default `5000`) and `APP_SMOKE_BUDGET_*` endpoint-specific budgets.
- `STREAM_BURST_DURATION_MS`, `STREAM_BURST_WORKERS`, `STREAM_BURST_HEALTH_BUDGET_P95_MS` to tune stream burst stress checks.

## Real App Debug Loop (Codex + Playwright MCP)

Use this loop when debugging "app is broken" reports and when validating UI fixes against the real runtime.

1. Start the real stack:

```bash
pnpm dev
```

2. Run runtime endpoint smoke checks:

```bash
pnpm smoke:app
```

3. Drive the live UI with Playwright MCP in Codex:
   - Navigate + inspect: `browser_navigate`, `browser_snapshot`
   - Interact: `browser_click`, `browser_type`, `browser_press_key`
   - Inspect failures: `browser_console_messages`, `browser_network_requests`, `browser_take_screenshot`
   - Read transient banner events: `browser_evaluate` for `window.__farfieldBannerEvents`
   - Follow the standard manual smoke flow: `docs/debug/playwright-mcp-smoke.md`

4. Apply code change, let Vite HMR update, rerun the same Playwright flow.

5. Confirm both:
   - expected UI behavior is present
   - `pnpm smoke:app` passes

## Required pre-merge gate

Before merging any change that touches `apps/web`, `apps/server`, `packages/codex-protocol`, or `e2e/real`, run:

```bash
pnpm premerge:check
```
   - no unexpected warning/error signals from sentinel output

Important:
- `pnpm ...` commands run your app/tests.
- Playwright MCP browser actions are tool calls from Codex, not shell commands.
- Validate both empty-state and has-threads states when possible.
- Sentinel summaries are written to `.runtime/e2e-sentinel/<scenario>.ndjson` and `.runtime/e2e-sentinel/latest.ndjson`.

Run a single app:

```bash
pnpm --filter @farfield/server dev
pnpm --filter @farfield/web dev
```

## Project layout

```
apps/
  server/       HTTP + SSE backend (TypeScript)
  web/          React frontend (Vite + Tailwind)
packages/
  protocol/     Zod schemas and inferred types for all wire formats
  api/          Typed clients for the Codex app-server and desktop IPC
scripts/
  sanitize-traces.mjs   Redact trace files for safe fixture use
  app-smoke.mjs         Runtime endpoint smoke checks for real app flow
  stream-burst.mjs      Stream-event burst stress + health latency budget checks
  validate-e2e-governance.mjs  Coverage matrix/open-gap checks for real-app E2E
e2e/
  real/         Real-runtime Playwright scenarios + sentinel helpers
```

- **`packages/protocol`** is the single source of truth for all data shapes. Everything is Zod — no silent coercion, no shape drift, hard failures on unknown payloads.
- **`packages/api`** wraps the Codex IPC socket and app-server HTTP API with typed clients and a high-level service layer.
- **`apps/server`** serves the REST and SSE endpoints the UI depends on, and manages the IPC connection lifecycle.
- **`apps/web`** is a Vite + React + Tailwind app. No heavy framework.

## Trace capture (debug)

The Debug tab lets you record IPC traffic as trace files. Raw traces go in `traces/` (git-ignored). To generate sanitized test fixtures:

```bash
pnpm sanitize:traces
```

Sanitized files land in `packages/protocol/test/fixtures/sanitized/`.

## License

MIT
