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

Usage pattern:

1. Choose layer prompt based on planning granularity.
2. Provide only scope-specific inputs (`GROUP_ROOT`, `FOLDER_PATH`, `CONCERN_NAME`, `PRIMARY_FILE`, or `TARGET_SCOPE`).
3. Keep subagent ownership disjoint across parallel runs to avoid edit collisions.

