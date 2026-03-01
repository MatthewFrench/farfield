import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type DebugIssue } from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import {
  DebugWorkspacePane,
  type DebugWorkspacePaneProps,
} from "@/Features/Debugging/UserInterface/DebugWorkspacePane";

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
  debugHistoryEntryListItems: [
    {
      id: "history-1",
      at: "2025-01-01T00:00:01.000Z",
      source: "ipc",
      direction: "in",
    },
  ],
  selectedHistoryId: "history-1",
  selectedHistoryDetailId: "history-1",
  historyDetailPayloadText: "{}",
  waitForReplayResponse: false,
  onSelectHistoryEntry: () => {},
  onWaitForReplayResponseChange: () => {},
  onReplayHistoryEntry: () => {},
  streamEventCount: 1,
  streamEventCards: [<div key="stream-card">stream event</div>],
  isTraceRecording: false,
  traceLabel: "capture",
  traceNote: "",
  onTraceLabelChange: () => {},
  onTraceNoteChange: () => {},
  onStartTrace: () => {},
  onMarkTrace: () => {},
  onStopTrace: () => {},
  recentTraceSummaries: [
    {
      id: "trace-1",
      label: "capture",
      eventCount: 3,
      path: "/tmp/trace-1.ndjson",
    },
  ],
  isLoadingCoverageDiagnostics: false,
  isRunningCoverageAction: false,
  coverageDiagnosticsErrorMessage: "",
  coverageActionErrorMessage: "",
  coverageDiagnosticsSnapshot: null,
  pendingAccountLogin: null,
  lastCommandExecutionResult: null,
  lastConfigBatchWriteResult: null,
  lastConfigValueWriteResult: null,
  lastFeedbackUploadResult: null,
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
  onReadGitDiffToRemote: () => {},
  onExecuteCommand: () => {},
  onUploadFeedback: () => {},
};

function renderDebugWorkspacePane(properties: DebugWorkspacePaneProps): void {
  cleanup();
  render(<DebugWorkspacePane {...properties} />);
}

describe("DebugWorkspacePane", () => {
  it("renders debug issue and warning summary counts", () => {
    renderDebugWorkspacePane(baseDebugWorkspacePaneProperties);

    expect(screen.getByText("2 errors")).toBeDefined();
    expect(screen.getByText("1 warnings")).toBeDefined();
  });

  it("renders history panel when history section is active", () => {
    renderDebugWorkspacePane({
      ...baseDebugWorkspacePaneProperties,
      debugWorkspaceSection: "history",
    });

    expect(screen.getByTestId("debug-history-panel")).toBeDefined();
    expect(screen.queryByTestId("debug-issues-panel")).toBeNull();
  });

  it("renders the active workspace section panel", () => {
    renderDebugWorkspacePane({
      ...baseDebugWorkspacePaneProperties,
      debugWorkspaceSection: "trace",
    });

    expect(screen.getByTestId("debug-trace-panel")).toBeDefined();
    expect(screen.queryByTestId("debug-issues-panel")).toBeNull();
  });

  it("marks the active section tab from the workspace section prop", () => {
    cleanup();
    const { rerender } = render(<DebugWorkspacePane {...baseDebugWorkspacePaneProperties} />);

    expect(screen.getByRole("tab", { name: "Issues" }).getAttribute("data-state")).toBe("active");

    rerender(
      <DebugWorkspacePane {...baseDebugWorkspacePaneProperties} debugWorkspaceSection="stream" />,
    );

    expect(screen.getByRole("tab", { name: "Stream" }).getAttribute("data-state")).toBe("active");
    expect(screen.getByRole("tab", { name: "Issues" }).getAttribute("data-state")).toBe("inactive");
  });

  it("renders coverage panel when coverage section is active", () => {
    renderDebugWorkspacePane({
      ...baseDebugWorkspacePaneProperties,
      debugWorkspaceSection: "coverage",
      coverageDiagnosticsSnapshot: {
        requirements: null,
        account: null,
        requiresOpenaiAuth: false,
        authStatus: null,
        accountRateLimits: null,
        userInfo: null,
        experimentalFeatures: [],
        mcpServers: [],
        apps: [],
        skills: [],
        remoteSkills: [],
        refreshedAtIso8601: "2026-02-28T20:00:00.000Z",
      },
    });

    expect(screen.getByTestId("debug-coverage-panel")).toBeDefined();
    expect(screen.getByTestId("debug-coverage-feedback-upload-run")).toBeDefined();
  });
});
