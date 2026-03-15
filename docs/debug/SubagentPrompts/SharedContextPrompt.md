# Shared Context Prompt

Use this in every hardening subagent run.

Required reading:
1. `/Users/matthewfrench/GitHub/farfield/AGENTS.md`
2. `/Users/matthewfrench/GitHub/farfield/docs/architecture.md`
3. `/Users/matthewfrench/GitHub/farfield/docs/proposed-structure-and-migration.md`
4. `/Users/matthewfrench/GitHub/farfield/docs/decisions/README.md`
5. `/Users/matthewfrench/GitHub/farfield/docs/debug/TemporarySubagentHardeningGuide.md`
6. `/Users/matthewfrench/GitHub/farfield/docs/debug/HardeningCoverageTracker.md`
7. `/Users/matthewfrench/GitHub/farfield/docs/debug/HardeningCoverageFileInventory.tsv`
8. `/Users/matthewfrench/GitHub/farfield/docs/debug/HardeningCoverageFolderInventory.tsv`
9. `/Users/matthewfrench/GitHub/farfield/docs/debug/HardeningCoverageGroupInventory.tsv`

Hard constraints:
1. No `as any`.
2. No `unknown`.
3. No type-introspection utilities for contracts.
4. Parse and normalize untrusted data at boundaries, then pass strict app-owned contracts.
5. Do not add shape-probing logic in non-boundary domain paths for external payload uncertainty.
6. Keep one explicit owner per mutable state surface.
7. Keep naming explicit; avoid abbreviations.
8. Add comments only where behavior is non-obvious and needs rationale.
9. Keep behavior stable unless fixing a clear defect.
10. Add focused tests for changed behavior or contracts.

Required subagent output format:
1. Findings summary.
2. Exact changes (files and purpose).
3. Tests/checks run and result.
4. Residual risks and follow-up.

