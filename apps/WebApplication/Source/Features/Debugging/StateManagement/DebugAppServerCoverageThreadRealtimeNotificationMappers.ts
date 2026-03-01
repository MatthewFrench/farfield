import { type JsonValue, JsonValueSchema } from "@farfield/protocol";
import { z } from "zod";
import type { CapabilityNotificationEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageThreadRealtimeNotificationMethod,
  DebugAppServerCoverageThreadRealtimeNotificationMethodCount,
  DebugAppServerCoverageThreadRealtimeNotificationSummary,
  DebugAppServerCoverageThreadRealtimeNotificationsResult,
} from "../DomainModel/DebugAppServerCoverageThreadRealtimeNotificationContracts";

const THREAD_REALTIME_CLOSED_NOTIFICATION_METHOD = "thread/realtime/closed";
const THREAD_REALTIME_ERROR_NOTIFICATION_METHOD = "thread/realtime/error";
const THREAD_REALTIME_ITEM_ADDED_NOTIFICATION_METHOD = "thread/realtime/itemAdded";
const THREAD_REALTIME_OUTPUT_AUDIO_DELTA_NOTIFICATION_METHOD = "thread/realtime/outputAudio/delta";
const THREAD_REALTIME_STARTED_NOTIFICATION_METHOD = "thread/realtime/started";
const THREAD_REALTIME_ITEM_PREVIEW_MAX_CHARACTERS = 180;

const ThreadRealtimeStartedParametersSchema = z
  .object({
    threadId: z.string().min(1),
    sessionId: z.string().min(1).nullable(),
  })
  .strict();

const ThreadRealtimeItemAddedParametersSchema = z
  .object({
    threadId: z.string().min(1),
    item: JsonValueSchema,
  })
  .strict();

const ThreadRealtimeAudioChunkSchema = z
  .object({
    data: z.string(),
    sampleRate: z.number().int().positive(),
    numChannels: z.number().int().positive(),
    samplesPerChannel: z.number().int().positive().nullable(),
  })
  .strict();

const ThreadRealtimeOutputAudioDeltaParametersSchema = z
  .object({
    threadId: z.string().min(1),
    audio: ThreadRealtimeAudioChunkSchema,
  })
  .strict();

