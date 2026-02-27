import { describe, expect, it } from "vitest";
import {
  parseThreadConversationState,
  parseThreadStreamStateChangedBroadcast,
} from "../Source/Index.js";

describe("codex-protocol thread core schemas", () => {
  it("parses a valid thread stream patches broadcast", () => {
    const parsed = parseThreadStreamStateChangedBroadcast({
      type: "broadcast",
      method: "thread-stream-state-changed",
      sourceClientId: "client-123",
      version: 4,
      params: {
        conversationId: "thread-123",
        type: "thread-stream-state-changed",
        version: 4,
        change: {
          type: "patches",
          patches: [
            {
              op: "add",
              path: ["requests", 0],
              value: {
                method: "item/tool/requestUserInput",
                id: 9,
                params: {
                  threadId: "thread-123",
                  turnId: "turn-123",
                  itemId: "item-123",
                  questions: [
                    {
                      id: "question_a",
                      header: "Scope",
                      question: "Choose one",
                      isOther: true,
                      isSecret: false,
                      options: [
                        {
                          label: "Option A",
                          description: "Description A",
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    });

    expect(parsed.params.change.type).toBe("patches");
  });

  it("parses snapshot broadcast with null title and empty model defaults", () => {
    const parsed = parseThreadStreamStateChangedBroadcast({
      type: "broadcast",
      method: "thread-stream-state-changed",
      sourceClientId: "client-123",
      version: 4,
      params: {
        conversationId: "thread-123",
        type: "thread-stream-state-changed",
        version: 4,
        change: {
          type: "snapshot",
          conversationState: {
            id: "thread-123",
            turns: [],
            requests: [],
            createdAt: 1700000000,
            updatedAt: 1700000000,
            title: null,
            latestModel: "",
            latestReasoningEffort: null,
            previousTurnModel: null,
            latestCollaborationMode: {
              mode: "default",
              settings: {
                model: "",
                reasoning_effort: null,
                developer_instructions: null,
              },
            },
            hasUnreadTurn: false,
            rolloutPath: "/tmp/rollout.jsonl",
            gitInfo: null,
            resumeState: "resumed",
            latestTokenUsageInfo: null,
            cwd: "/tmp/workspace",
            source: "vscode",
          },
        },
      },
    });

    expect(parsed.params.change.type).toBe("snapshot");
  });

  it("parses snapshot broadcast when turn includes error item", () => {
    const parsed = parseThreadStreamStateChangedBroadcast({
      type: "broadcast",
      method: "thread-stream-state-changed",
      sourceClientId: "client-123",
      version: 4,
      params: {
        conversationId: "thread-123",
        type: "thread-stream-state-changed",
        version: 4,
        change: {
          type: "snapshot",
          conversationState: {
            id: "thread-123",
            turns: [
              {
                status: "completed",
                items: [
                  {
                    id: "err-1",
                    type: "error",
                    message: "contextWindowExceeded",
                    willRetry: false,
                    errorInfo: "contextWindowExceeded",
                    additionalDetails: null,
                  },
                ],
              },
            ],
            requests: [],
          },
        },
      },
    });

    expect(parsed.params.change.type).toBe("snapshot");
  });

  it("parses snapshot broadcast when conversation requests include command approvals", () => {
    const parsed = parseThreadStreamStateChangedBroadcast({
      type: "broadcast",
      method: "thread-stream-state-changed",
      sourceClientId: "client-123",
      version: 4,
      params: {
        conversationId: "thread-123",
        type: "thread-stream-state-changed",
        version: 4,
        change: {
          type: "snapshot",
          conversationState: {
            id: "thread-123",
            turns: [],
            requests: [
              {
                method: "item/commandExecution/requestApproval",
                id: 7,
                params: {
                  threadId: "thread-123",
                  turnId: "turn-7",
                  itemId: "item-7",
                  command: "echo hello",
                  cwd: "/tmp",
                },
              },
            ],
          },
        },
      },
    });

    expect(parsed.params.change.type).toBe("snapshot");
  });

  it("parses snapshot broadcast when error item errorInfo is structured data", () => {
    const parsed = parseThreadStreamStateChangedBroadcast({
      type: "broadcast",
      method: "thread-stream-state-changed",
      sourceClientId: "client-123",
      version: 4,
      params: {
        conversationId: "thread-123",
        type: "thread-stream-state-changed",
        version: 4,
        change: {
          type: "snapshot",
          conversationState: {
            id: "thread-123",
            turns: [
              {
                status: "failed",
                items: [
                  {
                    id: "err-2",
                    type: "error",
                    message: "stream disconnected",
                    errorInfo: {
                      responseStreamDisconnected: {
                        httpStatusCode: 503,
                      },
                    },
                  },
                ],
              },
            ],
            requests: [],
          },
        },
      },
    });

    expect(parsed.params.change.type).toBe("snapshot");
  });

  it("rejects invalid patch value for remove operation", () => {
    expect(() =>
      parseThreadStreamStateChangedBroadcast({
        type: "broadcast",
        method: "thread-stream-state-changed",
        sourceClientId: "client-123",
        version: 4,
        params: {
          conversationId: "thread-123",
          type: "thread-stream-state-changed",
          version: 4,
          change: {
            type: "patches",
            patches: [
              {
                op: "remove",
                path: ["requests", 0],
                value: true,
              },
            ],
          },
        },
      }),
    ).toThrowError(/patches\[0\]\.value/);
  });

  it("rejects add patches without value", () => {
    expect(() =>
      parseThreadStreamStateChangedBroadcast({
        type: "broadcast",
        method: "thread-stream-state-changed",
        sourceClientId: "client-123",
        version: 4,
        params: {
          conversationId: "thread-123",
          type: "thread-stream-state-changed",
          version: 4,
          change: {
            type: "patches",
            patches: [
              {
                op: "add",
                path: ["requests", 0],
              },
            ],
          },
        },
      }),
    ).toThrowError(/patches\[0\]\.value/);
  });

  it("parses thread conversation state with userInputResponse item", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          params: {
            threadId: "thread-123",
            input: [{ type: "text", text: "hello" }],
            attachments: [],
          },
          status: "completed",
          items: [
            {
              id: "item-1",
              type: "userInputResponse",
              requestId: 12,
              turnId: "turn-1",
              questions: [{ id: "q", header: "H", question: "Q" }],
              answers: { q: ["A"] },
              completed: true,
            },
          ],
        },
      ],
      requests: [],
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("userInputResponse");
  });

  it("parses userInputResponse item when completed is omitted", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-1",
              type: "userInputResponse",
              requestId: 12,
              turnId: "turn-1",
              questions: [{ id: "q", header: "H", question: "Q" }],
              answers: { q: ["A"] },
            },
          ],
        },
      ],
      requests: [],
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("userInputResponse");
  });

  it("parses thread conversation state with mixed text and image user content", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-1",
              type: "userMessage",
              content: [
                {
                  type: "text",
                  text: "describe this image",
                },
                {
                  type: "image",
                  url: "data:image/png;base64,AAAA",
                },
              ],
            },
          ],
        },
      ],
      requests: [],
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("userMessage");
  });

  it("parses steering user message item", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-steering",
              type: "steeringUserMessage",
              content: [
                {
                  type: "text",
                  text: "please keep this concise",
                },
              ],
              attachments: [],
            },
          ],
        },
      ],
      requests: [],
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("steeringUserMessage");
  });

  it("parses planImplementation item", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "implement-plan:turn-1",
              type: "planImplementation",
              turnId: "turn-1",
              planContent: "# Plan\n\nDo the thing",
              isCompleted: true,
            },
          ],
        },
      ],
      requests: [],
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("planImplementation");
  });

  it("parses todo-list item with turn plan step statuses", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "inProgress",
          items: [
            {
              id: "todo-1",
              type: "todo-list",
              explanation: "Executing a multi-step plan",
              plan: [
                {
                  step: "Collect context",
                  status: "completed",
                },
                {
                  step: "Apply patch",
                  status: "inProgress",
                },
                {
                  step: "Run tests",
                  status: "pending",
                },
              ],
            },
          ],
        },
      ],
      requests: [],
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("todo-list");
  });

  it("rejects thread conversation state with unknown item types", () => {
    expect(() =>
      parseThreadConversationState({
        id: "thread-123",
        turns: [
          {
            status: "completed",
            items: [
              {
                id: "item-unknown",
                type: "toolCall",
                payload: {
                  hello: "world",
                },
              },
            ],
          },
        ],
        requests: [],
      }),
    ).toThrowError(/ThreadConversationState did not match expected schema/);
  });

  it("parses thread conversation state with command execution item", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-cmd",
              type: "commandExecution",
              command: "echo hello",
              cwd: "/tmp",
              processId: "123",
              status: "completed",
              commandActions: [
                {
                  type: "read",
                  command: "cat file.txt",
                  name: "file.txt",
                  path: "file.txt",
                },
              ],
              aggregatedOutput: "hello",
              exitCode: 0,
              durationMs: 5,
            },
          ],
        },
      ],
      requests: [],
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("commandExecution");
  });

  it("parses command action with null path and query", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-cmd",
              type: "commandExecution",
              command: "rg -n hello -S",
              status: "completed",
              commandActions: [
                {
                  type: "search",
                  command: "rg -n hello -S",
                  query: "hello",
                  path: null,
                },
              ],
            },
          ],
        },
      ],
      requests: [],
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("commandExecution");
  });
});
