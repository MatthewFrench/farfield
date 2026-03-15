import { type ConversationTurn } from "@/Features/Chat/DomainModel/ConversationItemFlattener";

const INTERRUPTED_TURN_STATUS = "interrupted";
const USER_MESSAGE_ITEM_TYPE = "userMessage";
const STEERING_USER_MESSAGE_ITEM_TYPE = "steeringUserMessage";
const USER_INPUT_RESPONSE_ITEM_TYPE = "userInputResponse";

export interface InterruptedTurnNotice {
  title: string;
  message: string;
}

const INTERRUPTED_TURN_NOTICE: InterruptedTurnNotice = {
  title: "Turn Interrupted",
  message: "This turn ended before the agent produced a response. Send another message to retry.",
};

function hasUserAuthoredText(turn: ConversationTurn): boolean {
  return turn.items.some((item) => {
    switch (item.type) {
      case USER_MESSAGE_ITEM_TYPE:
      case STEERING_USER_MESSAGE_ITEM_TYPE:
        return item.content.some((part) => part.type === "text" && part.text.trim().length > 0);
      default:
        return false;
    }
  });
}

function hasAgentOutput(turn: ConversationTurn): boolean {
  return turn.items.some((item) => {
    switch (item.type) {
      case USER_MESSAGE_ITEM_TYPE:
      case STEERING_USER_MESSAGE_ITEM_TYPE:
      case USER_INPUT_RESPONSE_ITEM_TYPE:
        return false;
      default:
        return true;
    }
  });
}

/**
 * Derives a focused UX notice for interrupted turns that contain only user-authored input.
 * Once any agent-owned output item exists, the conversation content itself explains the turn.
 */
export function readInterruptedTurnNotice(
  turns: readonly ConversationTurn[],
): InterruptedTurnNotice | null {
  const latestTurn = turns[turns.length - 1];
  if (!latestTurn) {
    return null;
  }
  if (latestTurn.status !== INTERRUPTED_TURN_STATUS) {
    return null;
  }
  if (!hasUserAuthoredText(latestTurn)) {
    return null;
  }
  if (hasAgentOutput(latestTurn)) {
    return null;
  }
  return INTERRUPTED_TURN_NOTICE;
}
