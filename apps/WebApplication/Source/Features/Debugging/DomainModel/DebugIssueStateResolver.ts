import {
  buildDebugErrorIssue,
  buildDebugWarningIssuesFromHistory,
  sortDebugIssuesByTimeDesc
} from "@/Features/Debugging/DomainModel/DebugIssueDerivation";
import {
  type DebugErrorLike,
  type DebugHistoryEntryLike,
  type DebugIssue
} from "@/Features/Debugging/DomainModel/DebugIssueContracts";

export const DEBUG_ISSUE_SEVERITY_FILTER_ALL = "all";
export const DEBUG_ISSUE_SEVERITY_FILTER_ERROR = "error";
export const DEBUG_ISSUE_SEVERITY_FILTER_WARNING = "warning";

const EMPTY_DEBUG_ISSUE_IDENTIFIER = "";

export type DebugIssueSeverityFilter =
  | typeof DEBUG_ISSUE_SEVERITY_FILTER_ALL
  | typeof DEBUG_ISSUE_SEVERITY_FILTER_ERROR
  | typeof DEBUG_ISSUE_SEVERITY_FILTER_WARNING;

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

function normalizeDebugIssueFilterQuery(filterQuery: string): string {
  return filterQuery.trim().toLowerCase();
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
    const normalizedQuery = normalizeDebugIssueFilterQuery(input.filterQuery);
    return input.debugIssues.filter((issue) => {
      if (
        input.severityFilter !== DEBUG_ISSUE_SEVERITY_FILTER_ALL
        && issue.severity !== input.severityFilter
      ) {
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
      return EMPTY_DEBUG_ISSUE_IDENTIFIER;
    }
    const hasSelectedIssue = input.debugIssues.some(
      (issue) => issue.id === input.selectedIssueIdentifier
    );
    if (hasSelectedIssue) {
      return input.selectedIssueIdentifier;
    }
    return input.debugIssues[0]?.id ?? EMPTY_DEBUG_ISSUE_IDENTIFIER;
  }
}
