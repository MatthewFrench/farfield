import { type JsonValue } from "@farfield/protocol";
import type {
  CapabilityAccountAuthStatusResponse,
  CapabilityAccountLoginStartResponse,
  CapabilityAccountRateLimitsResponse,
  CapabilityAccountResponse,
  CapabilityAccountUserInfoResponse,
  CapabilityAppsResponse,
  CapabilityCommandExecutionResponse,
  CapabilityConfigBatchWriteResponse,
  CapabilityConfigRequirementsResponse,
  CapabilityConfigValueWriteResponse,
  CapabilityConfigWriteMergeStrategy,
  CapabilityExperimentalFeaturesResponse,
  CapabilityFeedbackUploadResponse,
  CapabilityMcpServersResponse,
  CapabilityRemoteSkillsListResponse,
  CapabilitySkillsResponse,
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageAccount,
  DebugAppServerCoverageAppSummary,
  DebugAppServerCoverageAuthStatusSnapshot,
  DebugAppServerCoverageCommandExecutionResult,
  DebugAppServerCoverageConfigBatchWriteResult,
  DebugAppServerCoverageConfigValueWriteResult,
  DebugAppServerCoverageExperimentalFeature,
  DebugAppServerCoverageFeedbackUploadResult,
  DebugAppServerCoverageMcpServerSummary,
  DebugAppServerCoveragePendingAccountLogin,
  DebugAppServerCoverageRateLimitSnapshot,
  DebugAppServerCoverageRemoteSkillSummary,
  DebugAppServerCoverageRequirements,
  DebugAppServerCoverageSkillEntry,
  DebugAppServerCoverageUserInfoSnapshot,
} from "../DomainModel/DebugAppServerCoverageContracts";

function readAuthStatusLabel(authStatus: JsonValue): string {
  if (typeof authStatus === "string") {
    return authStatus;
  }
  if (authStatus === null) {
    return "null";
  }
  return JSON.stringify(authStatus);
}

export function mapRequirements(
  requirements: CapabilityConfigRequirementsResponse["requirements"],
): DebugAppServerCoverageRequirements | null {
  if (requirements === null) {
    return null;
  }
  return {
    allowedApprovalPolicies: requirements.allowedApprovalPolicies,
    allowedSandboxModes: requirements.allowedSandboxModes,
    allowedWebSearchModes: requirements.allowedWebSearchModes,
    enforceResidency: requirements.enforceResidency,
    network: requirements.network,
  };
}

export function mapAccount(
  account: CapabilityAccountResponse["account"],
): DebugAppServerCoverageAccount | null {
  if (account === null) {
    return null;
  }
  if (account.type === "apiKey") {
    return {
      type: "apiKey",
    };
  }
  return {
    type: "chatgpt",
    email: account.email,
    planType: account.planType,
  };
}

export function mapAuthStatus(
  response: CapabilityAccountAuthStatusResponse,
): DebugAppServerCoverageAuthStatusSnapshot | null {
  return {
    authMethod: response.authMethod,
    authToken: response.authToken,
    requiresOpenaiAuth: response.requiresOpenaiAuth,
  };
}

export function mapUserInfo(
  response: CapabilityAccountUserInfoResponse,
): DebugAppServerCoverageUserInfoSnapshot | null {
  return {
    allegedUserEmail: response.allegedUserEmail,
  };
}

export function mapRateLimitSnapshot(
  snapshot: CapabilityAccountRateLimitsResponse["rateLimits"],
): DebugAppServerCoverageRateLimitSnapshot | null {
  if (snapshot === null) {
    return null;
  }
  return {
    credits: snapshot.credits,
    limitId: snapshot.limitId,
    limitName: snapshot.limitName,
    planType: snapshot.planType,
    primary: snapshot.primary,
    secondary: snapshot.secondary,
  };
}

export function mapPendingAccountLogin(
  response: CapabilityAccountLoginStartResponse,
): DebugAppServerCoveragePendingAccountLogin | null {
  if (response.type !== "chatgpt") {
    return null;
  }
  return {
    loginId: response.loginId,
    authUrl: response.authUrl,
  };
}

export function mapExperimentalFeatures(
  data: CapabilityExperimentalFeaturesResponse["data"],
): DebugAppServerCoverageExperimentalFeature[] {
  return data.map((feature) => ({
    name: feature.name,
    stage: feature.stage,
    displayName: feature.displayName,
    description: feature.description,
    announcement: feature.announcement,
    enabled: feature.enabled,
    defaultEnabled: feature.defaultEnabled,
  }));
}

export function mapMcpServers(
  data: CapabilityMcpServersResponse["data"],
): DebugAppServerCoverageMcpServerSummary[] {
  return data.map((server) => ({
    name: server.name,
    authStatus: readAuthStatusLabel(server.authStatus),
    toolCount: server.toolCount,
    resourceCount: server.resourceCount,
    resourceTemplateCount: server.resourceTemplateCount,
  }));
}

export function mapApps(data: CapabilityAppsResponse["data"]): DebugAppServerCoverageAppSummary[] {
  return data.map((appInfo) => ({
    id: appInfo.id,
    name: appInfo.name,
    description: appInfo.description,
    isAccessible: appInfo.isAccessible,
    isEnabled: appInfo.isEnabled,
  }));
}

export function mapSkills(
  data: CapabilitySkillsResponse["data"],
): DebugAppServerCoverageSkillEntry[] {
  return data.map((entry) => ({
    cwd: entry.cwd,
    skills: entry.skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      path: skill.path,
      scope: skill.scope,
      enabled: skill.enabled,
    })),
    errorCount: entry.errors.length,
  }));
}

export function mapRemoteSkills(
  data: CapabilityRemoteSkillsListResponse["data"],
): DebugAppServerCoverageRemoteSkillSummary[] {
  return data.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
  }));
}

export function mapCommandExecutionResult(
  response: CapabilityCommandExecutionResponse,
  command: string[],
): DebugAppServerCoverageCommandExecutionResult {
  return {
    command,
    exitCode: response.exitCode,
    stdout: response.stdout,
    stderr: response.stderr,
    executedAtIso8601: new Date().toISOString(),
  };
}

export function mapConfigValueWriteResult(
  response: CapabilityConfigValueWriteResponse,
  keyPath: string,
  mergeStrategy: CapabilityConfigWriteMergeStrategy,
  value: JsonValue,
): DebugAppServerCoverageConfigValueWriteResult {
  return {
    keyPath,
    mergeStrategy,
    valueSummary: JSON.stringify(value),
    status: response.status,
    version: response.version,
    filePath: response.filePath,
    overriddenMessage: response.overriddenMetadata?.message ?? null,
    writtenAtIso8601: new Date().toISOString(),
  };
}

export function mapConfigBatchWriteResult(
  response: CapabilityConfigBatchWriteResponse,
  editCount: number,
): DebugAppServerCoverageConfigBatchWriteResult {
  return {
    editCount,
    status: response.status,
    version: response.version,
    filePath: response.filePath,
    overriddenMessage: response.overriddenMetadata?.message ?? null,
    writtenAtIso8601: new Date().toISOString(),
  };
}

export function mapFeedbackUploadResult(
  response: CapabilityFeedbackUploadResponse,
  classification: string,
  includeLogs: boolean,
  reason: string | null,
  requestedThreadId: string | null,
): DebugAppServerCoverageFeedbackUploadResult {
  return {
    classification,
    includeLogs,
    reason,
    requestedThreadId,
    reportedThreadId: response.threadId,
    uploadedAtIso8601: new Date().toISOString(),
  };
}
