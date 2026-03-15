import { ThreadPreviewReadClient } from "@/Features/Chat/DataAccess/ThreadPreviewReadClient";
import {
  readActiveApplyPatchApprovalRequest,
  readPendingApplyPatchApprovalRequests,
} from "@/Features/Chat/DomainModel/PendingApplyPatchApprovalRequestSelector";
import {
  readActiveAuthTokenRefreshRequest,
  readPendingAuthTokenRefreshRequests,
} from "@/Features/Chat/DomainModel/PendingAuthTokenRefreshRequestSelector";
import {
  readActiveCommandExecutionApprovalRequest,
  readPendingCommandExecutionApprovalRequests,
} from "@/Features/Chat/DomainModel/PendingCommandExecutionApprovalRequestSelector";
import {
  readActiveExecuteCommandApprovalRequest,
  readPendingExecuteCommandApprovalRequests,
} from "@/Features/Chat/DomainModel/PendingExecuteCommandApprovalRequestSelector";
import {
  readActiveFileChangeApprovalRequest,
  readPendingFileChangeApprovalRequests,
} from "@/Features/Chat/DomainModel/PendingFileChangeApprovalRequestSelector";
import {
  readActiveToolCallRequest,
  readPendingToolCallRequests,
} from "@/Features/Chat/DomainModel/PendingToolCallRequestSelector";
import { type UseModeAndPendingRequestEffectsInput } from "@/Features/Chat/StateManagement/UseModeAndPendingRequestEffects";
import { type UseSelectedThreadLifecycleEffectsInput } from "@/Features/Chat/StateManagement/UseSelectedThreadLifecycleEffects";
import { type DebugActionHandlers } from "@/Features/Debugging/StateManagement/UseDebugActionHandlers";
import {
  type ApplicationChatFeatureComposition,
  type UseApplicationChatFeatureCompositionInput,
} from "./UseApplicationChatFeatureComposition";
import { type UseApplicationDebugFeatureCompositionInput } from "./UseApplicationDebugFeatureComposition";
import {
  type ApplicationPushFeatureComposition,
  type UseApplicationPushFeatureCompositionInput,
} from "./UseApplicationPushFeatureComposition";
import { type UseApplicationRefreshEffectsInput } from "./UseApplicationRefreshEffects";
import { type UseApplicationRuntimeCompositionInput } from "./UseApplicationRuntimeCompositionContracts";
import { type UseApplicationShellCompositionInput } from "./UseApplicationShellComposition";
import { type UseApplicationSynchronizationEffectsInput } from "./UseApplicationSynchronizationEffects";
import { type UseEventStreamEffectsInput } from "./UseEventStreamEffects";
import { type UseViewportShellEffectsInput } from "./UseViewportShellEffects";

const EMPTY_MODE_KEY = "";

// Runtime composition reads a broad dependency surface. This context keeps owner references
// grouped so each downstream builder can stay single-purpose and explicit.
export interface ApplicationRuntimeCompositionContext {
  input: UseApplicationRuntimeCompositionInput;
  applicationShellState: UseApplicationRuntimeCompositionInput["applicationShellState"];
  applicationDerivedState: UseApplicationRuntimeCompositionInput["applicationDerivedState"];
  applicationOwnerDependencies: UseApplicationRuntimeCompositionInput["applicationOwnerDependencies"];
  runtimeRequestHandlers: UseApplicationRuntimeCompositionInput["runtimeRequestHandlers"];
  coreDataLoaders: UseApplicationRuntimeCompositionInput["coreDataLoaders"];
}

export function createApplicationRuntimeCompositionContext(
  input: UseApplicationRuntimeCompositionInput,
): ApplicationRuntimeCompositionContext {
  return {
    input,
    applicationShellState: input.applicationShellState,
    applicationDerivedState: input.applicationDerivedState,
    applicationOwnerDependencies: input.applicationOwnerDependencies,
    runtimeRequestHandlers: input.runtimeRequestHandlers,
    coreDataLoaders: input.coreDataLoaders,
  };
}

interface BuildApplicationPushFeatureCompositionInputDependencies {
  loadSelectedThreadIfPresentFromRuntimeState: () => Promise<void>;
}

