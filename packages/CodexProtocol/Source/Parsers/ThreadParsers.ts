import { type JsonValue } from "../Common.js";
import {
  type ThreadConversationState,
  ThreadConversationStateSchema,
} from "../Contracts/Thread/ConversationStateContracts.js";
import {
  type ThreadStreamStateChangedParams,
  ThreadStreamStateChangedParamsSchema,
} from "../Contracts/Thread/StreamStateContracts.js";
import {
  type ThreadConversationRequest,
  type ThreadConversationRequestResponse,
  ThreadConversationRequestResponseSchema,
  ThreadConversationRequestSchema,
  type UserInputResponsePayload,
  UserInputResponsePayloadSchema,
} from "../Contracts/Thread/UserInputRequestContracts.js";
import { parseSchemaOrThrow } from "../ProtocolSchemaParsers.js";

const ParseContext = {
  threadConversationState: "ThreadConversationState",
  threadConversationRequest: "ThreadConversationRequest",
  threadConversationRequestResponse: "ThreadConversationRequestResponse",
  threadStreamStateChangedParams: "ThreadStreamStateChangedParams",
  userInputResponsePayload: "UserInputResponsePayload",
} as const;

export function parseThreadConversationState(value: JsonValue): ThreadConversationState {
  return parseSchemaOrThrow(
    ThreadConversationStateSchema,
    value,
    ParseContext.threadConversationState,
  );
}

export function parseThreadStreamStateChangedParams(
  value: JsonValue,
): ThreadStreamStateChangedParams {
  return parseSchemaOrThrow(
    ThreadStreamStateChangedParamsSchema,
    value,
    ParseContext.threadStreamStateChangedParams,
  );
}

export function parseThreadConversationRequest(value: JsonValue): ThreadConversationRequest {
  return parseSchemaOrThrow(
    ThreadConversationRequestSchema,
    value,
    ParseContext.threadConversationRequest,
  );
}

export function parseThreadConversationRequestResponse(
  value: JsonValue,
): ThreadConversationRequestResponse {
  return parseSchemaOrThrow(
    ThreadConversationRequestResponseSchema,
    value,
    ParseContext.threadConversationRequestResponse,
  );
}

export function parseUserInputResponsePayload(value: JsonValue): UserInputResponsePayload {
  return parseSchemaOrThrow(
    UserInputResponsePayloadSchema,
    value,
    ParseContext.userInputResponsePayload,
  );
}
