# Proposed End-State Structure

This document defines the target folder/file structure and end-state ownership model.

## Naming Baseline

1. Source folder and file names use `PascalCase`.
2. Source folder names use full words and avoid abbreviations.
3. Exception: repository roots remain `apps` and `packages` in lowercase.
4. Non-source root folders remain lowercase:
   - `docs`
   - `public`
   - `traces`
   - `scripts`
   - `operations`
   - `end-to-end`

## Index File Policy (End-State)

1. Only package-level public API entry points use `Index.ts`.
2. Internal source files use descriptive names that communicate ownership and behavior.
3. Internal `Index.ts` files are replaced with explicit names (for example `ThreadListStateController.ts`).
4. This policy applies to `apps/*/Source/**` and internal package folders under `packages/*/Source/**`.

## Repository-Wide End-State Layout

```text
/
  apps/
    WebApplication/
    ServerApplication/
  packages/
    CodexProtocol/
    CodexInterfaceAdapter/
    OpenCodeInterfaceAdapter/
  scripts/
    development/
    setup/
    smoke/
    operations/
    tooling/
  end-to-end/
    real/
      fixtures/
      helpers/
      scenarios/
  operations/
    caddy/
  docs/
    decisions/
  public/                # legacy static surface only
  traces/                # runtime artifact only
  .runtime/              # runtime artifact only
```

## Proposed End-State Tree (Detailed, Illustrative)

```text
/
  apps/
    WebApplication/
      Source/
        Application/
          Boot/
            InstallClientErrorReporter.ts
          Configuration/
            ApplicationBehaviorConfiguration.ts
          DataAccess/
            WebShellApi.ts
          DomainModel/
            ApiAuthenticationErrorClassifier.ts
            ApplicationRouteStateMapper.ts
            DateValueFormatter.ts
          StateManagement/
            ApiSessionBootstrapCoordinator.ts
            CoreDataRefreshConcurrencyCoordinator.ts
            CoreDataSnapshotStateApplier.ts
            EventRefreshScheduler.ts
            EventStreamConnectionCoordinator.ts
            EventStreamRefreshDecisionEngine.ts
            MobileSidebarSwipeCoordinator.ts
            PageTouchOverscrollGuardCoordinator.ts
            RuntimeViewportSizingCoordinator.ts
            UseApplicationDerivedState.ts
            UseApplicationDerivedStateContracts.ts
            UseApplicationChatFeatureComposition.ts
            UseApplicationDebugFeatureComposition.ts
            UseApplicationOwnerDependencies.ts
            UseApplicationPresentationHelpers.tsx
            UseApplicationPushFeatureComposition.ts
            UseApplicationRefreshEffects.ts
            UseApplicationRuntimeComposition.ts
            UseApplicationRuntimeRequestHandlers.ts
            UseApplicationShellComposition.ts
            UseApplicationShellState.ts
            UseApplicationShellStateContracts.ts
            UseApplicationShellViewProperties.ts
            UseApplicationSynchronizationEffects.ts
            UseCoreDataLoaders.ts
            UseEventStreamEffects.ts
            UseMobileSidebarTouchHandlers.ts
            UseViewportShellEffects.ts
            UserInterfaceActionRequestBuilder.ts
          UserInterface/
            AgentFavicon.tsx
            ApiSessionBootstrapOverlay.tsx
            ApplicationHeaderBar.tsx
            ApplicationShellLayout.tsx
        Features/
          Capabilities/
            DataAccess/
              CapabilityApi.ts
              CapabilityServerClient.ts
              CapabilitySnapshotCache.ts
          Chat/
            DataAccess/
              ChatApi.ts
              ChatServerClient.ts
            DomainModel/
              ConversationSyncSignatureBuilder.ts
              ConversationItemFlattener.ts
              ModeSelectionStateResolver.ts
              PendingUserInputAnswerBuilder.ts
              PendingUserInputRequestSelector.ts
              ReadThreadErrorClassifier.ts
            StateManagement/
              ChatRequestActionCoordinator.ts
              ChatScrollStateCoordinator.ts
              CollaborationModeActionCoordinator.ts
              ModeSelectionSyncCoordinator.ts
              ReadThreadStateMerger.ts
              SelectedThreadDataRefreshCoordinator.ts
              SelectedThreadRefreshConcurrencyCoordinator.ts
              UseChatActionHandlers.ts
              UseChatModeToolbarProperties.ts
              UseChatScrollEffects.ts
              UseModeAndPendingRequestEffects.ts
              UseSelectedThreadLifecycleEffects.ts
              UseSelectedThreadLoaders.ts
            UserInterface/
              ChatModeToolbar.tsx
              ChatModeToolbarPropertiesBuilder.ts
              ChatWorkspacePane.tsx
          Threads/
            DataAccess/
              ThreadApi.ts
              ThreadMutationServerClient.ts
              ThreadQueryCache.ts
              ThreadServerClient.ts
            DomainModel/
              ThreadGroupSelectors.ts
              ThreadGroupTypes.ts
            StateManagement/
              PendingThreadMaterializationCoordinator.ts
              ThreadListPresentationStateResolver.ts
              ThreadListStateController.ts
              ThreadListStateStore.ts
              ThreadMutationActionCoordinator.ts
              ThreadRefreshConcurrencyCoordinator.ts
              UseThreadActionHandlers.ts
              UseThreadListPaneProperties.ts
            UserInterface/
              ThreadListActiveSection.tsx
              ThreadListArchivedSection.tsx
              ThreadListEmptyState.tsx
              ThreadListPane.tsx
              ThreadListPaneContracts.ts
              ThreadSidebarPanel.tsx
              ThreadSidebarViewport.tsx
          Debugging/
            DataAccess/
              ClientErrorReporter.ts
              DebugApi.ts
              DebugServerClient.ts
            DomainModel/
              DebugIssueContracts.ts
              DebugIssueDerivation.ts
              DebugIssueStateResolver.ts
              ErrorBannerDetailsParser.ts
            StateManagement/
              DebugWorkspaceActionCoordinator.ts
              DebugWorkspaceDataReader.ts
              DebugWorkspaceStateStore.ts
              TrackedUserInterfaceErrorPolicy.ts
              TrackedUserInterfaceErrorReporter.ts
              UseDebugActionHandlers.ts
            UserInterface/
              DebugHistoryDetailPanel.tsx
              DebugHistoryPanel.tsx
              DebugIssuesPanel.tsx
              DebugStatusBanners.tsx
              DebugStreamEventsPanel.tsx
              DebugTracePanel.tsx
              DebugWorkspacePane.tsx
          PushNotifications/
            DataAccess/
              PushApi.ts
              PushClientApi.ts
              PushClientStateManager.ts
              PushPreferenceStore.ts
              PushServerClient.ts
            DomainModel/
              PushClientContracts.ts
            StateManagement/
              PushNotificationToolbarActionCoordinator.ts
            UserInterface/
              PushStatusButton.tsx
          Theme/
            DataAccess/
              ThemePreferenceStore.ts
            StateManagement/
              UseTheme.ts
        Components/
          UserInterface/
          ChatComposer.tsx
          CodeSnippet.tsx
          ConversationItem.tsx
          StreamEventCard.tsx
        Shared/
          Contracts/
            StructuredDataValue.ts
            ApiContracts.ts
          Errors/
            ErrorMessage.ts
            RequestCanceledError.ts
          Styling/
            ClassNameMerge.ts
          Transport/
            FarfieldHttpTransport.ts
        Main.tsx
        Index.css
      public/
      Tests/
    ServerApplication/
      Source/
        Agents/
          Adapters/
            CodexAgentAdapter.ts
            CodexAppServerStderrOwner.ts
            CodexConnectionLifecycleOwner.ts
            CodexMessageDispatchOwner.ts
            CodexThreadInteractionOwner.ts
            CodexThreadManagementOwner.ts
            CodexThreadStreamStateOwner.ts
            OpenCodeAgentAdapter.ts
          AgentRuntimeOwner.ts
          CliOptions.ts
          Registry.ts
          ThreadAdapterResolver.ts
          ThreadIndex.ts
          Types.ts
        Application/
          Bootstrap/
            ServerBootstrapUtilityOwner.ts
            ServerLifecycleCoordinator.ts
            ThreadListCacheInvalidationOwner.ts
          Configuration/
            ServerRuntimeConfiguration.ts
          StateManagement/
            RuntimeStateOwner.ts
          ServerBootstrap.ts
        Modules/
          Activity/
            ActivityHistoryService.ts
          Debugging/
            ClientErrorStore.ts
          PushNotifications/
            NtfyNotifier.ts
            PushReceiptStore.ts
            PushSendStore.ts
            PushService.ts
            PushStatePath.ts
            PushStore.ts
          Threads/
            CompletionDetector.ts
            ThreadCompletionNotificationService.ts
            ThreadOwner.ts
        Network/
          BrowserSessionAuthOwner.ts
          EventStreamClientRegistry.ts
          PushDispatchConcurrencyCoordinator.ts
          PushTestPayloadOwner.ts
          ServerErrorEventRecorder.ts
          ServerObservabilitySnapshotOwner.ts
          ServerRequestErrorResponder.ts
          ServerRequestHandler.ts
          ServerRequestUtilityOwner.ts
          ServerTransportErrorClassifier.ts
          ThreadConcurrencyCoordinator.ts
          ThreadListAggregationCache.ts
          RequestSchemas/
            HttpSchemas.ts
          Routes/
            AgentRoutes.ts
            CapabilityRoutes.ts
            DebugClientErrorRouteOwner.ts
            DebugFileDownload.ts
            DebugHistoryRouteOwner.ts
            DebugReplayFrameParser.ts
            DebugReplayRouteOwner.ts
            DebugRouteContracts.ts
            DebugRoutes.ts
            DebugTraceRouteOwner.ts
            DebugTypes.ts
            PushRouteContracts.ts
            PushRoutes.ts
            PushTestRouteOwner.ts
            RuntimeRoutes.ts
            ThreadCollectionListQueryOwner.ts
            ThreadCollectionRouteContracts.ts
            ThreadCollectionRoutes.ts
            ThreadMemberArchiveMutationRouteOwner.ts
            ThreadMemberInteractionMutationRouteOwner.ts
            ThreadMemberMessageMutationRouteOwner.ts
            ThreadMemberMutationRouteOwner.ts
            ThreadMemberReadRouteOwner.ts
            ThreadMemberRouteContracts.ts
            ThreadMemberRoutes.ts
            ThreadRoutes.ts
        Shared/
          Logging/
            Logger.ts
      Tests/
  packages/
    CodexProtocol/
      Source/
        Contracts/
          Thread/
            CollaborationModeContracts.ts
            TurnInputContracts.ts
            TurnItemContracts.ts
            UserInputRequestContracts.ts
            ConversationStateContracts.ts
            StreamStateContracts.ts
        Parsers/
          ThreadParsers.ts
        Generated/
        Index.ts
      Tests/
    CodexInterfaceAdapter/
      Source/
        AppServerClient.ts
        AppServerTransport.ts
        Errors.ts
        IpcClient.ts
        JsonRpc.ts
        LiveState.ts
        Service.ts
        Index.ts
      Tests/
    OpenCodeInterfaceAdapter/
      Source/
        Client.ts
        Schemas.ts
        MapperContracts.ts
        SessionMapper.ts
        ConversationTurnMapper.ts
        TurnItemMapper.ts
        EventPayloadMapper.ts
        Mapper.ts
        Service.ts
        Index.ts
      Tests/
  scripts/
    development/
    setup/
    smoke/
    operations/
    tooling/
  end-to-end/
    real/
      fixtures/
      helpers/
      scenarios/
  operations/
    caddy/
  docs/
    decisions/
  public/                # legacy static surface only
  traces/                # runtime artifact only
  .runtime/              # runtime artifact only
```

## Type Architecture (End-State)

1. Every feature and package domain area exposes explicit domain types.
2. Every external payload path defines strict schemas.
3. Every exported function, class method, and service/repository API declares explicit parameter and return types.
4. State owner classes expose typed command/query methods.
5. Transport payloads are mapped to domain types before entering feature logic.
6. Inference is used only for short-lived local implementation details.
7. Data-access boundaries keep full schema-aligned contracts; owner/coordinator boundaries use minimal explicit contracts with only consumed fields.

## Schema Evolution And Versioning (End-State)

1. External contracts use explicit versioning strategy when changing wire shapes.
2. Breaking changes require:
   - version bump
   - migration mapping
   - compatibility notes in documentation
3. Additive changes must preserve strict validation guarantees.
4. Parsers and transport mappers must keep old and new versions isolated by explicit modules/types.
5. Schema evolution changes require dedicated success/failure test coverage.

## Configuration Architecture (End-State)

1. Configuration ownership is explicit under `Application/Configuration`.
2. Runtime configuration is parsed once using strict schemas and exposed as immutable typed objects.
3. Non-configuration modules consume typed configuration via owners and never read raw environment variables.
4. Configuration precedence and defaults are documented in owner modules.
5. Invalid configuration must fail startup clearly.

## Data Ownership Model (End-State)

1. `UserInterface` emits intents.
2. `StateManagement` owns mutable state and orchestration.
3. `DataAccess` owns transport and persistence interaction.
4. `DomainModel` owns pure domain behavior and contracts.
5. Cross-feature/state access is performed through owner APIs only.

## Current Bad Practice Inventory And Prevention

