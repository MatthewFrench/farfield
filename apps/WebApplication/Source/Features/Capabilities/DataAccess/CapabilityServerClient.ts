import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import {
  type ApiAgentsResponse,
  type ApiAppsResponse,
  type ApiCollaborationModesResponse,
  type ApiConfigDefaultsOptions,
  type ApiConfigDefaultsResponse,
  type ApiConfigRequirementsOptions,
  type ApiConfigRequirementsResponse,
  type ApiExperimentalFeaturesResponse,
  type ApiHealthResponse,
  type ApiListAppsOptions,
  type ApiListPageOptions,
  type ApiListSkillsOptions,
  type ApiMcpServersResponse,
  type ApiModelsResponse,
  type ApiSkillsResponse,
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
} from "./CapabilityApi";

export type CapabilityRequestOptions = ApiRequestOptions;
export type CapabilityHealthResponse = ApiHealthResponse;
export type CapabilityAgentsResponse = ApiAgentsResponse;
export type CapabilityCollaborationModesResponse = ApiCollaborationModesResponse;
export type CapabilityModelsResponse = ApiModelsResponse;
export type CapabilityConfigDefaultsOptions = ApiConfigDefaultsOptions;
export type CapabilityConfigDefaultsResponse = ApiConfigDefaultsResponse;
export type CapabilityConfigRequirementsOptions = ApiConfigRequirementsOptions;
export type CapabilityConfigRequirementsResponse = ApiConfigRequirementsResponse;
export type CapabilityListPageOptions = ApiListPageOptions;
export type CapabilityExperimentalFeaturesResponse = ApiExperimentalFeaturesResponse;
export type CapabilityMcpServersResponse = ApiMcpServersResponse;
export type CapabilityListAppsOptions = ApiListAppsOptions;
export type CapabilityAppsResponse = ApiAppsResponse;
export type CapabilityListSkillsOptions = ApiListSkillsOptions;
export type CapabilitySkillsResponse = ApiSkillsResponse;

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
