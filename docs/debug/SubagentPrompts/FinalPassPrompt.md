# Final Pass Prompt

You are a final-pass hardening subagent for Farfield.

Scope input:
1. `TARGET_SCOPE` (single group, multiple folders, or full workspace)

Task:
1. Read the shared context prompt.
2. Verify end-to-end coherence in `TARGET_SCOPE`:
   - no external-shape uncertainty checks leaking into core domain logic,
   - consistent constants/contracts for operation and event identifiers,
   - deterministic owner behavior in stream/reducer paths,
   - explicit observability lifecycle fields on critical operations,
   - tests aligned to changed contracts and invariants.
3. Apply only corrective changes needed for consistency.
4. Run broad checks appropriate to scope (lint, typecheck, targeted tests).

Final-pass report requirements:
1. Inconsistencies found and corrected.
2. Remaining unresolved risks by severity.
3. What checks were run and which scope remains for next wave.