| Concern | Current Example(s) | Risk | End-State Prevention Rule |
| --- | --- | --- | --- |
| Cross-component DOM ID coupling | Resolved in `apps/WebApplication/Source/App.tsx` by replacing `document.getElementById("root")` reads with `applicationShellElementRef` ownership | Hidden coupling and brittle behavior during refactors | Use component-owned refs and explicit owner hooks for node access; keep document-level lookup logic out of feature components |
| Bootstrap-level DOM lookup leakage into feature behavior | `apps/WebApplication/Source/Main.tsx` uses `document.getElementById("boot-splash")` and root mount lookup | Bootstrap patterns can spread into feature code and bypass ownership boundaries | Restrict raw document lookup to bootstrap/composition files only, with zero feature/domain logic attached |
| Non-canonical relative import paths in hand-authored modules | Resolved across non-generated `apps/*` and `packages/*` by removing duplicate relative path segments (`././`, `.././`) | Inconsistent imports reduce readability and create avoidable rename/refactor churn | Keep import specifiers canonical (`./` and `../` only) across hand-authored modules; duplicate relative segments are disallowed |
| Global browser API orchestration concentrated in app shell | `apps/WebApplication/Source/App.tsx` coordinates multiple window/document listeners directly | Hard-to-test side effects and mixed responsibilities | Move listener orchestration into explicit owner hooks/modules with typed APIs and deterministic cleanup |
| Runtime viewport sizing and safe-area CSS variable ownership concentrated in composition helpers | Resolved by extracting viewport metrics/state and CSS variable mutation from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Application/StateManagement/RuntimeViewportSizingCoordinator.ts` | Hidden mutable global state and brittle keyboard/viewport behavior coupling | Keep viewport orientation baselines, keyboard-open detection, and root CSS variable mutation in one explicit coordinator class consumed by composition wiring only |
| Coarse-pointer overscroll guard touch handling concentrated in composition effect | Resolved by extracting touchstart/touchmove overscroll guard behavior from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Application/StateManagement/PageTouchOverscrollGuardCoordinator.ts` | Mobile touch behavior remains brittle and hard to test when gesture ownership is inline | Keep coarse-pointer overscroll guard behavior under one explicit application state-management coordinator with deterministic install/uninstall ownership |
| Event stream connection/reconnect lifecycle concentrated in composition effect | Resolved by extracting EventSource open/error/reconnect and refresh-decision dispatch wiring from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Application/StateManagement/EventStreamConnectionCoordinator.ts` | Reconnect behavior and refresh dispatch can drift and become hard to test | Keep event stream lifecycle and reconnect backoff ownership in one explicit coordinator class with deterministic start/stop boundaries |
| User-interface action request metadata creation duplicated inline across handlers | Resolved by extracting action identifier/request-option construction from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Application/StateManagement/UserInterfaceActionRequestBuilder.ts` | Inconsistent action metadata and request-correlation behavior across handlers | Keep action request metadata creation in one explicit builder class and reuse it across user-interface action handlers |
| Tracked user-interface error reporting duplicated inline across handlers | Resolved by extracting tracked error reporting + banner formatting from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Debugging/StateManagement/TrackedUserInterfaceErrorReporter.ts` | Error reporting behavior drifts and handler code remains branch-heavy | Keep tracked user-interface error reporting in one explicit debugging state-management class with a typed input contract |
| Chat request action orchestration duplicated inline across handlers | Resolved by extracting send/submit/skip/interrupt action orchestration from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Chat/StateManagement/ChatRequestActionCoordinator.ts` | Action handlers become large, repetitive, and harder to keep consistent | Keep chat request action orchestration in one explicit chat state-management coordinator class with typed action inputs and focused tests |
| Collaboration-mode mutation action orchestration duplicated inline in mode-draft handler | Resolved by extracting `set-collaboration-mode` orchestration from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Chat/StateManagement/CollaborationModeActionCoordinator.ts` | Mode mutation flow and signature-sync behavior become harder to reason about and regress more easily | Keep collaboration-mode mutation action orchestration in one explicit chat state-management coordinator class with typed action inputs and focused tests |
| Debug workspace command orchestration duplicated inline across handlers | Resolved by extracting history-detail load, history replay, and trace control command orchestration from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Debugging/StateManagement/DebugWorkspaceActionCoordinator.ts` | Debug action flow is duplicated and harder to keep behavior-consistent under future debug workspace changes | Keep debug workspace command orchestration in one explicit debugging state-management coordinator class with typed action inputs and focused tests |
| Thread mutation action orchestration duplicated inline across handlers | Resolved by extracting create/archive/unarchive action orchestration from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadMutationActionCoordinator.ts` | Thread mutation handlers drift, and selection/cache invalidation behavior becomes inconsistent | Keep thread mutation action orchestration in one explicit threads state-management coordinator class with typed action inputs and focused tests |
| Thread list grouping, archived-section counting, and selected-thread derivation mixed inline in composition state | Resolved by extracting thread list presentation derivation from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListPresentationStateResolver.ts` and `ThreadListStateController` | Grouping/counting behavior can drift from thread-state ownership and make thread sidebar behavior harder to test | Keep thread-list project grouping/selection projection under explicit threads state-management owner APIs and consume snapshots in composition wiring only |
| Mode-selection sync transition branching concentrated in composition effect | Resolved by extracting remote/local mode synchronization transition logic from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Chat/StateManagement/ModeSelectionSyncCoordinator.ts` | Inline branch-heavy synchronization logic becomes hard to reason about and easy to regress | Keep mode-selection sync transitions in one typed state-management coordinator class with explicit transition kinds and focused tests |
| Chat scroll-bottom logic duplicated across effects and handlers | Resolved by extracting bottom-state detection/synchronization and pin-to-bottom behavior from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Chat/StateManagement/ChatScrollStateCoordinator.ts` | Duplicate scroll rules create drift risk and fragile user experience under incremental UI changes | Keep chat scroll-bottom policy in one typed coordinator class and reuse it across keyboard, scroll, resize, and jump-to-latest flows |
| Incremental read-thread merge policy mixed into app composition helpers | Resolved by extracting read-thread merge rules from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Chat/StateManagement/ReadThreadStateMerger.ts` | Turn snapshot consistency rules can drift across call sites and become hard to test | Keep partial-read merge policy in one typed state-merger owner class and reuse across selected-thread refresh paths |
| Conversation item renderability and flat-list derivation mixed into app composition helpers | Resolved by extracting item visibility rules and flattening derivation from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Chat/DomainModel/ConversationItemFlattener.ts` | Chat rendering rules can diverge and become difficult to test/refactor | Keep item render-filter policy and flattening/layout derivation in a dedicated chat domain owner class reused by composition state |
| Pending user-input answer payload derivation duplicated inline in submit handler | Resolved by extracting question/draft-to-payload mapping from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Chat/DomainModel/PendingUserInputAnswerBuilder.ts` | Handler complexity grows and answer-derivation rules are harder to test | Keep pending user-input answer payload derivation in one typed chat domain class reused by request-submission handlers |
| Storage access without feature ownership boundary | Resolved by introducing `ThemePreferenceStore` and `PushPreferenceStore` owner classes in feature data-access folders | Inconsistent storage ownership and lifecycle guarantees | Introduce feature-owned storage adapters/stores in `DataAccess` and expose typed read/write methods only |
| Push client refresh/enable orchestration concentrated inline in composition handlers | Resolved by extracting push toolbar refresh/enable orchestration from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/PushNotifications/StateManagement/PushNotificationToolbarActionCoordinator.ts` and `PushClientStateManager.ts` | Push user-interface behavior and client-capability handling can drift across handlers and become harder to test | Keep push client refresh and enable orchestration in explicit push state-management/data-access owner classes with typed owner APIs |
| Push notification enable button rendering and interaction policy inline in composition header | Resolved by extracting push status/enable button rendering from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/PushNotifications/UserInterface/PushStatusButton.tsx` | Header composition remains crowded and push presentation logic can drift from push feature ownership | Keep push notification toolbar rendering under push feature `UserInterface` ownership with typed props and focused tests |
| Top header bar rendering and header action wiring concentrated inline in app composition | Resolved by extracting top header bar composition from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Application/UserInterface/ApplicationHeaderBar.tsx` | App composition remains crowded and top-bar interaction wiring can drift from application UI ownership | Keep top header bar rendering and header action wiring in one explicit application user-interface component with typed props and focused tests |
| Chat mode/model/reasoning toolbar rendering and interaction policy concentrated inline in chat composer section | Resolved by extracting chat mode toolbar composition from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Chat/UserInterface/ChatModeToolbar.tsx` | Chat surface composition remains crowded and mode-control behavior can drift from chat feature ownership | Keep chat mode/model/reasoning toolbar rendering and typed interaction wiring under chat feature `UserInterface` ownership with focused tests |
| Chat surface shell composition (conversation container, empty states, jump-to-bottom control, pending-input card, and composer region) concentrated inline in app composition | Resolved by extracting chat surface shell composition from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Chat/UserInterface/ChatWorkspacePane.tsx` | App composition remains crowded and chat-surface rendering/interaction wiring can drift across future changes | Keep chat workspace shell composition under chat feature `UserInterface` ownership with typed props and focused tests |
| Desktop/mobile thread sidebar viewport wrapper markup duplicated inline in app composition | Resolved by extracting sidebar viewport animation + shell wrappers from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadSidebarViewport.tsx` | Repeated sidebar wrapper logic can drift across viewports and increase composition complexity | Keep thread sidebar viewport wrapper composition under thread feature `UserInterface` ownership with typed props and focused tests |
| Shared API contracts (for example `AgentId` and action request options) imported from transport implementation module | Resolved by moving shared API contracts from `apps/WebApplication/Source/SharedUtilities/api.ts` into `apps/WebApplication/Source/Shared/Contracts/ApiContracts.ts` and updating feature imports | Feature modules become coupled to transport implementation details and contract ownership remains unclear | Keep shared cross-feature request/identifier contracts under explicit shared contracts ownership, and keep transport modules focused on request execution |
| Cross-module request/response contracts inferred through type-introspection helpers | Resolved by introducing explicit named API request/response contracts in `apps/WebApplication/Source/SharedUtilities/api.ts` and replacing `Parameters`/`ReturnType` usage across web feature/application modules | Contract shapes become implicit, test doubles drift, and module boundaries are harder to reason about | Keep cross-module contracts as explicitly named request/response types and avoid `Parameters`/`ReturnType` helper derivation for public module APIs |
| Monolithic transport file owns both request execution and unrelated feature endpoint schemas/functions | Resolved by extracting shared request execution into `apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransport.ts` and moving debug/push endpoint ownership into feature data-access modules (`DebugApi`, `PushApi`) | One oversized transport file slows refactors and increases cross-feature change risk | Keep shared request execution in shared transport ownership and keep endpoint schemas/functions under feature `DataAccess` ownership |
| Thread sidebar shell layout and footer status rendering concentrated inline in app composition | Resolved by extracting sidebar shell composition from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadSidebarPanel.tsx` | App composition remains crowded and thread-sidebar presentation behavior can drift from thread feature ownership | Keep thread sidebar shell/layout composition and thread-sidebar status footer rendering under thread feature `UserInterface` ownership |
| Domain selectors owned by generic transport helper modules | Resolved by moving pending user-input request selection from `lib/api.ts` to `Features/Chat/DomainModel/PendingUserInputRequestSelector.ts` | Mixed transport/domain concerns and harder modular testing | Keep domain selectors and derivations inside feature `DomainModel` modules only |
| Monolithic debug workspace rendering in app composition file | Resolved by extracting debug workspace shell composition (`DebugWorkspacePane`) and section panels (`DebugIssuesPanel`, `DebugHistoryDetailPanel`, `DebugStreamEventsPanel`, and `DebugTracePanel`) from `apps/WebApplication/Source/App.tsx` into feature `UserInterface` ownership | Oversized composition file and tightly coupled debug user interface changes | Keep debug workspace shell and section panels under `Features/Debugging/UserInterface/*` with `App.tsx` focused on composition and wiring |
| Error and live-state warning banner rendering concentrated inline in app composition file | Resolved by extracting error and live-state warning banner rendering from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Debugging/UserInterface/DebugStatusBanners.tsx` | App composition remains crowded and banner behavior can drift from debugging feature ownership | Keep error and live-state warning banner rendering under debugging feature `UserInterface` ownership with typed props and focused tests |
| Debug issue derivation, filtering, and selection policy concentrated inline in composition state | Resolved by extracting debug issue derivation/filtering/selection ownership from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Features/Debugging/DomainModel/DebugIssueStateResolver.ts` | Debug issue policy can drift across memo/effect branches and become harder to test | Keep debug issue derivation/filtering/selection policy in a dedicated debugging domain owner class consumed by composition wiring |

### User Interface Interaction Prevention Rules (End-State)

1. Component communication uses props, explicit context, and owner-managed shared state.
2. DOM node access uses typed refs local to component/hook ownership.
3. `id` and selector-based cross-component lookup is prohibited for application behavior.
4. `id` values remain allowed for accessibility labels and controlled integration points only.
5. Feature modules may not use the DOM as the source of truth for mutable state.
6. Global listeners and document/window operations are owned by dedicated modules, not large screen components.

## Ownership Contracts (End-State)

1. Every state, cache, and persistence surface has one explicit owner class/module.
2. Owner contracts must document:
   - owner name
   - owner file path
   - mutation/query methods
   - lifecycle scope
3. Non-owner modules never mutate owned state directly.
4. Routes and user-interface modules orchestrate owner modules and remain thin.
5. Ownership changes require updates to this document and `docs/architecture.md` together.

## Configuration Ownership Registry (End-State)

| Area | Configuration Owner | Owner File (Target) | Scope |
| --- | --- | --- | --- |
| Web runtime behavior configuration | `ApplicationBehaviorConfiguration` | `apps/WebApplication/Source/Application/Configuration/ApplicationBehaviorConfiguration.ts` | browser runtime (non-secret values only) |
| Server runtime configuration | `ServerRuntimeConfiguration` | `apps/ServerApplication/Source/Application/Configuration/ServerRuntimeConfiguration.ts` | process runtime |
| Codex app-server spawn environment configuration | `buildAppServerSpawnEnvironment` | `packages/CodexInterfaceAdapter/Source/AppServerTransport.ts` | child-process runtime |

## State Ownership Registry (End-State)

| Area | Mutable State Owner | Owner File (Target) | Access Pattern |
| --- | --- | --- | --- |
| Web application shell state | `useApplicationShellState` | `apps/WebApplication/Source/Application/StateManagement/UseApplicationShellState.ts` | typed state + ref ownership surface |
| Web pending thread materialization state | `PendingThreadMaterializationCoordinator` | `apps/WebApplication/Source/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator.ts` | typed owner API for mark/clear/read pending materialization keys |
| Web chat request action orchestration | `ChatRequestActionCoordinator` | `apps/WebApplication/Source/Features/Chat/StateManagement/ChatRequestActionCoordinator.ts` | typed owner API for send/submit/skip/interrupt user-intent actions |
| Web collaboration-mode mutation action orchestration | `CollaborationModeActionCoordinator` | `apps/WebApplication/Source/Features/Chat/StateManagement/CollaborationModeActionCoordinator.ts` | typed owner API for `set-collaboration-mode` mutation orchestration |
| Web chat scroll-bottom state policy | `ChatScrollStateCoordinator` | `apps/WebApplication/Source/Features/Chat/StateManagement/ChatScrollStateCoordinator.ts` | typed owner API for bottom detection/synchronization and pin-to-bottom behavior |
| Web tracked user-interface error banner state policy | `TrackedUserInterfaceErrorReporter` | `apps/WebApplication/Source/Features/Debugging/StateManagement/TrackedUserInterfaceErrorReporter.ts` | typed owner API for tracked error reporting and banner message updates |
| Web debug workspace command orchestration | `DebugWorkspaceActionCoordinator` | `apps/WebApplication/Source/Features/Debugging/StateManagement/DebugWorkspaceActionCoordinator.ts` | typed owner API for history-detail load, history replay, and trace control commands |
| Web debug issue derivation/filter/selection policy | `DebugIssueStateResolver` | `apps/WebApplication/Source/Features/Debugging/DomainModel/DebugIssueStateResolver.ts` | typed owner API for issue derivation, filtering, and selected-issue state projection |
| Web thread list state | `ThreadListStateController` | `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListStateController.ts` | typed commands + selectors |
| Web thread list presentation derivation | `ThreadListPresentationStateResolver` | `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListPresentationStateResolver.ts` | typed owner API for grouped project sections, selected-thread projection, and archived section counts |
| Web thread mutation action orchestration | `ThreadMutationActionCoordinator` | `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadMutationActionCoordinator.ts` | typed owner API for create/archive/unarchive action orchestration |
| Web push toolbar action orchestration | `PushNotificationToolbarActionCoordinator` | `apps/WebApplication/Source/Features/PushNotifications/StateManagement/PushNotificationToolbarActionCoordinator.ts` | typed owner API for push-client refresh and enable actions |
| Web runtime viewport sizing state | `RuntimeViewportSizingCoordinator` | `apps/WebApplication/Source/Application/StateManagement/RuntimeViewportSizingCoordinator.ts` | typed owner API for viewport metrics and CSS variable mutation |
| Web API session bootstrap state | `ApiSessionBootstrapCoordinator` | `apps/WebApplication/Source/Application/StateManagement/ApiSessionBootstrapCoordinator.ts` | typed owner API for auth requirement detection, token challenge state, and session freshness decisions |
| Server push subscription + completion-watermark state | `PushStore` | `apps/ServerApplication/Source/Modules/PushNotifications/PushStore.ts` | typed owner API over persisted subscriptions/watermarks |
| Server push send history state | `PushSendStore` | `apps/ServerApplication/Source/Modules/PushNotifications/PushSendStore.ts` | typed owner API for latest push-send status snapshot |
| Server push receipt history state | `PushReceiptStore` | `apps/ServerApplication/Source/Modules/PushNotifications/PushReceiptStore.ts` | typed owner API for bounded receipt timeline |
| Server client error session state | `ClientErrorStore` | `apps/ServerApplication/Source/Modules/Debugging/ClientErrorStore.ts` | typed owner API for append/read session errors |
| Server agent runtime composition state | `AgentRuntimeOwner` | `apps/ServerApplication/Source/Agents/AgentRuntimeOwner.ts` | typed owner API |
| Server thread adapter resolution state | `ThreadAdapterResolver` | `apps/ServerApplication/Source/Agents/ThreadAdapterResolver.ts` | typed service API |
| Server runtime snapshot state | `RuntimeStateOwner` | `apps/ServerApplication/Source/Application/StateManagement/RuntimeStateOwner.ts` | typed owner API for runtime status snapshots |
| Server activity history state | `ActivityHistoryService` | `apps/ServerApplication/Source/Modules/Activity/ActivityHistoryService.ts` | typed service API |
| Server completion detection state | `CompletionDetector` | `apps/ServerApplication/Source/Modules/Threads/CompletionDetector.ts` | typed detection policy owner |
| Server thread completion notification state | `ThreadCompletionNotificationService` | `apps/ServerApplication/Source/Modules/Threads/ThreadCompletionNotificationService.ts` | typed orchestration service API |

