import { describe, expect, it } from "vitest";
import {
  ChatGptAuthTokensRefreshRequestMethod,
  parseThreadConversationRequestResponse,
  parseThreadConversationState,
  UserInputRequestMethod,
} from "../Source/Index.js";

describe("codex-protocol thread contract hardening", () => {
  it("defaults requests to an empty list when omitted", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [],
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
                text: "hello",
              },
            ],
            collaborationMode: {
              mode: "delegate",
              settings: {
                model: null,
                reasoning_effort: null,
                developer_instructions: null,
              },
            },
            personality: null,
            outputSchema: null,
          },
          items: [],
        },
      ],
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
                    status: "done",
                  },
                ],
              },
            ],
          },
        ],
      }),
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
                    status: "paused",
                  },
                },
              },
            ],
          },
        ],
      }),
    ).toThrowError(/ThreadConversationState did not match expected schema/);
  });

  it("parses tool call items with shared lifecycle status literals", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-mcp",
              type: "mcpToolCall",
              server: "filesystem",
              tool: "read_file",
              status: "failed",
              arguments: { path: "README.md" },
            },
            {
              id: "item-collab",
              type: "collabToolCall",
              tool: "wait",
              status: "failed",
              senderThreadId: "thread-123",
              receiverThreadIds: ["thread-124"],
              agentsStates: {
                "thread-124": {
                  status: "running",
                },
              },
            },
          ],
        },
      ],
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("mcpToolCall");
    expect(parsed.turns[0]?.items[1]?.type).toBe("collabToolCall");
  });

  it("rejects mcp tool call items with unsupported lifecycle status values", () => {
    expect(() =>
      parseThreadConversationState({
        id: "thread-123",
        turns: [
          {
            status: "completed",
            items: [
              {
                id: "item-mcp",
                type: "mcpToolCall",
                server: "filesystem",
                tool: "read_file",
                status: "paused",
                arguments: { path: "README.md" },
              },
            ],
          },
        ],
      }),
    ).toThrowError(/ThreadConversationState did not match expected schema/);
  });

  it("rejects collaboration tool call items with unsupported tool values", () => {
    expect(() =>
      parseThreadConversationState({
        id: "thread-123",
        turns: [
          {
            status: "completed",
            items: [
              {
                id: "item-collab",
                type: "collabAgentToolCall",
                tool: "delegateWork",
                status: "inProgress",
                senderThreadId: "thread-123",
                receiverThreadIds: ["thread-124"],
                agentsStates: {
                  "thread-124": {
                    status: "running",
                  },
                },
              },
            ],
          },
        ],
      }),
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
              questions: [],
            },
          },
        ],
      }),
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
            questions: [],
          },
        },
      ],
    });

    expect(parsed.requests[0]?.method).toBe(UserInputRequestMethod);
  });

  it("accepts command execution approval requests in conversation requests", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [],
      requests: [
        {
          method: "item/commandExecution/requestApproval",
          id: 9,
          params: {
            threadId: "thread-123",
            turnId: "turn-123",
            itemId: "item-9",
            command: "echo hello",
            cwd: "/tmp",
          },
        },
      ],
    });

    expect(parsed.requests[0]?.method).toBe("item/commandExecution/requestApproval");
  });

  it("accepts typed thread request-response envelopes for approval and tool-call methods", () => {
    const commandResponse = parseThreadConversationRequestResponse({
      method: "item/commandExecution/requestApproval",
      payload: {
        decision: "acceptForSession",
      },
    });
    const fileChangeResponse = parseThreadConversationRequestResponse({
      method: "item/fileChange/requestApproval",
      payload: {
        decision: "decline",
      },
    });
    const toolCallResponse = parseThreadConversationRequestResponse({
      method: "item/tool/call",
      payload: {
        contentItems: [
          {
            type: "inputText",
            text: "result",
          },
        ],
        success: true,
      },
    });
    const refreshResponse = parseThreadConversationRequestResponse({
      method: ChatGptAuthTokensRefreshRequestMethod,
      payload: {
        accessToken: "token-1",
        chatgptAccountId: "account-1",
        chatgptPlanType: null,
      },
    });
    const applyPatchApprovalResponse = parseThreadConversationRequestResponse({
      method: "applyPatchApproval",
      payload: {
        decision: "approved",
      },
    });
    const executeCommandApprovalResponse = parseThreadConversationRequestResponse({
      method: "execCommandApproval",
      payload: {
        decision: "approved",
      },
    });

    expect(commandResponse.method).toBe("item/commandExecution/requestApproval");
    expect(fileChangeResponse.method).toBe("item/fileChange/requestApproval");
    expect(toolCallResponse.method).toBe("item/tool/call");
    expect(refreshResponse.method).toBe(ChatGptAuthTokensRefreshRequestMethod);
    expect(applyPatchApprovalResponse.method).toBe("applyPatchApproval");
    expect(executeCommandApprovalResponse.method).toBe("execCommandApproval");
  });

  it("rejects thread request-response envelopes when payload does not match method schema", () => {
    expect(() =>
      parseThreadConversationRequestResponse({
        method: "item/fileChange/requestApproval",
        payload: {
          answers: {},
        },
      }),
    ).toThrowError(/ThreadConversationRequestResponse did not match expected schema/);
  });
});
