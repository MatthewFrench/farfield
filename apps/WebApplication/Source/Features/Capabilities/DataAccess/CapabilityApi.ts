import {
  AppServerCollaborationModeListResponseSchema,
  AppServerListModelsResponseSchema,
  FarfieldHealthResponseSchema,
  JsonValueSchema,
} from "@farfield/protocol";
import { z } from "zod";
import {
  type AgentId,
  AgentIdSchema,
  type ApiRequestOptions,
} from "@/Shared/Contracts/ApiContracts";
import { request, requestInitWithOptions } from "@/Shared/Transport/FarfieldHttpTransport";

const HEALTH_ENDPOINT = "/api/health";
const AGENTS_ENDPOINT = "/api/agents";
const CONFIG_DEFAULTS_ENDPOINT = "/api/config/defaults";
const CONFIG_REQUIREMENTS_ENDPOINT = "/api/config-requirements";
const COLLABORATION_MODES_ENDPOINT = "/api/collaboration-modes";
const MODELS_ENDPOINT = "/api/models";
const EXPERIMENTAL_FEATURES_ENDPOINT = "/api/experimental-features";
const MCP_SERVERS_ENDPOINT = "/api/mcp-servers";
const APPS_ENDPOINT = "/api/apps";
const SKILLS_ENDPOINT = "/api/skills";
const MODELS_LIST_LIMIT = 200;
const LIST_LIMIT_DEFAULT = 100;

const HealthResponseSchema = FarfieldHealthResponseSchema;
export type ApiHealthResponse = z.infer<typeof HealthResponseSchema>;

const ReasoningEffortSchema = z.enum(["none", "minimal", "low", "medium", "high", "xhigh"]);
export type ApiReasoningEffort = z.infer<typeof ReasoningEffortSchema>;

const AgentCapabilitiesSchema = z
  .object({
    canListModels: z.boolean(),
    canListCollaborationModes: z.boolean(),
    canReadConfigRequirements: z.boolean(),
    canListExperimentalFeatures: z.boolean(),
    canListMcpServerStatuses: z.boolean(),
    canListApps: z.boolean(),
    canListSkills: z.boolean(),
    canSetCollaborationMode: z.boolean(),
    canSubmitUserInput: z.boolean(),
    canReadLiveState: z.boolean(),
    canReadStreamEvents: z.boolean(),
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

const ConfigDefaultsResponseSchema = z
  .object({
    ok: z.literal(true),
    agentId: z.union([AgentIdSchema, z.null()]),
    model: z.union([z.string(), z.null()]),
    reasoningEffort: z.union([ReasoningEffortSchema, z.null()]),
  })
  .strict();
export type ApiConfigDefaultsResponse = z.infer<typeof ConfigDefaultsResponseSchema>;

export interface ApiConfigDefaultsOptions extends ApiRequestOptions {
  agentId?: AgentId;
}

export interface ApiConfigRequirementsOptions extends ApiRequestOptions {
  agentId?: AgentId;
}

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

const CollaborationModeListEnvelopeSchema = z
  .object({
    ok: z.literal(true),
  })
  .merge(AppServerCollaborationModeListResponseSchema)
  .transform(({ ok: _ok, ...collaborationModesResponse }) => collaborationModesResponse);
export type ApiCollaborationModesResponse = z.infer<
  typeof AppServerCollaborationModeListResponseSchema
>;

const ModelListEnvelopeSchema = z
  .object({
    ok: z.literal(true),
  })
  .merge(AppServerListModelsResponseSchema)
  .transform(({ ok: _ok, ...modelsResponse }) => modelsResponse);
export type ApiModelsResponse = z.infer<typeof AppServerListModelsResponseSchema>;

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

export async function listCollaborationModes(
  options?: ApiRequestOptions,
): Promise<ApiCollaborationModesResponse> {
  const data = await request(COLLABORATION_MODES_ENDPOINT, requestInitWithOptions(options));
  return CollaborationModeListEnvelopeSchema.parse(data);
}

export async function listModels(options?: ApiRequestOptions): Promise<ApiModelsResponse> {
  const data = await request(
    `${MODELS_ENDPOINT}?limit=${String(MODELS_LIST_LIMIT)}`,
    requestInitWithOptions(options),
  );
  return ModelListEnvelopeSchema.parse(data);
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
