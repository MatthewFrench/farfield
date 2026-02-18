import { CreateDebugClientErrorBodySchema } from "@farfield/protocol";
import { z } from "zod";
import { createDebugClientError } from "./api";

export type ClientErrorReportInput = z.infer<typeof CreateDebugClientErrorBodySchema>;
export type ClientErrorReportResult = Awaited<ReturnType<typeof createDebugClientError>>;

export async function reportClientError(input: ClientErrorReportInput): Promise<ClientErrorReportResult> {
  const parsed = CreateDebugClientErrorBodySchema.parse(input);
  return createDebugClientError(parsed);
}
