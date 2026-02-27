# Owner API Boundary Registry

Last Updated (UTC): 2026-02-27 05:13:39Z

## Purpose

Track explicit owner surfaces by group, the mutable state each owner controls, and the public API that other groups must use.

## Server Network Group

1. [`ServerRequestLifecycleOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ServerRequestLifecycleOwner.ts)
   - owns: request context metadata, request start/complete observability pairing.
   - query APIs: `createRequestLifecycleContext`, `createRequestErrorContext`, `createRequestContextDetails`.
   - mutation APIs: `recordRequestStartedForObservability`, `recordRequestCompletedForObservability`, `writeRequestContextResponseHeaders`.
2. [`ServerRequestAuthenticationOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ServerRequestAuthenticationOwner.ts)
   - owns: API authentication policy checks.
   - query APIs: `requireApiAuth`.
3. [`ServerRequestRouteDispatchOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ServerRequestRouteDispatchOwner.ts)
   - owns: route dispatch order and route dependency wiring.
   - query APIs: `dispatch`.
4. [`DebugRouteContracts.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/Routes/DebugRouteContracts.ts)
   - owns: debug replay adapter boundary contract and debug route replay frame contracts.
   - query APIs: `buildSendRequestOptions`.
5. [`RequestMetricsRouteClassificationContracts.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/RequestMetricsRouteClassificationContracts.ts)
   - owns: request metrics route-classification contracts and pathname normalization for bounded route cardinality.
   - query APIs: `normalizeMetricsRoutePathname`.
6. [`RequestTimingSampleWindow.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/RequestTimingSampleWindow.ts)
   - owns: request timing sample-window mutation and percentile/max calculation ownership.
   - query APIs: `appendSampleWindowValue`, `readNearestRankPercentile`, `readSampleWindowMaximum`.
7. [`StartupRequestActionContracts.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/StartupRequestActionContracts.ts)
   - owns: startup action identification and description mapping contracts for request timing summaries.
   - query APIs: `isStartupActionName`, `readStartupActionDescription`.

## Server Application Configuration Group

1. [`ServerRuntimeConfigurationConstants.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Application/Configuration/ServerRuntimeConfigurationConstants.ts)
   - owns: runtime configuration environment variable keys, defaults, static metadata constants, and shared configuration error message contracts.
2. [`ServerRuntimeEnvironmentValueReaders.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Application/Configuration/ServerRuntimeEnvironmentValueReaders.ts)
   - owns: strict environment value parsing and normalization contracts for path/boolean/positive integer values.
   - query APIs: `readEnvironmentValue`, `readTrimmedEnvironmentValue`, `readPositiveIntegerEnvironmentValue`, `readBooleanEnvironmentValue`, `readOptionalPathEnvironmentValue`.
3. [`ServerRuntimeDerivedValueResolvers.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Application/Configuration/ServerRuntimeDerivedValueResolvers.ts)
   - owns: runtime derived value precedence and platform-sensitive path resolution contracts.
   - query APIs: `resolveApiTokenFromEnvironment`, `resolveWebHealthBuildIdentifierFromEnvironment`, `resolveApiSessionSigningSecret`, `resolveCodexExecutablePathFromEnvironment`, `resolveIpcSocketPathFromEnvironment`, `resolveGitCommitHash`, `resolvePushLocalCaSourcePath`, `resolveClientErrorSessionMetadata`.

## Server Agents Group

1. [`OpenCodeDirectoryOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/OpenCodeDirectoryOwner.ts)
   - owns: thread-directory cache and directory normalization/validation.
   - query APIs: `resolveThreadDirectory`, `resolveSessionDirectories`, `normalizeDirectoryList`.
   - mutation APIs: `cacheThreadDirectory`.
2. [`OpenCodeThreadListingOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/OpenCodeThreadListingOwner.ts)
   - owns: session aggregation, sorting, and cursor pagination for listThreads.
   - query APIs: `listThreads`.
