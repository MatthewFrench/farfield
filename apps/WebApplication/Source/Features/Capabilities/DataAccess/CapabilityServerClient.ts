import {
  type ApiAgentsResponse,
  type ApiCollaborationModesResponse,
  type ApiConfigDefaultsOptions,
  type ApiConfigDefaultsResponse,
  type ApiHealthResponse,
  type ApiModelsResponse,
  getConfigDefaults,
  getHealth,
  listAgents,
  listCollaborationModes,
  listModels
} from "./CapabilityApi";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";

export type CapabilityHealthResponse = ApiHealthResponse;
export type CapabilityAgentsResponse = ApiAgentsResponse;
export type CapabilityCollaborationModesResponse = ApiCollaborationModesResponse;
export type CapabilityModelsResponse = ApiModelsResponse;
export type CapabilityConfigDefaultsOptions = ApiConfigDefaultsOptions;
export type CapabilityConfigDefaultsResponse = ApiConfigDefaultsResponse;

/**
 * Owns capability endpoint reads.
 * Snapshot reuse policy is centralized in `CapabilitySnapshotCache`.
 */
export class CapabilityServerClient {
  public async readHealthStatus(options?: ApiRequestOptions): Promise<ApiHealthResponse> {
    return getHealth(options);
  }

  public async listAgents(options?: ApiRequestOptions): Promise<ApiAgentsResponse> {
    return listAgents(options);
  }

  public async listCollaborationModes(
    options?: ApiRequestOptions
  ): Promise<ApiCollaborationModesResponse> {
    return listCollaborationModes(options);
  }

  public async listModels(options?: ApiRequestOptions): Promise<ApiModelsResponse> {
    return listModels(options);
  }

  public async readConfigDefaults(input?: ApiConfigDefaultsOptions): Promise<ApiConfigDefaultsResponse> {
    return getConfigDefaults(input);
  }
}
