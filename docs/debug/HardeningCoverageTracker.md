# Hardening Coverage Tracker

Last Updated (UTC): 2026-02-26 04:03:19Z

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

- Total files in workspace inventory: 1833
- Files touched in current wave: 481 (26.2%)
- Files not touched in current wave: 1352
- Line churn across touched files: +25744 / -5244 (net +20500)
- Product-surface churn excluding tracker docs in docs/debug: 476 files, +23090 / -5244 (net +17846)

## Repository Segment Coverage

| Segment | Total Files | Touched Files | Coverage | Progress |
| --- | ---: | ---: | ---: | --- |
| `(root)` | 13 | 0 | 0.0% | not-started |
| `.claude` | 1 | 0 | 0.0% | not-started |
| `.github` | 3 | 0 | 0.0% | not-started |
| `apps` | 424 | 412 | 97.2% | in-progress |
| `docs` | 22 | 6 | 27.3% | in-progress |
| `end-to-end` | 17 | 0 | 0.0% | not-started |
| `operations` | 2 | 0 | 0.0% | not-started |
| `packages` | 1326 | 64 | 4.8% | in-progress |
| `public` | 5 | 0 | 0.0% | not-started |
| `scripts` | 18 | 0 | 0.0% | not-started |
| `skills` | 2 | 0 | 0.0% | not-started |

## Architecture Group Coverage

| Group Root | Total Files | Touched Files | Coverage | Progress |
| --- | ---: | ---: | ---: | --- |
| `apps/WebApplication/Source` | 168 | 168 | 100.0% | complete |
| `apps/WebApplication/Tests` | 106 | 106 | 100.0% | complete |
| `apps/WebApplication/public` | 5 | 0 | 0.0% | not-started |
| `apps/ServerApplication/Source` | 78 | 78 | 100.0% | complete |
| `apps/ServerApplication/Tests` | 57 | 57 | 100.0% | complete |
| `packages/CodexProtocol/Source` | 26 | 16 | 61.5% | in-progress |
| `packages/CodexProtocol/Tests` | 10 | 8 | 80.0% | in-progress |
| `packages/CodexInterfaceAdapter/Source` | 9 | 9 | 100.0% | complete |
| `packages/CodexInterfaceAdapter/Tests` | 9 | 9 | 100.0% | complete |
| `packages/OpenCodeInterfaceAdapter/Source` | 11 | 11 | 100.0% | complete |
| `packages/OpenCodeInterfaceAdapter/Tests` | 4 | 4 | 100.0% | complete |
| `docs` | 22 | 6 | 27.3% | in-progress |
| `scripts` | 18 | 0 | 0.0% | not-started |
| `end-to-end` | 17 | 0 | 0.0% | not-started |
| `operations` | 2 | 0 | 0.0% | not-started |
| `public` | 5 | 0 | 0.0% | not-started |
| `repository-root-and-other` | 1286 | 10 | 0.8% | in-progress |

## Folder Coverage

| Group Root | Immediate Folder | Total Files | Touched Files | Coverage | Progress |
| --- | --- | ---: | ---: | ---: | --- |
| `apps/ServerApplication/Source` | `Agents` | 15 | 15 | 100.0% | complete |
| `apps/ServerApplication/Source` | `Application` | 7 | 7 | 100.0% | complete |
| `apps/ServerApplication/Source` | `Modules` | 11 | 11 | 100.0% | complete |
| `apps/ServerApplication/Source` | `Network` | 44 | 44 | 100.0% | complete |
| `apps/ServerApplication/Source` | `Shared` | 1 | 1 | 100.0% | complete |
| `apps/ServerApplication/Tests` | `(direct-files)` | 57 | 57 | 100.0% | complete |
| `apps/WebApplication/Source` | `(direct-files)` | 3 | 3 | 100.0% | complete |
| `apps/WebApplication/Source` | `Application` | 45 | 45 | 100.0% | complete |
| `apps/WebApplication/Source` | `Components` | 30 | 30 | 100.0% | complete |
| `apps/WebApplication/Source` | `Features` | 82 | 82 | 100.0% | complete |
| `apps/WebApplication/Source` | `Shared` | 8 | 8 | 100.0% | complete |
| `apps/WebApplication/Tests` | `(direct-files)` | 106 | 106 | 100.0% | complete |
| `docs` | `(direct-files)` | 4 | 0 | 0.0% | not-started |
| `docs` | `debug` | 16 | 6 | 37.5% | in-progress |
| `docs` | `decisions` | 2 | 0 | 0.0% | not-started |
| `end-to-end` | `real` | 17 | 0 | 0.0% | not-started |
| `operations` | `caddy` | 2 | 0 | 0.0% | not-started |
| `packages/CodexInterfaceAdapter/Source` | `(direct-files)` | 9 | 9 | 100.0% | complete |
| `packages/CodexInterfaceAdapter/Tests` | `(direct-files)` | 9 | 9 | 100.0% | complete |
| `packages/CodexProtocol/Source` | `(direct-files)` | 9 | 9 | 100.0% | complete |
| `packages/CodexProtocol/Source` | `Contracts` | 6 | 6 | 100.0% | complete |
| `packages/CodexProtocol/Source` | `Generated` | 10 | 0 | 0.0% | not-started |
| `packages/CodexProtocol/Source` | `Parsers` | 1 | 1 | 100.0% | complete |
| `packages/CodexProtocol/Tests` | `(direct-files)` | 8 | 8 | 100.0% | complete |
| `packages/CodexProtocol/Tests` | `fixtures` | 2 | 0 | 0.0% | not-started |
| `packages/OpenCodeInterfaceAdapter/Source` | `(direct-files)` | 11 | 11 | 100.0% | complete |
| `packages/OpenCodeInterfaceAdapter/Tests` | `(direct-files)` | 4 | 4 | 100.0% | complete |
| `public` | `(direct-files)` | 5 | 0 | 0.0% | not-started |
| `scripts` | `(direct-files)` | 18 | 0 | 0.0% | not-started |

## Concern Coverage

| Concern | Touched Files | Added Lines | Removed Lines | Net Lines | Progress |
| --- | ---: | ---: | ---: | ---: | --- |
| Hardening Program Documentation | 5 | 2654 | 0 | 2654 | in-progress |
| Other | 359 | 18169 | 3401 | 14768 | in-progress |
| Server Agents Stream Ownership | 17 | 599 | 299 | 300 | in-progress |
| Server Bootstrap Configuration and Invalidation | 11 | 743 | 165 | 578 | in-progress |
| Server Routing and Observability | 46 | 1464 | 380 | 1084 | in-progress |
| Web Core Data State Management | 36 | 1953 | 961 | 992 | in-progress |
| Web Debug Error Policy and Reporting | 7 | 162 | 38 | 124 | in-progress |
| Repository Areas Without Current-Wave Touches | 1352 | 0 | 0 | 0 | not-started |

## Touched File Inventory (Current Wave)

