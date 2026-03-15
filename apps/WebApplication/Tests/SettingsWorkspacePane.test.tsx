import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type DebugIssue } from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import { type DebugWorkspacePaneProps } from "@/Features/Debugging/UserInterface/DebugWorkspacePane";
import { type PushNotificationsSettingsPaneProps } from "@/Features/PushNotifications/UserInterface/PushNotificationsSettingsPane";
import { SettingsWorkspacePane } from "@/Features/Settings/UserInterface/SettingsWorkspacePane";

const exampleDebugIssue: DebugIssue = {
  id: "error:debug-issue-1",
  kind: "debug-error",
  severity: "error",
  occurredAt: "2025-01-01T00:00:00.000Z",
  message: "Example debug error",
  sourceLabel: "Server (send-message)",
  threadId: "thread-1",
  requestId: "request-1",
  actionId: "action-1",
  actionName: "send-message",
  searchText: "example debug error",
  errorId: "debug-issue-1",
  origin: "server",
  source: "farfield-server",
  operation: "send-message",
  name: "ExampleError",
  stack: null,
  detailsText: "{}",
};

const baseDebugWorkspacePaneProperties: DebugWorkspacePaneProps = {
  debugWorkspaceSection: "issues",
  onDebugWorkspaceSectionChange: () => {},
  debugErrorIssueCount: 2,
  debugWarningIssueCount: 1,
  runtimeRequestErrorOperationMetrics: [],
  filteredDebugIssues: [exampleDebugIssue],
  selectedDebugIssue: exampleDebugIssue,
  selectedDebugIssueId: exampleDebugIssue.id,
  debugIssueSeverityFilter: "all",
  debugIssueFilterQuery: "",
  debugErrorSessionId: "",
  debugErrorSessionLogPath: "",
  onSelectDebugIssue: () => {},
  onDebugIssueSeverityFilterChange: () => {},
  onDebugIssueFilterQueryChange: () => {},
  onClearDebugIssues: () => {},
  debugHistoryEntryListItems: [],
  selectedHistoryId: "",
  selectedHistoryDetailId: null,
  historyDetailPayloadText: "",
  waitForReplayResponse: false,
  onSelectHistoryEntry: () => {},
  onWaitForReplayResponseChange: () => {},
  onReplayHistoryEntry: () => {},
  streamEventCount: 0,
  streamEventCards: [],
  isTraceRecording: false,
  traceLabel: "",
  traceNote: "",
  onTraceLabelChange: () => {},
  onTraceNoteChange: () => {},
  onStartTrace: () => {},
  onMarkTrace: () => {},
  onStopTrace: () => {},
  recentTraceSummaries: [],
  isLoadingCoverageDiagnostics: false,
  isRunningCoverageAction: false,
  coverageDiagnosticsErrorMessage: "",
  coverageActionErrorMessage: "",
  coverageDiagnosticsSnapshot: null,
  pendingAccountLogin: null,
  lastCommandExecutionResult: null,
  lastConfigBatchWriteResult: null,
  lastConfigValueWriteResult: null,
  lastExternalAgentConfigDetectResult: null,
  lastExternalAgentConfigImportResult: null,
  lastThreadRealtimeStartResult: null,
  lastThreadRealtimeAppendAudioResult: null,
  lastThreadRealtimeAppendTextResult: null,
  lastThreadRealtimeStopResult: null,
  lastThreadStreamEventsResult: null,
  lastAccountAndAppNotificationsResult: null,
  lastNotificationEventsResult: null,
  lastAuthCompletionEventsResult: null,
  lastPendingServerRequestsResult: null,
  lastServerRequestResolvedEventsResult: null,
  lastWindowsSandboxSetupStartResult: null,
  lastFeedbackUploadResult: null,
  lastErrorNotificationsResult: null,
  lastFuzzyFileSearchResult: null,
  lastFuzzyFileSearchSessionStartResult: null,
  lastFuzzyFileSearchSessionUpdateResult: null,
  lastFuzzyFileSearchSessionStopResult: null,
  lastFuzzySessionNotificationsResult: null,
  lastModelReroutedEventsResult: null,
  lastWarningNotificationsResult: null,
  lastThreadLifecycleNotificationsResult: null,
  lastThreadProgressNotificationsResult: null,
  lastThreadRealtimeNotificationsResult: null,
  lastTurnLifecycleNotificationsResult: null,
  lastItemDeltaNotificationsResult: null,
  lastItemLifecycleNotificationsResult: null,
  lastGitDiffToRemoteResult: null,
  onRefreshCoverageDiagnostics: () => {},
  onStartAccountLogin: () => {},
  onCancelAccountLogin: () => {},
  onLogoutAccount: () => {},
  onReloadMcpServerConfig: () => {},
  onStartMcpServerOauthLogin: () => {},
  onWriteConfigValue: () => {},
  onWriteConfigBatch: () => {},
  onWriteSkillsConfig: () => {},
  onExportRemoteSkill: () => {},
  onDetectExternalAgentConfig: () => {},
  onImportExternalAgentConfig: () => {},
  onStartThreadRealtime: () => {},
  onAppendThreadRealtimeAudio: () => {},
  onAppendThreadRealtimeText: () => {},
  onStopThreadRealtime: () => {},
  onReadThreadStreamEvents: () => {},
  onReadAccountAndAppNotifications: () => {},
  onReadNotificationEvents: () => {},
  onReadAuthCompletionEvents: () => {},
  onReadPendingServerRequests: () => {},
  onReadServerRequestResolvedEvents: () => {},
  onStartWindowsSandboxSetup: () => {},
  onReadGitDiffToRemote: () => {},
  onSearchFuzzyFiles: () => {},
  onStartFuzzyFileSearchSession: () => {},
  onUpdateFuzzyFileSearchSession: () => {},
  onStopFuzzyFileSearchSession: () => {},
  onReadFuzzySessionNotifications: () => {},
  onReadModelReroutedEvents: () => {},
  onReadWarningNotifications: () => {},
  onReadThreadLifecycleNotifications: () => {},
  onReadThreadProgressNotifications: () => {},
  onReadThreadRealtimeNotifications: () => {},
  onReadTurnLifecycleNotifications: () => {},
  onReadItemDeltaNotifications: () => {},
  onReadItemLifecycleNotifications: () => {},
  onReadErrorNotifications: () => {},
  onExecuteCommand: () => {},
  onUploadFeedback: () => {},
};

