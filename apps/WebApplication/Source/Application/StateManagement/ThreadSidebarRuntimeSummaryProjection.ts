import {
  type CapabilityAccountRateLimitsResponse,
  type CapabilityAccountResponse,
  type CapabilityAppsResponse,
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import {
  type ThreadRuntimeModelRerouteSummary,
  type ThreadRuntimeProgressSummary,
  type ThreadRuntimeWarningSummary,
  type ThreadSidebarRuntimeSummary,
  type ThreadSidebarTokenUsageSummary,
} from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import {
  type RuntimeModelRerouteEvent,
  type RuntimeThreadProgressEvent,
  type RuntimeThreadTokenUsageUpdate,
  type RuntimeWarningEvent,
} from "./RuntimeNotificationProjectionParser";

/**
 * Owns projection from capability and notification payloads into sidebar runtime summary view models.
 * Keeps mapping logic centralized so event-stream orchestration stays focused on sequencing and refresh flow.
 */
export function createInitialThreadSidebarRuntimeSummary(): ThreadSidebarRuntimeSummary {
  return {
    account: null,
    rateLimits: null,
    apps: null,
    progress: null,
    warning: null,
    tokenUsage: null,
    modelReroute: null,
  };
}

export function readThreadSidebarAccountSummary(
  response: CapabilityAccountResponse,
): NonNullable<ThreadSidebarRuntimeSummary["account"]> {
  if (response.account === null) {
    return {
      mode: "signedOut",
      planType: null,
      email: null,
      requiresOpenaiAuth: response.requiresOpenaiAuth,
      refreshedAtMilliseconds: Date.now(),
    };
  }

  if (response.account.type === "apiKey") {
    return {
      mode: "apiKey",
      planType: null,
      email: null,
      requiresOpenaiAuth: response.requiresOpenaiAuth,
      refreshedAtMilliseconds: Date.now(),
    };
  }

  return {
    mode: "chatgpt",
    planType: response.account.planType,
    email: response.account.email,
    requiresOpenaiAuth: response.requiresOpenaiAuth,
    refreshedAtMilliseconds: Date.now(),
  };
}

export function readThreadSidebarRateLimitSummary(
  response: CapabilityAccountRateLimitsResponse,
): NonNullable<ThreadSidebarRuntimeSummary["rateLimits"]> {
  return {
    limitId: response.rateLimits?.limitId ?? null,
    planType: response.rateLimits?.planType ?? null,
    usedPercent: response.rateLimits?.primary?.usedPercent ?? null,
    refreshedAtMilliseconds: Date.now(),
  };
}

export function readThreadSidebarAppsSummary(
  response: CapabilityAppsResponse,
): NonNullable<ThreadSidebarRuntimeSummary["apps"]> {
  return {
    appCount: response.data.length,
    refreshedAtMilliseconds: Date.now(),
  };
}

export function readThreadSidebarTokenUsageSummary(
  update: RuntimeThreadTokenUsageUpdate,
): ThreadSidebarTokenUsageSummary {
  const usedPercent =
    update.modelContextWindow === null || update.modelContextWindow === 0
      ? null
      : Math.round((update.totalTokens / update.modelContextWindow) * 100);
  return {
    threadId: update.threadId,
    turnId: update.turnId,
    totalTokens: update.totalTokens,
    lastTotalTokens: update.lastTotalTokens,
    modelContextWindow: update.modelContextWindow,
    usedPercent,
    sequence: update.sequence,
    receivedAtMilliseconds: update.receivedAtMilliseconds,
    refreshedAtMilliseconds: Date.now(),
  };
}

export function readThreadRuntimeModelRerouteSummary(
  event: RuntimeModelRerouteEvent,
): ThreadRuntimeModelRerouteSummary {
  return {
    threadId: event.threadId,
    turnId: event.turnId,
    fromModel: event.fromModel,
    toModel: event.toModel,
    reason: event.reason,
    sequence: event.sequence,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
    refreshedAtMilliseconds: Date.now(),
  };
}

export function readThreadRuntimeProgressSummary(
  event: RuntimeThreadProgressEvent,
): ThreadRuntimeProgressSummary {
  return {
    method: event.method,
    threadId: event.threadId,
    turnId: event.turnId,
    preview: event.preview,
    modelProvider: event.modelProvider,
    sequence: event.sequence,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
    refreshedAtMilliseconds: Date.now(),
  };
}

export function readThreadRuntimeWarningSummary(
  event: RuntimeWarningEvent,
): ThreadRuntimeWarningSummary {
  return {
    method: event.method,
    summary: event.summary,
    sequence: event.sequence,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
    refreshedAtMilliseconds: Date.now(),
  };
}

export function readLatestThreadTokenUsageUpdateForThread(
  updates: readonly RuntimeThreadTokenUsageUpdate[],
  selectedThreadId: string | null,
): RuntimeThreadTokenUsageUpdate | null {
  if (selectedThreadId === null || selectedThreadId.length === 0) {
    return null;
  }
  const matchingUpdates = updates.filter((update) => update.threadId === selectedThreadId);
  return matchingUpdates.at(-1) ?? null;
}

export function readLatestModelRerouteEventForThread(
  events: readonly RuntimeModelRerouteEvent[],
  selectedThreadId: string | null,
): RuntimeModelRerouteEvent | null {
  if (selectedThreadId === null || selectedThreadId.length === 0) {
    return null;
  }
  const matchingEvents = events.filter((event) => event.threadId === selectedThreadId);
  return matchingEvents.at(-1) ?? null;
}

export function readLatestThreadProgressEventForThread(
  events: readonly RuntimeThreadProgressEvent[],
  selectedThreadId: string | null,
): RuntimeThreadProgressEvent | null {
  if (selectedThreadId === null || selectedThreadId.length === 0) {
    return null;
  }
  const matchingEvents = events.filter((event) => event.threadId === selectedThreadId);
  return matchingEvents.at(-1) ?? null;
}

export function readLatestWarningEvent(
  events: readonly RuntimeWarningEvent[],
): RuntimeWarningEvent | null {
  return events.at(-1) ?? null;
}
