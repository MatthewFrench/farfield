# Contributing

## Architecture And Naming Policy

Follow these documents for all source changes:

1. `docs/architecture.md` (normative rules)
2. `docs/proposed-structure-and-migration.md` (target end-state layout)

Required naming and structure conventions:

1. Keep repository source roots as `apps` and `packages`.
2. Use `PascalCase` for source folders/files under those roots.
3. Use descriptive full-word folder names; avoid abbreviations.
4. Keep non-source roots lowercase (`docs`, `public`, `traces`, `scripts`, `operations`, `end-to-end`).
5. Keep ownership explicit: user interface, state management, data access, and domain model must remain separated.

## Environment-Specific Config Policy

Do not commit machine-specific runtime config files.

1. Commit templates for environment-specific config.
2. Generate runtime files from templates using setup scripts.
3. Keep generated runtime files gitignored.

Current Caddy pattern:

1. Tracked templates:
   - `operations/caddy/Caddyfile.local.template`
   - `operations/caddy/Caddyfile.domain.template`
2. Generated runtime files (gitignored):
   - `operations/caddy/Caddyfile.local`
   - `operations/caddy/Caddyfile.domain`
