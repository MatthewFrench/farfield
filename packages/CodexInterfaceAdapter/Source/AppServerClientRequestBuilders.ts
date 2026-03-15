import {
  AppServerStartThreadRequestSchema,
  AppServerTurnStartRequestSchema,
} from "@farfield/protocol";
import { z } from "zod";
import type {
  CancelAccountLoginOptions,
  ForkThreadOptions,
  ListAppsOptions,
  ListExperimentalFeaturesOptions,
  ListLoadedThreadsOptions,
  ListMcpServerStatusesOptions,
  ListSkillsOptions,
  ListThreadsAllOptions,
  ListThreadsOptions,
  LoginAccountOptions,
  ReadAccountOptions,
  ReadConfigOptions,
  ReadConfigRequirementsOptions,
  ResumeThreadOptions,
  StartMcpServerOauthLoginOptions,
  StartReviewOptions,
  StartThreadOptions,
  StartTurnOptions,
  WriteSkillsConfigOptions,
} from "./AppServerClient.js";
import { buildTurnStartMessageParameters } from "./TurnStartMessageParametersBuilder.js";

const AppServerResumeThreadRequestSchema = z
  .object({
    threadId: z.string().min(1),
    persistExtendedHistory: z.boolean(),
  })
  .passthrough();
const AppServerThreadLoadedListRequestSchema = z
  .object({
    cursor: z.union([z.string(), z.null()]).optional(),
    limit: z.union([z.number().int().min(1), z.null()]).optional(),
  })
  .passthrough();
const AppServerConfigRequirementsReadRequestSchema = z.object({}).passthrough();
const AppServerAccountReadRequestSchema = z
  .object({
    refreshToken: z.boolean().optional(),
  })
  .passthrough();
const AppServerAccountRateLimitsReadRequestSchema = z.object({}).passthrough();
const AppServerAccountLoginStartRequestSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("apiKey"),
      apiKey: z.string().min(1),
    })
    .passthrough(),
  z
    .object({
      type: z.literal("chatgpt"),
    })
    .passthrough(),
  z
    .object({
      type: z.literal("chatgptAuthTokens"),
      accessToken: z.string().min(1),
      chatgptAccountId: z.string().min(1),
      chatgptPlanType: z
        .enum(["free", "go", "plus", "pro", "team", "business", "enterprise", "edu", "unknown"])
        .nullable()
        .optional(),
    })
    .passthrough(),
]);
const AppServerAccountLoginCancelRequestSchema = z
  .object({
    loginId: z.string().min(1),
  })
  .passthrough();
const AppServerAccountLogoutRequestSchema = z.object({}).passthrough();
const AppServerConfigMcpServerReloadRequestSchema = z.object({}).passthrough();
const AppServerMcpServerOauthLoginRequestSchema = z
  .object({
    name: z.string().min(1),
    scopes: z.array(z.string().min(1)).nullable().optional(),
    timeoutSecs: z.number().int().nonnegative().nullable().optional(),
  })
  .passthrough();
const AppServerExperimentalFeatureListRequestSchema = z
  .object({
    cursor: z.union([z.string(), z.null()]).optional(),
    limit: z.union([z.number().int().min(1), z.null()]).optional(),
  })
  .passthrough();
const AppServerMcpServerStatusListRequestSchema = z
  .object({
    cursor: z.union([z.string(), z.null()]).optional(),
    limit: z.union([z.number().int().min(1), z.null()]).optional(),
  })
  .passthrough();
const AppServerAppListRequestSchema = z
  .object({
    cursor: z.union([z.string(), z.null()]).optional(),
    limit: z.union([z.number().int().min(1), z.null()]).optional(),
    threadId: z.union([z.string().min(1), z.null()]).optional(),
    forceRefetch: z.boolean().optional(),
  })
  .passthrough();
const AppServerSkillsListExtraRootsForCwdRequestSchema = z
  .object({
    cwd: z.string().min(1),
    extraUserRoots: z.array(z.string().min(1)),
  })
  .passthrough();