export function buildApplicationPushFeatureCompositionInput(
  context: ApplicationRuntimeCompositionContext,
  dependencies: BuildApplicationPushFeatureCompositionInputDependencies,
): UseApplicationPushFeatureCompositionInput {
  const { applicationShellState, applicationOwnerDependencies, coreDataLoaders } = context;
  return {
    apiSessionBootstrapCoordinator: applicationOwnerDependencies.apiSessionBootstrapCoordinator,
    webShellSessionBootstrapClient: applicationOwnerDependencies.webShellSessionBootstrapClient,
    apiSessionTokenDraft: applicationShellState.apiSessionTokenDraft,
    pushServerClient: applicationOwnerDependencies.pushServerClient,
    pushNotificationToolbarActionCoordinator:
      applicationOwnerDependencies.pushNotificationToolbarActionCoordinator,
    pushDiagnosticsRefreshStateOwner: applicationOwnerDependencies.pushDiagnosticsRefreshStateOwner,
    loadCoreDataTracked: coreDataLoaders.loadCoreDataTracked,
    loadSelectedThreadIfPresent: dependencies.loadSelectedThreadIfPresentFromRuntimeState,
    setApiSessionTokenDraft: applicationShellState.setApiSessionTokenDraft,
    setApiSessionBootstrapErrorMessage: applicationShellState.setApiSessionBootstrapError,
    setErrorMessage: applicationShellState.setError,
    setIsApiSessionBootstrapPending: applicationShellState.setIsApiSessionBootstrapPending,
    setIsEnablingPushNotifications: applicationShellState.setIsEnablingPushNotifications,
    setPushClientState: applicationShellState.setPushClientState,
    setPushStatus: applicationShellState.setPushStatus,
    setLatestPushReceipt: applicationShellState.setLatestPushReceipt,
    setLatestPushSend: applicationShellState.setLatestPushSend,
    setPushLocalCertificateAuthorityStatus:
      applicationShellState.setPushLocalCertificateAuthorityStatus,
    setPushSettingsErrorMessage: applicationShellState.setPushSettingsErrorMessage,
    setPushTestResult: applicationShellState.setPushTestResult,
    setIsRefreshingPushSettings: applicationShellState.setIsRefreshingPushSettings,
    setIsSendingPushTestNotification: applicationShellState.setIsSendingPushTestNotification,
    setRequiresApiSessionToken: applicationShellState.setRequiresApiSessionToken,
  };
}

export function buildViewportShellEffectsInput(
  context: ApplicationRuntimeCompositionContext,
): UseViewportShellEffectsInput {
  const { applicationShellState, applicationOwnerDependencies } = context;
  return {
    applicationShellElementRef: applicationShellState.applicationShellElementRef,
    scrollRef: applicationShellState.scrollRef,
    activeTabRef: applicationShellState.activeTabRef,
    isChatAtBottomRef: applicationShellState.isChatAtBottomRef,
    viewportKeyboardStateRef: applicationShellState.viewportKeyboardStateRef,
    keyboardOpenScrollRafRef: applicationShellState.keyboardOpenScrollRafRef,
    setIsMobileLayout: applicationShellState.setIsMobileLayout,
    setIsChatAtBottom: applicationShellState.setIsChatAtBottom,
    runtimeViewportSizingCoordinator: applicationOwnerDependencies.runtimeViewportSizingCoordinator,
    pageTouchOverscrollGuardCoordinator:
      applicationOwnerDependencies.pageTouchOverscrollGuardCoordinator,
    chatScrollStateCoordinator: applicationOwnerDependencies.chatScrollStateCoordinator,
  };
}

interface BuildApplicationRefreshEffectsInputDependencies {
  refreshCoreDataAndSelectedThread: () => Promise<void>;
  refreshSelectedThreadIncrementalIfPresent: () => Promise<void>;
  refreshPushClientState: () => Promise<void>;
  ensureFreshPushSettingsDiagnostics: () => Promise<void>;
}

