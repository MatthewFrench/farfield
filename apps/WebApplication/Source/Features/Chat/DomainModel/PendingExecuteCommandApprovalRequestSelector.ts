import {
  type ExecuteCommandApprovalRequest,
  ExecuteCommandApprovalRequestMethod,
  type ThreadConversationRequest,
  type ThreadConversationState,
} from "@farfield/protocol";

export type PendingExecuteCommandApprovalRequest = ExecuteCommandApprovalRequest;

function isPendingExecuteCommandApprovalRequest(
  request: ThreadConversationRequest,
): request is PendingExecuteCommandApprovalRequest {
  return request.method === ExecuteCommandApprovalRequestMethod && request.completed !== true;
}

export function readPendingExecuteCommandApprovalRequests(
  conversationState: ThreadConversationState | null,
): PendingExecuteCommandApprovalRequest[] {
  if (!conversationState) {
    return [];
  }

  return conversationState.requests.filter((request) =>
    isPendingExecuteCommandApprovalRequest(request),
  );
}

export function readActiveExecuteCommandApprovalRequest(
  conversationState: ThreadConversationState | null,
): PendingExecuteCommandApprovalRequest | null {
  const pendingRequests = readPendingExecuteCommandApprovalRequests(conversationState);
  return pendingRequests[0] ?? null;
}
