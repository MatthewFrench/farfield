# Hardening Coverage Tracker

Last Updated (UTC): 2026-02-26 16:35:57Z

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

- Total files in workspace inventory: 1856
- Files touched in current wave: 155 (8.4%)
- Files not touched in current wave: 1701
- Line churn across touched files: +19850 / -6085 (net +13765)

## Latest Continuation Commit Wave

The following isolated commits were added after the last inventory refresh:

1. `6971ae1` `refactor: harden server error event recorder contracts`
2. `316ceec` `refactor: harden observability snapshot contract ownership`
3. `142be9c` `refactor: harden push dispatch scheduler ownership`
4. `d6bd727` `refactor: harden push mutation queue ownership`
5. `1ddf5ff` `refactor: harden request path normalization contracts`
6. `b838425` `refactor: harden push test payload contract ownership`
7. `9c48ed7` `refactor: harden runtime route bootstrap contracts`
8. `da12b03` `refactor: harden agent route descriptor boundaries`
9. `574ce8d` `refactor: harden thread route dispatch ownership`

Files touched in this continuation wave:

1. `apps/ServerApplication/Source/Network/ServerErrorEventRecorder.ts`
2. `apps/ServerApplication/Tests/ServerErrorEventRecorder.test.ts`
3. `apps/ServerApplication/Source/Network/ServerObservabilitySnapshotOwner.ts`
4. `apps/ServerApplication/Tests/ServerObservabilitySnapshotOwner.test.ts`
5. `apps/ServerApplication/Source/Network/PushDispatchConcurrencyCoordinator.ts`
6. `apps/ServerApplication/Tests/PushDispatchConcurrencyCoordinator.test.ts`
7. `apps/ServerApplication/Source/Network/PushMutationConcurrencyCoordinator.ts`
8. `apps/ServerApplication/Tests/PushMutationConcurrencyCoordinator.test.ts`
9. `apps/ServerApplication/Source/Network/RequestPathContracts.ts`
10. `apps/ServerApplication/Tests/RequestPathContracts.test.ts`
11. `apps/ServerApplication/Source/Network/PushTestPayloadOwner.ts`
12. `apps/ServerApplication/Tests/PushTestPayloadOwner.test.ts`
13. `apps/ServerApplication/Source/Network/Routes/RuntimeRoutes.ts`
14. `apps/ServerApplication/Tests/RuntimeRoutes.test.ts`
15. `apps/ServerApplication/Source/Network/Routes/AgentRoutes.ts`
16. `apps/ServerApplication/Tests/AgentRoutes.test.ts`
17. `apps/ServerApplication/Source/Network/Routes/ThreadRoutes.ts`
18. `apps/ServerApplication/Tests/ThreadRoutes.test.ts`

## Repository Segment Coverage

| Segment | Total Files | Touched Files | Coverage | Progress |
| --- | --- | --- | --- | --- |
| `.claude` | 1 | 0 | 0.0% | not-started |
| `.github` | 3 | 0 | 0.0% | not-started |
| `(root)` | 13 | 0 | 0.0% | not-started |
| `apps` | 446 | 120 | 26.9% | in-progress |
| `docs` | 23 | 4 | 17.4% | in-progress |
| `end-to-end` | 17 | 0 | 0.0% | not-started |
| `operations` | 2 | 0 | 0.0% | not-started |
| `packages` | 1326 | 31 | 2.3% | in-progress |
| `public` | 5 | 0 | 0.0% | not-started |
| `scripts` | 18 | 0 | 0.0% | not-started |
| `skills` | 2 | 0 | 0.0% | not-started |

## Architecture Group Coverage

