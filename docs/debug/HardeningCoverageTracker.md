# Hardening Coverage Tracker

Last Updated (UTC): 2026-02-27 02:57:21Z

## Scope Model

1. Group: broad repository surfaces used for planning and progress gates.
2. Folder: one level below each architecture group root.
3. File: exhaustive inventory for every tracked and currently untracked file in this workspace.

## Layer Prompt Assets

1. Prompt index:
   - [Subagent Prompt Index](/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/Index.md)
2. Shared context:
   - [Shared Context Prompt](/Users/matthewfrench/GitHub/farfield/docs/debug/SubagentPrompts/SharedContextPrompt.md)
3. Owner API registry:
   - [Owner API Boundary Registry](/Users/matthewfrench/GitHub/farfield/docs/debug/OwnerApiBoundaryRegistry.md)
4. Layer prompts:
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

## Concern Status Snapshot (Current Wave)

1. Enforcement now active for ownership and separation:
   - `import/no-cycle` is enforced across application and package source roots.
   - `max-lines` and `max-lines-per-function` are enforced for source ownership budgets.
   - non-owner mutable-member writes are blocked with explicit owner allowlist patterns in lint configuration.
   - server layer boundaries are enforced:
     - `Network/Routes` must not import `Application/*`
     - `Network/*` (non-routes) must not import `Application/*`
     - `Modules/*` must not import `Network/Routes/*` or `Network/RequestSchemas/*`
