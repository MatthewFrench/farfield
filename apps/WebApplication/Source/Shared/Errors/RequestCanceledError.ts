/**
 * Error category for canceled HTTP requests so owners can suppress noisy UI errors.
 */
export class RequestCanceledError extends Error {
  public constructor(path: string) {
    super(`Request canceled for ${path}`);
    this.name = "RequestCanceledError";
  }
}

export function isRequestCanceledError(error: Error): error is RequestCanceledError {
  return error instanceof RequestCanceledError;
}
