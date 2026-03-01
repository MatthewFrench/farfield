import { type JsonValue } from "@farfield/protocol";
import type { CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageNotificationEventMethodCount,
  DebugAppServerCoverageNotificationEventSummary,
  DebugAppServerCoverageNotificationEventsResult,
} from "../DomainModel/DebugAppServerCoverageContracts";

const PREVIEW_TEXT_MAXIMUM_LENGTH = 480;

function stringifyPreview(value: JsonValue | object | undefined): string {
  if (value === undefined) {
    return "(none)";
  }

  const serializedValue = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (serializedValue.length <= PREVIEW_TEXT_MAXIMUM_LENGTH) {
    return serializedValue;
  }

  return `${serializedValue.slice(0, PREVIEW_TEXT_MAXIMUM_LENGTH)}…`;
}

function mapNotificationEventSummary(
  event: CapabilityNotificationEventsResponse["events"][number],
): DebugAppServerCoverageNotificationEventSummary {
  return {
    method: event.method,
    sequence: event.sequence,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
    preview: stringifyPreview(event.params),
  };
}

function mapMethodCounts(
  eventSummaries: DebugAppServerCoverageNotificationEventSummary[],
): DebugAppServerCoverageNotificationEventMethodCount[] {
  const countsByMethod = new Map<string, number>();
  for (const eventSummary of eventSummaries) {
    const existingCount = countsByMethod.get(eventSummary.method) ?? 0;
    countsByMethod.set(eventSummary.method, existingCount + 1);
  }

  return [...countsByMethod.entries()]
    .map(([method, count]) => ({
      method,
      count,
    }))
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }
      return left.method.localeCompare(right.method);
    });
}

export function mapNotificationEventsResult(
  response: CapabilityNotificationEventsResponse,
  sinceSequence: number | null,
): DebugAppServerCoverageNotificationEventsResult {
  const eventSummaries = response.events.map((event) => mapNotificationEventSummary(event));
  const methodCounts = mapMethodCounts(eventSummaries);

  return {
    sinceSequence,
    eventCount: eventSummaries.length,
    nextSequence: response.nextSequence,
    firstAvailableSequence: response.firstAvailableSequence,
    resetRequired: response.resetRequired,
    events: eventSummaries,
    methodCounts,
    readAtIso8601: new Date().toISOString(),
  };
}
