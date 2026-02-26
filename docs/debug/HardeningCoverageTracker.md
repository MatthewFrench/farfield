# Hardening Coverage Tracker

Last Updated (UTC): 2026-02-26 05:33:11Z

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
- Files touched in current wave: 48 (2.6%)
- Files not touched in current wave: 1790
- Line churn across touched files: +1502 / -700 (net +802)
- Product-surface churn excluding tracker docs in docs/debug: 44 files, +1349 / -579 (net +770)

## Repository Segment Coverage

| Segment | Total Files | Touched Files | Coverage | Progress |
| --- | ---: | ---: | ---: | --- |
| `(root)` | 13 | 1 | 7.7% | in-progress |
| `.claude` | 1 | 0 | 0.0% | not-started |
| `.github` | 3 | 1 | 33.3% | in-progress |
| `apps` | 429 | 17 | 4.0% | in-progress |
| `docs` | 23 | 7 | 30.4% | in-progress |
| `end-to-end` | 17 | 0 | 0.0% | not-started |
| `operations` | 2 | 0 | 0.0% | not-started |
| `packages` | 1325 | 4 | 0.3% | in-progress |
| `public` | 5 | 0 | 0.0% | not-started |
| `scripts` | 18 | 18 | 100.0% | in-progress |
| `skills` | 2 | 0 | 0.0% | not-started |

## Architecture Group Coverage

| Group Root | Total Files | Touched Files | Coverage | Progress |
| --- | ---: | ---: | ---: | --- |
| `apps/WebApplication/Source` | 172 | 5 | 2.9% | in-progress |
| `apps/WebApplication/Tests` | 107 | 4 | 3.7% | in-progress |
| `apps/WebApplication/public` | 5 | 0 | 0.0% | not-started |
| `apps/ServerApplication/Source` | 78 | 7 | 9.0% | in-progress |
| `apps/ServerApplication/Tests` | 57 | 1 | 1.8% | in-progress |
| `packages/CodexProtocol/Source` | 25 | 0 | 0.0% | not-started |
| `packages/CodexProtocol/Tests` | 10 | 0 | 0.0% | not-started |
| `packages/CodexInterfaceAdapter/Source` | 9 | 2 | 22.2% | in-progress |
| `packages/CodexInterfaceAdapter/Tests` | 9 | 2 | 22.2% | in-progress |
| `packages/OpenCodeInterfaceAdapter/Source` | 11 | 0 | 0.0% | not-started |
| `packages/OpenCodeInterfaceAdapter/Tests` | 4 | 0 | 0.0% | not-started |
| `docs` | 23 | 7 | 30.4% | in-progress |
| `scripts` | 18 | 18 | 100.0% | in-progress |
| `end-to-end` | 17 | 0 | 0.0% | not-started |
| `operations` | 2 | 0 | 0.0% | not-started |
| `public` | 5 | 0 | 0.0% | not-started |
| `repository-root-and-other` | 1286 | 2 | 0.2% | in-progress |

## Folder Coverage

