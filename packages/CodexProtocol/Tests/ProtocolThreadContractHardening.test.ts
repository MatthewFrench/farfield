import { describe, expect, it } from "vitest";
import {
  parseThreadConversationState,
  UserInputRequestMethod
} from "../Source/Index.js";

describe("codex-protocol thread contract hardening", () => {
  it("defaults requests to an empty list when omitted", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: []
    });

    expect(parsed.requests).toEqual([]);
  });

  it("parses turn params with nullable collaboration and schema payload fields", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          params: {
            threadId: "thread-123",
            input: [
              {
                type: "text",
                text: "hello"
              }
            ],
            collaborationMode: {
              mode: "delegate",
              settings: {
                model: null,
                reasoning_effort: null,
                developer_instructions: null
              }
            },
            personality: null,
            outputSchema: null
          },
          items: []
        }
      ]
    });

    const turn = parsed.turns[0];
    expect(turn?.params?.collaborationMode?.mode).toBe("delegate");
    expect(turn?.params?.personality).toBeNull();
    expect(turn?.params?.outputSchema).toBeNull();
  });

  it("rejects todo-list plan items with unsupported status values", () => {
    expect(() =>
      parseThreadConversationState({
        id: "thread-123",
        turns: [
          {
            status: "inProgress",
            items: [
              {
                id: "todo-1",
                type: "todo-list",
                plan: [
                  {
                    step: "do work",
                    status: "done"
                  }
                ]
              }
            ]
          }
        ]
      })
    ).toThrowError(/ThreadConversationState did not match expected schema/);
  });

  it("rejects collaboration tool call agent states with unsupported status values", () => {
    expect(() =>
      parseThreadConversationState({
        id: "thread-123",
        turns: [
          {
            status: "completed",
            items: [
              {
                id: "item-collab",
                type: "collabToolCall",
                tool: "sendInput",
                status: "inProgress",
                senderThreadId: "thread-123",
                receiverThreadIds: ["thread-124"],
                agentsStates: {
                  "thread-124": {
                    status: "paused"
                  }
                }
              }
            ]
          }
        ]
      })
    ).toThrowError(/ThreadConversationState did not match expected schema/);
  });

  it("rejects requests entries with invalid method tokens", () => {
    expect(() =>
      parseThreadConversationState({
        id: "thread-123",
        turns: [],
        requests: [
          {
            method: "item/tool/invalid",
            id: 7,
            params: {
              threadId: "thread-123",
              turnId: "turn-123",
              itemId: "item-123",
              questions: []
            }
          }
        ]
      })
    ).toThrowError(/ThreadConversationState did not match expected schema/);
  });

  it("accepts requests entries with the canonical method token", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [],
      requests: [
        {
          method: UserInputRequestMethod,
          id: 7,
          params: {
            threadId: "thread-123",
            turnId: "turn-123",
            itemId: "item-123",
            questions: []
          }
        }
      ]
    });

    expect(parsed.requests[0]?.method).toBe(UserInputRequestMethod);
  });
});