| File | Added Lines | Removed Lines | Net Lines |
| --- | ---: | ---: | ---: |
| `apps/ServerApplication/Source/Agents/Adapters/CodexAgentAdapter.ts` | 16 | 11 | 5 |
| `apps/ServerApplication/Source/Agents/Adapters/CodexAppServerStderrOwner.ts` | 24 | 11 | 13 |
| `apps/ServerApplication/Source/Agents/Adapters/CodexConnectionLifecycleOwner.ts` | 10 | 6 | 4 |
| `apps/ServerApplication/Source/Agents/Adapters/CodexMessageDispatchOwner.ts` | 7 | 3 | 4 |
| `apps/ServerApplication/Source/Agents/Adapters/CodexThreadInteractionOwner.ts` | 34 | 23 | 11 |
| `apps/ServerApplication/Source/Agents/Adapters/CodexThreadManagementOwner.ts` | 73 | 55 | 18 |
| `apps/ServerApplication/Source/Agents/Adapters/CodexThreadStreamStateOwner.ts` | 198 | 92 | 106 |
| `apps/ServerApplication/Source/Agents/Adapters/OpenCodeAgentAdapter.ts` | 9 | 5 | 4 |
| `apps/ServerApplication/Source/Agents/AgentRuntimeOwner.ts` | 7 | 3 | 4 |
| `apps/ServerApplication/Source/Agents/CliOptions.ts` | 50 | 32 | 18 |
| `apps/ServerApplication/Source/Agents/Registry.ts` | 13 | 8 | 5 |
| `apps/ServerApplication/Source/Agents/ThreadAdapterResolver.ts` | 46 | 28 | 18 |
| `apps/ServerApplication/Source/Agents/ThreadIndex.ts` | 12 | 0 | 12 |
| `apps/ServerApplication/Source/Agents/ThreadStreamStateChangedContract.ts` | 3 | 0 | 3 |
| `apps/ServerApplication/Source/Agents/Types.ts` | 15 | 4 | 11 |
| `apps/ServerApplication/Source/Application/Bootstrap/ServerBootstrapUtilityOwner.ts` | 13 | 6 | 7 |
| `apps/ServerApplication/Source/Application/Bootstrap/ServerLifecycleCoordinator.ts` | 35 | 14 | 21 |
| `apps/ServerApplication/Source/Application/Bootstrap/ThreadListCacheInvalidationOwner.ts` | 31 | 21 | 10 |
| `apps/ServerApplication/Source/Application/Configuration/ServerRuntimeConfiguration.ts` | 288 | 75 | 213 |
| `apps/ServerApplication/Source/Application/ServerBootstrap.ts` | 31 | 45 | -14 |
| `apps/ServerApplication/Source/Application/StateManagement/RuntimeStateOwner.ts` | 17 | 4 | 13 |
| `apps/ServerApplication/Source/Application/ThreadStreamStateChangedHistoryBatchOwner.ts` | 70 | 0 | 70 |
| `apps/ServerApplication/Source/Modules/Activity/ActivityHistoryService.ts` | 40 | 14 | 26 |
| `apps/ServerApplication/Source/Modules/Debugging/ClientErrorStore.ts` | 55 | 21 | 34 |
| `apps/ServerApplication/Source/Modules/PushNotifications/NtfyNotifier.ts` | 26 | 11 | 15 |
| `apps/ServerApplication/Source/Modules/PushNotifications/PushReceiptStore.ts` | 15 | 5 | 10 |
| `apps/ServerApplication/Source/Modules/PushNotifications/PushSendStore.ts` | 15 | 5 | 10 |
| `apps/ServerApplication/Source/Modules/PushNotifications/PushService.ts` | 26 | 11 | 15 |
| `apps/ServerApplication/Source/Modules/PushNotifications/PushStatePath.ts` | 15 | 6 | 9 |
| `apps/ServerApplication/Source/Modules/PushNotifications/PushStore.ts` | 15 | 5 | 10 |
| `apps/ServerApplication/Source/Modules/Threads/CompletionDetector.ts` | 50 | 7 | 43 |
| `apps/ServerApplication/Source/Modules/Threads/ThreadCompletionNotificationService.ts` | 86 | 30 | 56 |
| `apps/ServerApplication/Source/Modules/Threads/ThreadOwner.ts` | 20 | 9 | 11 |
| `apps/ServerApplication/Source/Network/BrowserSessionAuthOwner.ts` | 41 | 24 | 17 |
| `apps/ServerApplication/Source/Network/EventLoopLagObservabilityOwner.ts` | 32 | 10 | 22 |
| `apps/ServerApplication/Source/Network/EventStreamClientRegistry.ts` | 19 | 11 | 8 |
| `apps/ServerApplication/Source/Network/PushDispatchConcurrencyCoordinator.ts` | 7 | 0 | 7 |
| `apps/ServerApplication/Source/Network/PushMutationConcurrencyCoordinator.ts` | 5 | 1 | 4 |
| `apps/ServerApplication/Source/Network/PushTestPayloadOwner.ts` | 25 | 7 | 18 |
| `apps/ServerApplication/Source/Network/RequestObservabilityOwner.ts` | 188 | 36 | 152 |
| `apps/ServerApplication/Source/Network/RequestPathContracts.ts` | 141 | 0 | 141 |
| `apps/ServerApplication/Source/Network/RequestSchemas/HttpSchemas.ts` | 59 | 3 | 56 |
| `apps/ServerApplication/Source/Network/Routes/AgentRoutes.ts` | 9 | 1 | 8 |
| `apps/ServerApplication/Source/Network/Routes/CapabilityRoutes.ts` | 13 | 3 | 10 |
| `apps/ServerApplication/Source/Network/Routes/DebugClientErrorRouteOwner.ts` | 25 | 11 | 14 |
| `apps/ServerApplication/Source/Network/Routes/DebugFileDownload.ts` | 51 | 10 | 41 |
| `apps/ServerApplication/Source/Network/Routes/DebugHistoryRouteOwner.ts` | 13 | 8 | 5 |
| `apps/ServerApplication/Source/Network/Routes/DebugReplayFrameParser.ts` | 38 | 38 | 0 |
| `apps/ServerApplication/Source/Network/Routes/DebugReplayRouteOwner.ts` | 7 | 4 | 3 |
| `apps/ServerApplication/Source/Network/Routes/DebugRouteContracts.ts` | 37 | 2 | 35 |
| `apps/ServerApplication/Source/Network/Routes/DebugRoutes.ts` | 5 | 2 | 3 |
| `apps/ServerApplication/Source/Network/Routes/DebugTraceRouteOwner.ts` | 34 | 17 | 17 |
| `apps/ServerApplication/Source/Network/Routes/DebugTypes.ts` | 20 | 2 | 18 |
| `apps/ServerApplication/Source/Network/Routes/PushRouteContracts.ts` | 23 | 0 | 23 |
| `apps/ServerApplication/Source/Network/Routes/PushRoutes.ts` | 17 | 12 | 5 |
| `apps/ServerApplication/Source/Network/Routes/PushTestRouteOwner.ts` | 5 | 1 | 4 |
| `apps/ServerApplication/Source/Network/Routes/RuntimeRoutes.ts` | 7 | 3 | 4 |
| `apps/ServerApplication/Source/Network/Routes/ThreadCollectionListQueryOwner.ts` | 56 | 7 | 49 |
| `apps/ServerApplication/Source/Network/Routes/ThreadCollectionRouteContracts.ts` | 9 | 0 | 9 |
| `apps/ServerApplication/Source/Network/Routes/ThreadCollectionRoutes.ts` | 14 | 10 | 4 |
| `apps/ServerApplication/Source/Network/Routes/ThreadMemberArchiveMutationRouteOwner.ts` | 14 | 11 | 3 |
| `apps/ServerApplication/Source/Network/Routes/ThreadMemberInteractionMutationRouteOwner.ts` | 33 | 22 | 11 |
| `apps/ServerApplication/Source/Network/Routes/ThreadMemberMessageMutationRouteOwner.ts` | 13 | 10 | 3 |
| `apps/ServerApplication/Source/Network/Routes/ThreadMemberMutationRouteOwner.ts` | 18 | 17 | 1 |
| `apps/ServerApplication/Source/Network/Routes/ThreadMemberReadRouteOwner.ts` | 9 | 4 | 5 |
| `apps/ServerApplication/Source/Network/Routes/ThreadMemberRouteContracts.ts` | 27 | 0 | 27 |
| `apps/ServerApplication/Source/Network/Routes/ThreadMemberRoutes.ts` | 8 | 3 | 5 |
| `apps/ServerApplication/Source/Network/Routes/ThreadRoutes.ts` | 12 | 3 | 9 |
| `apps/ServerApplication/Source/Network/ServerErrorEventRecorder.ts` | 39 | 26 | 13 |
| `apps/ServerApplication/Source/Network/ServerObservabilitySnapshotOwner.ts` | 4 | 1 | 3 |
| `apps/ServerApplication/Source/Network/ServerRequestErrorResponder.ts` | 14 | 8 | 6 |
| `apps/ServerApplication/Source/Network/ServerRequestHandler.ts` | 40 | 14 | 26 |
| `apps/ServerApplication/Source/Network/ServerRequestUtilityOwner.ts` | 23 | 28 | -5 |
| `apps/ServerApplication/Source/Network/ServerTransportErrorClassifier.ts` | 9 | 4 | 5 |
| `apps/ServerApplication/Source/Network/ThreadConcurrencyCoordinator.ts` | 11 | 4 | 7 |
| `apps/ServerApplication/Source/Network/ThreadListAggregationCache.ts` | 7 | 1 | 6 |
| `apps/ServerApplication/Source/Network/ThreadStreamDeltaEventPublisher.ts` | 44 | 1 | 43 |
| `apps/ServerApplication/Source/Shared/Logging/Logger.ts` | 12 | 5 | 7 |
| `apps/ServerApplication/Tests/ActivityHistoryService.test.ts` | 1 | 1 | 0 |
| `apps/ServerApplication/Tests/AgentRegistry.test.ts` | 155 | 0 | 155 |
| `apps/ServerApplication/Tests/AgentRuntimeOwner.test.ts` | 25 | 6 | 19 |
| `apps/ServerApplication/Tests/BrowserSessionAuthOwner.test.ts` | 37 | 0 | 37 |
| `apps/ServerApplication/Tests/CliOptions.test.ts` | 17 | 0 | 17 |
| `apps/ServerApplication/Tests/ClientErrorStore.test.ts` | 12 | 1 | 11 |
| `apps/ServerApplication/Tests/CodexConnectionLifecycleOwner.test.ts` | 16 | 0 | 16 |
| `apps/ServerApplication/Tests/CodexThreadManagementOwner.test.ts` | 208 | 0 | 208 |
| `apps/ServerApplication/Tests/CodexThreadStreamStateOwner.test.ts` | 57 | 12 | 45 |
| `apps/ServerApplication/Tests/CompletionDetector.test.ts` | 95 | 0 | 95 |
| `apps/ServerApplication/Tests/DebugFileDownload.test.ts` | 62 | 0 | 62 |
| `apps/ServerApplication/Tests/DebugReplayFrameParser.test.ts` | 46 | 0 | 46 |
| `apps/ServerApplication/Tests/EventLoopLagObservabilityOwner.test.ts` | 41 | 0 | 41 |
| `apps/ServerApplication/Tests/EventStreamClientRegistry.test.ts` | 100 | 0 | 100 |
| `apps/ServerApplication/Tests/HttpRoutesAuthentication.integration.test.ts` | 15 | 16 | -1 |
| `apps/ServerApplication/Tests/HttpRoutesDebug.integration.test.ts` | 40 | 17 | 23 |
| `apps/ServerApplication/Tests/HttpRoutesIntegrationEnvironment.ts` | 143 | 36 | 107 |
| `apps/ServerApplication/Tests/HttpRoutesPush.integration.test.ts` | 44 | 28 | 16 |
| `apps/ServerApplication/Tests/HttpSchemas.test.ts` | 39 | 12 | 27 |
| `apps/ServerApplication/Tests/Logger.test.ts` | 46 | 0 | 46 |
| `apps/ServerApplication/Tests/NtfyNotifier.test.ts` | 7 | 8 | -1 |
| `apps/ServerApplication/Tests/PushDispatchConcurrencyCoordinator.test.ts` | 49 | 0 | 49 |
| `apps/ServerApplication/Tests/PushMutationConcurrencyCoordinator.test.ts` | 21 | 0 | 21 |
| `apps/ServerApplication/Tests/PushReceiptStore.test.ts` | 2 | 2 | 0 |
| `apps/ServerApplication/Tests/PushRoutes.test.ts` | 51 | 11 | 40 |
| `apps/ServerApplication/Tests/PushSendStore.test.ts` | 30 | 0 | 30 |
| `apps/ServerApplication/Tests/PushService.test.ts` | 30 | 0 | 30 |
| `apps/ServerApplication/Tests/PushStatePath.test.ts` | 30 | 0 | 30 |
| `apps/ServerApplication/Tests/PushStore.test.ts` | 60 | 0 | 60 |
| `apps/ServerApplication/Tests/PushTestPayloadOwner.test.ts` | 18 | 0 | 18 |
| `apps/ServerApplication/Tests/PushTestRouteOwner.test.ts` | 19 | 42 | -23 |
| `apps/ServerApplication/Tests/RequestObservabilityOwner.test.ts` | 188 | 0 | 188 |
| `apps/ServerApplication/Tests/RequestPathContracts.test.ts` | 51 | 0 | 51 |
| `apps/ServerApplication/Tests/RuntimeStateOwner.test.ts` | 103 | 24 | 79 |
| `apps/ServerApplication/Tests/ServerBootstrapUtilityOwner.test.ts` | 51 | 0 | 51 |
| `apps/ServerApplication/Tests/ServerErrorEventRecorder.test.ts` | 29 | 1 | 28 |
| `apps/ServerApplication/Tests/ServerLifecycleCoordinator.test.ts` | 29 | 5 | 24 |
| `apps/ServerApplication/Tests/ServerObservabilitySnapshotOwner.test.ts` | 3 | 2 | 1 |
| `apps/ServerApplication/Tests/ServerRequestErrorResponder.test.ts` | 21 | 0 | 21 |
| `apps/ServerApplication/Tests/ServerRequestHandler.test.ts` | 276 | 0 | 276 |
| `apps/ServerApplication/Tests/ServerRequestUtilityOwner.test.ts` | 14 | 0 | 14 |
| `apps/ServerApplication/Tests/ServerRuntimeConfiguration.test.ts` | 35 | 0 | 35 |
| `apps/ServerApplication/Tests/ServerTransportErrorClassifier.test.ts` | 19 | 0 | 19 |
| `apps/ServerApplication/Tests/ThreadAdapterResolver.test.ts` | 17 | 0 | 17 |
| `apps/ServerApplication/Tests/ThreadCollectionRoutes.test.ts` | 95 | 0 | 95 |
| `apps/ServerApplication/Tests/ThreadCompletionNotificationService.test.ts` | 140 | 1 | 139 |
| `apps/ServerApplication/Tests/ThreadConcurrencyCoordinator.test.ts` | 8 | 0 | 8 |
| `apps/ServerApplication/Tests/ThreadIndex.test.ts` | 44 | 0 | 44 |
| `apps/ServerApplication/Tests/ThreadListAggregationCache.test.ts` | 31 | 0 | 31 |
| `apps/ServerApplication/Tests/ThreadListCacheInvalidationOwner.test.ts` | 86 | 0 | 86 |
| `apps/ServerApplication/Tests/ThreadMemberMutationRouteOwner.test.ts` | 262 | 0 | 262 |
| `apps/ServerApplication/Tests/ThreadMemberReadRouteOwner.test.ts` | 35 | 9 | 26 |
| `apps/ServerApplication/Tests/ThreadMemberRoutes.integration.test.ts` | 177 | 145 | 32 |
| `apps/ServerApplication/Tests/ThreadOwner.test.ts` | 25 | 0 | 25 |
| `apps/ServerApplication/Tests/ThreadRoutes.test.ts` | 158 | 0 | 158 |
| `apps/ServerApplication/Tests/ThreadStreamDeltaEventPublisher.test.ts` | 65 | 0 | 65 |
| `apps/ServerApplication/Tests/ThreadStreamStateChangedHistoryBatchOwner.test.ts` | 86 | 0 | 86 |
| `apps/ServerApplication/package.json` | 4 | 2 | 2 |
| `apps/ServerApplication/tsconfig.json` | 3 | 1 | 2 |
| `apps/ServerApplication/vitest.config.ts` | 1 | 0 | 1 |
| `apps/WebApplication/Source/App.tsx` | 5 | 0 | 5 |
| `apps/WebApplication/Source/Application/Boot/InstallClientErrorReporter.ts` | 32 | 38 | -6 |
| `apps/WebApplication/Source/Application/Boot/ServiceWorkerControllerChangeReloadOwner.ts` | 61 | 11 | 50 |
| `apps/WebApplication/Source/Application/Configuration/ApplicationBehaviorConfiguration.ts` | 4 | 2 | 2 |
| `apps/WebApplication/Source/Application/DataAccess/WebShellApi.ts` | 27 | 13 | 14 |
| `apps/WebApplication/Source/Application/DomainModel/ApiAuthenticationErrorClassifier.ts` | 6 | 1 | 5 |
| `apps/WebApplication/Source/Application/DomainModel/ApplicationRouteStateMapper.ts` | 41 | 17 | 24 |
| `apps/WebApplication/Source/Application/DomainModel/DateValueFormatter.ts` | 36 | 2 | 34 |
| `apps/WebApplication/Source/Application/StateManagement/ApiSessionBootstrapCoordinator.ts` | 2 | 1 | 1 |
| `apps/WebApplication/Source/Application/StateManagement/CoreDataRefreshConcurrencyCoordinator.ts` | 24 | 8 | 16 |
| `apps/WebApplication/Source/Application/StateManagement/CoreDataSnapshotContracts.ts` | 46 | 0 | 46 |
| `apps/WebApplication/Source/Application/StateManagement/CoreDataSnapshotStateApplier.ts` | 172 | 106 | 66 |
| `apps/WebApplication/Source/Application/StateManagement/CoreDataStartupRequestProfile.ts` | 26 | 4 | 22 |
| `apps/WebApplication/Source/Application/StateManagement/EventRefreshScheduler.ts` | 58 | 26 | 32 |
| `apps/WebApplication/Source/Application/StateManagement/EventStreamConnectionCoordinator.ts` | 48 | 17 | 31 |
| `apps/WebApplication/Source/Application/StateManagement/EventStreamRefreshDecisionEngine.ts` | 22 | 9 | 13 |
| `apps/WebApplication/Source/Application/StateManagement/MobileSidebarSwipeCoordinator.ts` | 100 | 27 | 73 |
| `apps/WebApplication/Source/Application/StateManagement/PageTouchOverscrollGuardCoordinator.ts` | 9 | 4 | 5 |
| `apps/WebApplication/Source/Application/StateManagement/RuntimeRefreshObservabilityOwner.ts` | 20 | 5 | 15 |
| `apps/WebApplication/Source/Application/StateManagement/RuntimeViewportSizingCoordinator.ts` | 5 | 2 | 3 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationArchivedThreadState.ts` | 40 | 12 | 28 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationChatFeatureComposition.ts` | 39 | 5 | 34 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationDebugFeatureComposition.ts` | 2 | 0 | 2 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationDerivedState.ts` | 222 | 77 | 145 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationDerivedStateContracts.ts` | 8 | 3 | 5 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationOwnerDependencies.ts` | 121 | 50 | 71 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationPresentationHelpers.tsx` | 28 | 11 | 17 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationPushFeatureComposition.ts` | 5 | 2 | 3 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationPushState.ts` | 26 | 6 | 20 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationRefreshEffects.ts` | 31 | 12 | 19 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationRuntimeComposition.ts` | 14 | 4 | 10 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationRuntimeRequestHandlers.ts` | 6 | 4 | 2 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationShellComposition.ts` | 20 | 56 | -36 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationShellState.ts` | 1 | 1 | 0 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationShellStateContracts.ts` | 96 | 83 | 13 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationShellViewProperties.ts` | 164 | 214 | -50 |
| `apps/WebApplication/Source/Application/StateManagement/UseApplicationSynchronizationEffects.ts` | 6 | 0 | 6 |
| `apps/WebApplication/Source/Application/StateManagement/UseCoreDataLoaders.ts` | 292 | 180 | 112 |
| `apps/WebApplication/Source/Application/StateManagement/UseEventStreamEffects.ts` | 23 | 7 | 16 |
| `apps/WebApplication/Source/Application/StateManagement/UseMobileSidebarTouchHandlers.ts` | 7 | 2 | 5 |
| `apps/WebApplication/Source/Application/StateManagement/UseViewportShellEffects.ts` | 35 | 21 | 14 |
| `apps/WebApplication/Source/Application/StateManagement/UserInterfaceActionRequestBuilder.ts` | 18 | 2 | 16 |
| `apps/WebApplication/Source/Application/UserInterface/AgentFavicon.tsx` | 2 | 14 | -12 |
| `apps/WebApplication/Source/Application/UserInterface/ApiSessionBootstrapOverlay.tsx` | 7 | 1 | 6 |
| `apps/WebApplication/Source/Application/UserInterface/ApplicationHeaderBar.tsx` | 47 | 27 | 20 |
| `apps/WebApplication/Source/Application/UserInterface/ApplicationShellLayout.tsx` | 14 | 18 | -4 |
| `apps/WebApplication/Source/Components/ChatComposer.tsx` | 32 | 9 | 23 |
| `apps/WebApplication/Source/Components/CodeSnippet.tsx` | 21 | 11 | 10 |
| `apps/WebApplication/Source/Components/CommandBlock.tsx` | 11 | 5 | 6 |
| `apps/WebApplication/Source/Components/ConversationItem.tsx` | 16 | 5 | 11 |
| `apps/WebApplication/Source/Components/DiffBlock.tsx` | 134 | 39 | 95 |
| `apps/WebApplication/Source/Components/MarkdownText.tsx` | 32 | 12 | 20 |
| `apps/WebApplication/Source/Components/PendingRequestCard.tsx` | 55 | 32 | 23 |
| `apps/WebApplication/Source/Components/PlanPanel.tsx` | 27 | 18 | 9 |
| `apps/WebApplication/Source/Components/ReasoningBlock.tsx` | 25 | 8 | 17 |
| `apps/WebApplication/Source/Components/StreamEventCard.tsx` | 20 | 20 | 0 |
| `apps/WebApplication/Source/Components/UserInterface/Badge.tsx` | 4 | 0 | 4 |
| `apps/WebApplication/Source/Components/UserInterface/Button.tsx` | 8 | 2 | 6 |
| `apps/WebApplication/Source/Components/UserInterface/Card.tsx` | 8 | 3 | 5 |
| `apps/WebApplication/Source/Components/UserInterface/CardContent.tsx` | 8 | 3 | 5 |
| `apps/WebApplication/Source/Components/UserInterface/CardDescription.tsx` | 11 | 7 | 4 |
| `apps/WebApplication/Source/Components/UserInterface/CardHeader.tsx` | 8 | 3 | 5 |
| `apps/WebApplication/Source/Components/UserInterface/CardTitle.tsx` | 8 | 3 | 5 |
| `apps/WebApplication/Source/Components/UserInterface/Checkbox.tsx` | 3 | 1 | 2 |
| `apps/WebApplication/Source/Components/UserInterface/DropdownMenu.tsx` | 39 | 3 | 36 |
| `apps/WebApplication/Source/Components/UserInterface/Input.tsx` | 11 | 4 | 7 |
| `apps/WebApplication/Source/Components/UserInterface/Label.tsx` | 2 | 1 | 1 |
| `apps/WebApplication/Source/Components/UserInterface/RadioGroup.tsx` | 5 | 2 | 3 |
| `apps/WebApplication/Source/Components/UserInterface/ScrollArea.tsx` | 3 | 1 | 2 |
| `apps/WebApplication/Source/Components/UserInterface/Select.tsx` | 45 | 7 | 38 |
| `apps/WebApplication/Source/Components/UserInterface/Tabs.tsx` | 11 | 1 | 10 |
| `apps/WebApplication/Source/Components/UserInterface/TabsContent.tsx` | 3 | 1 | 2 |
| `apps/WebApplication/Source/Components/UserInterface/TabsList.tsx` | 3 | 1 | 2 |
| `apps/WebApplication/Source/Components/UserInterface/TabsTrigger.tsx` | 3 | 1 | 2 |
| `apps/WebApplication/Source/Components/UserInterface/Textarea.tsx` | 9 | 3 | 6 |
| `apps/WebApplication/Source/Components/UserInterface/Tooltip.tsx` | 14 | 2 | 12 |
| `apps/WebApplication/Source/Features/Capabilities/DataAccess/CapabilityApi.ts` | 24 | 13 | 11 |
| `apps/WebApplication/Source/Features/Capabilities/DataAccess/CapabilityServerClient.ts` | 9 | 6 | 3 |
| `apps/WebApplication/Source/Features/Capabilities/DataAccess/CapabilitySnapshotCache.ts` | 41 | 6 | 35 |
| `apps/WebApplication/Source/Features/Chat/DataAccess/ChatApi.ts` | 152 | 116 | 36 |
| `apps/WebApplication/Source/Features/Chat/DataAccess/ChatServerClient.ts` | 11 | 8 | 3 |
| `apps/WebApplication/Source/Features/Chat/DomainModel/ConversationItemFlattener.ts` | 14 | 4 | 10 |
| `apps/WebApplication/Source/Features/Chat/DomainModel/ConversationSyncSignatureBuilder.ts` | 7 | 22 | -15 |
| `apps/WebApplication/Source/Features/Chat/DomainModel/ModeSelectionStateResolver.ts` | 19 | 25 | -6 |
| `apps/WebApplication/Source/Features/Chat/DomainModel/PendingUserInputAnswerBuilder.ts` | 8 | 4 | 4 |
| `apps/WebApplication/Source/Features/Chat/DomainModel/PendingUserInputRequestSelector.ts` | 4 | 10 | -6 |
| `apps/WebApplication/Source/Features/Chat/DomainModel/ReadThreadErrorClassifier.ts` | 9 | 6 | 3 |
| `apps/WebApplication/Source/Features/Chat/StateManagement/ChatRequestActionCoordinator.ts` | 15 | 9 | 6 |
| `apps/WebApplication/Source/Features/Chat/StateManagement/ChatScrollStateCoordinator.ts` | 2 | 1 | 1 |
| `apps/WebApplication/Source/Features/Chat/StateManagement/CollaborationModeActionCoordinator.ts` | 4 | 2 | 2 |
| `apps/WebApplication/Source/Features/Chat/StateManagement/ModeSelectionSyncCoordinator.ts` | 61 | 39 | 22 |
| `apps/WebApplication/Source/Features/Chat/StateManagement/ReadThreadStateMerger.ts` | 12 | 12 | 0 |
| `apps/WebApplication/Source/Features/Chat/StateManagement/SelectedThreadDataRefreshCoordinator.ts` | 30 | 27 | 3 |
| `apps/WebApplication/Source/Features/Chat/StateManagement/SelectedThreadRefreshConcurrencyCoordinator.ts` | 7 | 6 | 1 |
| `apps/WebApplication/Source/Features/Chat/StateManagement/UseChatActionHandlers.ts` | 8 | 4 | 4 |
| `apps/WebApplication/Source/Features/Chat/StateManagement/UseChatModeToolbarProperties.ts` | 10 | 14 | -4 |
| `apps/WebApplication/Source/Features/Chat/StateManagement/UseChatScrollEffects.ts` | 61 | 45 | 16 |
| `apps/WebApplication/Source/Features/Chat/StateManagement/UseModeAndPendingRequestEffects.ts` | 13 | 6 | 7 |
| `apps/WebApplication/Source/Features/Chat/StateManagement/UseSelectedThreadLifecycleEffects.ts` | 3 | 0 | 3 |
| `apps/WebApplication/Source/Features/Chat/StateManagement/UseSelectedThreadLoaders.ts` | 65 | 11 | 54 |
| `apps/WebApplication/Source/Features/Chat/UserInterface/ChatModeToolbar.tsx` | 33 | 13 | 20 |
| `apps/WebApplication/Source/Features/Chat/UserInterface/ChatModeToolbarPropertiesBuilder.ts` | 34 | 18 | 16 |
| `apps/WebApplication/Source/Features/Chat/UserInterface/ChatWorkspacePane.tsx` | 53 | 17 | 36 |
| `apps/WebApplication/Source/Features/Debugging/DataAccess/ClientErrorReporter.ts` | 1 | 3 | -2 |
| `apps/WebApplication/Source/Features/Debugging/DataAccess/DebugApi.ts` | 63 | 25 | 38 |
| `apps/WebApplication/Source/Features/Debugging/DataAccess/DebugServerClient.ts` | 3 | 2 | 1 |
| `apps/WebApplication/Source/Features/Debugging/DomainModel/DebugIssueContracts.ts` | 7 | 1 | 6 |
| `apps/WebApplication/Source/Features/Debugging/DomainModel/DebugIssueDerivation.ts` | 31 | 32 | -1 |
| `apps/WebApplication/Source/Features/Debugging/DomainModel/DebugIssueIdentifier.ts` | 5 | 0 | 5 |
| `apps/WebApplication/Source/Features/Debugging/DomainModel/DebugIssueStateResolver.ts` | 21 | 5 | 16 |
| `apps/WebApplication/Source/Features/Debugging/DomainModel/DebugWorkspaceSectionContracts.ts` | 4 | 0 | 4 |
| `apps/WebApplication/Source/Features/Debugging/DomainModel/ErrorBannerDetailsParser.ts` | 49 | 17 | 32 |
| `apps/WebApplication/Source/Features/Debugging/StateManagement/DebugWorkspaceActionCoordinator.ts` | 5 | 2 | 3 |
| `apps/WebApplication/Source/Features/Debugging/StateManagement/DebugWorkspaceDataReader.ts` | 3 | 1 | 2 |
| `apps/WebApplication/Source/Features/Debugging/StateManagement/DebugWorkspaceStateStore.ts` | 33 | 4 | 29 |
| `apps/WebApplication/Source/Features/Debugging/StateManagement/TrackedUserInterfaceErrorPolicy.ts` | 12 | 5 | 7 |
| `apps/WebApplication/Source/Features/Debugging/StateManagement/TrackedUserInterfaceErrorReporter.ts` | 37 | 15 | 22 |
| `apps/WebApplication/Source/Features/Debugging/StateManagement/UseDebugActionHandlers.ts` | 30 | 11 | 19 |
| `apps/WebApplication/Source/Features/Debugging/UserInterface/DebugHistoryDetailPanel.tsx` | 5 | 3 | 2 |
| `apps/WebApplication/Source/Features/Debugging/UserInterface/DebugHistoryPanel.tsx` | 8 | 5 | 3 |
| `apps/WebApplication/Source/Features/Debugging/UserInterface/DebugIssuesPanel.tsx` | 30 | 29 | 1 |
| `apps/WebApplication/Source/Features/Debugging/UserInterface/DebugStatusBanners.tsx` | 5 | 2 | 3 |
| `apps/WebApplication/Source/Features/Debugging/UserInterface/DebugStreamEventsPanel.tsx` | 3 | 1 | 2 |
| `apps/WebApplication/Source/Features/Debugging/UserInterface/DebugTracePanel.tsx` | 4 | 1 | 3 |
| `apps/WebApplication/Source/Features/Debugging/UserInterface/DebugWorkspacePane.tsx` | 2 | 5 | -3 |
| `apps/WebApplication/Source/Features/PushNotifications/DataAccess/PushApi.ts` | 88 | 51 | 37 |
| `apps/WebApplication/Source/Features/PushNotifications/DataAccess/PushClientApi.ts` | 18 | 11 | 7 |
| `apps/WebApplication/Source/Features/PushNotifications/DataAccess/PushClientStateManager.ts` | 69 | 36 | 33 |
| `apps/WebApplication/Source/Features/PushNotifications/DataAccess/PushPreferenceStore.ts` | 12 | 4 | 8 |
| `apps/WebApplication/Source/Features/PushNotifications/DataAccess/PushServerClient.ts` | 30 | 17 | 13 |
| `apps/WebApplication/Source/Features/PushNotifications/DomainModel/PushClientContracts.ts` | 44 | 1 | 43 |
| `apps/WebApplication/Source/Features/PushNotifications/StateManagement/PushNotificationToolbarActionCoordinator.ts` | 5 | 1 | 4 |
| `apps/WebApplication/Source/Features/PushNotifications/UserInterface/PushStatusButton.tsx` | 62 | 40 | 22 |
| `apps/WebApplication/Source/Features/Theme/DataAccess/ThemePreferenceStore.ts` | 2 | 1 | 1 |
| `apps/WebApplication/Source/Features/Theme/StateManagement/UseTheme.ts` | 5 | 2 | 3 |
| `apps/WebApplication/Source/Features/Threads/DataAccess/ThreadApi.ts` | 80 | 32 | 48 |
| `apps/WebApplication/Source/Features/Threads/DataAccess/ThreadMutationServerClient.ts` | 15 | 2 | 13 |
| `apps/WebApplication/Source/Features/Threads/DataAccess/ThreadQueryCache.ts` | 24 | 5 | 19 |
| `apps/WebApplication/Source/Features/Threads/DataAccess/ThreadServerClient.ts` | 10 | 8 | 2 |
| `apps/WebApplication/Source/Features/Threads/DomainModel/ThreadGroupSelectors.ts` | 53 | 27 | 26 |
| `apps/WebApplication/Source/Features/Threads/DomainModel/ThreadGroupTypes.ts` | 2 | 0 | 2 |
| `apps/WebApplication/Source/Features/Threads/DomainModel/ThreadListSearchFilter.ts` | 17 | 30 | -13 |
| `apps/WebApplication/Source/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator.ts` | 4 | 0 | 4 |
| `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListPresentationStateResolver.ts` | 24 | 11 | 13 |
| `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListStateController.ts` | 41 | 22 | 19 |
| `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListStateStore.ts` | 22 | 10 | 12 |
| `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadMutationActionCoordinator.ts` | 39 | 16 | 23 |
| `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadRefreshConcurrencyCoordinator.ts` | 14 | 3 | 11 |
| `apps/WebApplication/Source/Features/Threads/StateManagement/UseThreadActionHandlers.ts` | 7 | 8 | -1 |
| `apps/WebApplication/Source/Features/Threads/StateManagement/UseThreadListPaneProperties.ts` | 1 | 1 | 0 |
| `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadListActiveSection.tsx` | 12 | 4 | 8 |
| `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadListArchivedSection.tsx` | 7 | 2 | 5 |
| `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadListEmptyState.tsx` | 9 | 3 | 6 |
| `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadListPane.tsx` | 31 | 16 | 15 |
| `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadListPaneContracts.ts` | 33 | 17 | 16 |
| `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadListUserInterfaceConstants.ts` | 10 | 0 | 10 |
| `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadSidebarPanel.tsx` | 49 | 11 | 38 |
| `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadSidebarViewport.tsx` | 18 | 4 | 14 |
| `apps/WebApplication/Source/Index.css` | 3 | 0 | 3 |
| `apps/WebApplication/Source/Main.tsx` | 3 | 15 | -12 |
| `apps/WebApplication/Source/Shared/Contracts/ApiContracts.ts` | 17 | 3 | 14 |
| `apps/WebApplication/Source/Shared/Contracts/RequestMetadataContracts.ts` | 29 | 0 | 29 |
| `apps/WebApplication/Source/Shared/Contracts/StructuredDataValue.ts` | 15 | 4 | 11 |
| `apps/WebApplication/Source/Shared/Errors/ErrorMessage.ts` | 3 | 0 | 3 |
| `apps/WebApplication/Source/Shared/Errors/RequestCanceledError.ts` | 4 | 1 | 3 |
| `apps/WebApplication/Source/Shared/Errors/RuntimeRequestErrorDescriptor.ts` | 58 | 16 | 42 |
| `apps/WebApplication/Source/Shared/Styling/ClassNameMerge.ts` | 6 | 1 | 5 |
| `apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransport.ts` | 59 | 35 | 24 |
| `apps/WebApplication/Tests/AgentFavicon.test.tsx` | 33 | 0 | 33 |
| `apps/WebApplication/Tests/Api.test.ts` | 36 | 0 | 36 |
| `apps/WebApplication/Tests/ApiAuthenticationErrorClassifier.test.ts` | 18 | 0 | 18 |
| `apps/WebApplication/Tests/ApiContracts.test.ts` | 39 | 0 | 39 |
| `apps/WebApplication/Tests/ApiSessionBootstrapCoordinator.test.ts` | 43 | 0 | 43 |
| `apps/WebApplication/Tests/AppSessionAndDebug.test.tsx` | 115 | 77 | 38 |
| `apps/WebApplication/Tests/AppShellBehavior.test.tsx` | 33 | 9 | 24 |
| `apps/WebApplication/Tests/AppTestEnvironment.tsx` | 16 | 3 | 13 |
| `apps/WebApplication/Tests/AppTestFixtureContracts.ts` | 15 | 2 | 13 |
| `apps/WebApplication/Tests/AppThreadRefreshBehavior.test.tsx` | 21 | 16 | 5 |
| `apps/WebApplication/Tests/ApplicationHeaderBar.test.tsx` | 48 | 10 | 38 |
| `apps/WebApplication/Tests/ApplicationRouteStateMapper.test.ts` | 22 | 2 | 20 |
| `apps/WebApplication/Tests/ApplicationRuntimeComposition.test.tsx` | 67 | 1 | 66 |
| `apps/WebApplication/Tests/CapabilityServerClient.test.ts` | 155 | 0 | 155 |
| `apps/WebApplication/Tests/CapabilitySnapshotCache.test.ts` | 32 | 0 | 32 |
| `apps/WebApplication/Tests/ChatApi.test.ts` | 122 | 0 | 122 |
| `apps/WebApplication/Tests/ChatComposer.test.tsx` | 82 | 0 | 82 |
| `apps/WebApplication/Tests/ChatModeToolbar.test.tsx` | 72 | 15 | 57 |
| `apps/WebApplication/Tests/ChatModeToolbarPropertiesBuilder.test.ts` | 111 | 0 | 111 |
| `apps/WebApplication/Tests/ChatRequestActionCoordinator.test.ts` | 213 | 83 | 130 |
| `apps/WebApplication/Tests/ChatScrollStateCoordinator.test.ts` | 12 | 0 | 12 |
| `apps/WebApplication/Tests/ChatServerClient.test.ts` | 140 | 0 | 140 |
| `apps/WebApplication/Tests/ChatWorkspacePane.test.tsx` | 13 | 0 | 13 |
| `apps/WebApplication/Tests/ClientErrors.test.ts` | 21 | 0 | 21 |
| `apps/WebApplication/Tests/CodeSnippet.test.tsx` | 85 | 0 | 85 |
| `apps/WebApplication/Tests/CollaborationModeActionCoordinator.test.ts` | 131 | 42 | 89 |
| `apps/WebApplication/Tests/CommandBlock.test.tsx` | 51 | 0 | 51 |
| `apps/WebApplication/Tests/ConversationItem.test.tsx` | 67 | 0 | 67 |
| `apps/WebApplication/Tests/ConversationItemFlattener.test.ts` | 20 | 0 | 20 |
| `apps/WebApplication/Tests/ConversationSyncSignatureBuilder.test.ts` | 62 | 84 | -22 |
| `apps/WebApplication/Tests/CoreDataRefreshConcurrencyCoordinator.test.ts` | 88 | 0 | 88 |
| `apps/WebApplication/Tests/CoreDataSnapshotStateApplier.test.ts` | 181 | 0 | 181 |
| `apps/WebApplication/Tests/CoreDataStartupRequestProfile.test.ts` | 16 | 1 | 15 |
| `apps/WebApplication/Tests/DateValueFormatter.test.ts` | 31 | 0 | 31 |
| `apps/WebApplication/Tests/DebugApi.test.ts` | 101 | 0 | 101 |
| `apps/WebApplication/Tests/DebugHistoryDetailPanel.test.tsx` | 50 | 0 | 50 |
| `apps/WebApplication/Tests/DebugIssueIdentifier.test.ts` | 8 | 0 | 8 |
| `apps/WebApplication/Tests/DebugIssueStateResolver.test.ts` | 29 | 0 | 29 |
| `apps/WebApplication/Tests/DebugIssuesPanel.test.tsx` | 93 | 0 | 93 |
| `apps/WebApplication/Tests/DebugStatusBanners.test.tsx` | 22 | 0 | 22 |
| `apps/WebApplication/Tests/DebugWorkspaceActionCoordinator.test.ts` | 22 | 0 | 22 |
| `apps/WebApplication/Tests/DebugWorkspaceDataReader.test.ts` | 63 | 9 | 54 |
| `apps/WebApplication/Tests/DebugWorkspacePane.test.tsx` | 17 | 0 | 17 |
| `apps/WebApplication/Tests/DebugWorkspaceSectionContracts.test.ts` | 15 | 0 | 15 |
| `apps/WebApplication/Tests/DebugWorkspaceStateStore.test.ts` | 16 | 0 | 16 |
| `apps/WebApplication/Tests/DiffBlock.test.tsx` | 61 | 0 | 61 |
| `apps/WebApplication/Tests/ErrorBannerDetailsParser.test.ts` | 46 | 0 | 46 |
| `apps/WebApplication/Tests/EventRefreshScheduler.test.ts` | 21 | 0 | 21 |
| `apps/WebApplication/Tests/EventStreamConnectionCoordinator.test.ts` | 23 | 0 | 23 |
| `apps/WebApplication/Tests/EventStreamRefreshDecisionEngine.test.ts` | 36 | 0 | 36 |
| `apps/WebApplication/Tests/FarfieldHttpTransport.test.ts` | 67 | 1 | 66 |
| `apps/WebApplication/Tests/MarkdownText.test.tsx` | 75 | 0 | 75 |
| `apps/WebApplication/Tests/MobileSidebarSwipeCoordinator.test.ts` | 109 | 0 | 109 |
| `apps/WebApplication/Tests/ModeSelectionStateResolver.test.ts` | 70 | 26 | 44 |
| `apps/WebApplication/Tests/ModeSelectionSyncCoordinator.test.ts` | 105 | 45 | 60 |
| `apps/WebApplication/Tests/PageTouchOverscrollGuardCoordinator.test.ts` | 41 | 6 | 35 |
| `apps/WebApplication/Tests/PendingRequestCard.test.tsx` | 102 | 0 | 102 |
| `apps/WebApplication/Tests/PendingUserInputAnswerBuilder.test.ts` | 31 | 15 | 16 |
| `apps/WebApplication/Tests/PendingUserInputRequestSelector.test.ts` | 64 | 0 | 64 |
| `apps/WebApplication/Tests/PlanPanel.test.tsx` | 72 | 0 | 72 |
| `apps/WebApplication/Tests/Push.test.ts` | 8 | 3 | 5 |
| `apps/WebApplication/Tests/PushApi.test.ts` | 103 | 0 | 103 |
| `apps/WebApplication/Tests/PushNotificationToolbarActionCoordinator.test.ts` | 93 | 56 | 37 |
| `apps/WebApplication/Tests/PushPreferenceStore.test.ts` | 53 | 9 | 44 |
| `apps/WebApplication/Tests/PushServerClient.test.ts` | 161 | 0 | 161 |
| `apps/WebApplication/Tests/PushStatusButton.test.tsx` | 37 | 0 | 37 |
| `apps/WebApplication/Tests/ReadThreadErrorClassifier.test.ts` | 19 | 0 | 19 |
| `apps/WebApplication/Tests/ReadThreadStateMerger.test.ts` | 38 | 0 | 38 |
| `apps/WebApplication/Tests/ReasoningBlock.test.tsx` | 76 | 0 | 76 |
| `apps/WebApplication/Tests/RuntimeRefreshObservabilityOwner.test.ts` | 62 | 17 | 45 |
| `apps/WebApplication/Tests/RuntimeRequestErrorDescriptor.test.ts` | 44 | 0 | 44 |
| `apps/WebApplication/Tests/RuntimeViewportSizingCoordinator.test.ts` | 14 | 0 | 14 |
| `apps/WebApplication/Tests/SelectedThreadDataRefreshCoordinator.test.ts` | 57 | 0 | 57 |
| `apps/WebApplication/Tests/SelectedThreadRefreshConcurrencyCoordinator.test.ts` | 25 | 0 | 25 |
| `apps/WebApplication/Tests/ServiceWorker.test.ts` | 62 | 0 | 62 |
| `apps/WebApplication/Tests/ServiceWorkerControllerChangeReloadOwner.test.ts` | 41 | 0 | 41 |
| `apps/WebApplication/Tests/StreamEventCard.test.tsx` | 83 | 0 | 83 |
| `apps/WebApplication/Tests/ThemePreferenceStore.test.ts` | 48 | 9 | 39 |
| `apps/WebApplication/Tests/ThreadApi.test.ts` | 140 | 0 | 140 |
| `apps/WebApplication/Tests/ThreadListPane.test.tsx` | 15 | 1 | 14 |
| `apps/WebApplication/Tests/ThreadListPresentationStateResolver.test.ts` | 3 | 3 | 0 |
| `apps/WebApplication/Tests/ThreadListSearchFilter.test.ts` | 139 | 0 | 139 |
| `apps/WebApplication/Tests/ThreadListStateStore.test.ts` | 56 | 0 | 56 |
| `apps/WebApplication/Tests/ThreadMutationActionCoordinator.test.ts` | 86 | 0 | 86 |
| `apps/WebApplication/Tests/ThreadMutationServerClient.test.ts` | 77 | 0 | 77 |
| `apps/WebApplication/Tests/ThreadOwnership.test.ts` | 153 | 0 | 153 |
| `apps/WebApplication/Tests/ThreadQueryCache.test.ts` | 59 | 0 | 59 |
| `apps/WebApplication/Tests/ThreadRefreshConcurrencyCoordinator.test.ts` | 65 | 0 | 65 |
| `apps/WebApplication/Tests/ThreadServerClient.test.ts` | 88 | 0 | 88 |
| `apps/WebApplication/Tests/ThreadSidebarPanel.test.tsx` | 25 | 3 | 22 |
| `apps/WebApplication/Tests/ThreadSidebarViewport.test.tsx` | 1 | 1 | 0 |
| `apps/WebApplication/Tests/TrackedUserInterfaceErrorPolicy.test.ts` | 42 | 0 | 42 |
| `apps/WebApplication/Tests/TrackedUserInterfaceErrorReporter.test.ts` | 45 | 0 | 45 |
| `apps/WebApplication/Tests/UseApplicationRefreshEffects.test.tsx` | 112 | 0 | 112 |
| `apps/WebApplication/Tests/UseApplicationShellState.test.tsx` | 55 | 0 | 55 |
| `apps/WebApplication/Tests/UseApplicationSynchronizationEffects.test.tsx` | 139 | 0 | 139 |
| `apps/WebApplication/Tests/UseChatModeToolbarProperties.test.tsx` | 116 | 0 | 116 |
| `apps/WebApplication/Tests/UseChatScrollEffects.test.tsx` | 286 | 0 | 286 |
| `apps/WebApplication/Tests/UseDebugActionHandlers.test.tsx` | 151 | 0 | 151 |
| `apps/WebApplication/Tests/UseEventStreamEffects.test.tsx` | 299 | 0 | 299 |
| `apps/WebApplication/Tests/UseMobileSidebarTouchHandlers.test.tsx` | 197 | 0 | 197 |
| `apps/WebApplication/Tests/UseSelectedThreadLifecycleEffects.test.tsx` | 170 | 0 | 170 |
| `apps/WebApplication/Tests/UseSelectedThreadLoaders.test.tsx` | 446 | 0 | 446 |
| `apps/WebApplication/Tests/UseViewportShellEffects.test.tsx` | 251 | 0 | 251 |
| `apps/WebApplication/Tests/UserInterfaceActionRequestBuilder.test.ts` | 14 | 0 | 14 |
| `apps/WebApplication/Tests/UserInterfacePrimitiveContracts.test.tsx` | 195 | 0 | 195 |
| `docs/debug/HardeningCoverageFileInventory.tsv` | 1834 | 0 | 1834 |
| `docs/debug/HardeningCoverageFolderInventory.tsv` | 97 | 0 | 97 |
| `docs/debug/HardeningCoverageGroupInventory.tsv` | 12 | 0 | 12 |
| `docs/debug/HardeningCoverageTracker.md` | 615 | 0 | 615 |
| `docs/debug/TemporarySubagentHardeningGuide.md` | 96 | 0 | 96 |
| `packages/CodexInterfaceAdapter/README.md` | 22 | 1 | 21 |
| `packages/CodexInterfaceAdapter/Source/AppServerClient.ts` | 34 | 28 | 6 |
| `packages/CodexInterfaceAdapter/Source/AppServerTransport.ts` | 60 | 25 | 35 |
| `packages/CodexInterfaceAdapter/Source/Errors.ts` | 28 | 4 | 24 |
| `packages/CodexInterfaceAdapter/Source/Index.ts` | 55 | 6 | 49 |
| `packages/CodexInterfaceAdapter/Source/IpcClient.ts` | 97 | 71 | 26 |
| `packages/CodexInterfaceAdapter/Source/IpcFrameBufferAccumulator.ts` | 19 | 4 | 15 |
| `packages/CodexInterfaceAdapter/Source/JsonRpc.ts` | 9 | 4 | 5 |
| `packages/CodexInterfaceAdapter/Source/LiveState.ts` | 22 | 37 | -15 |
| `packages/CodexInterfaceAdapter/Source/Service.ts` | 41 | 24 | 17 |
| `packages/CodexInterfaceAdapter/Tests/AppServerClient.test.ts` | 290 | 98 | 192 |
| `packages/CodexInterfaceAdapter/Tests/AppServerTransport.test.ts` | 30 | 1 | 29 |
| `packages/CodexInterfaceAdapter/Tests/Errors.test.ts` | 46 | 0 | 46 |
| `packages/CodexInterfaceAdapter/Tests/Index.test.ts` | 44 | 0 | 44 |
| `packages/CodexInterfaceAdapter/Tests/IpcClient.test.ts` | 446 | 110 | 336 |
| `packages/CodexInterfaceAdapter/Tests/IpcFrameBufferAccumulator.test.ts` | 111 | 0 | 111 |
| `packages/CodexInterfaceAdapter/Tests/JsonRpc.test.ts` | 26 | 0 | 26 |
| `packages/CodexInterfaceAdapter/Tests/LiveState.test.ts` | 119 | 0 | 119 |
| `packages/CodexInterfaceAdapter/Tests/Service.test.ts` | 175 | 31 | 144 |
| `packages/CodexInterfaceAdapter/package.json` | 4 | 1 | 3 |
| `packages/CodexInterfaceAdapter/tsconfig.json` | 2 | 1 | 1 |
| `packages/CodexInterfaceAdapter/vitest.config.ts` | 3 | 0 | 3 |
| `packages/CodexProtocol/Source/AppServer.ts` | 69 | 29 | 40 |
| `packages/CodexProtocol/Source/Common.ts` | 4 | 3 | 1 |
| `packages/CodexProtocol/Source/Contracts/Thread/CollaborationModeContracts.ts` | 4 | 3 | 1 |
| `packages/CodexProtocol/Source/Contracts/Thread/ConversationStateContracts.ts` | 12 | 5 | 7 |
| `packages/CodexProtocol/Source/Contracts/Thread/StreamStateContracts.ts` | 37 | 24 | 13 |
| `packages/CodexProtocol/Source/Contracts/Thread/TurnInputContracts.ts` | 10 | 4 | 6 |
| `packages/CodexProtocol/Source/Contracts/Thread/TurnItemContracts.ts` | 28 | 19 | 9 |
| `packages/CodexProtocol/Source/Contracts/Thread/UserInputRequestContracts.ts` | 3 | 1 | 2 |
| `packages/CodexProtocol/Source/Errors.ts` | 2 | 2 | 0 |
| `packages/CodexProtocol/Source/FarfieldServer.ts` | 10 | 2 | 8 |
| `packages/CodexProtocol/Source/Index.ts` | 7 | 1 | 6 |
| `packages/CodexProtocol/Source/Ipc.ts` | 27 | 18 | 9 |
| `packages/CodexProtocol/Source/Parsers/ThreadParsers.ts` | 22 | 16 | 6 |
| `packages/CodexProtocol/Source/ProtocolSchemaParsers.ts` | 19 | 0 | 19 |
| `packages/CodexProtocol/Source/Push.ts` | 85 | 59 | 26 |
| `packages/CodexProtocol/Source/Thread.ts` | 0 | 7 | -7 |
| `packages/CodexProtocol/Tests/ProtocolAppServerSchemas.test.ts` | 45 | 0 | 45 |
| `packages/CodexProtocol/Tests/ProtocolErrors.test.ts` | 63 | 0 | 63 |
| `packages/CodexProtocol/Tests/ProtocolIpcSchemas.test.ts` | 30 | 0 | 30 |
| `packages/CodexProtocol/Tests/ProtocolPushSchemas.test.ts` | 59 | 0 | 59 |
| `packages/CodexProtocol/Tests/ProtocolThreadContractHardening.test.ts` | 147 | 0 | 147 |
| `packages/CodexProtocol/Tests/ProtocolThreadCoreSchemas.test.ts` | 26 | 1 | 25 |
| `packages/CodexProtocol/Tests/ProtocolThreadExtendedSchemas.test.ts` | 40 | 0 | 40 |
| `packages/CodexProtocol/Tests/SanitizedFixtures.test.ts` | 28 | 17 | 11 |
| `packages/OpenCodeInterfaceAdapter/Source/Client.ts` | 148 | 23 | 125 |
| `packages/OpenCodeInterfaceAdapter/Source/ClientContracts.ts` | 73 | 0 | 73 |
| `packages/OpenCodeInterfaceAdapter/Source/ConversationTurnMapper.ts` | 39 | 6 | 33 |
| `packages/OpenCodeInterfaceAdapter/Source/EventPayloadMapper.ts` | 126 | 31 | 95 |
| `packages/OpenCodeInterfaceAdapter/Source/Index.ts` | 1 | 0 | 1 |
| `packages/OpenCodeInterfaceAdapter/Source/Mapper.ts` | 1 | 0 | 1 |
| `packages/OpenCodeInterfaceAdapter/Source/MapperContracts.ts` | 53 | 20 | 33 |
| `packages/OpenCodeInterfaceAdapter/Source/Schemas.ts` | 12 | 5 | 7 |
| `packages/OpenCodeInterfaceAdapter/Source/Service.ts` | 180 | 110 | 70 |
| `packages/OpenCodeInterfaceAdapter/Source/SessionMapper.ts` | 43 | 5 | 38 |
| `packages/OpenCodeInterfaceAdapter/Source/TurnItemMapper.ts` | 55 | 35 | 20 |
| `packages/OpenCodeInterfaceAdapter/Tests/Client.test.ts` | 146 | 0 | 146 |
| `packages/OpenCodeInterfaceAdapter/Tests/EventPayloadMapper.test.ts` | 180 | 0 | 180 |
| `packages/OpenCodeInterfaceAdapter/Tests/Mapper.test.ts` | 273 | 67 | 206 |
| `packages/OpenCodeInterfaceAdapter/Tests/Service.test.ts` | 377 | 0 | 377 |
| `packages/OpenCodeInterfaceAdapter/package.json` | 4 | 1 | 3 |
| `packages/OpenCodeInterfaceAdapter/tsconfig.json` | 2 | 1 | 1 |
| `packages/OpenCodeInterfaceAdapter/vitest.config.ts` | 3 | 0 | 3 |

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
