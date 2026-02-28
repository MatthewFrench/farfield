// biome-ignore lint/nursery/noExcessiveLinesPerFile: Interface-client decomposition follow-up is tracked in docs/proposed-structure-and-migration.md decision entry 20.
import {
  type AppServerCollaborationModeListResponse,
  AppServerCollaborationModeListResponseSchema,
  type AppServerConfigReadResponse,
  AppServerConfigReadResponseSchema,
  type AppServerListModelsResponse,
  AppServerListModelsResponseSchema,
  type AppServerListThreadsResponse,
  AppServerListThreadsResponseSchema,
  type AppServerReadThreadResponse,
  AppServerReadThreadResponseSchema,
  type AppServerStartThreadResponse,
  AppServerStartThreadResponseSchema,
  AppServerThreadListItemSchema,
  AppServerTurnStartResponseSchema,
  type CollaborationMode,
  JsonValueSchema,
  parseThreadConversationRequestResponse,
  type ThreadConversationRequestResponse,
  type TurnStartParams,
} from "@farfield/protocol";
import { z } from "zod";
import { APP_SERVER_CLIENT_METHODS } from "./AppServerClientMethodConstants.js";
import {
  APP_SERVER_CLIENT_DEFAULT_LIST_MODELS_LIMIT,
  buildArchiveThreadRequest,
  buildCancelAccountLoginRequestParameters,
  buildForkThreadRequest,
  buildListAppsRequestParameters,
  buildListExperimentalFeaturesRequestParameters,
  buildListLoadedThreadsRequestParameters,
  buildListMcpServerStatusesRequestParameters,
  buildListSkillsRequestParameters,
  buildListThreadsAllPageOptions,
  buildListThreadsRequestParameters,
  buildLogoutAccountRequestParameters,
  buildReadAccountRateLimitsRequestParameters,
  buildReadAccountRequestParameters,
  buildReadConfigRequestParameters,
  buildReadConfigRequirementsRequestParameters,
  buildReadThreadRequestParameters,
  buildReloadMcpServerConfigRequestParameters,
  buildResumeThreadRequest,
  buildRollbackThreadRequest,
  buildSetThreadNameRequest,
  buildStartAccountLoginRequestParameters,
  buildStartReviewRequest,
  buildStartThreadRequest,
  buildStartTurnRequest,
  buildSteerTurnRequest,
  buildThreadBackgroundTerminalsCleanRequest,
  buildThreadCompactStartRequest,
  buildTurnInterruptRequest,
  buildUnarchiveThreadRequest,
  buildUnsubscribeThreadRequest,
  resolveReadThreadRequestTimeoutMilliseconds,
} from "./AppServerClientRequestBuilders.js";
import {
  APP_SERVER_CLIENT_RESPONSE_CONTEXTS,
  parseAppServerResponse,
} from "./AppServerClientResponseParser.js";
import {
  type AppServerPendingServerRequest,
  type AppServerReadNotificationEventsInput,
  type AppServerReadNotificationEventsResult,
  type AppServerTransport,
  ChildProcessAppServerTransport,
  type ChildProcessAppServerTransportOptions,
  isChildProcessAppServerTransportOptions,
} from "./AppServerTransport.js";
import { AppServerTransportError } from "./Errors.js";

export interface ListThreadsOptions {
  limit: number;
  archived: boolean;
  cursor?: string;
  sortKey?: "created_at" | "updated_at";
  cwd?: string;
}

export interface ListThreadsAllOptions {
  limit: number;
  archived: boolean;
  cursor?: string;
  maxPages: number;
  sortKey?: "created_at" | "updated_at";
  cwd?: string;
}

export interface ListLoadedThreadsOptions {
  limit?: number | null;
  cursor?: string | null;
}

export interface ListLoadedThreadsResult {
  data: string[];
  nextCursor: string | null;
}