const AppServerSkillsListRequestSchema = z
  .object({
    cwds: z.array(z.string().min(1)).optional(),
    forceReload: z.boolean().optional(),
    perCwdExtraUserRoots: z
      .union([z.array(AppServerSkillsListExtraRootsForCwdRequestSchema), z.null()])
      .optional(),
  })
  .passthrough();
const AppServerSkillsConfigWriteRequestSchema = z
  .object({
    path: z.string().min(1),
    enabled: z.boolean(),
  })
  .passthrough();
const AppServerThreadUnsubscribeRequestSchema = z
  .object({
    threadId: z.string().min(1),
  })
  .passthrough();
const AppServerArchiveThreadRequestSchema = z
  .object({
    threadId: z.string().min(1),
  })
  .passthrough();
const AppServerUnarchiveThreadRequestSchema = z
  .object({
    threadId: z.string().min(1),
  })
  .passthrough();
const AppServerForkThreadRequestSchema = z
  .object({
    threadId: z.string().min(1),
    persistExtendedHistory: z.boolean(),
  })
  .passthrough();
const AppServerSetThreadNameRequestSchema = z
  .object({
    threadId: z.string().min(1),
    name: z.string().trim().min(1),
  })
  .passthrough();
const AppServerRollbackThreadRequestSchema = z
  .object({
    threadId: z.string().min(1),
    numTurns: z.number().int().min(1),
  })
  .passthrough();
const AppServerThreadCompactStartRequestSchema = z
  .object({
    threadId: z.string().min(1),
  })
  .passthrough();
const AppServerThreadBackgroundTerminalsCleanRequestSchema = z
  .object({
    threadId: z.string().min(1),
  })
  .passthrough();
const AppServerTurnInterruptRequestSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
  })
  .passthrough();
const AppServerTurnSteerTextInputSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
  })
  .passthrough();
const AppServerTurnSteerRequestSchema = z
  .object({
    threadId: z.string().min(1),
    expectedTurnId: z.string().min(1),
    input: z.array(AppServerTurnSteerTextInputSchema).min(1),
  })
  .passthrough();
const AppServerReviewDeliverySchema = z.enum(["inline", "detached"]);
const AppServerReviewTargetSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("uncommittedChanges"),
    })
    .strict(),
  z
    .object({
      type: z.literal("baseBranch"),
      branch: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("commit"),
      sha: z.string().min(1),
      title: z.string().nullable().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("custom"),
      instructions: z.string().min(1),
    })
    .strict(),
]);
const AppServerReviewStartRequestSchema = z
  .object({
    threadId: z.string().min(1),
    target: AppServerReviewTargetSchema,
    delivery: AppServerReviewDeliverySchema.nullable().optional(),
  })
  .passthrough();

/**
 * Centralized request defaults for AppServerClient methods.
 */
export const APP_SERVER_CLIENT_DEFAULT_LIST_MODELS_LIMIT = 100;
export const APP_SERVER_CLIENT_DEFAULT_READ_CONFIG_INCLUDE_LAYERS = false;
export const APP_SERVER_CLIENT_DEFAULT_RESUME_THREAD_PERSIST_EXTENDED_HISTORY = true;
export const APP_SERVER_CLIENT_DEFAULT_FORK_THREAD_PERSIST_EXTENDED_HISTORY = true;
// Reading turns can include full conversation history and is expected to take longer than lightweight reads.
export const APP_SERVER_CLIENT_READ_THREAD_WITH_TURNS_TIMEOUT_MILLISECONDS = 90_000;

interface ListThreadsRequestParameters {
  limit: number;
  archived: boolean;
  cursor: string | null;
  sortKey?: "created_at" | "updated_at";
  cwd?: string;
}

interface ListLoadedThreadsRequestParameters {
  cursor?: string | null | undefined;
  limit?: number | null | undefined;
}

interface ReadConfigRequirementsRequestParameters {}

interface ListExperimentalFeaturesRequestParameters {
  cursor?: string | null | undefined;
  limit?: number | null | undefined;
}

interface ListMcpServerStatusesRequestParameters {
  cursor?: string | null | undefined;
  limit?: number | null | undefined;
}

