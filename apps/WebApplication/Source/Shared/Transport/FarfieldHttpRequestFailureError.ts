/**
 * Carries normalized request-failure diagnostics for shared HTTP transport owners.
 */
import type { FarfieldHttpRequestFailureDetails } from "@/Shared/Contracts/FarfieldHttpRequestFailureDetails";

const REQUEST_FAILURE_ERROR_NAME = "FarfieldHttpRequestFailureError";

export class FarfieldHttpRequestFailureError extends Error {
  public readonly requestFailureDetails: FarfieldHttpRequestFailureDetails;

  public constructor(message: string, requestFailureDetails: FarfieldHttpRequestFailureDetails) {
    super(message);
    this.name = REQUEST_FAILURE_ERROR_NAME;
    this.requestFailureDetails = requestFailureDetails;
  }
}
