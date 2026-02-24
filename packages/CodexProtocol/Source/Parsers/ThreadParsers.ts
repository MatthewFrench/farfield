import { type JsonValue } from "../Common.js";
import { ProtocolValidationError } from "../Errors.js";
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

export function parseThreadConversationState(value: JsonValue): ThreadConversationState {
  const result = ThreadConversationStateSchema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod("ThreadConversationState", result.error);
  }
  return result.data;
}

export function parseThreadStreamStateChangedParams(
  value: JsonValue
): ThreadStreamStateChangedParams {
  const result = ThreadStreamStateChangedParamsSchema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod("ThreadStreamStateChangedParams", result.error);
  }
  return result.data;
}

export function parseUserInputResponsePayload(value: JsonValue): UserInputResponsePayload {
  const result = UserInputResponsePayloadSchema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod("UserInputResponsePayload", result.error);
  }
  return result.data;
}
