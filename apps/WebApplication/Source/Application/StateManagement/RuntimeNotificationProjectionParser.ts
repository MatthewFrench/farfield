import { z } from "zod";
import { type CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import {
  type ThreadRuntimeActiveFlag,
  type ThreadRuntimeStatusType,
} from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";

const THREAD_STATUS_CHANGED_NOTIFICATION_METHOD = "thread/status/changed";
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

export interface RuntimeThreadStatusUpdate {
  sequence: number;
  threadId: string;
  statusType: ThreadRuntimeStatusType;
  activeFlags: ThreadRuntimeActiveFlag[];
  receivedAtMilliseconds: number;
}

export interface RuntimeNotificationProjectionResult {
  processedEventCount: number;
  relevantEventCount: number;
  resetRequired: boolean;
  nextSequence: number;
  threadStatusUpdates: RuntimeThreadStatusUpdate[];
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

/**
 * Parses runtime notification snapshots into typed projection updates for product-owned UI state.
 * Parse errors for known methods are intentionally fatal to keep schema drift visible immediately.
 */
export function readRuntimeNotificationProjection(
  response: CapabilityNotificationEventsResponse,
): RuntimeNotificationProjectionResult {
  const threadStatusUpdates: RuntimeThreadStatusUpdate[] = [];
  let shouldRefreshAccountRateLimits = false;
  let shouldRefreshApps = false;
  let relevantEventCount = 0;

  for (const event of response.events) {
    if (event.method === THREAD_STATUS_CHANGED_NOTIFICATION_METHOD) {
      threadStatusUpdates.push(mapThreadStatusChangedEvent(event));
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
    shouldRefreshAccountRateLimits,
    shouldRefreshApps,
  };
}
