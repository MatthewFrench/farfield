import { describe, expect, it } from "vitest";
import type { ThreadConversationState } from "@farfield/protocol";
import { PendingUserInputRequestSelector } from "../Source/Features/Chat/DomainModel/PendingUserInputRequestSelector";

function createRequest(input: { id: number; completed?: boolean }): ThreadConversationState["requests"][number] {
  return {
    method: "item/tool/requestUserInput",
    id: input.id,
    completed: input.completed,
    params: {
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: `item-${String(input.id)}`,
      questions: [
        {
          id: `question-${String(input.id)}`,
          header: "Header",
          question: "Question",
          isOther: false,
          isSecret: false,
          options: [
            {
              label: "Option",
              description: "Option description"
            }
          ]
        }
      ]
    }
  };
}

function createConversationState(
  requests: ThreadConversationState["requests"]
): ThreadConversationState {
  return {
    id: "thread-1",
    turns: [],
    requests
  };
}

describe("PendingUserInputRequestSelector", () => {
  it("returns an empty list when no conversation state is available", () => {
    const selector = new PendingUserInputRequestSelector();

    const pendingRequests = selector.readPendingUserInputRequests(null);

    expect(pendingRequests).toEqual([]);
  });

  it("returns only requests that are not marked completed", () => {
    const selector = new PendingUserInputRequestSelector();
    const conversationState = createConversationState([
      createRequest({ id: 1 }),
      createRequest({ id: 2, completed: false }),
      createRequest({ id: 3, completed: true })
    ]);

    const pendingRequests = selector.readPendingUserInputRequests(conversationState);

    expect(pendingRequests.map((request) => request.id)).toEqual([1, 2]);
  });
});