export interface StartThreadOptions {
  cwd: string;
  model?: string;
  modelProvider?: string;
  personality?: string;
  sandbox?: string;
  approvalPolicy?: string;
  ephemeral?: boolean;
}

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

export interface ListExperimentalFeaturesOptions {
  limit?: number | null;
  cursor?: string | null;
}

export type ExperimentalFeatureStage =
  | "beta"
  | "underDevelopment"
  | "stable"
  | "deprecated"
  | "removed";

export interface ExperimentalFeature {
  name: string;
  stage: ExperimentalFeatureStage;
  displayName: string | null;
  description: string | null;
  announcement: string | null;
  enabled: boolean;
  defaultEnabled: boolean;
}

export interface ListExperimentalFeaturesResult {
  data: ExperimentalFeature[];
  nextCursor: string | null;
}

export interface ListMcpServerStatusesOptions {
  limit?: number | null;
  cursor?: string | null;
}

export interface McpServerStatusSummary {
  name: string;
  authStatus: z.infer<typeof JsonValueSchema>;
  toolCount: number;
  resourceCount: number;
  resourceTemplateCount: number;
}

export interface ListMcpServerStatusesResult {
  data: McpServerStatusSummary[];
  nextCursor: string | null;
}

export interface ListAppsOptions {
  limit?: number | null;
  cursor?: string | null;
  threadId?: string | null;
  forceRefetch?: boolean;
}

export interface AppInfoSummary {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  logoUrlDark: string | null;
  installUrl: string | null;
  isAccessible: boolean;
  isEnabled: boolean;
}

export interface ListAppsResult {
  data: AppInfoSummary[];
  nextCursor: string | null;
}

export interface SkillsListExtraRootsForCwdOptions {
  cwd: string;
  extraUserRoots: string[];
}

export interface ListSkillsOptions {
  cwds?: string[];
  forceReload?: boolean;
  perCwdExtraUserRoots?: SkillsListExtraRootsForCwdOptions[] | null;
}

export type SkillScope = "user" | "repo" | "system" | "admin";

export interface SkillSummary {
  name: string;
  description: string;
  shortDescription: string | null;
  path: string;
  scope: SkillScope;
  enabled: boolean;
}

export interface SkillErrorSummary {
  path: string;
  message: string;
}

export interface SkillsListEntrySummary {
  cwd: string;
  skills: SkillSummary[];
  errors: SkillErrorSummary[];
}

export interface ListSkillsResult {
  data: SkillsListEntrySummary[];
}

export interface ReadAccountOptions {
  refreshToken?: boolean;
}

export type AccountPlanType =
  | "free"
  | "go"
  | "plus"
  | "pro"
  | "team"
  | "business"
  | "enterprise"
  | "edu"
  | "unknown";

export interface ApiKeyAccountSummary {
  type: "apiKey";
}

export interface ChatgptAccountSummary {
  type: "chatgpt";
  email: string;
  planType: AccountPlanType;
}

export type AccountSummary = ApiKeyAccountSummary | ChatgptAccountSummary;

export interface ReadAccountResult {
  account: AccountSummary | null;
  requiresOpenaiAuth: boolean;
}

export interface AccountCreditsSnapshot {
  balance: string | null;
  hasCredits: boolean;
  unlimited: boolean;
}

export interface AccountRateLimitWindow {
  resetsAt: number | null;
  usedPercent: number;
  windowDurationMins: number | null;
}

export interface AccountRateLimitSnapshot {
  credits: AccountCreditsSnapshot | null;
  limitId: string | null;
  limitName: string | null;
  planType: AccountPlanType | null;
  primary: AccountRateLimitWindow | null;
  secondary: AccountRateLimitWindow | null;
}

export interface ReadAccountRateLimitsResult {
  rateLimits: AccountRateLimitSnapshot;
  rateLimitsByLimitId: Record<string, AccountRateLimitSnapshot> | null;
}

export interface LoginAccountWithApiKeyOptions {
  type: "apiKey";
  apiKey: string;
}

