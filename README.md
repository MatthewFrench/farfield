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

## Make it available remotely

To access Farfield from another machine (e.g. a phone or tablet on the same network), use `dev:remote`:

```bash
pnpm dev:remote
```

This binds both the backend and frontend to `0.0.0.0` instead of `127.0.0.1`, making them reachable from any device on your local network via your machine's IP address.

> **Warning:** `dev:remote` exposes Farfield on your local network with no authentication. Only use it on trusted networks. You are responsible for securing access.

## iOS Push (HTTPS, optional)

If you want Home Screen install + iOS notifications on your iPhone:

1. Run setup once (interactive; writes `.env.local` and updates `ops/caddy/Caddyfile.local` host):

```bash
pnpm setup:ios-push
```

When prompted for `Push contact subject`, use a real operator contact value:

- `mailto:you@yourdomain.com` (recommended, including localhost/LAN testing)
- or `https://yourdomain.com/contact`

This value is part of VAPID Web Push identity and is not shown to end users.

2. Start local HTTPS in one command:

```bash
pnpm ios:local
```

`pnpm dev`, `pnpm dev:remote`, `pnpm ios:local`, and `pnpm push:doctor` auto-load `.env.local`.

### Local LAN HTTPS (same Wi-Fi)

1. Set the HTTPS host in `ops/caddy/Caddyfile.local` (IP or LAN hostname).
2. Run `pnpm ios:local` (it starts Farfield + Caddy and prints the exact HTTPS origin).
3. Open that HTTPS origin in iPhone Safari.
4. If iOS shows a certificate warning, install/trust Caddy local root CA on the iPhone (one-time).
5. Add to Home Screen.
6. Launch from Home Screen and click `Enable Notifs`.

### Public Domain HTTPS

1. Point DNS for your domain to the machine running Farfield.
2. Set the domain in `ops/caddy/Caddyfile.domain`.
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

### iOS Troubleshooting

| Symptom | Most likely cause | Fix |
| --- | --- | --- |
| `notif:unsupported` in header | Not running from Safari/Home Screen secure context | Open the HTTPS origin in Safari, add to Home Screen, relaunch from Home Screen |
| Permission prompt never appears | Permission was previously denied | iOS Settings -> Notifications -> Safari (or web app) and re-enable, then try `Enable Notifs` again |
| No background notification | App is not installed to Home Screen, or no active push subscription | Install to Home Screen, ensure `Enable Notifs` is active, and verify in Preflight page |
| `push:doctor` shows unauthorized | Token mismatch between server and doctor env | Set matching `API_TOKEN` and `PUSH_DOCTOR_TOKEN` values |
| Local HTTPS page does not load on iPhone | `Caddyfile.local` host is wrong or CA not trusted | Set correct LAN host/IP in `Caddyfile.local`, restart `pnpm ios:local`, trust Caddy local CA on iPhone |

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
```

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
