import { Bug } from "lucide-react";
import { Tabs } from "@/Components/UserInterface/Tabs";
import { TabsList } from "@/Components/UserInterface/TabsList";
import { TabsTrigger } from "@/Components/UserInterface/TabsTrigger";
import {
  type DebugAppServerCoverageCommandExecutionResult,
  type DebugAppServerCoverageConfigBatchWriteResult,
  type DebugAppServerCoverageConfigValueWriteResult,
  type DebugAppServerCoverageExternalAgentConfigDetectResult,
  type DebugAppServerCoverageExternalAgentConfigImportResult,
  type DebugAppServerCoverageExternalAgentConfigMigrationItem,
  type DebugAppServerCoverageFeedbackUploadResult,
  type DebugAppServerCoverageFuzzyFileSearchResult,
  type DebugAppServerCoverageGitDiffToRemoteResult,
  type DebugAppServerCoveragePendingAccountLogin,
  type DebugAppServerCoverageSnapshot,
  type DebugAppServerCoverageThreadRealtimeAppendAudioResult,
  type DebugAppServerCoverageThreadRealtimeAppendTextResult,
  type DebugAppServerCoverageThreadRealtimeAudioChunk,
  type DebugAppServerCoverageThreadRealtimeStartResult,
  type DebugAppServerCoverageThreadRealtimeStopResult,
  type DebugAppServerCoverageWindowsSandboxSetupMode,
  type DebugAppServerCoverageWindowsSandboxSetupStartResult,
} from "@/Features/Debugging/DomainModel/DebugAppServerCoverageContracts";
import {
  type DebugIssue,
  type RuntimeRequestErrorOperationMetric,
} from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import { type DebugIssueSeverityFilter } from "@/Features/Debugging/DomainModel/DebugIssueStateResolver";
import {
  type DebugWorkspaceSection,
  parseDebugWorkspaceSection,
} from "@/Features/Debugging/DomainModel/DebugWorkspaceSectionContracts";
import { DebugAppServerCoveragePanel } from "./DebugAppServerCoveragePanel";
import { type ReplayHistoryEntryRequestInput } from "./DebugHistoryDetailPanel";
import { type DebugHistoryEntryListItem, DebugHistoryPanel } from "./DebugHistoryPanel";
import { DebugIssuesPanel } from "./DebugIssuesPanel";
import { DebugStreamEventsPanel } from "./DebugStreamEventsPanel";
import { DebugTracePanel, type DebugTraceSummary } from "./DebugTracePanel";

