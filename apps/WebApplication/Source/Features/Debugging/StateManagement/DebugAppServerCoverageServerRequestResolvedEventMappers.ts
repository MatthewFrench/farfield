import { type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import type { CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type { DebugAppServerCoverageServerRequestResolvedEventsResult } from "../DomainModel/DebugAppServerCoverageContracts";

const SERVER_REQUEST_RESOLVED_NOTIFICATION_METHOD = "serverRequest/resolved";

const ServerRequestResolvedParametersSchema = z
  .object({
    threadId: z.string().min(1),
    requestId: z.number().int().nonnegative(),
  })
  .strict();

function mapServerRequestResolvedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
) {
  const parsedParameters = ServerRequestResolvedParametersSchema.parse(params);
  return {
    sequence: event.sequence,
    requestId: parsedParameters.requestId,
    threadId: parsedParameters.threadId,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

export function mapServerRequestResolvedEventsResult(
  response: CapabilityNotificationEventsResponse,
  sinceSequence: number | null,
): DebugAppServerCoverageServerRequestResolvedEventsResult {
  const resolvedEvents = response.events
    .filter((event) => event.method === SERVER_REQUEST_RESOLVED_NOTIFICATION_METHOD)
    .map((event) => mapServerRequestResolvedEvent(event, event.params));

  return {
    sinceSequence,
    eventCount: resolvedEvents.length,
    nextSequence: response.nextSequence,
    firstAvailableSequence: response.firstAvailableSequence,
    resetRequired: response.resetRequired,
    events: resolvedEvents,
    readAtIso8601: new Date().toISOString(),
  };
}
