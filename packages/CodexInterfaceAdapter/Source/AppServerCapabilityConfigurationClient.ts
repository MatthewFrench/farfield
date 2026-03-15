import {
  type AppServerConfigReadResponse,
  AppServerConfigReadResponseSchema,
  JsonValueSchema,
} from "@farfield/protocol";
import { z } from "zod";
import { buildConfigBatchWriteRequestParameters } from "./AppServerClientConfigBatchWriteRequestBuilders.js";
import { buildConfigValueWriteRequestParameters } from "./AppServerClientConfigValueWriteRequestBuilders.js";
import { APP_SERVER_CLIENT_METHODS } from "./AppServerClientMethodConstants.js";
import {
  buildReadConfigRequestParameters,
  buildReadConfigRequirementsRequestParameters,
  buildReloadMcpServerConfigRequestParameters,
} from "./AppServerClientRequestBuilders.js";
import {
  APP_SERVER_CLIENT_RESPONSE_CONTEXTS,
  parseAppServerResponse,
} from "./AppServerClientResponseParser.js";
import type { AppServerTransport } from "./AppServerTransport.js";

export interface ReadConfigOptions {
  includeLayers?: boolean;
}

export interface ReadConfigRequirementsOptions {}

export interface ConfigRequirementsNetwork {
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

export interface ConfigRequirements {
  allowedApprovalPolicies: string[] | null;
  allowedSandboxModes: string[] | null;
  allowedWebSearchModes: string[] | null;
  enforceResidency: string | null;
  network: ConfigRequirementsNetwork | null;
}

export interface ReadConfigRequirementsResult {
  requirements: ConfigRequirements | null;
}

export type ConfigWriteMergeStrategy = "replace" | "upsert";

export interface ConfigBatchWriteEditOptions {
  keyPath: string;
  value: z.infer<typeof JsonValueSchema>;
  mergeStrategy: ConfigWriteMergeStrategy;
}

export interface ConfigBatchWriteOptions {
  edits: ConfigBatchWriteEditOptions[];
  filePath?: string;
  expectedVersion?: string;
}

export interface ConfigWriteValueOptions {
  keyPath: string;
  value: z.infer<typeof JsonValueSchema>;
  mergeStrategy: ConfigWriteMergeStrategy;
  filePath?: string;
  expectedVersion?: string;
}

export type ConfigWriteStatus = "ok" | "okOverridden";

export interface ConfigWriteOverriddenMetadata {
  message: string;
  overridingLayer: z.infer<typeof JsonValueSchema>;
  effectiveValue: z.infer<typeof JsonValueSchema>;
}

export interface ConfigWriteResult {
  status: ConfigWriteStatus;
  version: string;
  filePath: string;
  overriddenMetadata: ConfigWriteOverriddenMetadata | null;
}

const AppServerConfigRequirementsNetworkSchema = z
  .object({
    enabled: z.boolean().nullable().optional(),
    httpPort: z.number().int().nonnegative().nullable().optional(),
    socksPort: z.number().int().nonnegative().nullable().optional(),
    allowUpstreamProxy: z.boolean().nullable().optional(),
    dangerouslyAllowNonLoopbackProxy: z.boolean().nullable().optional(),
    dangerouslyAllowNonLoopbackAdmin: z.boolean().nullable().optional(),
    dangerouslyAllowAllUnixSockets: z.boolean().nullable().optional(),
    allowedDomains: z.array(z.string()).nullable().optional(),
    deniedDomains: z.array(z.string()).nullable().optional(),
    allowUnixSockets: z.array(z.string()).nullable().optional(),
    allowLocalBinding: z.boolean().nullable().optional(),
  })
  .passthrough();
const AppServerConfigRequirementsSchema = z
  .object({
    allowedApprovalPolicies: z.array(z.string()).nullable().optional(),
    allowedSandboxModes: z.array(z.string()).nullable().optional(),
    allowedWebSearchModes: z.array(z.string()).nullable().optional(),
    enforceResidency: z.string().nullable().optional(),
    network: AppServerConfigRequirementsNetworkSchema.nullable().optional(),
  })
  .passthrough();
const AppServerConfigRequirementsReadResponseSchema = z
  .object({
    requirements: AppServerConfigRequirementsSchema.nullable(),
  })
  .passthrough();
const AppServerConfigWriteOverriddenMetadataSchema = z
  .object({
    message: z.string(),
    overridingLayer: JsonValueSchema,
    effectiveValue: JsonValueSchema,
  })
  .passthrough();
const AppServerConfigWriteResponseSchema = z
  .object({
    status: z.enum(["ok", "okOverridden"]),
    version: z.string().min(1),
    filePath: z.string().min(1),
    overriddenMetadata: AppServerConfigWriteOverriddenMetadataSchema.nullable().optional(),
  })
  .passthrough();
const AppServerMcpServerRefreshResponseSchema = z.object({}).passthrough();

/**
 * Owns typed configuration and configuration-mutation RPC reads for app-server operations.
 */
export class AppServerCapabilityConfigurationClient {
  private readonly transport: AppServerTransport;

