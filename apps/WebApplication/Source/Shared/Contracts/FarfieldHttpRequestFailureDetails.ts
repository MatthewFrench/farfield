/**
 * Shared request-failure diagnostic contract emitted by the transport boundary.
 * Feature owners consume this contract without importing transport execution utilities.
 */
export interface FarfieldHttpRequestFailureDetails {
  path: string;
  status: number | null;
  statusText: string | null;
  requestId: string | null;
  responseText: string | null;
  responseTextLength: number | null;
  responseTextTruncated: boolean;
}
