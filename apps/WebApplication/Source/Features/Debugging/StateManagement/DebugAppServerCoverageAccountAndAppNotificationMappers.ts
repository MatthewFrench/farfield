import { type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import type { CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageAccountAndAppNotificationMethod,
  DebugAppServerCoverageAccountAndAppNotificationMethodCount,
  DebugAppServerCoverageAccountAndAppNotificationSummary,
  DebugAppServerCoverageAccountAndAppNotificationsResult,
} from "../DomainModel/DebugAppServerCoverageAccountAndAppNotificationContracts";

const ACCOUNT_RATE_LIMITS_UPDATED_NOTIFICATION_METHOD = "account/rateLimits/updated";
const ACCOUNT_UPDATED_NOTIFICATION_METHOD = "account/updated";
const APP_LIST_UPDATED_NOTIFICATION_METHOD = "app/list/updated";
const WINDOWS_SANDBOX_SETUP_COMPLETED_NOTIFICATION_METHOD = "windowsSandbox/setupCompleted";

const AuthModeSchema = z.union([
  z.literal("apikey"),
  z.literal("chatgpt"),
  z.literal("chatgptAuthTokens"),
]);

const PlanTypeSchema = z.union([
  z.literal("free"),
  z.literal("go"),
  z.literal("plus"),
  z.literal("pro"),
  z.literal("team"),
  z.literal("business"),
  z.literal("enterprise"),
  z.literal("edu"),
  z.literal("unknown"),
]);

const RateLimitWindowSchema = z
  .object({
    usedPercent: z.number(),
    windowDurationMins: z.number().nullable(),
    resetsAt: z.number().nullable(),
  })
  .strict();

const CreditsSnapshotSchema = z
  .object({
    hasCredits: z.boolean(),
    unlimited: z.boolean(),
    balance: z.string().nullable(),
  })
  .strict();

const RateLimitSnapshotSchema = z
  .object({
    limitId: z.string().nullable(),
    limitName: z.string().nullable(),
    primary: RateLimitWindowSchema.nullable(),
    secondary: RateLimitWindowSchema.nullable(),
    credits: CreditsSnapshotSchema.nullable(),
    planType: PlanTypeSchema.nullable(),
  })
  .strict();

const AppReviewSchema = z
  .object({
    status: z.string(),
  })
  .strict();

const AppScreenshotSchema = z
  .object({
    url: z.string().nullable(),
    fileId: z.string().nullable(),
    userPrompt: z.string(),
  })
  .strict();

const AppMetadataSchema = z
  .object({
    review: AppReviewSchema.nullable(),
    categories: z.array(z.string()).nullable(),
    subCategories: z.array(z.string()).nullable(),
    seoDescription: z.string().nullable(),
    screenshots: z.array(AppScreenshotSchema).nullable(),
    developer: z.string().nullable(),
    version: z.string().nullable(),
    versionId: z.string().nullable(),
    versionNotes: z.string().nullable(),
    firstPartyType: z.string().nullable(),
    firstPartyRequiresInstall: z.boolean().nullable(),
    showInComposerWhenUnlinked: z.boolean().nullable(),
  })
  .strict();

const AppBrandingSchema = z
  .object({
    category: z.string().nullable(),
    developer: z.string().nullable(),
    website: z.string().nullable(),
    privacyPolicy: z.string().nullable(),
    termsOfService: z.string().nullable(),
    isDiscoverableApp: z.boolean(),
  })
  .strict();

const AppInfoSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable(),
    logoUrl: z.string().nullable(),
    logoUrlDark: z.string().nullable(),
    distributionChannel: z.string().nullable(),
    branding: AppBrandingSchema.nullable(),
    appMetadata: AppMetadataSchema.nullable(),
    labels: z.record(z.string()).nullable(),
    installUrl: z.string().nullable(),
    isAccessible: z.boolean(),
    isEnabled: z.boolean(),
  })
  .strict();

const AccountUpdatedParametersSchema = z
  .object({
    authMode: AuthModeSchema.nullable(),
  })
  .strict();

const AccountRateLimitsUpdatedParametersSchema = z
  .object({
    rateLimits: RateLimitSnapshotSchema,
  })
  .strict();

const AppListUpdatedParametersSchema = z
  .object({
    data: z.array(AppInfoSchema),
  })
  .strict();

