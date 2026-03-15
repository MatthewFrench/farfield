// biome-ignore lint/nursery/noExcessiveLinesPerFile: Interface-client decomposition follow-up is tracked in docs/proposed-structure-and-migration.md decision entry 20.
import {
  type AppServerCollaborationModeListResponse,
  type AppServerConfigReadResponse,
  type AppServerListModelsResponse,
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
import { AppServerCapabilityAccountClient } from "./AppServerCapabilityAccountClient.js";
import { AppServerCapabilityCatalogClient } from "./AppServerCapabilityCatalogClient.js";
import { AppServerCapabilityConfigurationClient } from "./AppServerCapabilityConfigurationClient.js";
import { buildCommandExecutionRequestParameters } from "./AppServerClientCommandExecutionRequestBuilders.js";
import {
  buildExternalAgentConfigDetectRequestParameters,
  buildExternalAgentConfigImportRequestParameters,
} from "./AppServerClientExternalAgentConfigRequestBuilders.js";
import { buildFeedbackUploadRequestParameters } from "./AppServerClientFeedbackUploadRequestBuilders.js";
import {
  buildFuzzyFileSearchRequestParameters,
  buildFuzzyFileSearchSessionStartRequestParameters,
  buildFuzzyFileSearchSessionStopRequestParameters,
  buildFuzzyFileSearchSessionUpdateRequestParameters,
} from "./AppServerClientFuzzyFileSearchRequestBuilders.js";
import { buildGitDiffToRemoteRequestParameters } from "./AppServerClientGitDiffRequestBuilders.js";
import { APP_SERVER_CLIENT_METHODS } from "./AppServerClientMethodConstants.js";
import {
  buildArchiveThreadRequest,
  buildForkThreadRequest,
  buildListLoadedThreadsRequestParameters,
  buildListThreadsAllPageOptions,
  buildListThreadsRequestParameters,
  buildReadThreadRequestParameters,
  buildResumeThreadRequest,
  buildRollbackThreadRequest,
  buildSetThreadNameRequest,
  buildStartMcpServerOauthLoginRequestParameters,
  buildStartReviewRequest,
  buildStartThreadRequest,
  buildStartTurnRequest,
  buildSteerTurnRequest,
  buildThreadBackgroundTerminalsCleanRequest,
  buildThreadCompactStartRequest,
  buildTurnInterruptRequest,
  buildUnarchiveThreadRequest,
  buildUnsubscribeThreadRequest,
  buildWriteSkillsConfigRequestParameters,
  resolveReadThreadRequestTimeoutMilliseconds,
} from "./AppServerClientRequestBuilders.js";
import {
  APP_SERVER_CLIENT_RESPONSE_CONTEXTS,
  parseAppServerResponse,
} from "./AppServerClientResponseParser.js";
import {
  buildExportRemoteSkillRequestParameters,
  buildListRemoteSkillsRequestParameters,
} from "./AppServerClientSkillsRemoteRequestBuilders.js";
import {
  buildThreadRealtimeAppendAudioRequestParameters,
  buildThreadRealtimeAppendTextRequestParameters,
  buildThreadRealtimeStartRequestParameters,
  buildThreadRealtimeStopRequestParameters,
} from "./AppServerClientThreadRealtimeRequestBuilders.js";
import { buildWindowsSandboxSetupStartRequestParameters } from "./AppServerClientWindowsSandboxRequestBuilders.js";
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

export interface ReadAuthStatusOptions {
  includeToken?: boolean;
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

export type AuthStatusMethod = "apikey" | "chatgpt" | "chatgptAuthTokens";

export interface ReadAuthStatusResult {
  authMethod: AuthStatusMethod | null;
  authToken: string | null;
  requiresOpenaiAuth: boolean | null;
}

export interface ReadUserInfoResult {
  allegedUserEmail: string | null;
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

export interface FeedbackUploadOptions {
  classification: string;
  reason?: string | null;
  threadId?: string | null;
  includeLogs: boolean;
}

export interface FeedbackUploadResult {
  threadId: string;
}

export interface GitDiffToRemoteOptions {
  cwd: string;
}

export interface GitDiffToRemoteResult {
  sha: string;
  diff: string;
}

export interface FuzzyFileSearchOptions {
  query: string;
  roots: string[];
  cancellationToken?: string | null;
}

export interface FuzzyFileSearchMatch {
  root: string;
  path: string;
  fileName: string;
  score: number;
  indices: number[] | null;
}

export interface FuzzyFileSearchResult {
  files: FuzzyFileSearchMatch[];
}

export interface FuzzyFileSearchSessionStartOptions {
  sessionId: string;
  roots: string[];
}

export interface FuzzyFileSearchSessionStartResult {}

export interface FuzzyFileSearchSessionUpdateOptions {
  sessionId: string;
  query: string;
}

export interface FuzzyFileSearchSessionUpdateResult {}

export interface FuzzyFileSearchSessionStopOptions {
  sessionId: string;
}

export interface FuzzyFileSearchSessionStopResult {}

export interface CommandExecutionOptions {
  command: string[];
  timeoutMilliseconds?: number;
  cwd?: string;
}

export interface CommandExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
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

export interface StartMcpServerOauthLoginOptions {
  name: string;
  scopes?: string[] | null;
  timeoutSeconds?: number | null;
}

export interface StartMcpServerOauthLoginResult {
  authorizationUrl: string;
}

export interface WriteSkillsConfigOptions {
  path: string;
  enabled: boolean;
}

export interface WriteSkillsConfigResult {
  effectiveEnabled: boolean;
}

export type RemoteSkillsHazelnutScope = "example" | "workspace-shared" | "all-shared" | "personal";
export type RemoteSkillsProductSurface = "chatgpt" | "codex" | "api" | "atlas";

export interface ListRemoteSkillsOptions {
  hazelnutScope: RemoteSkillsHazelnutScope;
  productSurface: RemoteSkillsProductSurface;
  enabled: boolean;
}

export interface RemoteSkillSummary {
  id: string;
  name: string;
  description: string;
}

export interface ListRemoteSkillsResult {
  data: RemoteSkillSummary[];
}

export interface ExportRemoteSkillOptions {
  hazelnutId: string;
}

export interface ExportRemoteSkillResult {
  id: string;
  path: string;
}

export type ExternalAgentConfigMigrationItemType =
  | "AGENTS_MD"
  | "CONFIG"
  | "SKILLS"
  | "MCP_SERVER_CONFIG";

export interface ExternalAgentConfigMigrationItem {
  itemType: ExternalAgentConfigMigrationItemType;
  description: string;
  cwd: string | null;
}

export interface ExternalAgentConfigDetectOptions {
  includeHome: boolean;
  cwds?: string[];
}

export interface ExternalAgentConfigDetectResult {
  items: ExternalAgentConfigMigrationItem[];
}

export interface ExternalAgentConfigImportOptions {
  migrationItems: ExternalAgentConfigMigrationItem[];
}

export interface ExternalAgentConfigImportResult {}

export interface ThreadRealtimeStartOptions {
  threadId: string;
  prompt: string;
  sessionId?: string | null;
}

export interface ThreadRealtimeStartResult {}

export interface ThreadRealtimeAudioChunk {
  data: string;
  sampleRate: number;
  numChannels: number;
  samplesPerChannel?: number;
}

export interface ThreadRealtimeAppendAudioOptions {
  threadId: string;
  audio: ThreadRealtimeAudioChunk;
}

export interface ThreadRealtimeAppendAudioResult {}

export interface ThreadRealtimeAppendTextOptions {
  threadId: string;
  text: string;
}

export interface ThreadRealtimeAppendTextResult {}

export interface ThreadRealtimeStopOptions {
  threadId: string;
}

export interface ThreadRealtimeStopResult {}

export type WindowsSandboxSetupMode = "elevated" | "unelevated";

export interface WindowsSandboxSetupStartOptions {
  mode: WindowsSandboxSetupMode;
}

export interface WindowsSandboxSetupStartResult {
  started: boolean;
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
const AppServerFeedbackUploadResponseSchema = z
  .object({
    threadId: z.string().min(1),
  })
  .passthrough();
const AppServerGitDiffToRemoteResponseSchema = z
  .object({
    sha: z.string().min(1),
    diff: z.string(),
  })
  .passthrough();
const AppServerFuzzyFileSearchResponseSchema = z
  .object({
    files: z.array(
      z
        .object({
          root: z.string().min(1),
          path: z.string().min(1),
          file_name: z.string().min(1),
          score: z.number(),
          indices: z.array(z.number().int()).nullable(),
        })
        .passthrough(),
    ),
  })
  .passthrough();
const AppServerFuzzyFileSearchSessionStartResponseSchema = z.object({}).passthrough();
const AppServerFuzzyFileSearchSessionUpdateResponseSchema = z.object({}).passthrough();
const AppServerFuzzyFileSearchSessionStopResponseSchema = z.object({}).passthrough();
const AppServerCommandExecResponseSchema = z
  .object({
    exitCode: z.number().int(),
    stdout: z.string(),
    stderr: z.string(),
  })
  .passthrough();
const AppServerMcpServerOauthLoginResponseSchema = z
  .object({
    authorizationUrl: z.string().min(1),
  })
  .passthrough();
const AppServerSkillsConfigWriteResponseSchema = z
  .object({
    effectiveEnabled: z.boolean(),
  })
  .passthrough();
const AppServerSkillsRemoteListResponseSchema = z
  .object({
    data: z.array(
      z
        .object({
          id: z.string().min(1),
          name: z.string().min(1),
          description: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough();
const AppServerSkillsRemoteExportResponseSchema = z
  .object({
    id: z.string().min(1),
    path: z.string().min(1),
  })
  .passthrough();
const AppServerExternalAgentConfigMigrationItemTypeSchema = z.enum([
  "AGENTS_MD",
  "CONFIG",
  "SKILLS",
  "MCP_SERVER_CONFIG",
]);
const AppServerExternalAgentConfigMigrationItemSchema = z
  .object({
    itemType: AppServerExternalAgentConfigMigrationItemTypeSchema,
    description: z.string().min(1),
    cwd: z.string().nullable().optional(),
  })
  .passthrough();
const AppServerExternalAgentConfigDetectResponseSchema = z
  .object({
    items: z.array(AppServerExternalAgentConfigMigrationItemSchema),
  })
  .passthrough();
const AppServerExternalAgentConfigImportResponseSchema = z.object({}).passthrough();
const AppServerThreadRealtimeStartResponseSchema = z.object({}).passthrough();
const AppServerThreadRealtimeAppendAudioResponseSchema = z.object({}).passthrough();
const AppServerThreadRealtimeAppendTextResponseSchema = z.object({}).passthrough();
const AppServerThreadRealtimeStopResponseSchema = z.object({}).passthrough();
const AppServerWindowsSandboxSetupStartResponseSchema = z
  .object({
    started: z.boolean(),
  })
  .passthrough();
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

/**
 * Owns typed request/response mapping for Codex app-server RPC methods.
 * Transport concerns stay in `AppServerTransport`; schema enforcement stays here.
 */
export class AppServerClient {
  private readonly transport: AppServerTransport;
  private readonly capabilityAccountClient: AppServerCapabilityAccountClient;
  private readonly capabilityCatalogClient: AppServerCapabilityCatalogClient;
  private readonly capabilityConfigurationClient: AppServerCapabilityConfigurationClient;

  public constructor(
    transportOrOptions: AppServerTransport | ChildProcessAppServerTransportOptions,
  ) {
    const resolvedTransport = isChildProcessAppServerTransportOptions(transportOrOptions)
      ? new ChildProcessAppServerTransport(transportOrOptions)
      : transportOrOptions;
    this.transport = resolvedTransport;
    this.capabilityAccountClient = new AppServerCapabilityAccountClient(resolvedTransport);
    this.capabilityCatalogClient = new AppServerCapabilityCatalogClient(resolvedTransport);
    this.capabilityConfigurationClient = new AppServerCapabilityConfigurationClient(
      resolvedTransport,
    );
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

  public async listModels(limit?: number): Promise<AppServerListModelsResponse> {
    return this.capabilityCatalogClient.listModels(limit);
  }

  public async listCollaborationModes(): Promise<AppServerCollaborationModeListResponse> {
    return this.capabilityCatalogClient.listCollaborationModes();
  }

  public async readConfig(options?: ReadConfigOptions): Promise<AppServerConfigReadResponse> {
    return this.capabilityConfigurationClient.readConfig(options);
  }

  public async readConfigRequirements(
    options?: ReadConfigRequirementsOptions,
  ): Promise<ReadConfigRequirementsResult> {
    return this.capabilityConfigurationClient.readConfigRequirements(options);
  }

  public async listExperimentalFeatures(
    options?: ListExperimentalFeaturesOptions,
  ): Promise<ListExperimentalFeaturesResult> {
    return this.capabilityCatalogClient.listExperimentalFeatures(options);
  }

  public async listMcpServerStatuses(
    options?: ListMcpServerStatusesOptions,
  ): Promise<ListMcpServerStatusesResult> {
    return this.capabilityCatalogClient.listMcpServerStatuses(options);
  }

  public async listApps(options?: ListAppsOptions): Promise<ListAppsResult> {
    return this.capabilityCatalogClient.listApps(options);
  }

  public async listSkills(options?: ListSkillsOptions): Promise<ListSkillsResult> {
    return this.capabilityCatalogClient.listSkills(options);
  }

  public async readAccount(options?: ReadAccountOptions): Promise<ReadAccountResult> {
    return this.capabilityAccountClient.readAccount(options);
  }

  public async readAuthStatus(options?: ReadAuthStatusOptions): Promise<ReadAuthStatusResult> {
    return this.capabilityAccountClient.readAuthStatus(options);
  }

  public async readAccountRateLimits(): Promise<ReadAccountRateLimitsResult> {
    return this.capabilityAccountClient.readAccountRateLimits();
  }

  public async readUserInfo(): Promise<ReadUserInfoResult> {
    return this.capabilityAccountClient.readUserInfo();
  }

  public async uploadFeedback(options: FeedbackUploadOptions): Promise<FeedbackUploadResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.uploadFeedback,
      buildFeedbackUploadRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerFeedbackUploadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.uploadFeedback,
    );
    return {
      threadId: parsed.threadId,
    };
  }

  public async gitDiffToRemote(options: GitDiffToRemoteOptions): Promise<GitDiffToRemoteResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.gitDiffToRemote,
      buildGitDiffToRemoteRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerGitDiffToRemoteResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.gitDiffToRemote,
    );
    return {
      sha: parsed.sha,
      diff: parsed.diff,
    };
  }

  public async fuzzyFileSearch(options: FuzzyFileSearchOptions): Promise<FuzzyFileSearchResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.fuzzyFileSearch,
      buildFuzzyFileSearchRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerFuzzyFileSearchResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.fuzzyFileSearch,
    );
    return {
      files: parsed.files.map((fileMatch) => ({
        root: fileMatch.root,
        path: fileMatch.path,
        fileName: fileMatch.file_name,
        score: fileMatch.score,
        indices: fileMatch.indices,
      })),
    };
  }

  public async startFuzzyFileSearchSession(
    options: FuzzyFileSearchSessionStartOptions,
  ): Promise<FuzzyFileSearchSessionStartResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.fuzzyFileSearchSessionStart,
      buildFuzzyFileSearchSessionStartRequestParameters(options),
    );
    return parseAppServerResponse(
      AppServerFuzzyFileSearchSessionStartResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.fuzzyFileSearchSessionStart,
    );
  }

  public async updateFuzzyFileSearchSession(
    options: FuzzyFileSearchSessionUpdateOptions,
  ): Promise<FuzzyFileSearchSessionUpdateResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.fuzzyFileSearchSessionUpdate,
      buildFuzzyFileSearchSessionUpdateRequestParameters(options),
    );
    return parseAppServerResponse(
      AppServerFuzzyFileSearchSessionUpdateResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.fuzzyFileSearchSessionUpdate,
    );
  }

  public async stopFuzzyFileSearchSession(
    options: FuzzyFileSearchSessionStopOptions,
  ): Promise<FuzzyFileSearchSessionStopResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.fuzzyFileSearchSessionStop,
      buildFuzzyFileSearchSessionStopRequestParameters(options),
    );
    return parseAppServerResponse(
      AppServerFuzzyFileSearchSessionStopResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.fuzzyFileSearchSessionStop,
    );
  }

  public async executeCommand(options: CommandExecutionOptions): Promise<CommandExecutionResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.executeCommand,
      buildCommandExecutionRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerCommandExecResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.executeCommand,
    );
    return {
      exitCode: parsed.exitCode,
      stdout: parsed.stdout,
      stderr: parsed.stderr,
    };
  }

  public async writeConfigBatch(options: ConfigBatchWriteOptions): Promise<ConfigWriteResult> {
    return this.capabilityConfigurationClient.writeConfigBatch(options);
  }

  public async writeConfigValue(options: ConfigWriteValueOptions): Promise<ConfigWriteResult> {
    return this.capabilityConfigurationClient.writeConfigValue(options);
  }

  public async startAccountLogin(options: LoginAccountOptions): Promise<LoginAccountResult> {
    return this.capabilityAccountClient.startAccountLogin(options);
  }

  public async cancelAccountLogin(
    options: CancelAccountLoginOptions,
  ): Promise<CancelAccountLoginResult> {
    return this.capabilityAccountClient.cancelAccountLogin(options);
  }

  public async logoutAccount(): Promise<void> {
    await this.capabilityAccountClient.logoutAccount();
  }

  public async reloadMcpServerConfig(): Promise<void> {
    await this.capabilityConfigurationClient.reloadMcpServerConfig();
  }

  public async startMcpServerOauthLogin(
    options: StartMcpServerOauthLoginOptions,
  ): Promise<StartMcpServerOauthLoginResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.startMcpServerOauthLogin,
      buildStartMcpServerOauthLoginRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerMcpServerOauthLoginResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.startMcpServerOauthLogin,
    );
    return {
      authorizationUrl: parsed.authorizationUrl,
    };
  }

  public async writeSkillsConfig(
    options: WriteSkillsConfigOptions,
  ): Promise<WriteSkillsConfigResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.writeSkillsConfig,
      buildWriteSkillsConfigRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerSkillsConfigWriteResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.writeSkillsConfig,
    );
    return {
      effectiveEnabled: parsed.effectiveEnabled,
    };
  }

  public async listRemoteSkills(options: ListRemoteSkillsOptions): Promise<ListRemoteSkillsResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.listRemoteSkills,
      buildListRemoteSkillsRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerSkillsRemoteListResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listRemoteSkills,
    );
    return {
      data: parsed.data.map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
      })),
    };
  }

  public async exportRemoteSkill(
    options: ExportRemoteSkillOptions,
  ): Promise<ExportRemoteSkillResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.exportRemoteSkill,
      buildExportRemoteSkillRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerSkillsRemoteExportResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.exportRemoteSkill,
    );
    return {
      id: parsed.id,
      path: parsed.path,
    };
  }

  public async detectExternalAgentConfig(
    options: ExternalAgentConfigDetectOptions,
  ): Promise<ExternalAgentConfigDetectResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.detectExternalAgentConfig,
      buildExternalAgentConfigDetectRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerExternalAgentConfigDetectResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.detectExternalAgentConfig,
    );
    return {
      items: parsed.items.map((migrationItem) => ({
        itemType: migrationItem.itemType,
        description: migrationItem.description,
        cwd: migrationItem.cwd ?? null,
      })),
    };
  }

  public async importExternalAgentConfig(
    options: ExternalAgentConfigImportOptions,
  ): Promise<ExternalAgentConfigImportResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.importExternalAgentConfig,
      buildExternalAgentConfigImportRequestParameters(options),
    );
    parseAppServerResponse(
      AppServerExternalAgentConfigImportResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.importExternalAgentConfig,
    );
    return {};
  }

  public async startThreadRealtime(
    options: ThreadRealtimeStartOptions,
  ): Promise<ThreadRealtimeStartResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.startThreadRealtime,
      buildThreadRealtimeStartRequestParameters(options),
    );
    parseAppServerResponse(
      AppServerThreadRealtimeStartResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.startThreadRealtime,
    );
    return {};
  }

  public async appendThreadRealtimeAudio(
    options: ThreadRealtimeAppendAudioOptions,
  ): Promise<ThreadRealtimeAppendAudioResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.appendThreadRealtimeAudio,
      buildThreadRealtimeAppendAudioRequestParameters(options),
    );
    parseAppServerResponse(
      AppServerThreadRealtimeAppendAudioResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.appendThreadRealtimeAudio,
    );
    return {};
  }

  public async appendThreadRealtimeText(
    options: ThreadRealtimeAppendTextOptions,
  ): Promise<ThreadRealtimeAppendTextResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.appendThreadRealtimeText,
      buildThreadRealtimeAppendTextRequestParameters(options),
    );
    parseAppServerResponse(
      AppServerThreadRealtimeAppendTextResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.appendThreadRealtimeText,
    );
    return {};
  }

  public async stopThreadRealtime(
    options: ThreadRealtimeStopOptions,
  ): Promise<ThreadRealtimeStopResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.stopThreadRealtime,
      buildThreadRealtimeStopRequestParameters(options),
    );
    parseAppServerResponse(
      AppServerThreadRealtimeStopResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.stopThreadRealtime,
    );
    return {};
  }

  public async startWindowsSandboxSetup(
    options: WindowsSandboxSetupStartOptions,
  ): Promise<WindowsSandboxSetupStartResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.startWindowsSandboxSetup,
      buildWindowsSandboxSetupStartRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerWindowsSandboxSetupStartResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.startWindowsSandboxSetup,
    );
    return {
      started: parsed.started,
    };
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
