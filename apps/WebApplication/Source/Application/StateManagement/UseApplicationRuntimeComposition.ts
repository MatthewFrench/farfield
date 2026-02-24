import { ApplicationRouteStateMapper } from "@/Application/DomainModel/ApplicationRouteStateMapper";
import {
  type ApplicationFormattingHelpers
} from "@/Application/StateManagement/UseApplicationPresentationHelpers";
import {
  type ApplicationRuntimeRequestHandlers
} from "@/Application/StateManagement/UseApplicationRuntimeRequestHandlers";
import {
  type ApplicationShellComposition,
  useApplicationShellComposition
} from "@/Application/StateManagement/UseApplicationShellComposition";
import {
  type ApplicationShellState
} from "@/Application/StateManagement/UseApplicationShellState";
import {
  useApplicationSynchronizationEffects
} from "@/Application/StateManagement/UseApplicationSynchronizationEffects";
import { useApplicationRefreshEffects } from "@/Application/StateManagement/UseApplicationRefreshEffects";
import { useApplicationPushFeatureComposition } from "@/Application/StateManagement/UseApplicationPushFeatureComposition";
import { useApplicationChatFeatureComposition } from "@/Application/StateManagement/UseApplicationChatFeatureComposition";
import { useApplicationDebugFeatureComposition } from "@/Application/StateManagement/UseApplicationDebugFeatureComposition";
import { useViewportShellEffects } from "@/Application/StateManagement/UseViewportShellEffects";
import { useEventStreamEffects } from "@/Application/StateManagement/UseEventStreamEffects";
import { type ApplicationDerivedState } from "@/Application/StateManagement/UseApplicationDerivedStateContracts";
import {
  type ApplicationOwnerDependencies
} from "@/Application/StateManagement/UseApplicationOwnerDependencies";
import {
  type CoreDataCapabilitySnapshot,
  type CoreDataLoaders
} from "@/Application/StateManagement/UseCoreDataLoaders";
import {
  useModeAndPendingRequestEffects
} from "@/Features/Chat/StateManagement/UseModeAndPendingRequestEffects";
import {
  useSelectedThreadLifecycleEffects
} from "@/Features/Chat/StateManagement/UseSelectedThreadLifecycleEffects";
import {
  type SelectedThreadLoaders
} from "@/Features/Chat/StateManagement/UseSelectedThreadLoaders";

export interface UseApplicationRuntimeCompositionInput {
  theme: string;
  toggleTheme: () => void;
  appDefaultValue: string;
  initialVisibleChatItems: number;
  visibleChatItemsStep: number;
  coreRefreshIntervalMs: number;
  coreRefreshConnectedMinIntervalMs: number;
  debugHistoryLimit: number;
  debugErrorListLimit: number;
  applicationRouteStateMapper: ApplicationRouteStateMapper;
  applicationShellState: ApplicationShellState;
  applicationDerivedState: ApplicationDerivedState;
  applicationOwnerDependencies: ApplicationOwnerDependencies<CoreDataCapabilitySnapshot>;
  runtimeRequestHandlers: ApplicationRuntimeRequestHandlers;
  coreDataLoaders: CoreDataLoaders;
  loadSelectedThreadTracked: SelectedThreadLoaders["loadSelectedThreadTracked"];
  streamEventCards: React.JSX.Element[];
  renderAgentFavicon: ApplicationFormattingHelpers["renderAgentFavicon"];
  formatDateValue: ApplicationFormattingHelpers["formatDateValue"];
}

export interface ApplicationRuntimeComposition {
  shellComposition: ApplicationShellComposition;
}

