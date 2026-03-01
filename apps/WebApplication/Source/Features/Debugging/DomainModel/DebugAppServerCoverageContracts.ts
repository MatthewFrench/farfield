/**
 * Owns typed app-server coverage diagnostics contracts rendered in Debug Workspace.
 */
export interface DebugAppServerCoverageNetworkRequirements {
  enabled: boolean | null;
  httpPort: number | null;
  socksPort: number | null;
  allowUpstreamProxy: boolean | null;
  dangerouslyAllowNonLoopbackProxy: boolean | null;
  dangerouslyAllowNonLoopbackAdmin: boolean | null;
  dangerouslyAllowAllUnixSockets: boolean | null;
  allowedDomains: string[] | null;
  deniedDomains: string[] | null;
  allowUnixSockets: string[] | null;
  allowLocalBinding: boolean | null;
}

export interface DebugAppServerCoverageRequirements {
  allowedApprovalPolicies: string[] | null;
  allowedSandboxModes: string[] | null;
  allowedWebSearchModes: string[] | null;
  enforceResidency: string | null;
  network: DebugAppServerCoverageNetworkRequirements | null;
}

export interface DebugAppServerCoverageExperimentalFeature {
  name: string;
  stage: "beta" | "underDevelopment" | "stable" | "deprecated" | "removed";
  displayName: string | null;
  description: string | null;
  announcement: string | null;
  enabled: boolean;
  defaultEnabled: boolean;
}

export interface DebugAppServerCoverageMcpServerSummary {
  name: string;
  authStatus: string;
  toolCount: number;
  resourceCount: number;
  resourceTemplateCount: number;
}

export interface DebugAppServerCoverageAppSummary {
  id: string;
  name: string;
  description: string | null;
  isAccessible: boolean;
  isEnabled: boolean;
}

export interface DebugAppServerCoverageSkillSummary {
  name: string;
  description: string;
  path: string;
  scope: "user" | "repo" | "system" | "admin";
  enabled: boolean;
}

export interface DebugAppServerCoverageSkillEntry {
  cwd: string;
  skills: DebugAppServerCoverageSkillSummary[];
  errorCount: number;
}

export interface DebugAppServerCoverageRemoteSkillSummary {
  id: string;
  name: string;
  description: string;
}

export type DebugAppServerCoverageExternalAgentConfigMigrationItemType =
  | "AGENTS_MD"
  | "CONFIG"
  | "SKILLS"
  | "MCP_SERVER_CONFIG";

export interface DebugAppServerCoverageExternalAgentConfigMigrationItem {
  itemType: DebugAppServerCoverageExternalAgentConfigMigrationItemType;
  description: string;
  cwd: string | null;
}

export interface DebugAppServerCoverageExternalAgentConfigDetectResult {
  includeHome: boolean;
  cwds: string[];
  items: DebugAppServerCoverageExternalAgentConfigMigrationItem[];
  detectedAtIso8601: string;
}

export interface DebugAppServerCoverageExternalAgentConfigImportResult {
  itemCount: number;
  importedAtIso8601: string;
}

export interface DebugAppServerCoverageThreadRealtimeStartResult {
  threadId: string;
  prompt: string;
  sessionId: string | null;
  startedAtIso8601: string;
}

export interface DebugAppServerCoverageThreadRealtimeAudioChunk {
  data: string;
  sampleRate: number;
  numChannels: number;
  samplesPerChannel: number | null;
}

export interface DebugAppServerCoverageThreadRealtimeAppendAudioResult {
  threadId: string;
  audio: DebugAppServerCoverageThreadRealtimeAudioChunk;
  appendedAtIso8601: string;
}

export interface DebugAppServerCoverageThreadRealtimeAppendTextResult {
  threadId: string;
  text: string;
  appendedAtIso8601: string;
}

export interface DebugAppServerCoverageThreadRealtimeStopResult {
  threadId: string;
  stoppedAtIso8601: string;
}

export type DebugAppServerCoverageWindowsSandboxSetupMode = "elevated" | "unelevated";

export interface DebugAppServerCoverageWindowsSandboxSetupStartResult {
  mode: DebugAppServerCoverageWindowsSandboxSetupMode;
  started: boolean;
  startedAtIso8601: string;
}

export interface DebugAppServerCoverageCommandExecutionResult {
  command: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  executedAtIso8601: string;
}

export interface DebugAppServerCoverageConfigValueWriteResult {
  keyPath: string;
  mergeStrategy: "replace" | "upsert";
  valueSummary: string;
  status: "ok" | "okOverridden";
  version: string;
  filePath: string;
  overriddenMessage: string | null;
  writtenAtIso8601: string;
}

export interface DebugAppServerCoverageConfigBatchWriteResult {
  editCount: number;
  status: "ok" | "okOverridden";
  version: string;
  filePath: string;
  overriddenMessage: string | null;
  writtenAtIso8601: string;
}

export interface DebugAppServerCoverageFeedbackUploadResult {
  classification: string;
  includeLogs: boolean;
  reason: string | null;
  requestedThreadId: string | null;
  reportedThreadId: string;
  uploadedAtIso8601: string;
}

export interface DebugAppServerCoverageGitDiffToRemoteResult {
  cwd: string;
  sha: string;
  diff: string;
  readAtIso8601: string;
}

export interface DebugAppServerCoverageFuzzyFileSearchResultFile {
  root: string;
  path: string;
  fileName: string;
  score: number;
  indices: number[] | null;
}

