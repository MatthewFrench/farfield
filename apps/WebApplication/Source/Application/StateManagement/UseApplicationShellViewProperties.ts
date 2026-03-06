// biome-ignore lint/nursery/noExcessiveLinesPerFile: Composition split follow-up is tracked in docs/proposed-structure-and-migration.md decision entry 20.
import { type Dispatch, type SetStateAction, useMemo } from "react";
import { type ApiSessionBootstrapOverlayProperties } from "@/Application/UserInterface/ApiSessionBootstrapOverlay";
import { type ApplicationHeaderBarProps } from "@/Application/UserInterface/ApplicationHeaderBar";
import { type CapabilityHealthResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { type ChatScrollStateCoordinator } from "@/Features/Chat/StateManagement/ChatScrollStateCoordinator";
import { type RuntimeUsageSummaryLine } from "@/Features/Chat/UserInterface/ChatModeToolbar";
import { type ChatWorkspacePaneProps } from "@/Features/Chat/UserInterface/ChatWorkspacePane";
import {
  type RuntimeRequestErrorOperationMetric,
  type SuccessBannerDetails,
} from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import { type DebugWorkspaceSection } from "@/Features/Debugging/DomainModel/DebugWorkspaceSectionContracts";
import { type DebugHistoryEntryListItem } from "@/Features/Debugging/UserInterface/DebugHistoryPanel";
import { type DebugStatusBannersProps } from "@/Features/Debugging/UserInterface/DebugStatusBanners";
import { type DebugTraceSummary } from "@/Features/Debugging/UserInterface/DebugTracePanel";
import { type DebugWorkspacePaneProps } from "@/Features/Debugging/UserInterface/DebugWorkspacePane";
import {
  type PushLocalCertificateAuthorityStatusResponse,
  type PushReceiptLatestResponse,
  type PushSendLatestResponse,
  type PushStatusResponse,
  type PushTestResponse,
} from "@/Features/PushNotifications/DataAccess/PushServerClient";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import { type PushNotificationsSettingsPaneProps } from "@/Features/PushNotifications/UserInterface/PushNotificationsSettingsPane";
import { type SettingsWorkspaceSection } from "@/Features/Settings/DomainModel/SettingsWorkspaceSectionContracts";
import { type SettingsWorkspacePaneProps } from "@/Features/Settings/UserInterface/SettingsWorkspacePane";
import { type ThreadSidebarRuntimeSummary } from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { type ThreadSidebarPanelHealthState } from "@/Features/Threads/UserInterface/ThreadSidebarPanel";

interface SendPushTestNotificationFromSettingsInput {
  threadId: string;
  turnId: string;
}

export interface UseApplicationShellViewPropertiesInput {
  health: CapabilityHealthResponse | null;
  threadSidebarRuntimeSummary: ThreadSidebarRuntimeSummary;
  activeTab: ApplicationHeaderBarProps["activeTab"];
  settingsWorkspaceSection: SettingsWorkspaceSection;
  desktopSidebarOpen: boolean;
  selectedThreadLabel: string;
  hasSelectedThread: boolean;
  activeThreadAgentId: ApplicationHeaderBarProps["activeThreadAgentId"];
  activeAgentLabel: string;
  isGenerating: boolean;
  pushClientState: PushClientState;
  pushStatus: PushStatusResponse | null;
  latestPushReceipt: PushReceiptLatestResponse | null;
  latestPushSend: PushSendLatestResponse | null;
  pushLocalCertificateAuthorityStatus: PushLocalCertificateAuthorityStatusResponse | null;
  pushSettingsErrorMessage: string;
  pushTestResult: PushTestResponse | null;
  latestTurnId: string | null;
  isEnablingPushNotifications: boolean;
  isRefreshingPushSettings: boolean;
  isSendingPushTestNotification: boolean;
  isBusy: boolean;
  theme: string;
  setMobileSidebarOpen: (nextOpen: boolean) => void;
  setDesktopSidebarOpen: (nextOpen: boolean) => void;
  setSettingsWorkspaceSection: (nextSection: SettingsWorkspaceSection) => void;
  enablePushNotificationsFromToolbar: () => void | Promise<void>;
  refreshPushSettingsDiagnostics: () => void | Promise<void>;
  sendPushTestNotificationFromSettings: (
    input: SendPushTestNotificationFromSettingsInput,
  ) => void | Promise<void>;
  refreshCoreDataAndSelectedThread: () => void | Promise<void>;
  setActiveTab: (nextTab: ApplicationHeaderBarProps["activeTab"]) => void;
  toggleTheme: () => void;
  renderAgentFavicon: ApplicationHeaderBarProps["renderAgentFavicon"];
  errorMessage: string;
  errorBannerDetails: DebugStatusBannersProps["errorBannerDetails"];
  successBannerDetails: SuccessBannerDetails | null;
  openDebugFromErrorBanner: () => void;
  setErrorMessage: (nextErrorMessage: string) => void;
  setSuccessBannerDetails: Dispatch<SetStateAction<SuccessBannerDetails | null>>;
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
  activeAuthTokenRefreshRequest?: ChatWorkspacePaneProps["activeAuthTokenRefreshRequest"];
  activeApplyPatchApprovalRequest?: ChatWorkspacePaneProps["activeApplyPatchApprovalRequest"];
  activeCommandExecutionApprovalRequest?: ChatWorkspacePaneProps["activeCommandExecutionApprovalRequest"];
  activeExecuteCommandApprovalRequest?: ChatWorkspacePaneProps["activeExecuteCommandApprovalRequest"];
  activeFileChangeApprovalRequest?: ChatWorkspacePaneProps["activeFileChangeApprovalRequest"];
  activeToolCallRequest?: ChatWorkspacePaneProps["activeToolCallRequest"];
  canSubmitUserInputForActiveAgent: boolean;
  answerDraft: ChatWorkspacePaneProps["answerDraft"];
  handleAnswerChange: ChatWorkspacePaneProps["onAnswerDraftChange"];
  submitPendingRequest: () => void | Promise<void>;
  skipPendingRequest: () => void | Promise<void>;
  submitAuthTokenRefreshRequest?: ChatWorkspacePaneProps["onSubmitAuthTokenRefreshRequest"];
  submitApplyPatchApprovalRequest?: ChatWorkspacePaneProps["onSubmitApplyPatchApprovalRequest"];
  submitCommandExecutionApprovalRequest?: ChatWorkspacePaneProps["onSubmitCommandExecutionApprovalRequest"];
  submitExecuteCommandApprovalRequest?: ChatWorkspacePaneProps["onSubmitExecuteCommandApprovalRequest"];
  submitFileChangeApprovalRequest?: ChatWorkspacePaneProps["onSubmitFileChangeApprovalRequest"];
  submitToolCallRequestResponse?: ChatWorkspacePaneProps["onSubmitToolCallRequestResponse"];
  selectedAgentLabel: string;
  runInterrupt: ChatWorkspacePaneProps["onInterrupt"];
  steerMessage: ChatWorkspacePaneProps["onSteerMessage"];
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
  isLoadingCoverageDiagnostics: boolean;
  isRunningCoverageAction: boolean;
  coverageDiagnosticsErrorMessage: string;
  coverageActionErrorMessage: string;
  coverageDiagnosticsSnapshot: DebugWorkspacePaneProps["coverageDiagnosticsSnapshot"];
  pendingAccountLogin: DebugWorkspacePaneProps["pendingAccountLogin"];
  lastCommandExecutionResult: DebugWorkspacePaneProps["lastCommandExecutionResult"];
  lastConfigBatchWriteResult: DebugWorkspacePaneProps["lastConfigBatchWriteResult"];
  lastConfigValueWriteResult: DebugWorkspacePaneProps["lastConfigValueWriteResult"];
  lastExternalAgentConfigDetectResult: DebugWorkspacePaneProps["lastExternalAgentConfigDetectResult"];
  lastExternalAgentConfigImportResult: DebugWorkspacePaneProps["lastExternalAgentConfigImportResult"];
  lastThreadRealtimeStartResult: DebugWorkspacePaneProps["lastThreadRealtimeStartResult"];
  lastThreadRealtimeAppendAudioResult: DebugWorkspacePaneProps["lastThreadRealtimeAppendAudioResult"];
  lastThreadRealtimeAppendTextResult: DebugWorkspacePaneProps["lastThreadRealtimeAppendTextResult"];
  lastThreadRealtimeStopResult: DebugWorkspacePaneProps["lastThreadRealtimeStopResult"];
  lastThreadStreamEventsResult: DebugWorkspacePaneProps["lastThreadStreamEventsResult"];
  lastAccountAndAppNotificationsResult: DebugWorkspacePaneProps["lastAccountAndAppNotificationsResult"];
  lastNotificationEventsResult: DebugWorkspacePaneProps["lastNotificationEventsResult"];
  lastAuthCompletionEventsResult: DebugWorkspacePaneProps["lastAuthCompletionEventsResult"];
  lastPendingServerRequestsResult: DebugWorkspacePaneProps["lastPendingServerRequestsResult"];
  lastServerRequestResolvedEventsResult: DebugWorkspacePaneProps["lastServerRequestResolvedEventsResult"];
  lastWindowsSandboxSetupStartResult: DebugWorkspacePaneProps["lastWindowsSandboxSetupStartResult"];
  lastFeedbackUploadResult: DebugWorkspacePaneProps["lastFeedbackUploadResult"];
  lastErrorNotificationsResult: DebugWorkspacePaneProps["lastErrorNotificationsResult"];
  lastFuzzyFileSearchResult: DebugWorkspacePaneProps["lastFuzzyFileSearchResult"];
  lastFuzzyFileSearchSessionStartResult: DebugWorkspacePaneProps["lastFuzzyFileSearchSessionStartResult"];
  lastFuzzyFileSearchSessionUpdateResult: DebugWorkspacePaneProps["lastFuzzyFileSearchSessionUpdateResult"];
  lastFuzzyFileSearchSessionStopResult: DebugWorkspacePaneProps["lastFuzzyFileSearchSessionStopResult"];
  lastFuzzySessionNotificationsResult: DebugWorkspacePaneProps["lastFuzzySessionNotificationsResult"];
  lastModelReroutedEventsResult: DebugWorkspacePaneProps["lastModelReroutedEventsResult"];
  lastWarningNotificationsResult: DebugWorkspacePaneProps["lastWarningNotificationsResult"];
  lastThreadLifecycleNotificationsResult: DebugWorkspacePaneProps["lastThreadLifecycleNotificationsResult"];
  lastThreadProgressNotificationsResult: DebugWorkspacePaneProps["lastThreadProgressNotificationsResult"];
  lastThreadRealtimeNotificationsResult: DebugWorkspacePaneProps["lastThreadRealtimeNotificationsResult"];
  lastTurnLifecycleNotificationsResult: DebugWorkspacePaneProps["lastTurnLifecycleNotificationsResult"];
  lastItemDeltaNotificationsResult: DebugWorkspacePaneProps["lastItemDeltaNotificationsResult"];
  lastItemLifecycleNotificationsResult: DebugWorkspacePaneProps["lastItemLifecycleNotificationsResult"];
  lastGitDiffToRemoteResult: DebugWorkspacePaneProps["lastGitDiffToRemoteResult"];
  refreshCoverageDiagnostics: () => void;
  startAccountLogin: () => void;
  cancelAccountLogin: () => void;
  logoutAccount: () => void;
  reloadMcpServerConfig: () => void;
  startMcpServerOauthLogin: (serverName: string) => void;
  writeConfigValue: (
    keyPath: string,
    value: string,
    mergeStrategy: "replace" | "upsert",
    filePath?: string,
    expectedVersion?: string,
  ) => void;
  writeConfigBatch: (edits: string, filePath?: string, expectedVersion?: string) => void;
  writeSkillsConfig: (skillPath: string, enabled: boolean) => void;
  exportRemoteSkill: (hazelnutId: string) => void;
  detectExternalAgentConfig: (includeHome: boolean, cwds: string[]) => void;
  importExternalAgentConfig: DebugWorkspacePaneProps["onImportExternalAgentConfig"];
  startThreadRealtime: DebugWorkspacePaneProps["onStartThreadRealtime"];
  appendThreadRealtimeAudio: DebugWorkspacePaneProps["onAppendThreadRealtimeAudio"];
  appendThreadRealtimeText: DebugWorkspacePaneProps["onAppendThreadRealtimeText"];
  stopThreadRealtime: DebugWorkspacePaneProps["onStopThreadRealtime"];
  readThreadStreamEvents: DebugWorkspacePaneProps["onReadThreadStreamEvents"];
  readAccountAndAppNotifications: DebugWorkspacePaneProps["onReadAccountAndAppNotifications"];
  readNotificationEvents: DebugWorkspacePaneProps["onReadNotificationEvents"];
  readAuthCompletionEvents: DebugWorkspacePaneProps["onReadAuthCompletionEvents"];
  readServerRequestResolvedEvents: DebugWorkspacePaneProps["onReadServerRequestResolvedEvents"];
  readPendingServerRequests: DebugWorkspacePaneProps["onReadPendingServerRequests"];
  startWindowsSandboxSetup: DebugWorkspacePaneProps["onStartWindowsSandboxSetup"];
  readGitDiffToRemote: (cwd: string) => void;
  searchFuzzyFiles: (query: string, roots: string[], cancellationToken?: string) => void;
  startFuzzyFileSearchSession: (sessionId: string, roots: string[]) => void;
  updateFuzzyFileSearchSession: (sessionId: string, query: string) => void;
  stopFuzzyFileSearchSession: (sessionId: string) => void;
  readFuzzySessionNotifications: DebugWorkspacePaneProps["onReadFuzzySessionNotifications"];
  readModelReroutedEvents: DebugWorkspacePaneProps["onReadModelReroutedEvents"];
  readWarningNotifications: DebugWorkspacePaneProps["onReadWarningNotifications"];
  readThreadLifecycleNotifications: DebugWorkspacePaneProps["onReadThreadLifecycleNotifications"];
  readThreadProgressNotifications: DebugWorkspacePaneProps["onReadThreadProgressNotifications"];
  readThreadRealtimeNotifications: DebugWorkspacePaneProps["onReadThreadRealtimeNotifications"];
  readTurnLifecycleNotifications: DebugWorkspacePaneProps["onReadTurnLifecycleNotifications"];
  readItemDeltaNotifications: DebugWorkspacePaneProps["onReadItemDeltaNotifications"];
  readItemLifecycleNotifications: DebugWorkspacePaneProps["onReadItemLifecycleNotifications"];
  readErrorNotifications: DebugWorkspacePaneProps["onReadErrorNotifications"];
  executeCommand: (command: string[], timeoutMs?: number, cwd?: string) => void;
  uploadFeedback: (
    classification: string,
    includeLogs: boolean,
    reason?: string,
    threadId?: string,
  ) => void;
  apiSessionTokenDraft: string;
  setApiSessionTokenDraft: (nextTokenValue: string) => void;
  apiSessionBootstrapError: string;
  setApiSessionBootstrapError: (nextErrorMessage: string) => void;
  submitApiSessionToken: () => void | Promise<void>;
  isApiSessionBootstrapPending: boolean;
}

export interface ApplicationShellViewProperties {
  threadSidebarHealthState: ThreadSidebarPanelHealthState | null;
  threadSidebarRuntimeSummary: ThreadSidebarRuntimeSummary;
  applicationHeaderBarProperties: ApplicationHeaderBarProps;
  debugStatusBannersProperties: DebugStatusBannersProps;
  chatWorkspacePaneProperties: ChatWorkspacePaneProps;
  settingsWorkspacePaneProperties: SettingsWorkspacePaneProps;
  apiSessionBootstrapOverlayProperties: ApiSessionBootstrapOverlayProperties;
}

type AsyncOwnerAction = () => void | Promise<void>;

const CHAT_TAB: ApplicationHeaderBarProps["activeTab"] = "chat";
const SETTINGS_TAB: ApplicationHeaderBarProps["activeTab"] = "debug";
const EMPTY_ERROR_MESSAGE = "";
const SIDEBAR_OPEN_STATE = true;
const CHAT_AT_BOTTOM_STATE = true;
const MINIMUM_ERROR_LENGTH = EMPTY_ERROR_MESSAGE.length;
const RATE_LIMIT_USAGE_MAX_PERCENT = 100;
const WEEKLY_RATE_LIMIT_WINDOW_DURATION_MINUTES = 10_080;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1_440;

function invokeAsyncOwnerAction(action: AsyncOwnerAction): void {
  void action();
}

function openSidebar(setSidebarOpen: (nextOpen: boolean) => void): void {
  setSidebarOpen(SIDEBAR_OPEN_STATE);
}

function getNextActiveTabWhenTogglingSettings(
  activeTab: ApplicationHeaderBarProps["activeTab"],
): ApplicationHeaderBarProps["activeTab"] {
  return activeTab === SETTINGS_TAB ? CHAT_TAB : SETTINGS_TAB;
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
    runtimeWarningSummary: input.threadSidebarRuntimeSummary.warning,
    runtimeModelRerouteSummary: input.threadSidebarRuntimeSummary.modelReroute,
    onOpenMobileSidebar: () => {
      openSidebar(input.setMobileSidebarOpen);
    },
    onOpenDesktopSidebar: () => {
      openSidebar(input.setDesktopSidebarOpen);
    },
    onToggleSettingsTab: () => {
      input.setActiveTab(getNextActiveTabWhenTogglingSettings(input.activeTab));
    },
    renderAgentFavicon: input.renderAgentFavicon,
  };
}

