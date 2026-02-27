# Owner API Boundary Registry

Last Updated (UTC): 2026-02-27 03:31:44Z

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

## Server Modules Group

1. [`ThreadCompletionNotificationService.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Modules/Threads/ThreadCompletionNotificationService.ts)
   - owns: thread-completion notification fan-out scheduling, completion watermark progress, and push send orchestration under thread/push coordinators.
   - query APIs: `scheduleThreadCompletionCheck`.
   - mutation APIs: `checkAndNotifyThreadCompletion`.
   - dependency boundary: consumes `readThreadLiveState` reader contract and does not depend on concrete adapter types.

## Web Application State Group

1. [`CoreDataStartupLoader.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/CoreDataStartupLoader.ts)
   - owns: startup read orchestration and deferred hydration sequencing.
   - query APIs: `loadCoreData`.
2. [`ArchivedThreadLoader.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/ArchivedThreadLoader.ts)
   - owns: archived thread list hydration orchestration.
   - query APIs: `loadArchivedThreads`.

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

## Boundary Rules to Enforce in Reviews

1. Non-owner modules must not mutate owner-managed mutable state directly.
2. UI modules should consume typed owner APIs, not data-access transport modules.
3. Domain-model modules must stay pure and avoid state/data-access imports.
4. Agent modules must not import network ingress/route modules.
5. New mutable surfaces must declare an owner and be listed in this registry.
