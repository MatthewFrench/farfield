/**
 * Marks request-input failures that should map to client validation responses.
 * Network error responders classify this error as HTTP 400 request validation.
 */
export class RequestValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}