function readUsageWindowLabel(windowDurationMinutes: number | null, defaultLabel: string): string {
  if (windowDurationMinutes === null) {
    return defaultLabel;
  }

  if (windowDurationMinutes === WEEKLY_RATE_LIMIT_WINDOW_DURATION_MINUTES) {
    return "Weekly";
  }

  if (windowDurationMinutes >= MINUTES_PER_DAY && windowDurationMinutes % MINUTES_PER_DAY === 0) {
    return `${String(windowDurationMinutes / MINUTES_PER_DAY)}d`;
  }

  if (windowDurationMinutes >= MINUTES_PER_HOUR && windowDurationMinutes % MINUTES_PER_HOUR === 0) {
    return `${String(windowDurationMinutes / MINUTES_PER_HOUR)}h`;
  }

  return `${String(windowDurationMinutes)}m`;
}

function readUsageLeftPercent(usedPercent: number): number {
  const nextLeftPercent = RATE_LIMIT_USAGE_MAX_PERCENT - usedPercent;
  if (nextLeftPercent < 0) {
    return 0;
  }
  if (nextLeftPercent > RATE_LIMIT_USAGE_MAX_PERCENT) {
    return RATE_LIMIT_USAGE_MAX_PERCENT;
  }
  return nextLeftPercent;
}

