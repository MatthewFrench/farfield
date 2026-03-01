import { type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import type { CapabilityThreadStreamEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageThreadStreamEventSummary,
  DebugAppServerCoverageThreadStreamEventsResult,
} from "../DomainModel/DebugAppServerCoverageContracts";

/**
 * Maps transport frames into compact debug summaries for coverage diagnostics.
 * Mapping preserves cursor metadata needed for append-or-reset verification.
 */
const PREVIEW_TEXT_MAXIMUM_LENGTH = 480;

const BroadcastEnvelopeMetadataSchema = z
  .object({
    sequence: z.number().int().nonnegative().optional(),
    receivedAtMilliseconds: z.number().int().nonnegative().optional(),
  })
  .passthrough();

interface BroadcastEnvelopeMetadata {
  sequence: number | null;
  receivedAtMilliseconds: number | null;
}

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

function readBroadcastEnvelopeMetadata(params: JsonValue | undefined): BroadcastEnvelopeMetadata {
  if (params === undefined || params === null) {
    return {
      sequence: null,
      receivedAtMilliseconds: null,
    };
  }

  const parsedMetadata = BroadcastEnvelopeMetadataSchema.safeParse(params);
  if (!parsedMetadata.success) {
    return {
      sequence: null,
      receivedAtMilliseconds: null,
    };
  }

  return {
    sequence: parsedMetadata.data.sequence ?? null,
    receivedAtMilliseconds: parsedMetadata.data.receivedAtMilliseconds ?? null,
  };
}

function mapThreadStreamEventSummary(
  frame: CapabilityThreadStreamEventsResponse["events"][number],
): DebugAppServerCoverageThreadStreamEventSummary {
  switch (frame.type) {
    case "request":
      return {
        frameType: frame.type,
        method: frame.method,
        requestId: frame.requestId,
        sourceClientId: frame.sourceClientId ?? null,
        sequence: null,
        receivedAtMilliseconds: null,
        preview: stringifyPreview(frame.params),
      };
    case "response":
      return {
        frameType: frame.type,
        method: frame.method ?? null,
        requestId: frame.requestId,
        sourceClientId: frame.handledByClientId ?? null,
        sequence: null,
        receivedAtMilliseconds: null,
        preview:
          frame.resultType === "success"
            ? stringifyPreview(frame.result)
            : stringifyPreview(frame.error),
      };
    case "broadcast": {
      const broadcastMetadata = readBroadcastEnvelopeMetadata(frame.params);
      return {
        frameType: frame.type,
        method: frame.method,
        requestId: null,
        sourceClientId: frame.sourceClientId ?? null,
        sequence: broadcastMetadata.sequence,
        receivedAtMilliseconds: broadcastMetadata.receivedAtMilliseconds,
        preview: stringifyPreview(frame.params),
      };
    }
    case "client-discovery-request":
      return {
        frameType: frame.type,
        method: frame.request.method,
        requestId: frame.requestId,
        sourceClientId: frame.request.sourceClientId ?? null,
        sequence: null,
        receivedAtMilliseconds: null,
        preview: stringifyPreview(frame.request),
      };
    case "client-discovery-response":
      return {
        frameType: frame.type,
        method: null,
        requestId: frame.requestId,
        sourceClientId: null,
        sequence: null,
        receivedAtMilliseconds: null,
        preview: stringifyPreview(frame.response),
      };
  }
}

export function mapThreadStreamEventsResult(
  response: CapabilityThreadStreamEventsResponse,
  sinceSequence: number | null,
): DebugAppServerCoverageThreadStreamEventsResult {
  const eventSummaries = response.events.map((frame) => mapThreadStreamEventSummary(frame));

  return {
    threadId: response.threadId,
    sinceSequence,
    ownerClientId: response.ownerClientId,
    eventCount: eventSummaries.length,
    nextSequence: response.nextSequence,
    firstAvailableSequence: response.firstAvailableSequence,
    resetRequired: response.resetRequired,
    events: eventSummaries,
    readAtIso8601: new Date().toISOString(),
  };
}
