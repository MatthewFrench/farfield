import {
  type ApplyPatchApprovalRequest,
  ApplyPatchApprovalRequestMethod,
  type ThreadConversationRequest,
  type ThreadConversationState,
} from "@farfield/protocol";

export type PendingApplyPatchApprovalRequest = ApplyPatchApprovalRequest;

function isPendingApplyPatchApprovalRequest(
  request: ThreadConversationRequest,
): request is PendingApplyPatchApprovalRequest {
  return request.method === ApplyPatchApprovalRequestMethod && request.completed !== true;
}

export function readPendingApplyPatchApprovalRequests(
  conversationState: ThreadConversationState | null,
): PendingApplyPatchApprovalRequest[] {
  if (!conversationState) {
    return [];
  }

  return conversationState.requests.filter((request) =>
    isPendingApplyPatchApprovalRequest(request),
  );
}

export function readActiveApplyPatchApprovalRequest(
  conversationState: ThreadConversationState | null,
): PendingApplyPatchApprovalRequest | null {
  const pendingRequests = readPendingApplyPatchApprovalRequests(conversationState);
  return pendingRequests[0] ?? null;
}