function readRuntimeUsageSummaryLines(
  summary: ThreadSidebarRuntimeSummary,
): readonly RuntimeUsageSummaryLine[] | null {
  if (summary.rateLimits === null) {
    return null;
  }

  const usageLines: RuntimeUsageSummaryLine[] = [];

  if (summary.rateLimits.primaryWindow !== null && summary.rateLimits.primaryWindow !== undefined) {
    usageLines.push({
      label: readUsageWindowLabel(
        summary.rateLimits.primaryWindow.windowDurationMinutes,
        "Primary",
      ),
      leftPercent: readUsageLeftPercent(summary.rateLimits.primaryWindow.usedPercent),
    });
  }

  if (
    summary.rateLimits.secondaryWindow !== null &&
    summary.rateLimits.secondaryWindow !== undefined
  ) {
    usageLines.push({
      label: readUsageWindowLabel(
        summary.rateLimits.secondaryWindow.windowDurationMinutes,
        "Secondary",
      ),
      leftPercent: readUsageLeftPercent(summary.rateLimits.secondaryWindow.usedPercent),
    });
  }

  if (usageLines.length === 0) {
    return null;
  }

  return usageLines;
}

function buildDebugStatusBannersProperties(
  input: UseApplicationShellViewPropertiesInput,
): DebugStatusBannersProps {
  return {
    activeTab: input.activeTab,
    errorMessage: input.errorMessage,
    errorBannerDetails: input.errorBannerDetails,
    successBannerDetails: input.successBannerDetails,
    onOpenDebugFromErrorBanner: () => {
      input.openDebugFromErrorBanner();
      clearErrorMessage(input.setErrorMessage);
    },
    onDismissErrorBanner: () => {
      clearErrorMessage(input.setErrorMessage);
    },
    onDismissSuccessBanner: () => {
      input.setSuccessBannerDetails(null);
    },
    liveStateReductionError: input.liveStateReductionError,
  };
}

