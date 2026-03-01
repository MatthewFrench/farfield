import { z } from "zod";
import { type CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import {
  type ThreadRuntimeActiveFlag,
  type ThreadRuntimeModelRerouteReason,
  type ThreadRuntimeProgressMethod,
  type ThreadRuntimeStatusType,
} from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";

const THREAD_STATUS_CHANGED_NOTIFICATION_METHOD = "thread/status/changed";
const THREAD_STARTED_NOTIFICATION_METHOD = "thread/started";
const THREAD_COMPACTED_NOTIFICATION_METHOD = "thread/compacted";
const THREAD_TOKEN_USAGE_UPDATED_NOTIFICATION_METHOD = "thread/tokenUsage/updated";
const MODEL_REROUTED_NOTIFICATION_METHOD = "model/rerouted";
const ACCOUNT_UPDATED_NOTIFICATION_METHOD = "account/updated";
const ACCOUNT_RATE_LIMITS_UPDATED_NOTIFICATION_METHOD = "account/rateLimits/updated";
const APP_LIST_UPDATED_NOTIFICATION_METHOD = "app/list/updated";
const THREAD_STATUS_TYPE_ACTIVE = "active";
const THREAD_STATUS_TYPE_IDLE = "idle";
const THREAD_STATUS_TYPE_NOT_LOADED = "notLoaded";
const THREAD_STATUS_TYPE_SYSTEM_ERROR = "systemError";
const THREAD_STATUS_ACTIVE_FLAG_WAITING_ON_APPROVAL = "waitingOnApproval";
const THREAD_STATUS_ACTIVE_FLAG_WAITING_ON_USER_INPUT = "waitingOnUserInput";

const ThreadStatusChangedNotificationParametersSchema = z
  .object({
    threadId: z.string().min(1),
    status: z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal(THREAD_STATUS_TYPE_NOT_LOADED),
        })
        .strict(),
      z
        .object({
          type: z.literal(THREAD_STATUS_TYPE_IDLE),
        })
        .strict(),
      z
        .object({
          type: z.literal(THREAD_STATUS_TYPE_SYSTEM_ERROR),
        })
        .strict(),
      z
        .object({
          type: z.literal(THREAD_STATUS_TYPE_ACTIVE),
          activeFlags: z
            .array(
              z.union([
                z.literal(THREAD_STATUS_ACTIVE_FLAG_WAITING_ON_APPROVAL),
                z.literal(THREAD_STATUS_ACTIVE_FLAG_WAITING_ON_USER_INPUT),
              ]),
            )
            .readonly(),
        })
        .strict(),
    ]),
  })
  .strict();

const TokenUsageBreakdownSchema = z
  .object({
    totalTokens: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    cachedInputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    reasoningOutputTokens: z.number().int().nonnegative(),
  })
  .strict();

const ThreadTokenUsageUpdatedNotificationParametersSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    tokenUsage: z
      .object({
        total: TokenUsageBreakdownSchema,
        last: TokenUsageBreakdownSchema,
        modelContextWindow: z.number().int().nonnegative().nullable(),
      })
      .strict(),
  })
  .strict();

const ThreadStartedParametersSchema = z
  .object({
    thread: z
      .object({
        id: z.string().min(1),
        preview: z.string(),
        modelProvider: z.string().min(1),
      })
      .passthrough(),
  })
  .strict();

const ThreadCompactedParametersSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
  })
  .strict();

const ModelReroutedNotificationParametersSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    fromModel: z.string().min(1),
    toModel: z.string().min(1),
    reason: z.literal("highRiskCyberActivity"),
  })
  .strict();

export interface RuntimeThreadStatusUpdate {
  sequence: number;
  threadId: string;
  statusType: ThreadRuntimeStatusType;
  activeFlags: ThreadRuntimeActiveFlag[];
  receivedAtMilliseconds: number;
}

export interface RuntimeThreadTokenUsageUpdate {
  sequence: number;
  threadId: string;
  turnId: string;
  totalTokens: number;
  lastTotalTokens: number;
  modelContextWindow: number | null;
  receivedAtMilliseconds: number;
}

export interface RuntimeThreadProgressEvent {
  method: ThreadRuntimeProgressMethod;
  sequence: number;
  threadId: string;
  turnId: string | null;
  preview: string | null;
  modelProvider: string | null;
  receivedAtMilliseconds: number;
}

export interface RuntimeModelRerouteEvent {
  sequence: number;
  threadId: string;
  turnId: string;
  fromModel: string;
  toModel: string;
  reason: ThreadRuntimeModelRerouteReason;
  receivedAtMilliseconds: number;
}

export interface RuntimeNotificationProjectionResult {
  processedEventCount: number;
  relevantEventCount: number;
  resetRequired: boolean;
  nextSequence: number;
  threadStatusUpdates: RuntimeThreadStatusUpdate[];
  threadProgressEvents: RuntimeThreadProgressEvent[];
  threadTokenUsageUpdates: RuntimeThreadTokenUsageUpdate[];
  modelRerouteEvents: RuntimeModelRerouteEvent[];
  shouldRefreshAccount: boolean;
  shouldRefreshAccountRateLimits: boolean;
  shouldRefreshApps: boolean;
}

function mapThreadStatusChangedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeThreadStatusUpdate {
  const parsedParameters = ThreadStatusChangedNotificationParametersSchema.parse(event.params);
  const statusType: ThreadRuntimeStatusType = parsedParameters.status.type;
  const activeFlags: ThreadRuntimeActiveFlag[] =
    parsedParameters.status.type === THREAD_STATUS_TYPE_ACTIVE
      ? [...parsedParameters.status.activeFlags]
      : [];

  return {
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    statusType,
    activeFlags,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapThreadTokenUsageUpdatedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeThreadTokenUsageUpdate {
  const parsedParameters = ThreadTokenUsageUpdatedNotificationParametersSchema.parse(event.params);
  return {
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    turnId: parsedParameters.turnId,
    totalTokens: parsedParameters.tokenUsage.total.totalTokens,
    lastTotalTokens: parsedParameters.tokenUsage.last.totalTokens,
    modelContextWindow: parsedParameters.tokenUsage.modelContextWindow,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapThreadStartedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeThreadProgressEvent {
  const parsedParameters = ThreadStartedParametersSchema.parse(event.params);
  return {
    method: THREAD_STARTED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.thread.id,
    turnId: null,
    preview: parsedParameters.thread.preview,
    modelProvider: parsedParameters.thread.modelProvider,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapThreadCompactedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeThreadProgressEvent {
  const parsedParameters = ThreadCompactedParametersSchema.parse(event.params);
  return {
    method: THREAD_COMPACTED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    turnId: parsedParameters.turnId,
    preview: null,
    modelProvider: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapModelReroutedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
): RuntimeModelRerouteEvent {
  const parsedParameters = ModelReroutedNotificationParametersSchema.parse(event.params);
  return {
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    turnId: parsedParameters.turnId,
    fromModel: parsedParameters.fromModel,
    toModel: parsedParameters.toModel,
    reason: parsedParameters.reason,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

/**
 * Parses runtime notification snapshots into typed projection updates for product-owned UI state.
 * Parse errors for known methods are intentionally fatal to keep schema drift visible immediately.
 */
export function readRuntimeNotificationProjection(
  response: CapabilityNotificationEventsResponse,
): RuntimeNotificationProjectionResult {
  const threadStatusUpdates: RuntimeThreadStatusUpdate[] = [];
  const threadProgressEvents: RuntimeThreadProgressEvent[] = [];
  const threadTokenUsageUpdates: RuntimeThreadTokenUsageUpdate[] = [];
  const modelRerouteEvents: RuntimeModelRerouteEvent[] = [];
  let shouldRefreshAccount = false;
  let shouldRefreshAccountRateLimits = false;
  let shouldRefreshApps = false;
  let relevantEventCount = 0;

  for (const event of response.events) {
    if (event.method === THREAD_STATUS_CHANGED_NOTIFICATION_METHOD) {
      threadStatusUpdates.push(mapThreadStatusChangedEvent(event));
      relevantEventCount += 1;
      continue;
    }

    if (event.method === THREAD_TOKEN_USAGE_UPDATED_NOTIFICATION_METHOD) {
      threadTokenUsageUpdates.push(mapThreadTokenUsageUpdatedEvent(event));
      relevantEventCount += 1;
      continue;
    }

    if (event.method === THREAD_STARTED_NOTIFICATION_METHOD) {
      threadProgressEvents.push(mapThreadStartedEvent(event));
      relevantEventCount += 1;
      continue;
    }

    if (event.method === THREAD_COMPACTED_NOTIFICATION_METHOD) {
      threadProgressEvents.push(mapThreadCompactedEvent(event));
      relevantEventCount += 1;
      continue;
    }

    if (event.method === MODEL_REROUTED_NOTIFICATION_METHOD) {
      modelRerouteEvents.push(mapModelReroutedEvent(event));
      relevantEventCount += 1;
      continue;
    }

    if (event.method === ACCOUNT_UPDATED_NOTIFICATION_METHOD) {
      shouldRefreshAccount = true;
      relevantEventCount += 1;
      continue;
    }

    if (event.method === ACCOUNT_RATE_LIMITS_UPDATED_NOTIFICATION_METHOD) {
      shouldRefreshAccountRateLimits = true;
      relevantEventCount += 1;
      continue;
    }

    if (event.method === APP_LIST_UPDATED_NOTIFICATION_METHOD) {
      shouldRefreshApps = true;
      relevantEventCount += 1;
    }
  }

  return {
    processedEventCount: response.events.length,
    relevantEventCount,
    resetRequired: response.resetRequired,
    nextSequence: response.nextSequence,
    threadStatusUpdates,
    threadProgressEvents,
    threadTokenUsageUpdates,
    modelRerouteEvents,
    shouldRefreshAccount,
    shouldRefreshAccountRateLimits,
    shouldRefreshApps,
  };
}