## Cache Ownership Registry (End-State)

| Area | Cache Owner | Owner File (Target) | Cache Contract |
| --- | --- | --- | --- |
| Web capability snapshot cache | `CapabilitySnapshotCache` | `apps/WebApplication/Source/Features/Capabilities/DataAccess/CapabilitySnapshotCache.ts` | short-lived modes/models/defaults snapshot cache with freshness window and single-flight refresh |
| Web thread query cache | `ThreadQueryCache` | `apps/WebApplication/Source/Features/Threads/DataAccess/ThreadQueryCache.ts` | typed key/value, TTL + explicit invalidation |
| Web thread list persisted snapshot cache | `ThreadListSnapshotIndexedDatabaseStore` | `apps/WebApplication/Source/Features/Threads/DataAccess/ThreadListSnapshotIndexedDatabaseStore.ts` | bounded IndexedDB snapshot cache keyed by thread-list cache key with explicit per-key invalidation |
| Web selected-thread persisted snapshot cache | `SelectedThreadSnapshotIndexedDatabaseStore` | `apps/WebApplication/Source/Features/Chat/DataAccess/SelectedThreadSnapshotIndexedDatabaseStore.ts` | bounded IndexedDB snapshot cache keyed by thread identifier for startup hydration |
| Web push preference storage | `PushPreferenceStore` | `apps/WebApplication/Source/Features/PushNotifications/DataAccess/PushPreferenceStore.ts` | typed browser storage adapter + key ownership |
| Web theme preference storage | `ThemePreferenceStore` | `apps/WebApplication/Source/Features/Theme/DataAccess/ThemePreferenceStore.ts` | typed browser storage adapter + key ownership |
| Server thread list aggregation cache | `ThreadListAggregationCache` | `apps/ServerApplication/Source/Network/ThreadListAggregationCache.ts` | bounded in-memory merged-thread cache with explicit invalidation and single-flight loads |
| Server push receipt history storage | `PushReceiptStore` | `apps/ServerApplication/Source/Modules/PushNotifications/PushReceiptStore.ts` | bounded append-only store with max count + max age pruning |
| Server push send history storage | `PushSendStore` | `apps/ServerApplication/Source/Modules/PushNotifications/PushSendStore.ts` | latest-send snapshot owner for diagnostics and visibility |

## Concurrency Ownership Registry (End-State)

| Area | Concurrency Owner | Owner File (Target) | Concurrency Contract |
| --- | --- | --- | --- |
| Web core-data refresh orchestration | `CoreDataRefreshConcurrencyCoordinator` | `apps/WebApplication/Source/Application/StateManagement/CoreDataRefreshConcurrencyCoordinator.ts` | queued refresh coalescing with deterministic looped execution under a single in-flight owner |
| Web event-stream refresh scheduling | `EventRefreshScheduler` | `apps/WebApplication/Source/Application/StateManagement/EventRefreshScheduler.ts` | debounced flag coalescing and deterministic scheduled refresh dispatch |
| Web event-stream connection lifecycle | `EventStreamConnectionCoordinator` | `apps/WebApplication/Source/Application/StateManagement/EventStreamConnectionCoordinator.ts` | EventSource open/error handling with reconnect backoff and refresh-decision dispatch coordination |
| Web API session bootstrap requests | `ApiSessionBootstrapCoordinator` | `apps/WebApplication/Source/Application/StateManagement/ApiSessionBootstrapCoordinator.ts` | single-flight bootstrap requests with freshness-aware reuse and explicit token-challenge gating |
| Web selected-thread refresh hydration | `SelectedThreadRefreshConcurrencyCoordinator` | `apps/WebApplication/Source/Features/Chat/StateManagement/SelectedThreadRefreshConcurrencyCoordinator.ts` | queued refresh merge + thread-switch cancellation + stale-request suppression |
| Web thread refresh | `ThreadRefreshConcurrencyCoordinator` | `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadRefreshConcurrencyCoordinator.ts` | single-flight per thread identifier |
| Server thread list aggregation reads | `ThreadListAggregationCache` | `apps/ServerApplication/Source/Network/ThreadListAggregationCache.ts` | single-flight by query key and deterministic stale-write protection |
| Server push dispatch | `PushDispatchConcurrencyCoordinator` | `apps/ServerApplication/Source/Network/PushDispatchConcurrencyCoordinator.ts` | deterministic per-thread completion-check scheduling |
| Server push send fan-out | `PushService` | `apps/ServerApplication/Source/Modules/PushNotifications/PushService.ts` | bounded concurrent send workers with retry/backoff per subscription |
| Server thread concurrency | `ThreadConcurrencyCoordinator` | `apps/ServerApplication/Source/Network/ThreadConcurrencyCoordinator.ts` | per-thread serialization and stale-update protection |
| Server event stream clients | `EventStreamClientRegistry` | `apps/ServerApplication/Source/Network/EventStreamClientRegistry.ts` | centralized client lifecycle and broadcast coordination |

## Cache Architecture (End-State)

1. Cache ownership is explicit and singular.
2. Cache keys and entries are strict typed contracts.
3. Every cache defines:
   - invalidation strategy
   - size bounds
   - staleness policy
   - refresh trigger strategy
4. Duplicate in-flight reads of the same key are coalesced by cache owner or concurrency owner.
5. Cache mutation occurs only through owner APIs.
6. Cache observability is available for debugging and diagnostics.
7. Broad refresh helpers do not invalidate cache entries; invalidation is mutation-scoped and owned by mutation flows.
8. Stream-event owners must expose cursor metadata (`nextSequence`, `firstAvailableSequence`, `resetRequired`) so client owners can apply deterministic append-or-reset merge behavior.

## Web Caching, Persistence, and Background Refresh Strategy (End-State)

| Surface | Owner | Immediate Path | Non-Blocking Update Path | Persistence Tier |
| --- | --- | --- | --- | --- |
| Thread list query results | `ThreadListStateController` + `ThreadQueryCache` + `ThreadListSnapshotIndexedDatabaseStore` | Render in-memory cache first, then hydrate from persisted snapshot when memory is empty | `ThreadRefreshConcurrencyCoordinator` performs background refresh and applies delta-or-full state updates | process memory + browser indexed storage |
| Thread conversation live state | `UseApplicationShellState` + `SelectedThreadDataRefreshCoordinator` + `SelectedThreadSnapshotIndexedDatabaseStore` | Render latest owner state snapshot and hydrate selected-thread snapshot cache on thread selection | event-stream processing and selected-thread refresh coordinators update state incrementally and persist refreshed snapshots asynchronously | process memory + browser indexed storage |
| Thread stream-event timeline state | `UseSelectedThreadLoaders` + `SelectedThreadDataRefreshCoordinator` | Reuse in-memory event timeline and cursor for immediate render | cursor-based `stream-events` reads append unseen deltas and issue full reset only when `resetRequired` is returned | process memory |
| Models, collaboration modes, and defaults | `CapabilitySnapshotCache` with `CapabilityServerClient` | Reuse short-lived in-memory capability snapshot | periodic background revalidation with single-flight per capability query | process memory |
| API session bootstrap state | `ApiSessionBootstrapCoordinator` | Reuse in-memory auth/session bootstrap decision snapshot | refresh bootstrap only when session freshness threshold is reached or token challenge is resolved | process memory |
| Debug issue list and history list | `DebugWorkspaceStateStore` + `DebugWorkspaceDataReader` | Render cached debug view state when debug workspace is active | background refresh only when debug workspace is visible or explicitly requested | process memory |
| Theme and user-facing local preferences | feature preference store owners | Read once at startup for immediate paint | write-through on user change with no blocking network dependency | browser local storage |
| Push subscription metadata needed for offline delivery | push feature data-access owner | Initialize from owned browser storage adapter | service worker and push owner synchronize registration status in background | browser indexed storage |

Rules for this strategy:

1. Caches return immediately when fresh, then owners may revalidate asynchronously when user experience benefits from freshness.
2. Background refresh work must be single-flight per key and cancelable when user intent changes.
3. Optimistic updates are allowed for user-triggered mutations when owner modules can reconcile server truth without data corruption.
4. Persistent storage is reserved for durable preferences, offline-required metadata, and bounded snapshot records that improve startup hydration.
5. Owner modules must document stale-duration assumptions and invalidation triggers for each surface.

## Data Lifecycle Model (End-State)

1. Data lifecycle is explicit from ingestion to deletion:
   - ingest/validate
   - map into domain types
   - store/cache under owner modules
   - read/query through owner APIs
   - eviction/retention enforcement
2. Each persisted surface defines retention and pruning strategy.
3. Each cache surface defines TTL and eviction bounds.
4. Lifecycle transitions are observable through owner-level logs/metrics.
5. Deletion/cleanup flows are owner-managed and tested.

## Concurrency Architecture (End-State)

1. Concurrency behavior is controlled by explicit coordinator classes.
2. Shared-key operations use deterministic sequencing or conflict resolution.
3. Cancellation is propagated through typed APIs.
4. Out-of-order completion handling is explicit; stale responses cannot overwrite newer state.
5. Retries and repeated side effects use idempotent contracts.
6. Background refresh jobs use single-flight coordination by scope/key.

## Security Architecture (End-State)

1. Trust boundaries are explicit across browser, server, and external systems.
2. Secret material remains server-side under configuration owners.
3. Route boundaries enforce authentication/authorization before mutation.
4. Logs/traces redact sensitive fields.
5. Security-relevant module ownership is explicit and reviewed with architecture changes.

## Error And Observability Architecture (End-State)

1. Error categories are explicit and typed at module boundaries.
2. Route/transport boundaries map typed errors to stable response envelopes.
3. Owner modules emit structured logs and metrics with correlation metadata.
4. Cache owners emit hit/miss/invalidation/eviction visibility.
5. Concurrency owners emit in-flight/queue/contention visibility.
6. Debug and observability surfaces remain under explicit ownership and access controls.

## Dependency Management (End-State)

1. Each dependency has explicit owner and justification.
2. Cross-application reusable logic is promoted into shared packages.
3. Internal package boundaries are consumed through public APIs only.
4. Duplicate dependency usage for the same concern is minimized and documented when unavoidable.

## Size and Complexity Budgets (End-State)

1. Preferred file limit: 400 lines.
2. Hard file limit: 600 lines.
3. Cohesive owner classes may approach the hard limit when methods remain focused and readable.
4. Preferred function/method limit: 120 lines.
5. Hard function/method limit: 300 lines with rare documented exceptions.
6. Modules with multiple ownership reasons must be split.

## Performance Budgets (End-State)

1. Critical flows define measurable latency and throughput expectations by owner module.
2. Cache owners define target hit-rate and bounded memory/entry limits.
3. Concurrency owners define bounded in-flight work per key/scope.
4. Performance exceptions include documented rationale and owner accountability.

## Current-To-End-State Mapping (Verified Ownership Mapping)

This table maps legacy concentration points to the currently implemented owner paths.
Listed implemented paths are expected to exist in the repository.

| Legacy / Transition Path | Implemented Owner Path |
| --- | --- |
| `apps/WebApplication/Source/Main.tsx` | `apps/WebApplication/Source/Main.tsx` + `apps/WebApplication/Source/Application/Boot/*` |
| `apps/WebApplication/Source/App.tsx` | `apps/WebApplication/Source/App.tsx` + `apps/WebApplication/Source/Application/StateManagement/*` + `apps/WebApplication/Source/Application/UserInterface/*` |
| `apps/WebApplication/Source/Application/DataAccess/WebShellApi.ts` | `apps/WebApplication/Source/Application/DataAccess/WebShellApi.ts` |
| `apps/WebApplication/Source/SharedUtilities/Push.ts` | `apps/WebApplication/Source/Features/PushNotifications/DataAccess/PushApi.ts` + `apps/WebApplication/Source/Features/PushNotifications/DataAccess/PushClientApi.ts` + `apps/WebApplication/Source/Features/PushNotifications/DataAccess/PushClientStateManager.ts` + `apps/WebApplication/Source/Features/PushNotifications/DataAccess/PushServerClient.ts` + `apps/WebApplication/Source/Features/PushNotifications/DomainModel/PushClientContracts.ts` |
| `apps/WebApplication/Source/SharedUtilities/ClientErrors.ts` | `apps/WebApplication/Source/Application/Boot/InstallClientErrorReporter.ts` + `apps/WebApplication/Source/Features/Debugging/DataAccess/ClientErrorReporter.ts` |
| `apps/WebApplication/Source/SharedUtilities/DebugHelpers.ts` | `apps/WebApplication/Source/Features/Debugging/DomainModel/DebugIssueContracts.ts` + `apps/WebApplication/Source/Features/Debugging/DomainModel/DebugIssueDerivation.ts` + `apps/WebApplication/Source/Features/Debugging/DomainModel/ErrorBannerDetailsParser.ts` + `apps/WebApplication/Source/Features/Debugging/StateManagement/TrackedUserInterfaceErrorPolicy.ts` + `apps/WebApplication/Source/Shared/Errors/ErrorMessage.ts` + `apps/WebApplication/Source/Features/Chat/DomainModel/ReadThreadErrorClassifier.ts` |
| `apps/WebApplication/Source/SharedUtilities/Utils.ts` | `apps/WebApplication/Source/Shared/Styling/ClassNameMerge.ts` |
| `apps/WebApplication/Source/SharedUtilities/thread-groups.ts` | `apps/WebApplication/Source/Features/Threads/DomainModel/ThreadGroupTypes.ts` + `apps/WebApplication/Source/Features/Threads/DomainModel/ThreadGroupSelectors.ts` |
| `apps/WebApplication/Source/Hooks/UseTheme.ts` | `apps/WebApplication/Source/Features/Theme/StateManagement/UseTheme.ts` |
| `apps/ServerApplication/Source/Index.ts` | `apps/ServerApplication/Source/Application/ServerBootstrap.ts` |
| `apps/ServerApplication/Source/Agents/agent-runtime-owner.ts` | `apps/ServerApplication/Source/Agents/AgentRuntimeOwner.ts` |
| `apps/ServerApplication/Source/Network/server-request-handler.ts` | `apps/ServerApplication/Source/Network/ServerRequestHandler.ts` |
| `apps/ServerApplication/Source/Network/Routes/debug-types.ts` | `apps/ServerApplication/Source/Network/Routes/DebugTypes.ts` |
| `apps/ServerApplication/Source/Network/Routes/debug-file-download.ts` | `apps/ServerApplication/Source/Network/Routes/DebugFileDownload.ts` |
| `apps/ServerApplication/Source/Network/ServerTransportErrorClassifier.ts` | `apps/ServerApplication/Source/Network/ServerTransportErrorClassifier.ts` |
| `apps/ServerApplication/Source/Network/ServerObservabilitySnapshotOwner.ts` | `apps/ServerApplication/Source/Network/ServerObservabilitySnapshotOwner.ts` |
| `apps/ServerApplication/Source/Network/ServerRequestUtilityOwner.ts` | `apps/ServerApplication/Source/Network/ServerRequestUtilityOwner.ts` |
| `apps/ServerApplication/Source/Network/PushTestPayloadOwner.ts` | `apps/ServerApplication/Source/Network/PushTestPayloadOwner.ts` |
| `apps/ServerApplication/Source/Network/ServerErrorEventRecorder.ts` | `apps/ServerApplication/Source/Network/ServerErrorEventRecorder.ts` |
| `apps/ServerApplication/Source/ServerRuntimeConfiguration.ts` | `apps/ServerApplication/Source/Application/Configuration/ServerRuntimeConfiguration.ts` |
| `apps/ServerApplication/Source/ServerLifecycleCoordinator.ts` | `apps/ServerApplication/Source/Application/Bootstrap/ServerLifecycleCoordinator.ts` |
| `apps/ServerApplication/Source/HttpSchemas.ts` | `apps/ServerApplication/Source/Network/RequestSchemas/HttpSchemas.ts` |
| `apps/ServerApplication/Source/Push*.ts` and `apps/ServerApplication/Source/PushService.ts` | `apps/ServerApplication/Source/Modules/PushNotifications/{PushStore.ts,PushReceiptStore.ts,PushSendStore.ts,PushService.ts,PushStatePath.ts,NtfyNotifier.ts}` |
| `apps/ServerApplication/Source/CompletionDetector.ts` | `apps/ServerApplication/Source/Modules/Threads/CompletionDetector.ts` |
| `apps/ServerApplication/Source/ThreadOwner.ts` | `apps/ServerApplication/Source/Modules/Threads/ThreadOwner.ts` |
| `packages/CodexProtocol/Source/*` | `packages/CodexProtocol/Source/Contracts/*` and `packages/CodexProtocol/Source/Parsers/*` |
| `packages/CodexInterfaceAdapter/Source/*` | `packages/CodexInterfaceAdapter/Source/{AppServerClient.ts,AppServerTransport.ts,Errors.ts,IpcClient.ts,JsonRpc.ts,LiveState.ts,Service.ts,Index.ts}` |
| `packages/OpenCodeInterfaceAdapter/Source/*` | `packages/OpenCodeInterfaceAdapter/Source/{Client.ts,Schemas.ts,MapperContracts.ts,SessionMapper.ts,ConversationTurnMapper.ts,TurnItemMapper.ts,EventPayloadMapper.ts,Mapper.ts,Service.ts,Index.ts}` |