function buildChatWorkspacePaneProperties(
  input: UseApplicationShellViewPropertiesInput,
): ChatWorkspacePaneProps {
  const runtimeUsageSummaryLines = readRuntimeUsageSummaryLines(input.threadSidebarRuntimeSummary);
  const properties: ChatWorkspacePaneProps = {
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
    activeAuthTokenRefreshRequest: input.activeAuthTokenRefreshRequest ?? null,
    activeApplyPatchApprovalRequest: input.activeApplyPatchApprovalRequest ?? null,
    activeCommandExecutionApprovalRequest: input.activeCommandExecutionApprovalRequest ?? null,
    activeExecuteCommandApprovalRequest: input.activeExecuteCommandApprovalRequest ?? null,
    activeFileChangeApprovalRequest: input.activeFileChangeApprovalRequest ?? null,
    activeToolCallRequest: input.activeToolCallRequest ?? null,
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
    onSteerMessage: input.steerMessage,
    onSendMessage: input.submitMessage,
    chatModeToolbarProperties: {
      ...input.chatModeToolbarProperties,
      runtimeUsageSummaryLines,
    },
  };

  let nextProperties = properties;

  if (input.submitAuthTokenRefreshRequest) {
    nextProperties = {
      ...nextProperties,
      onSubmitAuthTokenRefreshRequest: input.submitAuthTokenRefreshRequest,
    };
  }

  if (input.submitApplyPatchApprovalRequest) {
    nextProperties = {
      ...nextProperties,
      onSubmitApplyPatchApprovalRequest: input.submitApplyPatchApprovalRequest,
    };
  }

  if (input.submitCommandExecutionApprovalRequest) {
    nextProperties = {
      ...nextProperties,
      onSubmitCommandExecutionApprovalRequest: input.submitCommandExecutionApprovalRequest,
    };
  }

  if (input.submitExecuteCommandApprovalRequest) {
    nextProperties = {
      ...nextProperties,
      onSubmitExecuteCommandApprovalRequest: input.submitExecuteCommandApprovalRequest,
    };
  }

  if (input.submitFileChangeApprovalRequest) {
    nextProperties = {
      ...nextProperties,
      onSubmitFileChangeApprovalRequest: input.submitFileChangeApprovalRequest,
    };
  }

  if (input.submitToolCallRequestResponse) {
    nextProperties = {
      ...nextProperties,
      onSubmitToolCallRequestResponse: input.submitToolCallRequestResponse,
    };
  }

  return nextProperties;
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
    isLoadingCoverageDiagnostics: input.isLoadingCoverageDiagnostics,
    isRunningCoverageAction: input.isRunningCoverageAction,
    coverageDiagnosticsErrorMessage: input.coverageDiagnosticsErrorMessage,
    coverageActionErrorMessage: input.coverageActionErrorMessage,
    coverageDiagnosticsSnapshot: input.coverageDiagnosticsSnapshot,
    pendingAccountLogin: input.pendingAccountLogin,
    lastCommandExecutionResult: input.lastCommandExecutionResult,
    lastConfigBatchWriteResult: input.lastConfigBatchWriteResult,
    lastConfigValueWriteResult: input.lastConfigValueWriteResult,
    lastExternalAgentConfigDetectResult: input.lastExternalAgentConfigDetectResult,
    lastExternalAgentConfigImportResult: input.lastExternalAgentConfigImportResult,
    lastThreadRealtimeStartResult: input.lastThreadRealtimeStartResult,
    lastThreadRealtimeAppendAudioResult: input.lastThreadRealtimeAppendAudioResult,
    lastThreadRealtimeAppendTextResult: input.lastThreadRealtimeAppendTextResult,
    lastThreadRealtimeStopResult: input.lastThreadRealtimeStopResult,
    lastThreadStreamEventsResult: input.lastThreadStreamEventsResult,
    lastAccountAndAppNotificationsResult: input.lastAccountAndAppNotificationsResult,
    lastNotificationEventsResult: input.lastNotificationEventsResult,
    lastAuthCompletionEventsResult: input.lastAuthCompletionEventsResult,
    lastPendingServerRequestsResult: input.lastPendingServerRequestsResult,
    lastServerRequestResolvedEventsResult: input.lastServerRequestResolvedEventsResult,
    lastWindowsSandboxSetupStartResult: input.lastWindowsSandboxSetupStartResult,
    lastFeedbackUploadResult: input.lastFeedbackUploadResult,
    lastErrorNotificationsResult: input.lastErrorNotificationsResult,
    lastFuzzyFileSearchResult: input.lastFuzzyFileSearchResult,
    lastFuzzyFileSearchSessionStartResult: input.lastFuzzyFileSearchSessionStartResult,
    lastFuzzyFileSearchSessionUpdateResult: input.lastFuzzyFileSearchSessionUpdateResult,
    lastFuzzyFileSearchSessionStopResult: input.lastFuzzyFileSearchSessionStopResult,
    lastFuzzySessionNotificationsResult: input.lastFuzzySessionNotificationsResult,
    lastModelReroutedEventsResult: input.lastModelReroutedEventsResult,
    lastWarningNotificationsResult: input.lastWarningNotificationsResult,
    lastThreadLifecycleNotificationsResult: input.lastThreadLifecycleNotificationsResult,
    lastThreadProgressNotificationsResult: input.lastThreadProgressNotificationsResult,
    lastThreadRealtimeNotificationsResult: input.lastThreadRealtimeNotificationsResult,
    lastTurnLifecycleNotificationsResult: input.lastTurnLifecycleNotificationsResult,
    lastItemDeltaNotificationsResult: input.lastItemDeltaNotificationsResult,
    lastItemLifecycleNotificationsResult: input.lastItemLifecycleNotificationsResult,
    lastGitDiffToRemoteResult: input.lastGitDiffToRemoteResult,
    onRefreshCoverageDiagnostics: input.refreshCoverageDiagnostics,
    onStartAccountLogin: input.startAccountLogin,
    onCancelAccountLogin: input.cancelAccountLogin,
    onLogoutAccount: input.logoutAccount,
    onReloadMcpServerConfig: input.reloadMcpServerConfig,
    onStartMcpServerOauthLogin: input.startMcpServerOauthLogin,
    onWriteConfigValue: input.writeConfigValue,
    onWriteConfigBatch: input.writeConfigBatch,
    onWriteSkillsConfig: input.writeSkillsConfig,
    onExportRemoteSkill: input.exportRemoteSkill,
    onDetectExternalAgentConfig: input.detectExternalAgentConfig,
    onImportExternalAgentConfig: input.importExternalAgentConfig,
    onStartThreadRealtime: input.startThreadRealtime,
    onAppendThreadRealtimeAudio: input.appendThreadRealtimeAudio,
    onAppendThreadRealtimeText: input.appendThreadRealtimeText,
    onStopThreadRealtime: input.stopThreadRealtime,
    onReadThreadStreamEvents: input.readThreadStreamEvents,
    onReadAccountAndAppNotifications: input.readAccountAndAppNotifications,
    onReadNotificationEvents: input.readNotificationEvents,
    onReadAuthCompletionEvents: input.readAuthCompletionEvents,
    onReadServerRequestResolvedEvents: input.readServerRequestResolvedEvents,
    onReadPendingServerRequests: input.readPendingServerRequests,
    onStartWindowsSandboxSetup: input.startWindowsSandboxSetup,
    onReadGitDiffToRemote: input.readGitDiffToRemote,
    onSearchFuzzyFiles: input.searchFuzzyFiles,
    onStartFuzzyFileSearchSession: input.startFuzzyFileSearchSession,
    onUpdateFuzzyFileSearchSession: input.updateFuzzyFileSearchSession,
    onStopFuzzyFileSearchSession: input.stopFuzzyFileSearchSession,
    onReadFuzzySessionNotifications: input.readFuzzySessionNotifications,
    onReadModelReroutedEvents: input.readModelReroutedEvents,
    onReadWarningNotifications: input.readWarningNotifications,
    onReadThreadLifecycleNotifications: input.readThreadLifecycleNotifications,
    onReadThreadProgressNotifications: input.readThreadProgressNotifications,
    onReadThreadRealtimeNotifications: input.readThreadRealtimeNotifications,
    onReadTurnLifecycleNotifications: input.readTurnLifecycleNotifications,
    onReadItemDeltaNotifications: input.readItemDeltaNotifications,
    onReadItemLifecycleNotifications: input.readItemLifecycleNotifications,
    onReadErrorNotifications: input.readErrorNotifications,
    onExecuteCommand: input.executeCommand,
    onUploadFeedback: input.uploadFeedback,
  };
}

