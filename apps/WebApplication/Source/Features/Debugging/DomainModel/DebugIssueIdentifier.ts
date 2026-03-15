const DEBUG_ERROR_ISSUE_IDENTIFIER_PREFIX = "error:";

export function buildDebugErrorIssueIdentifier(errorId: string): string {
  return `${DEBUG_ERROR_ISSUE_IDENTIFIER_PREFIX}${errorId}`;
}
