import { type IpcBroadcastFrame, type IpcFrame, type IpcRequestFrame } from "@farfield/protocol";
import { z } from "zod";
import { THREAD_STREAM_STATE_CHANGED_METHOD } from "../ThreadStreamStateChangedContract.js";
import { normalizeNullableIdentifier } from "./CodexThreadIdentifierNormalization.js";

export interface CodexIpcFrameDescription {
  method: string;
  threadId: string | null;
}

const IPC_FRAME_TYPE_REQUEST = "request";
const IPC_FRAME_TYPE_RESPONSE = "response";
const IPC_FRAME_TYPE_BROADCAST = "broadcast";
const IPC_FRAME_TYPE_CLIENT_DISCOVERY_REQUEST = "client-discovery-request";
const IPC_FRAME_TYPE_CLIENT_DISCOVERY_RESPONSE = "client-discovery-response";
const RESPONSE_METHOD_DESCRIPTION = "response";

const THREAD_IDENTIFIER_CANDIDATES_SCHEMA = z
  .object({
    conversationId: z.string().optional(),
    threadId: z.string().optional(),
    turnId: z.string().optional(),
  })
  .passthrough();

type ThreadIdentifierCandidates = z.infer<typeof THREAD_IDENTIFIER_CANDIDATES_SCHEMA>;

export function describeCodexIpcFrame(frame: IpcFrame): CodexIpcFrameDescription {
  return {
    method: readFrameMethod(frame),
    threadId: extractThreadIdFromCodexIpcFrame(frame),
  };
}

export function isThreadStreamStateChangedFrame(frame: IpcFrame): boolean {
  return (
    frame.type === IPC_FRAME_TYPE_BROADCAST && frame.method === THREAD_STREAM_STATE_CHANGED_METHOD
  );
}

export function extractThreadIdFromCodexIpcFrame(frame: IpcFrame): string | null {
  switch (frame.type) {
    case IPC_FRAME_TYPE_BROADCAST:
      return extractThreadIdFromBroadcastFrame(frame);
    case IPC_FRAME_TYPE_REQUEST:
      return extractThreadIdFromRequestFrame(frame);
    case IPC_FRAME_TYPE_RESPONSE:
    case IPC_FRAME_TYPE_CLIENT_DISCOVERY_REQUEST:
    case IPC_FRAME_TYPE_CLIENT_DISCOVERY_RESPONSE:
      return null;
  }
}

function extractThreadIdFromBroadcastFrame(frame: IpcBroadcastFrame): string | null {
  if (!isThreadStreamStateChangedFrame(frame)) {
    return null;
  }

  const parsedBroadcastParams = parseThreadIdentifierCandidates(frame.params);
  if (parsedBroadcastParams === null) {
    return null;
  }

  return normalizeNullableIdentifier(parsedBroadcastParams.conversationId);
}

function extractThreadIdFromRequestFrame(frame: IpcRequestFrame): string | null {
  const parsedRequestParams = parseThreadIdentifierCandidates(frame.params);
  if (parsedRequestParams === null) {
    return null;
  }

  const candidates = [
    parsedRequestParams.conversationId,
    parsedRequestParams.threadId,
    parsedRequestParams.turnId,
  ];

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeNullableIdentifier(candidate);
    if (normalizedCandidate !== null) {
      return normalizedCandidate;
    }
  }

  return null;
}

function readFrameMethod(frame: IpcFrame): string {
  switch (frame.type) {
    case IPC_FRAME_TYPE_REQUEST:
    case IPC_FRAME_TYPE_BROADCAST:
      return frame.method;
    case IPC_FRAME_TYPE_RESPONSE:
      return frame.method ?? RESPONSE_METHOD_DESCRIPTION;
    case IPC_FRAME_TYPE_CLIENT_DISCOVERY_REQUEST:
    case IPC_FRAME_TYPE_CLIENT_DISCOVERY_RESPONSE:
      return frame.type;
  }
}

function parseThreadIdentifierCandidates(
  frameParams: IpcFrame["params"],
): ThreadIdentifierCandidates | null {
  const parsedCandidates = THREAD_IDENTIFIER_CANDIDATES_SCHEMA.safeParse(frameParams);
  if (!parsedCandidates.success) {
    return null;
  }
  return parsedCandidates.data;
}