const WindowsSandboxSetupCompletedParametersSchema = z
  .object({
    mode: z.union([z.literal("elevated"), z.literal("unelevated")]),
    success: z.boolean(),
    error: z.string().nullable(),
  })
  .strict();

function mapMethodCounts(
  events: DebugAppServerCoverageAccountAndAppNotificationSummary[],
): DebugAppServerCoverageAccountAndAppNotificationMethodCount[] {
  const countByMethod = new Map<DebugAppServerCoverageAccountAndAppNotificationMethod, number>();
  for (const event of events) {
    const currentCount = countByMethod.get(event.method) ?? 0;
    countByMethod.set(event.method, currentCount + 1);
  }

  return [...countByMethod.entries()]
    .map(([method, count]) => ({ method, count }))
    .sort((left, right) => left.method.localeCompare(right.method));
}

function mapAccountUpdatedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageAccountAndAppNotificationSummary {
  const parsedParameters = AccountUpdatedParametersSchema.parse(params);
  return {
    method: ACCOUNT_UPDATED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    authMode: parsedParameters.authMode,
    rateLimitName: null,
    rateLimitPlanType: null,
    appCount: null,
    windowsSandboxMode: null,
    windowsSandboxSuccess: null,
    windowsSandboxError: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapAccountRateLimitsUpdatedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageAccountAndAppNotificationSummary {
  const parsedParameters = AccountRateLimitsUpdatedParametersSchema.parse(params);
  return {
    method: ACCOUNT_RATE_LIMITS_UPDATED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    authMode: null,
    rateLimitName: parsedParameters.rateLimits.limitName,
    rateLimitPlanType: parsedParameters.rateLimits.planType,
    appCount: null,
    windowsSandboxMode: null,
    windowsSandboxSuccess: null,
    windowsSandboxError: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapAppListUpdatedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageAccountAndAppNotificationSummary {
  const parsedParameters = AppListUpdatedParametersSchema.parse(params);
  return {
    method: APP_LIST_UPDATED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    authMode: null,
    rateLimitName: null,
    rateLimitPlanType: null,
    appCount: parsedParameters.data.length,
    windowsSandboxMode: null,
    windowsSandboxSuccess: null,
    windowsSandboxError: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapWindowsSandboxSetupCompletedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageAccountAndAppNotificationSummary {
  const parsedParameters = WindowsSandboxSetupCompletedParametersSchema.parse(params);
  return {
    method: WINDOWS_SANDBOX_SETUP_COMPLETED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    authMode: null,
    rateLimitName: null,
    rateLimitPlanType: null,
    appCount: null,
    windowsSandboxMode: parsedParameters.mode,
    windowsSandboxSuccess: parsedParameters.success,
    windowsSandboxError: parsedParameters.error,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

export function mapAccountAndAppNotificationsResult(
  response: CapabilityNotificationEventsResponse,
  sinceSequence: number | null,
): DebugAppServerCoverageAccountAndAppNotificationsResult {
  const events: DebugAppServerCoverageAccountAndAppNotificationSummary[] = [];
  for (const event of response.events) {
    if (event.method === ACCOUNT_UPDATED_NOTIFICATION_METHOD) {
      events.push(mapAccountUpdatedEvent(event, event.params));
      continue;
    }

    if (event.method === ACCOUNT_RATE_LIMITS_UPDATED_NOTIFICATION_METHOD) {
      events.push(mapAccountRateLimitsUpdatedEvent(event, event.params));
      continue;
    }

    if (event.method === APP_LIST_UPDATED_NOTIFICATION_METHOD) {
      events.push(mapAppListUpdatedEvent(event, event.params));
      continue;
    }

    if (event.method === WINDOWS_SANDBOX_SETUP_COMPLETED_NOTIFICATION_METHOD) {
      events.push(mapWindowsSandboxSetupCompletedEvent(event, event.params));
    }
  }

  return {
    sinceSequence,
    eventCount: events.length,
    nextSequence: response.nextSequence,
    firstAvailableSequence: response.firstAvailableSequence,
    resetRequired: response.resetRequired,
    events,
    methodCounts: mapMethodCounts(events),
    readAtIso8601: new Date().toISOString(),
  };
}