function canSendPushTestNotification(
  selectedThreadId: string | null,
  latestTurnId: string | null,
): boolean {
  if (selectedThreadId === null || selectedThreadId.length === 0) {
    return false;
  }
  return latestTurnId !== null && latestTurnId.length > 0;
}

function buildPushNotificationsSettingsPaneProperties(
  input: UseApplicationShellViewPropertiesInput,
): PushNotificationsSettingsPaneProps {
  return {
    pushClientState: input.pushClientState,
    pushStatus: input.pushStatus,
    latestPushReceipt: input.latestPushReceipt,
    latestPushSend: input.latestPushSend,
    pushLocalCertificateAuthorityStatus: input.pushLocalCertificateAuthorityStatus,
    pushSettingsErrorMessage: input.pushSettingsErrorMessage,
    pushTestResult: input.pushTestResult,
    isRefreshingPushSettings: input.isRefreshingPushSettings,
    isEnablingPushNotifications: input.isEnablingPushNotifications,
    isSendingPushTestNotification: input.isSendingPushTestNotification,
    canSendPushTestNotification: canSendPushTestNotification(
      input.selectedThreadId,
      input.latestTurnId,
    ),
    selectedThreadId: input.selectedThreadId,
    latestTurnId: input.latestTurnId,
    onRefreshPushSettings: () => {
      invokeAsyncOwnerAction(input.refreshPushSettingsDiagnostics);
    },
    onEnablePushNotifications: () => {
      invokeAsyncOwnerAction(input.enablePushNotificationsFromToolbar);
    },
    onSendPushTestNotification: () => {
      if (
        input.selectedThreadId === null ||
        input.selectedThreadId.length === 0 ||
        input.latestTurnId === null ||
        input.latestTurnId.length === 0
      ) {
        return;
      }
      const selectedThreadIdentifier = input.selectedThreadId;
      const latestTurnIdentifier = input.latestTurnId;
      invokeAsyncOwnerAction(() =>
        input.sendPushTestNotificationFromSettings({
          threadId: selectedThreadIdentifier,
          turnId: latestTurnIdentifier,
        }),
      );
    },
  };
}