export interface LoginAccountWithChatgptOptions {
  type: "chatgpt";
}

export interface LoginAccountWithChatgptAuthTokensOptions {
  type: "chatgptAuthTokens";
  accessToken: string;
  chatgptAccountId: string;
  chatgptPlanType?: AccountPlanType | null;
}

export type LoginAccountOptions =
  | LoginAccountWithApiKeyOptions
  | LoginAccountWithChatgptOptions
  | LoginAccountWithChatgptAuthTokensOptions;

export interface LoginAccountWithApiKeyResult {
  type: "apiKey";
}

export interface LoginAccountWithChatgptResult {
  type: "chatgpt";
  loginId: string;
  authUrl: string;
}

export interface LoginAccountWithChatgptAuthTokensResult {
  type: "chatgptAuthTokens";
}

export type LoginAccountResult =
  | LoginAccountWithApiKeyResult
  | LoginAccountWithChatgptResult
  | LoginAccountWithChatgptAuthTokensResult;

export interface CancelAccountLoginOptions {
  loginId: string;
}

export type CancelAccountLoginStatus = "canceled" | "notFound";

export interface CancelAccountLoginResult {
  status: CancelAccountLoginStatus;
}

export interface ResumeThreadOptions {
  persistExtendedHistory?: boolean;
}

export interface ForkThreadOptions {
  persistExtendedHistory?: boolean;
}

export interface StartTurnOptions {
  threadId: string;
  text: string;
  cwd?: string;
  turnStartTemplate?: TurnStartParams | null;
  model?: string | null;
  effort?: string | null;
  collaborationMode?: CollaborationMode | null;
}

export type UnsubscribeThreadStatus = "notLoaded" | "notSubscribed" | "unsubscribed";

export type ReviewDelivery = "inline" | "detached";

export interface ReviewUncommittedChangesTarget {
  type: "uncommittedChanges";
}

export interface ReviewBaseBranchTarget {
  type: "baseBranch";
  branch: string;
}

export interface ReviewCommitTarget {
  type: "commit";
  sha: string;
  title?: string | null | undefined;
}

export interface ReviewCustomTarget {
  type: "custom";
  instructions: string;
}

export type StartReviewTarget =
  | ReviewUncommittedChangesTarget
  | ReviewBaseBranchTarget
  | ReviewCommitTarget
  | ReviewCustomTarget;

export interface StartReviewOptions {
  threadId: string;
  target: StartReviewTarget;
  delivery?: ReviewDelivery | null;
}

export interface StartReviewResult {
  reviewThreadId: string;
  turnId: string;
}

const AppServerArchiveThreadResponseSchema = z.object({}).passthrough();
const AppServerSetThreadNameResponseSchema = z.object({}).passthrough();
const AppServerTurnSteerResponseSchema = z
  .object({
    turnId: z.string().min(1),
  })
  .passthrough();
const AppServerTurnInterruptResponseSchema = z.object({}).passthrough();
const AppServerThreadCompactStartResponseSchema = z.object({}).passthrough();
const AppServerThreadBackgroundTerminalsCleanResponseSchema = z.object({}).passthrough();
const AppServerThreadLoadedListResponseSchema = z
  .object({
    data: z.array(z.string().min(1)),
    nextCursor: z.string().nullable(),
  })
  .passthrough();
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
const AppServerExperimentalFeatureStageSchema = z.enum([
  "beta",
  "underDevelopment",
  "stable",
  "deprecated",
  "removed",
]);
const AppServerExperimentalFeatureSchema = z
  .object({
    name: z.string().min(1),
    stage: AppServerExperimentalFeatureStageSchema,
    displayName: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    announcement: z.string().nullable().optional(),
    enabled: z.boolean(),
    defaultEnabled: z.boolean(),
  })
  .passthrough();
const AppServerExperimentalFeatureListResponseSchema = z
  .object({
    data: z.array(AppServerExperimentalFeatureSchema),
    nextCursor: z.string().nullable(),
  })
  .passthrough();
