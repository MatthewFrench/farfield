// Accept both "requestId=req-1" and "request id: req-1" message styles.
const REQUEST_IDENTIFIER_CAPTURE_PATTERN = /\brequest\s*id[ =:]+([a-z0-9._-]+)/i;
const REQUEST_CANCELED_ERROR_MESSAGE_PATTERN = /^Request canceled for /i;
const SERVER_SHUTTING_DOWN_ERROR_MESSAGE_PATTERN = /Server is shutting down/i;
const TRACKED_UI_ERROR_PREFIX_SEPARATOR = ": ";
const TRACKED_UI_ERROR_TAG_SEPARATOR = " ";

export function extractRequestIdFromErrorMessage(errorMessage: string): string | null {
  const requestIdMatch = errorMessage.match(REQUEST_IDENTIFIER_CAPTURE_PATTERN);
  return requestIdMatch?.[1] ?? null;
}

export function shouldIgnoreUiErrorMessage(errorMessage: string): boolean {
  return (
    REQUEST_CANCELED_ERROR_MESSAGE_PATTERN.test(errorMessage.trim())
    || SERVER_SHUTTING_DOWN_ERROR_MESSAGE_PATTERN.test(errorMessage)
  );
}

export function formatTrackedUiErrorMessage(input: {
  operation: string;
  errorMessage: string;
  actionId: string;
  requestId: string | null;
  errorId: string | null;
}): string {
  const tags = [
    `actionId=${input.actionId}`,
    input.requestId ? `requestId=${input.requestId}` : "",
    input.errorId ? `errorId=${input.errorId}` : ""
  ].filter((value) => value.length > 0);

  if (tags.length === 0) {
    return `${input.operation}${TRACKED_UI_ERROR_PREFIX_SEPARATOR}${input.errorMessage}`;
  }

  return `${input.operation}${TRACKED_UI_ERROR_PREFIX_SEPARATOR}${input.errorMessage} ${tags.join(TRACKED_UI_ERROR_TAG_SEPARATOR)}`;
}
