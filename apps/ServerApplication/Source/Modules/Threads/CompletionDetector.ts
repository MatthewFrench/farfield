import type { ThreadConversationState } from "@farfield/protocol";

const COMPLETED_STATUS_VALUE = "completed";
const COMPLETION_STATUS_UNDERSCORE_TOKEN = "_";
const COMPLETION_STATUS_DASH_TOKEN = "-";
const COMPLETION_MARKER_SEPARATOR = ":";

type ThreadTurn = ThreadConversationState["turns"][number];
type ThreadItem = ThreadTurn["items"][number];
type AgentMessageTurnItem = Extract<ThreadItem, { type: "agentMessage" }>;

export interface CompletionCandidate {
  threadId: string;
  turnId: string;
  marker: string;
  agentMessageId: string;
  agentText: string;
}

function isCompletedStatus(status: string): boolean {
  return normalizeCompletionStatus(status) === COMPLETED_STATUS_VALUE;
}

function normalizeCompletionStatus(status: string): string {
  return status
    .toLowerCase()
    .replaceAll(COMPLETION_STATUS_UNDERSCORE_TOKEN, COMPLETION_STATUS_DASH_TOKEN);
}

function isAgentMessageItem(item: ThreadItem): item is AgentMessageTurnItem {
  return item.type === "agentMessage";
}

function readMostRecentCompletedTurn(
  conversationState: ThreadConversationState,
): ThreadTurn | null {
  for (let index = conversationState.turns.length - 1; index >= 0; index -= 1) {
    const turn = conversationState.turns[index];
    if (!turn) {
      continue;
    }
    if (!isCompletedStatus(turn.status)) {
      continue;
    }
    return turn;
  }

  return null;
}

function readCompletionTurnId(turn: ThreadTurn): string | null {
  return turn.turnId ?? turn.id ?? null;
}

function readLastAgentMessage(turn: ThreadTurn): AgentMessageTurnItem | null {
  for (let index = turn.items.length - 1; index >= 0; index -= 1) {
    const candidate = turn.items[index];
    if (!candidate) {
      continue;
    }
    if (isAgentMessageItem(candidate)) {
      return candidate;
    }
  }
  return null;
}

function buildCompletionMarker(threadId: string, turnId: string, agentMessageId: string): string {
  return [threadId, turnId, agentMessageId].join(COMPLETION_MARKER_SEPARATOR);
}

export class CompletionDetector {
  private readonly watermarks: Map<string, string>;

  public constructor(initialWatermarks: Map<string, string>) {
    this.watermarks = new Map(initialWatermarks);
  }

  public detect(
    threadId: string,
    conversationState: ThreadConversationState | null,
  ): CompletionCandidate | null {
    if (!conversationState) {
      return null;
    }

    const mostRecentCompletedTurn = readMostRecentCompletedTurn(conversationState);
    if (!mostRecentCompletedTurn) {
      return null;
    }

    const turnId = readCompletionTurnId(mostRecentCompletedTurn);
    if (turnId === null || turnId.length === 0) {
      return null;
    }

    const lastAgentMessage = readLastAgentMessage(mostRecentCompletedTurn);
    if (!lastAgentMessage) {
      return null;
    }

    const marker = buildCompletionMarker(threadId, turnId, lastAgentMessage.id);
    const previousMarker = this.watermarks.get(threadId);
    if (previousMarker === marker) {
      return null;
    }

    return {
      threadId,
      turnId,
      marker,
      agentMessageId: lastAgentMessage.id,
      agentText: lastAgentMessage.text,
    };
  }

  public commit(threadId: string, marker: string): void {
    this.watermarks.set(threadId, marker);
  }

  public getWatermark(threadId: string): string | null {
    return this.watermarks.get(threadId) ?? null;
  }
}
