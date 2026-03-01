import {
  ChatGptAuthTokensRefreshRequestMethod,
  type ThreadConversationRequest,
  type ThreadConversationState,
} from "@farfield/protocol";

export type PendingAuthTokenRefreshRequest = ThreadConversationRequest & {
  method: typeof ChatGptAuthTokensRefreshRequestMethod;
  params: {
    reason: "unauthorized";
    previousAccountId?: string | null;
  };
};

function isPendingAuthTokenRefreshRequest(
  request: ThreadConversationRequest,
): request is PendingAuthTokenRefreshRequest {
  return request.method === ChatGptAuthTokensRefreshRequestMethod && request.completed !== true;
}

export function readPendingAuthTokenRefreshRequests(
  conversationState: ThreadConversationState | null,
): PendingAuthTokenRefreshRequest[] {
  if (!conversationState) {
    return [];
  }

  return conversationState.requests.filter((request) => isPendingAuthTokenRefreshRequest(request));
}

export function readActiveAuthTokenRefreshRequest(
  conversationState: ThreadConversationState | null,
): PendingAuthTokenRefreshRequest | null {
  const pendingRequests = readPendingAuthTokenRefreshRequests(conversationState);
  return pendingRequests[0] ?? null;
}
