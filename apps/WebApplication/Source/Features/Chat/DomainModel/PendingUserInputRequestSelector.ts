import {
  type ThreadConversationRequest,
  type ThreadConversationState,
  type UserInputRequest,
  UserInputRequestMethod,
} from "@farfield/protocol";

export type PendingUserInputRequest = UserInputRequest;

export class PendingUserInputRequestSelector {
  public readPendingUserInputRequests(
    conversationState: ThreadConversationState | null,
  ): PendingUserInputRequest[] {
    if (!conversationState) {
      return [];
    }

    return conversationState.requests.filter((request) => this.isPendingUserInputRequest(request));
  }

  private isPendingUserInputRequest(
    request: ThreadConversationRequest,
  ): request is PendingUserInputRequest {
    return request.method === UserInputRequestMethod && request.completed !== true;
  }
}
