import type {
  AppServerCollaborationModeListResponse,
  AppServerListModelsResponse,
  AppServerListThreadsResponse,
  AppServerReadThreadResponse,
  AppServerStartThreadResponse,
  CollaborationMode,
  IpcFrame,
  JsonValue,
  ThreadConversationRequestResponse,
} from "@farfield/protocol";

/**
 * Owns canonical cross-adapter server contracts used by routing, thread ownership,
 * and runtime composition modules.
 */
export type AgentId = "codex" | "opencode";

// Agent identifiers are shared across route parsing, adapter selection, and ownership caches.
// Keep the literals centralized in this contract owner to prevent drift.
export const AgentIdentifierByName: {
  codex: AgentId;
  opencode: AgentId;
} = {
  codex: "codex",
  opencode: "opencode",
};

export const AgentIdentifierValues: ReadonlyArray<AgentId> = [
  AgentIdentifierByName.codex,
  AgentIdentifierByName.opencode,
];

export type AgentThreadListSortKey = "created_at" | "updated_at";

export const AgentThreadListSortKeyByName: {
  createdAt: AgentThreadListSortKey;
  updatedAt: AgentThreadListSortKey;
} = {
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export const AgentThreadListSortKeyValues: ReadonlyArray<AgentThreadListSortKey> = [
  AgentThreadListSortKeyByName.createdAt,
  AgentThreadListSortKeyByName.updatedAt,
];

export interface AgentCapabilities {
  canListModels: boolean;
  canListCollaborationModes: boolean;
  canReadConfigRequirements: boolean;
  canListExperimentalFeatures: boolean;
  canListMcpServerStatuses: boolean;
  canListApps: boolean;
  canListSkills: boolean;
  canReadAccount: boolean;
  canReadAccountRateLimits: boolean;
  canExecuteCommand: boolean;
  canStartAccountLogin: boolean;
  canCancelAccountLogin: boolean;
  canLogoutAccount: boolean;
  canReloadMcpServerConfig: boolean;
  canStartMcpServerOauthLogin: boolean;
  canWriteConfigValue: boolean;
  canWriteSkillsConfig: boolean;
  canSetCollaborationMode: boolean;
  canSubmitUserInput: boolean;
  canReadLiveState: boolean;
  canReadStreamEvents: boolean;
}

export interface AgentListThreadsInput {
  limit: number;
  archived: boolean;
  all: boolean;
  maxPages: number;
  cursor: string | null;
  sortKey: AgentThreadListSortKey;
  cwd: string | null;
}

export interface AgentCreateThreadInput {
  cwd?: string;
  model?: string;
  modelProvider?: string;
  personality?: string;
  sandbox?: string;
  approvalPolicy?: string;
  ephemeral?: boolean;
}

export type AgentThreadListItem = AppServerListThreadsResponse["data"][number];
export type AgentThreadConversationState = AppServerReadThreadResponse["thread"];
export type AgentCreatedThread = AppServerStartThreadResponse["thread"];
export type AgentCreatedThreadModel = AppServerStartThreadResponse["model"];
export type AgentCreatedThreadModelProvider = AppServerStartThreadResponse["modelProvider"];
export type AgentCreatedThreadWorkingDirectory = AppServerStartThreadResponse["cwd"];
export type AgentCreatedThreadApprovalPolicy = AppServerStartThreadResponse["approvalPolicy"];
export type AgentCreatedThreadSandbox = AppServerStartThreadResponse["sandbox"];
export type AgentCreatedThreadReasoningEffort = AppServerStartThreadResponse["reasoningEffort"];

export interface AgentListThreadsResult {
  data: AgentThreadListItem[];
  nextCursor: string | null;
  pages?: number;
  truncated?: boolean;
}

export interface AgentCreateThreadResult {
  threadId: string;
  thread: AgentCreatedThread;
  model?: AgentCreatedThreadModel;
  modelProvider?: AgentCreatedThreadModelProvider;
  cwd?: AgentCreatedThreadWorkingDirectory;
  approvalPolicy?: AgentCreatedThreadApprovalPolicy;
  sandbox?: AgentCreatedThreadSandbox;
  reasoningEffort?: AgentCreatedThreadReasoningEffort;
}

export interface AgentReadThreadResult {
  thread: AgentThreadConversationState;
}

export interface AgentReadThreadInput {
  threadId: string;
  includeTurns: boolean;
}

export interface AgentSendMessageInput {
  threadId: string;
  text: string;
  ownerClientId?: string;
  cwd?: string;
  isSteering?: boolean;
}

export interface AgentSetCollaborationModeInput {
  threadId: string;
  ownerClientId?: string;
  collaborationMode: CollaborationMode;
}

export interface AgentSubmitUserInputInput {
  threadId: string;
  ownerClientId?: string;
  requestId: number;
  response: ThreadConversationRequestResponse;
}

export interface AgentInterruptInput {
  threadId: string;
  ownerClientId?: string;
}

export interface AgentForkThreadInput {
  threadId: string;
}

export interface AgentSetThreadNameInput {
  threadId: string;
  name: string;
}

export interface AgentRollbackThreadInput {
  threadId: string;
  numTurns: number;
}

export interface AgentCompactThreadInput {
  threadId: string;
}

export interface AgentCleanThreadBackgroundTerminalsInput {
  threadId: string;
}

export interface AgentUnsubscribeThreadInput {
  threadId: string;
}

export type AgentUnsubscribeThreadStatus = "notLoaded" | "notSubscribed" | "unsubscribed";

export type AgentThreadReviewDelivery = "inline" | "detached";

export interface AgentThreadReviewUncommittedChangesTarget {
  type: "uncommittedChanges";
}

export interface AgentThreadReviewBaseBranchTarget {
  type: "baseBranch";
  branch: string;
}

export interface AgentThreadReviewCommitTarget {
  type: "commit";
  sha: string;
  title?: string | null | undefined;
}

export interface AgentThreadReviewCustomTarget {
  type: "custom";
  instructions: string;
}

export type AgentThreadReviewTarget =
  | AgentThreadReviewUncommittedChangesTarget
  | AgentThreadReviewBaseBranchTarget
  | AgentThreadReviewCommitTarget
  | AgentThreadReviewCustomTarget;

export interface AgentStartThreadReviewInput {
  threadId: string;
  target: AgentThreadReviewTarget;
  delivery?: AgentThreadReviewDelivery | null;
}

export interface AgentStartThreadReviewResult {
  reviewThreadId: string;
  turnId: string;
}

export interface AgentArchiveThreadInput {
  threadId: string;
}

export interface AgentUnarchiveThreadInput {
  threadId: string;
}

export type AgentThreadLiveStateErrorKind = "reductionFailed";

export const AgentThreadLiveStateErrorKindByName: {
  reductionFailed: AgentThreadLiveStateErrorKind;
} = {
  reductionFailed: "reductionFailed",
};

export interface AgentThreadLiveStateError {
  kind: AgentThreadLiveStateErrorKind;
  message: string;
  eventIndex: number | null;
  patchIndex: number | null;
}

export interface AgentThreadLiveState {
  ownerClientId: string | null;
  conversationState: AgentThreadConversationState | null;
  liveStateError: AgentThreadLiveStateError | null;
}

export interface AgentThreadStreamEvents {
  ownerClientId: string | null;
  events: IpcFrame[];
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
}

export interface AgentReadStreamEventsInput {
  limit: number;
  sinceSequence: number | null;
}

export interface AgentDescriptor {
  id: AgentId;
  label: string;
  enabled: boolean;
  connected: boolean;
  capabilities: AgentCapabilities;
  projectDirectories: string[];
}

export interface AgentConfigDefaults {
  model: string | null;
  reasoningEffort: string | null;
}

export interface AgentListLoadedThreadsResult {
  data: string[];
  nextCursor: string | null;
}

export interface AgentReadConfigRequirementsNetwork {
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

export interface AgentReadConfigRequirementsInput {}

export interface AgentReadConfigRequirements {
  allowedApprovalPolicies: string[] | null;
  allowedSandboxModes: string[] | null;
  allowedWebSearchModes: string[] | null;
  enforceResidency: string | null;
  network: AgentReadConfigRequirementsNetwork | null;
}

export interface AgentReadConfigRequirementsResult {
  requirements: AgentReadConfigRequirements | null;
}

export interface AgentListExperimentalFeaturesInput {
  limit?: number | null;
  cursor?: string | null;
}

export type AgentExperimentalFeatureStage =
  | "beta"
  | "underDevelopment"
  | "stable"
  | "deprecated"
  | "removed";

export interface AgentExperimentalFeature {
  name: string;
  stage: AgentExperimentalFeatureStage;
  displayName: string | null;
  description: string | null;
  announcement: string | null;
  enabled: boolean;
  defaultEnabled: boolean;
}

export interface AgentListExperimentalFeaturesResult {
  data: AgentExperimentalFeature[];
  nextCursor: string | null;
}

export interface AgentListMcpServerStatusesInput {
  limit?: number | null;
  cursor?: string | null;
}

export interface AgentMcpServerStatusSummary {
  name: string;
  authStatus: JsonValue;
  toolCount: number;
  resourceCount: number;
  resourceTemplateCount: number;
}

export interface AgentListMcpServerStatusesResult {
  data: AgentMcpServerStatusSummary[];
  nextCursor: string | null;
}

export interface AgentListAppsInput {
  limit?: number | null;
  cursor?: string | null;
  threadId?: string | null;
  forceRefetch?: boolean;
}

export interface AgentAppInfoSummary {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  logoUrlDark: string | null;
  installUrl: string | null;
  isAccessible: boolean;
  isEnabled: boolean;
}

export interface AgentListAppsResult {
  data: AgentAppInfoSummary[];
  nextCursor: string | null;
}

export interface AgentSkillsListExtraRootsForCwdInput {
  cwd: string;
  extraUserRoots: string[];
}

export interface AgentListSkillsInput {
  cwds?: string[];
  forceReload?: boolean;
  perCwdExtraUserRoots?: AgentSkillsListExtraRootsForCwdInput[] | null;
}

export type AgentSkillScope = "user" | "repo" | "system" | "admin";

export interface AgentSkillSummary {
  name: string;
  description: string;
  shortDescription: string | null;
  path: string;
  scope: AgentSkillScope;
  enabled: boolean;
}

export interface AgentSkillErrorSummary {
  path: string;
  message: string;
}

export interface AgentSkillsListEntrySummary {
  cwd: string;
  skills: AgentSkillSummary[];
  errors: AgentSkillErrorSummary[];
}

export interface AgentListSkillsResult {
  data: AgentSkillsListEntrySummary[];
}

export interface AgentReadAccountInput {
  refreshToken?: boolean;
}

export type AgentAccountPlanType =
  | "free"
  | "go"
  | "plus"
  | "pro"
  | "team"
  | "business"
  | "enterprise"
  | "edu"
  | "unknown";

export interface AgentApiKeyAccount {
  type: "apiKey";
}

export interface AgentChatgptAccount {
  type: "chatgpt";
  email: string;
  planType: AgentAccountPlanType;
}

export type AgentAccount = AgentApiKeyAccount | AgentChatgptAccount;

export interface AgentReadAccountResult {
  account: AgentAccount | null;
  requiresOpenaiAuth: boolean;
}

export interface AgentReadAccountRateLimitsInput {}

export interface AgentAccountCreditsSnapshot {
  balance: string | null;
  hasCredits: boolean;
  unlimited: boolean;
}

export interface AgentAccountRateLimitWindow {
  resetsAt: number | null;
  usedPercent: number;
  windowDurationMins: number | null;
}

export interface AgentAccountRateLimitSnapshot {
  credits: AgentAccountCreditsSnapshot | null;
  limitId: string | null;
  limitName: string | null;
  planType: AgentAccountPlanType | null;
  primary: AgentAccountRateLimitWindow | null;
  secondary: AgentAccountRateLimitWindow | null;
}

export interface AgentReadAccountRateLimitsResult {
  rateLimits: AgentAccountRateLimitSnapshot;
  rateLimitsByLimitId: Record<string, AgentAccountRateLimitSnapshot> | null;
}

export interface AgentCommandExecutionInput {
  command: string[];
  timeoutMilliseconds?: number;
  cwd?: string;
}

export interface AgentCommandExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface AgentUploadFeedbackInput {
  classification: string;
  reason?: string | null;
  threadId?: string | null;
  includeLogs: boolean;
}

export interface AgentUploadFeedbackResult {
  threadId: string;
}

export type AgentConfigWriteMergeStrategy = "replace" | "upsert";

export interface AgentWriteConfigValueInput {
  keyPath: string;
  value: JsonValue;
  mergeStrategy: AgentConfigWriteMergeStrategy;
  filePath?: string;
  expectedVersion?: string;
}

export interface AgentConfigBatchWriteEdit {
  keyPath: string;
  value: JsonValue;
  mergeStrategy: AgentConfigWriteMergeStrategy;
}

export interface AgentWriteConfigBatchInput {
  edits: AgentConfigBatchWriteEdit[];
  filePath?: string;
  expectedVersion?: string;
}

export type AgentConfigWriteStatus = "ok" | "okOverridden";

export interface AgentConfigWriteOverriddenMetadata {
  message: string;
  overridingLayer: JsonValue;
  effectiveValue: JsonValue;
}

export interface AgentWriteConfigValueResult {
  status: AgentConfigWriteStatus;
  version: string;
  filePath: string;
  overriddenMetadata: AgentConfigWriteOverriddenMetadata | null;
}

export interface AgentStartAccountLoginWithApiKeyInput {
  type: "apiKey";
  apiKey: string;
}

export interface AgentStartAccountLoginWithChatgptInput {
  type: "chatgpt";
}

export interface AgentStartAccountLoginWithChatgptAuthTokensInput {
  type: "chatgptAuthTokens";
  accessToken: string;
  chatgptAccountId: string;
  chatgptPlanType?: AgentAccountPlanType | null;
}

export type AgentStartAccountLoginInput =
  | AgentStartAccountLoginWithApiKeyInput
  | AgentStartAccountLoginWithChatgptInput
  | AgentStartAccountLoginWithChatgptAuthTokensInput;

export interface AgentStartAccountLoginWithApiKeyResult {
  type: "apiKey";
}

export interface AgentStartAccountLoginWithChatgptResult {
  type: "chatgpt";
  loginId: string;
  authUrl: string;
}

export interface AgentStartAccountLoginWithChatgptAuthTokensResult {
  type: "chatgptAuthTokens";
}

export type AgentStartAccountLoginResult =
  | AgentStartAccountLoginWithApiKeyResult
  | AgentStartAccountLoginWithChatgptResult
  | AgentStartAccountLoginWithChatgptAuthTokensResult;

export interface AgentCancelAccountLoginInput {
  loginId: string;
}

export type AgentCancelAccountLoginStatus = "canceled" | "notFound";

export interface AgentCancelAccountLoginResult {
  status: AgentCancelAccountLoginStatus;
}

export interface AgentStartMcpServerOauthLoginInput {
  name: string;
  scopes?: string[] | null;
  timeoutSeconds?: number | null;
}

export interface AgentStartMcpServerOauthLoginResult {
  authorizationUrl: string;
}

export interface AgentWriteSkillsConfigInput {
  path: string;
  enabled: boolean;
}

export interface AgentWriteSkillsConfigResult {
  effectiveEnabled: boolean;
}

export type AgentRemoteSkillsHazelnutScope =
  | "example"
  | "workspace-shared"
  | "all-shared"
  | "personal";
export type AgentRemoteSkillsProductSurface = "chatgpt" | "codex" | "api" | "atlas";

export interface AgentListRemoteSkillsInput {
  hazelnutScope: AgentRemoteSkillsHazelnutScope;
  productSurface: AgentRemoteSkillsProductSurface;
  enabled: boolean;
}

export interface AgentRemoteSkillSummary {
  id: string;
  name: string;
  description: string;
}

export interface AgentListRemoteSkillsResult {
  data: AgentRemoteSkillSummary[];
}

export interface AgentExportRemoteSkillInput {
  hazelnutId: string;
}

export interface AgentExportRemoteSkillResult {
  id: string;
  path: string;
}

export interface AgentSetCollaborationModeResult {
  ownerClientId: string;
}

export interface AgentSubmitUserInputResult {
  ownerClientId: string;
  requestId: number;
}

export interface AgentAdapter {
  readonly id: AgentId;
  readonly label: string;
  readonly capabilities: AgentCapabilities;

  start(): Promise<void>;
  stop(): Promise<void>;
  isEnabled(): boolean;
  isConnected(): boolean;

  listThreads(input: AgentListThreadsInput): Promise<AgentListThreadsResult>;
  createThread(input: AgentCreateThreadInput): Promise<AgentCreateThreadResult>;
  readThread(input: AgentReadThreadInput): Promise<AgentReadThreadResult>;
  sendMessage(input: AgentSendMessageInput): Promise<void>;
  interrupt(input: AgentInterruptInput): Promise<void>;
  forkThread?(input: AgentForkThreadInput): Promise<AgentCreateThreadResult>;
  setThreadName?(input: AgentSetThreadNameInput): Promise<void>;
  rollbackThread?(input: AgentRollbackThreadInput): Promise<AgentReadThreadResult>;
  compactThread?(input: AgentCompactThreadInput): Promise<void>;
  cleanThreadBackgroundTerminals?(input: AgentCleanThreadBackgroundTerminalsInput): Promise<void>;
  unsubscribeThread?(input: AgentUnsubscribeThreadInput): Promise<AgentUnsubscribeThreadStatus>;
  startThreadReview?(input: AgentStartThreadReviewInput): Promise<AgentStartThreadReviewResult>;
  archiveThread?(input: AgentArchiveThreadInput): Promise<void>;
  unarchiveThread?(input: AgentUnarchiveThreadInput): Promise<void>;
  listLoadedThreads?(): Promise<AgentListLoadedThreadsResult>;
  readConfigRequirements?(
    input?: AgentReadConfigRequirementsInput,
  ): Promise<AgentReadConfigRequirementsResult>;
  listExperimentalFeatures?(
    input?: AgentListExperimentalFeaturesInput,
  ): Promise<AgentListExperimentalFeaturesResult>;
  listMcpServerStatuses?(
    input?: AgentListMcpServerStatusesInput,
  ): Promise<AgentListMcpServerStatusesResult>;
  listApps?(input?: AgentListAppsInput): Promise<AgentListAppsResult>;
  listSkills?(input?: AgentListSkillsInput): Promise<AgentListSkillsResult>;
  readAccount?(input?: AgentReadAccountInput): Promise<AgentReadAccountResult>;
  readAccountRateLimits?(
    input?: AgentReadAccountRateLimitsInput,
  ): Promise<AgentReadAccountRateLimitsResult>;
  uploadFeedback?(input: AgentUploadFeedbackInput): Promise<AgentUploadFeedbackResult>;
  executeCommand?(input: AgentCommandExecutionInput): Promise<AgentCommandExecutionResult>;
  startAccountLogin?(input: AgentStartAccountLoginInput): Promise<AgentStartAccountLoginResult>;
  cancelAccountLogin?(input: AgentCancelAccountLoginInput): Promise<AgentCancelAccountLoginResult>;
  logoutAccount?(): Promise<void>;
  reloadMcpServerConfig?(): Promise<void>;
  startMcpServerOauthLogin?(
    input: AgentStartMcpServerOauthLoginInput,
  ): Promise<AgentStartMcpServerOauthLoginResult>;
  writeConfigBatch?(input: AgentWriteConfigBatchInput): Promise<AgentWriteConfigValueResult>;
  writeConfigValue?(input: AgentWriteConfigValueInput): Promise<AgentWriteConfigValueResult>;
  writeSkillsConfig?(input: AgentWriteSkillsConfigInput): Promise<AgentWriteSkillsConfigResult>;
  listRemoteSkills?(input: AgentListRemoteSkillsInput): Promise<AgentListRemoteSkillsResult>;
  exportRemoteSkill?(input: AgentExportRemoteSkillInput): Promise<AgentExportRemoteSkillResult>;

  listModels?(limit: number): Promise<AppServerListModelsResponse>;
  listCollaborationModes?(): Promise<AppServerCollaborationModeListResponse>;
  setCollaborationMode?(
    input: AgentSetCollaborationModeInput,
  ): Promise<AgentSetCollaborationModeResult>;
  submitUserInput?(input: AgentSubmitUserInputInput): Promise<AgentSubmitUserInputResult>;
  readLiveState?(threadId: string): Promise<AgentThreadLiveState>;
  readStreamEvents?(
    threadId: string,
    input: AgentReadStreamEventsInput,
  ): Promise<AgentThreadStreamEvents>;
  isThreadNotLoadedError?(error: Error): boolean;
  listProjectDirectories?(): Promise<string[]>;
  readConfigDefaults?(): Promise<AgentConfigDefaults>;
}
