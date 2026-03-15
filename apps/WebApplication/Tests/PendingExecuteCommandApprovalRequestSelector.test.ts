import type { ThreadConversationState } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import {
  readActiveExecuteCommandApprovalRequest,
  readPendingExecuteCommandApprovalRequests,
} from "../Source/Features/Chat/DomainModel/PendingExecuteCommandApprovalRequestSelector";

function createExecuteCommandApprovalRequest(input: {
  id: number;
  completed?: boolean;
}): ThreadConversationState["requests"][number] {
  return {
    method: "execCommandApproval",
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

describe("PendingExecuteCommandApprovalRequestSelector", () => {
  it("returns an empty list when no conversation state is available", () => {
    expect(readPendingExecuteCommandApprovalRequests(null)).toEqual([]);
    expect(readActiveExecuteCommandApprovalRequest(null)).toBeNull();
  });

  it("returns only pending execute-command approval requests", () => {
    const conversationState = createConversationState([
      createUserInputRequest({ id: 1 }),
      createExecuteCommandApprovalRequest({ id: 2 }),
      createExecuteCommandApprovalRequest({ id: 3, completed: true }),
      createExecuteCommandApprovalRequest({ id: 4, completed: false }),
    ]);

    const pendingRequests = readPendingExecuteCommandApprovalRequests(conversationState);
    expect(pendingRequests.map((request) => request.id)).toEqual([2, 4]);
  });

  it("reads the first pending execute-command approval request as active", () => {
    const conversationState = createConversationState([
      createExecuteCommandApprovalRequest({ id: 7 }),
      createExecuteCommandApprovalRequest({ id: 8 }),
    ]);

    const activeRequest = readActiveExecuteCommandApprovalRequest(conversationState);
    expect(activeRequest?.id).toBe(7);
  });
});
