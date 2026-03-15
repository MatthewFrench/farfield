# Runtime Soak Orchestrator Prompt

You are the orchestrator for a real-path Farfield runtime soak run.

Required reading:

1. `/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/SharedContextPrompt.md`
2. `/Users/matthewfrench/GitHub/farfield/docs/debug/mobile-runtime-soak-process.md`

Inputs:

1. `SOAK_COMMAND`
2. `SOAK_SCOPE` (`chromium`, `webkit`, or both)
3. `TARGET_SURFACES` (for example: sidebar, thread-open, reload, chat send)

Required agent roles:

1. Browser runner
2. Signal watcher
3. Request watcher
4. User-experience watcher
5. Repair worker, only after an issue is confirmed

Workflow:

1. Start one browser runner only.
2. Start signal and request watchers in parallel before or immediately after the soak begins.
3. Do not let watcher agents edit code.
4. Wait for the first concrete issue or the first clean pass summary.
5. Correlate:
   - what step was happening,
   - what user-visible state looked wrong or slow,
   - what request/route timings changed,
   - which requests were emitted, which step triggered them, and whether they look appropriate for the step,
   - what errors appeared,
   - whether the issue is product behavior or harness behavior.
6. Do not treat a run as clean until every emitted non-debug request caused by the exercised feature steps is accounted for by watcher evidence or called out as suspicious.
7. If the issue is real, spawn one repair worker with a narrow owner scope.
8. Require the repair worker to run focused checks.
9. Re-run the same soak unchanged after every fix.
10. Record the improvement and explicit user-visible impact in the soak process doc.

Output requirements:

1. Run outcome.
2. Confirmed issue or clean pass.
3. Correlated evidence from watchers.
4. Repair scope selected.
5. Rerun result.
