import { type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import type { CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type { DebugAppServerCoverageModelReroutedEventsResult } from "../DomainModel/DebugAppServerCoverageContracts";

const MODEL_REROUTED_NOTIFICATION_METHOD = "model/rerouted";

const ModelReroutedParametersSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    fromModel: z.string().min(1),
    toModel: z.string().min(1),
    reason: z.literal("highRiskCyberActivity"),
  })
  .strict();

function mapModelReroutedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
) {
  const parsedParameters = ModelReroutedParametersSchema.parse(params);
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

export function mapModelReroutedEventsResult(
  response: CapabilityNotificationEventsResponse,
  sinceSequence: number | null,
): DebugAppServerCoverageModelReroutedEventsResult {
  const reroutedEvents = response.events
    .filter((event) => event.method === MODEL_REROUTED_NOTIFICATION_METHOD)
    .map((event) => mapModelReroutedEvent(event, event.params));

  return {
    sinceSequence,
    eventCount: reroutedEvents.length,
    nextSequence: response.nextSequence,
    firstAvailableSequence: response.firstAvailableSequence,
    resetRequired: response.resetRequired,
    events: reroutedEvents,
    readAtIso8601: new Date().toISOString(),
  };
}
