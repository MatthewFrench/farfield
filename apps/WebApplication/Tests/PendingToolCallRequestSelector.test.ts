import type { ThreadConversationState } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import {
  readActiveToolCallRequest,
  readPendingToolCallRequests,
} from "../Source/Features/Chat/DomainModel/PendingToolCallRequestSelector";

function createToolCallRequest(input: {
  id: number;
  completed?: boolean;
  tool?: string;
}): ThreadConversationState["requests"][number] {
  return {
    method: "item/tool/call",
    id: input.id,
    completed: input.completed,
    params: {
      threadId: "thread-1",
      turnId: "turn-1",
      callId: `call-${String(input.id)}`,
      tool: input.tool ?? "web.search",
      arguments: {
        query: "example",
      },
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

describe("PendingToolCallRequestSelector", () => {
  it("returns an empty list when no conversation state is available", () => {
    expect(readPendingToolCallRequests(null)).toEqual([]);
    expect(readActiveToolCallRequest(null)).toBeNull();
  });

  it("returns only pending tool-call requests", () => {
    const conversationState = createConversationState([
      createUserInputRequest({ id: 1 }),
      createToolCallRequest({ id: 2 }),
      createToolCallRequest({ id: 3, completed: true }),
      createToolCallRequest({ id: 4, completed: false }),
    ]);

    const pendingRequests = readPendingToolCallRequests(conversationState);
    expect(pendingRequests.map((request) => request.id)).toEqual([2, 4]);
  });

  it("reads the first pending tool-call request as active", () => {
    const conversationState = createConversationState([
      createToolCallRequest({ id: 7, tool: "files.search" }),
      createToolCallRequest({ id: 8, tool: "git.diff" }),
    ]);

    const activeRequest = readActiveToolCallRequest(conversationState);
    expect(activeRequest?.id).toBe(7);
    expect(activeRequest?.params.tool).toBe("files.search");
  });
});
