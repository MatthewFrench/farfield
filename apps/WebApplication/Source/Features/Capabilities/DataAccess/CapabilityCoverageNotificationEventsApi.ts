import {
  type FarfieldNotificationEventsSnapshot,
  FarfieldNotificationEventsSnapshotSchema,
} from "@farfield/protocol";
import { z } from "zod";
import { type AgentId, type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { request, requestInitWithOptions } from "@/Shared/Transport/FarfieldHttpTransport";

/**
 * Owns debug-coverage app-server notification-event read boundary contracts.
 * Query and response parsing stay schema-owned so cursor synchronization remains deterministic.
 */
const NOTIFICATION_EVENTS_ENDPOINT = "/api/notifications/events";
const NOTIFICATION_EVENTS_LIMIT_QUERY_PARAMETER = "limit";
const NOTIFICATION_EVENTS_SINCE_SEQUENCE_QUERY_PARAMETER = "sinceSequence";
const NOTIFICATION_EVENTS_DEFAULT_LIMIT = 80;

const ReadNotificationEventsInputSchema = z
  .object({
    limit: z.number().int().positive().optional(),
    sinceSequence: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();

const NotificationEventsResponseWireSchema = FarfieldNotificationEventsSnapshotSchema.passthrough();

export interface ApiReadNotificationEventsOptions extends ApiRequestOptions {
  agentId?: AgentId;
  limit?: number;
  sinceSequence?: number | null;
}

export type ApiNotificationEventsResponse = FarfieldNotificationEventsSnapshot;

function buildReadNotificationEventsPath(options: ApiReadNotificationEventsOptions): string {
  const parsedInput = ReadNotificationEventsInputSchema.parse({
    ...(options.limit !== undefined ? { limit: options.limit } : {}),
    ...(options.sinceSequence !== undefined ? { sinceSequence: options.sinceSequence } : {}),
  });

  const params = new URLSearchParams();
  params.set(
    NOTIFICATION_EVENTS_LIMIT_QUERY_PARAMETER,
    String(parsedInput.limit ?? NOTIFICATION_EVENTS_DEFAULT_LIMIT),
  );
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  if (parsedInput.sinceSequence !== undefined && parsedInput.sinceSequence !== null) {
    params.set(
      NOTIFICATION_EVENTS_SINCE_SEQUENCE_QUERY_PARAMETER,
      String(parsedInput.sinceSequence),
    );
  }

  return `${NOTIFICATION_EVENTS_ENDPOINT}?${params.toString()}`;
}

function parseNotificationEventsResponse(
  value: z.infer<typeof NotificationEventsResponseWireSchema>,
): ApiNotificationEventsResponse {
  return {
    ok: value.ok,
    events: value.events,
    nextSequence: value.nextSequence,
    firstAvailableSequence: value.firstAvailableSequence,
    resetRequired: value.resetRequired,
  };
}

export async function readNotificationEvents(
  options: ApiReadNotificationEventsOptions,
): Promise<ApiNotificationEventsResponse> {
  const data = await request(
    buildReadNotificationEventsPath(options),
    requestInitWithOptions(options),
  );
  const parsedResponse = NotificationEventsResponseWireSchema.parse(data);
  return parseNotificationEventsResponse(parsedResponse);
}
