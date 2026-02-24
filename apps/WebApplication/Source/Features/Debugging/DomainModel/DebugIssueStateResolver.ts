import {
  buildDebugErrorIssue,
  buildDebugWarningIssuesFromHistory,
  sortDebugIssuesByTimeDesc,
  type DebugErrorLike,
  type DebugHistoryEntryLike,
  type DebugIssue
} from "@/SharedUtilities/DebugHelpers";

export type DebugIssueSeverityFilter = "all" | "error" | "warning";

export interface ReadCombinedDebugIssuesInput {
  debugErrorIssues: DebugIssue[];
  debugWarningIssues: DebugIssue[];
}

export interface ReadFilteredDebugIssuesInput {
  debugIssues: DebugIssue[];
  severityFilter: DebugIssueSeverityFilter;
  filterQuery: string;
}

export interface ReadSelectedDebugIssueInput {
  debugIssues: DebugIssue[];
  selectedIssueIdentifier: string;
}

export class DebugIssueStateResolver {
  public readDebugErrorIssues(debugErrors: DebugErrorLike[]): DebugIssue[] {
    const debugErrorIssues = debugErrors.map(buildDebugErrorIssue);
    debugErrorIssues.sort(sortDebugIssuesByTimeDesc);
    return debugErrorIssues;
  }

  public readDebugWarningIssues(historyEntries: DebugHistoryEntryLike[]): DebugIssue[] {
    return buildDebugWarningIssuesFromHistory(historyEntries);
  }

  public readCombinedDebugIssues(input: ReadCombinedDebugIssuesInput): DebugIssue[] {
    const debugIssues: DebugIssue[] = [
      ...input.debugErrorIssues,
      ...input.debugWarningIssues
    ];
    debugIssues.sort(sortDebugIssuesByTimeDesc);
    return debugIssues;
  }

  public readFilteredDebugIssues(input: ReadFilteredDebugIssuesInput): DebugIssue[] {
    const normalizedQuery = input.filterQuery.trim().toLowerCase();
    return input.debugIssues.filter((issue) => {
      if (input.severityFilter !== "all" && issue.severity !== input.severityFilter) {
        return false;
      }
      if (normalizedQuery.length === 0) {
        return true;
      }
      return issue.searchText.includes(normalizedQuery);
    });
  }

  public readSelectedDebugIssue(input: ReadSelectedDebugIssueInput): DebugIssue | null {
    if (input.debugIssues.length === 0) {
      return null;
    }
    return input.debugIssues.find((issue) => issue.id === input.selectedIssueIdentifier) ?? null;
  }

  public readNextSelectedDebugIssueIdentifier(input: ReadSelectedDebugIssueInput): string {
    if (input.debugIssues.length === 0) {
      return "";
    }
    const hasSelectedIssue = input.debugIssues.some(
      (issue) => issue.id === input.selectedIssueIdentifier
    );
    if (hasSelectedIssue) {
      return input.selectedIssueIdentifier;
    }
    return input.debugIssues[0]?.id ?? "";
  }
}
