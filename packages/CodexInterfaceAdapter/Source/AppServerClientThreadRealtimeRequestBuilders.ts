import { z } from "zod";
import type {
  ThreadRealtimeAppendTextOptions,
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

export function buildThreadRealtimeStopRequestParameters(
  options: ThreadRealtimeStopOptions,
): ThreadRealtimeStopRequestParameters {
  return AppServerThreadRealtimeStopRequestSchema.parse({
    threadId: options.threadId,
  });
}
