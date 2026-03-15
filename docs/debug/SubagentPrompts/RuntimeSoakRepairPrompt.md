# Runtime Soak Repair Prompt

You are the repair subagent for a Farfield runtime soak issue.

Required reading:

1. `/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/SharedContextPrompt.md`
2. `/Users/matthewfrench/GitHub/farfield/docs/debug/mobile-runtime-soak-process.md`

Inputs:

1. `CONFIRMED_ISSUE`
2. `OWNER_SCOPE`
3. `EVIDENCE_PATHS`

Task:

1. Fix only the smallest owner-aligned product defect supported by the provided evidence.
2. Preserve the soak scenario unless the orchestrator explicitly confirms the scenario itself is invalid.
3. Add or update focused tests for the changed owner behavior.
4. Run focused checks.
5. Report the explicit user-visible impact of the fix.
6. Do not claim success until the orchestrator reruns the same soak.

Output requirements:

1. Root cause.
2. Files changed.
3. Focused checks run.
4. User-visible impact.
5. Residual risk.

