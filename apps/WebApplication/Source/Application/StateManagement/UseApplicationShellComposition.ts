import { type MobileSidebarSwipeCoordinator } from "@/Application/StateManagement/MobileSidebarSwipeCoordinator";
import { type RuntimeViewportSizingCoordinator } from "@/Application/StateManagement/RuntimeViewportSizingCoordinator";
import { type ApplicationDerivedState } from "@/Application/StateManagement/UseApplicationDerivedStateContracts";
import { type ApplicationShellState } from "@/Application/StateManagement/UseApplicationShellState";
import {
  type ApplicationShellViewProperties,
  type UseApplicationShellViewPropertiesInput,
  useApplicationShellViewProperties,
} from "@/Application/StateManagement/UseApplicationShellViewProperties";
import {
  type MobileSidebarTouchHandlers,
  type UseMobileSidebarTouchHandlersInput,
  useMobileSidebarTouchHandlers,
} from "@/Application/StateManagement/UseMobileSidebarTouchHandlers";
import { type ChatScrollStateCoordinator } from "@/Features/Chat/StateManagement/ChatScrollStateCoordinator";
import { type DebugActionHandlers } from "@/Features/Debugging/StateManagement/UseDebugActionHandlers";
import { type ThreadMutationServerClient } from "@/Features/Threads/DataAccess/ThreadMutationServerClient";
import { type ThreadDisplayNameStateOwner } from "@/Features/Threads/StateManagement/ThreadDisplayNameStateOwner";
import { type ThreadListStateController } from "@/Features/Threads/StateManagement/ThreadListStateController";
import {
  type ThreadMutationActionCoordinator,
  type ThreadMutationActionErrorReportInput,
} from "@/Features/Threads/StateManagement/ThreadMutationActionCoordinator";
import {
  type ThreadActionHandlers,
  type UseThreadActionHandlersInput,
  useThreadActionHandlers,
} from "@/Features/Threads/StateManagement/UseThreadActionHandlers";
import {
  type UseThreadListPanePropertiesInput,
  useThreadListPaneProperties,
} from "@/Features/Threads/StateManagement/UseThreadListPaneProperties";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPane";
import { type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { type ApplicationChatFeatureComposition } from "./UseApplicationChatFeatureComposition";
import { type ApplicationPushFeatureComposition } from "./UseApplicationPushFeatureComposition";

export interface UseApplicationShellCompositionInput {
  theme: string;
  toggleTheme: () => void;
  visibleChatItemsStep: number;
  applicationShellState: ApplicationShellState;
  applicationDerivedState: ApplicationDerivedState;
  streamEventCards: UseApplicationShellViewPropertiesInput["streamEventCards"];
  renderAgentFavicon: ThreadListPaneProperties["renderAgentFavicon"];
  formatDateValue: ThreadListPaneProperties["formatDate"];
  loadCoreDataTracked: () => Promise<void>;
  loadSelectedThreadTracked: (threadId: string) => Promise<void>;
  refreshCoreDataAndSelectedThread: () => Promise<void>;
  buildActionRequestOptions: (actionName: string) => {
    actionId: string;
    requestOptions: ApiRequestOptions;
  };
  reportTrackedUserInterfaceError: (input: ThreadMutationActionErrorReportInput) => Promise<void>;
  threadMutationServerClient: ThreadMutationServerClient;
  threadMutationActionCoordinator: ThreadMutationActionCoordinator;
  threadDisplayNameStateOwner: ThreadDisplayNameStateOwner;
  threadListStateController: ThreadListStateController;
  mobileSidebarSwipeCoordinator: MobileSidebarSwipeCoordinator;
  runtimeViewportSizingCoordinator: RuntimeViewportSizingCoordinator;
  chatScrollStateCoordinator: ChatScrollStateCoordinator;
  chatFeatureComposition: ApplicationChatFeatureComposition;
  debugFeatureComposition: DebugActionHandlers;
  pushFeatureComposition: ApplicationPushFeatureComposition;
}

export interface ApplicationShellComposition
  extends ApplicationShellViewProperties,
    MobileSidebarTouchHandlers {
  threadListPaneProperties: ThreadListPaneProperties;
}

// Composition wiring reads from the same shell+derived snapshots across multiple hook inputs.
interface ApplicationShellCompositionContext {
  input: UseApplicationShellCompositionInput;
  applicationShellState: ApplicationShellState;
  applicationDerivedState: ApplicationDerivedState;
}

function readLatestTurnIdentifier(lastTurn: ApplicationDerivedState["lastTurn"]): string | null {
  if (lastTurn === undefined) {
    return null;
  }

  const turnIdentifier = lastTurn.turnId;
  if (turnIdentifier !== undefined && turnIdentifier !== null && turnIdentifier.length > 0) {
    return turnIdentifier;
  }

  const legacyTurnIdentifier = lastTurn.id;
  if (legacyTurnIdentifier !== undefined && legacyTurnIdentifier.length > 0) {
    return legacyTurnIdentifier;
  }

  return null;
}

function createApplicationShellCompositionContext(
  input: UseApplicationShellCompositionInput,
): ApplicationShellCompositionContext {
  return {
    input,
    applicationShellState: input.applicationShellState,
    applicationDerivedState: input.applicationDerivedState,
  };
}

function buildThreadActionHandlersInput(
  context: ApplicationShellCompositionContext,
): UseThreadActionHandlersInput {
  const { input, applicationShellState, applicationDerivedState } = context;
  return {
    availableAgentIds: applicationDerivedState.availableAgentIds,
    threads: applicationShellState.threads,
    buildActionRequestOptions: input.buildActionRequestOptions,
    setIsBusy: applicationShellState.setIsBusy,
    setError: applicationShellState.setError,
    setSelectedThreadId: applicationShellState.setSelectedThreadId,
    setMobileSidebarOpen: applicationShellState.setMobileSidebarOpen,
    selectedThreadIdRef: applicationShellState.selectedThreadIdRef,
    pendingThreadMaterializationCoordinator:
      applicationShellState.pendingThreadMaterializationCoordinator,
    threadMutationActionCoordinator: input.threadMutationActionCoordinator,
    threadMutationServerClient: input.threadMutationServerClient,
    threadDisplayNameStateOwner: input.threadDisplayNameStateOwner,
    threadListStateController: input.threadListStateController,
    loadCoreDataTracked: input.loadCoreDataTracked,
    loadSelectedThreadTracked: input.loadSelectedThreadTracked,
    reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
  };
}

function buildMobileSidebarTouchHandlersInput(
  context: ApplicationShellCompositionContext,
): UseMobileSidebarTouchHandlersInput {
  const { input, applicationShellState } = context;
  return {
    mobileSidebarOpen: applicationShellState.mobileSidebarOpen,
    setMobileSidebarOpen: applicationShellState.setMobileSidebarOpen,
    mobileSidebarSwipeCoordinator: input.mobileSidebarSwipeCoordinator,
    runtimeViewportSizingCoordinator: input.runtimeViewportSizingCoordinator,
  };
}

function buildThreadListPanePropertiesInput(
  context: ApplicationShellCompositionContext,
  threadActionHandlers: ThreadActionHandlers,
): UseThreadListPanePropertiesInput {
  const { input, applicationShellState, applicationDerivedState } = context;
  return {
    threadListState: applicationDerivedState.threadListState,
    threads: applicationShellState.threads,
    isCoreLoading: applicationShellState.isCoreLoading,
    availableAgentIds: applicationDerivedState.availableAgentIds,
    selectedAgentDescriptor: applicationDerivedState.selectedAgentDescriptor,
    selectedAgentLabel: applicationDerivedState.selectedAgentLabel,
    agentsById: applicationDerivedState.agentsById,
    isBusy: applicationShellState.isBusy,
    activeProjectGroups: applicationDerivedState.activeProjectGroups,
    selectedThreadId: applicationShellState.selectedThreadId,
    collapsedThreadProjectGroups: applicationShellState.collapsedThreadProjectGroups,
    unreadThreadIds: applicationShellState.unreadThreadIds,
    isGenerating: applicationDerivedState.isGenerating,
    setCollapsedThreadProjectGroups: applicationShellState.setCollapsedThreadProjectGroups,
    createThreadForSingleAgent: threadActionHandlers.createThreadForSingleAgent,
    createNewThread: threadActionHandlers.createNewThread,
    setSelectedThreadId: applicationShellState.setSelectedThreadId,
    setMobileSidebarOpen: applicationShellState.setMobileSidebarOpen,
    archiveThread: threadActionHandlers.runArchiveThread,
    forkThread: threadActionHandlers.runForkThread,
    rollbackThread: threadActionHandlers.runRollbackThread,
    compactThread: threadActionHandlers.runCompactThread,
    cleanThreadBackgroundTerminals: threadActionHandlers.runCleanThreadBackgroundTerminals,
    startThreadReview: threadActionHandlers.runStartThreadReview,
    setThreadName: threadActionHandlers.runSetThreadName,
    isArchivedThreadsOpen: applicationShellState.isArchivedThreadsOpen,
    setIsArchivedThreadsOpen: applicationShellState.setIsArchivedThreadsOpen,
    isArchivedThreadsLoading: applicationShellState.isArchivedThreadsLoading,
    hasLoadedArchivedThreads: applicationShellState.hasLoadedArchivedThreads,
    archivedSectionThreadCount: applicationDerivedState.archivedSectionThreadCount,
    archivedThreadsTruncated: applicationShellState.archivedThreadsTruncated,
    archivedProjectGroups: applicationDerivedState.archivedProjectGroups,
    collapsedArchivedProjectGroups: applicationShellState.collapsedArchivedProjectGroups,
    archivedThreadIds: applicationDerivedState.archivedThreadIds,
    setCollapsedArchivedProjectGroups: applicationShellState.setCollapsedArchivedProjectGroups,
    unarchiveThread: threadActionHandlers.runUnarchiveThread,
    formatDate: input.formatDateValue,
    renderAgentFavicon: input.renderAgentFavicon,
  };
}

function buildApplicationShellViewPropertiesInput(
  context: ApplicationShellCompositionContext,
): UseApplicationShellViewPropertiesInput {
  const { input, applicationShellState, applicationDerivedState } = context;
  return {
    health: applicationShellState.health,
    activeTab: applicationShellState.activeTab,
    settingsWorkspaceSection: applicationShellState.settingsWorkspaceSection,
    desktopSidebarOpen: applicationShellState.desktopSidebarOpen,
    selectedThreadLabel: applicationDerivedState.selectedThreadLabel,
    hasSelectedThread: applicationDerivedState.selectedThread !== null,
    activeThreadAgentId: applicationDerivedState.activeThreadAgentId,
    activeAgentLabel: applicationDerivedState.activeAgentLabel,
    isGenerating: applicationDerivedState.isGenerating,
    pushClientState: applicationShellState.pushClientState,
    pushStatus: applicationShellState.pushStatus,
    latestPushReceipt: applicationShellState.latestPushReceipt,
    latestPushSend: applicationShellState.latestPushSend,
    pushLocalCertificateAuthorityStatus: applicationShellState.pushLocalCertificateAuthorityStatus,
    pushSettingsErrorMessage: applicationShellState.pushSettingsErrorMessage,
    pushTestResult: applicationShellState.pushTestResult,
    latestTurnId: readLatestTurnIdentifier(applicationDerivedState.lastTurn),
    isEnablingPushNotifications: applicationShellState.isEnablingPushNotifications,
    isRefreshingPushSettings: applicationShellState.isRefreshingPushSettings,
    isSendingPushTestNotification: applicationShellState.isSendingPushTestNotification,
    isBusy: applicationShellState.isBusy,
    theme: input.theme,
    setMobileSidebarOpen: applicationShellState.setMobileSidebarOpen,
    setDesktopSidebarOpen: applicationShellState.setDesktopSidebarOpen,
    setSettingsWorkspaceSection: applicationShellState.setSettingsWorkspaceSection,
    enablePushNotificationsFromToolbar:
      input.pushFeatureComposition.enablePushNotificationsFromToolbar,
    refreshPushSettingsDiagnostics: input.pushFeatureComposition.refreshPushSettingsDiagnostics,
    sendPushTestNotificationFromSettings:
      input.pushFeatureComposition.sendPushTestNotificationFromSettings,
    refreshCoreDataAndSelectedThread: input.refreshCoreDataAndSelectedThread,
    setActiveTab: applicationShellState.setActiveTab,
    toggleTheme: input.toggleTheme,
    renderAgentFavicon: input.renderAgentFavicon,
    errorMessage: applicationShellState.error,
    errorBannerDetails: applicationDerivedState.errorBannerDetails,
    openDebugFromErrorBanner: input.debugFeatureComposition.openDebugFromErrorBanner,
    setErrorMessage: applicationShellState.setError,
    liveStateReductionError: applicationDerivedState.liveStateReductionError,
    chatSurfaceState: applicationDerivedState.chatSurfaceState,
    selectedThreadId: applicationShellState.selectedThreadId,
    isCoreLoading: applicationShellState.isCoreLoading,
    isSelectedThreadLoading: applicationShellState.isSelectedThreadLoading,
    availableAgentIds: applicationDerivedState.availableAgentIds,
    turnCount: applicationDerivedState.turns.length,
    scrollRef: applicationShellState.scrollRef,
    chatContentRef: applicationShellState.chatContentRef,
    visibleConversationItems: applicationDerivedState.visibleConversationItems,
    hasHiddenChatItems: applicationDerivedState.hasHiddenChatItems,
    firstVisibleChatItemIndex: applicationDerivedState.firstVisibleChatItemIndex,
    setVisibleChatItemLimit: applicationShellState.setVisibleChatItemLimit,
    conversationItemCount: applicationDerivedState.conversationItemCount,
    visibleChatItemsStep: input.visibleChatItemsStep,
    isChatAtBottom: applicationShellState.isChatAtBottom,
    chatScrollStateCoordinator: input.chatScrollStateCoordinator,
    setIsChatAtBottom: applicationShellState.setIsChatAtBottom,
    activeRequest: applicationDerivedState.activeRequest,
    canSubmitUserInputForActiveAgent: applicationDerivedState.canSubmitUserInputForActiveAgent,
    answerDraft: applicationShellState.answerDraft,
    handleAnswerChange: input.chatFeatureComposition.handleAnswerChange,
    submitPendingRequest: input.chatFeatureComposition.submitPendingRequest,
    skipPendingRequest: input.chatFeatureComposition.skipPendingRequest,
    selectedAgentLabel: applicationDerivedState.selectedAgentLabel,
    runInterrupt: input.chatFeatureComposition.runInterrupt,
    steerMessage: input.chatFeatureComposition.steerMessage,
    submitMessage: input.chatFeatureComposition.submitMessage,
    chatModeToolbarProperties: input.chatFeatureComposition.chatModeToolbarProperties,
    debugWorkspaceSection: applicationShellState.debugWorkspaceSection,
    setDebugWorkspaceSection: applicationShellState.setDebugWorkspaceSection,
    debugErrorIssueCount: applicationDerivedState.debugErrorIssues.length,
    debugWarningIssueCount: applicationDerivedState.debugWarningIssues.length,
    runtimeRequestErrorOperationMetrics:
      applicationDerivedState.runtimeRequestErrorOperationMetrics,
    filteredDebugIssues: applicationDerivedState.filteredDebugIssues,
    selectedDebugIssue: applicationDerivedState.selectedDebugIssue,
    selectedDebugIssueId: applicationShellState.selectedDebugIssueId,
    debugIssueSeverityFilter: applicationShellState.debugIssueSeverityFilter,
    debugIssueFilterQuery: applicationShellState.debugIssueFilterQuery,
    debugErrorSessionId: applicationShellState.debugErrorSessionId,
    debugErrorSessionLogPath: applicationShellState.debugErrorSessionLogPath,
    setSelectedDebugIssueId: applicationShellState.setSelectedDebugIssueId,
    setDebugIssueSeverityFilter: applicationShellState.setDebugIssueSeverityFilter,
    setDebugIssueFilterQuery: applicationShellState.setDebugIssueFilterQuery,
    clearDebugIssuesFromDebugPanel: input.debugFeatureComposition.clearDebugIssuesFromPanel,
    debugHistoryEntryListItems: applicationDerivedState.debugHistoryEntryListItems,
    selectedHistoryId: applicationShellState.selectedHistoryId,
    selectedHistoryDetailId: applicationShellState.historyDetail?.entry.id ?? null,
    historyDetailPayloadText: applicationDerivedState.historyDetailPayloadText,
    waitForReplayResponse: applicationShellState.waitForReplayResponse,
    setSelectedHistoryId: applicationShellState.setSelectedHistoryId,
    setWaitForReplayResponse: applicationShellState.setWaitForReplayResponse,
    replayHistoryEntryFromDetail: input.debugFeatureComposition.replayHistoryEntryFromDetail,
    streamEventCount: applicationShellState.streamEvents.length,
    streamEventCards: input.streamEventCards,
    isTraceRecording: applicationShellState.traceStatus?.active !== null,
    traceLabel: applicationShellState.traceLabel,
    traceNote: applicationShellState.traceNote,
    setTraceLabel: applicationShellState.setTraceLabel,
    setTraceNote: applicationShellState.setTraceNote,
    startTraceFromDebugPanel: input.debugFeatureComposition.startTraceFromDebugPanel,
    markTraceFromDebugPanel: input.debugFeatureComposition.markTraceFromDebugPanel,
    stopTraceFromDebugPanel: input.debugFeatureComposition.stopTraceFromDebugPanel,
    recentTraceSummaries: applicationDerivedState.recentTraceSummaries,
    apiSessionTokenDraft: applicationShellState.apiSessionTokenDraft,
    setApiSessionTokenDraft: applicationShellState.setApiSessionTokenDraft,
    apiSessionBootstrapError: applicationShellState.apiSessionBootstrapError,
    setApiSessionBootstrapError: applicationShellState.setApiSessionBootstrapError,
    submitApiSessionToken: input.pushFeatureComposition.submitApiSessionToken,
    isApiSessionBootstrapPending: applicationShellState.isApiSessionBootstrapPending,
  };
}

export function useApplicationShellComposition(
  input: UseApplicationShellCompositionInput,
): ApplicationShellComposition {
  const context = createApplicationShellCompositionContext(input);

  const threadActionHandlers = useThreadActionHandlers(buildThreadActionHandlersInput(context));

  const mobileSidebarTouchHandlers = useMobileSidebarTouchHandlers(
    buildMobileSidebarTouchHandlersInput(context),
  );

  const threadListPaneProperties = useThreadListPaneProperties(
    buildThreadListPanePropertiesInput(context, threadActionHandlers),
  );

  const shellViewProperties = useApplicationShellViewProperties(
    buildApplicationShellViewPropertiesInput(context),
  );

  return {
    ...mobileSidebarTouchHandlers,
    threadListPaneProperties,
    ...shellViewProperties,
  };
}
