const THREAD_NOT_LOADED_READ_ERROR_PATTERN = /thread not loaded in app-server/i;
const THREAD_READ_NOT_FOUND_REQUEST_FAILURE_PATTERN =
  /^Request failed for \/api\/threads\/[^?\s]+(?:\?includeTurns=(?:true|false))?\s+status=404\b/i;
const THREAD_NOT_MATERIALIZED_READ_ERROR_PATTERN =
  /includeTurns is unavailable before first user message/i;
const TRANSIENT_READ_ERROR_PATTERNS = [
  /failed to load rollout .* is empty/i,
  THREAD_NOT_LOADED_READ_ERROR_PATTERN,
  THREAD_READ_NOT_FOUND_REQUEST_FAILURE_PATTERN,
  THREAD_NOT_MATERIALIZED_READ_ERROR_PATTERN,
  /conversation not found/i,
] as const;

export function isTransientReadThreadError(errorMessage: string): boolean {
  return TRANSIENT_READ_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage));
}

export function isThreadNotLoadedReadError(errorMessage: string): boolean {
  return (
    THREAD_NOT_LOADED_READ_ERROR_PATTERN.test(errorMessage) ||
    THREAD_READ_NOT_FOUND_REQUEST_FAILURE_PATTERN.test(errorMessage)
  );
}
