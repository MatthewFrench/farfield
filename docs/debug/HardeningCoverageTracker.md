# Hardening Coverage Tracker

Last Updated (UTC): 2026-02-26 04:34:57Z

## Scope Model

1. Group: broad repository surfaces used for planning and progress gates.
2. Folder: one level below each architecture group root.
3. File: exhaustive inventory for every tracked and currently untracked file in this workspace.

## Layer Prompt Assets

1. Prompt index:
   - [Subagent Prompt Index](/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/Index.md)
2. Shared context:
   - [Shared Context Prompt](/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/SharedContextPrompt.md)
3. Layer prompts:
   - [Group Layer Prompt](/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/GroupLayerPrompt.md)
   - [Folder Layer Prompt](/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/FolderLayerPrompt.md)
   - [Concern Layer Prompt](/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/ConcernLayerPrompt.md)
   - [File Layer Prompt](/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/FileLayerPrompt.md)
   - [Final Pass Prompt](/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/FinalPassPrompt.md)

## Program Summary

- Total files in workspace inventory: 1838
- Files touched in current wave: 16 (0.9%)
- Files not touched in current wave: 1822
- Line churn across touched files: +987 / -205 (net +782)
- Product-surface churn excluding tracker docs in docs/debug: 16 files, +987 / -205 (net +782)

## Repository Segment Coverage

| Segment | Total Files | Touched Files | Coverage | Progress |
| --- | ---: | ---: | ---: | --- |
| `(root)` | 13 | 1 | 7.7% | in-progress |
| `.claude` | 1 | 0 | 0.0% | not-started |
| `.github` | 3 | 1 | 33.3% | in-progress |
| `apps` | 429 | 10 | 2.3% | in-progress |
| `docs` | 23 | 6 | 26.1% | in-progress |
| `end-to-end` | 17 | 0 | 0.0% | not-started |
| `operations` | 2 | 0 | 0.0% | not-started |
| `packages` | 1325 | 1 | 0.1% | in-progress |
| `public` | 5 | 0 | 0.0% | not-started |
| `scripts` | 18 | 0 | 0.0% | not-started |
| `skills` | 2 | 0 | 0.0% | not-started |

## Architecture Group Coverage

| Group Root | Total Files | Touched Files | Coverage | Progress |
| --- | ---: | ---: | ---: | --- |
| `apps/WebApplication/Source` | 172 | 6 | 3.5% | in-progress |
| `apps/WebApplication/Tests` | 107 | 4 | 3.7% | in-progress |
| `apps/WebApplication/public` | 5 | 0 | 0.0% | not-started |
| `apps/ServerApplication/Source` | 78 | 0 | 0.0% | not-started |
| `apps/ServerApplication/Tests` | 57 | 0 | 0.0% | not-started |
| `packages/CodexProtocol/Source` | 25 | 0 | 0.0% | not-started |
| `packages/CodexProtocol/Tests` | 10 | 0 | 0.0% | not-started |
| `packages/CodexInterfaceAdapter/Source` | 9 | 0 | 0.0% | not-started |
| `packages/CodexInterfaceAdapter/Tests` | 9 | 1 | 11.1% | in-progress |
| `packages/OpenCodeInterfaceAdapter/Source` | 11 | 0 | 0.0% | not-started |
| `packages/OpenCodeInterfaceAdapter/Tests` | 4 | 0 | 0.0% | not-started |
| `docs` | 23 | 6 | 26.1% | in-progress |
| `scripts` | 18 | 0 | 0.0% | not-started |
| `end-to-end` | 17 | 0 | 0.0% | not-started |
| `operations` | 2 | 0 | 0.0% | not-started |
| `public` | 5 | 0 | 0.0% | not-started |
| `repository-root-and-other` | 1286 | 2 | 0.2% | in-progress |

## Folder Coverage

