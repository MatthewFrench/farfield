import type { ThreadConversationState, UserInputRequest } from "@farfield/protocol";

export type PendingUserInputRequest = UserInputRequest;

export class PendingUserInputRequestSelector {
  public readPendingUserInputRequests(
    conversationState: ThreadConversationState | null
  ): PendingUserInputRequest[] {
    if (!conversationState) {
      return [];
    }

    return conversationState.requests.filter((request) => request.completed !== true);
  }
}