## Concrete Refactor Scope (Execution Reference)

This execution reference captures an ownership-focused scope that was completed and remains the template for future structural moves.

### Slice Name

`Web Threads Ownership Extraction`

### Source Concentration To Break Up

1. `apps/WebApplication/Source/App.tsx`
2. `apps/WebApplication/Source/SharedUtilities/api.ts`
3. `apps/WebApplication/Source/SharedUtilities/thread-groups.ts`

### Target Ownership Surfaces

1. `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListStateController.ts`
2. `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListStateStore.ts`
3. `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadListPresentationStateResolver.ts`
4. `apps/WebApplication/Source/Features/Threads/StateManagement/ThreadRefreshConcurrencyCoordinator.ts`
5. `apps/WebApplication/Source/Features/Threads/DataAccess/ThreadServerClient.ts`
6. `apps/WebApplication/Source/Features/Threads/DataAccess/ThreadQueryCache.ts`
7. `apps/WebApplication/Source/Features/Threads/DomainModel/ThreadGroupTypes.ts`
8. `apps/WebApplication/Source/Features/Threads/DomainModel/ThreadGroupSelectors.ts`
9. `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadListPane.tsx`
10. `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadSidebarPanel.tsx`
11. `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadSidebarViewport.tsx`

### Slice Checklist

- [x] Extract thread listing, grouping, and selection state from `App.tsx` into `ThreadListStateController` and `ThreadListPresentationStateResolver`.
- [x] Move thread-related data transport from `apps/WebApplication/Source/SharedUtilities/api.ts` into `ThreadServerClient`.
- [x] Introduce `ThreadQueryCache` with typed keys, invalidation, and bounds.
- [x] Introduce `ThreadRefreshConcurrencyCoordinator` with single-flight and stale-completion protection.
- [x] Move thread grouping/transforms into `ThreadGroupTypes` and `ThreadGroupSelectors`.
- [x] Remove `apps/WebApplication/Source/SharedUtilities/thread-groups.ts` and keep thread grouping/unread derivation logic under `Features/Threads/DomainModel`.
- [x] Extract active/archived thread loading orchestration into `ThreadListStateController`.
- [x] Move initial thread selection hydration ownership from `App.tsx` into `ThreadListStateStore`.
- [x] Move selected-thread unread-marker mutation ownership from `App.tsx` into `ThreadListStateStore`.
- [x] Enforce `ThreadQueryCache` bounds with deterministic least-recently-used eviction.
- [x] Extract sidebar thread list rendering from `App.tsx` into `ThreadListPane`.
- [x] Extract thread sidebar shell composition (header + list panel + footer status) from `App.tsx` into `ThreadSidebarPanel`.
- [x] Keep `apps/WebApplication/Source/App.tsx` as composition/wiring only for thread feature integration.
- [x] Add or move tests to cover thread state ownership, cache behavior, and concurrency behavior.
- [x] Ensure each new file and function follows size budgets or has documented exception notes.

### Out Of Immediate Scope (Current)

All previously deferred App extraction items are now complete.

## Cleanup Progress Tracker

Use this checklist as the single at-a-glance cleanup tracker.

### Current Completion Snapshot

- Date: 2026-02-24
- Checklist completion: 296 / 296 items (`100%`)
- Pull request review-thread status (`MatthewFrench/farfield#1`): `0` unresolved review threads (verified via `gh api graphql` audit on 2026-02-24).

### Realistic End-State Estimate (Holistic)

- Estimated overall completion: `100%`
- Basis:
  - Checklist execution is complete (`296 / 296`) with no open checklist items.
  - Detailed tree is illustrative; completion is tracked against the verified ownership mapping and checklist entries.
  - Source-file PascalCase conformance is complete for non-generated source.
  - Source-directory PascalCase-path conformance is complete for non-generated source.
  - Root-folder abbreviation cleanup is complete for structural roots (`e2e` -> `end-to-end`, `ops` -> `operations`).
  - Test-file PascalCase conformance is complete across `apps/*/Tests` and `packages/*/Tests`, including owner-aligned naming.
  - `apps/WebApplication/Source/App.tsx` runtime orchestration ownership was further extracted into `UseApplicationRuntimeComposition.ts`, reducing `App.tsx` from 552 to 298 lines while keeping feature/effect/shell assembly under explicit application state-management ownership.
  - Source-size conformance now satisfies both hard and preferred thresholds (`0` source files over 600 lines and `0` source files over 400 lines).
  - Broad `refreshAll` ownership has been removed from web source; startup and manual refresh paths now run through explicit runtime-owned core + selected-thread refresh orchestration.

### Remaining Work Themes (Share of Remaining Effort)

1. `100%` Ongoing governance and drift control:
   - keep architecture/proposal documents synchronized with future refactors
   - enforce owner boundaries and naming rules during new feature work

### Foundations

- [x] Architecture standards document includes ownership, cache, concurrency, and size rules.
- [x] Proposed end-state structure includes owner registries and target file layout.
- [x] Naming rules include PascalCase source paths and no abbreviations.
- [x] Cross-module source contracts no longer rely on type-introspection utilities; explicit named contracts are used instead.
- [x] Agent governance now links architecture/proposal standards, includes repository structure guidance, and enforces owner-aligned PascalCase test naming.
- [x] Governance requires high-value unit tests and high-value comments when modifying non-trivial function logic.

### Web Application Cleanup

- [x] Introduce initial Threads ownership modules (`ThreadServerClient`, `ThreadQueryCache`, `ThreadRefreshConcurrencyCoordinator`, `ThreadListStateStore`, `ThreadListStateController`).
- [x] Introduce bounded thread query cache ownership (`ThreadQueryCache`) with explicit eviction behavior.
- [x] Move thread grouping and unread derivation ownership from `apps/WebApplication/Source/SharedUtilities/thread-groups.ts` into `Features/Threads/DomainModel`.
- [x] Move initial thread selection hydration ownership into `ThreadListStateStore`.
- [x] Move selected-thread unread-marker mutation ownership into `ThreadListStateStore`.
- [x] Extract sidebar thread list rendering into dedicated `ThreadListPane` component ownership.
- [x] Extract thread sidebar shell composition (header + list panel + footer status) from `App.tsx` into `ThreadSidebarPanel`.
- [x] Extract thread sidebar viewport wrappers (desktop/mobile animation shells) from `App.tsx` into `ThreadSidebarViewport`.
- [x] Move thread grouping/project-section derivation, archived-section count, and selected-thread projection into `ThreadListPresentationStateResolver` consumed through `ThreadListStateController`.
- [x] Replace `document.getElementById`-based runtime behavior in `apps/WebApplication/Source/App.tsx` with explicit ref-owned hooks/modules.
- [x] Move browser storage ownership for theme and push preferences into feature data-access owner classes.
- [x] Move theme hook ownership from top-level `Hooks/UseTheme.ts` into `Features/Theme/StateManagement/UseTheme.ts` and remove the generic hooks bucket.
- [x] Move shared API contracts (`AgentId`, request option contracts) from `lib/api.ts` into explicit shared contracts ownership (`Shared/Contracts/ApiContracts.ts`).
- [x] Introduce explicit named web API request/response contracts in `lib/api.ts` and remove `Parameters`/`ReturnType` type-introspection usage from web source modules.
- [x] Restrict direct `lib/api.ts` consumption to feature `DataAccess` owners; migrate app and state-management modules to feature-owner/exported contracts and shared error contracts.
- [x] Move push toolbar client refresh/enable action orchestration from `App.tsx` into `PushNotificationToolbarActionCoordinator` with `PushClientStateManager` data-access ownership.
- [x] Extract push toolbar enable button rendering from `App.tsx` into `PushStatusButton` under `Features/PushNotifications/UserInterface`.
- [x] Extract top header bar rendering and header action wiring from `App.tsx` into `ApplicationHeaderBar` under `Application/UserInterface`.
- [x] Extract app-shell viewport/sidebar/main layout rendering from `App.tsx` into `Application/UserInterface/ApplicationShellLayout`.
- [x] Extract chat mode/model/reasoning toolbar rendering and interaction policy from `App.tsx` into `ChatModeToolbar` under `Features/Chat/UserInterface`.
- [x] Introduce feature-owned server client owners for capabilities, chat, debugging, push, and thread mutation flows.
- [x] Introduce capability snapshot cache ownership (`CapabilitySnapshotCache`) for modes/models/defaults freshness and single-flight refresh behavior.
- [x] Move core-data refresh queue/coalescing ownership from `App.tsx` refs into `CoreDataRefreshConcurrencyCoordinator`.
- [x] Move event-stream debounced refresh flag/timer ownership from `App.tsx` refs into `EventRefreshScheduler`.
- [x] Move EventSource connection/reconnect and refresh-decision dispatch ownership from `App.tsx` effect into `EventStreamConnectionCoordinator`.
- [x] Move API session bootstrap auth requirement detection, token challenge state, and session freshness behavior from `App.tsx` into `ApiSessionBootstrapCoordinator`.
- [x] Extract API session token challenge user interface from `App.tsx` into `ApiSessionBootstrapOverlay`.
- [x] Add focused tests for API session bootstrap ownership and protected bootstrap flow (`ApiSessionBootstrapCoordinator.test.ts` and `AppSessionAndDebug.test.tsx` session-auth scenario).
- [x] Move user-interface action request metadata creation from `App.tsx` into `UserInterfaceActionRequestBuilder`.
- [x] Move selected-thread refresh queue/cancellation ownership from `App.tsx` refs into `SelectedThreadRefreshConcurrencyCoordinator`.
- [x] Move pending-user-input selection logic out of `lib/api.ts` into chat domain ownership.
- [x] Replace manual transport envelope stripping in `lib/api.ts` with strict schema-driven envelope parsing transforms.
- [x] Move debug workspace history/error fetch normalization into `DebugWorkspaceDataReader`.
- [x] Remove service-worker API-token synchronization message protocol from push ownership modules and keep only service-worker lifecycle commands.
- [x] Remove browser token environment parsing and `X-Farfield-Token` header injection from web transport/service-worker code; keep token ownership in trusted server-side proxy infrastructure.
- [x] Tighten stream/debug payload typing in web ownership modules by replacing broad payload typing with protocol frame schemas and explicit structured-data contracts.
- [x] Move event-stream payload parsing and refresh decision logic into `EventStreamRefreshDecisionEngine`.
- [x] Move debug history/error state-application diff policy into `DebugWorkspaceStateStore`.
- [x] Extract error and live-state warning banner rendering from `App.tsx` into `DebugStatusBanners`.
- [x] Move debug issue derivation/filtering/selection policy from `App.tsx` into `DebugIssueStateResolver`.
- [x] Move mode-selection normalization/signature logic into `ModeSelectionStateResolver`.
- [x] Move mode-selection synchronization transition logic from `App.tsx` effect branches into `ModeSelectionSyncCoordinator`.
- [x] Move chat scroll-bottom detection/synchronization and pin-to-bottom behavior from `App.tsx` effects and handlers into `ChatScrollStateCoordinator`.
- [x] Extract chat action callback wiring (`send-message`, `submit-user-input`, `skip-user-input`, `interrupt-thread`, and `set-collaboration-mode`) from `App.tsx` into `Features/Chat/StateManagement/UseChatActionHandlers.ts`.
- [x] Extract chat scroll-effect wiring ownership from `App.tsx` into `Features/Chat/StateManagement/UseChatScrollEffects.ts`.
- [x] Move tracked user-interface error reporting/banner formatting from `App.tsx` into `TrackedUserInterfaceErrorReporter`.
- [x] Move pending user-input answer payload derivation from `App.tsx` submit handler into `PendingUserInputAnswerBuilder`.
- [x] Move chat request action orchestration (`send-message`, `submit-user-input`, `skip-user-input`, `interrupt-thread`) from `App.tsx` into `ChatRequestActionCoordinator`.
- [x] Move collaboration-mode mutation action orchestration (`set-collaboration-mode`) from `App.tsx` into `CollaborationModeActionCoordinator`.
- [x] Extract chat surface shell composition (conversation + pending-input + composer region) from `App.tsx` into `ChatWorkspacePane`.
- [x] Move thread mutation action orchestration (`create-thread`, `archive-thread`, `unarchive-thread`) from `App.tsx` into `ThreadMutationActionCoordinator`.
- [x] Move URL route-state parse/build logic into `ApplicationRouteStateMapper`.
- [x] Move conversation sync-signature building logic into `ConversationSyncSignatureBuilder`.
- [x] Move runtime viewport sizing/safe-area ownership from `App.tsx` helpers into `RuntimeViewportSizingCoordinator`.
- [x] Move coarse-pointer touch overscroll guard ownership from `App.tsx` effect wiring into `PageTouchOverscrollGuardCoordinator`.
- [x] Move incremental read-thread merge policy from `App.tsx` helper logic into `ReadThreadStateMerger`.
- [x] Move conversation-item renderability and flattening derivation from `App.tsx` helper logic into `ConversationItemFlattener`.
- [x] Extract debug history-detail and trace user-interface sections into dedicated `Features/Debugging/UserInterface` components.
- [x] Extract debug stream-events panel into dedicated `Features/Debugging/UserInterface` component.
- [x] Extract debug issues panel into dedicated `Features/Debugging/UserInterface` component.
- [x] Extract debug history list/detail workspace composition into dedicated `Features/Debugging/UserInterface` component.
- [x] Extract debug workspace shell composition (header + section tabs + panel routing) from `App.tsx` into `DebugWorkspacePane`.
- [x] Move debug workspace command orchestration (`load-history-detail`, `replay-history-entry`, `start-trace`, `mark-trace`, `stop-trace`) from `App.tsx` into a dedicated `DebugWorkspaceActionCoordinator`.
- [x] Extract debug workspace action-callback wiring and error-banner debug-navigation ownership from `App.tsx` into `Features/Debugging/StateManagement/UseDebugActionHandlers.ts`.
- [x] Extract thread mutation callback wiring ownership from `App.tsx` into `Features/Threads/StateManagement/UseThreadActionHandlers.ts`.
- [x] Extract mobile sidebar swipe-touch callback wiring ownership from `App.tsx` into `Application/StateManagement/UseMobileSidebarTouchHandlers.ts`.
- [x] Extract core-data and archived-thread loading ownership from `App.tsx` into `Application/StateManagement/UseCoreDataLoaders.ts`, with runtime-owned core + selected-thread refresh composition in `UseApplicationRuntimeComposition.ts`.
- [x] Extract selected-thread hydration and queued refresh callback wiring ownership from `App.tsx` into `Features/Chat/StateManagement/UseSelectedThreadLoaders.ts`.
- [x] Replace shared pending-thread materialization `Set` ref mutation with explicit owner class `PendingThreadMaterializationCoordinator`.
- [x] Extract viewport keyboard telemetry, runtime viewport sizing wiring, and overscroll-guard wiring ownership from `App.tsx` into `Application/StateManagement/UseViewportShellEffects.ts`.
- [x] Extract app refresh/routing/visibility/interval effect wiring ownership from `App.tsx` into `Application/StateManagement/UseApplicationRefreshEffects.ts`.
- [x] Extract EventSource-driven scheduled refresh effect wiring ownership from `App.tsx` into `Application/StateManagement/UseEventStreamEffects.ts`.
- [x] Extract selected-thread lifecycle loading/reset effect wiring ownership from `App.tsx` into `Features/Chat/StateManagement/UseSelectedThreadLifecycleEffects.ts`.
- [x] Extract active-request draft synchronization and mode-selection synchronization effect wiring ownership from `App.tsx` into `Features/Chat/StateManagement/UseModeAndPendingRequestEffects.ts`.
- [x] Split core snapshot-to-state transition ownership out of `Application/StateManagement/UseCoreDataLoaders.ts` into `Application/StateManagement/CoreDataSnapshotStateApplier.ts` to keep owner modules under preferred file-size budgets.
- [x] Extract application owner-instantiation wiring from `apps/WebApplication/Source/App.tsx` into `Application/StateManagement/UseApplicationOwnerDependencies.ts`, reducing `App.tsx` from 1293 to 1148 lines while preserving owner contracts.
- [x] Extract shared browser request execution ownership from `apps/WebApplication/Source/SharedUtilities/api.ts` into `apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransport.ts`.
- [x] Extract debugging and push endpoint schemas/functions from `apps/WebApplication/Source/SharedUtilities/api.ts` into feature data-access modules (`Features/Debugging/DataAccess/DebugApi.ts`, `Features/PushNotifications/DataAccess/PushApi.ts`) while preserving compatibility re-exports.
- [x] Complete `Web Threads Ownership Extraction` slice.
- [x] Complete Chat feature extraction from `apps/WebApplication/Source/App.tsx`.
- [x] Complete Debugging feature extraction from `apps/WebApplication/Source/App.tsx`.
- [x] Complete PushNotifications feature extraction from `apps/WebApplication/Source/App.tsx`.
- [x] Split `apps/WebApplication/Source/SharedUtilities/api.ts` endpoint ownership into feature modules (`CapabilityApi`, `ThreadApi`, `ChatApi`, `DebugApi`, `PushApi`) and feature-owned server clients.
- [x] Temporarily reduced `apps/WebApplication/Source/SharedUtilities/api.ts` to a thin compatibility facade with app-level `bootstrapEventsSession` and `getWebShellHealth`, while shared request execution moved to `apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransport.ts`.
- [x] Remove compatibility-facade re-exports by deleting `apps/WebApplication/Source/SharedUtilities/api.ts` after migrating callers/tests to feature/application API owners.
- [x] Keep `apps/WebApplication/Source/App.tsx` focused on app composition and top-level wiring only.
- [x] Add focused runtime-composition seam tests in `apps/WebApplication/Tests/ApplicationRuntimeComposition.test.tsx` covering loader-ref synchronization and composed hook wiring between refresh/synchronization effects and shell composition.
- [x] Normalize thread API list/create parsing to strict app-owned contracts with wire-to-domain mapping in `Features/Threads/DataAccess/ThreadApi.ts`.
- [x] Add API contract tests for strict thread list/type validation and strict create-thread response projection in `apps/WebApplication/Tests/Api.test.ts`.
- [x] Split shared tabs primitives into one-component-per-file modules (`Tabs.tsx`, `TabsList.tsx`, `TabsTrigger.tsx`, `TabsContent.tsx`) and update consumers to direct concrete imports.
- [x] Split shared card primitives into one-component-per-file modules (`Card.tsx`, `CardHeader.tsx`, `CardTitle.tsx`, `CardDescription.tsx`, `CardContent.tsx`).
- [x] Move debug workspace section schema/type contracts out of `DebugWorkspacePane.tsx` into domain-owned `DebugWorkspaceSectionContracts.ts`.

