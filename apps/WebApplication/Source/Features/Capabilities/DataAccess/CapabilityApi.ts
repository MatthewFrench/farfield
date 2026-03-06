import { FarfieldHealthResponseSchema, JsonValueSchema } from "@farfield/protocol";
import { z } from "zod";
import {
  type AgentId,
  AgentIdSchema,
  type ApiRequestOptions,
} from "@/Shared/Contracts/ApiContracts";
import { request, requestInitWithOptions } from "@/Shared/Transport/FarfieldHttpTransport";

export type {
  ApiAccountLoginCancelOptions,
  ApiAccountLoginCancelResponse,
  ApiAccountLoginStartOptions,
  ApiAccountLoginStartResponse,
  ApiAccountLogoutOptions,
  ApiAccountOptions,
  ApiAccountRateLimitsOptions,
  ApiAccountRateLimitsResponse,
  ApiAccountResponse,
  ApiMutationSuccessResponse,
} from "./CapabilityAccountApi";
export {
  cancelAccountLogin,
  getAccount,
  getAccountRateLimits,
  logoutAccount,
  startAccountLogin,
} from "./CapabilityAccountApi";
export type {
  ApiCollaborationModesResponse,
  ApiModelsResponse,
} from "./CapabilityCatalogApi";
export { listCollaborationModes, listModels } from "./CapabilityCatalogApi";
export type {
  ApiConfigDefaultsOptions,
  ApiConfigDefaultsResponse,
  ApiConfigMcpServerReloadOptions,
  ApiConfigRequirementsOptions,
  ApiConfigRequirementsResponse,
  ApiMutationSuccessResponse as ApiConfigurationMutationSuccessResponse,
  ApiReasoningEffort,
} from "./CapabilityConfigurationApi";
export {
  getConfigDefaults,
  getConfigRequirements,
  reloadMcpServerConfig,
} from "./CapabilityConfigurationApi";

const HEALTH_ENDPOINT = "/api/health";
const AGENTS_ENDPOINT = "/api/agents";
const EXPERIMENTAL_FEATURES_ENDPOINT = "/api/experimental-features";
const MCP_SERVERS_ENDPOINT = "/api/mcp-servers";
const APPS_ENDPOINT = "/api/apps";
const SKILLS_ENDPOINT = "/api/skills";
const LIST_LIMIT_DEFAULT = 100;

const HealthResponseSchema = FarfieldHealthResponseSchema;
export type ApiHealthResponse = z.infer<typeof HealthResponseSchema>;

const AgentCapabilitiesSchema = z
  .object({
    canListModels: z.boolean(),
    canListCollaborationModes: z.boolean(),
    canReadConfigRequirements: z.boolean(),
    canListExperimentalFeatures: z.boolean(),
    canListMcpServerStatuses: z.boolean(),
    canListApps: z.boolean(),
    canListSkills: z.boolean(),
    canReadAccount: z.boolean(),
    canReadAccountRateLimits: z.boolean(),
    canSearchFuzzyFiles: z.boolean(),
    canExecuteCommand: z.boolean(),
    canStartAccountLogin: z.boolean(),
    canCancelAccountLogin: z.boolean(),
    canLogoutAccount: z.boolean(),
    canReloadMcpServerConfig: z.boolean(),
    canStartMcpServerOauthLogin: z.boolean(),
    canWriteConfigValue: z.boolean(),
    canWriteSkillsConfig: z.boolean(),
    canDetectExternalAgentConfig: z.boolean(),
    canImportExternalAgentConfig: z.boolean(),
    canStartThreadRealtime: z.boolean(),
    canAppendThreadRealtimeAudio: z.boolean(),
    canAppendThreadRealtimeText: z.boolean(),
    canStopThreadRealtime: z.boolean(),
    canStartWindowsSandboxSetup: z.boolean(),
    canSetCollaborationMode: z.boolean(),
    canSubmitUserInput: z.boolean(),
    canReadLiveState: z.boolean(),
    canReadStreamEvents: z.boolean(),
    canReadNotificationEvents: z.boolean(),
  })
  .strict();
export type ApiAgentCapabilities = z.infer<typeof AgentCapabilitiesSchema>;

const AgentsResponseSchema = z
  .object({
    ok: z.literal(true),
    agents: z.array(
      z.object({
        id: AgentIdSchema,
        label: z.string(),
        enabled: z.boolean(),
        connected: z.boolean(),
        capabilities: AgentCapabilitiesSchema,
        projectDirectories: z.array(z.string()),
      }),
    ),
    defaultAgentId: AgentIdSchema,
  })
  .strict();
export type ApiAgentsResponse = z.infer<typeof AgentsResponseSchema>;

export interface ApiListPageOptions extends ApiRequestOptions {
  limit?: number;
  cursor?: string;
}

export interface ApiListAppsOptions extends ApiListPageOptions {
  threadId?: string;
  forceRefetch?: boolean;
}

export interface ApiListSkillsOptions extends ApiRequestOptions {
  forceReload?: boolean;
}

