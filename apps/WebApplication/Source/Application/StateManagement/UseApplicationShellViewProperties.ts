import { type Dispatch, type SetStateAction, useMemo } from "react";
import { type ApiSessionBootstrapOverlayProperties } from "@/Application/UserInterface/ApiSessionBootstrapOverlay";
import { type ApplicationHeaderBarProps } from "@/Application/UserInterface/ApplicationHeaderBar";
import { type CapabilityHealthResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { type ChatScrollStateCoordinator } from "@/Features/Chat/StateManagement/ChatScrollStateCoordinator";
import { type ChatWorkspacePaneProps } from "@/Features/Chat/UserInterface/ChatWorkspacePane";
import { type RuntimeRequestErrorOperationMetric } from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import { type DebugWorkspaceSection } from "@/Features/Debugging/DomainModel/DebugWorkspaceSectionContracts";
import { type DebugHistoryEntryListItem } from "@/Features/Debugging/UserInterface/DebugHistoryPanel";
import { type DebugStatusBannersProps } from "@/Features/Debugging/UserInterface/DebugStatusBanners";
import { type DebugTraceSummary } from "@/Features/Debugging/UserInterface/DebugTracePanel";
import { type DebugWorkspacePaneProps } from "@/Features/Debugging/UserInterface/DebugWorkspacePane";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import { type ThreadSidebarPanelHealthState } from "@/Features/Threads/UserInterface/ThreadSidebarPanel";

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
  runtimeRequestErrorOperationMetrics: RuntimeRequestErrorOperationMetric[];
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

type AsyncOwnerAction = () => void | Promise<void>;

const CHAT_TAB: ApplicationHeaderBarProps["activeTab"] = "chat";
const DEBUG_TAB: ApplicationHeaderBarProps["activeTab"] = "debug";
const EMPTY_ERROR_MESSAGE = "";
const SIDEBAR_OPEN_STATE = true;
const CHAT_AT_BOTTOM_STATE = true;
const MINIMUM_ERROR_LENGTH = EMPTY_ERROR_MESSAGE.length;

function invokeAsyncOwnerAction(action: AsyncOwnerAction): void {
  void action();
}

function openSidebarWithChatTab(
  setActiveTab: UseApplicationShellViewPropertiesInput["setActiveTab"],
  setSidebarOpen: (nextOpen: boolean) => void,
): void {
  setActiveTab(CHAT_TAB);
  setSidebarOpen(SIDEBAR_OPEN_STATE);
}

function getNextActiveTabWhenTogglingDebug(
  activeTab: ApplicationHeaderBarProps["activeTab"],
): ApplicationHeaderBarProps["activeTab"] {
  return activeTab === DEBUG_TAB ? CHAT_TAB : DEBUG_TAB;
}

function getNextVisibleChatItemLimit(
  currentVisibleChatItemLimit: number,
  conversationItemCount: number,
  visibleChatItemsStep: number,
): number {
  return Math.min(conversationItemCount, currentVisibleChatItemLimit + visibleChatItemsStep);
}

function pinChatToBottomIfScrollElementExists(
  scrollReference: ChatWorkspacePaneProps["scrollRef"],
  chatScrollStateCoordinator: ChatScrollStateCoordinator,
  setIsChatAtBottom: (nextIsAtBottom: boolean) => void,
): void {
  const scrollElement = scrollReference.current;
  if (!scrollElement) {
    return;
  }

  chatScrollStateCoordinator.pinToBottom(scrollElement);
  setIsChatAtBottom(CHAT_AT_BOTTOM_STATE);
}

function buildThreadSidebarHealthState(
  health: CapabilityHealthResponse | null,
): ThreadSidebarPanelHealthState | null {
  if (!health) {
    return null;
  }

  return {
    appReady: health.state.appReady,
    ipcConnected: health.state.ipcConnected,
    ipcInitialized: health.state.ipcInitialized,
    lastError: health.state.lastError,
  };
}

function clearErrorMessage(setErrorMessage: (nextErrorMessage: string) => void): void {
  setErrorMessage(EMPTY_ERROR_MESSAGE);
}

function clearApiSessionBootstrapErrorIfPresent(
  apiSessionBootstrapError: string,
  setApiSessionBootstrapError: (nextErrorMessage: string) => void,
): void {
  if (apiSessionBootstrapError.length === MINIMUM_ERROR_LENGTH) {
    return;
  }

  setApiSessionBootstrapError(EMPTY_ERROR_MESSAGE);
}

function buildApplicationHeaderBarProperties(
  input: UseApplicationShellViewPropertiesInput,
): ApplicationHeaderBarProps {
  return {
    activeTab: input.activeTab,
    desktopSidebarOpen: input.desktopSidebarOpen,
    selectedThreadLabel: input.selectedThreadLabel,
    hasSelectedThread: input.hasSelectedThread,
    activeThreadAgentId: input.activeThreadAgentId,
    activeAgentLabel: input.activeAgentLabel,
    isGenerating: input.isGenerating,
    pushClientState: input.pushClientState,
    isEnablingPushNotifications: input.isEnablingPushNotifications,
    isBusy: input.isBusy,
    theme: input.theme,
    onOpenMobileSidebar: () => {
      openSidebarWithChatTab(input.setActiveTab, input.setMobileSidebarOpen);
    },
    onOpenDesktopSidebar: () => {
      openSidebarWithChatTab(input.setActiveTab, input.setDesktopSidebarOpen);
    },
    onEnablePushNotifications: () => {
      invokeAsyncOwnerAction(input.enablePushNotificationsFromToolbar);
    },
    onRefresh: () => {
      invokeAsyncOwnerAction(input.refreshCoreDataAndSelectedThread);
    },
    onToggleDebugTab: () => {
      input.setActiveTab(getNextActiveTabWhenTogglingDebug(input.activeTab));
    },
    onToggleTheme: input.toggleTheme,
    renderAgentFavicon: input.renderAgentFavicon,
  };
}

function buildDebugStatusBannersProperties(
  input: UseApplicationShellViewPropertiesInput,
): DebugStatusBannersProps {
  return {
    activeTab: input.activeTab,
    errorMessage: input.errorMessage,
    errorBannerDetails: input.errorBannerDetails,
    onOpenDebugFromErrorBanner: () => {
      input.openDebugFromErrorBanner();
      clearErrorMessage(input.setErrorMessage);
    },
    onDismissErrorBanner: () => {
      clearErrorMessage(input.setErrorMessage);
    },
    liveStateReductionError: input.liveStateReductionError,
  };
}

function buildChatWorkspacePaneProperties(
  input: UseApplicationShellViewPropertiesInput,
): ChatWorkspacePaneProps {
  return {
    chatSurfaceState: input.chatSurfaceState,
    selectedThreadId: input.selectedThreadId,
    availableAgentIds: input.availableAgentIds,
    turnCount: input.turnCount,
    scrollRef: input.scrollRef,
    chatContentRef: input.chatContentRef,
    visibleConversationItems: input.visibleConversationItems,
    hasHiddenChatItems: input.hasHiddenChatItems,
    firstVisibleChatItemIndex: input.firstVisibleChatItemIndex,
    onShowOlderMessages: () => {
      input.setVisibleChatItemLimit((limit) =>
        getNextVisibleChatItemLimit(limit, input.conversationItemCount, input.visibleChatItemsStep),
      );
    },
    isChatAtBottom: input.isChatAtBottom,
    onJumpToBottom: () => {
      pinChatToBottomIfScrollElementExists(
        input.scrollRef,
        input.chatScrollStateCoordinator,
        input.setIsChatAtBottom,
      );
    },
    activeRequest: input.activeRequest,
    canSubmitUserInputForActiveAgent: input.canSubmitUserInputForActiveAgent,
    answerDraft: input.answerDraft,
    onAnswerDraftChange: input.handleAnswerChange,
    onSubmitPendingRequest: () => {
      invokeAsyncOwnerAction(input.submitPendingRequest);
    },
    onSkipPendingRequest: () => {
      invokeAsyncOwnerAction(input.skipPendingRequest);
    },
    isBusy: input.isBusy,
    isGenerating: input.isGenerating,
    activeAgentLabel: input.activeAgentLabel,
    selectedAgentLabel: input.selectedAgentLabel,
    onInterrupt: input.runInterrupt,
    onSendMessage: input.submitMessage,
    chatModeToolbarProperties: input.chatModeToolbarProperties,
  };
}

function buildDebugWorkspacePaneProperties(
  input: UseApplicationShellViewPropertiesInput,
): DebugWorkspacePaneProps {
  return {
    debugWorkspaceSection: input.debugWorkspaceSection,
    onDebugWorkspaceSectionChange: input.setDebugWorkspaceSection,
    debugErrorIssueCount: input.debugErrorIssueCount,
    debugWarningIssueCount: input.debugWarningIssueCount,
    runtimeRequestErrorOperationMetrics: input.runtimeRequestErrorOperationMetrics,
    filteredDebugIssues: input.filteredDebugIssues,
    selectedDebugIssue: input.selectedDebugIssue,
    selectedDebugIssueId: input.selectedDebugIssueId,
    debugIssueSeverityFilter: input.debugIssueSeverityFilter,
    debugIssueFilterQuery: input.debugIssueFilterQuery,
    debugErrorSessionId: input.debugErrorSessionId,
    debugErrorSessionLogPath: input.debugErrorSessionLogPath,
    onSelectDebugIssue: input.setSelectedDebugIssueId,
    onDebugIssueSeverityFilterChange: input.setDebugIssueSeverityFilter,
    onDebugIssueFilterQueryChange: input.setDebugIssueFilterQuery,
    onClearDebugIssues: input.clearDebugIssuesFromDebugPanel,
    debugHistoryEntryListItems: input.debugHistoryEntryListItems,
    selectedHistoryId: input.selectedHistoryId,
    selectedHistoryDetailId: input.selectedHistoryDetailId,
    historyDetailPayloadText: input.historyDetailPayloadText,
    waitForReplayResponse: input.waitForReplayResponse,
    onSelectHistoryEntry: input.setSelectedHistoryId,
    onWaitForReplayResponseChange: input.setWaitForReplayResponse,
    onReplayHistoryEntry: input.replayHistoryEntryFromDetail,
    streamEventCount: input.streamEventCount,
    streamEventCards: input.streamEventCards,
    isTraceRecording: input.isTraceRecording,
    traceLabel: input.traceLabel,
    traceNote: input.traceNote,
    onTraceLabelChange: input.setTraceLabel,
    onTraceNoteChange: input.setTraceNote,
    onStartTrace: input.startTraceFromDebugPanel,
    onMarkTrace: input.markTraceFromDebugPanel,
    onStopTrace: input.stopTraceFromDebugPanel,
    recentTraceSummaries: input.recentTraceSummaries,
  };
}

function buildApiSessionBootstrapOverlayProperties(
  input: UseApplicationShellViewPropertiesInput,
): ApiSessionBootstrapOverlayProperties {
  return {
    apiTokenDraft: input.apiSessionTokenDraft,
    onApiTokenDraftChange: (nextTokenValue: string) => {
      input.setApiSessionTokenDraft(nextTokenValue);
      clearApiSessionBootstrapErrorIfPresent(
        input.apiSessionBootstrapError,
        input.setApiSessionBootstrapError,
      );
    },
    onSubmitApiToken: () => {
      invokeAsyncOwnerAction(input.submitApiSessionToken);
    },
    isSubmitting: input.isApiSessionBootstrapPending,
    errorMessage: input.apiSessionBootstrapError,
  };
}

export function useApplicationShellViewProperties(
  input: UseApplicationShellViewPropertiesInput,
): ApplicationShellViewProperties {
  const threadSidebarHealthState = useMemo<ThreadSidebarPanelHealthState | null>(
    () => buildThreadSidebarHealthState(input.health),
    [input.health],
  );

  const applicationHeaderBarProperties = buildApplicationHeaderBarProperties(input);
  const debugStatusBannersProperties = buildDebugStatusBannersProperties(input);
  const chatWorkspacePaneProperties = buildChatWorkspacePaneProperties(input);
  const debugWorkspacePaneProperties = buildDebugWorkspacePaneProperties(input);
  const apiSessionBootstrapOverlayProperties = buildApiSessionBootstrapOverlayProperties(input);

  return {
    threadSidebarHealthState,
    applicationHeaderBarProperties,
    debugStatusBannersProperties,
    chatWorkspacePaneProperties,
    debugWorkspacePaneProperties,
    apiSessionBootstrapOverlayProperties,
  };
}
