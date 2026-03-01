import type { ThreadConversationState } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import {
  readActiveFileChangeApprovalRequest,
  readPendingFileChangeApprovalRequests,
} from "../Source/Features/Chat/DomainModel/PendingFileChangeApprovalRequestSelector";

function createFileChangeApprovalRequest(input: {
  id: number;
  completed?: boolean;
  grantRoot?: string | null;
}): ThreadConversationState["requests"][number] {
  return {
    method: "item/fileChange/requestApproval",
    id: input.id,
    completed: input.completed,
    params: {
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: `item-${String(input.id)}`,
      grantRoot: input.grantRoot ?? null,
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

describe("PendingFileChangeApprovalRequestSelector", () => {
  it("returns an empty list when no conversation state is available", () => {
    expect(readPendingFileChangeApprovalRequests(null)).toEqual([]);
    expect(readActiveFileChangeApprovalRequest(null)).toBeNull();
  });

  it("returns only pending file-change approval requests", () => {
    const conversationState = createConversationState([
      createUserInputRequest({ id: 1 }),
      createFileChangeApprovalRequest({ id: 2 }),
      createFileChangeApprovalRequest({ id: 3, completed: true }),
      createFileChangeApprovalRequest({ id: 4, completed: false }),
    ]);

    const pendingRequests = readPendingFileChangeApprovalRequests(conversationState);
    expect(pendingRequests.map((request) => request.id)).toEqual([2, 4]);
  });

  it("reads the first pending file-change approval request as active", () => {
    const conversationState = createConversationState([
      createFileChangeApprovalRequest({ id: 7, grantRoot: "/workspace" }),
      createFileChangeApprovalRequest({ id: 8, grantRoot: "/tmp" }),
    ]);

    const activeRequest = readActiveFileChangeApprovalRequest(conversationState);
    expect(activeRequest?.id).toBe(7);
    expect(activeRequest?.params.grantRoot).toBe("/workspace");
  });
});