const AppServerMcpServerStatusSchema = z
  .object({
    name: z.string().min(1),
    tools: z.record(JsonValueSchema),
    resources: z.array(JsonValueSchema),
    resourceTemplates: z.array(JsonValueSchema),
    authStatus: JsonValueSchema,
  })
  .passthrough();
const AppServerMcpServerStatusListResponseSchema = z
  .object({
    data: z.array(AppServerMcpServerStatusSchema),
    nextCursor: z.string().nullable(),
  })
  .passthrough();
const AppServerAppListItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    logoUrl: z.string().nullable().optional(),
    logoUrlDark: z.string().nullable().optional(),
    installUrl: z.string().nullable().optional(),
    isAccessible: z.boolean().optional(),
    isEnabled: z.boolean().optional(),
  })
  .passthrough();
const AppServerAppListResponseSchema = z
  .object({
    data: z.array(AppServerAppListItemSchema),
    nextCursor: z.string().nullable(),
  })
  .passthrough();
const AppServerSkillMetadataSchema = z
  .object({
    name: z.string().min(1),
    description: z.string(),
    shortDescription: z.string().nullable().optional(),
    path: z.string().min(1),
    scope: z.enum(["user", "repo", "system", "admin"]),
    enabled: z.boolean(),
  })
  .passthrough();
const AppServerSkillErrorSchema = z
  .object({
    path: z.string().min(1),
    message: z.string().min(1),
  })
  .passthrough();
const AppServerSkillsListEntrySchema = z
  .object({
    cwd: z.string().min(1),
    skills: z.array(AppServerSkillMetadataSchema),
    errors: z.array(AppServerSkillErrorSchema),
  })
  .passthrough();
const AppServerSkillsListResponseSchema = z
  .object({
    data: z.array(AppServerSkillsListEntrySchema),
  })
  .passthrough();
const AppServerAccountPlanTypeSchema = z.enum([
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
const AppServerAccountSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("apiKey"),
    })
    .passthrough(),
  z
    .object({
      type: z.literal("chatgpt"),
      email: z.string(),
      planType: AppServerAccountPlanTypeSchema,
    })
    .passthrough(),
]);
const AppServerGetAccountResponseSchema = z
  .object({
    account: AppServerAccountSchema.nullable(),
    requiresOpenaiAuth: z.boolean(),
  })
  .passthrough();
const AppServerAccountCreditsSnapshotSchema = z
  .object({
    balance: z.string().nullable().optional(),
    hasCredits: z.boolean(),
    unlimited: z.boolean(),
  })
  .passthrough();
const AppServerAccountRateLimitWindowSchema = z
  .object({
    resetsAt: z.number().int().nullable().optional(),
    usedPercent: z.number().int(),
    windowDurationMins: z.number().int().nullable().optional(),
  })
  .passthrough();
const AppServerAccountRateLimitSnapshotSchema = z
  .object({
    credits: AppServerAccountCreditsSnapshotSchema.nullable().optional(),
    limitId: z.string().nullable().optional(),
    limitName: z.string().nullable().optional(),
    planType: AppServerAccountPlanTypeSchema.nullable().optional(),
    primary: AppServerAccountRateLimitWindowSchema.nullable().optional(),
    secondary: AppServerAccountRateLimitWindowSchema.nullable().optional(),
  })
  .passthrough();
const AppServerGetAccountRateLimitsResponseSchema = z
  .object({
    rateLimits: AppServerAccountRateLimitSnapshotSchema,
    rateLimitsByLimitId: z.record(AppServerAccountRateLimitSnapshotSchema).nullable().optional(),
  })
  .passthrough();
const AppServerLoginAccountResponseSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("apiKey"),
    })
    .passthrough(),
  z
    .object({
      type: z.literal("chatgpt"),
      loginId: z.string().min(1),
      authUrl: z.string().min(1),
    })
    .passthrough(),
  z
    .object({
      type: z.literal("chatgptAuthTokens"),
    })
    .passthrough(),
]);
const AppServerCancelLoginAccountResponseSchema = z
  .object({
    status: z.enum(["canceled", "notFound"]),
  })
  .passthrough();
const AppServerLogoutAccountResponseSchema = z.object({}).passthrough();
const AppServerMcpServerRefreshResponseSchema = z.object({}).passthrough();
const AppServerThreadUnsubscribeResponseSchema = z
  .object({
    status: z.enum(["notLoaded", "notSubscribed", "unsubscribed"]),
  })
  .passthrough();
const AppServerReviewStartResponseSchema = z
  .object({
    reviewThreadId: z.string().min(1),
    turn: z
      .object({
        id: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();
const AppServerUnarchiveThreadResponseSchema = z
  .object({
    thread: AppServerThreadListItemSchema,
  })
  .passthrough();

function mapAccountRateLimitSnapshot(
  snapshot: z.infer<typeof AppServerAccountRateLimitSnapshotSchema>,
): AccountRateLimitSnapshot {
  return {
    credits:
      snapshot.credits === undefined || snapshot.credits === null
        ? null
        : {
            balance: snapshot.credits.balance ?? null,
            hasCredits: snapshot.credits.hasCredits,
            unlimited: snapshot.credits.unlimited,
          },
    limitId: snapshot.limitId ?? null,
    limitName: snapshot.limitName ?? null,
    planType: snapshot.planType ?? null,
    primary:
      snapshot.primary === undefined || snapshot.primary === null
        ? null
        : {
            resetsAt: snapshot.primary.resetsAt ?? null,
            usedPercent: snapshot.primary.usedPercent,
            windowDurationMins: snapshot.primary.windowDurationMins ?? null,
          },
    secondary:
      snapshot.secondary === undefined || snapshot.secondary === null
        ? null
        : {
            resetsAt: snapshot.secondary.resetsAt ?? null,
            usedPercent: snapshot.secondary.usedPercent,
            windowDurationMins: snapshot.secondary.windowDurationMins ?? null,
          },
  };
}

/**
 * Owns typed request/response mapping for Codex app-server RPC methods.
 * Transport concerns stay in `AppServerTransport`; schema enforcement stays here.
 */
export class AppServerClient {
  private readonly transport: AppServerTransport;

  public constructor(
    transportOrOptions: AppServerTransport | ChildProcessAppServerTransportOptions,
  ) {
    if (isChildProcessAppServerTransportOptions(transportOrOptions)) {
      this.transport = new ChildProcessAppServerTransport(transportOrOptions);
      return;
    }

    this.transport = transportOrOptions;
  }

  public async close(): Promise<void> {
    await this.transport.close();
  }

  public async listThreads(options: ListThreadsOptions): Promise<AppServerListThreadsResponse> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.listThreads,
      buildListThreadsRequestParameters(options),
    );

    return parseAppServerResponse(
      AppServerListThreadsResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listThreads,
    );
  }

  public async listLoadedThreads(
    options?: ListLoadedThreadsOptions,
  ): Promise<ListLoadedThreadsResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.listLoadedThreads,
      buildListLoadedThreadsRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerThreadLoadedListResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listLoadedThreads,
    );
    return {
      data: parsed.data,
      nextCursor: parsed.nextCursor,
    };
  }

  public async forkThread(
    threadId: string,
    options?: ForkThreadOptions,
  ): Promise<AppServerStartThreadResponse> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.forkThread,
      buildForkThreadRequest(threadId, options),
    );
    return parseAppServerResponse(
      AppServerStartThreadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.forkThread,
    );
  }

  public async listThreadsAll(
    options: ListThreadsAllOptions,
  ): Promise<AppServerListThreadsResponse> {
    const listItems: AppServerListThreadsResponse["data"] = [];

    let cursor = options.cursor;
    let pages = 0;

    while (pages < options.maxPages) {
      const page = await this.listThreads(buildListThreadsAllPageOptions(options, cursor));

      listItems.push(...page.data);
      pages += 1;

      const nextCursor = page.nextCursor ?? null;
      // Empty page data with a cursor is treated as terminal to avoid looping on a non-advancing cursor.
      if (nextCursor === null || nextCursor.length === 0 || page.data.length === 0) {
        return {
          data: listItems,
          nextCursor: null,
          pages,
          truncated: false,
        };
      }

      cursor = nextCursor;
    }

    return {
      data: listItems,
      nextCursor: cursor ?? null,
      pages,
      truncated: true,
    };
  }

  public async readThread(
    threadId: string,
    includeTurns = true,
  ): Promise<AppServerReadThreadResponse> {
    const timeoutMilliseconds = resolveReadThreadRequestTimeoutMilliseconds(includeTurns);
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.readThread,
      buildReadThreadRequestParameters(threadId, includeTurns),
      timeoutMilliseconds,
    );

    return parseAppServerResponse(
      AppServerReadThreadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.readThread,
    );
  }

  public async listModels(
    limit = APP_SERVER_CLIENT_DEFAULT_LIST_MODELS_LIMIT,
  ): Promise<AppServerListModelsResponse> {
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.listModels, {
      limit,
    });
    return parseAppServerResponse(
      AppServerListModelsResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listModels,
    );
  }

  public async listCollaborationModes(): Promise<AppServerCollaborationModeListResponse> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.listCollaborationModes,
      {},
    );
    return parseAppServerResponse(
      AppServerCollaborationModeListResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listCollaborationModes,
    );
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

  public async listExperimentalFeatures(
    options?: ListExperimentalFeaturesOptions,
  ): Promise<ListExperimentalFeaturesResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.listExperimentalFeatures,
      buildListExperimentalFeaturesRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerExperimentalFeatureListResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listExperimentalFeatures,
    );
    return {
      data: parsed.data.map((feature) => ({
        name: feature.name,
        stage: feature.stage,
        displayName: feature.displayName ?? null,
        description: feature.description ?? null,
        announcement: feature.announcement ?? null,
        enabled: feature.enabled,
        defaultEnabled: feature.defaultEnabled,
      })),
      nextCursor: parsed.nextCursor,
    };
  }

  public async listMcpServerStatuses(
    options?: ListMcpServerStatusesOptions,
  ): Promise<ListMcpServerStatusesResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.listMcpServerStatuses,
      buildListMcpServerStatusesRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerMcpServerStatusListResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listMcpServerStatuses,
    );
    return {
      data: parsed.data.map((status) => ({
        name: status.name,
        authStatus: status.authStatus,
        toolCount: Object.keys(status.tools).length,
        resourceCount: status.resources.length,
        resourceTemplateCount: status.resourceTemplates.length,
      })),
      nextCursor: parsed.nextCursor,
    };
  }

  public async listApps(options?: ListAppsOptions): Promise<ListAppsResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.listApps,
      buildListAppsRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerAppListResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listApps,
    );
    return {
      data: parsed.data.map((appInfo) => ({
        id: appInfo.id,
        name: appInfo.name,
        description: appInfo.description ?? null,
        logoUrl: appInfo.logoUrl ?? null,
        logoUrlDark: appInfo.logoUrlDark ?? null,
        installUrl: appInfo.installUrl ?? null,
        isAccessible: appInfo.isAccessible ?? false,
        isEnabled: appInfo.isEnabled ?? true,
      })),
      nextCursor: parsed.nextCursor,
    };
  }

  public async listSkills(options?: ListSkillsOptions): Promise<ListSkillsResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.listSkills,
      buildListSkillsRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerSkillsListResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listSkills,
    );
    return {
      data: parsed.data.map((entry) => ({
        cwd: entry.cwd,
        skills: entry.skills.map((skill) => ({
          name: skill.name,
          description: skill.description,
          shortDescription: skill.shortDescription ?? null,
          path: skill.path,
          scope: skill.scope,
          enabled: skill.enabled,
        })),
        errors: entry.errors.map((error) => ({
          path: error.path,
          message: error.message,
        })),
      })),
    };
  }

  public async readAccount(options?: ReadAccountOptions): Promise<ReadAccountResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.readAccount,
      buildReadAccountRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerGetAccountResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.readAccount,
    );
    return {
      account:
        parsed.account === null
          ? null
          : parsed.account.type === "apiKey"
            ? { type: "apiKey" }
            : {
                type: "chatgpt",
                email: parsed.account.email,
                planType: parsed.account.planType,
              },
      requiresOpenaiAuth: parsed.requiresOpenaiAuth,
    };
  }

  public async readAccountRateLimits(): Promise<ReadAccountRateLimitsResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.readAccountRateLimits,
      buildReadAccountRateLimitsRequestParameters(),
    );
    const parsed = parseAppServerResponse(
      AppServerGetAccountRateLimitsResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.readAccountRateLimits,
    );
    const rateLimitsByLimitIdSource = parsed.rateLimitsByLimitId;
    return {
      rateLimits: mapAccountRateLimitSnapshot(parsed.rateLimits),
      rateLimitsByLimitId:
        rateLimitsByLimitIdSource === undefined || rateLimitsByLimitIdSource === null
          ? null
          : Object.fromEntries(
              Object.entries(rateLimitsByLimitIdSource).map(([limitId, snapshot]) => [
                limitId,
                mapAccountRateLimitSnapshot(snapshot),
              ]),
            ),
    };
  }

  public async startAccountLogin(options: LoginAccountOptions): Promise<LoginAccountResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.startAccountLogin,
      buildStartAccountLoginRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerLoginAccountResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.startAccountLogin,
    );
    if (parsed.type === "apiKey") {
      return {
        type: "apiKey",
      };
    }
    if (parsed.type === "chatgptAuthTokens") {
      return {
        type: "chatgptAuthTokens",
      };
    }
    return {
      type: "chatgpt",
      loginId: parsed.loginId,
      authUrl: parsed.authUrl,
    };
  }

  public async cancelAccountLogin(
    options: CancelAccountLoginOptions,
  ): Promise<CancelAccountLoginResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.cancelAccountLogin,
      buildCancelAccountLoginRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerCancelLoginAccountResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.cancelAccountLogin,
    );
    return {
      status: parsed.status,
    };
  }

  public async logoutAccount(): Promise<void> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.logoutAccount,
      buildLogoutAccountRequestParameters(),
    );
    parseAppServerResponse(
      AppServerLogoutAccountResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.logoutAccount,
    );
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

  public async startThread(options: StartThreadOptions): Promise<AppServerStartThreadResponse> {
    const request = buildStartThreadRequest(options);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.startThread, request);
    return parseAppServerResponse(
      AppServerStartThreadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.startThread,
    );
  }

  public async setThreadName(threadId: string, name: string): Promise<void> {
    const request = buildSetThreadNameRequest(threadId, name);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.setThreadName, request);
    parseAppServerResponse(
      AppServerSetThreadNameResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.setThreadName,
    );
  }

  public async rollbackThread(
    threadId: string,
    numTurns: number,
  ): Promise<AppServerReadThreadResponse> {
    const request = buildRollbackThreadRequest(threadId, numTurns);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.rollbackThread, request);
    return parseAppServerResponse(
      AppServerReadThreadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.rollbackThread,
    );
  }

  public async compactThread(threadId: string): Promise<void> {
    const request = buildThreadCompactStartRequest(threadId);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.compactThread, request);
    parseAppServerResponse(
      AppServerThreadCompactStartResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.compactThread,
    );
  }

  public async cleanThreadBackgroundTerminals(threadId: string): Promise<void> {
    const request = buildThreadBackgroundTerminalsCleanRequest(threadId);
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.cleanThreadBackgroundTerminals,
      request,
    );
    parseAppServerResponse(
      AppServerThreadBackgroundTerminalsCleanResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.cleanThreadBackgroundTerminals,
    );
  }

  public async startReview(options: StartReviewOptions): Promise<StartReviewResult> {
    const request = buildStartReviewRequest(options);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.startReview, request);
    const parsed = parseAppServerResponse(
      AppServerReviewStartResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.startReview,
    );
    return {
      reviewThreadId: parsed.reviewThreadId,
      turnId: parsed.turn.id,
    };
  }

  public async startTurn(options: StartTurnOptions): Promise<void> {
    const request = buildStartTurnRequest(options);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.startTurn, request);
    parseAppServerResponse(
      AppServerTurnStartResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.startTurn,
    );
  }

  public async steerTurn(threadId: string, expectedTurnId: string, text: string): Promise<string> {
    const request = buildSteerTurnRequest(threadId, expectedTurnId, text);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.steerTurn, request);
    const parsedResponse = parseAppServerResponse(
      AppServerTurnSteerResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.steerTurn,
    );
    return parsedResponse.turnId;
  }

  public async interruptTurn(threadId: string, turnId: string): Promise<void> {
    const request = buildTurnInterruptRequest(threadId, turnId);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.interruptTurn, request);
    parseAppServerResponse(
      AppServerTurnInterruptResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.interruptTurn,
    );
  }

  public async submitServerRequestResponse(
    requestId: number,
    responsePayload: ThreadConversationRequestResponse,
  ): Promise<void> {
    if (!this.transport.respond) {
      throw new AppServerTransportError(
        "App-server transport does not support server-request responses.",
      );
    }

    const parsedResponsePayload = parseThreadConversationRequestResponse(
      JsonValueSchema.parse(responsePayload),
    );
    await this.transport.respond(requestId, parsedResponsePayload);
  }

  public readNotificationEvents(
    input: AppServerReadNotificationEventsInput,
  ): AppServerReadNotificationEventsResult {
    if (!this.transport.readNotificationEvents) {
      throw new AppServerTransportError(
        "App-server transport does not support notification event reads.",
      );
    }

    return this.transport.readNotificationEvents(input);
  }

  public readPendingServerRequests(): AppServerPendingServerRequest[] {
    if (!this.transport.readPendingServerRequests) {
      throw new AppServerTransportError(
        "App-server transport does not expose pending server requests.",
      );
    }

    return this.transport.readPendingServerRequests();
  }

  public async resumeThread(
    threadId: string,
    options?: ResumeThreadOptions,
  ): Promise<AppServerReadThreadResponse> {
    const request = buildResumeThreadRequest(threadId, options);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.resumeThread, request);
    return parseAppServerResponse(
      AppServerReadThreadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.resumeThread,
    );
  }

  public async unsubscribeThread(threadId: string): Promise<UnsubscribeThreadStatus> {
    const request = buildUnsubscribeThreadRequest(threadId);
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.unsubscribeThread,
      request,
    );
    const parsed = parseAppServerResponse(
      AppServerThreadUnsubscribeResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.unsubscribeThread,
    );
    return parsed.status;
  }

  public async archiveThread(threadId: string): Promise<void> {
    const request = buildArchiveThreadRequest(threadId);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.archiveThread, request);
    parseAppServerResponse(
      AppServerArchiveThreadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.archiveThread,
    );
  }

  public async unarchiveThread(threadId: string): Promise<AppServerStartThreadResponse["thread"]> {
    const request = buildUnarchiveThreadRequest(threadId);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.unarchiveThread, request);
    const parsed = parseAppServerResponse(
      AppServerUnarchiveThreadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.unarchiveThread,
    );
    return parsed.thread;
  }
}
