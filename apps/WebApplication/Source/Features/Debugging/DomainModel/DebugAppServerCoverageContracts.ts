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
  accountRateLimits: DebugAppServerCoverageRateLimitSnapshot | null;
  experimentalFeatures: DebugAppServerCoverageExperimentalFeature[];
  mcpServers: DebugAppServerCoverageMcpServerSummary[];
  apps: DebugAppServerCoverageAppSummary[];
  skills: DebugAppServerCoverageSkillEntry[];
  remoteSkills: DebugAppServerCoverageRemoteSkillSummary[];
  refreshedAtIso8601: string;
}
