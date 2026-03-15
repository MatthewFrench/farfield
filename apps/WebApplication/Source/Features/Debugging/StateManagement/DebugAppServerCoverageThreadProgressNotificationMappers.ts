import { type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import type { CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageThreadProgressNotificationMethod,
  DebugAppServerCoverageThreadProgressNotificationMethodCount,
  DebugAppServerCoverageThreadProgressNotificationSummary,
  DebugAppServerCoverageThreadProgressNotificationsResult,
} from "../DomainModel/DebugAppServerCoverageThreadProgressContracts";

const THREAD_STARTED_NOTIFICATION_METHOD = "thread/started";
const THREAD_COMPACTED_NOTIFICATION_METHOD = "thread/compacted";
const THREAD_TOKEN_USAGE_UPDATED_NOTIFICATION_METHOD = "thread/tokenUsage/updated";

const ThreadStartedThreadSchema = z
  .object({
    id: z.string().min(1),
    preview: z.string(),
    modelProvider: z.string().min(1),
  })
  .passthrough();

const ThreadStartedParametersSchema = z
  .object({
    thread: ThreadStartedThreadSchema,
  })
  .strict();

const ThreadCompactedParametersSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
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

const ThreadTokenUsageUpdatedParametersSchema = z
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

function mapMethodCounts(
  events: DebugAppServerCoverageThreadProgressNotificationSummary[],
): DebugAppServerCoverageThreadProgressNotificationMethodCount[] {
  const countByMethod = new Map<DebugAppServerCoverageThreadProgressNotificationMethod, number>();
  for (const event of events) {
    const currentCount = countByMethod.get(event.method) ?? 0;
    countByMethod.set(event.method, currentCount + 1);
  }

  return [...countByMethod.entries()]
    .map(([method, count]) => ({ method, count }))
    .sort((left, right) => left.method.localeCompare(right.method));
}

function mapThreadStartedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageThreadProgressNotificationSummary {
  const parsedParameters = ThreadStartedParametersSchema.parse(params);
  return {
    method: THREAD_STARTED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.thread.id,
    turnId: null,
    modelProvider: parsedParameters.thread.modelProvider,
    preview: parsedParameters.thread.preview,
    totalTokens: null,
    lastTotalTokens: null,
    modelContextWindow: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapThreadCompactedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageThreadProgressNotificationSummary {
  const parsedParameters = ThreadCompactedParametersSchema.parse(params);
  return {
    method: THREAD_COMPACTED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    turnId: parsedParameters.turnId,
    modelProvider: null,
    preview: null,
    totalTokens: null,
    lastTotalTokens: null,
    modelContextWindow: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapThreadTokenUsageUpdatedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageThreadProgressNotificationSummary {
  const parsedParameters = ThreadTokenUsageUpdatedParametersSchema.parse(params);
  return {
    method: THREAD_TOKEN_USAGE_UPDATED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    turnId: parsedParameters.turnId,
    modelProvider: null,
    preview: null,
    totalTokens: parsedParameters.tokenUsage.total.totalTokens,
    lastTotalTokens: parsedParameters.tokenUsage.last.totalTokens,
    modelContextWindow: parsedParameters.tokenUsage.modelContextWindow,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

export function mapThreadProgressNotificationsResult(
  response: CapabilityNotificationEventsResponse,
  sinceSequence: number | null,
): DebugAppServerCoverageThreadProgressNotificationsResult {
  const events: DebugAppServerCoverageThreadProgressNotificationSummary[] = [];
  for (const event of response.events) {
    if (event.method === THREAD_STARTED_NOTIFICATION_METHOD) {
      events.push(mapThreadStartedEvent(event, event.params));
      continue;
    }

    if (event.method === THREAD_COMPACTED_NOTIFICATION_METHOD) {
      events.push(mapThreadCompactedEvent(event, event.params));
      continue;
    }

    if (event.method === THREAD_TOKEN_USAGE_UPDATED_NOTIFICATION_METHOD) {
      events.push(mapThreadTokenUsageUpdatedEvent(event, event.params));
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