const ThreadRealtimeErrorParametersSchema = z
  .object({
    threadId: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

const ThreadRealtimeClosedParametersSchema = z
  .object({
    threadId: z.string().min(1),
    reason: z.string().nullable(),
  })
  .strict();

function mapMethodCounts(
  events: DebugAppServerCoverageThreadRealtimeNotificationSummary[],
): DebugAppServerCoverageThreadRealtimeNotificationMethodCount[] {
  const countByMethod = new Map<DebugAppServerCoverageThreadRealtimeNotificationMethod, number>();
  for (const event of events) {
    const currentCount = countByMethod.get(event.method) ?? 0;
    countByMethod.set(event.method, currentCount + 1);
  }

  return [...countByMethod.entries()]
    .map(([method, count]) => ({ method, count }))
    .sort((left, right) => left.method.localeCompare(right.method));
}

function createThreadRealtimeItemPreview(item: JsonValue): string {
  const serializedItem = JSON.stringify(item);
  if (serializedItem.length <= THREAD_REALTIME_ITEM_PREVIEW_MAX_CHARACTERS) {
    return serializedItem;
  }

  return `${serializedItem.slice(0, THREAD_REALTIME_ITEM_PREVIEW_MAX_CHARACTERS)}...`;
}

function mapThreadRealtimeStartedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageThreadRealtimeNotificationSummary {
  const parsedParameters = ThreadRealtimeStartedParametersSchema.parse(params);
  return {
    method: THREAD_REALTIME_STARTED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    sessionId: parsedParameters.sessionId,
    itemPreview: null,
    audioDataLength: null,
    audioSampleRate: null,
    audioNumChannels: null,
    audioSamplesPerChannel: null,
    errorMessage: null,
    closeReason: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapThreadRealtimeItemAddedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageThreadRealtimeNotificationSummary {
  const parsedParameters = ThreadRealtimeItemAddedParametersSchema.parse(params);
  return {
    method: THREAD_REALTIME_ITEM_ADDED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    sessionId: null,
    itemPreview: createThreadRealtimeItemPreview(parsedParameters.item),
    audioDataLength: null,
    audioSampleRate: null,
    audioNumChannels: null,
    audioSamplesPerChannel: null,
    errorMessage: null,
    closeReason: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapThreadRealtimeOutputAudioDeltaEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageThreadRealtimeNotificationSummary {
  const parsedParameters = ThreadRealtimeOutputAudioDeltaParametersSchema.parse(params);
  return {
    method: THREAD_REALTIME_OUTPUT_AUDIO_DELTA_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    sessionId: null,
    itemPreview: null,
    audioDataLength: parsedParameters.audio.data.length,
    audioSampleRate: parsedParameters.audio.sampleRate,
    audioNumChannels: parsedParameters.audio.numChannels,
    audioSamplesPerChannel: parsedParameters.audio.samplesPerChannel,
    errorMessage: null,
    closeReason: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapThreadRealtimeErrorEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageThreadRealtimeNotificationSummary {
  const parsedParameters = ThreadRealtimeErrorParametersSchema.parse(params);
  return {
    method: THREAD_REALTIME_ERROR_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    sessionId: null,
    itemPreview: null,
    audioDataLength: null,
    audioSampleRate: null,
    audioNumChannels: null,
    audioSamplesPerChannel: null,
    errorMessage: parsedParameters.message,
    closeReason: null,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

function mapThreadRealtimeClosedEvent(
  event: CapabilityNotificationEventsResponse["events"][number],
  params: JsonValue | null,
): DebugAppServerCoverageThreadRealtimeNotificationSummary {
  const parsedParameters = ThreadRealtimeClosedParametersSchema.parse(params);
  return {
    method: THREAD_REALTIME_CLOSED_NOTIFICATION_METHOD,
    sequence: event.sequence,
    threadId: parsedParameters.threadId,
    sessionId: null,
    itemPreview: null,
    audioDataLength: null,
    audioSampleRate: null,
    audioNumChannels: null,
    audioSamplesPerChannel: null,
    errorMessage: null,
    closeReason: parsedParameters.reason,
    receivedAtMilliseconds: event.receivedAtMilliseconds,
  };
}

export function mapThreadRealtimeNotificationsResult(
  response: CapabilityNotificationEventsResponse,
  sinceSequence: number | null,
): DebugAppServerCoverageThreadRealtimeNotificationsResult {
  const events: DebugAppServerCoverageThreadRealtimeNotificationSummary[] = [];
  for (const event of response.events) {
    if (event.method === THREAD_REALTIME_STARTED_NOTIFICATION_METHOD) {
      events.push(mapThreadRealtimeStartedEvent(event, event.params));
      continue;
    }

    if (event.method === THREAD_REALTIME_ITEM_ADDED_NOTIFICATION_METHOD) {
      events.push(mapThreadRealtimeItemAddedEvent(event, event.params));
      continue;
    }

    if (event.method === THREAD_REALTIME_OUTPUT_AUDIO_DELTA_NOTIFICATION_METHOD) {
      events.push(mapThreadRealtimeOutputAudioDeltaEvent(event, event.params));
      continue;
    }

    if (event.method === THREAD_REALTIME_ERROR_NOTIFICATION_METHOD) {
      events.push(mapThreadRealtimeErrorEvent(event, event.params));
      continue;
    }

    if (event.method === THREAD_REALTIME_CLOSED_NOTIFICATION_METHOD) {
      events.push(mapThreadRealtimeClosedEvent(event, event.params));
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