3. [`OpenCodeThreadCursorContracts.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/OpenCodeThreadCursorContracts.ts)
   - owns: cursor boundary contract encoding/decoding and schema enforcement.
   - query APIs: `encodeOpenCodeThreadCursor`, `decodeOpenCodeThreadCursor`.
4. [`CodexThreadStreamFrameDescriptionContracts.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexThreadStreamFrameDescriptionContracts.ts)
   - owns: Codex IPC frame method/thread-id description contracts and stream-event method classification.
   - query APIs: `describeCodexIpcFrame`, `extractThreadIdFromCodexIpcFrame`, `isThreadStreamStateChangedFrame`.
5. [`CodexThreadStreamEventHistoryOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexThreadStreamEventHistoryOwner.ts)
   - owns: per-thread stream event retention, monotonic sequence indexes, and cursor reset-required behavior.
   - query APIs: `readStreamEvents`.
   - mutation APIs: `appendStreamEvent`.
6. [`CodexThreadLiveStateProjectionOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexThreadLiveStateProjectionOwner.ts)
   - owns: snapshot/patch live-state projection and reduction-failure localization contracts.
   - query APIs: `readProjectedConversationState`, `readLiveState`.
   - mutation APIs: `projectEvent`.
7. [`CodexInvalidThreadStreamEventLogOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexInvalidThreadStreamEventLogOwner.ts)
   - owns: malformed Codex stream event persistence for replay/debug diagnosis.
   - mutation APIs: `recordInvalidThreadStreamEvent`.
8. [`CodexAgentAdapterContracts.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexAgentAdapterContracts.ts)
   - owns: Codex adapter identity/capability contracts and invalid-request error classification rules.
   - query APIs: `isInvalidRequestErrorMatchingMessageFragment`.
9. [`CodexAgentAdapterOwnerFactory.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexAgentAdapterOwnerFactory.ts)
   - owns: Codex adapter owner dependency composition for message, thread-management, and thread-interaction owners.
   - query APIs: `createCodexAgentAdapterOwners`.
10. [`CodexAgentAdapterIpcIngressWiring.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/CodexAgentAdapterIpcIngressWiring.ts)
   - owns: inbound IPC connection/frame wiring from transport ingress to stream-state and connection lifecycle owners.
   - query APIs: `wireCodexAgentAdapterIpcIngress`.

## Server Modules Group

1. [`ThreadCompletionNotificationService.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Modules/Threads/ThreadCompletionNotificationService.ts)
   - owns: thread-completion notification fan-out scheduling, completion watermark progress, and push send orchestration under thread/push coordinators.
   - query APIs: `scheduleThreadCompletionCheck`.
   - mutation APIs: `checkAndNotifyThreadCompletion`.
   - dependency boundary: consumes `readThreadLiveState` reader contract and does not depend on concrete adapter types.
2. [`ActivityHistoryStoreOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Modules/Activity/ActivityHistoryStoreOwner.ts)
   - owns: bounded activity history retention and full payload lookup by history entry identifier.
   - query APIs: `readHistoryEntries`, `readHistoryById`, `readHistoryCount`.
   - mutation APIs: `appendHistoryEntry`.
3. [`ActivityTraceLifecycleOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Modules/Activity/ActivityTraceLifecycleOwner.ts)
   - owns: active trace stream lifecycle, marker writes, and bounded recent-trace retention.
   - query APIs: `readRecentTraces`, `readTraceById`, `readActiveTraceSummary`.
   - mutation APIs: `startTrace`, `markTrace`, `stopTrace`, `closeActiveTraceIfPresent`, `appendTraceRecordIfActive`.
4. [`ActivityHistoryPayloadProjection.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Modules/Activity/ActivityHistoryPayloadProjection.ts)
   - owns: action metadata summarization and payload size-projection contracts for history list views.
   - query APIs: `summarizeActionDetails`, `summarizePayloadForHistory`.

## Web Application State Group