| Group Root | Total Files | Touched Files | Coverage | Progress |
| --- | --- | --- | --- | --- |
| `apps/ServerApplication/Source` | 78 | 31 | 39.7% | in-progress |
| `apps/ServerApplication/Tests` | 65 | 29 | 44.6% | in-progress |
| `apps/WebApplication/public` | 5 | 0 | 0.0% | not-started |
| `apps/WebApplication/Source` | 172 | 31 | 18.0% | in-progress |
| `apps/WebApplication/Tests` | 116 | 29 | 25.0% | in-progress |
| `docs` | 23 | 4 | 17.4% | in-progress |
| `end-to-end` | 17 | 0 | 0.0% | not-started |
| `operations` | 2 | 0 | 0.0% | not-started |
| `packages/CodexInterfaceAdapter/Source` | 9 | 6 | 66.7% | in-progress |
| `packages/CodexInterfaceAdapter/Tests` | 9 | 6 | 66.7% | in-progress |
| `packages/CodexProtocol/Source` | 25 | 5 | 20.0% | in-progress |
| `packages/CodexProtocol/Tests` | 10 | 4 | 40.0% | in-progress |
| `packages/OpenCodeInterfaceAdapter/Source` | 11 | 5 | 45.5% | in-progress |
| `packages/OpenCodeInterfaceAdapter/Tests` | 5 | 5 | 100.0% | in-progress |
| `public` | 5 | 0 | 0.0% | not-started |
| `repository-root-and-other` | 1286 | 0 | 0.0% | not-started |
| `scripts` | 18 | 0 | 0.0% | not-started |

## Folder Coverage

| Group Root | Immediate Folder | Total Files | Touched Files | Coverage | Progress |
| --- | --- | --- | --- | --- | --- |
| `apps/ServerApplication/Source` | `Agents` | 15 | 8 | 53.3% | in-progress |
| `apps/ServerApplication/Source` | `Application` | 7 | 3 | 42.9% | in-progress |
| `apps/ServerApplication/Source` | `Modules` | 11 | 6 | 54.5% | in-progress |
| `apps/ServerApplication/Source` | `Network` | 44 | 14 | 31.8% | in-progress |
| `apps/ServerApplication/Source` | `Shared` | 1 | 0 | 0.0% | not-started |
| `apps/ServerApplication/Tests` | `(direct-files)` | 65 | 29 | 44.6% | in-progress |
| `apps/WebApplication/public` | `(direct-files)` | 2 | 0 | 0.0% | not-started |
| `apps/WebApplication/public` | `icons` | 3 | 0 | 0.0% | not-started |
| `apps/WebApplication/Source` | `(direct-files)` | 3 | 2 | 66.7% | in-progress |
| `apps/WebApplication/Source` | `Application` | 49 | 14 | 28.6% | in-progress |
| `apps/WebApplication/Source` | `Components` | 30 | 1 | 3.3% | in-progress |
| `apps/WebApplication/Source` | `Features` | 82 | 13 | 15.9% | in-progress |
| `apps/WebApplication/Source` | `Shared` | 8 | 1 | 12.5% | in-progress |
| `apps/WebApplication/Tests` | `(direct-files)` | 116 | 29 | 25.0% | in-progress |
| `docs` | `(direct-files)` | 4 | 0 | 0.0% | not-started |
| `docs` | `debug` | 16 | 4 | 25.0% | in-progress |
| `docs` | `decisions` | 3 | 0 | 0.0% | not-started |
| `end-to-end` | `real` | 17 | 0 | 0.0% | not-started |
| `operations` | `caddy` | 2 | 0 | 0.0% | not-started |
| `packages/CodexInterfaceAdapter/Source` | `(direct-files)` | 9 | 6 | 66.7% | in-progress |
| `packages/CodexInterfaceAdapter/Tests` | `(direct-files)` | 9 | 6 | 66.7% | in-progress |
| `packages/CodexProtocol/Source` | `(direct-files)` | 8 | 4 | 50.0% | in-progress |
| `packages/CodexProtocol/Source` | `Contracts` | 6 | 1 | 16.7% | in-progress |
| `packages/CodexProtocol/Source` | `Generated` | 10 | 0 | 0.0% | not-started |
| `packages/CodexProtocol/Source` | `Parsers` | 1 | 0 | 0.0% | not-started |
| `packages/CodexProtocol/Tests` | `(direct-files)` | 8 | 4 | 50.0% | in-progress |
| `packages/CodexProtocol/Tests` | `fixtures` | 2 | 0 | 0.0% | not-started |
| `packages/OpenCodeInterfaceAdapter/Source` | `(direct-files)` | 11 | 5 | 45.5% | in-progress |
| `packages/OpenCodeInterfaceAdapter/Tests` | `(direct-files)` | 5 | 5 | 100.0% | in-progress |
| `public` | `(direct-files)` | 5 | 0 | 0.0% | not-started |
| `repository-root-and-other` | `(direct-files)` | 1286 | 0 | 0.0% | not-started |
| `scripts` | `development` | 2 | 0 | 0.0% | not-started |
| `scripts` | `operations` | 4 | 0 | 0.0% | not-started |
| `scripts` | `setup` | 5 | 0 | 0.0% | not-started |
| `scripts` | `smoke` | 3 | 0 | 0.0% | not-started |
| `scripts` | `tooling` | 4 | 0 | 0.0% | not-started |