export function buildApplicationRefreshEffectsInput(
  context: ApplicationRuntimeCompositionContext,
  dependencies: BuildApplicationRefreshEffectsInputDependencies,
): UseApplicationRefreshEffectsInput {
  const {
    input,
    applicationShellState,
    applicationDerivedState,
    applicationOwnerDependencies,
    runtimeRequestHandlers,
    coreDataLoaders,
  } = context;
  return {
    selectedThreadId: applicationShellState.selectedThreadId,
    activeTab: applicationShellState.activeTab,
    settingsWorkspaceSection: applicationShellState.settingsWorkspaceSection,
    unreadThreadIds: applicationShellState.unreadThreadIds,
    isArchivedThreadsOpen: applicationShellState.isArchivedThreadsOpen,
    hasLoadedArchivedThreads: applicationShellState.hasLoadedArchivedThreads,
    filteredDebugIssues: applicationDerivedState.filteredDebugIssues,
    selectedDebugIssueId: applicationShellState.selectedDebugIssueId,
    selectedThreadIdRef: applicationShellState.selectedThreadIdRef,
    activeTabRef: applicationShellState.activeTabRef,
    unreadThreadIdsRef: applicationShellState.unreadThreadIdsRef,
    isArchivedThreadsOpenRef: applicationShellState.isArchivedThreadsOpenRef,
    hasLoadedArchivedThreadsRef: applicationShellState.hasLoadedArchivedThreadsRef,
    coreRefreshIntervalRef: applicationShellState.coreRefreshIntervalRef,
    eventsConnectedRef: applicationShellState.eventsConnectedRef,
    lastCoreRefreshAtRef: applicationShellState.lastCoreRefreshAtRef,
    setUnreadThreadIds: applicationShellState.setUnreadThreadIds,
    setSelectedThreadId: applicationShellState.setSelectedThreadId,
    setActiveTab: applicationShellState.setActiveTab,
    setSettingsWorkspaceSection: applicationShellState.setSettingsWorkspaceSection,
    setSelectedDebugIssueId: applicationShellState.setSelectedDebugIssueId,
    threadListStateController: applicationOwnerDependencies.threadListStateController,
    lastViewedThreadPreferenceStore: applicationOwnerDependencies.lastViewedThreadPreferenceStore,
    debugIssueStateResolver: applicationOwnerDependencies.debugIssueStateResolver,
    applicationRouteStateMapper: input.applicationRouteStateMapper,
    loadCoreDataTracked: coreDataLoaders.loadCoreDataTracked,
    loadArchivedThreads: coreDataLoaders.loadArchivedThreads,
    refreshCoreDataAndSelectedThread: dependencies.refreshCoreDataAndSelectedThread,
    refreshSelectedThreadIncrementalIfPresent:
      dependencies.refreshSelectedThreadIncrementalIfPresent,
    isGenerating: applicationDerivedState.isGenerating,
    refreshPushClientState: dependencies.refreshPushClientState,
    ensureFreshPushSettingsDiagnostics: dependencies.ensureFreshPushSettingsDiagnostics,
    handleRuntimeRequestError: runtimeRequestHandlers.handleRuntimeRequestError,
    coreRefreshIntervalMs: input.coreRefreshIntervalMs,
    coreRefreshConnectedMinIntervalMs: input.coreRefreshConnectedMinIntervalMs,
  };
}

export function buildSelectedThreadLifecycleEffectsInput(
  context: ApplicationRuntimeCompositionContext,
): UseSelectedThreadLifecycleEffectsInput {
  const {
    applicationShellState,
    applicationOwnerDependencies,
    runtimeRequestHandlers,
    coreDataLoaders,
  } = context;
  return {
    selectedThreadId: applicationShellState.selectedThreadId,
    setSelectedThreadId: applicationShellState.setSelectedThreadId,
    setErrorMessage: applicationShellState.setError,
    selectedThreadIdRef: applicationShellState.selectedThreadIdRef,
    selectedThreadLoadTokenRef: applicationShellState.selectedThreadLoadTokenRef,
    loadSelectedThreadRef: applicationShellState.loadSelectedThreadRef,
    pendingThreadMaterializationCoordinator:
      applicationShellState.pendingThreadMaterializationCoordinator,
    applyCachedSelectedThreadSnapshot: context.input.applyCachedSelectedThreadSnapshot,
    selectedThreadRefreshConcurrencyCoordinator:
      applicationOwnerDependencies.selectedThreadRefreshConcurrencyCoordinator,
    setLiveState: applicationShellState.setLiveState,
    setReadThreadState: applicationShellState.setReadThreadState,
    setStreamEvents: applicationShellState.setStreamEvents,
    setIsSelectedThreadLoading: applicationShellState.setIsSelectedThreadLoading,
    refreshThreadListsAfterSelectedThreadMissing: coreDataLoaders.loadCoreDataTracked,
    unsubscribeThread: async (threadId) => {
      await applicationOwnerDependencies.chatServerClient.unsubscribeThread(threadId);
    },
    handleRuntimeRequestError: runtimeRequestHandlers.handleRuntimeRequestError,
  };
}

