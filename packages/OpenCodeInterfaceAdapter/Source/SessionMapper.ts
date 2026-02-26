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

const UNTITLED_SESSION_PREVIEW = "(untitled)";

export function sessionToThreadListItem(session: OpenCodeSession): MappedThreadListItem {
  const sessionTitle = normalizeSessionTitle(session.title);

  return {
    id: session.id,
    preview: sessionTitle ?? UNTITLED_SESSION_PREVIEW,
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

  const latestAssistant = resolveLatestAssistantMessage(messages);
  const latestModel = (
    latestAssistant !== null
    && latestAssistant.providerID !== undefined
    && latestAssistant.providerID.length > 0
    && latestAssistant.modelID !== undefined
    && latestAssistant.modelID.length > 0
  )
    ? `${latestAssistant.providerID}/${latestAssistant.modelID}`
    : null;
  const sessionTitle = normalizeSessionTitle(session.title);

  return {
    id: session.id,
    turns,
    requests: [],
    createdAt: session.time.created,
    updatedAt: session.time.updated,
    title: sessionTitle,
    latestModel,
    cwd: session.directory,
    source: "opencode"
  };
}

function normalizeSessionTitle(title: string): string | null {
  return title.trim().length > 0 ? title : null;
}

function resolveLatestAssistantMessage(messages: OpenCodeMessage[]): OpenCodeMessage | null {
  let latestAssistant: OpenCodeMessage | null = null;

  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }

    if (latestAssistant === null) {
      latestAssistant = message;
      continue;
    }

    if (message.time.created > latestAssistant.time.created) {
      latestAssistant = message;
      continue;
    }

    if (
      message.time.created === latestAssistant.time.created &&
      message.id.localeCompare(latestAssistant.id) > 0
    ) {
      latestAssistant = message;
    }
  }

  return latestAssistant;
}
