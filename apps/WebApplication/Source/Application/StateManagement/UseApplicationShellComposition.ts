import { type ThreadMutationServerClient } from "@/Features/Threads/DataAccess/ThreadMutationServerClient";
import { type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { type ThreadMutationActionErrorReportInput } from "@/Features/Threads/StateManagement/ThreadMutationActionCoordinator";
import { type ThreadMutationActionCoordinator } from "@/Features/Threads/StateManagement/ThreadMutationActionCoordinator";
import { type ThreadListStateController } from "@/Features/Threads/StateManagement/ThreadListStateController";
import {
  useThreadListPaneProperties
} from "@/Features/Threads/StateManagement/UseThreadListPaneProperties";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPane";
import {
  useThreadActionHandlers
} from "@/Features/Threads/StateManagement/UseThreadActionHandlers";
import { type DebugActionHandlers } from "@/Features/Debugging/StateManagement/UseDebugActionHandlers";
import { type ChatScrollStateCoordinator } from "@/Features/Chat/StateManagement/ChatScrollStateCoordinator";
import { type MobileSidebarSwipeCoordinator } from "@/Application/StateManagement/MobileSidebarSwipeCoordinator";
import { type RuntimeViewportSizingCoordinator } from "@/Application/StateManagement/RuntimeViewportSizingCoordinator";
import {
  type ApplicationDerivedState
} from "@/Application/StateManagement/UseApplicationDerivedStateContracts";
import { type ApplicationShellState } from "@/Application/StateManagement/UseApplicationShellState";
import {
  type ApplicationShellViewProperties,
  type UseApplicationShellViewPropertiesInput,
  useApplicationShellViewProperties
} from "@/Application/StateManagement/UseApplicationShellViewProperties";
import {
  type MobileSidebarTouchHandlers,
  useMobileSidebarTouchHandlers
} from "@/Application/StateManagement/UseMobileSidebarTouchHandlers";
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
  threadListStateController: ThreadListStateController;
  mobileSidebarSwipeCoordinator: MobileSidebarSwipeCoordinator;
  runtimeViewportSizingCoordinator: RuntimeViewportSizingCoordinator;
  chatScrollStateCoordinator: ChatScrollStateCoordinator;
  chatFeatureComposition: ApplicationChatFeatureComposition;
  debugFeatureComposition: DebugActionHandlers;
  pushFeatureComposition: ApplicationPushFeatureComposition;
}

export interface ApplicationShellComposition extends ApplicationShellViewProperties, MobileSidebarTouchHandlers {
  threadListPaneProperties: ThreadListPaneProperties;
}