export function buildEventStreamEffectsInput(
  context: ApplicationRuntimeCompositionContext,
): UseEventStreamEffectsInput {
  const {
    input,
    applicationShellState,
    applicationDerivedState,
    applicationOwnerDependencies,
    runtimeRequestHandlers,
  } = context;
  return {
    debugHistoryLimit: input.debugHistoryLimit,
    debugErrorListLimit: input.debugErrorListLimit,
    isSidebarVisible: applicationShellState.isMobileLayout
      ? applicationShellState.mobileSidebarOpen
      : applicationShellState.desktopSidebarOpen,
    ensureApiSessionBootstrapped: runtimeRequestHandlers.ensureApiSessionBootstrapped,
    eventRefreshScheduler: applicationOwnerDependencies.eventRefreshScheduler,
    eventStreamConnectionCoordinator: applicationOwnerDependencies.eventStreamConnectionCoordinator,
    eventStreamRefreshDecisionEngine: applicationOwnerDependencies.eventStreamRefreshDecisionEngine,
    hasAppliedSelectedThreadSnapshot: input.hasAppliedSelectedThreadSnapshot,
    selectedThreadId: applicationShellState.selectedThreadId,
    activeTabRef: applicationShellState.activeTabRef,
    selectedThreadIdRef: applicationShellState.selectedThreadIdRef,
    setSelectedThreadId: applicationShellState.setSelectedThreadId,
    setErrorMessage: applicationShellState.setError,
    loadCoreDataTrackedRef: applicationShellState.loadCoreDataTrackedRef,
    loadSelectedThreadRef: applicationShellState.loadSelectedThreadRef,
    debugWorkspaceDataReader: applicationOwnerDependencies.debugWorkspaceDataReader,
    debugWorkspaceStateStore: applicationOwnerDependencies.debugWorkspaceStateStore,
    debugErrorsSignatureRef: applicationShellState.debugErrorsSignatureRef,
    eventsConnectedRef: applicationShellState.eventsConnectedRef,
    threadListStateController: applicationOwnerDependencies.threadListStateController,
    capabilityServerClient: applicationOwnerDependencies.capabilityServerClient,
    selectedAgentId: applicationShellState.selectedAgentId,
    canReadNotificationEvents:
      applicationDerivedState.activeAgentCapabilities?.canReadNotificationEvents === true,
    canReadAccount: applicationDerivedState.activeAgentCapabilities?.canReadAccount === true,
    canReadAccountRateLimits:
      applicationDerivedState.activeAgentCapabilities?.canReadAccountRateLimits === true,
    canListApps: applicationDerivedState.activeAgentCapabilities?.canListApps === true,
    setThreadRuntimeStatusByThreadIdentifier:
      applicationShellState.setThreadRuntimeStatusByThreadIdentifier,
    setThreadSidebarRuntimeSummary: applicationShellState.setThreadSidebarRuntimeSummary,
    setHistory: applicationShellState.setHistory,
    setDebugErrors: applicationShellState.setDebugErrors,
    setDebugErrorSessionId: applicationShellState.setDebugErrorSessionId,
    setDebugErrorSessionLogPath: applicationShellState.setDebugErrorSessionLogPath,
    applySelectedThreadStreamDelta: input.applySelectedThreadStreamDelta,
    handleRuntimeRequestError: runtimeRequestHandlers.handleRuntimeRequestError,
  };
}

