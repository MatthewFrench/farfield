import type { IncomingMessage, ServerResponse } from "node:http";
import type { AgentRegistry } from "../../Agents/Registry.js";
import type { AgentId } from "../../Agents/Types.js";

export const CapabilityRouteMethodByName = {
  get: "GET",
  post: "POST",
} as const;

export const CapabilityRoutePathnameByName = {
  defaults: "/api/config/defaults",
  configRequirements: "/api/config-requirements",
  configMcpServerReload: "/api/config/mcp-server/reload",
  configBatchWrite: "/api/config/batch/write",
  configValueWrite: "/api/config/value/write",
  account: "/api/account",
  accountAuthStatus: "/api/account/auth-status",
  accountRateLimits: "/api/account/rate-limits",
  accountUserInfo: "/api/account/user-info",
  pendingServerRequests: "/api/server-requests/pending",
  feedbackUpload: "/api/feedback/upload",
  notificationEvents: "/api/notifications/events",
  gitDiffToRemote: "/api/git/diff-remote",
  fuzzyFileSearch: "/api/files/fuzzy-search",
  fuzzyFileSearchSessionStart: "/api/files/fuzzy-search/session-start",
  fuzzyFileSearchSessionUpdate: "/api/files/fuzzy-search/session-update",
  fuzzyFileSearchSessionStop: "/api/files/fuzzy-search/session-stop",
  accountLoginStart: "/api/account/login/start",
  accountLoginCancel: "/api/account/login/cancel",
  accountLogout: "/api/account/logout",
  commandsExec: "/api/commands/exec",
  mcpServerOauthLogin: "/api/mcp-servers/oauth/login",
  skillsConfigWrite: "/api/skills/config/write",
  skillsRemoteList: "/api/skills/remote/list",
  skillsRemoteExport: "/api/skills/remote/export",
  externalAgentConfigDetect: "/api/external-agent-config/detect",
  externalAgentConfigImport: "/api/external-agent-config/import",
  threadRealtimeStart: "/api/threads/realtime/start",
  threadRealtimeAppendAudio: "/api/threads/realtime/append-audio",
  threadRealtimeAppendText: "/api/threads/realtime/append-text",
  threadRealtimeStop: "/api/threads/realtime/stop",
  windowsSandboxSetupStart: "/api/windows-sandbox/setup-start",
  models: "/api/models",
  collaborationModes: "/api/collaboration-modes",
  experimentalFeatures: "/api/experimental-features",
  mcpServers: "/api/mcp-servers",
  apps: "/api/apps",
  skills: "/api/skills",
} as const;

export const CapabilityRouteStatusCodeByName = {
  success: 200,
  badRequest: 400,
  serviceUnavailable: 503,
} as const;

export const CapabilityRouteQueryParameterByName = {
  agentId: "agentId",
  limit: "limit",
  sinceSequence: "sinceSequence",
  cursor: "cursor",
  threadId: "threadId",
  forceRefetch: "forceRefetch",
  forceReload: "forceReload",
  includeToken: "includeToken",
  refreshToken: "refreshToken",
  classification: "classification",
  reason: "reason",
  includeLogs: "includeLogs",
  loginId: "loginId",
  name: "name",
  path: "path",
  enabled: "enabled",
  keyPath: "keyPath",
  value: "value",
  mergeStrategy: "mergeStrategy",
  edits: "edits",
  filePath: "filePath",
  expectedVersion: "expectedVersion",
  command: "command",
  query: "query",
  root: "root",
  cancellationToken: "cancellationToken",
  cwd: "cwd",
  hazelnutScope: "hazelnutScope",
  productSurface: "productSurface",
  hazelnutId: "hazelnutId",
  scopes: "scopes",
  timeoutMs: "timeoutMs",
  timeoutSeconds: "timeoutSeconds",
  includeHome: "includeHome",
  migrationItems: "migrationItems",
  prompt: "prompt",
  sessionId: "sessionId",
  audioData: "audioData",
  audioSampleRate: "audioSampleRate",
  audioNumChannels: "audioNumChannels",
  audioSamplesPerChannel: "audioSamplesPerChannel",
  text: "text",
  mode: "mode",
} as const;

