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

export type DebugAppServerCoverageAuthCompletionEventMethod =
  | "mcpServer/oauthLogin/completed"
  | "account/login/completed";

export interface DebugAppServerCoverageAuthCompletionSummary {
  method: DebugAppServerCoverageAuthCompletionEventMethod;
  sequence: number;
  receivedAtMilliseconds: number;
  status: "success" | "error";
  subject: string;
  errorMessage: string | null;
}

export interface DebugAppServerCoverageAuthCompletionMethodCount {
  method: DebugAppServerCoverageAuthCompletionEventMethod;
  count: number;
}

export interface DebugAppServerCoverageAuthCompletionEventsResult {
  sinceSequence: number | null;
  eventCount: number;
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
  events: DebugAppServerCoverageAuthCompletionSummary[];
  methodCounts: DebugAppServerCoverageAuthCompletionMethodCount[];
  readAtIso8601: string;
}

export interface DebugAppServerCoverageServerRequestResolvedSummary {
  sequence: number;
  requestId: number;
  threadId: string;
  receivedAtMilliseconds: number;
}

export interface DebugAppServerCoverageServerRequestResolvedEventsResult {
  sinceSequence: number | null;
  eventCount: number;
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
  events: DebugAppServerCoverageServerRequestResolvedSummary[];
  readAtIso8601: string;
}

export type DebugAppServerCoverageFuzzySessionNotificationMethod =
  | "fuzzyFileSearch/sessionUpdated"
  | "fuzzyFileSearch/sessionCompleted";

export interface DebugAppServerCoverageFuzzySessionNotificationSummary {
  method: DebugAppServerCoverageFuzzySessionNotificationMethod;
  sequence: number;
  sessionId: string;
  query: string | null;
  fileCount: number | null;
  receivedAtMilliseconds: number;
}

export interface DebugAppServerCoverageFuzzySessionNotificationMethodCount {
  method: DebugAppServerCoverageFuzzySessionNotificationMethod;
  count: number;
}

export interface DebugAppServerCoverageFuzzySessionNotificationsResult {
  sinceSequence: number | null;
  eventCount: number;
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
  events: DebugAppServerCoverageFuzzySessionNotificationSummary[];
  methodCounts: DebugAppServerCoverageFuzzySessionNotificationMethodCount[];
  readAtIso8601: string;
}

export type DebugAppServerCoverageModelRerouteReason = "highRiskCyberActivity";

export interface DebugAppServerCoverageModelReroutedSummary {
  sequence: number;
  threadId: string;
  turnId: string;
  fromModel: string;
  toModel: string;
  reason: DebugAppServerCoverageModelRerouteReason;
  receivedAtMilliseconds: number;
}

export interface DebugAppServerCoverageModelReroutedEventsResult {
  sinceSequence: number | null;
  eventCount: number;
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
  events: DebugAppServerCoverageModelReroutedSummary[];
  readAtIso8601: string;
}

export type DebugAppServerCoverageWarningNotificationMethod =
  | "configWarning"
  | "deprecationNotice"
  | "windows/worldWritableWarning";

export interface DebugAppServerCoverageWarningTextPosition {
  line: number;
  column: number;
}

export interface DebugAppServerCoverageWarningTextRange {
  start: DebugAppServerCoverageWarningTextPosition;
  end: DebugAppServerCoverageWarningTextPosition;
}

export interface DebugAppServerCoverageConfigWarningNotificationSummary {
  method: "configWarning";
  sequence: number;
  summary: string;
  details: string | null;
  path: string | null;
  range: DebugAppServerCoverageWarningTextRange | null;
  receivedAtMilliseconds: number;
}

export interface DebugAppServerCoverageDeprecationNoticeNotificationSummary {
  method: "deprecationNotice";
  sequence: number;
  summary: string;
  details: string | null;
  receivedAtMilliseconds: number;
}

export interface DebugAppServerCoverageWindowsWorldWritableWarningNotificationSummary {
  method: "windows/worldWritableWarning";
  sequence: number;
  samplePaths: string[];
  extraCount: number;
  failedScan: boolean;
  receivedAtMilliseconds: number;
}

export type DebugAppServerCoverageWarningNotificationSummary =
  | DebugAppServerCoverageConfigWarningNotificationSummary
  | DebugAppServerCoverageDeprecationNoticeNotificationSummary
  | DebugAppServerCoverageWindowsWorldWritableWarningNotificationSummary;

export interface DebugAppServerCoverageWarningNotificationMethodCount {
  method: DebugAppServerCoverageWarningNotificationMethod;
  count: number;
}