### Server Application Cleanup

- [x] Extract thread route ownership from `apps/ServerApplication/Source/Application/ServerBootstrap.ts` into dedicated route-owner modules.
- [x] Extract capability route ownership (`/api/config/defaults`, `/api/models`, `/api/collaboration-modes`) from `apps/ServerApplication/Source/Application/ServerBootstrap.ts`.
- [x] Extract runtime API route ownership (`/events`, `/api/health`, `/api/events/session`) from `apps/ServerApplication/Source/Application/ServerBootstrap.ts`.
- [x] Extract agent descriptor route ownership (`/api/agents`) from `apps/ServerApplication/Source/Application/ServerBootstrap.ts`.
- [x] Extract thread adapter resolution ownership into `ThreadAdapterResolver`.
- [x] Extract runtime state owners from `apps/ServerApplication/Source/Application/ServerBootstrap.ts`.
- [x] Extract activity/history ownership into `ActivityHistoryService`.
- [x] Extract completion notification orchestration into `ThreadCompletionNotificationService`.
- [x] Extract event stream ownership into `EventStreamClientRegistry`.
- [x] Extract thread concurrency ownership into `ThreadConcurrencyCoordinator`.
- [x] Extract push dispatch concurrency into `PushDispatchConcurrencyCoordinator`.
- [x] Add `PushMutationConcurrencyCoordinator` and route/service wiring so push-subscription mutations and completion-watermark mutations execute through one explicit concurrency owner.
- [x] Move push-subscription and completion-watermark persistence writes to async queued file ownership in `PushStore` to avoid request-path event-loop blocking.
- [x] Move push notification fan-out in `PushService` from sequential send loops to bounded concurrent send workers with the existing retry/backoff policy.
- [x] Shift thread-list cache invalidation to scoped mutation ownership (`active` vs `all`) and apply debounced stream-event invalidation in `ServerBootstrap` to avoid high-frequency full-cache churn.
- [x] Extract HTTP request routing + transport error mapping into `ServerRequestHandler`.
- [x] Extract server lifecycle ownership (`start`, `shutdown`, signals) into `ServerLifecycleCoordinator`.
- [x] Extract agent adapter composition and IPC event wiring ownership into `AgentRuntimeOwner`.
- [x] Extract request parsing, timeout, and query utility ownership into `ServerRequestUtilityOwner`.
- [x] Extract push test notification payload construction ownership into `PushTestPayloadOwner`.
- [x] Extract server transport error-event persistence and logging ownership into `ServerErrorEventRecorder`.
- [x] Keep route handlers orchestration-only with repositories/services owning persistence and mutation.
- [x] Extract transport error-category mapping ownership into `ServerTransportErrorClassifier`.
- [x] Extract cache/concurrency/streaming observability snapshot ownership into `ServerObservabilitySnapshotOwner`.
- [x] Extract HTTP request error classification/logging/response mapping ownership from `ServerRequestHandler` into `ServerRequestErrorResponder`.
- [x] Extract codex thread stream projection/event-log ownership from `CodexAgent` into `CodexThreadStreamStateOwner`.
- [x] Extract codex app-server stderr normalization/classification ownership from `CodexAgent` into `CodexAppServerStderrOwner`.
- [x] Remove remaining server-side type-introspection usage in runtime configuration and agent adapters by replacing `ReturnType`-derived contracts with explicit named types.
- [x] Replace broad IPC and JSON-RPC transport payload typing in `packages/CodexProtocol` and `packages/CodexInterfaceAdapter` with `JsonValue` and `JsonValueSchema` boundary contracts (`ipc.ts`, `json-rpc.ts`, `ipc-client.ts`, `app-server-transport.ts`, `app-server-client.ts`).
- [x] Replace remaining broad `unknown`-typed server and package contract surfaces with explicit schema-owned structured-data contracts where behavior allows strict typing.
- [x] Centralize `LOG_LEVEL`, ntfy settings, and invalid thread-stream log-path parsing under `Application/Configuration/ServerRuntimeConfiguration.ts`, and remove direct server-side environment reads from logging and stream-state owners.
- [x] Move default invalid thread-stream event logging from repository source roots into `.runtime/logs/threads` and ensure log-directory creation is owned by `CodexThreadStreamStateOwner`.
- [x] Enforce strict bounded `/api/threads` query parsing with Zod in `ThreadCollectionRoutes` (typed boolean/integer parsing and hard upper bounds for `limit` and `maxPages`).

### Package Cleanup

- [x] Split `packages/CodexProtocol/Source/Thread.ts` into explicit contract and parser owners (`Source/Contracts/Thread/*` and `Source/Parsers/ThreadParsers.ts`), rewired internal protocol imports to owner modules, and reduced `Thread.ts` to a thin compatibility surface.

### Configuration, Security, and Observability Cleanup

- [x] Centralize environment parsing in `Application/Configuration` owner modules.
- [x] Ensure secret-bearing values are server-only and never surfaced to browser bundles.
- [x] Ensure typed error categories are mapped at transport boundaries.
- [x] Ensure cache/concurrency owners expose structured observability.
- [x] Document and preserve two supported auth modes: direct browser-to-server with `API_TOKEN` unset, and protected mode with trusted server-side `X-Farfield-Token` header injection.
- [x] Create `docs/decisions/README.md` to make architecture decision-record storage explicit and actionable.

### Tooling Direction

- [x] Evaluate formatter/linter consolidation direction and document Biome as an approved candidate for future tooling consolidation design.

### Repository Structure Cleanup

- [x] Rename `apps/web` to `apps/WebApplication`.
- [x] Rename `apps/server` to `apps/ServerApplication`.
- [x] Rename `packages/codex-protocol` to `packages/CodexProtocol`.
- [x] Rename `packages/codex-api` to `packages/CodexInterfaceAdapter`.
- [x] Rename `packages/opencode-api` to `packages/OpenCodeInterfaceAdapter`.
- [x] Rename application and package `src` folders to `Source`.
- [x] Rename application and package `test` folders to `Tests`.
- [x] Rename root `e2e` folder to `end-to-end` and align path-dependent runner/docs references.
- [x] Rename root `ops` folder to `operations` and align script/config/docs references.
- [x] Rename real end-to-end command namespace from `e2e:real:*` to `end-to-end:real:*` and align all command references.
- [x] Rename governance and sentinel naming surfaces from `e2e-*` to `end-to-end-*` (`validate-end-to-end-governance`, `.runtime/end-to-end-sentinel`).
- [x] Normalize non-generated `apps/*` and `packages/*` import specifiers by removing duplicate relative path segments (`././`, `.././`).
- [x] Rename all test files to PascalCase owner-aligned naming across `apps/*/Tests` and `packages/*/Tests`.
- [x] Update all path-dependent surfaces listed in the compatibility section after each rename set.

### Recent Implementation Progress Notes

