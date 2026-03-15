import {
  type DebugErrorLike,
  type DebugHistoryEntryLike,
  type DebugIssue,
  type RuntimeRequestErrorOperationMetric,
} from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import {
  buildDebugErrorIssue,
  buildDebugWarningIssuesFromHistory,
  sortDebugIssuesByTimeDesc,
} from "@/Features/Debugging/DomainModel/DebugIssueDerivation";

export const DEBUG_ISSUE_SEVERITY_FILTER_ALL = "all";
export const DEBUG_ISSUE_SEVERITY_FILTER_ERROR = "error";
export const DEBUG_ISSUE_SEVERITY_FILTER_WARNING = "warning";

const EMPTY_DEBUG_ISSUE_IDENTIFIER = "";
const RUNTIME_REQUEST_ERROR_OPERATION = "runtime-request-error";
const REQUEST_PATH_IN_MESSAGE_PATTERN = /\/api\/[a-z0-9/_-]+/i;
const RUNTIME_REQUEST_PATH_OPERATION_PREFIX = "request-path";

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

function readNormalizedOperationLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }
  return normalized;
}

function readRuntimeRequestOperationLabel(debugError: DebugErrorLike): string {
  const normalizedActionName = readNormalizedOperationLabel(debugError.details.actionName);
  if (
    normalizedActionName !== null &&
    normalizedActionName.toLowerCase() !== RUNTIME_REQUEST_ERROR_OPERATION
  ) {
    return normalizedActionName;
  }

  const requestPath = debugError.message.match(REQUEST_PATH_IN_MESSAGE_PATTERN)?.[0] ?? null;
  const normalizedRequestPath = readNormalizedOperationLabel(requestPath);
  if (normalizedRequestPath !== null) {
    return `${RUNTIME_REQUEST_PATH_OPERATION_PREFIX}:${normalizedRequestPath}`;
  }

  return RUNTIME_REQUEST_ERROR_OPERATION;
}

function sortRuntimeRequestErrorOperationMetrics(
  left: RuntimeRequestErrorOperationMetric,
  right: RuntimeRequestErrorOperationMetric,
): number {
  if (left.count !== right.count) {
    return right.count - left.count;
  }
  return left.operation.localeCompare(right.operation);
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

  public readRuntimeRequestErrorOperationMetrics(
    debugErrors: DebugErrorLike[],
  ): RuntimeRequestErrorOperationMetric[] {
    const runtimeRequestCountByOperation = new Map<string, number>();

    for (const debugError of debugErrors) {
      if (debugError.operation !== RUNTIME_REQUEST_ERROR_OPERATION) {
        continue;
      }
      const operation = readRuntimeRequestOperationLabel(debugError);
      runtimeRequestCountByOperation.set(
        operation,
        (runtimeRequestCountByOperation.get(operation) ?? 0) + 1,
      );
    }

    return [...runtimeRequestCountByOperation.entries()]
      .map(([operation, count]) => ({
        operation,
        count,
      }))
      .sort(sortRuntimeRequestErrorOperationMetrics);
  }

  public readCombinedDebugIssues(input: ReadCombinedDebugIssuesInput): DebugIssue[] {
    const debugIssues: DebugIssue[] = [...input.debugErrorIssues, ...input.debugWarningIssues];
    debugIssues.sort(sortDebugIssuesByTimeDesc);
    return debugIssues;
  }

  public readFilteredDebugIssues(input: ReadFilteredDebugIssuesInput): DebugIssue[] {
    const normalizedQuery = normalizeDebugIssueFilterQuery(input.filterQuery);
    return input.debugIssues.filter((issue) => {
      if (
        input.severityFilter !== DEBUG_ISSUE_SEVERITY_FILTER_ALL &&
        issue.severity !== input.severityFilter
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
      (issue) => issue.id === input.selectedIssueIdentifier,
    );
    if (hasSelectedIssue) {
      return input.selectedIssueIdentifier;
    }
    return input.debugIssues[0]?.id ?? EMPTY_DEBUG_ISSUE_IDENTIFIER;
  }
}