export function useApplicationShellComposition(
  input: UseApplicationShellCompositionInput
): ApplicationShellComposition {
  const {
    applicationShellState,
    applicationDerivedState
  } = input;

  const {
    createNewThread,
    createThreadForSingleAgent,
    runArchiveThread,
    runUnarchiveThread
  } = useThreadActionHandlers({
    availableAgentIds: applicationDerivedState.availableAgentIds,
    threads: applicationShellState.threads,
    buildActionRequestOptions: input.buildActionRequestOptions,
    setIsBusy: applicationShellState.setIsBusy,
    setError: applicationShellState.setError,
    setSelectedThreadId: applicationShellState.setSelectedThreadId,
    setMobileSidebarOpen: applicationShellState.setMobileSidebarOpen,
    selectedThreadIdRef: applicationShellState.selectedThreadIdRef,
    pendingThreadMaterializationCoordinator: applicationShellState.pendingThreadMaterializationCoordinator,
    threadMutationActionCoordinator: input.threadMutationActionCoordinator,
    threadMutationServerClient: input.threadMutationServerClient,
    threadListStateController: input.threadListStateController,
    loadCoreDataTracked: input.loadCoreDataTracked,
    loadSelectedThreadTracked: input.loadSelectedThreadTracked,
    reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError
  });

  const {
    endSidebarSwipeTracking,
    handleAppShellTouchStart,
    handleAppShellTouchMove
  } = useMobileSidebarTouchHandlers({
    mobileSidebarOpen: applicationShellState.mobileSidebarOpen,
    setMobileSidebarOpen: applicationShellState.setMobileSidebarOpen,
    mobileSidebarSwipeCoordinator: input.mobileSidebarSwipeCoordinator,
    runtimeViewportSizingCoordinator: input.runtimeViewportSizingCoordinator
  });

  const threadListPaneProperties = useThreadListPaneProperties({
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
    createThreadForSingleAgent,
    createNewThread,
    setSelectedThreadId: (threadId) => {
      applicationShellState.setSelectedThreadId(threadId);
    },
    setMobileSidebarOpen: (nextOpen) => {
      applicationShellState.setMobileSidebarOpen(nextOpen);
    },
    archiveThread: runArchiveThread,
    isArchivedThreadsOpen: applicationShellState.isArchivedThreadsOpen,
    setIsArchivedThreadsOpen: (nextOpen) => {
      applicationShellState.setIsArchivedThreadsOpen(nextOpen);
    },
    isArchivedThreadsLoading: applicationShellState.isArchivedThreadsLoading,
    hasLoadedArchivedThreads: applicationShellState.hasLoadedArchivedThreads,
    archivedSectionThreadCount: applicationDerivedState.archivedSectionThreadCount,
    archivedThreadsTruncated: applicationShellState.archivedThreadsTruncated,
    archivedProjectGroups: applicationDerivedState.archivedProjectGroups,
    collapsedArchivedProjectGroups: applicationShellState.collapsedArchivedProjectGroups,
    archivedThreadIds: applicationDerivedState.archivedThreadIds,
    setCollapsedArchivedProjectGroups: applicationShellState.setCollapsedArchivedProjectGroups,
    unarchiveThread: runUnarchiveThread,
    formatDate: input.formatDateValue,
    renderAgentFavicon: input.renderAgentFavicon
  });

  const shellViewProperties = useApplicationShellViewProperties({
    health: applicationShellState.health,
    activeTab: applicationShellState.activeTab,
    desktopSidebarOpen: applicationShellState.desktopSidebarOpen,
    selectedThreadLabel: applicationDerivedState.selectedThreadLabel,
    hasSelectedThread: applicationDerivedState.selectedThread !== null,
    activeThreadAgentId: applicationDerivedState.activeThreadAgentId,
    activeAgentLabel: applicationDerivedState.activeAgentLabel,
    isGenerating: applicationDerivedState.isGenerating,
    pushClientState: applicationShellState.pushClientState,
    isEnablingPushNotifications: applicationShellState.isEnablingPushNotifications,
    isBusy: applicationShellState.isBusy,
    theme: input.theme,
    setMobileSidebarOpen: (nextOpen) => {
      applicationShellState.setMobileSidebarOpen(nextOpen);
    },
    setDesktopSidebarOpen: (nextOpen) => {
      applicationShellState.setDesktopSidebarOpen(nextOpen);
    },
    enablePushNotificationsFromToolbar: input.pushFeatureComposition.enablePushNotificationsFromToolbar,
    refreshCoreDataAndSelectedThread: input.refreshCoreDataAndSelectedThread,
    setActiveTab: (nextTab) => {
      applicationShellState.setActiveTab(nextTab);
    },
    toggleTheme: input.toggleTheme,
    renderAgentFavicon: input.renderAgentFavicon,
    errorMessage: applicationShellState.error,
    errorBannerDetails: applicationDerivedState.errorBannerDetails,
    openDebugFromErrorBanner: input.debugFeatureComposition.openDebugFromErrorBanner,
    setErrorMessage: (nextErrorMessage) => {
      applicationShellState.setError(nextErrorMessage);
    },
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
    setIsChatAtBottom: (nextIsAtBottom) => {
      applicationShellState.setIsChatAtBottom(nextIsAtBottom);
    },
    activeRequest: applicationDerivedState.activeRequest,
    canSubmitUserInputForActiveAgent: applicationDerivedState.canSubmitUserInputForActiveAgent,
    answerDraft: applicationShellState.answerDraft,
    handleAnswerChange: input.chatFeatureComposition.handleAnswerChange,
    submitPendingRequest: input.chatFeatureComposition.submitPendingRequest,
    skipPendingRequest: input.chatFeatureComposition.skipPendingRequest,
    selectedAgentLabel: applicationDerivedState.selectedAgentLabel,
    runInterrupt: input.chatFeatureComposition.runInterrupt,
    submitMessage: input.chatFeatureComposition.submitMessage,
    chatModeToolbarProperties: input.chatFeatureComposition.chatModeToolbarProperties,
    debugWorkspaceSection: applicationShellState.debugWorkspaceSection,
    setDebugWorkspaceSection: (nextSection) => {
      applicationShellState.setDebugWorkspaceSection(nextSection);
    },
    debugErrorIssueCount: applicationDerivedState.debugErrorIssues.length,
    debugWarningIssueCount: applicationDerivedState.debugWarningIssues.length,
    filteredDebugIssues: applicationDerivedState.filteredDebugIssues,
    selectedDebugIssue: applicationDerivedState.selectedDebugIssue,
    selectedDebugIssueId: applicationShellState.selectedDebugIssueId,
    debugIssueSeverityFilter: applicationShellState.debugIssueSeverityFilter,
    debugIssueFilterQuery: applicationShellState.debugIssueFilterQuery,
    debugErrorSessionId: applicationShellState.debugErrorSessionId,
    debugErrorSessionLogPath: applicationShellState.debugErrorSessionLogPath,
    setSelectedDebugIssueId: (nextIssueId) => {
      applicationShellState.setSelectedDebugIssueId(nextIssueId);
    },
    setDebugIssueSeverityFilter: (nextFilter) => {
      applicationShellState.setDebugIssueSeverityFilter(nextFilter);
    },
    setDebugIssueFilterQuery: (nextQuery) => {
      applicationShellState.setDebugIssueFilterQuery(nextQuery);
    },
    debugHistoryEntryListItems: applicationDerivedState.debugHistoryEntryListItems,
    selectedHistoryId: applicationShellState.selectedHistoryId,
    selectedHistoryDetailId: applicationShellState.historyDetail?.entry.id ?? null,
    historyDetailPayloadText: applicationDerivedState.historyDetailPayloadText,
    waitForReplayResponse: applicationShellState.waitForReplayResponse,
    setSelectedHistoryId: (nextHistoryId) => {
      applicationShellState.setSelectedHistoryId(nextHistoryId);
    },
    setWaitForReplayResponse: (nextWaitForReplayResponse) => {
      applicationShellState.setWaitForReplayResponse(nextWaitForReplayResponse);
    },
    replayHistoryEntryFromDetail: input.debugFeatureComposition.replayHistoryEntryFromDetail,
    streamEventCount: applicationShellState.streamEvents.length,
    streamEventCards: input.streamEventCards,
    isTraceRecording: applicationShellState.traceStatus?.active !== null,
    traceLabel: applicationShellState.traceLabel,
    traceNote: applicationShellState.traceNote,
    setTraceLabel: (nextLabel) => {
      applicationShellState.setTraceLabel(nextLabel);
    },
    setTraceNote: (nextNote) => {
      applicationShellState.setTraceNote(nextNote);
    },
    startTraceFromDebugPanel: input.debugFeatureComposition.startTraceFromDebugPanel,
    markTraceFromDebugPanel: input.debugFeatureComposition.markTraceFromDebugPanel,
    stopTraceFromDebugPanel: input.debugFeatureComposition.stopTraceFromDebugPanel,
    recentTraceSummaries: applicationDerivedState.recentTraceSummaries,
    apiSessionTokenDraft: applicationShellState.apiSessionTokenDraft,
    setApiSessionTokenDraft: (nextTokenValue) => {
      applicationShellState.setApiSessionTokenDraft(nextTokenValue);
    },
    apiSessionBootstrapError: applicationShellState.apiSessionBootstrapError,
    setApiSessionBootstrapError: (nextErrorMessage) => {
      applicationShellState.setApiSessionBootstrapError(nextErrorMessage);
    },
    submitApiSessionToken: input.pushFeatureComposition.submitApiSessionToken,
    isApiSessionBootstrapPending: applicationShellState.isApiSessionBootstrapPending
  });

  return {
    endSidebarSwipeTracking,
    handleAppShellTouchStart,
    handleAppShellTouchMove,
    threadListPaneProperties,
    ...shellViewProperties
  };
}
