import {
  type CollaborationMode,
  IpcFrameSchema,
  ThreadConversationStateSchema,
  UserInputResponsePayloadSchema
} from "@farfield/protocol";
import { z } from "zod";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import {
  applyRequestOptions,
  request,
  requestInitWithOptions,
  requestNoContent
} from "@/Shared/Transport/FarfieldHttpTransport";
import { readThread, type ApiReadThreadOptions, type ApiReadThreadResponse } from "@/Features/Threads/DataAccess/ThreadApi";

const LiveStateResponseSchema: z.ZodObject<
  {
    ok: z.ZodLiteral<true>;
    threadId: z.ZodString;
    ownerClientId: z.ZodNullable<z.ZodString>;
    conversationState: z.ZodUnion<[typeof ThreadConversationStateSchema, z.ZodNull]>;
    liveStateError: z.ZodNullable<
      z.ZodObject<{
        kind: z.ZodLiteral<"reductionFailed">;
        message: z.ZodString;
        eventIndex: z.ZodNullable<z.ZodNumber>;
        patchIndex: z.ZodNullable<z.ZodNumber>;
      }>
    >;
  },
  "passthrough"
> = z
  .object({
    ok: z.literal(true),
    threadId: z.string(),
    ownerClientId: z.string().nullable(),
    conversationState: z.union([ThreadConversationStateSchema, z.null()]),
    liveStateError: z
      .object({
        kind: z.literal("reductionFailed"),
        message: z.string(),
        eventIndex: z.number().int().nonnegative().nullable(),
        patchIndex: z.number().int().nonnegative().nullable()
      })
      .nullable()
  })
  .passthrough();
export type ApiLiveStateResponse = z.infer<typeof LiveStateResponseSchema>;

const StreamEventsResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string(),
    ownerClientId: z.string().nullable(),
    events: z.array(IpcFrameSchema),
    nextSequence: z.number().int().nonnegative(),
    firstAvailableSequence: z.number().int().nonnegative(),
    resetRequired: z.boolean()
  })
  .passthrough();
export type ApiStreamEventsResponse = z.infer<typeof StreamEventsResponseSchema>;

export interface ApiReadStreamEventsOptions extends ApiRequestOptions {
  // Cursor to request only stream events after this sequence number.
  sinceSequence?: number | null;
}

export interface ApiSendMessageInput {
  threadId: string;
  ownerClientId?: string;
  text: string;
  cwd?: string;
}

export interface ApiSetCollaborationModeInput {
  threadId: string;
  ownerClientId?: string;
  collaborationMode: CollaborationMode;
}

export interface ApiSubmitUserInputInput {
  threadId: string;
  ownerClientId?: string;
  requestId: number;
  response: z.infer<typeof UserInputResponsePayloadSchema>;
}

export interface ApiInterruptThreadInput {
  threadId: string;
  ownerClientId?: string;
}

export { type ApiReadThreadOptions, type ApiReadThreadResponse, readThread };

export async function getLiveState(
  threadId: string,
  options?: ApiRequestOptions
): Promise<ApiLiveStateResponse> {
  const data = await request(
    `/api/threads/${encodeURIComponent(threadId)}/live-state`,
    requestInitWithOptions(options)
  );
  return LiveStateResponseSchema.parse(data);
}

export async function getStreamEvents(
  threadId: string,
  options?: ApiReadStreamEventsOptions
): Promise<ApiStreamEventsResponse> {
  const queryParameters = new URLSearchParams({
    limit: "80"
  });
  if (options?.sinceSequence !== undefined && options.sinceSequence !== null) {
    queryParameters.set("sinceSequence", String(options.sinceSequence));
  }

  const data = await request(
    `/api/threads/${encodeURIComponent(threadId)}/stream-events?${queryParameters.toString()}`,
    requestInitWithOptions(options)
  );
  return StreamEventsResponseSchema.parse(data);
}

export async function sendMessage(input: ApiSendMessageInput, options?: ApiRequestOptions): Promise<void> {
  const { threadId, ...body } = input;

  await requestNoContent(
    `/api/threads/${encodeURIComponent(threadId)}/messages`,
    applyRequestOptions(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      },
      options
    )
  );
}

export async function setCollaborationMode(
  input: ApiSetCollaborationModeInput,
  options?: ApiRequestOptions
): Promise<void> {
  const { threadId, ...body } = input;

  await requestNoContent(
    `/api/threads/${encodeURIComponent(threadId)}/collaboration-mode`,
    applyRequestOptions(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      },
      options
    )
  );
}

export async function submitUserInput(
  input: ApiSubmitUserInputInput,
  options?: ApiRequestOptions
): Promise<void> {
  UserInputResponsePayloadSchema.parse(input.response);

  const { threadId, ...body } = input;

  await requestNoContent(
    `/api/threads/${encodeURIComponent(threadId)}/user-input`,
    applyRequestOptions(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      },
      options
    )
  );
}

export async function interruptThread(
  input: ApiInterruptThreadInput,
  options?: ApiRequestOptions
): Promise<void> {
  const { threadId, ...body } = input;

  await requestNoContent(
    `/api/threads/${encodeURIComponent(threadId)}/interrupt`,
    applyRequestOptions(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      },
      options
    )
  );
}