export const CapabilityRouteLogEventByName = {
  defaultsReadFailed: "agent-config-defaults-read-failed",
  defaultsInvalidReasoningEffort: "agent-config-defaults-invalid-reasoning-effort",
  configRequirementsReadFailed: "config-requirements-read-failed",
  accountReadFailed: "account-read-failed",
  accountAuthStatusReadFailed: "account-auth-status-read-failed",
  accountRateLimitsReadFailed: "account-rate-limits-read-failed",
  accountUserInfoReadFailed: "account-user-info-read-failed",
  pendingServerRequestsReadFailed: "pending-server-requests-read-failed",
  feedbackUploadFailed: "feedback-upload-failed",
  notificationEventsReadFailed: "notification-events-read-failed",
  gitDiffToRemoteFailed: "git-diff-to-remote-failed",
  fuzzyFileSearchFailed: "fuzzy-file-search-failed",
  fuzzyFileSearchSessionStartFailed: "fuzzy-file-search-session-start-failed",
  fuzzyFileSearchSessionUpdateFailed: "fuzzy-file-search-session-update-failed",
  fuzzyFileSearchSessionStopFailed: "fuzzy-file-search-session-stop-failed",
  commandExecFailed: "command-exec-failed",
  accountLoginStartFailed: "account-login-start-failed",
  accountLoginCancelFailed: "account-login-cancel-failed",
  accountLogoutFailed: "account-logout-failed",
  configMcpServerReloadFailed: "config-mcp-server-reload-failed",
  configBatchWriteFailed: "config-batch-write-failed",
  configValueWriteFailed: "config-value-write-failed",
  mcpServerOauthLoginFailed: "mcp-server-oauth-login-failed",
  skillsConfigWriteFailed: "skills-config-write-failed",
  skillsRemoteListFailed: "skills-remote-list-failed",
  skillsRemoteExportFailed: "skills-remote-export-failed",
  externalAgentConfigDetectFailed: "external-agent-config-detect-failed",
  externalAgentConfigImportFailed: "external-agent-config-import-failed",
  threadRealtimeStartFailed: "thread-realtime-start-failed",
  threadRealtimeAppendAudioFailed: "thread-realtime-append-audio-failed",
  threadRealtimeAppendTextFailed: "thread-realtime-append-text-failed",
  threadRealtimeStopFailed: "thread-realtime-stop-failed",
  windowsSandboxSetupStartFailed: "windows-sandbox-setup-start-failed",
  modelsListTimeout: "models-list-timeout",
  collaborationModesListTimeout: "collaboration-modes-list-timeout",
  experimentalFeaturesListTimeout: "experimental-features-list-timeout",
  mcpServersListTimeout: "mcp-servers-list-timeout",
  appsListTimeout: "apps-list-timeout",
  skillsListTimeout: "skills-list-timeout",
} as const;