| Group Root | Immediate Folder | Total Files | Touched Files | Coverage | Progress |
| --- | --- | ---: | ---: | ---: | --- |
| `apps/WebApplication/Source` | `(direct-files)` | 3 | 0 | 0.0% | not-started |
| `apps/WebApplication/Source` | `Application` | 49 | 2 | 4.1% | in-progress |
| `apps/WebApplication/Source` | `Components` | 30 | 0 | 0.0% | not-started |
| `apps/WebApplication/Source` | `Features` | 82 | 2 | 2.4% | in-progress |
| `apps/WebApplication/Source` | `Shared` | 8 | 1 | 12.5% | in-progress |
| `apps/WebApplication/Tests` | `(direct-files)` | 107 | 4 | 3.7% | in-progress |
| `apps/WebApplication/public` | `(direct-files)` | 2 | 0 | 0.0% | not-started |
| `apps/WebApplication/public` | `icons` | 3 | 0 | 0.0% | not-started |
| `apps/ServerApplication/Source` | `Agents` | 15 | 1 | 6.7% | in-progress |
| `apps/ServerApplication/Source` | `Application` | 7 | 2 | 28.6% | in-progress |
| `apps/ServerApplication/Source` | `Modules` | 11 | 1 | 9.1% | in-progress |
| `apps/ServerApplication/Source` | `Network` | 44 | 3 | 6.8% | in-progress |
| `apps/ServerApplication/Source` | `Shared` | 1 | 0 | 0.0% | not-started |
| `apps/ServerApplication/Tests` | `(direct-files)` | 57 | 1 | 1.8% | in-progress |
| `packages/CodexProtocol/Source` | `(direct-files)` | 8 | 0 | 0.0% | not-started |
| `packages/CodexProtocol/Source` | `Contracts` | 6 | 0 | 0.0% | not-started |
| `packages/CodexProtocol/Source` | `Generated` | 10 | 0 | 0.0% | not-started |
| `packages/CodexProtocol/Source` | `Parsers` | 1 | 0 | 0.0% | not-started |
| `packages/CodexProtocol/Tests` | `(direct-files)` | 8 | 0 | 0.0% | not-started |
| `packages/CodexProtocol/Tests` | `fixtures` | 2 | 0 | 0.0% | not-started |
| `packages/CodexInterfaceAdapter/Source` | `(direct-files)` | 9 | 2 | 22.2% | in-progress |
| `packages/CodexInterfaceAdapter/Tests` | `(direct-files)` | 9 | 2 | 22.2% | in-progress |
| `packages/OpenCodeInterfaceAdapter/Source` | `(direct-files)` | 11 | 0 | 0.0% | not-started |
| `packages/OpenCodeInterfaceAdapter/Tests` | `(direct-files)` | 4 | 0 | 0.0% | not-started |
| `docs` | `(direct-files)` | 4 | 1 | 25.0% | in-progress |
| `docs` | `debug` | 16 | 5 | 31.3% | in-progress |
| `docs` | `decisions` | 3 | 1 | 33.3% | in-progress |
| `scripts` | `development` | 2 | 2 | 100.0% | in-progress |
| `scripts` | `operations` | 4 | 4 | 100.0% | in-progress |
| `scripts` | `setup` | 5 | 5 | 100.0% | in-progress |
| `scripts` | `smoke` | 3 | 3 | 100.0% | in-progress |
| `scripts` | `tooling` | 4 | 4 | 100.0% | in-progress |
| `end-to-end` | `real` | 17 | 0 | 0.0% | not-started |
| `operations` | `caddy` | 2 | 0 | 0.0% | not-started |
| `public` | `(direct-files)` | 5 | 0 | 0.0% | not-started |

## Concern Coverage

| Concern | Touched Files | Added Lines | Removed Lines | Net Lines | Progress |
| --- | ---: | ---: | ---: | ---: | --- |
| Server Runtime and Network Hardening | 8 | 514 | 170 | +344 | in-progress |
| Web State and Debugging Hardening | 9 | 380 | 106 | +274 | in-progress |
| Adapter and Protocol Hardening | 4 | 408 | 252 | +156 | in-progress |
| Scripts, Docs, and Tooling Governance | 27 | 200 | 172 | +28 | in-progress |
| Repository Areas Without Current-Wave Touches | 1790 | 0 | 0 | 0 | not-started |

## Touched File Inventory (Current Wave)

