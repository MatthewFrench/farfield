import { z } from "zod";
import type {
  ThreadRealtimeAppendAudioOptions,
  ThreadRealtimeAppendTextOptions,
  ThreadRealtimeAudioChunk,
  ThreadRealtimeStartOptions,
  ThreadRealtimeStopOptions,
} from "./AppServerClient.js";

const AppServerThreadRealtimeStartRequestSchema = z
  .object({
    threadId: z.string().min(1),
    prompt: z.string(),
    sessionId: z.union([z.string().min(1), z.null()]).optional(),
  })
  .passthrough();
const AppServerThreadRealtimeAppendTextRequestSchema = z
  .object({
    threadId: z.string().min(1),
    text: z.string(),
  })
  .passthrough();
const AppServerThreadRealtimeAudioChunkSchema = z
  .object({
    data: z.string(),
    sampleRate: z.number().int().min(0),
    numChannels: z.number().int().min(0),
    samplesPerChannel: z.number().int().min(0).optional(),
  })
  .passthrough();
const AppServerThreadRealtimeAppendAudioRequestSchema = z
  .object({
    threadId: z.string().min(1),
    audio: AppServerThreadRealtimeAudioChunkSchema,
  })
  .passthrough();
const AppServerThreadRealtimeStopRequestSchema = z
  .object({
    threadId: z.string().min(1),
  })
  .passthrough();

interface ThreadRealtimeStartRequestParameters {
  threadId: string;
  prompt: string;
  sessionId?: string | null | undefined;
}

interface ThreadRealtimeAppendTextRequestParameters {
  threadId: string;
  text: string;
}

interface ThreadRealtimeAppendAudioRequestParameters {
  threadId: string;
  audio: ThreadRealtimeAudioChunk;
}

interface ThreadRealtimeStopRequestParameters {
  threadId: string;
}

export function buildThreadRealtimeStartRequestParameters(
  options: ThreadRealtimeStartOptions,
): ThreadRealtimeStartRequestParameters {
  return AppServerThreadRealtimeStartRequestSchema.parse({
    threadId: options.threadId,
    prompt: options.prompt,
    ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
  });
}

export function buildThreadRealtimeAppendTextRequestParameters(
  options: ThreadRealtimeAppendTextOptions,
): ThreadRealtimeAppendTextRequestParameters {
  return AppServerThreadRealtimeAppendTextRequestSchema.parse({
    threadId: options.threadId,
    text: options.text,
  });
}

export function buildThreadRealtimeAppendAudioRequestParameters(
  options: ThreadRealtimeAppendAudioOptions,
): ThreadRealtimeAppendAudioRequestParameters {
  const parsedRequest = AppServerThreadRealtimeAppendAudioRequestSchema.parse({
    threadId: options.threadId,
    audio: options.audio,
  });

  return {
    threadId: parsedRequest.threadId,
    audio: {
      data: parsedRequest.audio.data,
      sampleRate: parsedRequest.audio.sampleRate,
      numChannels: parsedRequest.audio.numChannels,
      ...(parsedRequest.audio.samplesPerChannel !== undefined
        ? {
            samplesPerChannel: parsedRequest.audio.samplesPerChannel,
          }
        : {}),
    },
  };
}

export function buildThreadRealtimeStopRequestParameters(
  options: ThreadRealtimeStopOptions,
): ThreadRealtimeStopRequestParameters {
  return AppServerThreadRealtimeStopRequestSchema.parse({
    threadId: options.threadId,
  });
}