## Concern Coverage

| Concern | Touched Files | Added Lines | Removed Lines | Net Lines | Progress |
| --- | --- | --- | --- | --- | --- |
| Adapter and Protocol Hardening | 31 | 2269 | 963 | 1306 | in-progress |
| Repository Areas Without Current-Wave Touches | 0 | 0 | 0 | 0 | not-started |
| Scripts, Docs, and Tooling Governance | 4 | 3525 | 2019 | 1506 | in-progress |
| Server Runtime and Network Hardening | 60 | 6733 | 1622 | 5111 | in-progress |
| Web State and Debugging Hardening | 60 | 7323 | 1481 | 5842 | in-progress |

## Touched File Inventory (Current Wave)

| File | Added Lines | Removed Lines | Net Lines |
| --- | --- | --- | --- |
| `apps/ServerApplication/Source/Agents/Adapters/CodexConnectionLifecycleOwner.ts` | 116 | 64 | 52 |
| `apps/ServerApplication/Source/Agents/Adapters/CodexThreadInteractionOwner.ts` | 46 | 38 | 8 |
| `apps/ServerApplication/Source/Agents/Adapters/CodexThreadManagementOwner.ts` | 58 | 28 | 30 |
| `apps/ServerApplication/Source/Agents/Adapters/CodexThreadStreamStateOwner.ts` | 86 | 44 | 42 |
| `apps/ServerApplication/Source/Agents/Adapters/OpenCodeAgentAdapter.ts` | 78 | 48 | 30 |
| `apps/ServerApplication/Source/Agents/AgentRuntimeOwner.ts` | 62 | 28 | 34 |
| `apps/ServerApplication/Source/Agents/ThreadAdapterResolver.ts` | 66 | 46 | 20 |
| `apps/ServerApplication/Source/Agents/Types.ts` | 64 | 16 | 48 |
| `apps/ServerApplication/Source/Application/Bootstrap/ServerLifecycleCoordinator.ts` | 37 | 23 | 14 |
| `apps/ServerApplication/Source/Application/Configuration/ServerRuntimeConfiguration.ts` | 17 | 20 | -3 |
| `apps/ServerApplication/Source/Application/ServerBootstrap.ts` | 62 | 36 | 26 |
| `apps/ServerApplication/Source/Modules/Activity/ActivityHistoryService.ts` | 70 | 46 | 24 |
| `apps/ServerApplication/Source/Modules/Debugging/ClientErrorStore.ts` | 96 | 46 | 50 |
| `apps/ServerApplication/Source/Modules/PushNotifications/NtfyNotifier.ts` | 59 | 17 | 42 |
| `apps/ServerApplication/Source/Modules/PushNotifications/PushService.ts` | 12 | 7 | 5 |
| `apps/ServerApplication/Source/Modules/PushNotifications/PushStore.ts` | 35 | 8 | 27 |
| `apps/ServerApplication/Source/Modules/Threads/ThreadCompletionNotificationService.ts` | 43 | 12 | 31 |
| `apps/ServerApplication/Source/Network/BrowserSessionAuthOwner.ts` | 88 | 49 | 39 |
| `apps/ServerApplication/Source/Network/EventLoopLagObservabilityOwner.ts` | 66 | 29 | 37 |
| `apps/ServerApplication/Source/Network/EventStreamClientRegistry.ts` | 46 | 11 | 35 |
| `apps/ServerApplication/Source/Network/RequestObservabilityOwner.ts` | 115 | 42 | 73 |
| `apps/ServerApplication/Source/Network/Routes/CapabilityRoutes.ts` | 299 | 121 | 178 |
| `apps/ServerApplication/Source/Network/Routes/PushRoutes.ts` | 146 | 37 | 109 |
| `apps/ServerApplication/Source/Network/Routes/PushTestRouteOwner.ts` | 78 | 30 | 48 |
| `apps/ServerApplication/Source/Network/Routes/ThreadCollectionListQueryOwner.ts` | 162 | 88 | 74 |
| `apps/ServerApplication/Source/Network/Routes/ThreadCollectionRoutes.ts` | 397 | 198 | 199 |
| `apps/ServerApplication/Source/Network/ServerRequestErrorResponder.ts` | 126 | 74 | 52 |
| `apps/ServerApplication/Source/Network/ServerRequestHandler.ts` | 165 | 70 | 95 |
| `apps/ServerApplication/Source/Network/ServerRequestUtilityOwner.ts` | 34 | 4 | 30 |
| `apps/ServerApplication/Source/Network/ThreadListAggregationCache.ts` | 70 | 31 | 39 |
| `apps/ServerApplication/Source/Network/ThreadStreamDeltaEventPublisher.ts` | 49 | 21 | 28 |
| `apps/ServerApplication/Tests/ActivityHistoryService.test.ts` | 72 | 3 | 69 |
| `apps/ServerApplication/Tests/AgentRuntimeOwner.test.ts` | 75 | 55 | 20 |
| `apps/ServerApplication/Tests/AgentTypes.test.ts` | 75 | 0 | 75 |
| `apps/ServerApplication/Tests/BrowserSessionAuthOwner.test.ts` | 119 | 55 | 64 |
| `apps/ServerApplication/Tests/CapabilityRoutes.test.ts` | 354 | 0 | 354 |
| `apps/ServerApplication/Tests/ClientErrorStore.test.ts` | 80 | 0 | 80 |
| `apps/ServerApplication/Tests/CodexAgentAdapter.test.ts` | 85 | 0 | 85 |
| `apps/ServerApplication/Tests/CodexConnectionLifecycleOwner.test.ts` | 292 | 2 | 290 |
| `apps/ServerApplication/Tests/CodexThreadInteractionOwner.test.ts` | 543 | 0 | 543 |
| `apps/ServerApplication/Tests/CodexThreadManagementOwner.test.ts` | 129 | 1 | 128 |
| `apps/ServerApplication/Tests/CodexThreadStreamStateOwner.test.ts` | 26 | 0 | 26 |
| `apps/ServerApplication/Tests/EventLoopLagObservabilityOwner.test.ts` | 60 | 1 | 59 |
| `apps/ServerApplication/Tests/EventStreamClientRegistry.test.ts` | 58 | 0 | 58 |
| `apps/ServerApplication/Tests/NtfyNotifier.test.ts` | 115 | 15 | 100 |
| `apps/ServerApplication/Tests/OpenCodeAgentAdapter.test.ts` | 244 | 0 | 244 |
| `apps/ServerApplication/Tests/PushRoutes.test.ts` | 64 | 19 | 45 |
| `apps/ServerApplication/Tests/PushService.test.ts` | 97 | 69 | 28 |
| `apps/ServerApplication/Tests/PushTestRouteOwner.test.ts` | 187 | 11 | 176 |
| `apps/ServerApplication/Tests/RequestObservabilityOwner.test.ts` | 120 | 0 | 120 |
| `apps/ServerApplication/Tests/ServerBootstrap.test.ts` | 132 | 0 | 132 |
| `apps/ServerApplication/Tests/ServerRequestErrorResponder.test.ts` | 82 | 19 | 63 |
| `apps/ServerApplication/Tests/ServerRequestHandler.test.ts` | 87 | 1 | 86 |
| `apps/ServerApplication/Tests/ServerRuntimeConfiguration.test.ts` | 40 | 0 | 40 |
| `apps/ServerApplication/Tests/ThreadAdapterResolver.test.ts` | 45 | 0 | 45 |
| `apps/ServerApplication/Tests/ThreadCollectionListQueryOwner.test.ts` | 116 | 0 | 116 |
| `apps/ServerApplication/Tests/ThreadCollectionRoutes.test.ts` | 129 | 8 | 121 |
| `apps/ServerApplication/Tests/ThreadCompletionNotificationServiceContext.test.ts` | 258 | 0 | 258 |
| `apps/ServerApplication/Tests/ThreadListAggregationCache.test.ts` | 49 | 0 | 49 |
| `apps/ServerApplication/Tests/ThreadStreamDeltaEventPublisher.test.ts` | 152 | 31 | 121 |
| `apps/WebApplication/Source/App.tsx` | 36 | 22 | 14 |
| `apps/WebApplication/Source/Application/StateManagement/ApiSessionBootstrapCoordinator.ts` | 61 | 32 | 29 |
| `apps/WebApplication/Source/Application/StateManagement/CoreDataSnapshotStateApplier.ts` | 200 | 90 | 110 |
| `apps/WebApplication/Source/Application/StateManagement/EventStreamConnectionCoordinator.ts` | 81 | 44 | 37 |
| `apps/WebApplication/Source/Application/StateManagement/EventStreamRefreshDecisionEngine.ts` | 17 | 8 | 9 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationDerivedState.ts` | 45 | 20 | 25 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationOwnerDependencies.ts` | 49 | 60 | -11 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationRefreshEffects.ts` | 44 | 23 | 21 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationRuntimeComposition.ts` | 83 | 42 | 41 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationShellComposition.ts` | 78 | 32 | 46 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationShellState.ts` | 169 | 55 | 114 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationShellStateContracts.ts` | 11 | 8 | 3 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationShellViewProperties.ts` | 81 | 23 | 58 |
| `apps/WebApplication/Source/Application/StateManagement/UseCoreDataLoaders.ts` | 49 | 45 | 4 |
| `apps/WebApplication/Source/Application/StateManagement/UseEventStreamEffects.ts` | 32 | 4 | 28 |
| `apps/WebApplication/Source/Components/ConversationItem.tsx` | 132 | 104 | 28 |
| `apps/WebApplication/Source/Features/Chat/DataAccess/ChatApi.ts` | 72 | 44 | 28 |
| `apps/WebApplication/Source/Features/Chat/StateManagement/SelectedThreadDataRefreshCoordinator.ts` | 137 | 63 | 74 |
| `apps/WebApplication/Source/Features/Chat/StateManagement/UseChatActionHandlers.ts` | 63 | 32 | 31 |
| `apps/WebApplication/Source/Features/Chat/StateManagement/UseSelectedThreadLoaders.ts` | 69 | 40 | 29 |
| `apps/WebApplication/Source/Features/Chat/UserInterface/ChatWorkspacePane.tsx` | 70 | 49 | 21 |
| `apps/WebApplication/Source/Features/Debugging/DataAccess/DebugApi.ts` | 195 | 113 | 82 |
| `apps/WebApplication/Source/Features/Debugging/StateManagement/TrackedUserInterfaceErrorReporter.ts` | 93 | 41 | 52 |
| `apps/WebApplication/Source/Features/PushNotifications/DataAccess/PushApi.ts` | 59 | 35 | 24 |
| `apps/WebApplication/Source/Features/PushNotifications/DataAccess/PushClientStateManager.ts` | 48 | 43 | 5 |
| `apps/WebApplication/Source/Features/Threads/DataAccess/ThreadApi.ts` | 86 | 41 | 45 |
| `apps/WebApplication/Source/Features/Threads/DomainModel/ThreadGroupSelectors.ts` | 55 | 22 | 33 |
| `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListStateController.ts` | 57 | 18 | 39 |
| `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListStateStore.ts` | 54 | 41 | 13 |
| `apps/WebApplication/Source/Main.tsx` | 143 | 87 | 56 |
| `apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransport.ts` | 109 | 37 | 72 |
| `apps/WebApplication/Tests/ApiSessionBootstrapCoordinator.test.ts` | 31 | 0 | 31 |
| `apps/WebApplication/Tests/AppInitialModeKey.test.ts` | 43 | 0 | 43 |
| `apps/WebApplication/Tests/ChatApi.test.ts` | 135 | 0 | 135 |
| `apps/WebApplication/Tests/ChatWorkspacePane.test.tsx` | 40 | 5 | 35 |
| `apps/WebApplication/Tests/ConversationItem.test.tsx` | 68 | 0 | 68 |
| `apps/WebApplication/Tests/CoreDataSnapshotStateApplier.test.ts` | 151 | 30 | 121 |
| `apps/WebApplication/Tests/DebugApi.test.ts` | 118 | 0 | 118 |
| `apps/WebApplication/Tests/EventStreamConnectionCoordinator.test.ts` | 71 | 56 | 15 |
| `apps/WebApplication/Tests/EventStreamRefreshDecisionEngine.test.ts` | 71 | 0 | 71 |
| `apps/WebApplication/Tests/FarfieldHttpTransport.test.ts` | 45 | 0 | 45 |
| `apps/WebApplication/Tests/Main.test.ts` | 313 | 0 | 313 |
| `apps/WebApplication/Tests/PushApi.test.ts` | 156 | 0 | 156 |
| `apps/WebApplication/Tests/PushClientStateManager.test.ts` | 347 | 0 | 347 |
| `apps/WebApplication/Tests/SelectedThreadDataRefreshCoordinator.test.ts` | 57 | 0 | 57 |
| `apps/WebApplication/Tests/ThreadApi.test.ts` | 79 | 1 | 78 |
| `apps/WebApplication/Tests/ThreadGroupSelectors.test.ts` | 250 | 0 | 250 |
| `apps/WebApplication/Tests/ThreadListStateStore.test.ts` | 169 | 10 | 159 |
| `apps/WebApplication/Tests/ThreadOwnership.test.ts` | 122 | 0 | 122 |
| `apps/WebApplication/Tests/TrackedUserInterfaceErrorReporter.test.ts` | 68 | 0 | 68 |
| `apps/WebApplication/Tests/UseApplicationDerivedState.test.tsx` | 392 | 0 | 392 |
| `apps/WebApplication/Tests/UseApplicationOwnerDependencies.test.tsx` | 280 | 0 | 280 |
| `apps/WebApplication/Tests/UseApplicationRefreshEffects.test.tsx` | 56 | 3 | 53 |
| `apps/WebApplication/Tests/UseApplicationShellComposition.test.tsx` | 480 | 0 | 480 |
| `apps/WebApplication/Tests/UseApplicationShellState.test.tsx` | 145 | 17 | 128 |
| `apps/WebApplication/Tests/UseApplicationShellViewProperties.test.ts` | 83 | 2 | 81 |
| `apps/WebApplication/Tests/UseChatActionHandlers.test.tsx` | 494 | 0 | 494 |
| `apps/WebApplication/Tests/UseCoreDataLoaders.test.tsx` | 400 | 0 | 400 |
| `apps/WebApplication/Tests/UseEventStreamEffects.test.tsx` | 125 | 39 | 86 |
| `apps/WebApplication/Tests/UseSelectedThreadLoaders.test.tsx` | 56 | 0 | 56 |
| `docs/debug/HardeningCoverageFileInventory.tsv` | 3250 | 1792 | 1458 |
| `docs/debug/HardeningCoverageFolderInventory.tsv` | 37 | 101 | -64 |
| `docs/debug/HardeningCoverageGroupInventory.tsv` | 18 | 12 | 6 |
| `docs/debug/HardeningCoverageTracker.md` | 220 | 114 | 106 |
| `packages/CodexInterfaceAdapter/Source/AppServerClient.ts` | 100 | 36 | 64 |
| `packages/CodexInterfaceAdapter/Source/AppServerTransport.ts` | 66 | 42 | 24 |
| `packages/CodexInterfaceAdapter/Source/IpcClient.ts` | 196 | 143 | 53 |
| `packages/CodexInterfaceAdapter/Source/JsonRpc.ts` | 74 | 38 | 36 |
| `packages/CodexInterfaceAdapter/Source/LiveState.ts` | 140 | 76 | 64 |
| `packages/CodexInterfaceAdapter/Source/Service.ts` | 107 | 52 | 55 |
| `packages/CodexInterfaceAdapter/Tests/AppServerClient.test.ts` | 30 | 2 | 28 |
| `packages/CodexInterfaceAdapter/Tests/AppServerTransport.test.ts` | 18 | 0 | 18 |
| `packages/CodexInterfaceAdapter/Tests/IpcClient.test.ts` | 70 | 0 | 70 |
| `packages/CodexInterfaceAdapter/Tests/JsonRpc.test.ts` | 21 | 10 | 11 |
| `packages/CodexInterfaceAdapter/Tests/LiveState.test.ts` | 147 | 154 | -7 |
| `packages/CodexInterfaceAdapter/Tests/Service.test.ts` | 82 | 2 | 80 |
| `packages/CodexProtocol/Source/AppServer.ts` | 24 | 21 | 3 |
| `packages/CodexProtocol/Source/Contracts/Thread/TurnItemContracts.ts` | 98 | 43 | 55 |
| `packages/CodexProtocol/Source/FarfieldServer.ts` | 73 | 87 | -14 |
| `packages/CodexProtocol/Source/Ipc.ts` | 31 | 8 | 23 |
| `packages/CodexProtocol/Source/Push.ts` | 87 | 56 | 31 |
| `packages/CodexProtocol/Tests/ProtocolAppServerSchemas.test.ts` | 79 | 0 | 79 |
| `packages/CodexProtocol/Tests/ProtocolIpcSchemas.test.ts` | 56 | 9 | 47 |
| `packages/CodexProtocol/Tests/ProtocolPushSchemas.test.ts` | 52 | 0 | 52 |
| `packages/CodexProtocol/Tests/ProtocolThreadContractHardening.test.ts` | 88 | 0 | 88 |
| `packages/OpenCodeInterfaceAdapter/Source/Client.ts` | 37 | 45 | -8 |
| `packages/OpenCodeInterfaceAdapter/Source/EventPayloadMapper.ts` | 82 | 24 | 58 |
| `packages/OpenCodeInterfaceAdapter/Source/Schemas.ts` | 87 | 69 | 18 |
| `packages/OpenCodeInterfaceAdapter/Source/Service.ts` | 58 | 32 | 26 |
| `packages/OpenCodeInterfaceAdapter/Source/TurnItemMapper.ts` | 38 | 14 | 24 |
| `packages/OpenCodeInterfaceAdapter/Tests/Client.test.ts` | 36 | 0 | 36 |
| `packages/OpenCodeInterfaceAdapter/Tests/EventPayloadMapper.test.ts` | 29 | 0 | 29 |
| `packages/OpenCodeInterfaceAdapter/Tests/Mapper.test.ts` | 56 | 0 | 56 |
| `packages/OpenCodeInterfaceAdapter/Tests/Schemas.test.ts` | 171 | 0 | 171 |
| `packages/OpenCodeInterfaceAdapter/Tests/Service.test.ts` | 36 | 0 | 36 |

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
