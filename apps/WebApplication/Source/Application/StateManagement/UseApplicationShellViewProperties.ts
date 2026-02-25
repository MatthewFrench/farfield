import { type Dispatch, type SetStateAction, useMemo } from "react";
import { type ApiSessionBootstrapOverlayProperties } from "@/Application/UserInterface/ApiSessionBootstrapOverlay";
import { type ApplicationHeaderBarProps } from "@/Application/UserInterface/ApplicationHeaderBar";
import { type CapabilityHealthResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { type ChatScrollStateCoordinator } from "@/Features/Chat/StateManagement/ChatScrollStateCoordinator";
import { type ChatWorkspacePaneProps } from "@/Features/Chat/UserInterface/ChatWorkspacePane";
import { type DebugHistoryEntryListItem } from "@/Features/Debugging/UserInterface/DebugHistoryPanel";
import { type DebugTraceSummary } from "@/Features/Debugging/UserInterface/DebugTracePanel";
import { type DebugStatusBannersProps } from "@/Features/Debugging/UserInterface/DebugStatusBanners";
import { type DebugWorkspaceSection } from "@/Features/Debugging/DomainModel/DebugWorkspaceSectionContracts";
import {
  type DebugWorkspacePaneProps
} from "@/Features/Debugging/UserInterface/DebugWorkspacePane";
import { type ThreadSidebarPanelHealthState } from "@/Features/Threads/UserInterface/ThreadSidebarPanel";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";

export interface UseApplicationShellViewPropertiesInput {
  health: CapabilityHealthResponse | null;
  activeTab: ApplicationHeaderBarProps["activeTab"];
  desktopSidebarOpen: boolean;
  selectedThreadLabel: string;
  hasSelectedThread: boolean;
  activeThreadAgentId: ApplicationHeaderBarProps["activeThreadAgentId"];
  activeAgentLabel: string;
  isGenerating: boolean;
  pushClientState: PushClientState;
  isEnablingPushNotifications: boolean;
  isBusy: boolean;
  theme: string;
  setMobileSidebarOpen: (nextOpen: boolean) => void;
  setDesktopSidebarOpen: (nextOpen: boolean) => void;
  enablePushNotificationsFromToolbar: () => void | Promise<void>;
  refreshCoreDataAndSelectedThread: () => void | Promise<void>;
  setActiveTab: (nextTab: ApplicationHeaderBarProps["activeTab"]) => void;
  toggleTheme: () => void;
  renderAgentFavicon: ApplicationHeaderBarProps["renderAgentFavicon"];
  errorMessage: string;
  errorBannerDetails: DebugStatusBannersProps["errorBannerDetails"];
  openDebugFromErrorBanner: () => void;
  setErrorMessage: (nextErrorMessage: string) => void;
  liveStateReductionError: DebugStatusBannersProps["liveStateReductionError"];
  chatSurfaceState: ChatWorkspacePaneProps["chatSurfaceState"];
  selectedThreadId: string | null;
  isCoreLoading: boolean;
  isSelectedThreadLoading: boolean;
  availableAgentIds: ChatWorkspacePaneProps["availableAgentIds"];
  turnCount: number;
  scrollRef: ChatWorkspacePaneProps["scrollRef"];
  chatContentRef: ChatWorkspacePaneProps["chatContentRef"];
  visibleConversationItems: ChatWorkspacePaneProps["visibleConversationItems"];
  hasHiddenChatItems: boolean;
  firstVisibleChatItemIndex: number;
  setVisibleChatItemLimit: Dispatch<SetStateAction<number>>;
  conversationItemCount: number;
  visibleChatItemsStep: number;
  isChatAtBottom: boolean;
  chatScrollStateCoordinator: ChatScrollStateCoordinator;
  setIsChatAtBottom: (nextIsAtBottom: boolean) => void;
  activeRequest: ChatWorkspacePaneProps["activeRequest"];
  canSubmitUserInputForActiveAgent: boolean;
  answerDraft: ChatWorkspacePaneProps["answerDraft"];
  handleAnswerChange: ChatWorkspacePaneProps["onAnswerDraftChange"];
  submitPendingRequest: () => void | Promise<void>;
  skipPendingRequest: () => void | Promise<void>;
  selectedAgentLabel: string;
  runInterrupt: ChatWorkspacePaneProps["onInterrupt"];
  submitMessage: ChatWorkspacePaneProps["onSendMessage"];
  chatModeToolbarProperties: ChatWorkspacePaneProps["chatModeToolbarProperties"];
  debugWorkspaceSection: DebugWorkspaceSection;
  setDebugWorkspaceSection: DebugWorkspacePaneProps["onDebugWorkspaceSectionChange"];
  debugErrorIssueCount: number;
  debugWarningIssueCount: number;
  filteredDebugIssues: DebugWorkspacePaneProps["filteredDebugIssues"];
  selectedDebugIssue: DebugWorkspacePaneProps["selectedDebugIssue"];
  selectedDebugIssueId: string;
  debugIssueSeverityFilter: DebugWorkspacePaneProps["debugIssueSeverityFilter"];
  debugIssueFilterQuery: string;
  debugErrorSessionId: string;
  debugErrorSessionLogPath: string;
  setSelectedDebugIssueId: DebugWorkspacePaneProps["onSelectDebugIssue"];
  setDebugIssueSeverityFilter: DebugWorkspacePaneProps["onDebugIssueSeverityFilterChange"];
  setDebugIssueFilterQuery: DebugWorkspacePaneProps["onDebugIssueFilterQueryChange"];
  clearDebugIssuesFromDebugPanel: DebugWorkspacePaneProps["onClearDebugIssues"];
  debugHistoryEntryListItems: readonly DebugHistoryEntryListItem[];
  selectedHistoryId: string;
  selectedHistoryDetailId: string | null;
  historyDetailPayloadText: string;
  waitForReplayResponse: boolean;
  setSelectedHistoryId: DebugWorkspacePaneProps["onSelectHistoryEntry"];
  setWaitForReplayResponse: DebugWorkspacePaneProps["onWaitForReplayResponseChange"];
  replayHistoryEntryFromDetail: DebugWorkspacePaneProps["onReplayHistoryEntry"];
  streamEventCount: number;
  streamEventCards: readonly React.JSX.Element[];
  isTraceRecording: boolean;
  traceLabel: string;
  traceNote: string;
  setTraceLabel: (nextLabel: string) => void;
  setTraceNote: (nextNote: string) => void;
  startTraceFromDebugPanel: () => void;
  markTraceFromDebugPanel: () => void;
  stopTraceFromDebugPanel: () => void;
  recentTraceSummaries: readonly DebugTraceSummary[];
  apiSessionTokenDraft: string;
  setApiSessionTokenDraft: (nextTokenValue: string) => void;
  apiSessionBootstrapError: string;
  setApiSessionBootstrapError: (nextErrorMessage: string) => void;
  submitApiSessionToken: () => void | Promise<void>;
  isApiSessionBootstrapPending: boolean;
}

export interface ApplicationShellViewProperties {
  threadSidebarHealthState: ThreadSidebarPanelHealthState | null;
  applicationHeaderBarProperties: ApplicationHeaderBarProps;
  debugStatusBannersProperties: DebugStatusBannersProps;
  chatWorkspacePaneProperties: ChatWorkspacePaneProps;
  debugWorkspacePaneProperties: DebugWorkspacePaneProps;
  apiSessionBootstrapOverlayProperties: ApiSessionBootstrapOverlayProperties;
}

export function useApplicationShellViewProperties(
  input: UseApplicationShellViewPropertiesInput
): ApplicationShellViewProperties {
  const {
    health,
    activeTab,
    desktopSidebarOpen,
    selectedThreadLabel,
    hasSelectedThread,
    activeThreadAgentId,
    activeAgentLabel,
    isGenerating,
    pushClientState,
    isEnablingPushNotifications,
    isBusy,
    theme,
    setMobileSidebarOpen,
    setDesktopSidebarOpen,
    enablePushNotificationsFromToolbar,
    refreshCoreDataAndSelectedThread,
    setActiveTab,
    toggleTheme,
    renderAgentFavicon,
    errorMessage,
    errorBannerDetails,
    openDebugFromErrorBanner,
    setErrorMessage,
    liveStateReductionError,
    chatSurfaceState,
    selectedThreadId,
    isCoreLoading,
    isSelectedThreadLoading,
    availableAgentIds,
    turnCount,
    scrollRef,
    chatContentRef,
    visibleConversationItems,
    hasHiddenChatItems,
    firstVisibleChatItemIndex,
    setVisibleChatItemLimit,
    conversationItemCount,
    visibleChatItemsStep,
    isChatAtBottom,
    chatScrollStateCoordinator,
    setIsChatAtBottom,
    activeRequest,
    canSubmitUserInputForActiveAgent,
    answerDraft,
    handleAnswerChange,
    submitPendingRequest,
    skipPendingRequest,
    selectedAgentLabel,
    runInterrupt,
    submitMessage,
    chatModeToolbarProperties,
    debugWorkspaceSection,
    setDebugWorkspaceSection,
    debugErrorIssueCount,
    debugWarningIssueCount,
    filteredDebugIssues,
    selectedDebugIssue,
    selectedDebugIssueId,
    debugIssueSeverityFilter,
    debugIssueFilterQuery,
    debugErrorSessionId,
    debugErrorSessionLogPath,
    setSelectedDebugIssueId,
    setDebugIssueSeverityFilter,
    setDebugIssueFilterQuery,
    clearDebugIssuesFromDebugPanel,
    debugHistoryEntryListItems,
    selectedHistoryId,
    selectedHistoryDetailId,
    historyDetailPayloadText,
    waitForReplayResponse,
    setSelectedHistoryId,
    setWaitForReplayResponse,
    replayHistoryEntryFromDetail,
    streamEventCount,
    streamEventCards,
    isTraceRecording,
    traceLabel,
    traceNote,
    setTraceLabel,
    setTraceNote,
    startTraceFromDebugPanel,
    markTraceFromDebugPanel,
    stopTraceFromDebugPanel,
    recentTraceSummaries,
    apiSessionTokenDraft,
    setApiSessionTokenDraft,
    apiSessionBootstrapError,
    setApiSessionBootstrapError,
    submitApiSessionToken,
    isApiSessionBootstrapPending
  } = input;

  const threadSidebarHealthState = useMemo<ThreadSidebarPanelHealthState | null>(
    () => (
      health
        ? {
          appReady: health.state.appReady,
          ipcConnected: health.state.ipcConnected,
          ipcInitialized: health.state.ipcInitialized,
          lastError: health.state.lastError
        }
        : null
    ),
    [health]
  );

  const applicationHeaderBarProperties: ApplicationHeaderBarProps = {
    activeTab,
    desktopSidebarOpen,
    selectedThreadLabel,
    hasSelectedThread,
    activeThreadAgentId,
    activeAgentLabel,
    isGenerating,
    pushClientState,
    isEnablingPushNotifications,
    isBusy,
    theme,
    onOpenMobileSidebar: () => {
      setMobileSidebarOpen(true);
    },
    onOpenDesktopSidebar: () => {
      setDesktopSidebarOpen(true);
    },
    onEnablePushNotifications: () => {
      void enablePushNotificationsFromToolbar();
    },
    onRefresh: () => {
      void refreshCoreDataAndSelectedThread();
    },
    onToggleDebugTab: () => {
      setActiveTab(activeTab === "debug" ? "chat" : "debug");
    },
    onToggleTheme: toggleTheme,
    renderAgentFavicon
  };

  const debugStatusBannersProperties: DebugStatusBannersProps = {
    activeTab,
    errorMessage,
    errorBannerDetails,
    onOpenDebugFromErrorBanner: openDebugFromErrorBanner,
    onDismissErrorBanner: () => {
      setErrorMessage("");
    },
    liveStateReductionError
  };

  const chatWorkspacePaneProperties: ChatWorkspacePaneProps = {
    chatSurfaceState,
    selectedThreadId,
    isCoreLoading,
    isSelectedThreadLoading,
    availableAgentIds,
    turnCount,
    scrollRef,
    chatContentRef,
    visibleConversationItems,
    hasHiddenChatItems,
    firstVisibleChatItemIndex,
    onShowOlderMessages: () => {
      setVisibleChatItemLimit((limit) =>
        Math.min(conversationItemCount, limit + visibleChatItemsStep)
      );
    },
    isChatAtBottom,
    onJumpToBottom: () => {
      if (!scrollRef.current) {
        return;
      }
      chatScrollStateCoordinator.pinToBottom(scrollRef.current);
      setIsChatAtBottom(true);
    },
    activeRequest,
    canSubmitUserInputForActiveAgent,
    answerDraft,
    onAnswerDraftChange: handleAnswerChange,
    onSubmitPendingRequest: () => {
      void submitPendingRequest();
    },
    onSkipPendingRequest: () => {
      void skipPendingRequest();
    },
    isBusy,
    isGenerating,
    activeAgentLabel,
    selectedAgentLabel,
    onInterrupt: runInterrupt,
    onSendMessage: submitMessage,
    chatModeToolbarProperties
  };

  const debugWorkspacePaneProperties: DebugWorkspacePaneProps = {
    debugWorkspaceSection,
    onDebugWorkspaceSectionChange: setDebugWorkspaceSection,
    debugErrorIssueCount,
    debugWarningIssueCount,
    filteredDebugIssues,
    selectedDebugIssue,
    selectedDebugIssueId,
    debugIssueSeverityFilter,
    debugIssueFilterQuery,
    debugErrorSessionId,
    debugErrorSessionLogPath,
    onSelectDebugIssue: setSelectedDebugIssueId,
    onDebugIssueSeverityFilterChange: setDebugIssueSeverityFilter,
    onDebugIssueFilterQueryChange: setDebugIssueFilterQuery,
    onClearDebugIssues: clearDebugIssuesFromDebugPanel,
    debugHistoryEntryListItems,
    selectedHistoryId,
    selectedHistoryDetailId,
    historyDetailPayloadText,
    waitForReplayResponse,
    onSelectHistoryEntry: setSelectedHistoryId,
    onWaitForReplayResponseChange: setWaitForReplayResponse,
    onReplayHistoryEntry: replayHistoryEntryFromDetail,
    streamEventCount,
    streamEventCards,
    isTraceRecording,
    traceLabel,
    traceNote,
    onTraceLabelChange: setTraceLabel,
    onTraceNoteChange: setTraceNote,
    onStartTrace: startTraceFromDebugPanel,
    onMarkTrace: markTraceFromDebugPanel,
    onStopTrace: stopTraceFromDebugPanel,
    recentTraceSummaries
  };

  const apiSessionBootstrapOverlayProperties: ApiSessionBootstrapOverlayProperties = {
    apiTokenDraft: apiSessionTokenDraft,
    onApiTokenDraftChange: (nextTokenValue) => {
      setApiSessionTokenDraft(nextTokenValue);
      if (apiSessionBootstrapError.length > 0) {
        setApiSessionBootstrapError("");
      }
    },
    onSubmitApiToken: () => {
      void submitApiSessionToken();
    },
    isSubmitting: isApiSessionBootstrapPending,
    errorMessage: apiSessionBootstrapError
  };

  return {
    threadSidebarHealthState,
    applicationHeaderBarProperties,
    debugStatusBannersProperties,
    chatWorkspacePaneProperties,
    debugWorkspacePaneProperties,
    apiSessionBootstrapOverlayProperties
  };
}
