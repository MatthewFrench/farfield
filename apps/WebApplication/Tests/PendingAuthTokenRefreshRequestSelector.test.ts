import type { ThreadConversationState } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import {
  readActiveAuthTokenRefreshRequest,
  readPendingAuthTokenRefreshRequests,
} from "../Source/Features/Chat/DomainModel/PendingAuthTokenRefreshRequestSelector";

function createAuthTokenRefreshRequest(input: {
  id: number;
  completed?: boolean;
  previousAccountId?: string | null;
}): ThreadConversationState["requests"][number] {
  return {
    method: "account/chatgptAuthTokens/refresh",
    id: input.id,
    completed: input.completed,
    params: {
      reason: "unauthorized",
      previousAccountId: input.previousAccountId ?? null,
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

describe("PendingAuthTokenRefreshRequestSelector", () => {
  it("returns an empty list when no conversation state is available", () => {
    expect(readPendingAuthTokenRefreshRequests(null)).toEqual([]);
    expect(readActiveAuthTokenRefreshRequest(null)).toBeNull();
  });

  it("returns only pending auth-token-refresh requests", () => {
    const conversationState = createConversationState([
      createUserInputRequest({ id: 1 }),
      createAuthTokenRefreshRequest({ id: 2 }),
      createAuthTokenRefreshRequest({ id: 3, completed: true }),
      createAuthTokenRefreshRequest({ id: 4, completed: false }),
    ]);

    const pendingRequests = readPendingAuthTokenRefreshRequests(conversationState);
    expect(pendingRequests.map((request) => request.id)).toEqual([2, 4]);
  });

  it("reads the first pending auth-token-refresh request as active", () => {
    const conversationState = createConversationState([
      createAuthTokenRefreshRequest({ id: 7, previousAccountId: "workspace-a" }),
      createAuthTokenRefreshRequest({ id: 8, previousAccountId: "workspace-b" }),
    ]);

    const activeRequest = readActiveAuthTokenRefreshRequest(conversationState);
    expect(activeRequest?.id).toBe(7);
    expect(activeRequest?.params.previousAccountId).toBe("workspace-a");
  });
});
