import type { AgentThreadConversationState } from "../../Agents/Types.js";

const THREAD_FORK_FROM_MESSAGE_NOT_FOUND_PREFIX =
  "Cannot fork thread from message: message was not found in the thread history";

/**
 * Owns branch-point resolution for Farfield's message-scoped fork operation.
 * The selected message keeps its containing turn in the forked thread, so the
 * rollback count equals the number of turns after the matched turn.
 */
export class ThreadForkFromMessageRollbackCountError extends Error {
  public readonly messageId: string;

  public constructor(messageId: string) {
    super(`${THREAD_FORK_FROM_MESSAGE_NOT_FOUND_PREFIX}: ${messageId}`);
    this.name = "ThreadForkFromMessageRollbackCountError";
    this.messageId = messageId;
  }
}

export function readForkThreadFromMessageRollbackCount(
  thread: AgentThreadConversationState,
  messageId: string,
): number {
  const totalTurnCount = thread.turns.length;

  for (let turnIndex = 0; turnIndex < totalTurnCount; turnIndex += 1) {
    const turn = thread.turns[turnIndex];
    if (turn === undefined) {
      continue;
    }

    for (const item of turn.items) {
      if (item.id === messageId) {
        return totalTurnCount - (turnIndex + 1);
      }
    }
  }

  throw new ThreadForkFromMessageRollbackCountError(messageId);
}
