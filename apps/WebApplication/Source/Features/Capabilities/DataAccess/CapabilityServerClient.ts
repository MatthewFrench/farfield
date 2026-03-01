import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import {
  type ApiAccountLoginCancelOptions,
  type ApiAccountLoginCancelResponse,
  type ApiAccountLoginStartOptions,
  type ApiAccountLoginStartResponse,
  type ApiAccountLogoutOptions,
  type ApiAccountOptions,
  type ApiAccountRateLimitsOptions,
  type ApiAccountRateLimitsResponse,
  type ApiAccountResponse,
  type ApiAgentsResponse,
  type ApiAppsResponse,
  type ApiCollaborationModesResponse,
  type ApiConfigDefaultsOptions,
  type ApiConfigDefaultsResponse,
  type ApiConfigMcpServerReloadOptions,
  type ApiConfigRequirementsOptions,
  type ApiConfigRequirementsResponse,
  type ApiExperimentalFeaturesResponse,
  type ApiHealthResponse,
  type ApiListAppsOptions,
  type ApiListPageOptions,
  type ApiListSkillsOptions,
  type ApiMcpServersResponse,
  type ApiModelsResponse,
  type ApiMutationSuccessResponse,
  type ApiSkillsResponse,
  cancelAccountLogin,
  getAccount,
  getAccountRateLimits,
  getConfigDefaults,
  getConfigRequirements,
  getHealth,
  listAgents,
  listApps,
  listCollaborationModes,
  listExperimentalFeatures,
  listMcpServers,
  listModels,
  listSkills,
  logoutAccount,
  reloadMcpServerConfig,
  startAccountLogin,
} from "./CapabilityApi";
import {
  type ApiExternalAgentConfigDetectOptions,
  type ApiExternalAgentConfigDetectResponse,
  type ApiExternalAgentConfigImportOptions,
  type ApiExternalAgentConfigImportResponse,
  detectExternalAgentConfig,
  importExternalAgentConfig,
} from "./CapabilityCoverageExternalAgentConfigApi";
import {
  type ApiFuzzyFileSearchOptions,
  type ApiFuzzyFileSearchResponse,
  type ApiFuzzyFileSearchSessionStartOptions,
  type ApiFuzzyFileSearchSessionStartResponse,
  type ApiFuzzyFileSearchSessionStopOptions,
  type ApiFuzzyFileSearchSessionStopResponse,
  type ApiFuzzyFileSearchSessionUpdateOptions,
  type ApiFuzzyFileSearchSessionUpdateResponse,
  searchFuzzyFiles,
  startFuzzyFileSearchSession,
  stopFuzzyFileSearchSession,
  updateFuzzyFileSearchSession,
} from "./CapabilityCoverageFuzzyFileSearchApi";
import {
  type ApiAccountAuthStatusOptions,
  type ApiAccountAuthStatusResponse,
  type ApiAccountUserInfoOptions,
  type ApiAccountUserInfoResponse,
  type ApiCommandExecutionOptions,
  type ApiCommandExecutionResponse,
  type ApiConfigBatchWriteOptions,
  type ApiConfigBatchWriteResponse,
  type ApiConfigValueWriteOptions,
  type ApiConfigValueWriteResponse,
  type ApiConfigWriteMergeStrategy,
  type ApiExportRemoteSkillOptions,
  type ApiFeedbackUploadOptions,
  type ApiFeedbackUploadResponse,
  type ApiGitDiffToRemoteOptions,
  type ApiGitDiffToRemoteResponse,
  type ApiListRemoteSkillsOptions,
  type ApiMcpServerOauthLoginOptions,
  type ApiMcpServerOauthLoginResponse,
  type ApiRemoteSkillExportResponse,
  type ApiRemoteSkillsListResponse,
  type ApiSkillsConfigWriteOptions,
  type ApiSkillsConfigWriteResponse,
  executeCommand,
  exportRemoteSkill,
  listRemoteSkills,
  readAccountAuthStatus,
  readAccountUserInfo,
  readGitDiffToRemote,
  startMcpServerOauthLogin,
  uploadFeedback,
  writeConfigBatch,
  writeConfigValue,
  writeSkillsConfig,
} from "./CapabilityCoverageMutationApi";
import {
  type ApiThreadRealtimeAppendAudioOptions,
  type ApiThreadRealtimeAppendAudioResponse,
  type ApiThreadRealtimeAppendTextOptions,
  type ApiThreadRealtimeAppendTextResponse,
  type ApiThreadRealtimeStartOptions,
  type ApiThreadRealtimeStartResponse,
  type ApiThreadRealtimeStopOptions,
  type ApiThreadRealtimeStopResponse,
  appendThreadRealtimeAudio,
  appendThreadRealtimeText,
  startThreadRealtime,
  stopThreadRealtime,
} from "./CapabilityCoverageThreadRealtimeApi";
import {
  type ApiReadThreadStreamEventsOptions,
  type ApiThreadStreamEventsResponse,
  readThreadStreamEvents,
} from "./CapabilityCoverageThreadStreamEventsApi";
import {
  type ApiWindowsSandboxSetupMode,
  type ApiWindowsSandboxSetupStartOptions,
  type ApiWindowsSandboxSetupStartResponse,
  startWindowsSandboxSetup,
} from "./CapabilityCoverageWindowsSandboxApi";