export const CapabilityRouteErrorMessagePrefixByName = {
  invalidAgentId: "Invalid agentId: ",
  failedToReadConfigRequirements: "Failed to read config requirements: ",
  failedToReadAccount: "Failed to read account: ",
  invalidAccountAuthStatusIncludeToken:
    "Invalid includeToken query parameter. Expected true/false or 1/0.",
  invalidAccountAuthStatusRefreshToken:
    "Invalid refreshToken query parameter. Expected true/false or 1/0.",
  failedToReadAuthStatus: "Failed to read auth status: ",
  failedToReadAccountRateLimits: "Failed to read account rate limits: ",
  failedToReadUserInfo: "Failed to read user info: ",
  failedToReadPendingServerRequests: "Failed to read pending server requests: ",
  missingFeedbackClassification: "Missing classification query parameter.",
  invalidFeedbackClassification:
    "Invalid classification query parameter. Expected non-empty value.",
  missingFeedbackIncludeLogs: "Missing includeLogs query parameter.",
  invalidFeedbackIncludeLogs: "Invalid includeLogs query parameter. Expected true/false or 1/0.",
  invalidFeedbackReason: "Invalid reason query parameter.",
  invalidFeedbackThreadId: "Invalid threadId query parameter.",
  failedToUploadFeedback: "Failed to upload feedback: ",
  invalidNotificationEventsQueryParameters: "Invalid notification events query parameters.",
  failedToReadNotificationEvents: "Failed to read notification events: ",
  missingGitDiffWorkingDirectory: "Missing cwd query parameter.",
  invalidGitDiffWorkingDirectory: "Invalid cwd query parameter.",
  failedToReadGitDiffToRemote: "Failed to read git diff to remote: ",
  missingCommand: "Missing command query parameter. Use repeated command query values.",
  invalidCommand: "Invalid command query parameter. Expected non-empty command arguments.",
  missingFuzzyFileSearchQuery: "Missing query parameter.",
  invalidFuzzyFileSearchQuery: "Invalid query parameter. Expected non-empty search text.",
  missingFuzzyFileSearchRoots: "Missing root query parameter. Use repeated root query values.",
  invalidFuzzyFileSearchRoots: "Invalid root query parameter. Expected non-empty root path values.",
  missingFuzzyFileSearchSessionId: "Missing sessionId query parameter.",
  invalidFuzzyFileSearchSessionId: "Invalid sessionId query parameter. Expected non-empty text.",
  invalidFuzzyFileSearchCancellationToken:
    "Invalid cancellationToken query parameter. Expected non-empty text value.",
  failedToSearchFuzzyFiles: "Failed to search fuzzy files: ",
  failedToStartFuzzyFileSearchSession: "Failed to start fuzzy file search session: ",
  failedToUpdateFuzzyFileSearchSession: "Failed to update fuzzy file search session: ",
  failedToStopFuzzyFileSearchSession: "Failed to stop fuzzy file search session: ",
  invalidTimeoutMilliseconds: "Invalid timeoutMs query parameter.",
  invalidCommandWorkingDirectory: "Invalid cwd query parameter.",
  failedToExecuteCommand: "Failed to execute command: ",
  failedToStartAccountLogin: "Failed to start account login: ",
  failedToCancelAccountLogin: "Failed to cancel account login: ",
  failedToLogoutAccount: "Failed to logout account: ",
  failedToReloadMcpServerConfig: "Failed to reload MCP server config: ",
  missingConfigKeyPath: "Missing keyPath query parameter.",
  missingConfigValue: "Missing value query parameter.",
  invalidConfigValue: "Invalid value query parameter. Expected JSON value.",
  missingConfigMergeStrategy: "Missing mergeStrategy query parameter.",
  invalidConfigMergeStrategy: "Invalid mergeStrategy query parameter. Expected replace or upsert.",
  missingConfigBatchEdits: "Missing edits query parameter.",
  invalidConfigBatchEdits: "Invalid edits query parameter. Expected JSON array of config edits.",
  invalidConfigFilePath: "Invalid filePath query parameter.",
  invalidConfigExpectedVersion: "Invalid expectedVersion query parameter.",
  failedToWriteConfigBatch: "Failed to write config batch: ",
  failedToWriteConfigValue: "Failed to write config value: ",
  missingLoginId: "Missing loginId query parameter.",
  missingMcpServerName: "Missing name query parameter.",
  invalidTimeoutSeconds: "Invalid timeoutSeconds query parameter.",
  failedToStartMcpServerOauthLogin: "Failed to start MCP server oauth login: ",
  missingSkillPath: "Missing path query parameter.",
  missingSkillEnabled: "Missing enabled query parameter.",
  invalidSkillEnabled: "Invalid enabled query parameter. Expected true/false or 1/0.",
  failedToWriteSkillsConfig: "Failed to write skills config: ",
  missingRemoteSkillsHazelnutScope: "Missing hazelnutScope query parameter.",
  invalidRemoteSkillsHazelnutScope:
    "Invalid hazelnutScope query parameter. Expected example, workspace-shared, all-shared, or personal.",
  missingRemoteSkillsProductSurface: "Missing productSurface query parameter.",
  invalidRemoteSkillsProductSurface:
    "Invalid productSurface query parameter. Expected chatgpt, codex, api, or atlas.",
  missingRemoteSkillsEnabled: "Missing enabled query parameter.",
  invalidRemoteSkillsEnabled: "Invalid enabled query parameter. Expected true/false or 1/0.",
  failedToListRemoteSkills: "Failed to list remote skills: ",
  missingRemoteSkillHazelnutId: "Missing hazelnutId query parameter.",
  failedToExportRemoteSkill: "Failed to export remote skill: ",
  invalidExternalAgentConfigIncludeHome:
    "Invalid includeHome query parameter. Expected true/false or 1/0.",
  missingExternalAgentConfigDetectTargets:
    "Specify includeHome=true and/or at least one cwd query parameter.",
  invalidExternalAgentConfigDetectCwds:
    "Invalid cwd query parameter. Expected non-empty cwd values.",
  failedToDetectExternalAgentConfig: "Failed to detect external agent config: ",
  missingExternalAgentConfigMigrationItems: "Missing migrationItems query parameter.",
  invalidExternalAgentConfigMigrationItems:
    "Invalid migrationItems query parameter. Expected JSON array of migration items.",
  failedToImportExternalAgentConfig: "Failed to import external agent config: ",
  missingThreadRealtimeThreadId: "Missing threadId query parameter.",
  missingThreadRealtimePrompt: "Missing prompt query parameter.",
  missingThreadRealtimeAudioData: "Missing audioData query parameter.",
  missingThreadRealtimeAudioSampleRate: "Missing audioSampleRate query parameter.",
  missingThreadRealtimeAudioNumChannels: "Missing audioNumChannels query parameter.",
  missingThreadRealtimeText: "Missing text query parameter.",
  invalidThreadRealtimeThreadId: "Invalid threadId query parameter.",
  invalidThreadRealtimePrompt: "Invalid prompt query parameter.",
  invalidThreadRealtimeAudioData: "Invalid audioData query parameter.",
  invalidThreadRealtimeAudioSampleRate:
    "Invalid audioSampleRate query parameter. Expected positive integer.",
  invalidThreadRealtimeAudioNumChannels:
    "Invalid audioNumChannels query parameter. Expected positive integer.",
  invalidThreadRealtimeAudioSamplesPerChannel:
    "Invalid audioSamplesPerChannel query parameter. Expected positive integer.",
  invalidThreadRealtimeText: "Invalid text query parameter.",
  invalidThreadRealtimeSessionId: "Invalid sessionId query parameter.",
  failedToStartThreadRealtime: "Failed to start thread realtime: ",
  failedToAppendThreadRealtimeAudio: "Failed to append thread realtime audio: ",
  failedToAppendThreadRealtimeText: "Failed to append thread realtime text: ",
  failedToStopThreadRealtime: "Failed to stop thread realtime: ",
  missingWindowsSandboxMode: "Missing mode query parameter.",
  invalidWindowsSandboxMode: "Invalid mode query parameter. Expected elevated or unelevated.",
  failedToStartWindowsSandboxSetup: "Failed to start windows sandbox setup: ",
  failedToListModels: "Failed to list models: ",
  failedToListCollaborationModes: "Failed to list collaboration modes: ",
  failedToListExperimentalFeatures: "Failed to list experimental features: ",
  failedToListMcpServers: "Failed to list MCP servers: ",
  failedToListApps: "Failed to list apps: ",
  failedToListSkills: "Failed to list skills: ",
} as const;

