import {
  type ThreadConversationRequest,
  type ThreadConversationState,
  type ToolCallRequest,
  ToolCallRequestMethod,
} from "@farfield/protocol";

export type PendingToolCallRequest = ToolCallRequest;

function isPendingToolCallRequest(
  request: ThreadConversationRequest,
): request is PendingToolCallRequest {
  return request.method === ToolCallRequestMethod && request.completed !== true;
}

export function readPendingToolCallRequests(
  conversationState: ThreadConversationState | null,
): PendingToolCallRequest[] {
  if (!conversationState) {
    return [];
  }

  return conversationState.requests.filter((request) => isPendingToolCallRequest(request));
}

export function readActiveToolCallRequest(
  conversationState: ThreadConversationState | null,
): PendingToolCallRequest | null {
  const pendingRequests = readPendingToolCallRequests(conversationState);
  return pendingRequests[0] ?? null;
}
