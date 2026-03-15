import type { ThreadConversationState } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import {
  readActiveApplyPatchApprovalRequest,
  readPendingApplyPatchApprovalRequests,
} from "../Source/Features/Chat/DomainModel/PendingApplyPatchApprovalRequestSelector";

function createApplyPatchApprovalRequest(input: {
  id: number;
  completed?: boolean;
}): ThreadConversationState["requests"][number] {
  return {
    method: "applyPatchApproval",
    id: input.id,
    completed: input.completed,
    params: {
      callId: `call-${String(input.id)}`,
    },
  };
}

function createUserInputRequest(input: {
  id: number;
  completed?: boolean;
}): ThreadConversationState["requests"][number] {
  return {
    method: "item/tool/requestUserInput",
    id: input.id,
    completed: input.completed,
    params: {
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: `item-${String(input.id)}`,
      questions: [],
    },
  };
}

function createConversationState(
  requests: ThreadConversationState["requests"],
): ThreadConversationState {
  return {
    id: "thread-1",
    turns: [],
    requests,
  };
}

describe("PendingApplyPatchApprovalRequestSelector", () => {
  it("returns an empty list when no conversation state is available", () => {
    expect(readPendingApplyPatchApprovalRequests(null)).toEqual([]);
    expect(readActiveApplyPatchApprovalRequest(null)).toBeNull();
  });

  it("returns only pending apply-patch approval requests", () => {
    const conversationState = createConversationState([
      createUserInputRequest({ id: 1 }),
      createApplyPatchApprovalRequest({ id: 2 }),
      createApplyPatchApprovalRequest({ id: 3, completed: true }),
      createApplyPatchApprovalRequest({ id: 4, completed: false }),
    ]);

    const pendingRequests = readPendingApplyPatchApprovalRequests(conversationState);
    expect(pendingRequests.map((request) => request.id)).toEqual([2, 4]);
  });

  it("reads the first pending apply-patch approval request as active", () => {
    const conversationState = createConversationState([
      createApplyPatchApprovalRequest({ id: 7 }),
      createApplyPatchApprovalRequest({ id: 8 }),
    ]);

    const activeRequest = readActiveApplyPatchApprovalRequest(conversationState);
    expect(activeRequest?.id).toBe(7);
  });
});