export interface DebugWorkspacePaneProps {
  debugWorkspaceSection: DebugWorkspaceSection;
  onDebugWorkspaceSectionChange: (nextSection: DebugWorkspaceSection) => void;
  debugErrorIssueCount: number;
  debugWarningIssueCount: number;
  runtimeRequestErrorOperationMetrics: readonly RuntimeRequestErrorOperationMetric[];
  filteredDebugIssues: readonly DebugIssue[];
  selectedDebugIssue: DebugIssue | null;
  selectedDebugIssueId: string;
  debugIssueSeverityFilter: DebugIssueSeverityFilter;
  debugIssueFilterQuery: string;
  debugErrorSessionId: string;
  debugErrorSessionLogPath: string;
  onSelectDebugIssue: (issueId: string) => void;
  onDebugIssueSeverityFilterChange: (severityFilter: DebugIssueSeverityFilter) => void;
  onDebugIssueFilterQueryChange: (filterQuery: string) => void;
  onClearDebugIssues: () => void;
  debugHistoryEntryListItems: readonly DebugHistoryEntryListItem[];
  selectedHistoryId: string;
  selectedHistoryDetailId: string | null;
  historyDetailPayloadText: string;
  waitForReplayResponse: boolean;
  onSelectHistoryEntry: (historyEntryId: string) => void;
  onWaitForReplayResponseChange: (enabled: boolean) => void;
  onReplayHistoryEntry: (input: ReplayHistoryEntryRequestInput) => void;
  streamEventCount: number;
  streamEventCards: readonly React.JSX.Element[];
  isTraceRecording: boolean;
  traceLabel: string;
  traceNote: string;
  onTraceLabelChange: (value: string) => void;
  onTraceNoteChange: (value: string) => void;
  onStartTrace: () => void;
  onMarkTrace: () => void;
  onStopTrace: () => void;
  recentTraceSummaries: readonly DebugTraceSummary[];
  isLoadingCoverageDiagnostics: boolean;
  isRunningCoverageAction: boolean;
  coverageDiagnosticsErrorMessage: string;
  coverageActionErrorMessage: string;
  coverageDiagnosticsSnapshot: DebugAppServerCoverageSnapshot | null;
  pendingAccountLogin: DebugAppServerCoveragePendingAccountLogin | null;
  lastCommandExecutionResult: DebugAppServerCoverageCommandExecutionResult | null;
  lastConfigBatchWriteResult: DebugAppServerCoverageConfigBatchWriteResult | null;
  lastConfigValueWriteResult: DebugAppServerCoverageConfigValueWriteResult | null;
  lastExternalAgentConfigDetectResult: DebugAppServerCoverageExternalAgentConfigDetectResult | null;
  lastExternalAgentConfigImportResult: DebugAppServerCoverageExternalAgentConfigImportResult | null;
  lastThreadRealtimeStartResult: DebugAppServerCoverageThreadRealtimeStartResult | null;
  lastThreadRealtimeAppendAudioResult: DebugAppServerCoverageThreadRealtimeAppendAudioResult | null;
  lastThreadRealtimeAppendTextResult: DebugAppServerCoverageThreadRealtimeAppendTextResult | null;
  lastThreadRealtimeStopResult: DebugAppServerCoverageThreadRealtimeStopResult | null;
  lastWindowsSandboxSetupStartResult: DebugAppServerCoverageWindowsSandboxSetupStartResult | null;
  lastFeedbackUploadResult: DebugAppServerCoverageFeedbackUploadResult | null;
  lastFuzzyFileSearchResult: DebugAppServerCoverageFuzzyFileSearchResult | null;
  lastGitDiffToRemoteResult: DebugAppServerCoverageGitDiffToRemoteResult | null;
  onRefreshCoverageDiagnostics: () => void;
  onStartAccountLogin: () => void;
  onCancelAccountLogin: () => void;
  onLogoutAccount: () => void;
  onReloadMcpServerConfig: () => void;
  onStartMcpServerOauthLogin: (serverName: string) => void;
  onWriteConfigValue: (
    keyPath: string,
    value: string,
    mergeStrategy: "replace" | "upsert",
    filePath?: string,
    expectedVersion?: string,
  ) => void;
  onWriteConfigBatch: (edits: string, filePath?: string, expectedVersion?: string) => void;
  onWriteSkillsConfig: (skillPath: string, enabled: boolean) => void;
  onExportRemoteSkill: (hazelnutId: string) => void;
  onDetectExternalAgentConfig: (includeHome: boolean, cwds: string[]) => void;
  onImportExternalAgentConfig: (
    migrationItems: DebugAppServerCoverageExternalAgentConfigMigrationItem[],
  ) => void;
  onStartThreadRealtime: (threadId: string, prompt: string, sessionId?: string) => void;
  onAppendThreadRealtimeAudio: (
    threadId: string,
    audio: DebugAppServerCoverageThreadRealtimeAudioChunk,
  ) => void;
  onAppendThreadRealtimeText: (threadId: string, text: string) => void;
  onStopThreadRealtime: (threadId: string) => void;
  onStartWindowsSandboxSetup: (mode: DebugAppServerCoverageWindowsSandboxSetupMode) => void;
  onReadGitDiffToRemote: (cwd: string) => void;
  onSearchFuzzyFiles: (query: string, roots: string[], cancellationToken?: string) => void;
  onExecuteCommand: (command: string[], timeoutMs?: number, cwd?: string) => void;
  onUploadFeedback: (
    classification: string,
    includeLogs: boolean,
    reason?: string,
    threadId?: string,
  ) => void;
}