1. [`CoreDataStartupLoader.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/CoreDataStartupLoader.ts)
   - owns: startup read orchestration and deferred hydration sequencing.
   - query APIs: `loadCoreData`.
2. [`ArchivedThreadLoader.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/ArchivedThreadLoader.ts)
   - owns: archived thread list hydration orchestration.
   - query APIs: `loadArchivedThreads`.
3. [`UseApplicationRuntimeRefreshOrchestration.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseApplicationRuntimeRefreshOrchestration.ts)
   - owns: runtime refresh sequencing, runtime refresh observability completion semantics, and selected-thread refresh invariants.
   - query APIs: `useApplicationRuntimeRefreshOrchestration`.
4. [`ApplicationRuntimeCompositionDependencyBuilders.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/ApplicationRuntimeCompositionDependencyBuilders.ts)
   - owns: runtime composition hook dependency-input assembly for feature/effect owners.
   - query APIs: `createApplicationRuntimeCompositionContext`, `buildApplicationPushFeatureCompositionInput`, `buildViewportShellEffectsInput`, `buildApplicationRefreshEffectsInput`, `buildSelectedThreadLifecycleEffectsInput`, `buildEventStreamEffectsInput`, `buildModeAndPendingRequestEffectsInput`, `buildApplicationChatFeatureCompositionInput`, `buildApplicationDebugFeatureCompositionInput`, `buildApplicationSynchronizationEffectsInput`, `buildApplicationShellCompositionInput`.
5. [`ApplicationAgentCapabilityDerivation.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/ApplicationAgentCapabilityDerivation.ts)
   - owns: agent map/selection derivation, active-agent capability flag derivation, and connectivity status derivation.
   - query APIs: `readAgentsById`, `readAvailableAgentIds`, `readSelectedAgentDescriptor`, `readActiveThreadAgentId`, `readActiveAgentDescriptor`, `readActiveAgentLabel`, `readActiveAgentCapabilities`, `readAgentCapabilityFlags`, `readAgentConnectivityState`.
6. [`ApplicationModeAndEffortOptionDerivation.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/ApplicationModeAndEffortOptionDerivation.ts)
   - owns: mode-option, plan-mode, effort-option, and model-option filtering derivation contracts.
   - query APIs: `readPlanModeOption`, `readDefaultModeOption`, `readIsPlanModeEnabled`, `readEffortOptions`, `readEffortOptionsWithoutAssumedDefault`, `readModelOptionsWithoutAssumedDefault`.
7. [`UseApplicationDebugIssueDerivedState.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseApplicationDebugIssueDerivedState.ts)
   - owns: debug issue derived-state memoization chain (error/warning merge, filtering, and selection).
   - query APIs: `useApplicationDebugIssueDerivedState`.
8. [`CoreDataSnapshotCapabilitiesDerivation.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/CoreDataSnapshotCapabilitiesDerivation.ts)
   - owns: capabilities snapshot normalization and mode/model signature derivation ownership.
   - query APIs: `readCapabilitiesCollectionSnapshot`.
9. [`CoreDataSnapshotReusePolicy.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/CoreDataSnapshotReusePolicy.ts)
   - owns: deterministic state reuse comparators for health/config defaults/trace status/agent descriptors.
   - query APIs: `shouldReusePreviousHealth`, `shouldReusePreviousConfigDefaults`, `shouldReusePreviousTraceStatus`, `shouldReusePreviousAgentDescriptors`.
10. [`CoreDataSnapshotStateSectionAppliers.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/CoreDataSnapshotStateSectionAppliers.ts)
   - owns: section-level state application commands for health/threads/capabilities/trace/debug/agents/selection surfaces.
   - query APIs: `applyDebugWorkspaceSnapshot`, `applyHealthSnapshot`, `applyActiveThreadSnapshot`, `applyCapabilitiesSnapshot`, `applyTraceStatusSnapshot`, `applyAgentSnapshot`, `applySelectedThreadSnapshot`, `applySelectedModeKeySnapshot`.

## Web Application Data Access Group

