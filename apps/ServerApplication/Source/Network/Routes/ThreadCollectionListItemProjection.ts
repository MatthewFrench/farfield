import type { FarfieldThreadListItem, ThreadConversationState } from "@farfield/protocol";
import type { AgentId } from "../../Agents/Types.js";

const USER_MESSAGE_ITEM_TYPE = "userMessage";
const USER_MESSAGE_TEXT_CONTENT_TYPE = "text";
const REMOVED_PROJECT_STATE = "removed";

export interface ThreadCollectionListItemProjectionSource {
  id: string;
  preview?: string | undefined;
  createdAt: number;
  updatedAt: number;
  cwd?: string | undefined;
  path?: string | null | undefined;
  threadName?: string | null | undefined;
  title?: string | null | undefined;
  name?: string | null | undefined;
  turns?: ThreadConversationState["turns"] | undefined;
  removed?: boolean | undefined;
  projectRemoved?: boolean | undefined;
  projectState?: "active" | "removed" | undefined;
  hasUnreadTurn?: boolean | undefined;
  isLoadedInMemory?: boolean | undefined;
}

interface ProjectThreadListItemInput {
  thread: ThreadCollectionListItemProjectionSource;
  agentId: AgentId;
  isLoadedInMemory: boolean | undefined;
}

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return undefined;
  }
  return trimmedValue;
}

function readThreadDisplayName(
  thread: ThreadCollectionListItemProjectionSource,
): string | undefined {
  return (
    normalizeOptionalText(thread.threadName) ??
    normalizeOptionalText(thread.title) ??
    normalizeOptionalText(thread.name)
  );
}

function readThreadPreview(thread: ThreadCollectionListItemProjectionSource): string {
  return normalizeOptionalText(thread.preview) ?? readLastUserMessage(thread.turns) ?? "";
}

function readLatestTurnItemType(
  turns: ThreadConversationState["turns"] | undefined,
): string | undefined {
  if (turns === undefined || turns.length === 0) {
    return undefined;
  }

  for (let turnIndex = turns.length - 1; turnIndex >= 0; turnIndex -= 1) {
    const turn = turns[turnIndex];
    if (turn === undefined) {
      continue;
    }
    for (let itemIndex = turn.items.length - 1; itemIndex >= 0; itemIndex -= 1) {
      const item = turn.items[itemIndex];
      if (item === undefined) {
        continue;
      }
      return item.type;
    }
  }

  return undefined;
}

function readLastUserMessage(
  turns: ThreadConversationState["turns"] | undefined,
): string | undefined {
  if (turns === undefined || turns.length === 0) {
    return undefined;
  }

  for (let turnIndex = turns.length - 1; turnIndex >= 0; turnIndex -= 1) {
    const turn = turns[turnIndex];
    if (turn === undefined) {
      continue;
    }
    for (let itemIndex = turn.items.length - 1; itemIndex >= 0; itemIndex -= 1) {
      const item = turn.items[itemIndex];
      if (item === undefined || item.type !== USER_MESSAGE_ITEM_TYPE) {
        continue;
      }

      const textParts: string[] = [];
      for (const contentItem of item.content ?? []) {
        if (contentItem.type !== USER_MESSAGE_TEXT_CONTENT_TYPE || contentItem.text === undefined) {
          continue;
        }
        const normalizedText = normalizeOptionalText(contentItem.text);
        if (normalizedText !== undefined) {
          textParts.push(normalizedText);
        }
      }

      const combinedText = textParts.join(" ").trim();
      if (combinedText.length > 0) {
        return combinedText;
      }
    }
  }

  return undefined;
}

function readThreadLatestActivityIsUserMessage(
  thread: ThreadCollectionListItemProjectionSource,
): boolean {
  return readLatestTurnItemType(thread.turns) === USER_MESSAGE_ITEM_TYPE;
}

function readThreadProjectRemovedState(thread: ThreadCollectionListItemProjectionSource): boolean {
  return (
    thread.projectRemoved === true ||
    thread.removed === true ||
    thread.projectState === REMOVED_PROJECT_STATE
  );
}

/**
 * Projects broad adapter list items into the Farfield thread-list contract consumed by the
 * sidebar/thread-list feature. The projection drops full turn payloads and transport-only fields
 * while preserving thread-label and unread semantics needed by list owners.
 */
export function projectThreadListItemFromAgentThreadListItem(
  input: ProjectThreadListItemInput,
): FarfieldThreadListItem {
  return {
    id: input.thread.id,
    preview: readThreadPreview(input.thread),
    displayName: readThreadDisplayName(input.thread),
    lastUserMessage: readLastUserMessage(input.thread.turns),
    latestActivityIsUserMessage: readThreadLatestActivityIsUserMessage(input.thread),
    createdAt: input.thread.createdAt,
    updatedAt: input.thread.updatedAt,
    cwd: input.thread.cwd,
    path: input.thread.path,
    agentId: input.agentId,
    hasUnreadTurn: input.thread.hasUnreadTurn ?? null,
    isLoadedInMemory: input.isLoadedInMemory ?? input.thread.isLoadedInMemory,
    isProjectRemoved: readThreadProjectRemovedState(input.thread),
  };
}
