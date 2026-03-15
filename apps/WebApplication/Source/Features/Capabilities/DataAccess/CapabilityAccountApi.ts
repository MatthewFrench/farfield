import { z } from "zod";
import {
  type AgentId,
  AgentIdSchema,
  type ApiRequestOptions,
} from "@/Shared/Contracts/ApiContracts";
import { request, requestInitWithOptions } from "@/Shared/Transport/FarfieldHttpTransport";

const ACCOUNT_ENDPOINT = "/api/account";
const ACCOUNT_RATE_LIMITS_ENDPOINT = "/api/account/rate-limits";
const ACCOUNT_LOGIN_START_ENDPOINT = "/api/account/login/start";
const ACCOUNT_LOGIN_CANCEL_ENDPOINT = "/api/account/login/cancel";
const ACCOUNT_LOGOUT_ENDPOINT = "/api/account/logout";

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

/**
 * Owns account capability endpoint contracts and login lifecycle requests.
 */
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