1. [`WebShellSessionBootstrapClient.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/DataAccess/WebShellSessionBootstrapClient.ts)
   - owns: web-shell events session bootstrap transport calls for runtime and push composition owners.
   - query APIs: `bootstrapWithRequestOptions`, `bootstrapWithApiToken`.

## Web Features Chat Group

1. [`SelectedThreadSnapshotStateOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/StateManagement/SelectedThreadSnapshotStateOwner.ts)
   - owns: selected-thread snapshot application, stream cursor progression, and state mutation sequencing.
   - query APIs: `readNextStreamSequence`, `shouldSkipSnapshotApply`.
   - mutation APIs: `applySnapshots`, `applySelectedThreadStreamDelta`.
2. [`SelectedThreadReadCapabilitiesResolver.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/DomainModel/SelectedThreadReadCapabilitiesResolver.ts)
   - owns: deterministic capability resolution from thread ownership and agent descriptors.
   - query APIs: `resolveReadCapabilitiesForThread`.
3. [`SelectedThreadStreamEventStateResolver.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/DomainModel/SelectedThreadStreamEventStateResolver.ts)
   - owns: stream event append/reset merge policy and retention bounds.
   - query APIs: `resolveNextStreamEventsState`.

## Web Features Debugging Group

1. [`DebugApiRequestContracts.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Debugging/DataAccess/DebugApiRequestContracts.ts)
   - owns: debug endpoint tokens, request-init builders, and path/input request contract validation.
   - query APIs: `buildListRequestPath`, `buildMemberRequestPath`, `buildJsonPostRequestInit`, `buildDeleteRequestInit`, `parseTraceStartLabel`, `parseTraceMarkNote`.
2. [`DebugErrorEnvelopeContracts.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Debugging/DataAccess/DebugErrorEnvelopeContracts.ts)
   - owns: debug-error envelope wire parsing and projection into strict app-owned error contracts.
   - query APIs: `DebugErrorListEnvelopeSchema`, `DebugErrorDetailEnvelopeSchema`.
3. [`DebugIssueStateResolver.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Debugging/DomainModel/DebugIssueStateResolver.ts)
   - owns: deterministic debug issue derivation/filtering/selection and runtime-request-error operation metric aggregation.
   - query APIs: `readDebugErrorIssues`, `readDebugWarningIssues`, `readRuntimeRequestErrorOperationMetrics`, `readCombinedDebugIssues`, `readFilteredDebugIssues`, `readSelectedDebugIssue`, `readNextSelectedDebugIssueIdentifier`.

## Web Features Threads Group

1. [`ThreadListStateController.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListStateController.ts)
   - owns: active/archived thread list read orchestration, cache invalidation boundaries, and presentation/state-store composition.
   - query APIs: `loadActiveThreadState`, `loadArchivedThreadState`, `readThreadListPresentationState`.
   - mutation APIs: `invalidateActiveThreadQuery`, `invalidateArchivedThreadQuery`, `invalidateThreadQueries`, `resetState`.
2. [`ThreadListCacheKeyContracts.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListCacheKeyContracts.ts)
   - owns: canonical cache key contracts for active and archived thread list query surfaces.
   - query APIs: `readThreadListCacheKeyForArchiveState`.

## Web Shared Transport Group

1. [`FarfieldHttpTransportRequestExecutionOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransportRequestExecutionOwner.ts)
   - owns: request dispatch timeout policy, caller-abort versus timeout-abort semantics, and request-id assignment.
   - query APIs: `performRequest`.
2. [`FarfieldHttpTransportResponseOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransportResponseOwner.ts)
   - owns: response-body parsing, envelope/error contract decoding, and request-failure message shaping.
   - query APIs: `readResponseBody`, `decodeStructuredDataValue`, `decodeApiEnvelope`, `resolveFailureBaseMessage`, `readResponseRequestId`.
   - mutation APIs: `createRequestFailureError` (error-context construction).
3. [`FarfieldHttpTransportRequestOptionsOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransportRequestOptionsOwner.ts)
   - owns: request metadata header normalization and request-init option shaping.
   - query APIs: `requestInitWithOptions`.
   - mutation APIs: `applyRequestOptions`.