export function buildModeAndPendingRequestEffectsInput(
  context: ApplicationRuntimeCompositionContext,
): UseModeAndPendingRequestEffectsInput {
  const { applicationShellState, applicationDerivedState, applicationOwnerDependencies } = context;
  return {
    activeRequest: applicationDerivedState.activeRequest,
    setSelectedRequestId: applicationShellState.setSelectedRequestId,
    setAnswerDraft: applicationShellState.setAnswerDraft,
    modeSelectionSyncCoordinator: applicationOwnerDependencies.modeSelectionSyncCoordinator,
    conversationState: applicationDerivedState.conversationState,
    appDefaultModel: applicationDerivedState.appDefaultModel,
    appDefaultReasoningEffort: applicationDerivedState.appDefaultReasoningEffort,
    defaultModeKey: applicationDerivedState.defaultModeOption?.mode ?? EMPTY_MODE_KEY,
    selectedModeKey: applicationShellState.selectedModeKey,
    selectedModelId: applicationShellState.selectedModelId,
    selectedReasoningEffort: applicationShellState.selectedReasoningEffort,
    hasHydratedModeFromLiveState: applicationShellState.hasHydratedModeFromLiveState,
    isModeSyncing: applicationShellState.isModeSyncing,
    lastAppliedModeSignatureRef: applicationShellState.lastAppliedModeSignatureRef,
    setSelectedModeKey: applicationShellState.setSelectedModeKey,
    setSelectedModelId: applicationShellState.setSelectedModelId,
    setSelectedReasoningEffort: applicationShellState.setSelectedReasoningEffort,
    setHasHydratedModeFromLiveState: applicationShellState.setHasHydratedModeFromLiveState,
    setIsModeSyncing: applicationShellState.setIsModeSyncing,
    selectedThreadId: applicationShellState.selectedThreadId,
  };
}

interface BuildApplicationChatFeatureCompositionInputDependencies {
  readLastAppliedModeSignature: () => string;
  writeLastAppliedModeSignature: (nextModeSignature: string) => void;
  invalidateActiveThreadQuery: () => void;
}