export interface DebugAppServerCoverageFuzzyFileSearchResult {
  query: string;
  roots: string[];
  files: DebugAppServerCoverageFuzzyFileSearchResultFile[];
  searchedAtIso8601: string;
}

export interface DebugAppServerCoverageFuzzyFileSearchSessionStartResult {
  sessionId: string;
  roots: string[];
  startedAtIso8601: string;
}

export interface DebugAppServerCoverageFuzzyFileSearchSessionUpdateResult {
  sessionId: string;
  query: string;
  updatedAtIso8601: string;
}

export interface DebugAppServerCoverageFuzzyFileSearchSessionStopResult {
  sessionId: string;
  stoppedAtIso8601: string;
}

export type DebugAppServerCoverageThreadStreamEventFrameType =
  | "request"
  | "response"
  | "broadcast"
  | "client-discovery-request"
  | "client-discovery-response";

export interface DebugAppServerCoverageThreadStreamEventSummary {
  frameType: DebugAppServerCoverageThreadStreamEventFrameType;
  method: string | null;
  requestId: string | null;
  sourceClientId: string | null;
  sequence: number | null;
  receivedAtMilliseconds: number | null;
  preview: string;
}

export interface DebugAppServerCoverageThreadStreamEventMethodCount {
  method: string;
  count: number;
}

export interface DebugAppServerCoverageThreadStreamEventsResult {
  threadId: string;
  sinceSequence: number | null;
  ownerClientId: string | null;
  eventCount: number;
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
  events: DebugAppServerCoverageThreadStreamEventSummary[];
  methodCounts: DebugAppServerCoverageThreadStreamEventMethodCount[];
  readAtIso8601: string;
}

export interface DebugAppServerCoverageNotificationEventSummary {
  method: string;
  sequence: number;
  receivedAtMilliseconds: number;
  preview: string;
}

export interface DebugAppServerCoverageNotificationEventMethodCount {
  method: string;
  count: number;
}

export interface DebugAppServerCoverageNotificationEventsResult {
  sinceSequence: number | null;
  eventCount: number;
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
  events: DebugAppServerCoverageNotificationEventSummary[];
  methodCounts: DebugAppServerCoverageNotificationEventMethodCount[];
  readAtIso8601: string;
}

export interface DebugAppServerCoveragePendingServerRequestSummary {
  requestId: number;
  method: string;
  receivedAtMilliseconds: number;
  preview: string;
}

export interface DebugAppServerCoveragePendingServerRequestMethodCount {
  method: string;
  count: number;
}

export interface DebugAppServerCoveragePendingServerRequestsResult {
  requestCount: number;
  requests: DebugAppServerCoveragePendingServerRequestSummary[];
  methodCounts: DebugAppServerCoveragePendingServerRequestMethodCount[];
  readAtIso8601: string;
}

export type DebugAppServerCoverageAccountPlanType =
  | "free"
  | "go"
  | "plus"
  | "pro"
  | "team"
  | "business"
  | "enterprise"
  | "edu"
  | "unknown";

export interface DebugAppServerCoverageApiKeyAccount {
  type: "apiKey";
}

export interface DebugAppServerCoverageChatgptAccount {
  type: "chatgpt";
  email: string;
  planType: DebugAppServerCoverageAccountPlanType;
}

export type DebugAppServerCoverageAccount =
  | DebugAppServerCoverageApiKeyAccount
  | DebugAppServerCoverageChatgptAccount;

export type DebugAppServerCoverageAuthStatusMethod = "apikey" | "chatgpt" | "chatgptAuthTokens";

export interface DebugAppServerCoverageAuthStatusSnapshot {
  authMethod: DebugAppServerCoverageAuthStatusMethod | null;
  authToken: string | null;
  requiresOpenaiAuth: boolean | null;
}

export interface DebugAppServerCoverageUserInfoSnapshot {
  allegedUserEmail: string | null;
}

export interface DebugAppServerCoverageCreditsSnapshot {
  balance: string | null;
  hasCredits: boolean;
  unlimited: boolean;
}

export interface DebugAppServerCoverageRateLimitWindow {
  resetsAt: number | null;
  usedPercent: number;
  windowDurationMins: number | null;
}

export interface DebugAppServerCoverageRateLimitSnapshot {
  credits: DebugAppServerCoverageCreditsSnapshot | null;
  limitId: string | null;
  limitName: string | null;
  planType: DebugAppServerCoverageAccountPlanType | null;
  primary: DebugAppServerCoverageRateLimitWindow | null;
  secondary: DebugAppServerCoverageRateLimitWindow | null;
}

export interface DebugAppServerCoveragePendingAccountLogin {
  loginId: string;
  authUrl: string;
}

export interface DebugAppServerCoverageSnapshot {
  requirements: DebugAppServerCoverageRequirements | null;
  account: DebugAppServerCoverageAccount | null;
  requiresOpenaiAuth: boolean;
  authStatus: DebugAppServerCoverageAuthStatusSnapshot | null;
  accountRateLimits: DebugAppServerCoverageRateLimitSnapshot | null;
  userInfo: DebugAppServerCoverageUserInfoSnapshot | null;
  experimentalFeatures: DebugAppServerCoverageExperimentalFeature[];
  mcpServers: DebugAppServerCoverageMcpServerSummary[];
  apps: DebugAppServerCoverageAppSummary[];
  skills: DebugAppServerCoverageSkillEntry[];
  remoteSkills: DebugAppServerCoverageRemoteSkillSummary[];
  refreshedAtIso8601: string;
}