## OpenCode Interface Adapter Package Group

1. [`ServiceBoundaryContracts.ts`](/Users/matthewfrench/GitHub/farfield/packages/OpenCodeInterfaceAdapter/Source/ServiceBoundaryContracts.ts)
   - owns: monitor-service ingress parsing and structured envelope normalization contracts.
   - query APIs: `parseListSessionsInput`, `parseCreateSessionInput`, `parseSessionLookupInput`, `parseSendMessageInput`, `parseStructuredDataValue`, `parseStructuredCollectionValue`, `parseProjectDirectory`.
2. [`ServiceRequestBuilder.ts`](/Users/matthewfrench/GitHub/farfield/packages/OpenCodeInterfaceAdapter/Source/ServiceRequestBuilder.ts)
   - owns: monitor-service request payload construction from parsed boundary contracts.
   - query APIs: `buildSessionListRequest`, `buildSessionCreateRequest`, `buildSessionReadRequest`, `buildSessionPromptRequest`.
3. [`SessionMessageProjection.ts`](/Users/matthewfrench/GitHub/farfield/packages/OpenCodeInterfaceAdapter/Source/SessionMessageProjection.ts)
   - owns: session message projection for ordered message arrays plus part lookup map.
   - query APIs: `projectSessionMessages`.
4. [`EventPayloadMapperContracts.ts`](/Users/matthewfrench/GitHub/farfield/packages/OpenCodeInterfaceAdapter/Source/EventPayloadMapperContracts.ts)
   - owns: OpenCode inbound event constants, mapped payload contracts, and mapper error detail contracts.
5. [`EventPayloadMapperFieldNames.ts`](/Users/matthewfrench/GitHub/farfield/packages/OpenCodeInterfaceAdapter/Source/EventPayloadMapperFieldNames.ts)
   - owns: event payload field-name literals for schema construction.
6. [`EventPayloadMapperSchemas.ts`](/Users/matthewfrench/GitHub/farfield/packages/OpenCodeInterfaceAdapter/Source/EventPayloadMapperSchemas.ts)
   - owns: strict Zod mapper schemas for event payload contract parsing.
7. [`EventPayloadMapperParsing.ts`](/Users/matthewfrench/GitHub/farfield/packages/OpenCodeInterfaceAdapter/Source/EventPayloadMapperParsing.ts)
   - owns: mapper parsing helpers and deterministic typed error construction for schema failures.
   - query APIs: `parseMapperSchemaOrThrow`, `parseRequestedSessionIdentifierOrThrow`.
8. [`OpenCodeConnectionOptions.ts`](/Users/matthewfrench/GitHub/farfield/packages/OpenCodeInterfaceAdapter/Source/OpenCodeConnectionOptions.ts)
   - owns: OpenCode connection option parsing and startup default strategy ownership.
   - query APIs: `parseOpenCodeClientOptions`, `parseOpenCodeBaseUrl`, `buildOpenCodeServerStartOptions`.
9. [`OpenCodeEnvelopeResultMapper.ts`](/Users/matthewfrench/GitHub/farfield/packages/OpenCodeInterfaceAdapter/Source/OpenCodeEnvelopeResultMapper.ts)
   - owns: SDK response envelope normalization into package-owned response contracts.
   - query APIs: `mapOpenCodeSdkResponsePromise`.
10. [`OpenCodeDefaultConnectionDependencyFactory.ts`](/Users/matthewfrench/GitHub/farfield/packages/OpenCodeInterfaceAdapter/Source/OpenCodeDefaultConnectionDependencyFactory.ts)
   - owns: default runtime dependency wiring for OpenCode server/client creation.

## Codex Interface Adapter Package Group