const basePushNotificationsSettingsPaneProperties: PushNotificationsSettingsPaneProps = {
  pushClientState: {
    supported: true,
    serviceWorkerRegistered: true,
    permission: "granted",
    subscribed: false,
  },
  pushStatus: null,
  latestPushReceipt: null,
  latestPushSend: null,
  pushLocalCertificateAuthorityStatus: null,
  pushSettingsErrorMessage: "",
  pushTestResult: null,
  isRefreshingPushSettings: false,
  isEnablingPushNotifications: false,
  isSendingPushTestNotification: false,
  canSendPushTestNotification: false,
  selectedThreadId: null,
  latestTurnId: null,
  onRefreshPushSettings: () => {},
  onEnablePushNotifications: () => {},
  onSendPushTestNotification: () => {},
};

function renderSettingsWorkspacePane(input?: {
  isBusy?: boolean;
  theme?: string;
  onRefreshData?: () => void;
  onToggleTheme?: () => void;
}): void {
  cleanup();
  render(
    <SettingsWorkspacePane
      settingsWorkspaceSection="notifications"
      onSettingsWorkspaceSectionChange={() => {}}
      theme={input?.theme ?? "light"}
      isBusy={input?.isBusy ?? false}
      onRefreshData={input?.onRefreshData ?? (() => {})}
      onToggleTheme={input?.onToggleTheme ?? (() => {})}
      debugWorkspacePaneProperties={baseDebugWorkspacePaneProperties}
      pushNotificationsSettingsPaneProperties={basePushNotificationsSettingsPaneProperties}
    />,
  );
}

describe("SettingsWorkspacePane", () => {
  it("renders refresh and theme controls with descriptive labels", () => {
    renderSettingsWorkspacePane();

    expect(screen.getByText("Refresh app data")).toBeDefined();
    expect(
      screen.getByText(
        "Reload thread list, selected thread details, and runtime summaries from app-server.",
      ),
    ).toBeDefined();
    expect(screen.getByText("Appearance theme")).toBeDefined();
    expect(
      screen.getByText("Switch Farfield between light and dark display themes."),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Refresh now" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Use dark theme" })).toBeDefined();
  });

  it("disables refresh control while refresh is in progress", () => {
    const onRefreshData = vi.fn();
    renderSettingsWorkspacePane({ isBusy: true, onRefreshData });

    const refreshButton = screen.getByTestId("refresh-button");
    expect(refreshButton.getAttribute("disabled")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Refreshing data" })).toBeDefined();

    fireEvent.click(refreshButton);
    expect(onRefreshData).not.toHaveBeenCalled();
  });

  it("wires refresh and theme controls to their callbacks", () => {
    const onRefreshData = vi.fn();
    const onToggleTheme = vi.fn();
    renderSettingsWorkspacePane({ onRefreshData, onToggleTheme, theme: "dark" });

    fireEvent.click(screen.getByTestId("refresh-button"));
    fireEvent.click(screen.getByTestId("settings-theme-toggle-button"));

    expect(onRefreshData).toHaveBeenCalledTimes(1);
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Use light theme" })).toBeDefined();
  });
});