- [x] `ApiSessionBootstrapCoordinator` now explicitly consumes non-blocking background refresh rejections and keeps retry behavior deterministic; focused coordinator tests now cover rejection-handling and retry sequencing.
- [x] Progress audit confirmed architecture migration governance status in code and review systems: no unresolved PR review threads remain on `MatthewFrench/farfield#1`.
- [x] `ThreadCompletionNotificationService` replaced cross-module `ReturnType` contract derivation with explicit `StoredPushSubscription[]` contracts to keep boundary types explicit and standards-compliant.
- [x] Child-process environment propagation now avoids direct full `process.env` spread in remaining script/test spawn paths (`scripts/smoke/ios-device-smoke-matrix.mjs` and route-integration harness ownership under `apps/ServerApplication/Tests/HttpRoutesIntegrationEnvironment.ts`) by using schema-owned allowlisted environment builders.
- [x] Chat and thread mutation coordinators now refresh through explicit scoped owner composition (`loadCoreDataTracked` + selected-thread reload callbacks) instead of broad `refreshAll` paths in `ChatRequestActionCoordinator`, `ThreadMutationActionCoordinator`, `UseChatActionHandlers`, and `UseThreadActionHandlers`.
- [x] API session token bootstrap success path now refreshes through explicit scoped owner callbacks (`loadCoreDataTracked` + selected-thread reload-if-present) in `UseApplicationPushFeatureComposition`.
- [x] Broad `refreshAll` call sites were removed from web source; startup and manual refresh now run through explicit runtime-owned core + selected-thread refresh composition paths.
- [x] Startup/manual refresh composition now executes through stable loader refs in `UseApplicationRuntimeComposition.ts`, preventing refresh-effect churn from unstable callback identities and preserving deterministic initial-load behavior.
- [x] Runtime refresh observability counters/timing ownership was added in `RuntimeRefreshObservabilityOwner.ts` and wired into runtime refresh composition so startup/manual refresh behavior now records deterministic in-flight/success/failure and duration snapshots.
- [x] Monolithic web app behavior tests were split into owner-focused suites (`AppShellBehavior.test.tsx`, `AppSessionAndDebug.test.tsx`, `AppThreadRefreshBehavior.test.tsx`) with shared fixture ownership in `AppTestEnvironment.tsx`.
- [x] Monolithic server route integration tests were split into focused route suites (`HttpRoutesAuthentication.integration.test.ts`, `HttpRoutesPush.integration.test.ts`, `HttpRoutesDebug.integration.test.ts`) with shared server lifecycle ownership in `HttpRoutesIntegrationEnvironment.ts`.
- [x] Real app Playwright coverage now includes startup/manual refresh verification (`startup-and-header-refresh.spec.ts`) and coverage tracking was updated in `end-to-end/real/coverage-matrix.md`.
- [x] Preferred-size-gap audit now confirms no source files remain above the 400-line preferred threshold (`0` over 400; `0` over 600).
- [x] Thread list route query/cursor/sort ownership was extracted from `ThreadCollectionRoutes.ts` into `ThreadCollectionListQueryOwner.ts`, and route contracts were split into `ThreadCollectionRouteContracts.ts` to keep route wiring explicit and smaller.
- [x] Push test dispatch ownership (`/api/push/test`) was extracted from `PushRoutes.ts` into `PushTestRouteOwner.ts`, and route contracts were split into `PushRouteContracts.ts`.
- [x] Server bootstrap cache-invalidation policy ownership was extracted into `Application/Bootstrap/ThreadListCacheInvalidationOwner.ts`, reducing composition-root concentration in `ServerBootstrap.ts`.
- [x] Browser push client convenience API wrappers were split out of `PushClientStateManager.ts` into `PushClientApi.ts` so class ownership remains focused on lifecycle behavior.
- [x] `scripts/tooling/with-env.mjs` now builds spawned-process environment from a schema-owned allowlist instead of propagating the full `process.env` surface, while still loading explicit `.env` and `.env.local` values.
- [x] Script path-literal governance is now enforced by `scripts/tooling/validate-script-path-governance.mjs` (`bun run validate:scripts:governance`), and `scripts/tooling/generate-codex-schema.mjs` now uses canonical `packages/CodexProtocol` ownership paths for schema regeneration.
- [x] `CodexThreadStreamStateOwner` default invalid stream-event log path now resolves to `.runtime/logs/threads/invalid-thread-stream-events.ndjson` to keep runtime artifacts out of source roots.
- [x] Real-app Playwright suite now contains `7` scenarios (`bunx playwright test -c playwright.real.config.ts --list`), including startup/header-refresh coverage; full execution requires the local Farfield server at `127.0.0.1:4311` and fails fast with `ECONNREFUSED` when that prerequisite is not running.
- [x] Codex app-server spawn environment ownership now uses strict allowlisted schema parsing in `packages/CodexInterfaceAdapter/Source/AppServerTransport.ts` (`buildAppServerSpawnEnvironment`), removing direct full-environment propagation to child process startup.
- [x] Direct `process.env` reads for app-server spawn configuration were removed from non-configuration owner modules: server bootstrap now reads runtime configuration via `readServerRuntimeConfigurationFromCurrentProcessEnvironment()`, then passes `appServerBaseEnvironment` through `AgentRuntimeOwner` and `CodexAgentAdapter` into `ChildProcessAppServerTransport`.
- [x] `apps/WebApplication/Source/Application/StateManagement/UseCoreDataLoaders.ts` now owns only core/archived snapshot loading, while runtime composition owns explicit core + selected-thread refresh orchestration and loading-state transitions.
- [x] Event-stream scheduled refresh execution in `apps/WebApplication/Source/Application/StateManagement/UseEventStreamEffects.ts` now runs independent refresh operations concurrently, reducing blocked refresh latency while preserving owner boundaries.
- [x] Debug workspace actions now refresh core snapshots via `loadCoreDataTracked` instead of full `refreshAll`, avoiding unrelated selected-thread reload work after trace/replay operations.
- [x] External data-source and subscription owners now include high-value ownership comments (`CapabilityServerClient`, `ChatServerClient`, `DebugServerClient`, `ThreadServerClient`, `ThreadMutationServerClient`, `PushServerClient`, `PushClientStateManager`, `EventStreamConnectionCoordinator`, `EventStreamRefreshDecisionEngine`, `AppServerClient`, `DesktopIpcClient`, `CodexMonitorService`, `OpenCodeConnection`, `OpenCodeMonitorService`).
- [x] Import-path normalization sweep resolved PascalCase and kebab-case drift by canonicalizing import specifiers against on-disk path ownership across `apps/*` and `packages/*`.
- [x] Non-generated source import-path canonicalization now also removes duplicate relative-segment drift (`././`, `.././`) across `apps/*` and `packages/*`.
- [x] Configuration ownership tightened by moving log-level, ntfy, and invalid stream-event path parsing into `ServerRuntimeConfiguration` and applying runtime logger configuration at server bootstrap.
- [x] Thread API boundary contracts tightened by normalizing adapter wire payloads into strict app-owned list/create contracts with focused regression tests.
- [x] Shared user-interface primitives now satisfy one-component-per-file standards for tabs and card modules, and debug workspace section contracts were moved from user-interface component ownership to domain contracts ownership.
- [x] Post-rename validation succeeded after import normalization (`bun run typecheck`, `bun run lint`, and `bun run test` all pass).
- [x] Real-app test command surface is now descriptive and consistent (`end-to-end:real:*`, `verify:end-to-end:real`, `validate:end-to-end:governance`) with docs aligned.
- [x] Added guarded real-app command `end-to-end:real:safe-run` that captures pre/post thread snapshots and fails if any pre-existing thread disappears during Playwright execution; `verify:end-to-end:real` now uses this safety wrapper.
- [x] Real-app diagnostics output naming now uses explicit `end-to-end` ownership (`.runtime/end-to-end-sentinel/*`, `end-to-end-sentinel-summary`) across helper code and triage docs.
- [x] Server runtime configuration ownership extracted into `apps/ServerApplication/Source/Application/Configuration/ServerRuntimeConfiguration.ts`.
- [x] Server lifecycle ownership extracted into `apps/ServerApplication/Source/Application/Bootstrap/ServerLifecycleCoordinator.ts`.
- [x] HTTP request transport and route orchestration extracted into `apps/ServerApplication/Source/Network/ServerRequestHandler.ts`.
- [x] Agent adapter composition and codex IPC event wiring extracted into `apps/ServerApplication/Source/Agents/AgentRuntimeOwner.ts`.
- [x] Request parsing/timeout utilities extracted into `apps/ServerApplication/Source/Network/ServerRequestUtilityOwner.ts`.
- [x] Push test payload construction extracted into `apps/ServerApplication/Source/Network/PushTestPayloadOwner.ts`.
- [x] Server error event persistence/logging ownership extracted into `apps/ServerApplication/Source/Network/ServerErrorEventRecorder.ts`.
- [x] Debug trace lifecycle mutation ownership moved into `apps/ServerApplication/Source/Modules/Activity/ActivityHistoryService.ts`, and debug routes now orchestrate owner APIs.
- [x] Debug route helper ownership split into dedicated modules (`DebugTypes.ts`, `DebugFileDownload.ts`) to reduce route concentration.
- [x] `apps/ServerApplication/Source/Network/Routes/DebugRoutes.ts` reduced from 439 lines to 391 lines while preserving route behavior and test coverage.
- [x] Transport error-category mapping extracted into `apps/ServerApplication/Source/Network/ServerTransportErrorClassifier.ts` and applied in `ServerRequestHandler`.
- [x] HTTP request error classification/logging/response ownership extracted from `apps/ServerApplication/Source/Network/ServerRequestHandler.ts` into `apps/ServerApplication/Source/Network/ServerRequestErrorResponder.ts`, with focused responder tests and handler size reduced to 385 lines.
- [x] Codex thread stream projection/event-log ownership extracted from `apps/ServerApplication/Source/Agents/Adapters/CodexAgentAdapter.ts` into `apps/ServerApplication/Source/Agents/Adapters/CodexThreadStreamStateOwner.ts`, reducing adapter concentration with focused owner tests.
- [x] Codex app-server stderr normalization/classification ownership extracted from `apps/ServerApplication/Source/Agents/Adapters/CodexAgentAdapter.ts` into `apps/ServerApplication/Source/Agents/Adapters/CodexAppServerStderrOwner.ts`.
- [x] Codex runtime connection lifecycle and message-dispatch ownership extracted from `apps/ServerApplication/Source/Agents/Adapters/CodexAgentAdapter.ts` into `CodexConnectionLifecycleOwner.ts` and `CodexMessageDispatchOwner.ts`, reducing adapter size to 483 lines.
- [x] Structured owner observability snapshot extracted into `apps/ServerApplication/Source/Network/ServerObservabilitySnapshotOwner.ts` and exposed at `/api/debug/observability`.
- [x] `apps/ServerApplication/Source/Application/ServerBootstrap.ts` composition-root size reduced from 766 lines to 402 lines while preserving test coverage (`@farfield/server`: typecheck, test, lint).
- [x] `apps/WebApplication/Source/App.tsx` runtime root node access migrated from `document.getElementById("root")` to `applicationShellElementRef` ownership for viewport/touch orchestration.
- [x] Browser storage ownership for theme/push preferences extracted from `useTheme` and push client ownership modules into `ThemePreferenceStore` and `PushPreferenceStore` with explicit tests.
- [x] Introduced `CapabilityServerClient`, `ChatServerClient`, `DebugServerClient`, `ThreadMutationServerClient`, and `PushServerClient`, then migrated `App.tsx` and `push.ts` API call sites to those owner classes.
- [x] Pending-user-input selection ownership moved to `PendingUserInputRequestSelector`, and UI modules no longer import that selector logic from `lib/api.ts`.
- [x] Introduced `CapabilitySnapshotCache` and migrated capability snapshot freshness + single-flight refresh behavior out of ad-hoc `App.tsx` refs.
- [x] Core-data refresh queue/coalescing behavior extracted from `App.tsx` refs into `CoreDataRefreshConcurrencyCoordinator` with focused concurrency tests.
- [x] Event-stream debounced refresh flag/timer behavior extracted from `App.tsx` refs into `EventRefreshScheduler` with focused scheduler tests.
- [x] Selected-thread refresh queue/cancellation behavior extracted from `App.tsx` ref orchestration into `SelectedThreadRefreshConcurrencyCoordinator` with focused concurrency tests.
- [x] Manual `stripOk` transport envelope shape introspection removed from `apps/WebApplication/Source/SharedUtilities/api.ts` in favor of strict Zod envelope transforms for threads/models/collaboration-modes reads.
- [x] Debug workspace history/error dual-fetch and signature derivation normalized under `DebugWorkspaceDataReader`, reducing duplicated logic between core-load and event-refresh paths.
- [x] Push service-worker token synchronization protocol was removed from browser and service-worker code; service-worker message handling is now limited to lifecycle commands.
- [x] Browser-side API token ownership removed from web bundle code by deleting `apps/WebApplication/Source/Application/Configuration/WebRuntimeConfiguration.ts`, removing `X-Farfield-Token` injection from `apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransport.ts` and `apps/WebApplication/public/sw.js`, and keeping push client/service-worker ownership free of browser-stored API tokens.
- [x] Web stream-event and debug payload ownership now uses explicit contract types (`IpcFrameSchema` and structured-data schemas) in `ChatApi`, `DebugApi`, `StreamEventCard`, and shared transport parsing surfaces.
- [x] `apps/WebApplication/Source` no longer contains explicit broad `unknown`-typed transport/domain contract surfaces; remaining `unknown` references in that tree are string literals only.
- [x] Architecture/security documentation now explicitly captures direct browser-to-Farfield-server mode (`API_TOKEN` unset) and protected mode (trusted server-side header injection required when `API_TOKEN` is set).
- [x] Event-stream payload parsing and refresh-decision ownership extracted from `App.tsx` into `EventStreamRefreshDecisionEngine` with focused decision tests.
- [x] EventSource open/error handling, reconnect backoff, and refresh dispatch ownership extracted from `App.tsx` effect into `EventStreamConnectionCoordinator` with focused coordinator tests.
- [x] User-interface action identifier/request-option construction ownership extracted from `App.tsx` into `UserInterfaceActionRequestBuilder` with focused builder tests.
- [x] Tracked user-interface error reporting/banner formatting ownership extracted from `App.tsx` into `TrackedUserInterfaceErrorReporter` with focused reporter tests.
- [x] Chat request action orchestration ownership for `send-message`, `submit-user-input`, `skip-user-input`, and `interrupt-thread` extracted from `App.tsx` into `ChatRequestActionCoordinator` with focused action-coordinator tests.
- [x] Collaboration-mode mutation action orchestration ownership for `set-collaboration-mode` extracted from `App.tsx` into `CollaborationModeActionCoordinator` with focused action-coordinator tests.
- [x] Chat surface shell composition (conversation container, empty states, jump-to-bottom control, pending-input card, and composer region) extracted from `App.tsx` into `ChatWorkspacePane` with focused user-interface tests.
- [x] Pending user-input active-request selection in `App.tsx` now enforces explicit `PendingRequest | null` resolution, eliminating implicit `undefined` branches at chat workspace boundaries.
- [x] Debug workspace command orchestration ownership for `load-history-detail`, `replay-history-entry`, `start-trace`, `mark-trace`, and `stop-trace` extracted from `App.tsx` into `DebugWorkspaceActionCoordinator` with focused action-coordinator tests.
- [x] Thread mutation action orchestration ownership for `create-thread`, `archive-thread`, and `unarchive-thread` extracted from `App.tsx` into `ThreadMutationActionCoordinator` with focused action-coordinator tests.
- [x] Thread list grouping/project-section derivation, selected-thread projection, and archived-section counting extracted from `App.tsx` into `ThreadListPresentationStateResolver` and consumed via `ThreadListStateController` with focused resolver tests.
- [x] Push client refresh and toolbar enable action orchestration extracted from `App.tsx` into `PushNotificationToolbarActionCoordinator` with `PushClientStateManager` data-access ownership and focused action-coordinator tests.
- [x] Push toolbar notification enable/status button rendering extracted from `App.tsx` into `PushStatusButton` with focused user-interface tests.
- [x] Top header bar rendering and header action wiring extracted from `App.tsx` into `ApplicationHeaderBar` with focused user-interface tests.
- Stream-events now use explicit cursor contract ownership end-to-end (`sinceSequence` request + `nextSequence`/`firstAvailableSequence`/`resetRequired` response) across `ThreadMemberReadRouteOwner`, `CodexThreadStreamStateOwner`, `ChatApi`, and selected-thread refresh owners.
- Active-thread cache reads are now cache-preferred in core refresh paths, while mutation owners perform explicit active/archived key invalidation before refresh orchestration (`ChatRequestActionCoordinator`, `ThreadMutationActionCoordinator`, `UseThreadActionHandlers`, `UseChatActionHandlers`).
- Web bootstrap root mount now fails fast with explicit error ownership when `#root` is missing, removing non-null assertion risk in `Main.tsx`.
- [x] Chat mode/model/reasoning toolbar rendering and typed interaction wiring extracted from `App.tsx` into `ChatModeToolbar` with focused user-interface tests.
- [x] Thread sidebar shell composition (header + list panel + footer status) extracted from `App.tsx` into `ThreadSidebarPanel` with focused user-interface tests.
- [x] Thread sidebar viewport wrapper composition for desktop/mobile animation shells extracted from `App.tsx` into `ThreadSidebarViewport` with focused user-interface tests.
- [x] Debug history/error list state-application and signature diff behavior extracted into `DebugWorkspaceStateStore`, removing duplicate update policy logic from `App.tsx`.
- [x] Debug issue derivation, filtering, and selected-issue projection extracted from `App.tsx` into `DebugIssueStateResolver` with focused resolver tests.
- [x] Mode-selection parsing and signature ownership extracted from `App.tsx` helper functions into `ModeSelectionStateResolver` with focused resolver tests.
- [x] Mode-selection remote/local synchronization transition ownership extracted from `App.tsx` effect branches into `ModeSelectionSyncCoordinator` with focused transition tests.
- [x] Chat scroll-bottom detection/synchronization and pin-to-bottom ownership extracted from `App.tsx` effects/handlers into `ChatScrollStateCoordinator` with focused scroll-state tests.
- [x] Pending user-input answer payload derivation ownership extracted from `App.tsx` submit handler into `PendingUserInputAnswerBuilder` with focused answer-builder tests.
- [x] Route-state pathname parsing and path-building ownership extracted from `App.tsx` into `ApplicationRouteStateMapper` with focused mapper tests.
- [x] Conversation sync-signature ownership for live/read thread comparison extracted from `App.tsx` into `ConversationSyncSignatureBuilder` with focused signature tests.
- [x] Runtime viewport orientation baseline tracking, keyboard-open detection, and safe-area CSS variable mutation extracted from `App.tsx` helpers into `RuntimeViewportSizingCoordinator` with focused viewport-coordinator tests.
- [x] Selected-thread incremental read merge policy extracted from `App.tsx` helper logic into `ReadThreadStateMerger` with focused merge-policy tests.
- [x] Conversation item renderability policy and flattened layout derivation extracted from `App.tsx` helper logic into `ConversationItemFlattener` with focused flattener tests.
- [x] Debug history-detail and trace panel markup extracted from `App.tsx` into `DebugHistoryDetailPanel` and `DebugTracePanel` feature components.
- [x] Debug stream-events panel markup extracted from `App.tsx` into `DebugStreamEventsPanel` feature component.
- [x] Debug issues panel markup extracted from `App.tsx` into `DebugIssuesPanel` feature component.
- [x] Debug history workspace list/detail composition extracted from `App.tsx` into `DebugHistoryPanel` feature component.
- [x] Debug workspace shell composition (header + section tabs + panel routing) extracted from `App.tsx` into `DebugWorkspacePane` with focused user-interface tests.
- [x] Error and live-state warning banner rendering extracted from `App.tsx` into `DebugStatusBanners` feature component with focused user-interface tests.
- [x] Preference store tests now use isolated in-memory `Storage` mocks to prevent shared file-backed browser storage test races.
- [x] Shared API contracts (`AgentId`, `ApiRequestOptions`) moved from `lib/api.ts` into `Shared/Contracts/ApiContracts.ts`, reducing transport-module coupling across feature/application owners.
- [x] Explicit named API request/response contracts were added to `apps/WebApplication/Source/SharedUtilities/api.ts` (including replay response schema parsing), and web feature/application modules were migrated off `Parameters`/`ReturnType` introspection onto those contracts.
- [x] Remaining server-side `ReturnType` contract derivation usage was removed from `apps/ServerApplication/Source/Application/Configuration/ServerRuntimeConfiguration.ts`, `apps/ServerApplication/Source/Agents/Adapters/CodexAgentAdapter.ts`, and `apps/ServerApplication/Source/Agents/Adapters/OpenCodeAgentAdapter.ts` in favor of explicit named contract types.
- [x] `apps/WebApplication/Source/App.tsx` now consumes request-cancellation and API contract types through feature/shared owner modules instead of importing endpoint-contract surfaces directly from `apps/WebApplication/Source/SharedUtilities/api.ts`.
- [x] Shared request execution logic (`request`, `requestNoContent`, request metadata headers, timeout handling, and action-request option mapping) was extracted from `apps/WebApplication/Source/SharedUtilities/api.ts` into `apps/WebApplication/Source/Shared/Transport/FarfieldHttpTransport.ts`.
- [x] Debugging and push endpoint schemas/functions were extracted from `apps/WebApplication/Source/SharedUtilities/api.ts` into `apps/WebApplication/Source/Features/Debugging/DataAccess/DebugApi.ts` and `apps/WebApplication/Source/Features/PushNotifications/DataAccess/PushApi.ts`, with `lib/api.ts` retaining compatibility re-exports.
- [x] Capability, thread, and chat endpoint schemas/functions were extracted from `apps/WebApplication/Source/SharedUtilities/api.ts` into `apps/WebApplication/Source/Features/Capabilities/DataAccess/CapabilityApi.ts`, `apps/WebApplication/Source/Features/Threads/DataAccess/ThreadApi.ts`, and `apps/WebApplication/Source/Features/Chat/DataAccess/ChatApi.ts`, and feature server clients now consume those owners.
- [x] Remaining `ReturnType` and `Awaited<ReturnType<...>>` usage in web tests was removed by switching to explicit contract and mock types, and repository scanning of `apps/*` and `packages/*` TypeScript files now reports zero type-introspection utility usage.
- [x] Compatibility re-export surface `apps/WebApplication/Source/SharedUtilities/api.ts` was removed; app-level endpoints now live in `apps/WebApplication/Source/Application/DataAccess/WebShellApi.ts` and tests/modules import feature/application owners directly.
- [x] Coarse-pointer touch overscroll guard ownership was extracted from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Application/StateManagement/PageTouchOverscrollGuardCoordinator.ts` with focused coordinator tests.
- [x] Browser API session bootstrap ownership (auth detection, token challenge state, and session freshness reuse) was extracted from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Application/StateManagement/ApiSessionBootstrapCoordinator.ts` with focused coordinator tests.
- [x] API session token challenge user interface was extracted from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Application/UserInterface/ApiSessionBootstrapOverlay.tsx`.
- [x] App-shell viewport/sidebar/main render composition was extracted from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Application/UserInterface/ApplicationShellLayout.tsx`, with typed pane/header/banner/overlay props assembled in `App.tsx`.
- [x] Chat/thread/debug action callback and chat-scroll/mobile-touch effect wiring ownership was extracted from `apps/WebApplication/Source/App.tsx` into dedicated owner hooks (`UseChatActionHandlers.ts`, `UseThreadActionHandlers.ts`, `UseDebugActionHandlers.ts`, `UseChatScrollEffects.ts`, and `UseMobileSidebarTouchHandlers.ts`), reducing `App.tsx` from 2351 to 2050 lines.
- [x] Core-data/archived-thread refresh wiring and selected-thread hydration/queued refresh wiring ownership were extracted from `apps/WebApplication/Source/App.tsx` into `UseCoreDataLoaders.ts` and `UseSelectedThreadLoaders.ts`, reducing `App.tsx` from 2050 to 1756 lines.
- [x] App lifecycle/effect and view-property wiring ownership (viewport shell behavior, event stream refresh dispatch, selected-thread lifecycle hydration, application refresh/routing, mode/pending-request synchronization, thread-list pane properties, chat-mode toolbar properties, and shell header/banner/pane/overlay property assembly) was extracted from `apps/WebApplication/Source/App.tsx` into dedicated owner hooks (`UseViewportShellEffects.ts`, `UseEventStreamEffects.ts`, `UseSelectedThreadLifecycleEffects.ts`, `UseApplicationRefreshEffects.ts`, `UseModeAndPendingRequestEffects.ts`, `UseThreadListPaneProperties.ts`, `UseChatModeToolbarProperties.ts`, and `UseApplicationShellViewProperties.ts`), reducing `App.tsx` from 1756 to 1293 lines.
- [x] Core snapshot-to-state transition ownership was extracted from `apps/WebApplication/Source/Application/StateManagement/UseCoreDataLoaders.ts` into `CoreDataSnapshotStateApplier.ts`, reducing `UseCoreDataLoaders.ts` from 460 to 322 lines and lowering source-file size hotspot count from 9 to 8 files over 400 lines.
- [x] Thread-list user-interface ownership was split from `apps/WebApplication/Source/Features/Threads/UserInterface/ThreadListPane.tsx` into `ThreadListEmptyState.tsx`, `ThreadListActiveSection.tsx`, `ThreadListArchivedSection.tsx`, and `ThreadListPaneContracts.ts`, reducing `ThreadListPane.tsx` from 419 to 27 lines and lowering source-file size hotspot count from 8 to 7 files over 400 lines.
- [x] Application owner-instantiation wiring was extracted from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Application/StateManagement/UseApplicationOwnerDependencies.ts`, reducing `App.tsx` from 1293 to 1148 lines and keeping owner construction in one module.
- [x] Application behavior configuration and large derived-state ownership were extracted from `apps/WebApplication/Source/App.tsx` into `apps/WebApplication/Source/Application/Configuration/ApplicationBehaviorConfiguration.ts`, `apps/WebApplication/Source/Application/StateManagement/UseApplicationDerivedState.ts`, and `apps/WebApplication/Source/Application/StateManagement/UseApplicationDerivedStateContracts.ts`, reducing `App.tsx` from 1148 to 985 lines while keeping the derived-state owner module under preferred file-size budgets.
- [x] Codex adapter thread-management and real-time interaction ownership were extracted from `apps/ServerApplication/Source/Agents/Adapters/CodexAgentAdapter.ts` into `CodexThreadManagementOwner.ts` and `CodexThreadInteractionOwner.ts`, reducing `CodexAgentAdapter.ts` from 483 to 322 lines while preserving strict adapter contracts.
- [x] Thread-member route orchestration ownership was split from `apps/ServerApplication/Source/Network/Routes/ThreadMemberRoutes.ts` into `ThreadMemberReadRouteOwner.ts`, `ThreadMemberMutationRouteOwner.ts`, and `ThreadMemberRouteContracts.ts`, reducing `ThreadMemberRoutes.ts` from 444 to 52 lines and isolating read-vs-mutation behavior.
- [x] Thread-member mutation ownership was further split into dedicated mutation owners (`ThreadMemberMessageMutationRouteOwner.ts`, `ThreadMemberArchiveMutationRouteOwner.ts`, and `ThreadMemberInteractionMutationRouteOwner.ts`), reducing `ThreadMemberMutationRouteOwner.ts` from 427 to 49 lines and isolating mutation responsibilities by behavior.
- [x] Debug route ownership was split from `apps/ServerApplication/Source/Network/Routes/DebugRoutes.ts` into dedicated owner modules (`DebugClientErrorRouteOwner.ts`, `DebugHistoryRouteOwner.ts`, `DebugReplayRouteOwner.ts`, and `DebugTraceRouteOwner.ts`) plus explicit contracts/parsing modules (`DebugRouteContracts.ts` and `DebugReplayFrameParser.ts`), reducing `DebugRoutes.ts` from 416 to 41 lines.
- [x] OpenCode mapper ownership was split from `packages/OpenCodeInterfaceAdapter/Source/Mapper.ts` into explicit mapper owner modules (`SessionMapper.ts`, `ConversationTurnMapper.ts`, `TurnItemMapper.ts`, `EventPayloadMapper.ts`) and shared contracts (`MapperContracts.ts`), reducing `Mapper.ts` from 428 to 14 lines while preserving compatibility exports.
- [x] Server bootstrap utility ownership (`jsonResponse`, request-body parsing, error-message normalization, trace-directory creation, and agent descriptor mapping) was extracted from `apps/ServerApplication/Source/Application/ServerBootstrap.ts` into `apps/ServerApplication/Source/Application/Bootstrap/ServerBootstrapUtilityOwner.ts`, reducing the server composition-root file from 402 to 356 lines and removing the final non-`App.tsx` 400+ source-file hotspot.
- [x] Server route orchestration filenames were normalized to explicit descriptive names (`DebugRoutes.ts`, `PushRoutes.ts`, and `ThreadRoutes.ts`) and all dependent imports/contracts were synchronized, removing remaining route filename ambiguity in the network layer.
- [x] Server agent adapter filenames were normalized to explicit descriptive names (`CodexAgentAdapter.ts` and `OpenCodeAgentAdapter.ts`) and all dependent imports/contracts were synchronized, removing remaining adapter filename ambiguity in the server ownership layer.
- [x] App runtime request/session/push callback ownership and stream/presentation helper ownership were extracted from `apps/WebApplication/Source/App.tsx` into `UseApplicationRuntimeRequestHandlers.ts` and `UseApplicationPresentationHelpers.tsx`, reducing `App.tsx` from 985 to 918 lines and keeping app-shell callback logic under explicit application state-management ownership.
- [x] Remaining App chat/debug/push and shell-composition ownership was extracted from `apps/WebApplication/Source/App.tsx` into `UseApplicationChatFeatureComposition.ts`, `UseApplicationDebugFeatureComposition.ts`, `UseApplicationPushFeatureComposition.ts`, and `UseApplicationShellComposition.ts`, reducing `App.tsx` from 918 to 552 lines while preserving focused composition wiring.
- [x] Remaining App runtime effect orchestration ownership was extracted from `apps/WebApplication/Source/App.tsx` into `UseApplicationRuntimeComposition.ts`, reducing `App.tsx` from 552 to 298 lines while keeping `App.tsx` focused on top-level composition and rendering.
- [x] Focused runtime-composition seam tests were added in `apps/WebApplication/Tests/ApplicationRuntimeComposition.test.tsx` to validate loader-ref synchronization and refresh/synchronization/shell wiring handoff through `UseApplicationRuntimeComposition`.
- [x] Build artifact hygiene was refreshed by rebuilding `@farfield/protocol`, `@farfield/api`, and `@farfield/opencode-api` package outputs, eliminating stale sourcemap warning noise during current server/web test runs.
- [x] Codex protocol thread schemas/parsers were split from `packages/CodexProtocol/Source/Thread.ts` into explicit contract owners under `packages/CodexProtocol/Source/Contracts/Thread/*` and `packages/CodexProtocol/Source/Parsers/ThreadParsers.ts`, reducing `Thread.ts` from 580 to 7 lines and lowering source-file size hotspot count from 7 to 6 files over 400 lines.
- [x] Post-extraction focused validation passed for web and server workspaces (`bun run --filter @farfield/web typecheck`, `bun run --filter @farfield/web lint`, `bun run --filter @farfield/web test`, `bun run --filter @farfield/server typecheck`, `bun run --filter @farfield/server lint`, and `bun run --filter @farfield/server test`).
- [x] `apps/WebApplication/Tests/AppSessionAndDebug.test.tsx` includes a protected-session bootstrap scenario covering token entry and post-auth data loading.
- [x] Tooling direction was documented in architecture/proposal docs with Biome recorded as an approved future candidate for formatter/linter consolidation planning.
- [x] Server route-owner contracts now keep strict `JsonValue` request parsing at HTTP ingress while using explicit object response contracts for route outputs, avoiding index-signature bleed across domain response models.
- [x] IPC history recording now validates captured frame payloads with `JsonValueSchema` before persistence, ensuring debug-history payloads remain schema-owned structured data.
- [x] Codex protocol IPC frame schemas now enforce `JsonValueSchema` for request/broadcast params and response result/error payloads; codex API transport/client layers now decode/encode through `JsonValueSchema` boundaries.
- [x] Codex API live-state reducer tests now assert strict typed error capture without broad `unknown` assertions for reduction-failure paths.
- [x] OpenCode schema and mapper ownership now use explicit structured-data contracts (`OpenCodeStructuredDataValue`) and strict boundary parsing in service modules.
- [x] Codex live-state patch traversal ownership now operates on structured-data contracts (`JsonValue`) with explicit patch-value validation for add/replace operations.
- [x] Codex adapter and push-service error classification helpers now use explicit generic signatures and schema parsing instead of broad contract typing.
- [x] Repository rename wave executed for application/package roots, and workspace/config/documentation references were synchronized to `apps/WebApplication`, `apps/ServerApplication`, `packages/CodexProtocol`, `packages/CodexInterfaceAdapter`, and `packages/OpenCodeInterfaceAdapter`.
- [x] `Source` and `Tests` path migration is complete across applications and packages, with scripts/tests/docs updated to use PascalCase path ownership.
- [x] Push-state runtime ownership now uses only canonical path resolution; legacy migration behavior was removed from `apps/ServerApplication/Source/Modules/PushNotifications/PushStatePath.ts` and `apps/ServerApplication/Source/Application/Configuration/ServerRuntimeConfiguration.ts`.
- [x] Strict `JsonValue` transport-edge normalization was tightened in `packages/CodexInterfaceAdapter/Source/Service.ts` and server codex/opencode adapters using schema-owned parsing at ingress/egress boundaries.
- [x] Server application internal composition entrypoint ownership now uses `apps/ServerApplication/Source/Application/ServerBootstrap.ts`; application-level implementation `Index.ts` was removed and server scripts/integration tests were updated to the descriptive entrypoint path.
- [x] Web application cross-domain catch-all `apps/WebApplication/Source/SharedUtilities/*` ownership was removed; styling, debug issue derivation, error formatting, push client behavior, and crash reporter installation now live under explicit `Shared`, `Features`, and `Application/Boot` owner modules.
- [x] Debug helper ownership from `apps/WebApplication/Source/SharedUtilities/DebugHelpers.ts` was split into explicit domain/state modules (`DebugIssueContracts.ts`, `DebugIssueDerivation.ts`, `ErrorBannerDetailsParser.ts`, and `TrackedUserInterfaceErrorPolicy.ts`) with chat-specific read-error classifiers and shared error-message ownership moved to dedicated modules.
- [x] Push client and crash-reporter ownership was consolidated into feature/application owners (`PushClientStateManager.ts`, `PushClientContracts.ts`, `ClientErrorReporter.ts`, and `InstallClientErrorReporter.ts`) and all source/test imports were migrated to those owner paths.
- [x] Theme hook ownership was moved from the generic `apps/WebApplication/Source/Hooks/UseTheme.ts` location into `apps/WebApplication/Source/Features/Theme/StateManagement/UseTheme.ts`, and the empty generic hooks folder was removed.
- [x] Pending thread materialization ownership was moved from cross-module mutable ref mutation into `apps/WebApplication/Source/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator.ts`, and chat/thread loaders now consume typed owner APIs.
- [x] Push store persistence now uses queued asynchronous file writes in `apps/ServerApplication/Source/Modules/PushNotifications/PushStore.ts`, removing synchronous filesystem writes from request paths.
- [x] Push fan-out sending now uses bounded concurrent workers in `apps/ServerApplication/Source/Modules/PushNotifications/PushService.ts`, and thread-stream updates now invalidate thread-list aggregation cache in `apps/ServerApplication/Source/Application/ServerBootstrap.ts` for fresher list reads.

### Current High-Impact Remaining Gaps

1. No blocking high-impact migration gaps remain.
2. No active source-size watchlist remains; all current source owners are under preferred and hard file-size thresholds.

## Compatibility And Path Alignment Requirements

When folder and file paths are moved to this end-state layout, update all path-dependent surfaces together:

1. Workspace and package discovery:
   - root `package.json` workspaces
   - per-application and per-package `package.json` scripts
2. TypeScript path resolution:
   - root `tsconfig.base.json`
   - per-application and per-package `tsconfig.json`
3. Build/dev/runtime scripts:
   - `scripts/**/*.mjs`
   - runtime bootstrap paths referenced by scripts
   - `bun run validate:scripts:governance` path-literal governance checks after script path changes
4. Test and end-to-end runners:
   - `playwright.real.config.ts`
   - `end-to-end/**` imports and helper references
5. Documentation and contributor instructions:
   - `README.md`
   - `CONTRIBUTING.md`
   - `AGENTS.md`
   - architecture and proposed-structure docs
6. Import path references in source code:
   - feature imports
   - package exports/imports
   - test imports

All path families above must remain internally consistent after each rename/move set.

## Migration Governance (End-State)

1. Structural moves are executed in coherent ownership slices (feature/module by feature/module).
2. Each move set must update:
   - source paths
   - imports
   - test paths
   - docs references
3. Owner registries are updated in the same change when ownership moves.
4. Migration diffs must preserve runtime behavior and type/runtime contract alignment.
5. Completed move sets must leave the repository in a consistently buildable state.

## Decision Log And Exception Register (End-State)

1. Architecture decisions are tracked either:
   - in `docs/decisions`
   - or in a dedicated decision-log section in this document
2. Structural exceptions are tracked with status, owner, reason, review date, and planned removal date when applicable.
3. Exception records must reference affected files/modules and mitigation plan with dated follow-up milestones.
4. Migration and architecture changes update decision/exception records in the same change.

### Current Decision Entries

1. Date: 2026-02-23
   - Decision: Cross-module contract granularity is tiered.
   - Rule:
     - Data-access modules expose full schema-aligned request/response contracts.
     - Owner/coordinator modules expose minimal explicit contracts containing only consumed fields.
   - Reason: preserves strict transport correctness while keeping orchestration/test surfaces smaller and easier to maintain.

2. Date: 2026-02-23
   - Decision: While extracting endpoint ownership out of `apps/WebApplication/Source/SharedUtilities/api.ts`, preserve temporary compatibility re-exports from `lib/api.ts` until direct imports are migrated.
   - Reason: allows incremental migration with stable behavior and tests while reducing monolithic transport ownership risk.

3. Date: 2026-02-23
   - Decision: Execute repository rename wave in two sequential atomic sets:
     - set one: `apps/web` -> `apps/WebApplication` and `apps/server` -> `apps/ServerApplication`
     - set two: `packages/codex-protocol` -> `packages/CodexProtocol`, `packages/codex-api` -> `packages/CodexInterfaceAdapter`, and `packages/opencode-api` -> `packages/OpenCodeInterfaceAdapter`
   - Reason: keeps each wave reviewable, limits simultaneous path-surface breakage, and preserves recovery speed if one wave needs adjustment.

4. Date: 2026-02-23
   - Decision: API authentication token ownership stays server-side only; browser bundles and service workers do not read or store API tokens.
   - Rule:
     - Browser request modules do not set `X-Farfield-Token`.
     - Service-worker modules do not persist or synchronize API tokens.
     - Trusted server-side infrastructure (development proxy or reverse proxy) injects `X-Farfield-Token` where required.
     - Direct browser-to-Farfield-server mode remains supported with `API_TOKEN` unset.
   - Reason: removes secret material from browser-executable surfaces while preserving authenticated API behavior.

5. Date: 2026-02-24
   - Decision: Repository rename wave is complete, and path-dependent scripts, tests, lock metadata, and documentation now point to the renamed application/package directories.
   - Reason: this closes the highest-risk structural naming inconsistency while preserving build/test behavior and migration momentum.

6. Date: 2026-02-24
   - Decision: `Source` and `Tests` path migration is complete for applications and packages.
   - Reason: this aligns runtime/build/test ownership paths with PascalCase naming rules and removes the highest remaining path-level inconsistency.

7. Date: 2026-02-24
   - Decision: Push-state storage uses one canonical runtime path only; legacy migration behavior is removed.
   - Reason: this removes deprecated path handling and keeps persistence ownership explicit, deterministic, and easier to maintain.

8. Date: 2026-02-24
   - Decision: Execute repository-wide import-path canonicalization after PascalCase rename waves.
   - Rule:
     - Normalize import specifiers to concrete on-disk ownership paths in the same rename set.
     - Validate full workspaces with `typecheck`, `lint`, and `test` immediately after canonicalization.
   - Reason: path-case drift across large rename waves creates silent coupling risk and type-resolution failures unless imports are normalized in bulk.

9. Date: 2026-02-24
   - Decision: Rename non-source root abbreviations to explicit names (`e2e` -> `end-to-end`, `ops` -> `operations`) and align all path-dependent surfaces in one change.
   - Reason: this aligns root ownership surfaces with no-abbreviation naming rules and reduces long-term path inconsistency.

10. Date: 2026-02-24
   - Decision: Standardize real-app command and diagnostics naming from `e2e` shorthand to explicit `end-to-end`.
   - Rule:
     - use `end-to-end:real:*` scripts and `verify:end-to-end:real` command naming
     - use `validate:end-to-end:governance` for coverage governance checks
     - use `validate:scripts:governance` for canonical script path-literal checks
     - use `.runtime/end-to-end-sentinel/*` for real-app sentinel artifacts
   - Reason: this keeps command, artifact, and governance naming aligned with no-abbreviation clarity standards.

11. Date: 2026-02-24
   - Decision: Canonicalize hand-authored relative import specifiers across `apps/*` and `packages/*`.
   - Rule:
     - import specifiers must use canonical segments (`./` and `../`)
     - duplicate relative segments (`././`, `.././`) are disallowed in hand-authored source
     - generated/vendor surfaces are exempt from this normalization pass
   - Reason: canonical import specifiers improve readability, reduce rename churn, and remove avoidable path inconsistency in review.

12. Date: 2026-02-24
   - Decision: Keep generated and vendored import-specifier formatting tooling-owned and unchanged in manual migration sweeps.
   - Rule:
     - canonical import-specifier normalization applies to hand-authored source only
     - generated/vendor directories are updated through source generator workflows only
   - Reason: manual edits in generated/vendor surfaces introduce churn and are overwritten by generation workflows, which reduces long-term maintainability and review signal.

13. Date: 2026-02-24
   - Decision: Replace server application implementation `Index.ts` with descriptive bootstrap entrypoint ownership.
   - Rule:
     - application runtime entrypoint is `apps/ServerApplication/Source/Application/ServerBootstrap.ts`
     - server package scripts and integration tests reference the descriptive entrypoint path
   - Reason: aligns server source with internal `Index.ts` prohibition and improves entrypoint discoverability.

14. Date: 2026-02-24
   - Decision: Remove web `SharedUtilities` catch-all ownership and split behavior into explicit owner modules.
   - Rule:
     - styling helpers live under `apps/WebApplication/Source/Shared/Styling/*`
     - shared error-message formatting lives under `apps/WebApplication/Source/Shared/Errors/*`
     - debug issue derivation and error policies live under `apps/WebApplication/Source/Features/Debugging/*`
     - push client behavior and contracts live under `apps/WebApplication/Source/Features/PushNotifications/*`
     - application boot crash-reporter installation lives under `apps/WebApplication/Source/Application/Boot/*`
   - Reason: eliminates cross-domain catch-all coupling and keeps ownership boundaries explicit for maintainability.

15. Date: 2026-02-24
   - Decision: Normalize server source ownership under explicit `Application`, `Modules`, and `Shared` subtrees.
   - Rule:
     - bootstrap and lifecycle owners live under `apps/ServerApplication/Source/Application/Bootstrap/*`
     - runtime configuration owner lives under `apps/ServerApplication/Source/Application/Configuration/*`
     - runtime state owner lives under `apps/ServerApplication/Source/Application/StateManagement/*`
     - domain services and persistence owners live under `apps/ServerApplication/Source/Modules/*`
     - shared logging ownership lives under `apps/ServerApplication/Source/Shared/Logging/*`
   - Reason: improves discoverability, enforces ownership boundaries, and removes root-level source concentration.

16. Date: 2026-02-24
   - Decision: Move pending thread materialization state out of cross-module mutable refs into an explicit owner class.
   - Rule:
     - pending thread materialization mutation/query behavior is owned by `apps/WebApplication/Source/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator.ts`
     - chat/thread loaders and action handlers consume coordinator APIs instead of mutating shared `Set` refs directly
   - Reason: enforces single-owner mutation policy and reduces hidden cross-module coupling.

17. Date: 2026-02-24
   - Decision: Use non-blocking persisted push-state writes and bounded concurrent push fan-out.
   - Rule:
     - push-state persistence writes are queued async operations in `apps/ServerApplication/Source/Modules/PushNotifications/PushStore.ts`
     - push send fan-out uses bounded concurrent workers in `apps/ServerApplication/Source/Modules/PushNotifications/PushService.ts`
     - thread-stream updates invalidate thread-list aggregation cache in `apps/ServerApplication/Source/Application/ServerBootstrap.ts`
   - Reason: removes request-path event-loop blocking, improves push throughput, and keeps thread list reads fresher during live updates.

18. Date: 2026-02-24 (updated 2026-02-26)
   - Status: completed.
   - Owner: repository operations maintainers.
   - Decision: close the temporary flat-script layout exception by moving runtime command ownership into grouped folders (`scripts/development`, `scripts/setup`, `scripts/smoke`, `scripts/operations`, and `scripts/tooling`) in one path-consistent change set.
   - Affected Files/Modules:
     - root `package.json` script entrypoints
     - `.github/workflows/ios-setup-checks.yml` script syntax and helper path checks
     - grouped script runtime command ownership under `scripts/**/*.mjs`
     - docs references that describe script execution paths
   - Validation Evidence:
     - root command rewiring now points to grouped script paths
     - workflow syntax checks and env-loader invocation now target grouped paths
     - migration/docs references now point to grouped script ownership
     - script path literals are now validated by `bun run validate:scripts:governance` to prevent legacy path drift

19. Date: 2026-02-26
   - Decision: Codify boundary and hot-path hardening governance outcomes and classify excluded surfaces by policy status.
   - Rule:
     - boundary and hot-path hardening outcomes are baseline governance requirements for stream/cache/concurrency owner changes
     - excluded surfaces must be recorded with status (`accepted exclusion` or `scheduled hardening`), owner, review date, and dated follow-up milestones
     - scheduled hardening entries must include a planned removal date and explicit milestone evidence
   - Reason: keeps exclusions bounded and reviewable while preserving hardening progress accountability.
   - Record: `docs/decisions/2026-02-26-ExcludedSurfaceHardeningGovernance.md`

20. Date: 2026-02-28
   - Status: scheduled hardening.
   - Owner: app-server coverage owners.
   - Decision: Temporarily allow line-budget exceptions for three owner files while app-server coverage surfaces are integrated end-to-end.
   - Affected Files/Modules:
     - `packages/CodexInterfaceAdapter/Source/AppServerClient.ts`
     - `apps/ServerApplication/Source/Network/Routes/CapabilityRoutes.ts`
     - `apps/WebApplication/Source/Application/StateManagement/UseApplicationShellViewProperties.ts`
   - Reason: integration expanded method and surface contracts in one pass; extraction work is tracked and time-bounded.
   - Review Date: 2026-03-15.
   - Planned Removal Date: 2026-03-29.
   - Dated Follow-up Schedule:
     - 2026-03-08: extract app-server coverage request/response contracts and mappers from `AppServerClient`.
     - 2026-03-15: split capability coverage route handlers from `CapabilityRoutes`.
     - 2026-03-22: split debug workspace pane property builders from `UseApplicationShellViewProperties`.
     - 2026-03-29: remove temporary file-length ignores after follow-up extractions land.

### Current Excluded Surface Hardening Register

| Surface | Status | Owner | Review Date | Planned Removal Date | Dated Follow-up Schedule |
| --- | --- | --- | --- | --- | --- |
| `packages/CodexProtocol/Source/Generated` | accepted exclusion | protocol contracts owner | 2026-06-30 | not applicable | 2026-03-15: verify generated contract parity checks remain green. 2026-06-30: re-validate exclusion scope and regeneration workflow ownership. |
| `packages/CodexProtocol/Tests/fixtures` | accepted exclusion | protocol testing owner | 2026-06-30 | not applicable | 2026-03-15: run fixture sanitization and sensitive-data scan policy audit. 2026-06-30: review fixture lifecycle ownership and retention policy. |
| `end-to-end` | scheduled hardening | end-to-end ownership maintainer | 2026-04-15 | 2026-05-15 | 2026-03-11: publish owner map for `real/fixtures`, `real/helpers`, and `real/scenarios`. 2026-03-29: add explicit boundary schemas for scenario fixture loading and route/test harness contracts. 2026-04-26: run path and naming hardening pass with docs/test-runner alignment. |

## End-State Completion Criteria

1. Source folders and files are `PascalCase`.
2. Exception: repository roots remain lowercase as `apps` and `packages`.
3. Source folder names avoid abbreviations and use descriptive full words.
4. Non-source root folders remain lowercase and descriptive.
5. Every mutable state surface has a documented owner class.
6. Cross-module APIs and exported functions use explicit types.
7. External payload handling combines schema validation with compile-time typing.
8. Internal barrel files are absent under source feature/module folders.
9. User interface, state management, data access, and domain model concerns remain separated.
10. Every cache has a documented owner and explicit invalidation/bounds policy.
11. Concurrency-sensitive behavior is managed by explicit coordinator owners.
12. File and function size limits are respected or exceptions are documented.
13. Configuration ownership is explicit and environment access is centralized.
14. Security boundaries and sensitive-data handling rules are documented and enforced.
15. Error mapping and observability responsibilities are explicit per owner module.
16. Data lifecycle and retention/eviction rules are documented for each owned surface.
17. Migration governance rules are followed for all structural moves.
18. Decision records and temporary exceptions are documented and current.
19. Excluded-surface entries are classified as `accepted exclusion` or `scheduled hardening` with explicit owner, review date, and dated follow-up schedule.
