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

export type CapabilityRequestOptions = ApiRequestOptions;
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
  public async readHealthStatus(options?: CapabilityRequestOptions): Promise<CapabilityHealthResponse> {
    return getHealth(options);
  }

  public async listAgents(options?: CapabilityRequestOptions): Promise<CapabilityAgentsResponse> {
    return listAgents(options);
  }

  public async listCollaborationModes(
    options?: CapabilityRequestOptions
  ): Promise<CapabilityCollaborationModesResponse> {
    return listCollaborationModes(options);
  }

  public async listModels(options?: CapabilityRequestOptions): Promise<CapabilityModelsResponse> {
    return listModels(options);
  }

  public async readConfigDefaults(
    input?: CapabilityConfigDefaultsOptions
  ): Promise<CapabilityConfigDefaultsResponse> {
    return getConfigDefaults(input);
  }
}