interface ListAppsRequestParameters {
  cursor?: string | null | undefined;
  limit?: number | null | undefined;
  threadId?: string | null | undefined;
  forceRefetch?: boolean | undefined;
}

interface ListSkillsExtraRootsForCwdRequestParameters {
  cwd: string;
  extraUserRoots: string[];
}

interface ListSkillsRequestParameters {
  cwds?: string[] | undefined;
  forceReload?: boolean | undefined;
  perCwdExtraUserRoots?: ListSkillsExtraRootsForCwdRequestParameters[] | null | undefined;
}

interface StartMcpServerOauthLoginRequestParameters {
  name: string;
  scopes?: string[] | null | undefined;
  timeoutSecs?: number | null | undefined;
}

interface WriteSkillsConfigRequestParameters {
  path: string;
  enabled: boolean;
}

interface ReadAccountRequestParameters {
  refreshToken?: boolean | undefined;
}

type StartAccountLoginRequestParameters = z.infer<typeof AppServerAccountLoginStartRequestSchema>;

interface CancelAccountLoginRequestParameters {
  loginId: string;
}

interface LogoutAccountRequestParameters {}

interface ReloadMcpServerConfigRequestParameters {}

export function buildListLoadedThreadsRequestParameters(
  options?: ListLoadedThreadsOptions,
): ListLoadedThreadsRequestParameters {
  return AppServerThreadLoadedListRequestSchema.parse({
    ...(options?.cursor !== undefined ? { cursor: options.cursor } : {}),
    ...(options?.limit !== undefined ? { limit: options.limit } : {}),
  });
}

export function buildReadConfigRequirementsRequestParameters(
  _options?: ReadConfigRequirementsOptions,
): ReadConfigRequirementsRequestParameters {
  return AppServerConfigRequirementsReadRequestSchema.parse({});
}

export function buildReadAccountRequestParameters(
  options?: ReadAccountOptions,
): ReadAccountRequestParameters {
  return AppServerAccountReadRequestSchema.parse({
    ...(options?.refreshToken !== undefined ? { refreshToken: options.refreshToken } : {}),
  });
}

export function buildReadAccountRateLimitsRequestParameters(): object {
  return AppServerAccountRateLimitsReadRequestSchema.parse({});
}

export function buildStartAccountLoginRequestParameters(
  options: LoginAccountOptions,
): StartAccountLoginRequestParameters {
  if (options.type === "apiKey") {
    return AppServerAccountLoginStartRequestSchema.parse({
      type: "apiKey",
      apiKey: options.apiKey,
    });
  }

  if (options.type === "chatgpt") {
    return AppServerAccountLoginStartRequestSchema.parse({
      type: "chatgpt",
    });
  }

  return AppServerAccountLoginStartRequestSchema.parse({
    type: "chatgptAuthTokens",
    accessToken: options.accessToken,
    chatgptAccountId: options.chatgptAccountId,
    ...(options.chatgptPlanType !== undefined ? { chatgptPlanType: options.chatgptPlanType } : {}),
  });
}

export function buildCancelAccountLoginRequestParameters(
  options: CancelAccountLoginOptions,
): CancelAccountLoginRequestParameters {
  return AppServerAccountLoginCancelRequestSchema.parse({
    loginId: options.loginId,
  });
}

export function buildLogoutAccountRequestParameters(): LogoutAccountRequestParameters {
  return AppServerAccountLogoutRequestSchema.parse({});
}

export function buildReloadMcpServerConfigRequestParameters(): ReloadMcpServerConfigRequestParameters {
  return AppServerConfigMcpServerReloadRequestSchema.parse({});
}

export function buildStartMcpServerOauthLoginRequestParameters(
  options: StartMcpServerOauthLoginOptions,
): StartMcpServerOauthLoginRequestParameters {
  return AppServerMcpServerOauthLoginRequestSchema.parse({
    name: options.name,
    ...(options.scopes !== undefined ? { scopes: options.scopes } : {}),
    ...(options.timeoutSeconds !== undefined ? { timeoutSecs: options.timeoutSeconds } : {}),
  });
}