export const CapabilityRouteTimeoutLabelByName = {
  configRequirementsRead: "config requirements read",
  accountRead: "account read",
  accountAuthStatusRead: "auth status read",
  accountRateLimitsRead: "account rate limits read",
  accountUserInfoRead: "user info read",
  pendingServerRequestsRead: "pending server requests read",
  feedbackUpload: "feedback upload",
  notificationEventsRead: "notification events read",
  gitDiffToRemote: "git diff to remote",
  fuzzyFileSearch: "fuzzy file search",
  fuzzyFileSearchSessionStart: "fuzzy file search session start",
  fuzzyFileSearchSessionUpdate: "fuzzy file search session update",
  fuzzyFileSearchSessionStop: "fuzzy file search session stop",
  commandExec: "command execution",
  accountLoginStart: "account login start",
  accountLoginCancel: "account login cancel",
  accountLogout: "account logout",
  configMcpServerReload: "config mcp server reload",
  configBatchWrite: "config batch write",
  configValueWrite: "config value write",
  mcpServerOauthLogin: "mcp server oauth login",
  skillsConfigWrite: "skills config write",
  skillsRemoteList: "skills remote listing",
  skillsRemoteExport: "skills remote export",
  externalAgentConfigDetect: "external agent config detect",
  externalAgentConfigImport: "external agent config import",
  threadRealtimeStart: "thread realtime start",
  threadRealtimeAppendAudio: "thread realtime append audio",
  threadRealtimeAppendText: "thread realtime append text",
  threadRealtimeStop: "thread realtime stop",
  windowsSandboxSetupStart: "windows sandbox setup start",
  modelsList: "models listing",
  collaborationModesList: "collaboration modes listing",
  experimentalFeaturesList: "experimental features listing",
  mcpServersList: "mcp servers listing",
  appsList: "apps listing",
  skillsList: "skills listing",
} as const;

export const CapabilityRouteModelsLimitDefault = 100;
export const CapabilityRouteListLimitDefault = 100;

export interface CapabilityRouteDependencies {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  url: URL;
  capabilityListTimeoutMs: number;
  registry: AgentRegistry;
  parseInteger: (value: string | null, defaultValue: number) => number;
  parseAgentId: (value: string | null) => AgentId | null;
  withTimeout: <ValueType>(
    promise: Promise<ValueType>,
    timeoutMs: number,
    label: string,
  ) => Promise<ValueType>;
  jsonResponse: (res: ServerResponse, statusCode: number, body: object) => void;
}

export function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

export function isCapabilityRouteRequest(
  method: string | undefined,
  pathname: string,
  expectedMethod: string,
  expectedPathname: string,
): boolean {
  return method === expectedMethod && pathname === expectedPathname;
}

export function parseBooleanQueryValue(value: string | null): boolean {
  if (value === null) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

export function parseBooleanQueryValueStrict(value: string | null): boolean | null {
  if (value === null) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true") {
    return true;
  }
  if (normalized === "0" || normalized === "false") {
    return false;
  }
  return null;
}
