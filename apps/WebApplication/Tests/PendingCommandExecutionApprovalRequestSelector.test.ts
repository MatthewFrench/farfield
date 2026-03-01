import type { ThreadConversationState } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import {
  readActiveCommandExecutionApprovalRequest,
  readPendingCommandExecutionApprovalRequests,
} from "../Source/Features/Chat/DomainModel/PendingCommandExecutionApprovalRequestSelector";

function createCommandExecutionApprovalRequest(input: {
  id: number;
  completed?: boolean;
  command?: string | null;
}): ThreadConversationState["requests"][number] {
  return {
    method: "item/commandExecution/requestApproval",
    id: input.id,
    completed: input.completed,
    params: {
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: `item-${String(input.id)}`,
      command: input.command ?? "pwd",
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

describe("PendingCommandExecutionApprovalRequestSelector", () => {
  it("returns an empty list when no conversation state is available", () => {
    expect(readPendingCommandExecutionApprovalRequests(null)).toEqual([]);
    expect(readActiveCommandExecutionApprovalRequest(null)).toBeNull();
  });

  it("returns only pending command-execution approval requests", () => {
    const conversationState = createConversationState([
      createUserInputRequest({ id: 1 }),
      createCommandExecutionApprovalRequest({ id: 2 }),
      createCommandExecutionApprovalRequest({ id: 3, completed: true }),
      createCommandExecutionApprovalRequest({ id: 4, completed: false }),
    ]);

    const pendingRequests = readPendingCommandExecutionApprovalRequests(conversationState);
    expect(pendingRequests.map((request) => request.id)).toEqual([2, 4]);
  });

  it("reads the first pending command-execution approval request as active", () => {
    const conversationState = createConversationState([
      createCommandExecutionApprovalRequest({ id: 7, command: "git status" }),
      createCommandExecutionApprovalRequest({ id: 8, command: "ls" }),
    ]);

    const activeRequest = readActiveCommandExecutionApprovalRequest(conversationState);
    expect(activeRequest?.id).toBe(7);
    expect(activeRequest?.params.command).toBe("git status");
  });
});
