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
const CONFIG_MCP_SERVER_RELOAD_ENDPOINT = "/api/config/mcp-server/reload";
const ACCOUNT_ENDPOINT = "/api/account";
const ACCOUNT_RATE_LIMITS_ENDPOINT = "/api/account/rate-limits";
const ACCOUNT_LOGIN_START_ENDPOINT = "/api/account/login/start";
const ACCOUNT_LOGIN_CANCEL_ENDPOINT = "/api/account/login/cancel";
const ACCOUNT_LOGOUT_ENDPOINT = "/api/account/logout";
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
    canReadAccount: z.boolean(),
    canReadAccountRateLimits: z.boolean(),
    canExecuteCommand: z.boolean(),
    canStartAccountLogin: z.boolean(),
    canCancelAccountLogin: z.boolean(),
    canLogoutAccount: z.boolean(),
    canReloadMcpServerConfig: z.boolean(),
    canStartMcpServerOauthLogin: z.boolean(),
    canWriteConfigValue: z.boolean(),
    canWriteSkillsConfig: z.boolean(),
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

export type ApiConfigDefaultsOptions = ApiRequestOptions & { agentId?: AgentId };

export type ApiConfigRequirementsOptions = ApiRequestOptions & { agentId?: AgentId };

export interface ApiAccountOptions extends ApiRequestOptions {
  agentId?: AgentId;
  refreshToken?: boolean;
}

export interface ApiAccountRateLimitsOptions extends ApiRequestOptions {
  agentId?: AgentId;
}

export interface ApiAccountLoginStartOptions extends ApiRequestOptions {
  agentId?: AgentId;
}

export interface ApiAccountLoginCancelOptions extends ApiRequestOptions {
  agentId?: AgentId;
  loginId: string;
}

export interface ApiAccountLogoutOptions extends ApiRequestOptions {
  agentId?: AgentId;
}