| File | Added Lines | Removed Lines | Net Lines |
| --- | ---: | ---: | ---: |
| `.github/workflows/ios-setup-checks.yml` | 8 | 8 | +0 |
| `apps/ServerApplication/Source/Agents/Adapters/CodexThreadStreamStateOwner.ts` | 62 | 26 | +36 |
| `apps/ServerApplication/Source/Application/Configuration/ServerRuntimeConfiguration.ts` | 40 | 11 | +29 |
| `apps/ServerApplication/Source/Application/ServerBootstrap.ts` | 25 | 15 | +10 |
| `apps/ServerApplication/Source/Modules/Threads/ThreadCompletionNotificationService.ts` | 179 | 89 | +90 |
| `apps/ServerApplication/Source/Network/RequestObservabilityOwner.ts` | 66 | 21 | +45 |
| `apps/ServerApplication/Source/Network/RequestPathContracts.ts` | 52 | 0 | +52 |
| `apps/ServerApplication/Source/Network/ServerRequestHandler.ts` | 17 | 8 | +9 |
| `apps/ServerApplication/Tests/ThreadCompletionNotificationService.test.ts` | 73 | 0 | +73 |
| `apps/WebApplication/Source/Application/StateManagement/CoreDataSnapshotStateApplier.ts` | 76 | 33 | +43 |
| `apps/WebApplication/Source/Application/StateManagement/UseCoreDataLoaders.ts` | 34 | 18 | +16 |
| `apps/WebApplication/Source/Features/Debugging/StateManagement/TrackedUserInterfaceErrorPolicy.ts` | 8 | 2 | +6 |
| `apps/WebApplication/Source/Features/PushNotifications/DataAccess/PushClientStateManager.ts` | 52 | 23 | +29 |
| `apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransport.ts` | 35 | 14 | +21 |
| `apps/WebApplication/Tests/CoreDataSnapshotStateApplier.test.ts` | 69 | 12 | +57 |
| `apps/WebApplication/Tests/FarfieldHttpTransport.test.ts` | 59 | 0 | +59 |
| `apps/WebApplication/Tests/Push.test.ts` | 40 | 3 | +37 |
| `apps/WebApplication/Tests/TrackedUserInterfaceErrorPolicy.test.ts` | 7 | 1 | +6 |
| `docs/debug/HardeningCoverageFileInventory.tsv` | 49 | 49 | +0 |
| `docs/debug/HardeningCoverageFolderInventory.tsv` | 20 | 16 | +4 |
| `docs/debug/HardeningCoverageGroupInventory.tsv` | 6 | 6 | +0 |
| `docs/debug/HardeningCoverageTracker.md` | 78 | 50 | +28 |
| `docs/debug/real-app-end-to-end-setup-plan.md` | 4 | 4 | +0 |
| `docs/decisions/2026-02-26-ExcludedSurfaceHardeningGovernance.md` | 1 | 1 | +0 |
| `docs/proposed-structure-and-migration.md` | 13 | 17 | -4 |
| `package.json` | 20 | 20 | +0 |
| `packages/CodexInterfaceAdapter/Source/IpcClient.ts` | 67 | 34 | +33 |
| `packages/CodexInterfaceAdapter/Source/LiveState.ts` | 191 | 143 | +48 |
| `packages/CodexInterfaceAdapter/Tests/IpcClient.test.ts` | 109 | 75 | +34 |
| `packages/CodexInterfaceAdapter/Tests/LiveState.test.ts` | 41 | 0 | +41 |
| `scripts/development/caddy-local.mjs` | 0 | 0 | +0 |
| `scripts/development/dev.mjs` | 0 | 0 | +0 |
| `scripts/operations/end-to-end-real-safe-run.mjs` | 0 | 0 | +0 |
| `scripts/operations/push-doctor.mjs` | 0 | 0 | +0 |
| `scripts/operations/rotate-api-token.mjs` | 0 | 0 | +0 |
| `scripts/operations/stream-burst.mjs` | 0 | 0 | +0 |
| `scripts/setup/generate-vapid-keys.mjs` | 0 | 0 | +0 |
| `scripts/setup/ios-trust-local-ca.mjs` | 0 | 0 | +0 |
| `scripts/setup/setup-domain-https.mjs` | 1 | 1 | +0 |
| `scripts/setup/setup-ios-push.mjs` | 0 | 0 | +0 |
| `scripts/setup/setup-ntfy.mjs` | 0 | 0 | +0 |
| `scripts/smoke/app-smoke.mjs` | 0 | 0 | +0 |
| `scripts/smoke/ios-device-smoke-matrix.mjs` | 0 | 0 | +0 |
| `scripts/smoke/ios-device-smoke.mjs` | 0 | 0 | +0 |
| `scripts/tooling/generate-codex-schema.mjs` | 0 | 0 | +0 |
| `scripts/tooling/sanitize-traces.mjs` | 0 | 0 | +0 |
| `scripts/tooling/validate-end-to-end-governance.mjs` | 0 | 0 | +0 |
| `scripts/tooling/with-env.mjs` | 0 | 0 | +0 |

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
