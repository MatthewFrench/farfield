import { type JsonValue, ProtocolValidationError } from "@farfield/protocol";
import { z } from "zod";

/**
 * Owns schema parsing and context labels for app-server transport responses.
 */
export const APP_SERVER_CLIENT_RESPONSE_CONTEXTS = {
  listThreads: "AppServerListThreadsResponse",
  forkThread: "AppServerThreadForkResponse",
  readThread: "AppServerReadThreadResponse",
  listModels: "AppServerListModelsResponse",
  listCollaborationModes: "AppServerCollaborationModeListResponse",
  readConfig: "AppServerConfigReadResponse",
  startThread: "AppServerStartThreadResponse",
  setThreadName: "AppServerThreadSetNameResponse",
  rollbackThread: "AppServerThreadRollbackResponse",
  startReview: "AppServerReviewStartResponse",
  startTurn: "AppServerTurnStartResponse",
  steerTurn: "AppServerTurnSteerResponse",
  interruptTurn: "AppServerTurnInterruptResponse",
  resumeThread: "AppServerResumeThreadResponse",
  archiveThread: "AppServerArchiveThreadResponse",
  unarchiveThread: "AppServerUnarchiveThreadResponse",
} as const;

type AppServerClientResponseContext =
  (typeof APP_SERVER_CLIENT_RESPONSE_CONTEXTS)[keyof typeof APP_SERVER_CLIENT_RESPONSE_CONTEXTS];

export function parseAppServerResponse<SchemaType extends z.ZodTypeAny>(
  schema: SchemaType,
  value: JsonValue,
  context: AppServerClientResponseContext,
): z.infer<SchemaType> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw ProtocolValidationError.fromZod(context, parsed.error);
  }
  return parsed.data;
}