export function buildWriteSkillsConfigRequestParameters(
  options: WriteSkillsConfigOptions,
): WriteSkillsConfigRequestParameters {
  return AppServerSkillsConfigWriteRequestSchema.parse({
    path: options.path,
    enabled: options.enabled,
  });
}

export function buildListExperimentalFeaturesRequestParameters(
  options?: ListExperimentalFeaturesOptions,
): ListExperimentalFeaturesRequestParameters {
  return AppServerExperimentalFeatureListRequestSchema.parse({
    ...(options?.cursor !== undefined ? { cursor: options.cursor } : {}),
    ...(options?.limit !== undefined ? { limit: options.limit } : {}),
  });
}

export function buildListMcpServerStatusesRequestParameters(
  options?: ListMcpServerStatusesOptions,
): ListMcpServerStatusesRequestParameters {
  return AppServerMcpServerStatusListRequestSchema.parse({
    ...(options?.cursor !== undefined ? { cursor: options.cursor } : {}),
    ...(options?.limit !== undefined ? { limit: options.limit } : {}),
  });
}

export function buildListAppsRequestParameters(
  options?: ListAppsOptions,
): ListAppsRequestParameters {
  return AppServerAppListRequestSchema.parse({
    ...(options?.cursor !== undefined ? { cursor: options.cursor } : {}),
    ...(options?.limit !== undefined ? { limit: options.limit } : {}),
    ...(options?.threadId !== undefined ? { threadId: options.threadId } : {}),
    ...(options?.forceRefetch !== undefined ? { forceRefetch: options.forceRefetch } : {}),
  });
}

export function buildListSkillsRequestParameters(
  options?: ListSkillsOptions,
): ListSkillsRequestParameters {
  return AppServerSkillsListRequestSchema.parse({
    ...(options?.cwds !== undefined ? { cwds: options.cwds } : {}),
    ...(options?.forceReload !== undefined ? { forceReload: options.forceReload } : {}),
    ...(options?.perCwdExtraUserRoots !== undefined
      ? { perCwdExtraUserRoots: options.perCwdExtraUserRoots }
      : {}),
  });
}

export function buildListThreadsRequestParameters(
  options: ListThreadsOptions,
): ListThreadsRequestParameters {
  return {
    limit: options.limit,
    archived: options.archived,
    cursor: options.cursor ?? null,
    ...(options.sortKey !== undefined ? { sortKey: options.sortKey } : {}),
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
  };
}

export function buildListThreadsAllPageOptions(
  options: ListThreadsAllOptions,
  cursor: string | undefined,
): ListThreadsOptions {
  return {
    limit: options.limit,
    archived: options.archived,
    ...(cursor !== undefined ? { cursor } : {}),
    ...(options.sortKey !== undefined ? { sortKey: options.sortKey } : {}),
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
  };
}

export function buildReadThreadRequestParameters(
  threadId: string,
  includeTurns: boolean,
): { threadId: string; includeTurns: boolean } {
  return {
    threadId,
    includeTurns,
  };
}

export function resolveReadThreadRequestTimeoutMilliseconds(
  includeTurns: boolean,
): number | undefined {
  return includeTurns ? APP_SERVER_CLIENT_READ_THREAD_WITH_TURNS_TIMEOUT_MILLISECONDS : undefined;
}

export function buildReadConfigRequestParameters(options?: ReadConfigOptions): {
  includeLayers: boolean;
} {
  return {
    includeLayers: options?.includeLayers ?? APP_SERVER_CLIENT_DEFAULT_READ_CONFIG_INCLUDE_LAYERS,
  };
}

export function buildStartThreadRequest(
  options: StartThreadOptions,
): z.infer<typeof AppServerStartThreadRequestSchema> {
  return AppServerStartThreadRequestSchema.parse(options);
}

