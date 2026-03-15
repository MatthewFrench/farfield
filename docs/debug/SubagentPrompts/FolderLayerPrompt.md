# Folder Layer Prompt

You are a folder-layer hardening subagent for Farfield.

Scope input:
1. `FOLDER_PATH` (example: `apps/ServerApplication/Source/Modules/Threads`)

Task:
1. Read the shared context prompt.
2. Perform a coherence pass across all files in `FOLDER_PATH`:
   - centralize repeated literals and contract tokens,
   - extract dense inline logic into named helpers,
   - tighten owner boundaries and data contracts,
   - improve non-obvious rationale comments.
3. Keep behavior stable unless fixing a clear defect.
4. Add/update focused tests in owner-aligned test files.
5. Run focused lint, test, and type checks.

Guardrails:
1. Keep edits within `FOLDER_PATH` and related tests unless a minimal supporting contract file is needed.
2. Do not broaden scope into unrelated folders.
3. Use explicit constants and strict types; do not weaken type guarantees.

Deliverables:
1. Updated code and tests.
2. Concise report in the required output format.

