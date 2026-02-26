# 2026-02-26 Excluded Surface Hardening Governance

## Context

Farfield completed major boundary and hot-path hardening work across application and server owner modules, including strict transport-boundary parsing, deterministic stream merge policy, mutation-scoped cache invalidation, and high-frequency observability controls.

Some repository surfaces are intentionally excluded from full architecture migration constraints because they are generator-owned, fixture-owned, or operational-support surfaces.

Those exclusions need explicit governance so exclusions remain bounded, reviewable, and either accepted with clear limits or hardened on a dated schedule.

## Decision

Adopt a two-class excluded-surface governance policy with explicit status, owner, review date, and follow-up milestones.

### Boundary and hot-path governance outcomes (now baseline policy)

1. Parse untrusted payloads once at transport boundaries and project to internal owner models before hot-path mutation.
2. Keep stream and patch application proportional to changed data; do not perform full-state clone, serialization, or validation per micro update.
3. Require deterministic stream correctness tests for replay, reset-required cursor behavior, and adversarial index-shift patch sequences.
4. Keep high-frequency observability bounded and summarized; raw per-event payload logging remains debug-only.
5. Keep cache invalidation mutation-scoped with explicit owner APIs and deterministic refresh coordination.
6. Require burst-traffic performance evidence (latency and queue-delay readouts) when stream reducer, patch, cache, or subscription owners change.

### Excluded-surface policy register

| Surface | Status | Owner | Review date | Planned removal date | Policy and follow-up schedule |
| --- | --- | --- | --- | --- | --- |
| `packages/CodexProtocol/Source/Generated` | accepted exclusion | protocol contracts owner | 2026-06-30 | not applicable | Generator-owned output only. Manual architecture sweeps do not edit generated artifacts directly. 2026-03-15: verify generated contract parity checks remain green. 2026-06-30: re-validate exclusion scope and regeneration workflow ownership. |
| `packages/CodexProtocol/Tests/fixtures` | accepted exclusion | protocol testing owner | 2026-06-30 | not applicable | Fixture packs remain tooling/test-input owned. Manual structure naming sweeps do not rewrite fixture content. 2026-03-15: run fixture sanitization and sensitive-data scan policy audit. 2026-06-30: review fixture lifecycle ownership and retention policy. |
| `end-to-end` | scheduled hardening | end-to-end ownership maintainer | 2026-04-15 | 2026-05-15 | Exclusion remains temporary while test-owner boundaries are formalized. 2026-03-11: publish owner map for `real/fixtures`, `real/helpers`, and `real/scenarios`. 2026-03-29: add explicit boundary schemas for scenario fixture loading and route/test harness contracts. 2026-04-26: run full path and naming hardening pass with docs/test-runner alignment. |

### Governance enforcement requirements

1. Every excluded-surface entry must exist in `docs/proposed-structure-and-migration.md` decision and exception register with matching status/owner/dates.
2. Scheduled-hardening entries are incomplete until removal date is closed or extended by a new dated decision record.
3. Accepted exclusions are still reviewed on the listed date and can be reclassified if drift or risk increases.

## Alternatives considered

1. Keep exclusions informal and undocumented.
   - Pros: least process overhead.
   - Cons: no owner accountability, no review cadence, and high policy drift risk.

2. Treat every exclusion as permanent.
   - Pros: fewer migration planning steps.
   - Cons: weakens hardening governance and permits unbounded debt accumulation.

3. Remove all exclusions immediately.
   - Pros: maximum policy consistency.
   - Cons: high delivery risk because generated, fixture, and operational surfaces require staged migration.

## Consequences

### Positive

1. Excluded surfaces now have explicit policy ownership and review dates.
2. Hardening backlog is converted into dated milestones instead of open-ended exceptions.
3. Boundary and hot-path hardening outcomes become an enforceable baseline rather than historical notes.
4. The temporary `scripts` exclusion was closed after grouped-folder migration and removed from the active exclusion register.

### Costs and risks

1. Additional governance maintenance is required in decision and migration documents.
2. Scheduled hardening dates can slip without active owner follow-through.
3. Generated and fixture surfaces still need periodic review to avoid stale assumptions.

### Risk mitigations

1. Keep one canonical register in `docs/proposed-structure-and-migration.md` and update it with each decision change.
2. Require dated milestone evidence in each scheduled-hardening review update.
3. Reclassify accepted exclusions when periodic review identifies expanded risk.

## Owners

1. Architecture governance owner
2. Protocol contracts owner
3. Protocol testing owner
4. End-to-end ownership maintainer
5. Repository operations maintainers

## Review date

2026-06-30
