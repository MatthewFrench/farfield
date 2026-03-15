# Development Governance Gates

This document lists the enforced local and CI governance gates and where each gate runs.

## Gate Registry

| Gate | Command | Enforced In |
| --- | --- | --- |
| lockfile policy | `bun run validate:lockfiles:governance` | `lint`, `precommit:staged`, iOS setup workflow |
| Biome ignore rationale policy | `bun run validate:biome-ignore` | `lint`, `precommit:staged` |
| staged source formatting and lint | `bun run biome:check:staged` | `precommit:staged` |
| full lint policy | `bun run ci:targeted:lint` | mock runtime workflow, `ci:targeted:gate`, local pre-push |
| full typecheck policy | `bun run ci:targeted:typecheck` | mock runtime workflow, `ci:targeted:gate`, local pre-push |
| tooling governance tests | `bun run ci:targeted:governance` | mock runtime workflow, `ci:targeted:gate` |
| critical mocked suites | `bun run ci:targeted:critical` | mock runtime workflow, `ci:targeted:gate` |
| mocked performance suites | `bun run ci:targeted:performance` | mock runtime workflow, `ci:targeted:gate` |

## Hook Behavior

1. `.husky/pre-commit` runs staged governance checks:
   - lockfile policy
   - Biome ignore policy
   - staged Biome check
2. `.husky/pre-push` runs:
   - `bun run ci:targeted:lint`
   - `bun run ci:targeted:typecheck`

## Local Reference Commands

1. Full targeted gate:
   - `bun run ci:targeted:gate`
2. Governance-only checks:
   - `bun run validate:lockfiles:governance`
   - `bun run validate:biome-ignore`
   - `bun run test:tooling:governance`
