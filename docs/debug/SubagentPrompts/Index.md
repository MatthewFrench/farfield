# Subagent Prompt Index

Prompt files by layer:

1. Shared context for every run:
   - `/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/SharedContextPrompt.md`
2. Group layer:
   - `/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/GroupLayerPrompt.md`
3. Folder layer:
   - `/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/FolderLayerPrompt.md`
4. Concern layer:
   - `/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/ConcernLayerPrompt.md`
5. File layer:
   - `/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/FileLayerPrompt.md`
6. Final pass layer:
   - `/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/FinalPassPrompt.md`
7. Runtime soak orchestrator:
   - `/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/RuntimeSoakOrchestratorPrompt.md`
8. Runtime soak browser runner:
   - `/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/RuntimeSoakBrowserPrompt.md`
9. Runtime soak signal watcher:
   - `/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/RuntimeSoakSignalWatcherPrompt.md`
10. Runtime soak request watcher:
   - `/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/RuntimeSoakRequestWatcherPrompt.md`
11. Runtime soak user-experience watcher:
   - `/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/RuntimeSoakUserExperienceWatcherPrompt.md`
12. Runtime soak repair worker:
   - `/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/RuntimeSoakRepairPrompt.md`

Usage pattern:

1. Choose layer prompt based on planning granularity.
2. Provide only scope-specific inputs (`GROUP_ROOT`, `FOLDER_PATH`, `CONCERN_NAME`, `PRIMARY_FILE`, or `TARGET_SCOPE`).
3. Keep subagent ownership disjoint across parallel runs to avoid edit collisions.
4. For runtime soak work, use the orchestrator plus browser/watcher prompts together instead of reusing the hardening-layer prompts.
