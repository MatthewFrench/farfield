/**
 * Normalizes thrown values into a user-displayable message string.
 */
export function toErrorMessage<ErrorType>(error: ErrorType): string {
  return error instanceof Error ? error.message : String(error);
}
