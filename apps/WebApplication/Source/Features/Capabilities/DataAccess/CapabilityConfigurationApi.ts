import { z } from "zod";
import {
  type AgentId,
  AgentIdSchema,
  type ApiRequestOptions,
} from "@/Shared/Contracts/ApiContracts";
import { request, requestInitWithOptions } from "@/Shared/Transport/FarfieldHttpTransport";

const CONFIG_DEFAULTS_ENDPOINT = "/api/config/defaults";
const CONFIG_REQUIREMENTS_ENDPOINT = "/api/config-requirements";
const CONFIG_MCP_SERVER_RELOAD_ENDPOINT = "/api/config/mcp-server/reload";

const ReasoningEffortSchema = z.enum(["none", "minimal", "low", "medium", "high", "xhigh"]);
export type ApiReasoningEffort = z.infer<typeof ReasoningEffortSchema>;

const ConfigDefaultsResponseSchema = z
  .object({
    ok: z.literal(true),
    agentId: z.union([AgentIdSchema, z.null()]),
    model: z.union([z.string(), z.null()]),
    reasoningEffort: z.union([ReasoningEffortSchema, z.null()]),
  })
  .strict();
export type ApiConfigDefaultsResponse = z.infer<typeof ConfigDefaultsResponseSchema>;

export type ApiConfigDefaultsOptions = ApiRequestOptions & { agentId?: AgentId };
export type ApiConfigRequirementsOptions = ApiRequestOptions & { agentId?: AgentId };
export interface ApiConfigMcpServerReloadOptions extends ApiRequestOptions {
  agentId?: AgentId;
}

const ConfigRequirementsNetworkSchema = z
  .object({
    enabled: z.boolean().nullable(),
    httpPort: z.number().int().nullable(),
    socksPort: z.number().int().nullable(),
    allowUpstreamProxy: z.boolean().nullable(),
    dangerouslyAllowNonLoopbackProxy: z.boolean().nullable(),
    dangerouslyAllowNonLoopbackAdmin: z.boolean().nullable(),
    dangerouslyAllowAllUnixSockets: z.boolean().nullable(),
    allowedDomains: z.array(z.string()).nullable(),
    deniedDomains: z.array(z.string()).nullable(),
    allowUnixSockets: z.array(z.string()).nullable(),
    allowLocalBinding: z.boolean().nullable(),
  })
  .strict();

const ConfigRequirementsSchema = z
  .object({
    allowedApprovalPolicies: z.array(z.string()).nullable(),
    allowedSandboxModes: z.array(z.string()).nullable(),
    allowedWebSearchModes: z.array(z.string()).nullable(),
    enforceResidency: z.string().nullable(),
    network: ConfigRequirementsNetworkSchema.nullable(),
  })
  .strict();

const ConfigRequirementsResponseSchema = z
  .object({
    ok: z.literal(true),
    requirements: ConfigRequirementsSchema.nullable(),
  })
  .strict();
export type ApiConfigRequirementsResponse = z.infer<typeof ConfigRequirementsResponseSchema>;

const MutationSuccessResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .strict();
export type ApiMutationSuccessResponse = z.infer<typeof MutationSuccessResponseSchema>;

function readConfigDefaultsPath(options?: ApiConfigDefaultsOptions): string {
  const params = new URLSearchParams();
  if (options?.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  const suffix = params.toString();
  return suffix.length > 0 ? `${CONFIG_DEFAULTS_ENDPOINT}?${suffix}` : CONFIG_DEFAULTS_ENDPOINT;
}

function readConfigRequirementsPath(options?: ApiConfigRequirementsOptions): string {
  const params = new URLSearchParams();
  if (options?.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  const suffix = params.toString();
  return suffix.length > 0
    ? `${CONFIG_REQUIREMENTS_ENDPOINT}?${suffix}`
    : CONFIG_REQUIREMENTS_ENDPOINT;
}

function readConfigMcpServerReloadPath(options?: ApiConfigMcpServerReloadOptions): string {
  const params = new URLSearchParams();
  if (options?.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  const suffix = params.toString();
  return suffix.length > 0
    ? `${CONFIG_MCP_SERVER_RELOAD_ENDPOINT}?${suffix}`
    : CONFIG_MCP_SERVER_RELOAD_ENDPOINT;
}

/**
 * Owns configuration capability endpoint contracts and request construction.
 */
export async function getConfigDefaults(
  options?: ApiConfigDefaultsOptions,
): Promise<ApiConfigDefaultsResponse> {
  return ConfigDefaultsResponseSchema.parse(
    await request(readConfigDefaultsPath(options), requestInitWithOptions(options)),
  );
}

export async function getConfigRequirements(
  options?: ApiConfigRequirementsOptions,
): Promise<ApiConfigRequirementsResponse> {
  return ConfigRequirementsResponseSchema.parse(
    await request(readConfigRequirementsPath(options), requestInitWithOptions(options)),
  );
}

export async function reloadMcpServerConfig(
  options?: ApiConfigMcpServerReloadOptions,
): Promise<ApiMutationSuccessResponse> {
  return MutationSuccessResponseSchema.parse(
    await request(readConfigMcpServerReloadPath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}