export type CapabilityRequestOptions = ApiRequestOptions;
export type CapabilityHealthResponse = ApiHealthResponse;
export type CapabilityAgentsResponse = ApiAgentsResponse;
export type CapabilityAccountOptions = ApiAccountOptions;
export type CapabilityAccountLoginStartOptions = ApiAccountLoginStartOptions;
export type CapabilityAccountLoginStartResponse = ApiAccountLoginStartResponse;
export type CapabilityAccountLoginCancelOptions = ApiAccountLoginCancelOptions;
export type CapabilityAccountLoginCancelResponse = ApiAccountLoginCancelResponse;
export type CapabilityAccountLogoutOptions = ApiAccountLogoutOptions;
export type CapabilityAccountRateLimitsOptions = ApiAccountRateLimitsOptions;
export type CapabilityAccountResponse = ApiAccountResponse;
export type CapabilityAccountRateLimitsResponse = ApiAccountRateLimitsResponse;
export type CapabilityCollaborationModesResponse = ApiCollaborationModesResponse;
export type CapabilityModelsResponse = ApiModelsResponse;
export type CapabilityConfigDefaultsOptions = ApiConfigDefaultsOptions;
export type CapabilityConfigDefaultsResponse = ApiConfigDefaultsResponse;
export type CapabilityConfigMcpServerReloadOptions = ApiConfigMcpServerReloadOptions;
export type CapabilityConfigRequirementsOptions = ApiConfigRequirementsOptions;
export type CapabilityConfigRequirementsResponse = ApiConfigRequirementsResponse;
export type CapabilityListPageOptions = ApiListPageOptions;
export type CapabilityExperimentalFeaturesResponse = ApiExperimentalFeaturesResponse;
export type CapabilityMcpServersResponse = ApiMcpServersResponse;
export type CapabilityMcpServerOauthLoginOptions = ApiMcpServerOauthLoginOptions;
export type CapabilityMcpServerOauthLoginResponse = ApiMcpServerOauthLoginResponse;
export type CapabilityCommandExecutionOptions = ApiCommandExecutionOptions;
export type CapabilityCommandExecutionResponse = ApiCommandExecutionResponse;
export type CapabilityAccountAuthStatusOptions = ApiAccountAuthStatusOptions;
export type CapabilityAccountAuthStatusResponse = ApiAccountAuthStatusResponse;
export type CapabilityAccountUserInfoOptions = ApiAccountUserInfoOptions;
export type CapabilityAccountUserInfoResponse = ApiAccountUserInfoResponse;
export type CapabilityConfigWriteMergeStrategy = ApiConfigWriteMergeStrategy;
export type CapabilityConfigBatchWriteOptions = ApiConfigBatchWriteOptions;
export type CapabilityConfigBatchWriteResponse = ApiConfigBatchWriteResponse;
export type CapabilityConfigValueWriteOptions = ApiConfigValueWriteOptions;
export type CapabilityConfigValueWriteResponse = ApiConfigValueWriteResponse;
export type CapabilityFeedbackUploadOptions = ApiFeedbackUploadOptions;
export type CapabilityFeedbackUploadResponse = ApiFeedbackUploadResponse;
export type CapabilityFuzzyFileSearchOptions = ApiFuzzyFileSearchOptions;
export type CapabilityFuzzyFileSearchResponse = ApiFuzzyFileSearchResponse;
export type CapabilityFuzzyFileSearchSessionStartOptions = ApiFuzzyFileSearchSessionStartOptions;
export type CapabilityFuzzyFileSearchSessionStartResponse = ApiFuzzyFileSearchSessionStartResponse;
export type CapabilityFuzzyFileSearchSessionUpdateOptions = ApiFuzzyFileSearchSessionUpdateOptions;
export type CapabilityFuzzyFileSearchSessionUpdateResponse =
  ApiFuzzyFileSearchSessionUpdateResponse;
