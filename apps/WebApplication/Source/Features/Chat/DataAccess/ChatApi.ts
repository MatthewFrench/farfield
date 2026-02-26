/**
 * Owns chat HTTP boundary contracts and payload mapping.
 * Internal chat owners should consume strict domain snapshots, not wire envelopes.
 */
import {
  CollaborationModeSchema,
  FarfieldThreadLiveStateSnapshotSchema,
  FarfieldThreadStreamEventsSnapshotSchema,
  type FarfieldThreadLiveStateSnapshot,
  type FarfieldThreadStreamEventsSnapshot,
  UserInputResponsePayloadSchema
} from "@farfield/protocol";
import { z } from "zod";
import { readThread, type ApiReadThreadOptions, type ApiReadThreadResponse } from "@/Features/Threads/DataAccess/ThreadApi";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import {
  applyRequestOptions,
  request,
  requestInitWithOptions,
  requestNoContent
} from "@/Shared/Transport/FarfieldHttpTransport";

const THREADS_ROUTE_PATH = "/api/threads";
const LIVE_STATE_ROUTE_SEGMENT = "live-state";
const STREAM_EVENTS_ROUTE_SEGMENT = "stream-events";
const MESSAGES_ROUTE_SEGMENT = "messages";
const COLLABORATION_MODE_ROUTE_SEGMENT = "collaboration-mode";
const USER_INPUT_ROUTE_SEGMENT = "user-input";
const INTERRUPT_ROUTE_SEGMENT = "interrupt";
const STREAM_EVENTS_LIMIT_QUERY_KEY = "limit";
const STREAM_EVENTS_LIMIT_QUERY_VALUE = "80";
const STREAM_EVENTS_SINCE_SEQUENCE_QUERY_KEY = "sinceSequence";
const REQUEST_METHOD_POST = "POST";
const REQUEST_CONTENT_TYPE_HEADER_NAME = "Content-Type";
const REQUEST_CONTENT_TYPE_HEADER_VALUE = "application/json";

const ThreadIdentifierSchema = z.string().min(1);

export type ApiLiveStateResponse = FarfieldThreadLiveStateSnapshot;

export type ApiStreamEventsResponse = FarfieldThreadStreamEventsSnapshot;

const StreamEventsQueryOptionsSchema = z
  .object({
    // Query cursor must be an absolute sequence index for deterministic stream replay.
    sinceSequence: z.number().int().nonnegative().nullable().optional()
  })
  .strict();

const SendMessageInputSchema = z
  .object({
    threadId: ThreadIdentifierSchema,
    ownerClientId: z.string().optional(),
    text: z.string().min(1),
    cwd: z.string().optional()
  })
  .strict();
export type ApiSendMessageInput = z.infer<typeof SendMessageInputSchema>;

const SetCollaborationModeInputSchema = z
  .object({
    threadId: ThreadIdentifierSchema,
    ownerClientId: z.string().optional(),
    collaborationMode: CollaborationModeSchema
  })
  .strict();
export type ApiSetCollaborationModeInput = z.infer<typeof SetCollaborationModeInputSchema>;

const SubmitUserInputInputSchema = z
  .object({
    threadId: ThreadIdentifierSchema,
    ownerClientId: z.string().optional(),
    requestId: z.number().int().nonnegative(),
    response: UserInputResponsePayloadSchema
  })
  .strict();
export type ApiSubmitUserInputInput = z.infer<typeof SubmitUserInputInputSchema>;

const InterruptThreadInputSchema = z
  .object({
    threadId: ThreadIdentifierSchema,
    ownerClientId: z.string().optional()
  })
  .strict();
export type ApiInterruptThreadInput = z.infer<typeof InterruptThreadInputSchema>;

export interface ApiReadStreamEventsOptions extends ApiRequestOptions {
  // Cursor to request only stream events after this sequence number.
  sinceSequence?: number | null;
}

export { type ApiReadThreadOptions, type ApiReadThreadResponse, readThread };

function parseLiveStateResponse(data: unknown): ApiLiveStateResponse {
  const snapshot = FarfieldThreadLiveStateSnapshotSchema.passthrough().parse(data);
  return {
    ok: snapshot.ok,
    threadId: snapshot.threadId,
    ownerClientId: snapshot.ownerClientId,
    conversationState: snapshot.conversationState,
    liveStateError: snapshot.liveStateError
  };
}

function parseStreamEventsResponse(data: unknown): ApiStreamEventsResponse {
  const snapshot = FarfieldThreadStreamEventsSnapshotSchema.passthrough().parse(data);
  return {
    ok: snapshot.ok,
    threadId: snapshot.threadId,
    ownerClientId: snapshot.ownerClientId,
    events: snapshot.events,
    nextSequence: snapshot.nextSequence,
    firstAvailableSequence: snapshot.firstAvailableSequence,
    resetRequired: snapshot.resetRequired
  };
}