export function DebugWorkspacePane({
  debugWorkspaceSection,
  onDebugWorkspaceSectionChange,
  debugErrorIssueCount,
  debugWarningIssueCount,
  runtimeRequestErrorOperationMetrics,
  filteredDebugIssues,
  selectedDebugIssue,
  selectedDebugIssueId,
  debugIssueSeverityFilter,
  debugIssueFilterQuery,
  debugErrorSessionId,
  debugErrorSessionLogPath,
  onSelectDebugIssue,
  onDebugIssueSeverityFilterChange,
  onDebugIssueFilterQueryChange,
  onClearDebugIssues,
  debugHistoryEntryListItems,
  selectedHistoryId,
  selectedHistoryDetailId,
  historyDetailPayloadText,
  waitForReplayResponse,
  onSelectHistoryEntry,
  onWaitForReplayResponseChange,
  onReplayHistoryEntry,
  streamEventCount,
  streamEventCards,
  isTraceRecording,
  traceLabel,
  traceNote,
  onTraceLabelChange,
  onTraceNoteChange,
  onStartTrace,
  onMarkTrace,
  onStopTrace,
  recentTraceSummaries,
  isLoadingCoverageDiagnostics,
  isRunningCoverageAction,
  coverageDiagnosticsErrorMessage,
  coverageActionErrorMessage,
  coverageDiagnosticsSnapshot,
  pendingAccountLogin,
  lastCommandExecutionResult,
  lastConfigBatchWriteResult,
  lastConfigValueWriteResult,
  lastExternalAgentConfigDetectResult,
  lastExternalAgentConfigImportResult,
  lastThreadRealtimeStartResult,
  lastThreadRealtimeAppendAudioResult,
  lastThreadRealtimeAppendTextResult,
  lastThreadRealtimeStopResult,
  lastWindowsSandboxSetupStartResult,
  lastFeedbackUploadResult,
  lastFuzzyFileSearchResult,
  lastGitDiffToRemoteResult,
  onRefreshCoverageDiagnostics,
  onStartAccountLogin,
  onCancelAccountLogin,
  onLogoutAccount,
  onReloadMcpServerConfig,
  onStartMcpServerOauthLogin,
  onWriteConfigValue,
  onWriteConfigBatch,
  onWriteSkillsConfig,
  onExportRemoteSkill,
  onDetectExternalAgentConfig,
  onImportExternalAgentConfig,
  onStartThreadRealtime,
  onAppendThreadRealtimeAudio,
  onAppendThreadRealtimeText,
  onStopThreadRealtime,
  onStartWindowsSandboxSetup,
  onReadGitDiffToRemote,
  onSearchFuzzyFiles,
  onExecuteCommand,
  onUploadFeedback,
}: DebugWorkspacePaneProps): React.JSX.Element {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Bug size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">Debug Workspace</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{debugErrorIssueCount} errors</span>
          <span>{debugWarningIssueCount} warnings</span>
        </div>
      </div>

      <Tabs
        value={debugWorkspaceSection}
        onValueChange={(value) => {
          onDebugWorkspaceSectionChange(parseDebugWorkspaceSection(value));
        }}
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        <div className="shrink-0 px-4 py-2 border-b border-border">
          <TabsList className="h-8">
            <TabsTrigger value="issues" className="text-xs h-7 px-2.5">
              Issues
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs h-7 px-2.5">
              History
            </TabsTrigger>
            <TabsTrigger value="stream" className="text-xs h-7 px-2.5">
              Stream
            </TabsTrigger>
            <TabsTrigger value="trace" className="text-xs h-7 px-2.5">
              Trace
            </TabsTrigger>
            <TabsTrigger value="coverage" className="text-xs h-7 px-2.5">
              Coverage
            </TabsTrigger>
          </TabsList>
        </div>

        {debugWorkspaceSection === "issues" && (
          <DebugIssuesPanel
            issues={filteredDebugIssues}
            selectedIssue={selectedDebugIssue}
            selectedIssueId={selectedDebugIssueId}
            runtimeRequestErrorOperationMetrics={runtimeRequestErrorOperationMetrics}
            severityFilter={debugIssueSeverityFilter}
            filterQuery={debugIssueFilterQuery}
            debugErrorSessionId={debugErrorSessionId}
            debugErrorSessionLogPath={debugErrorSessionLogPath}
            onIssueSelect={onSelectDebugIssue}
            onSeverityFilterChange={onDebugIssueSeverityFilterChange}
            onFilterQueryChange={onDebugIssueFilterQueryChange}
            onClearIssues={onClearDebugIssues}
          />
        )}

        {debugWorkspaceSection === "history" && (
          <DebugHistoryPanel
            historyEntries={debugHistoryEntryListItems}
            selectedHistoryEntryId={selectedHistoryId}
            selectedHistoryDetailEntryId={selectedHistoryDetailId}
            selectedHistoryDetailPayloadText={historyDetailPayloadText}
            waitForReplayResponse={waitForReplayResponse}
            onHistoryEntrySelect={onSelectHistoryEntry}
            onWaitForReplayResponseChange={onWaitForReplayResponseChange}
            onReplayHistoryEntry={onReplayHistoryEntry}
          />
        )}

        {debugWorkspaceSection === "stream" && (
          <DebugStreamEventsPanel
            streamEventCount={streamEventCount}
            streamEventCards={streamEventCards}
          />
        )}

        {debugWorkspaceSection === "trace" && (
          <DebugTracePanel
            isRecording={isTraceRecording}
            traceLabel={traceLabel}
            traceNote={traceNote}
            onTraceLabelChange={onTraceLabelChange}
            onTraceNoteChange={onTraceNoteChange}
            onStartTrace={onStartTrace}
            onMarkTrace={onMarkTrace}
            onStopTrace={onStopTrace}
            recentTraces={recentTraceSummaries}
          />
        )}

        {debugWorkspaceSection === "coverage" && (
          <DebugAppServerCoveragePanel
            isLoadingCoverageDiagnostics={isLoadingCoverageDiagnostics}
            isRunningCoverageAction={isRunningCoverageAction}
            coverageDiagnosticsErrorMessage={coverageDiagnosticsErrorMessage}
            coverageActionErrorMessage={coverageActionErrorMessage}
            coverageDiagnosticsSnapshot={coverageDiagnosticsSnapshot}
            pendingAccountLogin={pendingAccountLogin}
            lastCommandExecutionResult={lastCommandExecutionResult}
            lastConfigBatchWriteResult={lastConfigBatchWriteResult}
            lastConfigValueWriteResult={lastConfigValueWriteResult}
            lastExternalAgentConfigDetectResult={lastExternalAgentConfigDetectResult}
            lastExternalAgentConfigImportResult={lastExternalAgentConfigImportResult}
            lastThreadRealtimeStartResult={lastThreadRealtimeStartResult}
            lastThreadRealtimeAppendAudioResult={lastThreadRealtimeAppendAudioResult}
            lastThreadRealtimeAppendTextResult={lastThreadRealtimeAppendTextResult}
            lastThreadRealtimeStopResult={lastThreadRealtimeStopResult}
            lastWindowsSandboxSetupStartResult={lastWindowsSandboxSetupStartResult}
            lastFeedbackUploadResult={lastFeedbackUploadResult}
            lastFuzzyFileSearchResult={lastFuzzyFileSearchResult}
            lastGitDiffToRemoteResult={lastGitDiffToRemoteResult}
            onRefreshCoverageDiagnostics={onRefreshCoverageDiagnostics}
            onStartAccountLogin={onStartAccountLogin}
            onCancelAccountLogin={onCancelAccountLogin}
            onLogoutAccount={onLogoutAccount}
            onReloadMcpServerConfig={onReloadMcpServerConfig}
            onStartMcpServerOauthLogin={onStartMcpServerOauthLogin}
            onWriteConfigValue={onWriteConfigValue}
            onWriteConfigBatch={onWriteConfigBatch}
            onWriteSkillsConfig={onWriteSkillsConfig}
            onExportRemoteSkill={onExportRemoteSkill}
            onDetectExternalAgentConfig={onDetectExternalAgentConfig}
            onImportExternalAgentConfig={onImportExternalAgentConfig}
            onStartThreadRealtime={onStartThreadRealtime}
            onAppendThreadRealtimeAudio={onAppendThreadRealtimeAudio}
            onAppendThreadRealtimeText={onAppendThreadRealtimeText}
            onStopThreadRealtime={onStopThreadRealtime}
            onStartWindowsSandboxSetup={onStartWindowsSandboxSetup}
            onReadGitDiffToRemote={onReadGitDiffToRemote}
            onSearchFuzzyFiles={onSearchFuzzyFiles}
            onExecuteCommand={onExecuteCommand}
            onUploadFeedback={onUploadFeedback}
          />
        )}
      </Tabs>
    </div>
  );
}
