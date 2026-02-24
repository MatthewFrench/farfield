export function extractRequestIdFromErrorMessage(errorMessage: string): string | null {
  const requestIdMatch = errorMessage.match(/\brequest(?:Id)?[ =:]+([a-z0-9._-]+)/i);
  return requestIdMatch?.[1] ?? null;
}

export function shouldIgnoreUiErrorMessage(errorMessage: string): boolean {
  return (
    /^Request canceled for /i.test(errorMessage.trim())
    || /Server is shutting down/i.test(errorMessage)
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
    return `${input.operation}: ${input.errorMessage}`;
  }

  return `${input.operation}: ${input.errorMessage} ${tags.join(" ")}`;
}