export type CapabilityFuzzyFileSearchSessionStopOptions = ApiFuzzyFileSearchSessionStopOptions;
export type CapabilityFuzzyFileSearchSessionStopResponse = ApiFuzzyFileSearchSessionStopResponse;
export type CapabilityGitDiffToRemoteOptions = ApiGitDiffToRemoteOptions;
export type CapabilityGitDiffToRemoteResponse = ApiGitDiffToRemoteResponse;
export type CapabilityListRemoteSkillsOptions = ApiListRemoteSkillsOptions;
export type CapabilityRemoteSkillsListResponse = ApiRemoteSkillsListResponse;
export type CapabilityExportRemoteSkillOptions = ApiExportRemoteSkillOptions;
export type CapabilityRemoteSkillExportResponse = ApiRemoteSkillExportResponse;
export type CapabilityExternalAgentConfigDetectOptions = ApiExternalAgentConfigDetectOptions;
export type CapabilityExternalAgentConfigDetectResponse = ApiExternalAgentConfigDetectResponse;
export type CapabilityExternalAgentConfigImportOptions = ApiExternalAgentConfigImportOptions;
export type CapabilityExternalAgentConfigImportResponse = ApiExternalAgentConfigImportResponse;
export type CapabilityThreadRealtimeStartOptions = ApiThreadRealtimeStartOptions;
export type CapabilityThreadRealtimeStartResponse = ApiThreadRealtimeStartResponse;
export type CapabilityThreadRealtimeAppendAudioOptions = ApiThreadRealtimeAppendAudioOptions;
export type CapabilityThreadRealtimeAppendAudioResponse = ApiThreadRealtimeAppendAudioResponse;
export type CapabilityThreadRealtimeAppendTextOptions = ApiThreadRealtimeAppendTextOptions;
export type CapabilityThreadRealtimeAppendTextResponse = ApiThreadRealtimeAppendTextResponse;
export type CapabilityThreadRealtimeStopOptions = ApiThreadRealtimeStopOptions;
export type CapabilityThreadRealtimeStopResponse = ApiThreadRealtimeStopResponse;
export type CapabilityWindowsSandboxSetupMode = ApiWindowsSandboxSetupMode;
export type CapabilityWindowsSandboxSetupStartOptions = ApiWindowsSandboxSetupStartOptions;
export type CapabilityWindowsSandboxSetupStartResponse = ApiWindowsSandboxSetupStartResponse;
export type CapabilityReadThreadStreamEventsOptions = ApiReadThreadStreamEventsOptions;
export type CapabilityThreadStreamEventsResponse = ApiThreadStreamEventsResponse;
export type CapabilityListAppsOptions = ApiListAppsOptions;
export type CapabilityAppsResponse = ApiAppsResponse;
export type CapabilityListSkillsOptions = ApiListSkillsOptions;
export type CapabilitySkillsResponse = ApiSkillsResponse;
export type CapabilitySkillsConfigWriteOptions = ApiSkillsConfigWriteOptions;
export type CapabilitySkillsConfigWriteResponse = ApiSkillsConfigWriteResponse;
export type CapabilityMutationSuccessResponse = ApiMutationSuccessResponse;

