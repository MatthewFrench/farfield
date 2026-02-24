import type {
  OpenCodeMessage,
  OpenCodePart,
  OpenCodeSession
} from "./Schemas.js";
import {
  type MappedThreadConversationState,
  type MappedThreadListItem
} from "./MapperContracts.js";
import { messagesToTurns } from "./ConversationTurnMapper.js";

export function sessionToThreadListItem(session: OpenCodeSession): MappedThreadListItem {
  return {
    id: session.id,
    preview: session.title || "(untitled)",
    createdAt: session.time.created,
    updatedAt: session.time.updated,
    cwd: session.directory,
    source: "opencode"
  };
}

export function sessionToConversationState(
  session: OpenCodeSession,
  messages: OpenCodeMessage[],
  partsByMessage: Map<string, OpenCodePart[]>
): MappedThreadConversationState {
  const turns = messagesToTurns(messages, partsByMessage);

  const lastAssistant = messages.filter((message) => message.role === "assistant").at(-1);
  const latestModel = lastAssistant?.providerID && lastAssistant?.modelID
    ? `${lastAssistant.providerID}/${lastAssistant.modelID}`
    : null;

  return {
    id: session.id,
    turns,
    requests: [],
    createdAt: session.time.created,
    updatedAt: session.time.updated,
    title: session.title || null,
    latestModel,
    cwd: session.directory,
    source: "opencode"
  };
}
