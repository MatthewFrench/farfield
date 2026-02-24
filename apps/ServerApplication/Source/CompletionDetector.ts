import type { ThreadConversationState } from "@farfield/protocol";

type ThreadItem = ThreadConversationState["turns"][number]["items"][number];
type AgentMessageTurnItem = Extract<ThreadItem, { type: "agentMessage" }>;

export interface CompletionCandidate {
  threadId: string;
  turnId: string;
  marker: string;
  agentMessageId: string;
  agentText: string;
}

function isCompletedStatus(status: string): boolean {
  return status.toLowerCase().replaceAll("_", "-") === "completed";
}

function isAgentMessageItem(item: ThreadItem): item is AgentMessageTurnItem {
  return item.type === "agentMessage";
}

export class CompletionDetector {
  private readonly watermarks: Map<string, string>;

  public constructor(initialWatermarks: Map<string, string>) {
    this.watermarks = new Map(initialWatermarks);
  }

  public detect(threadId: string, conversationState: ThreadConversationState | null): CompletionCandidate | null {
    if (!conversationState) {
      return null;
    }

    const lastTurn = conversationState.turns[conversationState.turns.length - 1];
    if (!lastTurn) {
      return null;
    }

    if (!isCompletedStatus(lastTurn.status)) {
      return null;
    }

    const turnId = lastTurn.turnId ?? lastTurn.id ?? null;
    if (!turnId) {
      return null;
    }

    const lastAgentMessage = lastTurn.items.filter(isAgentMessageItem).slice(-1)[0];
    if (!lastAgentMessage) {
      return null;
    }

    const marker = `${threadId}:${turnId}:${lastAgentMessage.id}`;
    const previousMarker = this.watermarks.get(threadId);
    if (previousMarker === marker) {
      return null;
    }

    return {
      threadId,
      turnId,
      marker,
      agentMessageId: lastAgentMessage.id,
      agentText: lastAgentMessage.text
    };
  }

  public commit(threadId: string, marker: string): void {
    this.watermarks.set(threadId, marker);
  }

  public getWatermark(threadId: string): string | null {
    return this.watermarks.get(threadId) ?? null;
  }
}

