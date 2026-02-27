# Farfield

Remote control for AI coding agents — read conversations, send messages, switch models, and monitor agent activity from a clean web UI.

Supports [Codex](https://openai.com/codex) and [OpenCode](https://opencode.ai).

Built by [@anshuchimala](https://x.com/anshuchimala).

This is an independent project and is not affiliated with, endorsed by, or sponsored by OpenAI or the OpenCode team.

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=000000)](https://buymeacoffee.com/achimalap)

<img src="./screenshot.png" alt="Farfield screenshot" width="500" />

## Features

- Thread browser grouped by project
- Chat view with model/reasoning controls
- App-default model/reasoning values synced from Codex `config/read`
- Plan mode toggle
- Live agent monitoring and interrupts
- Debug tab with full IPC history
- Optional completion notifications via `ntfy`

## Install & Run

```bash
bun install
bun run dev
```

Opens at `http://localhost:4312`. Defaults to Codex.

**Agent options:**

```bash
bun run dev -- --agents=opencode             # OpenCode only
bun run dev -- --agents=codex,opencode       # both
bun run dev -- --agents=all                  # expands to codex,opencode
bun run dev:remote                           # network-accessible (codex)
bun run dev:remote -- --agents=opencode      # network-accessible (opencode)
```

> **Warning:** `dev:remote` is network-exposed. If `API_TOKEN` is unset, `/api/*` and `/events` are unauthenticated.
> Set `API_TOKEN` in `.env.local` for remote use.

## Development Tooling

Farfield uses Bun, Biome, and Husky as the default local workflow.

- Lockfile policy: `bun.lock` is the only allowed lockfile.
- Formatter and lint: Biome (`bun run lint`, `bun run lint:fix`).
- Pre-commit hook: staged Biome checks and `biome-ignore` rationale validation.
- Pre-push hook: targeted lint and typecheck.

Useful commands:

```bash
bun run lint
bun run typecheck
bun run ci:targeted:gate
bun run validate:lockfiles:governance
```

Governance gate reference:

- [`docs/development-governance-gates.md`](/Users/matthewfrench/GitHub/farfield/docs/development-governance-gates.md)

## Settings Parity

Farfield reads Codex app defaults using `config/read` and uses those values for:

- the "app default" model shown in the model picker
- the "app default" reasoning effort shown in the effort picker

Thread listing requests now use `sortKey=updated_at`, and the server applies deterministic merged ordering across enabled agents.
Unarchived thread loading now follows first-page listing behavior (Codex-style), while archived threads load on demand when expanded.
Codex app-server currently exposes local conversation/thread records (for example rollout sessions on disk), not a dedicated cloud-thread list endpoint.

## Remote Auth Notes

- API auth header: `X-Farfield-Token` (configured by `API_TOKEN`; `PUSH_API_TOKEN` also accepted).
- In dev proxy mode, token injection is limited to trusted origins.
- To allow non-localhost dev origins, set `VITE_DEV_PROXY_TRUSTED_ORIGINS` as a comma-separated list of `http(s)://host:port` origins.

## Optional ntfy Notifications

Configure optional thread-completion notifications:

```bash
bun run setup:ntfy
```

Non-interactive examples:

```bash
bun run setup:ntfy -- --topic=farfield
bun run setup:ntfy -- --topic=farfield --base-url=https://ntfy.sh
bun run setup:ntfy -- --disable
```

Environment keys:

- `NTFY_ENABLED` (`true` or `false`)
- `NTFY_TOPIC` (required when enabled)
- `NTFY_BASE_URL` (optional, defaults to `https://ntfy.sh`)
- `NTFY_BEARER_TOKEN` (optional)

When enabled, Farfield watches Codex thread stream updates and publishes a message when a thread reaches a completed turn with a new agent message.

## iOS Device Smoke

- Single-device interactive smoke: `bun run smoke:ios-device`
- Multi-version matrix smoke (real devices): `bun run smoke:ios-matrix`
  - Optional labels via `IOS_DEVICE_SMOKE_MATRIX`, for example:
    - `IOS_DEVICE_SMOKE_MATRIX="iOS-17.7,iOS-18.3" bun run smoke:ios-matrix`
- The smoke flow creates an isolated ephemeral thread and archives it at the end, so existing threads are not mutated.

## Requirements

- Node.js 20+
- Bun 1.2+
- Codex or OpenCode installed locally

## Architecture And Naming

Farfield architecture and naming standards are documented in:

- `docs/architecture.md`
- `docs/proposed-structure-and-migration.md`

Key conventions:

1. Repository source roots stay `apps` and `packages`.
2. Source folders/files under those roots use `PascalCase`.
3. Source folder names should use full words and avoid abbreviations.
4. Non-source roots (`docs`, `public`, `traces`, `scripts`) remain lowercase.
5. State ownership and module boundaries must stay explicit and documented.

## Codex Schema Sync

Farfield now vendors official Codex app-server schemas and generates protocol Zod validators from them.

```bash
bun run generate:codex-schema
```

This command updates:

- `packages/CodexProtocol/vendor/codex-app-server-schema/` (stable + experimental TypeScript and JSON Schema)
- `packages/CodexProtocol/Source/generated/app-server/` (generated Zod schema modules used by the app)

## License

MIT