const ExperimentalFeatureSchema = z
  .object({
    name: z.string().min(1),
    stage: z.enum(["beta", "underDevelopment", "stable", "deprecated", "removed"]),
    displayName: z.string().nullable(),
    description: z.string().nullable(),
    announcement: z.string().nullable(),
    enabled: z.boolean(),
    defaultEnabled: z.boolean(),
  })
  .strict();

const ExperimentalFeaturesResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(ExperimentalFeatureSchema),
    nextCursor: z.union([z.string(), z.null()]),
  })
  .strict();
export type ApiExperimentalFeaturesResponse = z.infer<typeof ExperimentalFeaturesResponseSchema>;

const McpServerStatusSchema = z
  .object({
    name: z.string().min(1),
    authStatus: JsonValueSchema,
    toolCount: z.number().int().nonnegative(),
    resourceCount: z.number().int().nonnegative(),
    resourceTemplateCount: z.number().int().nonnegative(),
  })
  .strict();

const McpServersResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(McpServerStatusSchema),
    nextCursor: z.union([z.string(), z.null()]),
  })
  .strict();
export type ApiMcpServersResponse = z.infer<typeof McpServersResponseSchema>;

const AppSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable(),
    logoUrl: z.string().nullable(),
    logoUrlDark: z.string().nullable(),
    installUrl: z.string().nullable(),
    isAccessible: z.boolean(),
    isEnabled: z.boolean(),
  })
  .strict();

const AppsResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(AppSummarySchema),
    nextCursor: z.union([z.string(), z.null()]),
  })
  .strict();
export type ApiAppsResponse = z.infer<typeof AppsResponseSchema>;

const SkillSummarySchema = z
  .object({
    name: z.string().min(1),
    description: z.string(),
    shortDescription: z.string().nullable(),
    path: z.string().min(1),
    scope: z.enum(["user", "repo", "system", "admin"]),
    enabled: z.boolean(),
  })
  .strict();

const SkillErrorSchema = z
  .object({
    path: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

const SkillsEntrySchema = z
  .object({
    cwd: z.string().min(1),
    skills: z.array(SkillSummarySchema),
    errors: z.array(SkillErrorSchema),
  })
  .strict();

const SkillsResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(SkillsEntrySchema),
  })
  .strict();
export type ApiSkillsResponse = z.infer<typeof SkillsResponseSchema>;

function readListPath(
  endpoint: string,
  options?: ApiListPageOptions,
  extraParams?: Record<string, string>,
): string {
  const params = new URLSearchParams();
  params.set("limit", String(options?.limit ?? LIST_LIMIT_DEFAULT));
  if (options?.cursor !== undefined) {
    params.set("cursor", options.cursor);
  }
  if (extraParams !== undefined) {
    for (const [key, value] of Object.entries(extraParams)) {
      params.set(key, value);
    }
  }
  return `${endpoint}?${params.toString()}`;
}

/**
 * Owns the remaining shared capability reads after account/config/catalog extraction.
 */
export async function getHealth(options?: ApiRequestOptions): Promise<ApiHealthResponse> {
  return HealthResponseSchema.parse(
    await request(HEALTH_ENDPOINT, requestInitWithOptions(options)),
  );
}

export async function listAgents(options?: ApiRequestOptions): Promise<ApiAgentsResponse> {
  return AgentsResponseSchema.parse(
    await request(AGENTS_ENDPOINT, requestInitWithOptions(options)),
  );
}

export async function listExperimentalFeatures(
  options?: ApiListPageOptions,
): Promise<ApiExperimentalFeaturesResponse> {
  return ExperimentalFeaturesResponseSchema.parse(
    await request(
      readListPath(EXPERIMENTAL_FEATURES_ENDPOINT, options),
      requestInitWithOptions(options),
    ),
  );
}

export async function listMcpServers(options?: ApiListPageOptions): Promise<ApiMcpServersResponse> {
  return McpServersResponseSchema.parse(
    await request(readListPath(MCP_SERVERS_ENDPOINT, options), requestInitWithOptions(options)),
  );
}

export async function listApps(options?: ApiListAppsOptions): Promise<ApiAppsResponse> {
  const extraParams: Record<string, string> = {};
  if (options?.threadId !== undefined) {
    extraParams["threadId"] = options.threadId;
  }
  if (options?.forceRefetch === true) {
    extraParams["forceRefetch"] = "true";
  }
  return AppsResponseSchema.parse(
    await request(
      readListPath(APPS_ENDPOINT, options, extraParams),
      requestInitWithOptions(options),
    ),
  );
}

export async function listSkills(options?: ApiListSkillsOptions): Promise<ApiSkillsResponse> {
  const params = new URLSearchParams();
  if (options?.forceReload === true) {
    params.set("forceReload", "true");
  }
  const pathSuffix = params.toString();
  const path = pathSuffix.length > 0 ? `${SKILLS_ENDPOINT}?${pathSuffix}` : SKILLS_ENDPOINT;
  return SkillsResponseSchema.parse(await request(path, requestInitWithOptions(options)));
}
