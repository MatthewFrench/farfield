import { type JsonValue, ProtocolValidationError } from "@farfield/protocol";
import { z } from "zod";

/**
 * Owns schema parsing and context labels for app-server transport responses.
 */
export const APP_SERVER_CLIENT_RESPONSE_CONTEXTS = {
  listThreads: "AppServerListThreadsResponse",
  listLoadedThreads: "AppServerThreadLoadedListResponse",
  forkThread: "AppServerThreadForkResponse",
  readThread: "AppServerReadThreadResponse",
  listModels: "AppServerListModelsResponse",
  listCollaborationModes: "AppServerCollaborationModeListResponse",
  readConfig: "AppServerConfigReadResponse",
  readConfigRequirements: "AppServerConfigRequirementsReadResponse",
  listExperimentalFeatures: "AppServerExperimentalFeatureListResponse",
  listMcpServerStatuses: "AppServerMcpServerStatusListResponse",
  listApps: "AppServerAppListResponse",
  listSkills: "AppServerSkillsListResponse",
  readAccount: "AppServerGetAccountResponse",
  readAccountRateLimits: "AppServerGetAccountRateLimitsResponse",
  startAccountLogin: "AppServerLoginAccountResponse",
  cancelAccountLogin: "AppServerCancelLoginAccountResponse",
  logoutAccount: "AppServerLogoutAccountResponse",
  reloadMcpServerConfig: "AppServerMcpServerRefreshResponse",
  startMcpServerOauthLogin: "AppServerMcpServerOauthLoginResponse",
  writeSkillsConfig: "AppServerSkillsConfigWriteResponse",
  listRemoteSkills: "AppServerSkillsRemoteListResponse",
  exportRemoteSkill: "AppServerSkillsRemoteExportResponse",
  startThread: "AppServerStartThreadResponse",
  setThreadName: "AppServerThreadSetNameResponse",
  rollbackThread: "AppServerThreadRollbackResponse",
  compactThread: "AppServerThreadCompactStartResponse",
  cleanThreadBackgroundTerminals: "AppServerThreadBackgroundTerminalsCleanResponse",
  startReview: "AppServerReviewStartResponse",
  startTurn: "AppServerTurnStartResponse",
  steerTurn: "AppServerTurnSteerResponse",
  interruptTurn: "AppServerTurnInterruptResponse",
  resumeThread: "AppServerResumeThreadResponse",
  unsubscribeThread: "AppServerThreadUnsubscribeResponse",
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