export function useApplicationRuntimeComposition(
  input: UseApplicationRuntimeCompositionInput
): ApplicationRuntimeComposition {
  input.applicationShellState.loadCoreDataTrackedRef.current = input.coreDataLoaders.loadCoreDataTracked;
  input.applicationShellState.loadSelectedThreadRef.current = input.loadSelectedThreadTracked;

  const pushFeatureComposition = useApplicationPushFeatureComposition({
    apiSessionBootstrapCoordinator: input.applicationOwnerDependencies.apiSessionBootstrapCoordinator,
    apiSessionTokenDraft: input.applicationShellState.apiSessionTokenDraft,
    pushNotificationToolbarActionCoordinator: input.applicationOwnerDependencies.pushNotificationToolbarActionCoordinator,
    refreshAll: input.coreDataLoaders.refreshAll,
    setApiSessionTokenDraft: input.applicationShellState.setApiSessionTokenDraft,
    setApiSessionBootstrapErrorMessage: input.applicationShellState.setApiSessionBootstrapError,
    setErrorMessage: input.applicationShellState.setError,
    setIsApiSessionBootstrapPending: input.applicationShellState.setIsApiSessionBootstrapPending,
    setIsEnablingPushNotifications: input.applicationShellState.setIsEnablingPushNotifications,
    setPushClientState: input.applicationShellState.setPushClientState,
    setRequiresApiSessionToken: input.applicationShellState.setRequiresApiSessionToken
  });

  useViewportShellEffects({
    applicationShellElementRef: input.applicationShellState.applicationShellElementRef,
    scrollRef: input.applicationShellState.scrollRef,
    activeTabRef: input.applicationShellState.activeTabRef,
    isChatAtBottomRef: input.applicationShellState.isChatAtBottomRef,
    viewportKeyboardStateRef: input.applicationShellState.viewportKeyboardStateRef,
    keyboardOpenScrollRafRef: input.applicationShellState.keyboardOpenScrollRafRef,
    setIsChatAtBottom: input.applicationShellState.setIsChatAtBottom,
    runtimeViewportSizingCoordinator: input.applicationOwnerDependencies.runtimeViewportSizingCoordinator,
    pageTouchOverscrollGuardCoordinator: input.applicationOwnerDependencies.pageTouchOverscrollGuardCoordinator,
    chatScrollStateCoordinator: input.applicationOwnerDependencies.chatScrollStateCoordinator
  });

  useApplicationRefreshEffects({
    selectedThreadId: input.applicationShellState.selectedThreadId,
    activeTab: input.applicationShellState.activeTab,
    unreadThreadIds: input.applicationShellState.unreadThreadIds,
    isArchivedThreadsOpen: input.applicationShellState.isArchivedThreadsOpen,
    hasLoadedArchivedThreads: input.applicationShellState.hasLoadedArchivedThreads,
    filteredDebugIssues: input.applicationDerivedState.filteredDebugIssues,
    selectedDebugIssueId: input.applicationShellState.selectedDebugIssueId,
    selectedThreadIdRef: input.applicationShellState.selectedThreadIdRef,
    activeTabRef: input.applicationShellState.activeTabRef,
    unreadThreadIdsRef: input.applicationShellState.unreadThreadIdsRef,
    isArchivedThreadsOpenRef: input.applicationShellState.isArchivedThreadsOpenRef,
    hasLoadedArchivedThreadsRef: input.applicationShellState.hasLoadedArchivedThreadsRef,
    coreRefreshIntervalRef: input.applicationShellState.coreRefreshIntervalRef,
    eventsConnectedRef: input.applicationShellState.eventsConnectedRef,
    lastCoreRefreshAtRef: input.applicationShellState.lastCoreRefreshAtRef,
    setUnreadThreadIds: input.applicationShellState.setUnreadThreadIds,
    setSelectedThreadId: input.applicationShellState.setSelectedThreadId,
    setActiveTab: input.applicationShellState.setActiveTab,
    setSelectedDebugIssueId: input.applicationShellState.setSelectedDebugIssueId,
    threadListStateController: input.applicationOwnerDependencies.threadListStateController,
    debugIssueStateResolver: input.applicationOwnerDependencies.debugIssueStateResolver,
    applicationRouteStateMapper: input.applicationRouteStateMapper,
    loadCoreDataTracked: input.coreDataLoaders.loadCoreDataTracked,
    loadArchivedThreads: input.coreDataLoaders.loadArchivedThreads,
    refreshAll: input.coreDataLoaders.refreshAll,
    refreshPushClientState: pushFeatureComposition.refreshPushClientState,
    handleRuntimeRequestError: input.runtimeRequestHandlers.handleRuntimeRequestError,
    coreRefreshIntervalMs: input.coreRefreshIntervalMs,
    coreRefreshConnectedMinIntervalMs: input.coreRefreshConnectedMinIntervalMs
  });

  useSelectedThreadLifecycleEffects({
    selectedThreadId: input.applicationShellState.selectedThreadId,
    selectedThreadIdRef: input.applicationShellState.selectedThreadIdRef,
    selectedThreadLoadTokenRef: input.applicationShellState.selectedThreadLoadTokenRef,
    loadSelectedThreadRef: input.applicationShellState.loadSelectedThreadRef,
    selectedThreadRefreshConcurrencyCoordinator: input.applicationOwnerDependencies.selectedThreadRefreshConcurrencyCoordinator,
    setLiveState: input.applicationShellState.setLiveState,
    setReadThreadState: input.applicationShellState.setReadThreadState,
    setStreamEvents: input.applicationShellState.setStreamEvents,
    setIsSelectedThreadLoading: input.applicationShellState.setIsSelectedThreadLoading,
    setSelectedThreadId: input.applicationShellState.setSelectedThreadId,
    handleRuntimeRequestError: input.runtimeRequestHandlers.handleRuntimeRequestError
  });

  useEventStreamEffects({
    debugHistoryLimit: input.debugHistoryLimit,
    debugErrorListLimit: input.debugErrorListLimit,
    eventRefreshScheduler: input.applicationOwnerDependencies.eventRefreshScheduler,
    eventStreamConnectionCoordinator: input.applicationOwnerDependencies.eventStreamConnectionCoordinator,
    eventStreamRefreshDecisionEngine: input.applicationOwnerDependencies.eventStreamRefreshDecisionEngine,
    activeTabRef: input.applicationShellState.activeTabRef,
    selectedThreadIdRef: input.applicationShellState.selectedThreadIdRef,
    loadCoreDataTrackedRef: input.applicationShellState.loadCoreDataTrackedRef,
    loadSelectedThreadRef: input.applicationShellState.loadSelectedThreadRef,
    debugWorkspaceDataReader: input.applicationOwnerDependencies.debugWorkspaceDataReader,
    debugWorkspaceStateStore: input.applicationOwnerDependencies.debugWorkspaceStateStore,
    debugErrorsSignatureRef: input.applicationShellState.debugErrorsSignatureRef,
    eventsConnectedRef: input.applicationShellState.eventsConnectedRef,
    setHistory: input.applicationShellState.setHistory,
    setDebugErrors: input.applicationShellState.setDebugErrors,
    setDebugErrorSessionId: input.applicationShellState.setDebugErrorSessionId,
    setDebugErrorSessionLogPath: input.applicationShellState.setDebugErrorSessionLogPath,
    handleRuntimeRequestError: input.runtimeRequestHandlers.handleRuntimeRequestError
  });

  useModeAndPendingRequestEffects({
    activeRequest: input.applicationDerivedState.activeRequest,
    setSelectedRequestId: input.applicationShellState.setSelectedRequestId,
    setAnswerDraft: input.applicationShellState.setAnswerDraft,
    modeSelectionSyncCoordinator: input.applicationOwnerDependencies.modeSelectionSyncCoordinator,
    conversationState: input.applicationDerivedState.conversationState,
    appDefaultModel: input.applicationDerivedState.appDefaultModel,
    appDefaultReasoningEffort: input.applicationDerivedState.appDefaultReasoningEffort,
    defaultModeKey: input.applicationDerivedState.defaultModeOption?.mode || "",
    selectedModeKey: input.applicationShellState.selectedModeKey,
    selectedModelId: input.applicationShellState.selectedModelId,
    selectedReasoningEffort: input.applicationShellState.selectedReasoningEffort,
    hasHydratedModeFromLiveState: input.applicationShellState.hasHydratedModeFromLiveState,
    isModeSyncing: input.applicationShellState.isModeSyncing,
    lastAppliedModeSignatureRef: input.applicationShellState.lastAppliedModeSignatureRef,
    setSelectedModeKey: input.applicationShellState.setSelectedModeKey,
    setSelectedModelId: input.applicationShellState.setSelectedModelId,
    setSelectedReasoningEffort: input.applicationShellState.setSelectedReasoningEffort,
    setHasHydratedModeFromLiveState: input.applicationShellState.setHasHydratedModeFromLiveState,
    setIsModeSyncing: input.applicationShellState.setIsModeSyncing,
    selectedThreadId: input.applicationShellState.selectedThreadId
  });

  const chatFeatureComposition = useApplicationChatFeatureComposition({
    chatScrollEffectsInput: {
      activeTab: input.applicationShellState.activeTab,
      selectedThreadId: input.applicationShellState.selectedThreadId,
      conversationItemCount: input.applicationDerivedState.conversationItemCount,
      initialVisibleChatItemCount: input.initialVisibleChatItems,
      scrollRef: input.applicationShellState.scrollRef,
      chatContentRef: input.applicationShellState.chatContentRef,
      isChatAtBottom: input.applicationShellState.isChatAtBottom,
      isChatAtBottomRef: input.applicationShellState.isChatAtBottomRef,
      setIsChatAtBottom: input.applicationShellState.setIsChatAtBottom,
      setVisibleChatItemLimit: input.applicationShellState.setVisibleChatItemLimit,
      chatScrollStateCoordinator: input.applicationOwnerDependencies.chatScrollStateCoordinator
    },
    chatActionHandlersInput: {
      selectedThreadId: input.applicationShellState.selectedThreadId,
      selectedAgentId: input.applicationShellState.selectedAgentId,
      modes: input.applicationShellState.modes,
      isModeSyncing: input.applicationShellState.isModeSyncing,
      activeRequest: input.applicationDerivedState.activeRequest,
      answerDraft: input.applicationShellState.answerDraft,
      setAnswerDraft: input.applicationShellState.setAnswerDraft,
      buildActionRequestOptions: input.runtimeRequestHandlers.buildActionRequestOptions,
      setIsBusy: input.applicationShellState.setIsBusy,
      setIsModeSyncing: input.applicationShellState.setIsModeSyncing,
      setSelectedThreadId: input.applicationShellState.setSelectedThreadId,
      selectedThreadIdRef: input.applicationShellState.selectedThreadIdRef,
      pendingThreadMaterializationCoordinator: input.applicationShellState.pendingThreadMaterializationCoordinator,
      readLastAppliedModeSignature: () => input.applicationShellState.lastAppliedModeSignatureRef.current,
      writeLastAppliedModeSignature: (nextModeSignature) => {
        input.applicationShellState.lastAppliedModeSignatureRef.current = nextModeSignature;
      },
      chatRequestActionCoordinator: input.applicationOwnerDependencies.chatRequestActionCoordinator,
      collaborationModeActionCoordinator: input.applicationOwnerDependencies.collaborationModeActionCoordinator,
      chatClient: input.applicationOwnerDependencies.chatServerClient,
      threadMutationClient: input.applicationOwnerDependencies.threadMutationServerClient,
      pendingUserInputAnswerBuilder: input.applicationOwnerDependencies.pendingUserInputAnswerBuilder,
      onInvalidateActiveThreadQuery: () => {
        input.applicationOwnerDependencies.threadListStateController.invalidateActiveThreadQuery();
      },
      refreshAll: input.coreDataLoaders.refreshAll,
      onReloadSelectedThread: input.loadSelectedThreadTracked,
      reportTrackedUserInterfaceError: input.runtimeRequestHandlers.reportTrackedUserInterfaceError
    },
    chatModeToolbarPropertiesInput: {
      canSetCollaborationMode: input.applicationDerivedState.canSetCollaborationMode,
      canListCollaborationModes: input.applicationDerivedState.canListCollaborationModes,
      canListModels: input.applicationDerivedState.canListModels,
      planModeOption: input.applicationDerivedState.planModeOption,
      defaultModeKey: input.applicationDerivedState.defaultModeOption?.mode ?? null,
      isPlanModeEnabled: input.applicationDerivedState.isPlanModeEnabled,
      selectedThreadId: input.applicationShellState.selectedThreadId,
      appDefaultValue: input.appDefaultValue,
      appDefaultModel: input.applicationDerivedState.appDefaultModel,
      appDefaultReasoningEffort: input.applicationDerivedState.appDefaultReasoningEffort,
      selectedModelId: input.applicationShellState.selectedModelId,
      selectedReasoningEffort: input.applicationShellState.selectedReasoningEffort,
      selectedModeKey: input.applicationShellState.selectedModeKey,
      modelOptionsWithoutAssumedDefault: input.applicationDerivedState.modelOptionsWithoutAssumedDefault,
      effortOptionsWithoutAssumedDefault: input.applicationDerivedState.effortOptionsWithoutAssumedDefault,
      isModeSyncing: input.applicationShellState.isModeSyncing,
      pendingRequestCount: input.applicationDerivedState.pendingRequests.length,
      setSelectedModeKey: (modeKey) => {
        input.applicationShellState.setSelectedModeKey(modeKey);
      },
      setSelectedModelId: (modelId) => {
        input.applicationShellState.setSelectedModelId(modelId);
      },
      setSelectedReasoningEffort: (reasoningEffort) => {
        input.applicationShellState.setSelectedReasoningEffort(reasoningEffort);
      }
    }
  });

  const debugFeatureComposition = useApplicationDebugFeatureComposition({
    debugWorkspaceActionCoordinator: input.applicationOwnerDependencies.debugWorkspaceActionCoordinator,
    debugServerClient: input.applicationOwnerDependencies.debugServerClient,
    refreshCoreData: input.coreDataLoaders.loadCoreDataTracked,
    traceLabel: input.applicationShellState.traceLabel,
    traceNote: input.applicationShellState.traceNote,
    errorBannerDetails: input.applicationDerivedState.errorBannerDetails,
    setActiveTab: input.applicationShellState.setActiveTab,
    setDebugWorkspaceSection: input.applicationShellState.setDebugWorkspaceSection,
    setDebugIssueSeverityFilter: input.applicationShellState.setDebugIssueSeverityFilter,
    setSelectedDebugIssueId: input.applicationShellState.setSelectedDebugIssueId,
    setDebugIssueFilterQuery: input.applicationShellState.setDebugIssueFilterQuery,
    onHistoryDetailLoaded: input.applicationShellState.setHistoryDetail
  });

  useApplicationSynchronizationEffects({
    loadCoreDataTracked: input.coreDataLoaders.loadCoreDataTracked,
    loadCoreDataTrackedRef: input.applicationShellState.loadCoreDataTrackedRef,
    loadSelectedThreadTracked: input.loadSelectedThreadTracked,
    loadSelectedThreadRef: input.applicationShellState.loadSelectedThreadRef,
    loadHistoryDetail: debugFeatureComposition.loadHistoryDetail,
    selectedHistoryId: input.applicationShellState.selectedHistoryId,
    handleRuntimeRequestError: input.runtimeRequestHandlers.handleRuntimeRequestError
  });

  const shellComposition = useApplicationShellComposition({
    theme: input.theme,
    toggleTheme: input.toggleTheme,
    visibleChatItemsStep: input.visibleChatItemsStep,
    applicationShellState: input.applicationShellState,
    applicationDerivedState: input.applicationDerivedState,
    streamEventCards: input.streamEventCards,
    renderAgentFavicon: input.renderAgentFavicon,
    formatDateValue: input.formatDateValue,
    loadCoreDataTracked: input.coreDataLoaders.loadCoreDataTracked,
    refreshAll: input.coreDataLoaders.refreshAll,
    buildActionRequestOptions: input.runtimeRequestHandlers.buildActionRequestOptions,
    reportTrackedUserInterfaceError: input.runtimeRequestHandlers.reportTrackedUserInterfaceError,
    threadMutationServerClient: input.applicationOwnerDependencies.threadMutationServerClient,
    threadMutationActionCoordinator: input.applicationOwnerDependencies.threadMutationActionCoordinator,
    threadListStateController: input.applicationOwnerDependencies.threadListStateController,
    mobileSidebarSwipeCoordinator: input.applicationOwnerDependencies.mobileSidebarSwipeCoordinator,
    runtimeViewportSizingCoordinator: input.applicationOwnerDependencies.runtimeViewportSizingCoordinator,
    chatScrollStateCoordinator: input.applicationOwnerDependencies.chatScrollStateCoordinator,
    chatFeatureComposition,
    debugFeatureComposition,
    pushFeatureComposition
  });

  return {
    shellComposition
  };
}