  public constructor(transport: AppServerTransport) {
    this.transport = transport;
  }

  public async readConfig(options?: ReadConfigOptions): Promise<AppServerConfigReadResponse> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.readConfig,
      buildReadConfigRequestParameters(options),
    );
    return parseAppServerResponse(
      AppServerConfigReadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.readConfig,
    );
  }

  public async readConfigRequirements(
    options?: ReadConfigRequirementsOptions,
  ): Promise<ReadConfigRequirementsResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.readConfigRequirements,
      buildReadConfigRequirementsRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerConfigRequirementsReadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.readConfigRequirements,
    );
    return {
      requirements:
        parsed.requirements === null
          ? null
          : {
              allowedApprovalPolicies: parsed.requirements.allowedApprovalPolicies ?? null,
              allowedSandboxModes: parsed.requirements.allowedSandboxModes ?? null,
              allowedWebSearchModes: parsed.requirements.allowedWebSearchModes ?? null,
              enforceResidency: parsed.requirements.enforceResidency ?? null,
              network:
                parsed.requirements.network === undefined || parsed.requirements.network === null
                  ? null
                  : {
                      enabled: parsed.requirements.network.enabled ?? null,
                      httpPort: parsed.requirements.network.httpPort ?? null,
                      socksPort: parsed.requirements.network.socksPort ?? null,
                      allowUpstreamProxy: parsed.requirements.network.allowUpstreamProxy ?? null,
                      dangerouslyAllowNonLoopbackProxy:
                        parsed.requirements.network.dangerouslyAllowNonLoopbackProxy ?? null,
                      dangerouslyAllowNonLoopbackAdmin:
                        parsed.requirements.network.dangerouslyAllowNonLoopbackAdmin ?? null,
                      dangerouslyAllowAllUnixSockets:
                        parsed.requirements.network.dangerouslyAllowAllUnixSockets ?? null,
                      allowedDomains: parsed.requirements.network.allowedDomains ?? null,
                      deniedDomains: parsed.requirements.network.deniedDomains ?? null,
                      allowUnixSockets: parsed.requirements.network.allowUnixSockets ?? null,
                      allowLocalBinding: parsed.requirements.network.allowLocalBinding ?? null,
                    },
            },
    };
  }

  public async writeConfigBatch(options: ConfigBatchWriteOptions): Promise<ConfigWriteResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.writeConfigBatch,
      buildConfigBatchWriteRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerConfigWriteResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.writeConfigBatch,
    );
    return {
      status: parsed.status,
      version: parsed.version,
      filePath: parsed.filePath,
      overriddenMetadata:
        parsed.overriddenMetadata === undefined || parsed.overriddenMetadata === null
          ? null
          : {
              message: parsed.overriddenMetadata.message,
              overridingLayer: parsed.overriddenMetadata.overridingLayer,
              effectiveValue: parsed.overriddenMetadata.effectiveValue,
            },
    };
  }

  public async writeConfigValue(options: ConfigWriteValueOptions): Promise<ConfigWriteResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.writeConfigValue,
      buildConfigValueWriteRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerConfigWriteResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.writeConfigValue,
    );
    return {
      status: parsed.status,
      version: parsed.version,
      filePath: parsed.filePath,
      overriddenMetadata:
        parsed.overriddenMetadata === undefined || parsed.overriddenMetadata === null
          ? null
          : {
              message: parsed.overriddenMetadata.message,
              overridingLayer: parsed.overriddenMetadata.overridingLayer,
              effectiveValue: parsed.overriddenMetadata.effectiveValue,
            },
    };
  }

  public async reloadMcpServerConfig(): Promise<void> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.reloadMcpServerConfig,
      buildReloadMcpServerConfigRequestParameters(),
    );
    parseAppServerResponse(
      AppServerMcpServerRefreshResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.reloadMcpServerConfig,
    );
  }
}
