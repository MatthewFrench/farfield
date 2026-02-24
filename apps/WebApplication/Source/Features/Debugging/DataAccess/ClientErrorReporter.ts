import { CreateDebugClientErrorBodySchema } from "@farfield/protocol";
import {
  createDebugClientError,
  type ApiCreateDebugClientErrorInput,
  type ApiDebugErrorCreateResponse
} from "@/Features/Debugging/DataAccess/DebugApi";

export type ClientErrorReportInput = ApiCreateDebugClientErrorInput;
export type ClientErrorReportResult = ApiDebugErrorCreateResponse;

export async function reportClientError(input: ClientErrorReportInput): Promise<ClientErrorReportResult> {
  const parsed = CreateDebugClientErrorBodySchema.parse(input);
  return createDebugClientError(parsed);
}
