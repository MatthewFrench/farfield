import { type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import type { CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageThreadLifecycleNotificationMethod,
  DebugAppServerCoverageThreadLifecycleNotificationMethodCount,
  DebugAppServerCoverageThreadLifecycleNotificationSummary,
  DebugAppServerCoverageThreadLifecycleNotificationsResult,
} from "../DomainModel/DebugAppServerCoverageContracts";

const THREAD_ARCHIVED_NOTIFICATION_METHOD = "thread/archived";
const THREAD_UNARCHIVED_NOTIFICATION_METHOD = "thread/unarchived";
const THREAD_NAME_UPDATED_NOTIFICATION_METHOD = "thread/name/updated";

const ThreadArchivedParametersSchema = z
  .object({
    threadId: z.string().min(1),
  })
  .strict();

const ThreadUnarchivedParametersSchema = z
  .object({
    threadId: z.string().min(1),
  })
  .strict();

const ThreadNameUpdatedParametersSchema = z
  .object({
    threadId: z.string().min(1),
    threadName: z.string().min(1).optional(),
  })
  .strict();

function mapMethodCounts(
  events: DebugAppServerCoverageThreadLifecycleNotificationSummary[],
): DebugAppServerCoverageThreadLifecycleNotificationMethodCount[] {
  const countByMethod = new Map<DebugAppServerCoverageThreadLifecycleNotificationMethod, number>();
  for (const event of events) {
    const currentCount = countByMethod.get(event.method) ?? 0;
    countByMethod.set(event.method, currentCount + 1);
  }

  return [...countByMethod.entries()]
    .map(([method, count]) => ({ method, count }))
    .sort((left, right) => left.method.localeCompare(right.method));
}

function mapThreadArchivedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageThreadLifecycleNotificationSummary {
  const parsedParameters = ThreadArchivedParametersSchema.parse(params);
  return {
    method: THREAD_ARCHIVED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    threadName: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapThreadUnarchivedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageThreadLifecycleNotificationSummary {
  const parsedParameters = ThreadUnarchivedParametersSchema.parse(params);
  return {
    method: THREAD_UNARCHIVED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    threadName: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapThreadNameUpdatedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageThreadLifecycleNotificationSummary {
  const parsedParameters = ThreadNameUpdatedParametersSchema.parse(params);
  return {
    method: THREAD_NAME_UPDATED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    threadName: parsedParameters.threadName ?? null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

export function mapThreadLifecycleNotificationsResult(
  response: CapabilityNotificationEventsResponse,
  sinceSequence: number | null,
): DebugAppServerCoverageThreadLifecycleNotificationsResult {
  const events: DebugAppServerCoverageThreadLifecycleNotificationSummary[] = [];
  for (const event of response.events) {
    if (event.method === THREAD_ARCHIVED_NOTIFICATION_METHOD) {
      events.push(mapThreadArchivedEvent(event, event.params));
      continue;
    }

    if (event.method === THREAD_UNARCHIVED_NOTIFICATION_METHOD) {
      events.push(mapThreadUnarchivedEvent(event, event.params));
      continue;
    }

    if (event.method === THREAD_NAME_UPDATED_NOTIFICATION_METHOD) {
      events.push(mapThreadNameUpdatedEvent(event, event.params));
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