export function buildApplicationChatFeatureCompositionInput(
  context: ApplicationRuntimeCompositionContext,
  dependencies: BuildApplicationChatFeatureCompositionInputDependencies,
): UseApplicationChatFeatureCompositionInput {
  const {
    input,
    applicationShellState,
    applicationDerivedState,
    applicationOwnerDependencies,
    runtimeRequestHandlers,
    coreDataLoaders,
  } = context;
  return {
    chatScrollEffectsInput: {
      activeTab: applicationShellState.activeTab,
      selectedThreadId: applicationShellState.selectedThreadId,
      conversationItemCount: applicationDerivedState.conversationItemCount,
      initialVisibleChatItemCount: input.initialVisibleChatItems,
      scrollRef: applicationShellState.scrollRef,
      chatContentRef: applicationShellState.chatContentRef,
      isChatAtBottom: applicationShellState.isChatAtBottom,
      isChatAtBottomRef: applicationShellState.isChatAtBottomRef,
      setIsChatAtBottom: applicationShellState.setIsChatAtBottom,
      setVisibleChatItemLimit: applicationShellState.setVisibleChatItemLimit,
      chatScrollStateCoordinator: applicationOwnerDependencies.chatScrollStateCoordinator,
    },
    chatActionHandlersInput: {
      selectedThreadId: applicationShellState.selectedThreadId,
      selectedAgentId: applicationShellState.selectedAgentId,
      newThreadProjectPathResolution: applicationDerivedState.newThreadProjectPathResolution,
      modes: applicationShellState.modes,
      isModeSyncing: applicationShellState.isModeSyncing,
      activeRequest: applicationDerivedState.activeRequest,
      activeAuthTokenRefreshRequest: readActiveAuthTokenRefreshRequest(
        applicationDerivedState.conversationState,
      ),
      activeApplyPatchApprovalRequest: readActiveApplyPatchApprovalRequest(
        applicationDerivedState.conversationState,
      ),
      activeCommandExecutionApprovalRequest: readActiveCommandExecutionApprovalRequest(
        applicationDerivedState.conversationState,
      ),
      activeExecuteCommandApprovalRequest: readActiveExecuteCommandApprovalRequest(
        applicationDerivedState.conversationState,
      ),
      activeFileChangeApprovalRequest: readActiveFileChangeApprovalRequest(
        applicationDerivedState.conversationState,
      ),
      activeToolCallRequest: readActiveToolCallRequest(applicationDerivedState.conversationState),
      answerDraft: applicationShellState.answerDraft,
      setAnswerDraft: applicationShellState.setAnswerDraft,
      buildActionRequestOptions: runtimeRequestHandlers.buildActionRequestOptions,
      setErrorMessage: applicationShellState.setError,
      setIsBusy: applicationShellState.setIsBusy,
      setIsModeSyncing: applicationShellState.setIsModeSyncing,
      setSelectedThreadId: applicationShellState.setSelectedThreadId,
      selectedThreadIdRef: applicationShellState.selectedThreadIdRef,
      eventsConnectedRef: applicationShellState.eventsConnectedRef,
      pendingThreadMaterializationCoordinator:
        applicationShellState.pendingThreadMaterializationCoordinator,
      readLastAppliedModeSignature: dependencies.readLastAppliedModeSignature,
      writeLastAppliedModeSignature: dependencies.writeLastAppliedModeSignature,
      chatRequestActionCoordinator: applicationOwnerDependencies.chatRequestActionCoordinator,
      collaborationModeActionCoordinator:
        applicationOwnerDependencies.collaborationModeActionCoordinator,
      chatClient: applicationOwnerDependencies.chatServerClient,
      selectedThreadReadClient: {
        readThread: async (threadId) => {
          return new ThreadPreviewReadClient().readThread(threadId);
        },
      },
      threadMutationClient: applicationOwnerDependencies.threadMutationServerClient,
      pendingUserInputAnswerBuilder: applicationOwnerDependencies.pendingUserInputAnswerBuilder,
      onInvalidateActiveThreadQuery: dependencies.invalidateActiveThreadQuery,
      refreshActiveThreadListTracked: coreDataLoaders.refreshActiveThreadListTracked,
      onReloadSelectedThread: input.loadSelectedThreadTracked,
      reportTrackedUserInterfaceError: runtimeRequestHandlers.reportTrackedUserInterfaceError,
    },
    chatModeToolbarPropertiesInput: {
      canSetCollaborationMode: applicationDerivedState.canSetCollaborationMode,
      canListCollaborationModes: applicationDerivedState.canListCollaborationModes,
      canListModels: applicationDerivedState.canListModels,
      planModeOption: applicationDerivedState.planModeOption,
      defaultModeKey: applicationDerivedState.defaultModeOption?.mode ?? null,
      isPlanModeEnabled: applicationDerivedState.isPlanModeEnabled,
      selectedThreadId: applicationShellState.selectedThreadId,
      appDefaultValue: input.appDefaultValue,
      appDefaultModel: applicationDerivedState.appDefaultModel,
      appDefaultReasoningEffort: applicationDerivedState.appDefaultReasoningEffort,
      selectedModelId: applicationShellState.selectedModelId,
      selectedReasoningEffort: applicationShellState.selectedReasoningEffort,
      selectedModeKey: applicationShellState.selectedModeKey,
      modelOptionsWithoutAssumedDefault: applicationDerivedState.modelOptionsWithoutAssumedDefault,
      effortOptionsWithoutAssumedDefault:
        applicationDerivedState.effortOptionsWithoutAssumedDefault,
      isModeSyncing: applicationShellState.isModeSyncing,
      pendingRequestCount:
        applicationDerivedState.pendingRequests.length +
        readPendingAuthTokenRefreshRequests(applicationDerivedState.conversationState).length +
        readPendingApplyPatchApprovalRequests(applicationDerivedState.conversationState).length +
        readPendingCommandExecutionApprovalRequests(applicationDerivedState.conversationState)
          .length +
        readPendingExecuteCommandApprovalRequests(applicationDerivedState.conversationState)
          .length +
        readPendingFileChangeApprovalRequests(applicationDerivedState.conversationState).length +
        readPendingToolCallRequests(applicationDerivedState.conversationState).length,
      runningTerminalCount: applicationDerivedState.runningTerminalCount,
      setSelectedModeKey: applicationShellState.setSelectedModeKey,
      setSelectedModelId: applicationShellState.setSelectedModelId,
      setSelectedReasoningEffort: applicationShellState.setSelectedReasoningEffort,
    },
  };
}

export function buildApplicationDebugFeatureCompositionInput(
  context: ApplicationRuntimeCompositionContext,
): UseApplicationDebugFeatureCompositionInput {
  const {
    applicationShellState,
    applicationDerivedState,
    applicationOwnerDependencies,
    coreDataLoaders,
  } = context;
  return {
    debugWorkspaceActionCoordinator: applicationOwnerDependencies.debugWorkspaceActionCoordinator,
    debugServerClient: applicationOwnerDependencies.debugServerClient,
    refreshCoreData: coreDataLoaders.loadCoreDataTracked,
    traceLabel: applicationShellState.traceLabel,
    traceNote: applicationShellState.traceNote,
    errorBannerDetails: applicationDerivedState.errorBannerDetails,
    setActiveTab: applicationShellState.setActiveTab,
    setSettingsWorkspaceSection: applicationShellState.setSettingsWorkspaceSection,
    setDebugWorkspaceSection: applicationShellState.setDebugWorkspaceSection,
    setDebugIssueSeverityFilter: applicationShellState.setDebugIssueSeverityFilter,
    setSelectedDebugIssueId: applicationShellState.setSelectedDebugIssueId,
    setDebugIssueFilterQuery: applicationShellState.setDebugIssueFilterQuery,
    onHistoryDetailLoaded: applicationShellState.setHistoryDetail,
  };
}