| Group Root | Immediate Folder | Total Files | Touched Files | Coverage | Progress |
| --- | --- | ---: | ---: | ---: | --- |
| `apps/ServerApplication/Source` | `Agents` | 15 | 0 | 0.0% | not-started |
| `apps/ServerApplication/Source` | `Application` | 7 | 0 | 0.0% | not-started |
| `apps/ServerApplication/Source` | `Modules` | 11 | 0 | 0.0% | not-started |
| `apps/ServerApplication/Source` | `Network` | 44 | 0 | 0.0% | not-started |
| `apps/ServerApplication/Source` | `Shared` | 1 | 0 | 0.0% | not-started |
| `apps/ServerApplication/Tests` | `(direct-files)` | 57 | 0 | 0.0% | not-started |
| `apps/WebApplication/Source` | `(direct-files)` | 3 | 0 | 0.0% | not-started |
| `apps/WebApplication/Source` | `Application` | 49 | 6 | 12.2% | in-progress |
| `apps/WebApplication/Source` | `Components` | 30 | 0 | 0.0% | not-started |
| `apps/WebApplication/Source` | `Features` | 82 | 0 | 0.0% | not-started |
| `apps/WebApplication/Source` | `Shared` | 8 | 0 | 0.0% | not-started |
| `apps/WebApplication/Tests` | `(direct-files)` | 107 | 4 | 3.7% | in-progress |
| `docs` | `(direct-files)` | 4 | 1 | 25.0% | in-progress |
| `docs` | `debug` | 16 | 3 | 18.8% | in-progress |
| `docs` | `decisions` | 3 | 2 | 66.7% | in-progress |
| `end-to-end` | `real` | 17 | 0 | 0.0% | not-started |
| `operations` | `caddy` | 2 | 0 | 0.0% | not-started |
| `packages/CodexInterfaceAdapter/Source` | `(direct-files)` | 9 | 0 | 0.0% | not-started |
| `packages/CodexInterfaceAdapter/Tests` | `(direct-files)` | 9 | 1 | 11.1% | in-progress |
| `packages/CodexProtocol/Source` | `(direct-files)` | 8 | 0 | 0.0% | not-started |
| `packages/CodexProtocol/Source` | `Contracts` | 6 | 0 | 0.0% | not-started |
| `packages/CodexProtocol/Source` | `Generated` | 10 | 0 | 0.0% | not-started |
| `packages/CodexProtocol/Source` | `Parsers` | 1 | 0 | 0.0% | not-started |
| `packages/CodexProtocol/Tests` | `(direct-files)` | 8 | 0 | 0.0% | not-started |
| `packages/CodexProtocol/Tests` | `fixtures` | 2 | 0 | 0.0% | not-started |
| `packages/OpenCodeInterfaceAdapter/Source` | `(direct-files)` | 11 | 0 | 0.0% | not-started |
| `packages/OpenCodeInterfaceAdapter/Tests` | `(direct-files)` | 4 | 0 | 0.0% | not-started |
| `public` | `(direct-files)` | 5 | 0 | 0.0% | not-started |
| `scripts` | `(direct-files)` | 18 | 0 | 0.0% | not-started |

## Concern Coverage

| Concern | Touched Files | Added Lines | Removed Lines | Net Lines | Progress |
| --- | ---: | ---: | ---: | ---: | --- |
| Other | 9 | 690 | 18 | 672 | in-progress |
| Web Core Data State Management | 7 | 297 | 187 | 110 | in-progress |
| Repository Areas Without Current-Wave Touches | 1822 | 0 | 0 | 0 | not-started |

## Touched File Inventory (Current Wave)

| File | Added Lines | Removed Lines | Net Lines |
| --- | ---: | ---: | ---: |
| `.github/workflows/mock-runtime-checks.yml` | 6 | 6 | 0 |
| `apps/WebApplication/Source/Application/StateManagement/ApplicationConversationStateDerivation.ts` | 45 | 0 | 45 |
| `apps/WebApplication/Source/Application/StateManagement/ApplicationModelOptionDerivation.ts` | 29 | 0 | 29 |
| `apps/WebApplication/Source/Application/StateManagement/ApplicationSystemHealthDerivation.ts` | 26 | 0 | 26 |
| `apps/WebApplication/Source/Application/StateManagement/ApplicationThreadAndChatSurfaceDerivation.ts` | 52 | 0 | 52 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationDerivedState.ts` | 11 | 179 | -168 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationDerivedStateContracts.ts` | 60 | 6 | 54 |
| `apps/WebApplication/Tests/AppSessionAndDebug.test.tsx` | 1 | 4 | -3 |
| `apps/WebApplication/Tests/CoreDataSnapshotStateApplier.test.ts` | 74 | 2 | 72 |
| `apps/WebApplication/Tests/DebugWorkspaceStateStore.test.ts` | 34 | 2 | 32 |
| `apps/WebApplication/Tests/UseApplicationShellViewProperties.test.ts` | 362 | 0 | 362 |
| `docs/decisions/2026-02-26-ExcludedSurfaceHardeningGovernance.md` | 83 | 0 | 83 |
| `docs/decisions/README.md` | 14 | 0 | 14 |
| `docs/proposed-structure-and-migration.md` | 27 | 4 | 23 |
| `package.json` | 8 | 1 | 7 |
| `packages/CodexInterfaceAdapter/Tests/LiveState.test.ts` | 155 | 1 | 154 |

## Full Inventories

- Full file-level inventory (all files, touched status, churn, folder, group):
  - [HardeningCoverageFileInventory.tsv](/Users/matthewfrench/GitHub/farfield/docs/debug/HardeningCoverageFileInventory.tsv)
- Full group-level inventory (all groups with coverage and churn):
  - [HardeningCoverageGroupInventory.tsv](/Users/matthewfrench/GitHub/farfield/docs/debug/HardeningCoverageGroupInventory.tsv)
- Full folder-level inventory (all parent folders with coverage and churn):
  - [HardeningCoverageFolderInventory.tsv](/Users/matthewfrench/GitHub/farfield/docs/debug/HardeningCoverageFolderInventory.tsv)

## Update Protocol

1. Re-run this tracker after each wave so percentages remain accurate.
2. Keep the file inventory exhaustive; never trim untouched files from it.
3. Use the group and folder tables to choose the next untouched slice for subagent waves.
