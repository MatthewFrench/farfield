import {
  createDebugClientError,
  type ApiCreateDebugClientErrorInput,
  type ApiDebugErrorCreateResponse
} from "@/Features/Debugging/DataAccess/DebugApi";

export type ClientErrorReportInput = ApiCreateDebugClientErrorInput;
export type ClientErrorReportResult = ApiDebugErrorCreateResponse;

export async function reportClientError(input: ClientErrorReportInput): Promise<ClientErrorReportResult> {
  return createDebugClientError(input);
}