function buildThreadMemberRoutePath(threadId: string, routeSegment: string): string {
  const parsedThreadIdentifier = ThreadIdentifierSchema.parse(threadId);
  return `${THREADS_ROUTE_PATH}/${encodeURIComponent(parsedThreadIdentifier)}/${routeSegment}`;
}

function buildStreamEventsSearchParameters(options?: ApiReadStreamEventsOptions): URLSearchParams {
  const parsedQueryOptions = StreamEventsQueryOptionsSchema.parse({
    sinceSequence: options?.sinceSequence
  });
  const queryParameters = new URLSearchParams({
    [STREAM_EVENTS_LIMIT_QUERY_KEY]: STREAM_EVENTS_LIMIT_QUERY_VALUE
  });

  if (parsedQueryOptions.sinceSequence !== undefined && parsedQueryOptions.sinceSequence !== null) {
    queryParameters.set(STREAM_EVENTS_SINCE_SEQUENCE_QUERY_KEY, String(parsedQueryOptions.sinceSequence));
  }

  return queryParameters;
}

function createJsonPostRequestInit(bodyText: string, options?: ApiRequestOptions): RequestInit {
  return applyRequestOptions(
    {
      method: REQUEST_METHOD_POST,
      headers: {
        [REQUEST_CONTENT_TYPE_HEADER_NAME]: REQUEST_CONTENT_TYPE_HEADER_VALUE
      },
      body: bodyText
    },
    options
  );
}

export async function getLiveState(
  threadId: string,
  options?: ApiRequestOptions
): Promise<ApiLiveStateResponse> {
  const data = await request(
    buildThreadMemberRoutePath(threadId, LIVE_STATE_ROUTE_SEGMENT),
    requestInitWithOptions(options)
  );
  return parseLiveStateResponse(data);
}

export async function getStreamEvents(
  threadId: string,
  options?: ApiReadStreamEventsOptions
): Promise<ApiStreamEventsResponse> {
  const queryParameters = buildStreamEventsSearchParameters(options);
  const data = await request(
    `${buildThreadMemberRoutePath(threadId, STREAM_EVENTS_ROUTE_SEGMENT)}?${queryParameters.toString()}`,
    requestInitWithOptions(options)
  );
  return parseStreamEventsResponse(data);
}

export async function sendMessage(input: ApiSendMessageInput, options?: ApiRequestOptions): Promise<void> {
  const parsedInput = SendMessageInputSchema.parse(input);

  await requestNoContent(
    buildThreadMemberRoutePath(parsedInput.threadId, MESSAGES_ROUTE_SEGMENT),
    createJsonPostRequestInit(
      JSON.stringify({
        ownerClientId: parsedInput.ownerClientId,
        text: parsedInput.text,
        cwd: parsedInput.cwd
      }),
      options
    )
  );
}

export async function setCollaborationMode(
  input: ApiSetCollaborationModeInput,
  options?: ApiRequestOptions
): Promise<void> {
  const parsedInput = SetCollaborationModeInputSchema.parse(input);

  await requestNoContent(
    buildThreadMemberRoutePath(parsedInput.threadId, COLLABORATION_MODE_ROUTE_SEGMENT),
    createJsonPostRequestInit(
      JSON.stringify({
        ownerClientId: parsedInput.ownerClientId,
        collaborationMode: parsedInput.collaborationMode
      }),
      options
    )
  );
}

export async function submitUserInput(
  input: ApiSubmitUserInputInput,
  options?: ApiRequestOptions
): Promise<void> {
  const parsedInput = SubmitUserInputInputSchema.parse(input);

  await requestNoContent(
    buildThreadMemberRoutePath(parsedInput.threadId, USER_INPUT_ROUTE_SEGMENT),
    createJsonPostRequestInit(
      JSON.stringify({
        ownerClientId: parsedInput.ownerClientId,
        requestId: parsedInput.requestId,
        response: parsedInput.response
      }),
      options
    )
  );
}

export async function interruptThread(
  input: ApiInterruptThreadInput,
  options?: ApiRequestOptions
): Promise<void> {
  const parsedInput = InterruptThreadInputSchema.parse(input);

  await requestNoContent(
    buildThreadMemberRoutePath(parsedInput.threadId, INTERRUPT_ROUTE_SEGMENT),
    createJsonPostRequestInit(
      JSON.stringify({
        ownerClientId: parsedInput.ownerClientId
      }),
      options
    )
  );
}
