# Contributing

## Environment-Specific Config Policy

Do not commit machine-specific runtime config files.

1. Commit templates for environment-specific config.
2. Generate runtime files from templates using setup scripts.
3. Keep generated runtime files gitignored.

Current Caddy pattern:

1. Tracked templates:
   - `ops/caddy/Caddyfile.local.template`
   - `ops/caddy/Caddyfile.domain.template`
2. Generated runtime files (gitignored):
   - `ops/caddy/Caddyfile.local`
   - `ops/caddy/Caddyfile.domain`
