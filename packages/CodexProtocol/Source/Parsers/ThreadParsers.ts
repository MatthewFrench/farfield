import { type JsonValue } from "../Common.js";
import {
  ThreadConversationStateSchema,
  type ThreadConversationState
} from "../Contracts/Thread/ConversationStateContracts.js";
import {
  ThreadStreamStateChangedParamsSchema,
  type ThreadStreamStateChangedParams
} from "../Contracts/Thread/StreamStateContracts.js";
import {
  UserInputResponsePayloadSchema,
  type UserInputResponsePayload
} from "../Contracts/Thread/UserInputRequestContracts.js";
import { parseSchemaOrThrow } from "../ProtocolSchemaParsers.js";

const ParseContext = {
  threadConversationState: "ThreadConversationState",
  threadStreamStateChangedParams: "ThreadStreamStateChangedParams",
  userInputResponsePayload: "UserInputResponsePayload"
} as const;

export function parseThreadConversationState(value: JsonValue): ThreadConversationState {
  return parseSchemaOrThrow(
    ThreadConversationStateSchema,
    value,
    ParseContext.threadConversationState
  );
}

export function parseThreadStreamStateChangedParams(
  value: JsonValue
): ThreadStreamStateChangedParams {
  return parseSchemaOrThrow(
    ThreadStreamStateChangedParamsSchema,
    value,
    ParseContext.threadStreamStateChangedParams
  );
}

export function parseUserInputResponsePayload(value: JsonValue): UserInputResponsePayload {
  return parseSchemaOrThrow(
    UserInputResponsePayloadSchema,
    value,
    ParseContext.userInputResponsePayload
  );
}
