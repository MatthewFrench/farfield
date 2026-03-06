import { JsonValueSchema } from "@farfield/protocol";
import { z } from "zod";
import { buildReadAuthStatusRequestParameters } from "./AppServerClientAuthStatusRequestBuilders.js";
import { APP_SERVER_CLIENT_METHODS } from "./AppServerClientMethodConstants.js";
import {
  buildCancelAccountLoginRequestParameters,
  buildLogoutAccountRequestParameters,
  buildReadAccountRateLimitsRequestParameters,
  buildReadAccountRequestParameters,
  buildStartAccountLoginRequestParameters,
} from "./AppServerClientRequestBuilders.js";
import {
  APP_SERVER_CLIENT_RESPONSE_CONTEXTS,
  parseAppServerResponse,
} from "./AppServerClientResponseParser.js";
import type { AppServerTransport } from "./AppServerTransport.js";

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
const AppServerGetAuthStatusAuthMethodSchema = z.enum(["apikey", "chatgpt", "chatgptAuthTokens"]);
const AppServerGetAuthStatusResponseSchema = z
  .object({
    authMethod: AppServerGetAuthStatusAuthMethodSchema.nullable().optional(),
    authToken: z.string().nullable().optional(),
    requiresOpenaiAuth: z.boolean().nullable().optional(),
  })
  .passthrough();
const AppServerUserInfoResponseSchema = z
  .object({
    allegedUserEmail: z.string().nullable().optional(),
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
 * Owns typed account/auth RPC reads and login lifecycle operations for app-server.
 */
export class AppServerCapabilityAccountClient {
  private readonly transport: AppServerTransport;

  public constructor(transport: AppServerTransport) {
    this.transport = transport;
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

  public async readAuthStatus(options?: ReadAuthStatusOptions): Promise<ReadAuthStatusResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.readAuthStatus,
      buildReadAuthStatusRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerGetAuthStatusResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.readAuthStatus,
    );
    return {
      authMethod: parsed.authMethod ?? null,
      authToken: parsed.authToken ?? null,
      requiresOpenaiAuth: parsed.requiresOpenaiAuth ?? null,
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

  public async readUserInfo(): Promise<ReadUserInfoResult> {
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.readUserInfo, {});
    const parsed = parseAppServerResponse(
      AppServerUserInfoResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.readUserInfo,
    );
    return {
      allegedUserEmail: parsed.allegedUserEmail ?? null,
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
}