1. [`AppServerSpawnEnvironmentContract.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerSpawnEnvironmentContract.ts)
   - owns: app-server child-process environment allowlist contract and spawn environment shaping.
   - query APIs: `buildAppServerSpawnEnvironment`.
2. [`AppServerChildProcessTransportOptionsContract.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerChildProcessTransportOptionsContract.ts)
   - owns: child-process transport option parsing and option-shape classification contracts.
   - query APIs: `parseChildProcessAppServerTransportOptions`, `isChildProcessAppServerTransportOptionsValue`.
3. [`AppServerIncomingLineParser.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerIncomingLineParser.ts)
   - owns: app-server stdout line parsing and explicit parse outcome contracts.
   - query APIs: `parseAppServerIncomingLine`.
4. [`AppServerTransportConstants.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerTransportConstants.ts)
   - owns: shared app-server transport literals consumed by transport owner modules.
5. [`IpcClientConstants.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/IpcClientConstants.ts)
   - owns: desktop IPC transport constants and initialize-result boundary schema.
6. [`IpcFrameCodec.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/IpcFrameCodec.ts)
   - owns: IPC frame byte encoding and inbound payload parsing boundaries.
   - query APIs: `encodeIpcFrame`, `parseIpcPayloadBuffer`.
7. [`IpcPendingRequestOwner.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/IpcPendingRequestOwner.ts)
   - owns: IPC pending request lifecycle (register, claim, reject-one, reject-all, timeout cleanup).
   - query APIs: `createPendingRequestPromise`, `claimPendingRequest`.
   - mutation APIs: `rejectPendingRequest`, `rejectAllPendingRequests`.
8. [`IpcErrorMessageFormatter.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/IpcErrorMessageFormatter.ts)
   - owns: deterministic transport/runtime error value message formatting.
   - query APIs: `formatIpcErrorMessage`.
9. [`AppServerClientMethodConstants.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerClientMethodConstants.ts)
   - owns: app-server client RPC method literal contracts.
10. [`AppServerClientRequestBuilders.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerClientRequestBuilders.ts)
   - owns: app-server client request payload/default construction and request-side Zod parsing.
   - query APIs: `buildListThreadsRequestParameters`, `buildListThreadsAllPageOptions`, `buildReadThreadRequestParameters`, `resolveReadThreadRequestTimeoutMilliseconds`, `buildReadConfigRequestParameters`, `buildStartThreadRequest`, `buildSendUserMessageRequest`, `buildResumeThreadRequest`, `buildArchiveThreadRequest`, `buildUnarchiveThreadRequest`.
11. [`AppServerClientResponseParser.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/AppServerClientResponseParser.ts)
   - owns: app-server response parse context labels and protocol-validation error mapping ownership.
   - query APIs: `parseAppServerResponse`.

## Codex Protocol Package Group

1. [`UserInputRequestContracts.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexProtocol/Source/Contracts/Thread/UserInputRequestContracts.ts)
   - owns: thread conversation server-request method contracts, user-input request contract shape, and request-method discriminated union ownership.
   - query APIs: `ThreadConversationRequestSchema`, `UserInputRequestSchema`.
2. [`ConversationStateContracts.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexProtocol/Source/Contracts/Thread/ConversationStateContracts.ts)
   - owns: thread conversation state contract composition and request-list contract ownership for stream/read surfaces.
   - query APIs: `ThreadConversationStateSchema`.
3. [`TurnItemContracts.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexProtocol/Source/Contracts/Thread/TurnItemContracts.ts)
   - owns: thread turn item discriminated contracts, including structured error-item metadata contract ownership.
   - query APIs: `TurnItemSchema`.

## Boundary Rules to Enforce in Reviews

1. Non-owner modules must not mutate owner-managed mutable state directly.
2. UI modules should consume typed owner APIs, not data-access transport modules.
3. Domain-model modules must stay pure and avoid state/data-access imports.
4. Agent modules must not import network ingress/route modules.
5. New mutable surfaces must declare an owner and be listed in this registry.
