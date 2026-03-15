import {
  type FarfieldThreadStreamEventsSnapshot,
  FarfieldThreadStreamEventsSnapshotSchema,
} from "@farfield/protocol";
import { z } from "zod";
import { type AgentId, type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { request, requestInitWithOptions } from "@/Shared/Transport/FarfieldHttpTransport";

/**
 * Owns the debug-coverage stream-event read boundary.
 * Input and response parsing remain schema-owned so cursor contracts stay deterministic.
 */
const THREADS_ENDPOINT = "/api/threads";
const STREAM_EVENTS_ROUTE_SEGMENT = "stream-events";
const STREAM_EVENTS_LIMIT_QUERY_PARAMETER = "limit";
const STREAM_EVENTS_SINCE_SEQUENCE_QUERY_PARAMETER = "sinceSequence";
const STREAM_EVENTS_DEFAULT_LIMIT = 80;

const ReadThreadStreamEventsInputSchema = z
  .object({
    threadId: z.string().min(1),
    limit: z.number().int().positive().optional(),
    sinceSequence: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();

const ThreadStreamEventsResponseWireSchema = FarfieldThreadStreamEventsSnapshotSchema.passthrough();

export interface ApiReadThreadStreamEventsOptions extends ApiRequestOptions {
  agentId?: AgentId;
  threadId: string;
  limit?: number;
  sinceSequence?: number | null;
}

export type ApiThreadStreamEventsResponse = FarfieldThreadStreamEventsSnapshot;

function buildReadThreadStreamEventsPath(options: ApiReadThreadStreamEventsOptions): string {
  const parsedInput = ReadThreadStreamEventsInputSchema.parse({
    threadId: options.threadId,
    ...(options.limit !== undefined ? { limit: options.limit } : {}),
    ...(options.sinceSequence !== undefined ? { sinceSequence: options.sinceSequence } : {}),
  });

  const params = new URLSearchParams();
  params.set(
    STREAM_EVENTS_LIMIT_QUERY_PARAMETER,
    String(parsedInput.limit ?? STREAM_EVENTS_DEFAULT_LIMIT),
  );
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  if (parsedInput.sinceSequence !== undefined && parsedInput.sinceSequence !== null) {
    params.set(STREAM_EVENTS_SINCE_SEQUENCE_QUERY_PARAMETER, String(parsedInput.sinceSequence));
  }

  return `${THREADS_ENDPOINT}/${encodeURIComponent(parsedInput.threadId)}/${STREAM_EVENTS_ROUTE_SEGMENT}?${params.toString()}`;
}

function parseThreadStreamEventsResponse(
  value: z.infer<typeof ThreadStreamEventsResponseWireSchema>,
): ApiThreadStreamEventsResponse {
  return {
    ok: value.ok,
    threadId: value.threadId,
    ownerClientId: value.ownerClientId,
    events: value.events,
    nextSequence: value.nextSequence,
    firstAvailableSequence: value.firstAvailableSequence,
    resetRequired: value.resetRequired,
  };
}

export async function readThreadStreamEvents(
  options: ApiReadThreadStreamEventsOptions,
): Promise<ApiThreadStreamEventsResponse> {
  const data = await request(
    buildReadThreadStreamEventsPath(options),
    requestInitWithOptions(options),
  );
  const parsedResponse = ThreadStreamEventsResponseWireSchema.parse(data);
  return parseThreadStreamEventsResponse(parsedResponse);
}