2. Ownership refactors completed for boundary compliance:
   - debug contracts moved out of route layer to [`apps/ServerApplication/Source/Network/DebugContracts.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/DebugContracts.ts).
   - runtime-route dependencies now consume explicit network-owned reader contracts instead of `Application` state-owner types.
   - debug-data mapping helpers were rewritten to immutable construction where mutable member writes were previously used.
3. High-priority hotspot closure in this iteration:
   - `apps/WebApplication/Source/Application/StateManagement`
     - startup and archived-thread orchestration moved to explicit owner classes:
       - [`CoreDataStartupLoader.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/CoreDataStartupLoader.ts)
       - [`ArchivedThreadLoader.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/ArchivedThreadLoader.ts)
     - composition hook now acts as owner wiring only:
       - [`UseCoreDataLoaders.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/UseCoreDataLoaders.ts)
   - `apps/ServerApplication/Source/Network/ServerRequestHandler.ts`
     - request handling split by concern owners:
       - lifecycle owner: [`ServerRequestLifecycleOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ServerRequestLifecycleOwner.ts)
       - authentication owner: [`ServerRequestAuthenticationOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ServerRequestAuthenticationOwner.ts)
       - route-dispatch owner: [`ServerRequestRouteDispatchOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ServerRequestRouteDispatchOwner.ts)
   - `packages/CodexInterfaceAdapter/Source/LiveState.ts`
     - live-state responsibilities split into focused owner modules:
       - error contracts: [`LiveStateErrorContracts.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/LiveStateErrorContracts.ts)
       - patch application owner: [`LiveStatePatchApplicationOwner.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/LiveStatePatchApplicationOwner.ts)
       - event-reduction owner: [`LiveStateEventReductionOwner.ts`](/Users/matthewfrench/GitHub/farfield/packages/CodexInterfaceAdapter/Source/LiveStateEventReductionOwner.ts)
4. Remaining queued by concern:
   - `apps/ServerApplication/Source/Agents`
     - continue reducing adapter fan-in and keep all adapter mutability behind explicit owner APIs.
   - `apps/WebApplication/Source/Features`
     - continue moving feature policy branching from composition and components into owner state modules.
   - `apps/ServerApplication/Source/Modules`
     - continue enforcing deterministic cache/concurrency owner boundaries and typed mutation-only APIs.

## Group and Concern Separation Review (Current Iteration)

1. `apps/ServerApplication/Source/Network`
   - issue before this iteration:
     - request ingress, auth policy, route dispatch, and lifecycle telemetry were concentrated in one owner surface.
   - improvement applied:
     - split into explicit owners for lifecycle context, auth policy, and route dispatch.
     - route modules now consume network-owned runtime reader contracts and debug contracts rather than `Application` owner types.
   - boundary API guidance:
     - request composition owner should only parse ingress and delegate to owner APIs.
     - route owner APIs should accept normalized path/method/context contracts, not raw application state owners.
2. `packages/CodexInterfaceAdapter/Source`
   - issue before this iteration:
     - patch-path mechanics, strict patch application, and stream-event reduction were grouped in one file.
   - improvement applied:
     - split live-state behavior into dedicated modules:
       - patch application owner
       - stream event reduction owner
       - error contract owner
   - boundary API guidance:
     - service consumers should call explicit reducer/apply APIs and avoid internal patch-path mechanics.
     - error contracts should remain transport-agnostic and include event/patch localization metadata.
3. `apps/WebApplication/Source/Application/StateManagement`
   - issue before this iteration:
     - startup critical-read orchestration and archived-thread load orchestration were mixed inside one hook.
   - improvement applied:
     - startup and archived-thread orchestration moved into explicit owners, with hook reduced to dependency wiring.
   - boundary API guidance:
     - hooks compose owners and pass typed refs/setters.
     - owner APIs execute orchestration and return deterministic completion semantics.

## Boundary API Usage Checks To Apply In Next Waves

1. Ensure every group owner has one typed `Dependencies` contract and one typed public API surface.
2. Ensure cross-group calls use owner APIs only, not direct state mutation or shared mutable object passing.
3. Ensure ingress parsing and route-path normalization remain in network owners, not reused downstream through raw request objects.
4. Ensure UI composition hooks do not embed policy branches that belong in state-management owners.
5. Ensure package surfaces expose explicit error/value contracts so app owners do not inspect transport payload shapes directly.

## Boundary API Misuse Signals (Quick Audit Checklist)

1. Data-access module imported by a UI component:
   - move request calls into feature/app owner APIs and let UI consume owner outputs only.
2. Owner consumers constructing partial mutable payloads for owner internals:
   - replace with named owner commands and strict input contracts.
3. Shared mutable state object passed between multiple groups:
   - replace with one owner API boundary and immutable read models for consumers.
4. Repeated transport string discriminants in app logic:
   - centralize discriminants in one boundary contract and map once at ingress.
5. Cross-group helper mutating state without owner context:
   - move mutation into the owning module/class and expose explicit mutation methods.

## Next Concern Focus: Ownership and Separation

The next concern waves should prioritize separation-of-concerns and owner API discipline by group/area, not file count alone.

Core ownership checks for every area:

1. One explicit owner per mutable state/cache/persistence surface.
2. Query/mutation entry points route through owner APIs only (no side-channel state writes).
3. Boundary parsing/normalization stays in boundary owners; internal modules consume app-owned contracts only.
4. Cross-layer dependencies follow the documented direction (UI -> state/logic -> data access/boundary).
5. Observability for owner-controlled flows includes operation identity, start/end, and error context.

Priority areas to inspect next:

1. `apps/ServerApplication/Source/Agents`
   - Confirm adapters only orchestrate through owner classes and never mutate shared state outside owned surfaces.
   - Verify thread ownership resolution and message/interaction channels remain centralized in owner APIs.
2. `apps/ServerApplication/Source/Network`
   - Confirm route owners are the sole mutation/query channels for request-scoped behavior.
   - Verify route contracts remain strict and no transport-shape checks leak into downstream modules.
3. `apps/ServerApplication/Source/Modules`
   - Confirm push/thread/activity services own their own state transitions and expose explicit mutation APIs.
   - Validate cache/concurrency owners have deterministic sequencing and explicit invalidation rules.
4. `apps/WebApplication/Source/Application`
   - Confirm composition hooks wire owners but do not absorb domain logic.
   - Ensure refresh/concurrency decisions stay in dedicated coordinators and not mixed into UI bindings.
5. `apps/WebApplication/Source/Features`
   - Confirm feature state owners are the only place that mutates feature state.
   - Verify UI components consume owner/state APIs and do not directly perform boundary/data-access logic.
6. `packages/CodexInterfaceAdapter` and `packages/OpenCodeInterfaceAdapter`
   - Confirm transport mapping stays in adapter boundary modules and does not leak into callers.
   - Verify request option builders preserve explicit caller intent and avoid implicit truthy filtering.

Exit criteria for this focus wave:

1. Each area has a short owner registry/checklist entry in this tracker or linked decision notes.
2. High-risk mutation/query paths have explicit owner API tests.
3. No new cross-layer shortcuts bypassing owner APIs are introduced during hardening.

## Frontend Strict Enforcement Wave (Completed)

This frontend hardening wave is now complete and enforced in CI lint scope.

1. `35fb94e` `lint: enforce strict frontend runtime checks`
   - Added strict type-aware lint checks to `apps/WebApplication/Source/**/*`.
   - Fixed strict-condition and narrowing issues across frontend owners/components.
2. strict frontend test and contract-policy enforcement wave
   - Added strict type-aware lint checks to `apps/WebApplication/Tests/**/*`.
   - Added lint enforcement that forbids:
     - `unknown` type usage
     - type-introspection utility contracts (`Parameters<>`, `ReturnType<>`, `ConstructorParameters<>`, `InstanceType<>`)
   - Updated frontend tests to satisfy strict boolean and unnecessary-condition policies.

## Next Concern Groups (Owner API Hardening Queue)

Focus order for upcoming waves:

1. `apps/WebApplication/Source/Application`
   - Ensure composition owners only wire dependencies and never absorb domain mutation/query logic.
   - Verify owner APIs remain the sole mutation channels for app shell/runtime state.
2. `apps/WebApplication/Source/Features`
   - Validate each feature keeps one explicit mutable-state owner and no UI-driven boundary calls.
   - Confirm feature data-access modules stay as boundary-only adapters with strict mapping contracts.
3. `apps/WebApplication/Source/Shared`
   - Enforce transport/error modules as pure boundary/shared-contract owners, with no feature state behavior.
   - Confirm request options, error descriptors, and telemetry contracts remain explicit and centralized.
4. `apps/ServerApplication/Source/Agents` and `apps/ServerApplication/Source/Network`
   - Validate adapter/route owner APIs are the only mutation/query channels crossing runtime boundaries.
   - Confirm no transport-shape checks leak into core owners after ingress parsing.
5. `packages/CodexInterfaceAdapter` and `packages/OpenCodeInterfaceAdapter`
   - Confirm mapping and transport boundaries remain strict, deterministic, and contract-owned.
   - Validate options/cursor semantics remain explicit from caller contract to wire request.

## Latest Continuation Commit Wave (Current-15)

The current in-progress wave applies package-layer event-mapper owner separation for OpenCode stream payload mapping:

1. Split mapper event/type and payload contracts into `EventPayloadMapperContracts`.
2. Split mapper field-name literal ownership into `EventPayloadMapperFieldNames`.
3. Split mapper boundary schemas into `EventPayloadMapperSchemas`.
4. Split mapper parse/error helper ownership into `EventPayloadMapperParsing`.
5. Reduced `EventPayloadMapper` to event-branch orchestration over these owner modules while preserving public exports and behavior.

Files touched in this continuation segment:

1. `packages/OpenCodeInterfaceAdapter/Source/EventPayloadMapper.ts`
2. `packages/OpenCodeInterfaceAdapter/Source/EventPayloadMapperContracts.ts`
3. `packages/OpenCodeInterfaceAdapter/Source/EventPayloadMapperFieldNames.ts`
4. `packages/OpenCodeInterfaceAdapter/Source/EventPayloadMapperSchemas.ts`
5. `packages/OpenCodeInterfaceAdapter/Source/EventPayloadMapperParsing.ts`

## Latest Continuation Commit Wave (Current-14)

The current in-progress wave applies package-layer IPC owner separation for desktop socket transport:

1. Split IPC protocol constants and initialize result schema ownership into `IpcClientConstants`.
2. Split frame encoding and inbound payload parsing ownership into `IpcFrameCodec`.
3. Split pending request lifecycle ownership into `IpcPendingRequestOwner`.
4. Split transport error-value formatting ownership into `IpcErrorMessageFormatter`.
5. Reduced `IpcClient` to socket lifecycle and request/response orchestration over these owner modules while preserving the public API.

Files touched in this continuation segment:

1. `packages/CodexInterfaceAdapter/Source/IpcClient.ts`
2. `packages/CodexInterfaceAdapter/Source/IpcClientConstants.ts`
3. `packages/CodexInterfaceAdapter/Source/IpcFrameCodec.ts`
4. `packages/CodexInterfaceAdapter/Source/IpcPendingRequestOwner.ts`
5. `packages/CodexInterfaceAdapter/Source/IpcErrorMessageFormatter.ts`

## Latest Continuation Commit Wave (Current-13)

The current in-progress wave applies package-layer transport owner separation for Codex app-server process transport:

1. Split spawn-environment schema ownership into `AppServerSpawnEnvironmentContract`.
2. Split child-process option parsing and classification ownership into `AppServerChildProcessTransportOptionsContract`.
3. Split app-server stdout line parsing ownership into `AppServerIncomingLineParser`.
4. Centralized transport literals into `AppServerTransportConstants`.
5. Reduced `AppServerTransport` to lifecycle/request orchestration over these owner modules while preserving the public API surface.

Files touched in this continuation segment:

1. `packages/CodexInterfaceAdapter/Source/AppServerTransport.ts`
2. `packages/CodexInterfaceAdapter/Source/AppServerSpawnEnvironmentContract.ts`
3. `packages/CodexInterfaceAdapter/Source/AppServerChildProcessTransportOptionsContract.ts`
4. `packages/CodexInterfaceAdapter/Source/AppServerIncomingLineParser.ts`
5. `packages/CodexInterfaceAdapter/Source/AppServerTransportConstants.ts`
6. `packages/CodexInterfaceAdapter/Tests/AppServerTransport.test.ts`

## Latest Continuation Commit Wave (Current-12)

The current in-progress wave applies package-layer owner separation for OpenCode service orchestration:

1. Split ingress parsing and structured envelope normalization into a dedicated boundary owner (`ServiceBoundaryContracts`).
2. Split OpenCode SDK request construction into a dedicated request owner (`ServiceRequestBuilder`).
3. Split session message projection behavior into a dedicated projection owner (`SessionMessageProjection`).
4. Reduced `OpenCodeMonitorService` to orchestration-only behavior with strict typed boundary-owner dependencies.

Files touched in this continuation segment:

1. `packages/OpenCodeInterfaceAdapter/Source/Service.ts`
2. `packages/OpenCodeInterfaceAdapter/Source/ServiceBoundaryContracts.ts`
3. `packages/OpenCodeInterfaceAdapter/Source/ServiceRequestBuilder.ts`
4. `packages/OpenCodeInterfaceAdapter/Source/SessionMessageProjection.ts`

## Latest Continuation Commit Wave (Current-11)

The current in-progress wave applies feature data-access owner separation for debugging boundary contracts:

1. Split debug request tokens/builders into a dedicated owner contract module (`DebugApiRequestContracts`).
2. Split debug-error envelope mapping and strict wire-to-contract parsing into a dedicated owner module (`DebugErrorEnvelopeContracts`).
3. Reduced `DebugApi` to orchestration-only boundary behavior while preserving existing public exports and runtime behavior.

Files touched in this continuation segment:

1. `apps/WebApplication/Source/Features/Debugging/DataAccess/DebugApi.ts`
2. `apps/WebApplication/Source/Features/Debugging/DataAccess/DebugApiRequestContracts.ts`
3. `apps/WebApplication/Source/Features/Debugging/DataAccess/DebugErrorEnvelopeContracts.ts`

## Latest Continuation Commit Wave (Current-10)

The current in-progress wave applies module-level owner boundary cleanup for thread completion notification orchestration:

1. Replaced concrete codex adapter dependency in `ThreadCompletionNotificationService` with an explicit live-state reader owner contract (`readThreadLiveState`).
2. Updated server bootstrap composition wiring to provide the live-state reader contract while preserving deterministic no-reader behavior (`null` response).
3. Updated thread completion notification service tests to consume the new owner contract directly, removing adapter concrete-type coupling from tests.

Files touched in this continuation segment:

1. `apps/ServerApplication/Source/Modules/Threads/ThreadCompletionNotificationService.ts`
2. `apps/ServerApplication/Source/Application/ServerBootstrap.ts`
3. `apps/ServerApplication/Tests/ThreadCompletionNotificationService.test.ts`
4. `apps/ServerApplication/Tests/ThreadCompletionNotificationServiceContext.test.ts`

## Latest Continuation Commit Wave (Current-9)

The current in-progress wave applies network composition boundary cleanup for replay adapter wiring:

1. Updated server request composition owners to use a generic replay-adapter dependency name and contract (`replayAdapter`) instead of codex-specific naming.
2. Propagated replay-adapter dependency naming through bootstrap wiring and server request handler test fixtures.
3. Preserved runtime behavior while tightening boundary ownership language and dependency contracts at the server network composition layer.

Files touched in this continuation segment:

1. `apps/ServerApplication/Source/Network/ServerRequestRouteDispatchOwner.ts`
2. `apps/ServerApplication/Source/Network/ServerRequestHandler.ts`
3. `apps/ServerApplication/Source/Application/ServerBootstrap.ts`
4. `apps/ServerApplication/Tests/ServerRequestHandler.test.ts`

## Latest Continuation Commit Wave (Current-8)

The current in-progress wave applies route-boundary decoupling in server debug replay routing:

1. Replaced concrete `CodexAgentAdapter` dependency in debug route contracts with a typed replay-adapter owner interface.
2. Updated `DebugReplayRouteOwner` to consume the replay-adapter contract instead of adapter-specific concrete type usage.
3. Updated route dispatch wiring to pass the adapter through the replay-adapter boundary contract.
4. Added owner-registry coverage for debug route contracts under the server network group.

Files touched in this continuation segment:

1. `apps/ServerApplication/Source/Network/Routes/DebugRouteContracts.ts`
2. `apps/ServerApplication/Source/Network/Routes/DebugReplayRouteOwner.ts`
3. `apps/ServerApplication/Source/Network/ServerRequestRouteDispatchOwner.ts`
4. `docs/debug/OwnerApiBoundaryRegistry.md`

## Latest Continuation Commit Wave (Current-7)

The current in-progress wave applies folder-level ownership hardening for thread list cache key contracts:

1. Extracted canonical thread-list cache keys into an owned contract module (`ThreadListCacheKeyContracts`).
2. Updated `ThreadListStateController` to consume cache key contracts instead of inline literals.
3. Updated thread cache and concurrency tests to consume the same owner contracts, removing duplicated string literals.
4. Extended owner registry coverage with explicit Threads-group ownership entries.

Files touched in this continuation segment:

1. `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListCacheKeyContracts.ts`
2. `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListStateController.ts`
3. `apps/WebApplication/Tests/ThreadQueryCache.test.ts`
4. `apps/WebApplication/Tests/ThreadRefreshConcurrencyCoordinator.test.ts`
5. `apps/WebApplication/Tests/ThreadOwnership.test.ts`
6. `docs/debug/OwnerApiBoundaryRegistry.md`

## Latest Continuation Commit Wave (Current-6)

The current in-progress wave strengthens application-layer boundary ownership for web-shell session bootstrap:

1. Introduced a dedicated data-access owner (`WebShellSessionBootstrapClient`) for events-session bootstrap calls.
2. Updated runtime-request and push feature composition owners to consume the client API instead of direct transport function imports.
3. Updated owner dependency wiring and runtime composition inputs so API calls cross boundaries through owned APIs only.
4. Added focused hook tests for push token submission behavior and updated runtime/owner tests for the new boundary.

Files touched in this continuation segment:

1. `apps/WebApplication/Source/Application/DataAccess/WebShellSessionBootstrapClient.ts`
2. `apps/WebApplication/Source/Application/StateManagement/UseApplicationOwnerDependencies.ts`
3. `apps/WebApplication/Source/Application/StateManagement/UseApplicationRuntimeRequestHandlers.ts`
4. `apps/WebApplication/Source/Application/StateManagement/UseApplicationPushFeatureComposition.ts`
5. `apps/WebApplication/Source/Application/StateManagement/UseApplicationRuntimeComposition.ts`
6. `apps/WebApplication/Source/App.tsx`
7. `apps/WebApplication/Tests/UseApplicationRuntimeRequestHandlers.test.tsx`
8. `apps/WebApplication/Tests/UseApplicationPushFeatureComposition.test.tsx`
9. `apps/WebApplication/Tests/UseApplicationOwnerDependencies.test.tsx`
10. `apps/WebApplication/Tests/ApplicationRuntimeComposition.test.tsx`
11. `docs/debug/OwnerApiBoundaryRegistry.md`

## Latest Continuation Commit Wave (Current-5)

The current in-progress wave applies owner-boundary decoupling in server thread-member read routing:

1. Removed concrete `CodexAgentAdapter` dependency from thread-member route dependency contracts.
2. Moved thread-not-loaded classification to the generic adapter owner API (`AgentAdapter.isThreadNotLoadedError`).
3. Updated route dispatch wiring and route owner tests to enforce adapter-owned classification semantics.

Files touched in this continuation segment:

1. `apps/ServerApplication/Source/Agents/Types.ts`
2. `apps/ServerApplication/Source/Network/Routes/ThreadMemberReadRouteOwner.ts`
3. `apps/ServerApplication/Source/Network/Routes/ThreadMemberRouteContracts.ts`
4. `apps/ServerApplication/Source/Network/ServerRequestRouteDispatchOwner.ts`
5. `apps/ServerApplication/Tests/ThreadMemberReadRouteOwner.test.ts`
6. `apps/ServerApplication/Tests/ThreadMemberMutationRouteOwner.test.ts`
7. `apps/ServerApplication/Tests/ThreadMemberRoutes.integration.test.ts`
8. `apps/ServerApplication/Tests/ThreadRoutes.test.ts`

## Latest Continuation Commit Wave (Current-4)

The current in-progress wave applies group-level ownership separation for the web shared transport boundary:

1. Split request-execution ownership from response parsing and request option shaping in `Shared/Transport`.
2. Preserved `FarfieldHttpTransport` as the public boundary API while moving implementation concerns to dedicated owner modules.
3. Added explicit shared-transport owner entries to the owner API boundary registry.

Files touched in this continuation segment:

1. `apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransport.ts`
2. `apps/WebApplication/Source/Shared/Transport/FarfieldHttpRequestFailureError.ts`
3. `apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransportRequestExecutionOwner.ts`
4. `apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransportResponseOwner.ts`
5. `apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransportRequestOptionsOwner.ts`
6. `docs/debug/OwnerApiBoundaryRegistry.md`

## Latest Continuation Commit Wave (Current-3)

The current in-progress wave applies ownership separation and API boundary hardening for agents and web feature state orchestration:

1. OpenCode adapter split into explicit owners for directory normalization/cache ownership, cursor contract parsing, and thread list pagination ownership.
2. Selected-thread loader hook reduced to composition; snapshot mutation and stream cursor ownership moved to a dedicated state owner.
3. Feature domain logic split into explicit resolvers for read-capability resolution and stream-event merge policy.
4. Added focused tests for cursor contract parsing and new web domain resolvers.
5. Added owner boundary registry doc for group-level owner API governance.

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

## Latest Continuation Commit Wave (Current)

The following isolated commits were added after the previous continuation section:

1. `921c25c` `refactor: harden thread member route boundary parsing`
2. `3c429cd` `refactor: harden debug download stream contracts`
3. `b3c1a69` `refactor: harden replay frame parser contracts`
4. `572a2ae` `refactor: harden debug route dispatch ownership`
5. `6dbf480` `refactor: harden debug client error route boundaries`
6. `3bf48d8` `refactor: harden debug history route boundaries`
7. `bf8c004` `refactor: harden debug trace route boundaries`
8. `5c664eb` `refactor: harden debug replay route contracts`
9. `363193c` `refactor: harden thread member route contract matching`

Files touched in this continuation segment:

1. `apps/ServerApplication/Source/Network/Routes/ThreadMemberRoutes.ts`
2. `apps/ServerApplication/Tests/ThreadMemberRoutes.integration.test.ts`
3. `apps/ServerApplication/Source/Network/Routes/DebugFileDownload.ts`
4. `apps/ServerApplication/Tests/DebugFileDownload.test.ts`
5. `apps/ServerApplication/Source/Network/Routes/DebugReplayFrameParser.ts`
6. `apps/ServerApplication/Tests/DebugReplayFrameParser.test.ts`
7. `apps/ServerApplication/Source/Network/Routes/DebugRoutes.ts`
8. `apps/ServerApplication/Tests/HttpRoutesDebug.integration.test.ts`
9. `apps/ServerApplication/Source/Network/Routes/DebugClientErrorRouteOwner.ts`
10. `apps/ServerApplication/Source/Network/Routes/DebugHistoryRouteOwner.ts`
11. `apps/ServerApplication/Source/Network/Routes/DebugTraceRouteOwner.ts`
12. `apps/ServerApplication/Source/Network/Routes/DebugReplayRouteOwner.ts`
13. `apps/ServerApplication/Source/Network/Routes/ThreadMemberRouteContracts.ts`

## Latest Continuation Commit Wave (Current-2)

The following isolated commits were added after the previous continuation section:

1. `fc9d0cd` `refactor: harden debug route contract helpers`
2. `224aacc` `refactor: preserve explicit optional values in thread member mutations`
3. `90cd505` `refactor: preserve explicit optional values in codex adapter mapping`
4. `bee77bb` `refactor: preserve explicit optional values in codex thread management`
5. `2b325c1` `refactor: preserve explicit create-thread option values`
6. `871b72c` `refactor: preserve explicit push receipt message values`
7. `06eecc6` `refactor: validate explicit cwd values in opencode adapter`
8. `913868d` `refactor: preserve explicit cwd in codex message dispatch`

Files touched in this continuation segment:

1. `apps/ServerApplication/Source/Network/Routes/DebugRouteContracts.ts`
2. `apps/ServerApplication/Tests/DebugRouteContracts.test.ts`
3. `apps/ServerApplication/Source/Network/Routes/ThreadMemberMessageMutationRouteOwner.ts`
4. `apps/ServerApplication/Source/Network/Routes/ThreadMemberInteractionMutationRouteOwner.ts`
5. `apps/ServerApplication/Tests/ThreadMemberMutationRouteOwner.test.ts`
6. `packages/CodexInterfaceAdapter/Source/Service.ts`
7. `packages/CodexInterfaceAdapter/Source/AppServerClient.ts`
8. `packages/CodexInterfaceAdapter/Tests/Service.test.ts`
9. `packages/CodexInterfaceAdapter/Tests/AppServerClient.test.ts`
10. `apps/ServerApplication/Source/Agents/Adapters/CodexThreadManagementOwner.ts`
11. `apps/ServerApplication/Tests/CodexThreadManagementOwner.test.ts`
12. `apps/ServerApplication/Source/Network/Routes/ThreadCollectionRoutes.ts`
13. `apps/ServerApplication/Tests/ThreadCollectionRoutes.test.ts`
14. `apps/ServerApplication/Source/Network/Routes/PushRoutes.ts`
15. `apps/ServerApplication/Tests/PushRoutes.test.ts`
16. `apps/ServerApplication/Source/Agents/Adapters/OpenCodeAgentAdapter.ts`
17. `apps/ServerApplication/Tests/OpenCodeAgentAdapter.test.ts`
18. `apps/ServerApplication/Source/Agents/Adapters/CodexMessageDispatchOwner.ts`
19. `apps/ServerApplication/Tests/CodexMessageDispatchOwner.test.ts`

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
