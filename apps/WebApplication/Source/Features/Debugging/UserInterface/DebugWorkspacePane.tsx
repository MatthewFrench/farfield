import { Bug } from "lucide-react";
import {
  type DebugIssueSeverityFilter
} from "@/Features/Debugging/DomainModel/DebugIssueStateResolver";
import { type DebugIssue } from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import {
  DebugWorkspaceSectionSchema,
  type DebugWorkspaceSection
} from "@/Features/Debugging/DomainModel/DebugWorkspaceSectionContracts";
import { Tabs } from "@/Components/UserInterface/Tabs";
import { TabsList } from "@/Components/UserInterface/TabsList";
import { TabsTrigger } from "@/Components/UserInterface/TabsTrigger";
import {
  DebugHistoryPanel,
  type DebugHistoryEntryListItem
} from "./DebugHistoryPanel";
import { type ReplayHistoryEntryRequestInput } from "./DebugHistoryDetailPanel";
import { DebugIssuesPanel } from "./DebugIssuesPanel";
import { DebugStreamEventsPanel } from "./DebugStreamEventsPanel";
import { DebugTracePanel, type DebugTraceSummary } from "./DebugTracePanel";

export interface DebugWorkspacePaneProps {
  debugWorkspaceSection: DebugWorkspaceSection;
  onDebugWorkspaceSectionChange: (nextSection: DebugWorkspaceSection) => void;
  debugErrorIssueCount: number;
  debugWarningIssueCount: number;
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
}

export function DebugWorkspacePane({
  debugWorkspaceSection,
  onDebugWorkspaceSectionChange,
  debugErrorIssueCount,
  debugWarningIssueCount,
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
  recentTraceSummaries
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
          const parsedSection = DebugWorkspaceSectionSchema.safeParse(value);
          if (parsedSection.success) {
            onDebugWorkspaceSectionChange(parsedSection.data);
          }
        }}
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        <div className="shrink-0 px-4 py-2 border-b border-border">
          <TabsList className="h-8">
            <TabsTrigger value="issues" className="text-xs h-7 px-2.5">Issues</TabsTrigger>
            <TabsTrigger value="history" className="text-xs h-7 px-2.5">History</TabsTrigger>
            <TabsTrigger value="stream" className="text-xs h-7 px-2.5">Stream</TabsTrigger>
            <TabsTrigger value="trace" className="text-xs h-7 px-2.5">Trace</TabsTrigger>
          </TabsList>
        </div>

        {debugWorkspaceSection === "issues" && (
          <DebugIssuesPanel
            issues={filteredDebugIssues}
            selectedIssue={selectedDebugIssue}
            selectedIssueId={selectedDebugIssueId}
            severityFilter={debugIssueSeverityFilter}
            filterQuery={debugIssueFilterQuery}
            debugErrorSessionId={debugErrorSessionId}
            debugErrorSessionLogPath={debugErrorSessionLogPath}
            onIssueSelect={onSelectDebugIssue}
            onSeverityFilterChange={onDebugIssueSeverityFilterChange}
            onFilterQueryChange={onDebugIssueFilterQueryChange}
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
      </Tabs>
    </div>
  );
}
