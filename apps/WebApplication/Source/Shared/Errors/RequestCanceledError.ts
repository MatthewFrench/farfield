export class RequestCanceledError extends Error {
  public constructor(path: string) {
    super(`Request canceled for ${path}`);
    this.name = "RequestCanceledError";
  }
}

export function isRequestCanceledError(error: Error): boolean {
  return error instanceof RequestCanceledError;
}
