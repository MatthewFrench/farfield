import { type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import type { CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageFuzzySessionNotificationMethod,
  DebugAppServerCoverageFuzzySessionNotificationMethodCount,
  DebugAppServerCoverageFuzzySessionNotificationSummary,
  DebugAppServerCoverageFuzzySessionNotificationsResult,
} from "../DomainModel/DebugAppServerCoverageContracts";

const FUZZY_SESSION_UPDATED_NOTIFICATION_METHOD = "fuzzyFileSearch/sessionUpdated";
const FUZZY_SESSION_COMPLETED_NOTIFICATION_METHOD = "fuzzyFileSearch/sessionCompleted";

const FuzzyFileSearchResultSchema = z
  .object({
    root: z.string().min(1),
    path: z.string().min(1),
    fileName: z.string().min(1),
    score: z.number(),
    indices: z.array(z.number().int().nonnegative()),
  })
  .strict();

const FuzzySessionUpdatedParametersSchema = z
  .object({
    sessionId: z.string().min(1),
    query: z.string(),
    files: z.array(FuzzyFileSearchResultSchema),
  })
  .strict();

const FuzzySessionCompletedParametersSchema = z
  .object({
    sessionId: z.string().min(1),
  })
  .strict();

function mapMethodCounts(
  events: DebugAppServerCoverageFuzzySessionNotificationSummary[],
): DebugAppServerCoverageFuzzySessionNotificationMethodCount[] {
  const countByMethod = new Map<DebugAppServerCoverageFuzzySessionNotificationMethod, number>();
  for (const event of events) {
    const currentCount = countByMethod.get(event.method) ?? 0;
    countByMethod.set(event.method, currentCount + 1);
  }

  return [...countByMethod.entries()]
    .map(([method, count]) => ({ method, count }))
    .sort((left, right) => left.method.localeCompare(right.method));
}

function mapFuzzySessionUpdatedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageFuzzySessionNotificationSummary {
  const parsedParameters = FuzzySessionUpdatedParametersSchema.parse(params);
  return {
    method: FUZZY_SESSION_UPDATED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    sessionId: parsedParameters.sessionId,
    query: parsedParameters.query,
    fileCount: parsedParameters.files.length,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapFuzzySessionCompletedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageFuzzySessionNotificationSummary {
  const parsedParameters = FuzzySessionCompletedParametersSchema.parse(params);
  return {
    method: FUZZY_SESSION_COMPLETED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    sessionId: parsedParameters.sessionId,
    query: null,
    fileCount: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

export function mapFuzzySessionNotificationsResult(
  response: CapabilityNotificationEventsResponse,
  sinceSequence: number | null,
): DebugAppServerCoverageFuzzySessionNotificationsResult {
  const events: DebugAppServerCoverageFuzzySessionNotificationSummary[] = [];

  for (const event of response.events) {
    if (event.method === FUZZY_SESSION_UPDATED_NOTIFICATION_METHOD) {
      events.push(mapFuzzySessionUpdatedEvent(event, event.params));
      continue;
    }

    if (event.method === FUZZY_SESSION_COMPLETED_NOTIFICATION_METHOD) {
      events.push(mapFuzzySessionCompletedEvent(event, event.params));
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
