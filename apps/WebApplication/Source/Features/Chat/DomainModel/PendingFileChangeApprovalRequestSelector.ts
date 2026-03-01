import {
  type FileChangeApprovalRequest,
  FileChangeApprovalRequestMethod,
  type ThreadConversationRequest,
  type ThreadConversationState,
} from "@farfield/protocol";

export type PendingFileChangeApprovalRequest = FileChangeApprovalRequest;

function isPendingFileChangeApprovalRequest(
  request: ThreadConversationRequest,
): request is PendingFileChangeApprovalRequest {
  return request.method === FileChangeApprovalRequestMethod && request.completed !== true;
}

export function readPendingFileChangeApprovalRequests(
  conversationState: ThreadConversationState | null,
): PendingFileChangeApprovalRequest[] {
  if (!conversationState) {
    return [];
  }

  return conversationState.requests.filter((request) =>
    isPendingFileChangeApprovalRequest(request),
  );
}

export function readActiveFileChangeApprovalRequest(
  conversationState: ThreadConversationState | null,
): PendingFileChangeApprovalRequest | null {
  const pendingRequests = readPendingFileChangeApprovalRequests(conversationState);
  return pendingRequests[0] ?? null;
}
