# Architecture Decisions

This directory stores architecture decision records.

Use one file per decision with a descriptive PascalCase file name, for example:

- `2026-02-24-ThreadListCacheInvalidationScoping.md`
- `2026-02-24-PushMutationConcurrencyOwnership.md`
- `2026-02-26-ExcludedSurfaceHardeningGovernance.md`

Each decision record should contain:

1. Context
2. Decision
3. Alternatives considered
4. Consequences
5. Owners
6. Review date (when applicable)

If a decision is temporary, include an explicit expiration date and the required follow-up action.

## Decision and Exception Register Alignment

1. Any decision that adds or updates excluded-surface policy must update `docs/proposed-structure-and-migration.md` (`Decision Log And Exception Register (End-State)`) in the same change.
2. Excluded-surface entries must include:
   - status (`accepted exclusion` or `scheduled hardening`)
   - owner
   - reason
   - affected files/modules
   - review date
   - dated follow-up schedule
3. `scheduled hardening` entries must include planned removal date and concrete milestones.
4. `accepted exclusion` entries are still reviewed on a date cadence and must keep boundaries explicit.