function buildSettingsWorkspacePaneProperties(
  input: UseApplicationShellViewPropertiesInput,
): SettingsWorkspacePaneProps {
  return {
    settingsWorkspaceSection: input.settingsWorkspaceSection,
    onSettingsWorkspaceSectionChange: input.setSettingsWorkspaceSection,
    theme: input.theme,
    isBusy: input.isBusy,
    onRefreshData: () => {
      invokeAsyncOwnerAction(input.refreshCoreDataAndSelectedThread);
    },
    onToggleTheme: input.toggleTheme,
    debugWorkspacePaneProperties: buildDebugWorkspacePaneProperties(input),
    pushNotificationsSettingsPaneProperties: buildPushNotificationsSettingsPaneProperties(input),
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

  const applicationHeaderBarProperties = useMemo<ApplicationHeaderBarProps>(
    () => buildApplicationHeaderBarProperties(input),
    [
      input.activeAgentLabel,
      input.activeTab,
      input.activeThreadAgentId,
      input.desktopSidebarOpen,
      input.hasSelectedThread,
      input.isGenerating,
      input.renderAgentFavicon,
      input.selectedThreadLabel,
      input.setActiveTab,
      input.setDesktopSidebarOpen,
      input.setMobileSidebarOpen,
      input.threadSidebarRuntimeSummary.warning,
      input.threadSidebarRuntimeSummary.modelReroute,
    ],
  );

  const debugStatusBannersProperties = useMemo<DebugStatusBannersProps>(
    () => buildDebugStatusBannersProperties(input),
    [
      input.activeTab,
      input.errorBannerDetails,
      input.errorMessage,
      input.liveStateReductionError,
      input.openDebugFromErrorBanner,
      input.setErrorMessage,
    ],
  );

  const chatWorkspacePaneProperties = useMemo<ChatWorkspacePaneProps>(
    () => buildChatWorkspacePaneProperties(input),
    [
      input.activeAgentLabel,
      input.activeRequest,
      input.activeAuthTokenRefreshRequest,
      input.activeApplyPatchApprovalRequest,
      input.activeCommandExecutionApprovalRequest,
      input.activeExecuteCommandApprovalRequest,
      input.activeFileChangeApprovalRequest,
      input.activeToolCallRequest,
      input.answerDraft,
      input.availableAgentIds,
      input.canSubmitUserInputForActiveAgent,
      input.chatContentRef,
      input.chatModeToolbarProperties,
      input.chatScrollStateCoordinator,
      input.chatSurfaceState,
      input.conversationItemCount,
      input.handleAnswerChange,
      input.hasHiddenChatItems,
      input.firstVisibleChatItemIndex,
      input.isBusy,
      input.isChatAtBottom,
      input.isGenerating,
      input.runInterrupt,
      input.scrollRef,
      input.selectedAgentLabel,
      input.selectedThreadId,
      input.setIsChatAtBottom,
      input.setVisibleChatItemLimit,
      input.skipPendingRequest,
      input.steerMessage,
      input.submitMessage,
      input.submitAuthTokenRefreshRequest,
      input.submitApplyPatchApprovalRequest,
      input.submitCommandExecutionApprovalRequest,
      input.submitExecuteCommandApprovalRequest,
      input.submitFileChangeApprovalRequest,
      input.submitPendingRequest,
      input.submitToolCallRequestResponse,
      input.threadSidebarRuntimeSummary.rateLimits,
      input.turnCount,
      input.visibleChatItemsStep,
      input.visibleConversationItems,
    ],
  );

  const settingsWorkspacePaneProperties = useMemo<SettingsWorkspacePaneProps>(
    () => buildSettingsWorkspacePaneProperties(input),
    [
      input.enablePushNotificationsFromToolbar,
      input.clearDebugIssuesFromDebugPanel,
      input.debugErrorIssueCount,
      input.debugErrorSessionId,
      input.debugErrorSessionLogPath,
      input.debugHistoryEntryListItems,
      input.debugIssueFilterQuery,
      input.debugIssueSeverityFilter,
      input.debugWarningIssueCount,
      input.debugWorkspaceSection,
      input.filteredDebugIssues,
      input.historyDetailPayloadText,
      input.isTraceRecording,
      input.markTraceFromDebugPanel,
      input.recentTraceSummaries,
      input.isLoadingCoverageDiagnostics,
      input.isRunningCoverageAction,
      input.coverageDiagnosticsErrorMessage,
      input.coverageActionErrorMessage,
      input.coverageDiagnosticsSnapshot,
      input.pendingAccountLogin,
      input.lastCommandExecutionResult,
      input.lastConfigBatchWriteResult,
      input.lastConfigValueWriteResult,
      input.lastExternalAgentConfigDetectResult,
      input.lastExternalAgentConfigImportResult,
      input.lastThreadRealtimeStartResult,
      input.lastThreadRealtimeAppendTextResult,
      input.lastThreadRealtimeStopResult,
      input.lastThreadStreamEventsResult,
      input.lastAccountAndAppNotificationsResult,
      input.lastNotificationEventsResult,
      input.lastAuthCompletionEventsResult,
      input.lastPendingServerRequestsResult,
      input.lastServerRequestResolvedEventsResult,
      input.lastWindowsSandboxSetupStartResult,
      input.lastFeedbackUploadResult,
      input.lastErrorNotificationsResult,
      input.lastFuzzyFileSearchResult,
      input.lastFuzzyFileSearchSessionStartResult,
      input.lastFuzzyFileSearchSessionUpdateResult,
      input.lastFuzzyFileSearchSessionStopResult,
      input.lastFuzzySessionNotificationsResult,
      input.lastModelReroutedEventsResult,
      input.lastWarningNotificationsResult,
      input.lastThreadLifecycleNotificationsResult,
      input.lastThreadProgressNotificationsResult,
      input.lastThreadRealtimeNotificationsResult,
      input.lastTurnLifecycleNotificationsResult,
      input.lastItemDeltaNotificationsResult,
      input.lastItemLifecycleNotificationsResult,
      input.lastGitDiffToRemoteResult,
      input.refreshCoverageDiagnostics,
      input.startAccountLogin,
      input.cancelAccountLogin,
      input.logoutAccount,
      input.reloadMcpServerConfig,
      input.startMcpServerOauthLogin,
      input.writeConfigValue,
      input.writeConfigBatch,
      input.writeSkillsConfig,
      input.exportRemoteSkill,
      input.detectExternalAgentConfig,
      input.importExternalAgentConfig,
      input.startThreadRealtime,
      input.appendThreadRealtimeText,
      input.stopThreadRealtime,
      input.readThreadStreamEvents,
      input.readAccountAndAppNotifications,
      input.readNotificationEvents,
      input.readAuthCompletionEvents,
      input.readServerRequestResolvedEvents,
      input.readPendingServerRequests,
      input.startWindowsSandboxSetup,
      input.readGitDiffToRemote,
      input.searchFuzzyFiles,
      input.startFuzzyFileSearchSession,
      input.updateFuzzyFileSearchSession,
      input.stopFuzzyFileSearchSession,
      input.readFuzzySessionNotifications,
      input.readModelReroutedEvents,
      input.readWarningNotifications,
      input.readThreadLifecycleNotifications,
      input.readThreadProgressNotifications,
      input.readThreadRealtimeNotifications,
      input.readTurnLifecycleNotifications,
      input.readItemDeltaNotifications,
      input.readItemLifecycleNotifications,
      input.readErrorNotifications,
      input.executeCommand,
      input.uploadFeedback,
      input.replayHistoryEntryFromDetail,
      input.runtimeRequestErrorOperationMetrics,
      input.isEnablingPushNotifications,
      input.isRefreshingPushSettings,
      input.isSendingPushTestNotification,
      input.isBusy,
      input.refreshCoreDataAndSelectedThread,
      input.selectedDebugIssue,
      input.selectedDebugIssueId,
      input.selectedHistoryDetailId,
      input.selectedHistoryId,
      input.selectedThreadId,
      input.latestTurnId,
      input.latestPushReceipt,
      input.latestPushSend,
      input.pushStatus,
      input.pushLocalCertificateAuthorityStatus,
      input.pushSettingsErrorMessage,
      input.pushTestResult,
      input.pushClientState,
      input.refreshPushSettingsDiagnostics,
      input.sendPushTestNotificationFromSettings,
      input.settingsWorkspaceSection,
      input.setSettingsWorkspaceSection,
      input.setDebugIssueFilterQuery,
      input.setDebugIssueSeverityFilter,
      input.setDebugWorkspaceSection,
      input.setSelectedDebugIssueId,
      input.setSelectedHistoryId,
      input.setTraceLabel,
      input.setTraceNote,
      input.setWaitForReplayResponse,
      input.startTraceFromDebugPanel,
      input.stopTraceFromDebugPanel,
      input.streamEventCards,
      input.streamEventCount,
      input.theme,
      input.traceLabel,
      input.traceNote,
      input.toggleTheme,
      input.waitForReplayResponse,
    ],
  );

  const apiSessionBootstrapOverlayProperties = useMemo<ApiSessionBootstrapOverlayProperties>(
    () => buildApiSessionBootstrapOverlayProperties(input),
    [
      input.apiSessionBootstrapError,
      input.apiSessionTokenDraft,
      input.isApiSessionBootstrapPending,
      input.setApiSessionBootstrapError,
      input.setApiSessionTokenDraft,
      input.submitApiSessionToken,
    ],
  );

  return useMemo<ApplicationShellViewProperties>(
    () => ({
      threadSidebarHealthState,
      threadSidebarRuntimeSummary: input.threadSidebarRuntimeSummary,
      applicationHeaderBarProperties,
      debugStatusBannersProperties,
      chatWorkspacePaneProperties,
      settingsWorkspacePaneProperties,
      apiSessionBootstrapOverlayProperties,
    }),
    [
      threadSidebarHealthState,
      input.threadSidebarRuntimeSummary,
      applicationHeaderBarProperties,
      debugStatusBannersProperties,
      chatWorkspacePaneProperties,
      settingsWorkspacePaneProperties,
      apiSessionBootstrapOverlayProperties,
    ],
  );
}