interface BuildApplicationSynchronizationEffectsInputDependencies {
  loadHistoryDetail: (historyEntryId: string) => Promise<void>;
}

export function buildApplicationSynchronizationEffectsInput(
  context: ApplicationRuntimeCompositionContext,
  dependencies: BuildApplicationSynchronizationEffectsInputDependencies,
): UseApplicationSynchronizationEffectsInput {
  const { applicationShellState, runtimeRequestHandlers, coreDataLoaders, input } = context;
  return {
    loadCoreDataTracked: coreDataLoaders.loadCoreDataTracked,
    loadCoreDataTrackedRef: applicationShellState.loadCoreDataTrackedRef,
    loadSelectedThreadTracked: input.loadSelectedThreadTracked,
    loadSelectedThreadRef: applicationShellState.loadSelectedThreadRef,
    loadHistoryDetail: dependencies.loadHistoryDetail,
    selectedHistoryId: applicationShellState.selectedHistoryId,
    handleRuntimeRequestError: runtimeRequestHandlers.handleRuntimeRequestError,
  };
}

interface BuildApplicationShellCompositionInputDependencies {
  applyCachedSelectedThreadSnapshot: (threadId: string) => boolean;
  refreshCoreDataAndSelectedThread: () => Promise<void>;
  pushFeatureComposition: ApplicationPushFeatureComposition;
  chatFeatureComposition: ApplicationChatFeatureComposition;
  debugFeatureComposition: DebugActionHandlers;
}

export function buildApplicationShellCompositionInput(
  context: ApplicationRuntimeCompositionContext,
  dependencies: BuildApplicationShellCompositionInputDependencies,
): UseApplicationShellCompositionInput {
  const { input, applicationOwnerDependencies, runtimeRequestHandlers, coreDataLoaders } = context;
  return {
    theme: input.theme,
    toggleTheme: input.toggleTheme,
    visibleChatItemsStep: input.visibleChatItemsStep,
    applicationShellState: input.applicationShellState,
    applicationDerivedState: input.applicationDerivedState,
    streamEventCards: input.streamEventCards,
    renderAgentFavicon: input.renderAgentFavicon,
    formatDateValue: input.formatDateValue,
    loadCoreDataTracked: coreDataLoaders.loadCoreDataTracked,
    loadSelectedThreadTracked: input.loadSelectedThreadTracked,
    applyCachedSelectedThreadSnapshot: dependencies.applyCachedSelectedThreadSnapshot,
    refreshCoreDataAndSelectedThread: dependencies.refreshCoreDataAndSelectedThread,
    buildActionRequestOptions: runtimeRequestHandlers.buildActionRequestOptions,
    reportTrackedUserInterfaceError: runtimeRequestHandlers.reportTrackedUserInterfaceError,
    capabilityServerClient: applicationOwnerDependencies.capabilityServerClient,
    threadMutationServerClient: applicationOwnerDependencies.threadMutationServerClient,
    threadMutationActionCoordinator: applicationOwnerDependencies.threadMutationActionCoordinator,
    threadDisplayNameStateOwner: applicationOwnerDependencies.threadDisplayNameStateOwner,
    threadComposerProjectContextStateOwner:
      applicationOwnerDependencies.threadComposerProjectContextStateOwner,
    threadListStateController: applicationOwnerDependencies.threadListStateController,
    mobileSidebarSwipeCoordinator: applicationOwnerDependencies.mobileSidebarSwipeCoordinator,
    runtimeViewportSizingCoordinator: applicationOwnerDependencies.runtimeViewportSizingCoordinator,
    chatScrollStateCoordinator: applicationOwnerDependencies.chatScrollStateCoordinator,
    chatFeatureComposition: dependencies.chatFeatureComposition,
    debugFeatureComposition: dependencies.debugFeatureComposition,
    pushFeatureComposition: dependencies.pushFeatureComposition,
  };
}
