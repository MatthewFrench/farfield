import { z } from "zod";
import { type AgentId, type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { request, requestInitWithOptions } from "@/Shared/Transport/FarfieldHttpTransport";

const THREAD_REALTIME_START_ENDPOINT = "/api/threads/realtime/start";
const THREAD_REALTIME_APPEND_TEXT_ENDPOINT = "/api/threads/realtime/append-text";
const THREAD_REALTIME_STOP_ENDPOINT = "/api/threads/realtime/stop";

export interface ApiThreadRealtimeStartOptions extends ApiRequestOptions {
  agentId?: AgentId;
  threadId: string;
  prompt: string;
  sessionId?: string;
}

export interface ApiThreadRealtimeAppendTextOptions extends ApiRequestOptions {
  agentId?: AgentId;
  threadId: string;
  text: string;
}

export interface ApiThreadRealtimeStopOptions extends ApiRequestOptions {
  agentId?: AgentId;
  threadId: string;
}

const ThreadRealtimeStartInputSchema = z
  .object({
    threadId: z.string().min(1),
    prompt: z.string().min(1),
    sessionId: z.string().min(1).optional(),
  })
  .strict();
const ThreadRealtimeAppendTextInputSchema = z
  .object({
    threadId: z.string().min(1),
    text: z.string().min(1),
  })
  .strict();
const ThreadRealtimeStopInputSchema = z
  .object({
    threadId: z.string().min(1),
  })
  .strict();

const ThreadRealtimeMutationResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .strict();
export type ApiThreadRealtimeStartResponse = z.infer<typeof ThreadRealtimeMutationResponseSchema>;
export type ApiThreadRealtimeAppendTextResponse = z.infer<
  typeof ThreadRealtimeMutationResponseSchema
>;
export type ApiThreadRealtimeStopResponse = z.infer<typeof ThreadRealtimeMutationResponseSchema>;

function readThreadRealtimeStartPath(options: ApiThreadRealtimeStartOptions): string {
  const parsedInput = ThreadRealtimeStartInputSchema.parse({
    threadId: options.threadId,
    prompt: options.prompt,
    ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
  });
  const params = new URLSearchParams();
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  params.set("threadId", parsedInput.threadId);
  params.set("prompt", parsedInput.prompt);
  if (parsedInput.sessionId !== undefined) {
    params.set("sessionId", parsedInput.sessionId);
  }
  return `${THREAD_REALTIME_START_ENDPOINT}?${params.toString()}`;
}

function readThreadRealtimeAppendTextPath(options: ApiThreadRealtimeAppendTextOptions): string {
  const parsedInput = ThreadRealtimeAppendTextInputSchema.parse({
    threadId: options.threadId,
    text: options.text,
  });
  const params = new URLSearchParams();
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  params.set("threadId", parsedInput.threadId);
  params.set("text", parsedInput.text);
  return `${THREAD_REALTIME_APPEND_TEXT_ENDPOINT}?${params.toString()}`;
}

function readThreadRealtimeStopPath(options: ApiThreadRealtimeStopOptions): string {
  const parsedInput = ThreadRealtimeStopInputSchema.parse({
    threadId: options.threadId,
  });
  const params = new URLSearchParams();
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  params.set("threadId", parsedInput.threadId);
  return `${THREAD_REALTIME_STOP_ENDPOINT}?${params.toString()}`;
}

export async function startThreadRealtime(
  options: ApiThreadRealtimeStartOptions,
): Promise<ApiThreadRealtimeStartResponse> {
  return ThreadRealtimeMutationResponseSchema.parse(
    await request(readThreadRealtimeStartPath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}

export async function appendThreadRealtimeText(
  options: ApiThreadRealtimeAppendTextOptions,
): Promise<ApiThreadRealtimeAppendTextResponse> {
  return ThreadRealtimeMutationResponseSchema.parse(
    await request(readThreadRealtimeAppendTextPath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}

export async function stopThreadRealtime(
  options: ApiThreadRealtimeStopOptions,
): Promise<ApiThreadRealtimeStopResponse> {
  return ThreadRealtimeMutationResponseSchema.parse(
    await request(readThreadRealtimeStopPath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}
