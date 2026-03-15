import {
  type CommandExecutionApprovalRequest,
  CommandExecutionApprovalRequestMethod,
  type ThreadConversationRequest,
  type ThreadConversationState,
} from "@farfield/protocol";

export type PendingCommandExecutionApprovalRequest = CommandExecutionApprovalRequest;

function isPendingCommandExecutionApprovalRequest(
  request: ThreadConversationRequest,
): request is PendingCommandExecutionApprovalRequest {
  return request.method === CommandExecutionApprovalRequestMethod && request.completed !== true;
}

export function readPendingCommandExecutionApprovalRequests(
  conversationState: ThreadConversationState | null,
): PendingCommandExecutionApprovalRequest[] {
  if (!conversationState) {
    return [];
  }

  return conversationState.requests.filter((request) =>
    isPendingCommandExecutionApprovalRequest(request),
  );
}

export function readActiveCommandExecutionApprovalRequest(
  conversationState: ThreadConversationState | null,
): PendingCommandExecutionApprovalRequest | null {
  const pendingRequests = readPendingCommandExecutionApprovalRequests(conversationState);
  return pendingRequests[0] ?? null;
}