export interface ApiConfigMcpServerReloadOptions extends ApiRequestOptions {
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

function readAccountPath(options?: ApiAccountOptions): string {
  const params = new URLSearchParams();
  if (options?.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  if (options?.refreshToken === true) {
    params.set("refreshToken", "true");
  }
  const suffix = params.toString();
  return suffix.length > 0 ? `${ACCOUNT_ENDPOINT}?${suffix}` : ACCOUNT_ENDPOINT;
}

function readAccountRateLimitsPath(options?: ApiAccountRateLimitsOptions): string {
  const params = new URLSearchParams();
  if (options?.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  const suffix = params.toString();
  return suffix.length > 0
    ? `${ACCOUNT_RATE_LIMITS_ENDPOINT}?${suffix}`
    : ACCOUNT_RATE_LIMITS_ENDPOINT;
}

function readAccountLoginStartPath(options?: ApiAccountLoginStartOptions): string {
  const params = new URLSearchParams();
  if (options?.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  const suffix = params.toString();
  return suffix.length > 0
    ? `${ACCOUNT_LOGIN_START_ENDPOINT}?${suffix}`
    : ACCOUNT_LOGIN_START_ENDPOINT;
}

function readAccountLoginCancelPath(options: ApiAccountLoginCancelOptions): string {
  const params = new URLSearchParams();
  params.set("loginId", options.loginId);
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  return `${ACCOUNT_LOGIN_CANCEL_ENDPOINT}?${params.toString()}`;
}

function readAccountLogoutPath(options?: ApiAccountLogoutOptions): string {
  const params = new URLSearchParams();
  if (options?.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  const suffix = params.toString();
  return suffix.length > 0 ? `${ACCOUNT_LOGOUT_ENDPOINT}?${suffix}` : ACCOUNT_LOGOUT_ENDPOINT;
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

const AccountPlanTypeSchema = z.enum([
  "free",
  "go",
  "plus",
  "pro",
  "team",
  "business",
  "enterprise",
  "edu",
  "unknown",
]);

const AccountSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("apiKey"),
    })
    .strict(),
  z
    .object({
      type: z.literal("chatgpt"),
      email: z.string(),
      planType: AccountPlanTypeSchema,
    })
    .strict(),
]);

const AccountResponseSchema = z
  .object({
    ok: z.literal(true),
    account: AccountSchema.nullable(),
    requiresOpenaiAuth: z.boolean(),
  })
  .strict();
export type ApiAccountResponse = z.infer<typeof AccountResponseSchema>;

const AccountCreditsSnapshotSchema = z
  .object({
    balance: z.string().nullable(),
    hasCredits: z.boolean(),
    unlimited: z.boolean(),
  })
  .strict();

const AccountRateLimitWindowSchema = z
  .object({
    resetsAt: z.number().int().nullable(),
    usedPercent: z.number().int(),
    windowDurationMins: z.number().int().nullable(),
  })
  .strict();

const AccountRateLimitSnapshotSchema = z
  .object({
    credits: AccountCreditsSnapshotSchema.nullable(),
    limitId: z.string().nullable(),
    limitName: z.string().nullable(),
    planType: AccountPlanTypeSchema.nullable(),
    primary: AccountRateLimitWindowSchema.nullable(),
    secondary: AccountRateLimitWindowSchema.nullable(),
  })
  .strict();

const AccountRateLimitsResponseSchema = z
  .object({
    ok: z.literal(true),
    rateLimits: AccountRateLimitSnapshotSchema.nullable(),
    rateLimitsByLimitId: z.record(AccountRateLimitSnapshotSchema).nullable(),
  })
  .strict();
export type ApiAccountRateLimitsResponse = z.infer<typeof AccountRateLimitsResponseSchema>;

const AccountLoginStartResponseSchema = z.discriminatedUnion("type", [
  z
    .object({
      ok: z.literal(true),
      type: z.literal("apiKey"),
    })
    .strict(),
  z
    .object({
      ok: z.literal(true),
      type: z.literal("chatgpt"),
      loginId: z.string().min(1),
      authUrl: z.string().min(1),
    })
    .strict(),
  z
    .object({
      ok: z.literal(true),
      type: z.literal("chatgptAuthTokens"),
    })
    .strict(),
]);
export type ApiAccountLoginStartResponse = z.infer<typeof AccountLoginStartResponseSchema>;

const AccountLoginCancelResponseSchema = z
  .object({
    ok: z.literal(true),
    status: z.enum(["canceled", "notFound"]),
  })
  .strict();
export type ApiAccountLoginCancelResponse = z.infer<typeof AccountLoginCancelResponseSchema>;

const MutationSuccessResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .strict();
export type ApiMutationSuccessResponse = z.infer<typeof MutationSuccessResponseSchema>;

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

export async function getAccount(options?: ApiAccountOptions): Promise<ApiAccountResponse> {
  return AccountResponseSchema.parse(
    await request(readAccountPath(options), requestInitWithOptions(options)),
  );
}

export async function getAccountRateLimits(
  options?: ApiAccountRateLimitsOptions,
): Promise<ApiAccountRateLimitsResponse> {
  return AccountRateLimitsResponseSchema.parse(
    await request(readAccountRateLimitsPath(options), requestInitWithOptions(options)),
  );
}

export async function startAccountLogin(
  options?: ApiAccountLoginStartOptions,
): Promise<ApiAccountLoginStartResponse> {
  return AccountLoginStartResponseSchema.parse(
    await request(readAccountLoginStartPath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}

export async function cancelAccountLogin(
  options: ApiAccountLoginCancelOptions,
): Promise<ApiAccountLoginCancelResponse> {
  return AccountLoginCancelResponseSchema.parse(
    await request(readAccountLoginCancelPath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}

export async function logoutAccount(
  options?: ApiAccountLogoutOptions,
): Promise<ApiMutationSuccessResponse> {
  return MutationSuccessResponseSchema.parse(
    await request(readAccountLogoutPath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
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
