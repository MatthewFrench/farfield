import { AlertTriangle } from "lucide-react";
import {
  DEBUG_ISSUE_SEVERITY_FILTER_ALL,
  DEBUG_ISSUE_SEVERITY_FILTER_ERROR,
  DEBUG_ISSUE_SEVERITY_FILTER_WARNING,
  type DebugIssueSeverityFilter
} from "@/Features/Debugging/DomainModel/DebugIssueStateResolver";
import { type DebugIssue } from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import { Badge } from "@/Components/UserInterface/Badge";
import { Button } from "@/Components/UserInterface/Button";
import { Input } from "@/Components/UserInterface/Input";

const WARNING_BADGE_CLASS_NAME = "border-amber-300 bg-amber-50 text-amber-700";

interface DebugIssueSeverityFilterOption {
  value: DebugIssueSeverityFilter;
  label: string;
}

const DEBUG_ISSUE_SEVERITY_FILTER_OPTIONS: readonly DebugIssueSeverityFilterOption[] = [
  { value: DEBUG_ISSUE_SEVERITY_FILTER_ALL, label: "All" },
  { value: DEBUG_ISSUE_SEVERITY_FILTER_ERROR, label: "Errors" },
  { value: DEBUG_ISSUE_SEVERITY_FILTER_WARNING, label: "Warnings" }
];

interface DebugIssuesPanelProps {
  issues: readonly DebugIssue[];
  selectedIssue: DebugIssue | null;
  selectedIssueId: string;
  severityFilter: DebugIssueSeverityFilter;
  filterQuery: string;
  debugErrorSessionId: string;
  debugErrorSessionLogPath: string;
  onIssueSelect: (issueId: string) => void;
  onSeverityFilterChange: (severityFilter: DebugIssueSeverityFilter) => void;
  onFilterQueryChange: (filterQuery: string) => void;
  onClearIssues: () => void;
}

export function DebugIssuesPanel({
  issues,
  selectedIssue,
  selectedIssueId,
  severityFilter,
  filterQuery,
  debugErrorSessionId,
  debugErrorSessionLogPath,
  onIssueSelect,
  onSeverityFilterChange,
  onFilterQueryChange,
  onClearIssues
}: DebugIssuesPanelProps): React.JSX.Element {
  return (
    <div data-testid="debug-issues-panel" className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[330px_minmax(0,1fr)] divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden">
      <div className="flex flex-col min-h-0 overflow-hidden">
        <div className="shrink-0 p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className="text-muted-foreground" />
              <span className="text-sm font-medium">Issues</span>
              <span className="text-xs text-muted-foreground/70">{issues.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={onClearIssues}
                disabled={issues.length === 0}
              >
                Clear
              </Button>
              {debugErrorSessionLogPath.length > 0 && (
                <a
                  href="/api/debug/client-errors/session-log"
                  className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  session log
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {DEBUG_ISSUE_SEVERITY_FILTER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={severityFilter === option.value ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onSeverityFilterChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <Input
            value={filterQuery}
            onChange={(event) => onFilterQueryChange(event.target.value)}
            placeholder="Filter by action/request/error/thread/message"
            className="h-8 text-xs"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {issues.map((issue) => (
            <Button
              key={issue.id}
              type="button"
              variant="ghost"
              onClick={() => onIssueSelect(issue.id)}
              className={`w-full h-auto rounded-none px-3 py-2.5 justify-start text-left ${
                selectedIssueId === issue.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <div className="w-full space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant={issue.severity === "error" ? "danger" : "default"}
                    className={issue.severity === "warning" ? WARNING_BADGE_CLASS_NAME : ""}
                  >
                    {issue.severity}
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground/70 truncate">
                    {issue.occurredAt}
                  </span>
                </div>
                <div className="text-[11px] font-medium leading-4 line-clamp-2">
                  {issue.message}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground/70 truncate">
                  {issue.sourceLabel}
                </div>
              </div>
            </Button>
          ))}
          {issues.length === 0 && (
            <div className="px-3 py-6 text-xs text-muted-foreground">
              No matching issues.
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col min-h-0 overflow-hidden">
        <div className="shrink-0 p-3 border-b border-border flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Issue Detail</span>
          {debugErrorSessionId.length > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground/70 truncate">
              {debugErrorSessionId}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {!selectedIssue ? (
            <div className="text-xs text-muted-foreground py-4">Select an issue</div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant={selectedIssue.severity === "error" ? "danger" : "default"}
                  className={selectedIssue.severity === "warning" ? WARNING_BADGE_CLASS_NAME : ""}
                >
                  {selectedIssue.severity}
                </Badge>
                <span className="font-mono text-[10px] text-muted-foreground/70">
                  {selectedIssue.occurredAt}
                </span>
              </div>
              <div className="text-sm leading-5">{selectedIssue.message}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                <div><span className="text-muted-foreground">source:</span> {selectedIssue.sourceLabel}</div>
                <div><span className="text-muted-foreground">thread:</span> {selectedIssue.threadId ?? "n/a"}</div>
                <div><span className="text-muted-foreground">request:</span> {selectedIssue.requestId ?? "n/a"}</div>
                <div><span className="text-muted-foreground">action:</span> {selectedIssue.actionId ?? "n/a"}</div>
                <div className="sm:col-span-2"><span className="text-muted-foreground">actionName:</span> {selectedIssue.actionName ?? "n/a"}</div>
              </div>

              {selectedIssue.kind === "debug-error" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <div><span className="text-muted-foreground">errorId:</span> {selectedIssue.errorId}</div>
                    <div><span className="text-muted-foreground">origin:</span> {selectedIssue.origin}</div>
                    <div><span className="text-muted-foreground">operation:</span> {selectedIssue.operation}</div>
                    <div><span className="text-muted-foreground">source:</span> {selectedIssue.source}</div>
                    <div className="sm:col-span-2"><span className="text-muted-foreground">name:</span> {selectedIssue.name ?? "n/a"}</div>
                  </div>
                  {selectedIssue.stack && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">Stack</div>
                      <pre className="font-mono text-[11px] leading-5 whitespace-pre-wrap break-words text-muted-foreground">
                        {selectedIssue.stack}
                      </pre>
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Details</div>
                    <pre className="font-mono text-[11px] leading-5 whitespace-pre-wrap break-words text-muted-foreground">
                      {selectedIssue.detailsText}
                    </pre>
                  </div>
                </>
              )}

              {selectedIssue.kind === "history-warning" && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Payload</div>
                  <pre className="font-mono text-[11px] leading-5 whitespace-pre-wrap break-words text-muted-foreground">
                    {selectedIssue.payloadText}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