export interface DebugAppServerCoverageWarningNotificationsResult {
  sinceSequence: number | null;
  eventCount: number;
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
  events: DebugAppServerCoverageWarningNotificationSummary[];
  methodCounts: DebugAppServerCoverageWarningNotificationMethodCount[];
  readAtIso8601: string;
}

export type DebugAppServerCoverageThreadLifecycleNotificationMethod =
  | "thread/archived"
  | "thread/name/updated"
  | "thread/unarchived";

export interface DebugAppServerCoverageThreadLifecycleNotificationSummary {
  method: DebugAppServerCoverageThreadLifecycleNotificationMethod;
  sequence: number;
  threadId: string;
  threadName: string | null;
  receivedAtMilliseconds: number;
}

export interface DebugAppServerCoverageThreadLifecycleNotificationMethodCount {
  method: DebugAppServerCoverageThreadLifecycleNotificationMethod;
  count: number;
}

export interface DebugAppServerCoverageThreadLifecycleNotificationsResult {
  sinceSequence: number | null;
  eventCount: number;
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
  events: DebugAppServerCoverageThreadLifecycleNotificationSummary[];
  methodCounts: DebugAppServerCoverageThreadLifecycleNotificationMethodCount[];
  readAtIso8601: string;
}

export type DebugAppServerCoverageTurnLifecycleNotificationMethod =
  | "turn/completed"
  | "turn/diff/updated"
  | "turn/plan/updated"
  | "turn/started";

export type DebugAppServerCoverageTurnStatus =
  | "completed"
  | "interrupted"
  | "failed"
  | "inProgress";

export interface DebugAppServerCoverageTurnLifecycleNotificationSummary {
  method: DebugAppServerCoverageTurnLifecycleNotificationMethod;
  sequence: number;
  threadId: string;
  turnId: string;
  turnStatus: DebugAppServerCoverageTurnStatus | null;
  errorMessage: string | null;
  planStepCount: number | null;
  diffLineCount: number | null;
  explanation: string | null;
  receivedAtMilliseconds: number;
}

export interface DebugAppServerCoverageTurnLifecycleNotificationMethodCount {
  method: DebugAppServerCoverageTurnLifecycleNotificationMethod;
  count: number;
}

export interface DebugAppServerCoverageTurnLifecycleNotificationsResult {
  sinceSequence: number | null;
  eventCount: number;
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
  events: DebugAppServerCoverageTurnLifecycleNotificationSummary[];
  methodCounts: DebugAppServerCoverageTurnLifecycleNotificationMethodCount[];
  readAtIso8601: string;
}

export type DebugAppServerCoverageItemDeltaNotificationMethod =
  | "item/agentMessage/delta"
  | "item/commandExecution/outputDelta"
  | "item/commandExecution/terminalInteraction"
  | "item/fileChange/outputDelta"
  | "item/mcpToolCall/progress"
  | "item/plan/delta"
  | "item/reasoning/summaryPartAdded"
  | "item/reasoning/summaryTextDelta"
  | "item/reasoning/textDelta";

export interface DebugAppServerCoverageItemDeltaNotificationSummary {
  method: DebugAppServerCoverageItemDeltaNotificationMethod;
  sequence: number;
  threadId: string;
  turnId: string;
  itemId: string;
  detailText: string;
  detailIndex: number | null;
  processId: string | null;
  receivedAtMilliseconds: number;
}

export interface DebugAppServerCoverageItemDeltaNotificationMethodCount {
  method: DebugAppServerCoverageItemDeltaNotificationMethod;
  count: number;
}

export interface DebugAppServerCoverageItemDeltaNotificationsResult {
  sinceSequence: number | null;
  eventCount: number;
  totalDetailCharacterCount: number;
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
  events: DebugAppServerCoverageItemDeltaNotificationSummary[];
  methodCounts: DebugAppServerCoverageItemDeltaNotificationMethodCount[];
  readAtIso8601: string;
}

export interface DebugAppServerCoverageErrorNotificationSummary {
  sequence: number;
  threadId: string;
  turnId: string;
  message: string;
  codexErrorInfoSummary: string | null;
  additionalDetails: string | null;
  willRetry: boolean;
  receivedAtMilliseconds: number;
}

export interface DebugAppServerCoverageErrorNotificationsResult {
  sinceSequence: number | null;
  eventCount: number;
  retryCount: number;
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
  events: DebugAppServerCoverageErrorNotificationSummary[];
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