/**
 * Owns capability endpoint reads.
 * Snapshot reuse policy is centralized in `CapabilitySnapshotCache`.
 */
export class CapabilityServerClient {
  public async readHealthStatus(
    options?: CapabilityRequestOptions,
  ): Promise<CapabilityHealthResponse> {
    return getHealth(options);
  }

  public async listAgents(options?: CapabilityRequestOptions): Promise<CapabilityAgentsResponse> {
    return listAgents(options);
  }

  public async listCollaborationModes(
    options?: CapabilityRequestOptions,
  ): Promise<CapabilityCollaborationModesResponse> {
    return listCollaborationModes(options);
  }

  public async listModels(options?: CapabilityRequestOptions): Promise<CapabilityModelsResponse> {
    return listModels(options);
  }

  public async readConfigDefaults(
    input?: CapabilityConfigDefaultsOptions,
  ): Promise<CapabilityConfigDefaultsResponse> {
    return getConfigDefaults(input);
  }

  public async readConfigRequirements(
    input?: CapabilityConfigRequirementsOptions,
  ): Promise<CapabilityConfigRequirementsResponse> {
    return getConfigRequirements(input);
  }

  public async readAccount(input?: CapabilityAccountOptions): Promise<CapabilityAccountResponse> {
    return getAccount(input);
  }

  public async readAccountRateLimits(
    input?: CapabilityAccountRateLimitsOptions,
  ): Promise<CapabilityAccountRateLimitsResponse> {
    return getAccountRateLimits(input);
  }

  public async startAccountLogin(
    input?: CapabilityAccountLoginStartOptions,
  ): Promise<CapabilityAccountLoginStartResponse> {
    return startAccountLogin(input);
  }

  public async cancelAccountLogin(
    input: CapabilityAccountLoginCancelOptions,
  ): Promise<CapabilityAccountLoginCancelResponse> {
    return cancelAccountLogin(input);
  }

  public async logoutAccount(
    input?: CapabilityAccountLogoutOptions,
  ): Promise<CapabilityMutationSuccessResponse> {
    return logoutAccount(input);
  }

  public async reloadMcpServerConfig(
    input?: CapabilityConfigMcpServerReloadOptions,
  ): Promise<CapabilityMutationSuccessResponse> {
    return reloadMcpServerConfig(input);
  }

  public async startMcpServerOauthLogin(
    input: CapabilityMcpServerOauthLoginOptions,
  ): Promise<CapabilityMcpServerOauthLoginResponse> {
    return startMcpServerOauthLogin(input);
  }

  public async writeConfigValue(
    input: CapabilityConfigValueWriteOptions,
  ): Promise<CapabilityConfigValueWriteResponse> {
    return writeConfigValue(input);
  }

  public async writeConfigBatch(
    input: CapabilityConfigBatchWriteOptions,
  ): Promise<CapabilityConfigBatchWriteResponse> {
    return writeConfigBatch(input);
  }

  public async writeSkillsConfig(
    input: CapabilitySkillsConfigWriteOptions,
  ): Promise<CapabilitySkillsConfigWriteResponse> {
    return writeSkillsConfig(input);
  }

  public async listRemoteSkills(
    input: CapabilityListRemoteSkillsOptions,
  ): Promise<CapabilityRemoteSkillsListResponse> {
    return listRemoteSkills(input);
  }

  public async exportRemoteSkill(
    input: CapabilityExportRemoteSkillOptions,
  ): Promise<CapabilityRemoteSkillExportResponse> {
    return exportRemoteSkill(input);
  }

  public async detectExternalAgentConfig(
    input: CapabilityExternalAgentConfigDetectOptions,
  ): Promise<CapabilityExternalAgentConfigDetectResponse> {
    return detectExternalAgentConfig(input);
  }

  public async importExternalAgentConfig(
    input: CapabilityExternalAgentConfigImportOptions,
  ): Promise<CapabilityExternalAgentConfigImportResponse> {
    return importExternalAgentConfig(input);
  }

