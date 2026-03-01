import { type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import type { CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageItemLifecycleNotificationMethod,
  DebugAppServerCoverageItemLifecycleNotificationMethodCount,
  DebugAppServerCoverageItemLifecycleNotificationSummary,
  DebugAppServerCoverageItemLifecycleNotificationsResult,
} from "../DomainModel/DebugAppServerCoverageContracts";

const ITEM_STARTED_NOTIFICATION_METHOD = "item/started";
const ITEM_COMPLETED_NOTIFICATION_METHOD = "item/completed";

const ItemIdentitySchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
  })
  .passthrough();

const ItemLifecycleParametersSchema = z
  .object({
    item: ItemIdentitySchema,
    threadId: z.string().min(1),
    turnId: z.string().min(1),
  })
  .strict();

function mapMethodCounts(
  events: DebugAppServerCoverageItemLifecycleNotificationSummary[],
): DebugAppServerCoverageItemLifecycleNotificationMethodCount[] {
  const countByMethod = new Map<DebugAppServerCoverageItemLifecycleNotificationMethod, number>();
  for (const event of events) {
    const currentCount = countByMethod.get(event.method) ?? 0;
    countByMethod.set(event.method, currentCount + 1);
  }

  return [...countByMethod.entries()]
    .map(([method, count]) => ({ method, count }))
    .sort((left, right) => left.method.localeCompare(right.method));
}

function mapItemLifecycleEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  method: "item/started" | "item/completed",
  params: JsonValue | null,
): DebugAppServerCoverageItemLifecycleNotificationSummary {
  const parsedParameters = ItemLifecycleParametersSchema.parse(params);
  return {
    method,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    turnId: parsedParameters.turnId,
    itemId: parsedParameters.item.id,
    itemType: parsedParameters.item.type,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

export function mapItemLifecycleNotificationsResult(
  response: CapabilityNotificationEventsResponse,
  sinceSequence: number | null,
): DebugAppServerCoverageItemLifecycleNotificationsResult {
  const events: DebugAppServerCoverageItemLifecycleNotificationSummary[] = [];
  for (const event of response.events) {
    if (event.method === ITEM_STARTED_NOTIFICATION_METHOD) {
      events.push(mapItemLifecycleEvent(event, ITEM_STARTED_NOTIFICATION_METHOD, event.params));
      continue;
    }

    if (event.method === ITEM_COMPLETED_NOTIFICATION_METHOD) {
      events.push(mapItemLifecycleEvent(event, ITEM_COMPLETED_NOTIFICATION_METHOD, event.params));
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