export function buildStartTurnRequest(
  options: StartTurnOptions,
): z.infer<typeof AppServerTurnStartRequestSchema> {
  const turnStartParameters = buildTurnStartMessageParameters({
    threadId: options.threadId,
    text: options.text,
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    ...(options.turnStartTemplate !== undefined
      ? { turnStartTemplate: options.turnStartTemplate }
      : {}),
    ...(options.model !== undefined ? { model: options.model } : {}),
    ...(options.effort !== undefined ? { effort: options.effort } : {}),
    ...(options.collaborationMode !== undefined
      ? { collaborationMode: options.collaborationMode }
      : {}),
  });
  return AppServerTurnStartRequestSchema.parse(turnStartParameters);
}

export function buildResumeThreadRequest(
  threadId: string,
  options?: ResumeThreadOptions,
): z.infer<typeof AppServerResumeThreadRequestSchema> {
  return AppServerResumeThreadRequestSchema.parse({
    threadId,
    persistExtendedHistory:
      options?.persistExtendedHistory ??
      APP_SERVER_CLIENT_DEFAULT_RESUME_THREAD_PERSIST_EXTENDED_HISTORY,
  });
}

export function buildUnsubscribeThreadRequest(
  threadId: string,
): z.infer<typeof AppServerThreadUnsubscribeRequestSchema> {
  return AppServerThreadUnsubscribeRequestSchema.parse({
    threadId,
  });
}

export function buildArchiveThreadRequest(
  threadId: string,
): z.infer<typeof AppServerArchiveThreadRequestSchema> {
  return AppServerArchiveThreadRequestSchema.parse({
    threadId,
  });
}

export function buildForkThreadRequest(
  threadId: string,
  options?: ForkThreadOptions,
): z.infer<typeof AppServerForkThreadRequestSchema> {
  return AppServerForkThreadRequestSchema.parse({
    threadId,
    persistExtendedHistory:
      options?.persistExtendedHistory ??
      APP_SERVER_CLIENT_DEFAULT_FORK_THREAD_PERSIST_EXTENDED_HISTORY,
  });
}

export function buildSetThreadNameRequest(
  threadId: string,
  name: string,
): z.infer<typeof AppServerSetThreadNameRequestSchema> {
  return AppServerSetThreadNameRequestSchema.parse({
    threadId,
    name,
  });
}

export function buildRollbackThreadRequest(
  threadId: string,
  numTurns: number,
): z.infer<typeof AppServerRollbackThreadRequestSchema> {
  return AppServerRollbackThreadRequestSchema.parse({
    threadId,
    numTurns,
  });
}

export function buildUnarchiveThreadRequest(
  threadId: string,
): z.infer<typeof AppServerUnarchiveThreadRequestSchema> {
  return AppServerUnarchiveThreadRequestSchema.parse({
    threadId,
  });
}

export function buildThreadCompactStartRequest(
  threadId: string,
): z.infer<typeof AppServerThreadCompactStartRequestSchema> {
  return AppServerThreadCompactStartRequestSchema.parse({
    threadId,
  });
}

export function buildThreadBackgroundTerminalsCleanRequest(
  threadId: string,
): z.infer<typeof AppServerThreadBackgroundTerminalsCleanRequestSchema> {
  return AppServerThreadBackgroundTerminalsCleanRequestSchema.parse({
    threadId,
  });
}

export function buildTurnInterruptRequest(
  threadId: string,
  turnId: string,
): z.infer<typeof AppServerTurnInterruptRequestSchema> {
  return AppServerTurnInterruptRequestSchema.parse({
    threadId,
    turnId,
  });
}

export function buildSteerTurnRequest(
  threadId: string,
  expectedTurnId: string,
  text: string,
): z.infer<typeof AppServerTurnSteerRequestSchema> {
  return AppServerTurnSteerRequestSchema.parse({
    threadId,
    expectedTurnId,
    input: [
      {
        type: "text",
        text,
      },
    ],
  });
}

export function buildStartReviewRequest(
  options: StartReviewOptions,
): z.infer<typeof AppServerReviewStartRequestSchema> {
  return AppServerReviewStartRequestSchema.parse({
    threadId: options.threadId,
    target: options.target,
    ...(options.delivery !== undefined ? { delivery: options.delivery } : {}),
  });
}