  public async startThreadRealtime(
    input: CapabilityThreadRealtimeStartOptions,
  ): Promise<CapabilityThreadRealtimeStartResponse> {
    return startThreadRealtime(input);
  }

  public async appendThreadRealtimeText(
    input: CapabilityThreadRealtimeAppendTextOptions,
  ): Promise<CapabilityThreadRealtimeAppendTextResponse> {
    return appendThreadRealtimeText(input);
  }

  public async appendThreadRealtimeAudio(
    input: CapabilityThreadRealtimeAppendAudioOptions,
  ): Promise<CapabilityThreadRealtimeAppendAudioResponse> {
    return appendThreadRealtimeAudio(input);
  }

  public async stopThreadRealtime(
    input: CapabilityThreadRealtimeStopOptions,
  ): Promise<CapabilityThreadRealtimeStopResponse> {
    return stopThreadRealtime(input);
  }

  public async startWindowsSandboxSetup(
    input: CapabilityWindowsSandboxSetupStartOptions,
  ): Promise<CapabilityWindowsSandboxSetupStartResponse> {
    return startWindowsSandboxSetup(input);
  }

  public async readThreadStreamEvents(
    input: CapabilityReadThreadStreamEventsOptions,
  ): Promise<CapabilityThreadStreamEventsResponse> {
    return readThreadStreamEvents(input);
  }

  public async executeCommand(
    input: CapabilityCommandExecutionOptions,
  ): Promise<CapabilityCommandExecutionResponse> {
    return executeCommand(input);
  }

  public async readGitDiffToRemote(
    input: CapabilityGitDiffToRemoteOptions,
  ): Promise<CapabilityGitDiffToRemoteResponse> {
    return readGitDiffToRemote(input);
  }

  public async searchFuzzyFiles(
    input: CapabilityFuzzyFileSearchOptions,
  ): Promise<CapabilityFuzzyFileSearchResponse> {
    return searchFuzzyFiles(input);
  }

  public async startFuzzyFileSearchSession(
    input: CapabilityFuzzyFileSearchSessionStartOptions,
  ): Promise<CapabilityFuzzyFileSearchSessionStartResponse> {
    return startFuzzyFileSearchSession(input);
  }

  public async updateFuzzyFileSearchSession(
    input: CapabilityFuzzyFileSearchSessionUpdateOptions,
  ): Promise<CapabilityFuzzyFileSearchSessionUpdateResponse> {
    return updateFuzzyFileSearchSession(input);
  }

  public async stopFuzzyFileSearchSession(
    input: CapabilityFuzzyFileSearchSessionStopOptions,
  ): Promise<CapabilityFuzzyFileSearchSessionStopResponse> {
    return stopFuzzyFileSearchSession(input);
  }

  public async readAuthStatus(
    input: CapabilityAccountAuthStatusOptions,
  ): Promise<CapabilityAccountAuthStatusResponse> {
    return readAccountAuthStatus(input);
  }

  public async readUserInfo(
    input: CapabilityAccountUserInfoOptions,
  ): Promise<CapabilityAccountUserInfoResponse> {
    return readAccountUserInfo(input);
  }

  public async uploadFeedback(
    input: CapabilityFeedbackUploadOptions,
  ): Promise<CapabilityFeedbackUploadResponse> {
    return uploadFeedback(input);
  }

  public async listExperimentalFeatures(
    options?: CapabilityListPageOptions,
  ): Promise<CapabilityExperimentalFeaturesResponse> {
    return listExperimentalFeatures(options);
  }

  public async listMcpServers(
    options?: CapabilityListPageOptions,
  ): Promise<CapabilityMcpServersResponse> {
    return listMcpServers(options);
  }

  public async listApps(options?: CapabilityListAppsOptions): Promise<CapabilityAppsResponse> {
    return listApps(options);
  }

  public async listSkills(
    options?: CapabilityListSkillsOptions,
  ): Promise<CapabilitySkillsResponse> {
    return listSkills(options);
  }
}
