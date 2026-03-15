import { describe, expect, it } from "vitest";
import { parseThreadConversationState } from "../Source/Index.js";

describe("codex-protocol thread extended schemas", () => {
  it("parses thread conversation state with fileChange item", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-file",
              type: "fileChange",
              status: "completed",
              changes: [
                {
                  path: "/tmp/file.txt",
                  kind: {
                    type: "update",
                    move_path: null,
                  },
                  diff: "@@ -1 +1 @@\n-old\n+new\n",
                },
              ],
            },
          ],
        },
      ],
      requests: [],
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("fileChange");
  });

  it("parses thread conversation state with contextCompaction and webSearch items", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-compact",
              type: "contextCompaction",
              completed: true,
            },
            {
              id: "item-web",
              type: "webSearch",
              query: "example query",
              action: {
                type: "search",
                query: "example query",
                queries: ["example query"],
              },
            },
          ],
        },
      ],
      requests: [],
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("contextCompaction");
    expect(parsed.turns[0]?.items[1]?.type).toBe("webSearch");
  });

  it("parses thread conversation state with mcp and collab tool call items", () => {
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
              status: "completed",
              arguments: { path: "README.md" },
              result: {
                content: ["ok"],
                structuredContent: null,
              },
              error: null,
              durationMs: 18,
            },
            {
              id: "item-collab",
              type: "collabAgentToolCall",
              tool: "sendInput",
              status: "inProgress",
              senderThreadId: "thread-123",
              receiverThreadIds: ["thread-124"],
              prompt: "Check this file",
              agentsStates: {
                "thread-124": {
                  status: "running",
                  message: null,
                },
              },
            },
            {
              id: "item-image-view",
              type: "imageView",
              path: "/tmp/example.png",
            },
            {
              id: "item-review-enter",
              type: "enteredReviewMode",
              review: "review-1",
            },
            {
              id: "item-review-exit",
              type: "exitedReviewMode",
              review: "review-1",
            },
          ],
        },
      ],
      requests: [],
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("mcpToolCall");
    expect(parsed.turns[0]?.items[1]?.type).toBe("collabAgentToolCall");
    expect(parsed.turns[0]?.items[2]?.type).toBe("imageView");
    expect(parsed.turns[0]?.items[3]?.type).toBe("enteredReviewMode");
    expect(parsed.turns[0]?.items[4]?.type).toBe("exitedReviewMode");
  });

  it("parses thread conversation state with collabToolCall item", () => {
    const parsed = parseThreadConversationState({
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
              prompt: "Check this file",
              agentsStates: {
                "thread-124": {
                  status: "running",
                  message: null,
                },
              },
            },
          ],
        },
      ],
      requests: [],
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("collabToolCall");
  });

  it("parses contextCompaction item when completed is omitted", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-compact",
              type: "contextCompaction",
            },
          ],
        },
      ],
      requests: [],
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("contextCompaction");
  });

  it("parses strict collaboration mode settings contracts", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [],
      latestCollaborationMode: {
        mode: "delegate",
        settings: {
          model: "gpt-5.3-codex",
          reasoning_effort: null,
          developer_instructions: "Keep responses concise.",
        },
      },
    });

    expect(parsed.latestCollaborationMode?.settings.model).toBe("gpt-5.3-codex");
    expect(parsed.latestCollaborationMode?.settings.reasoning_effort).toBeNull();
    expect(parsed.latestCollaborationMode?.settings.developer_instructions).toBe(
      "Keep responses concise.",
    );
  });

  it("rejects collaboration mode contracts with unknown fields", () => {
    expect(() =>
      parseThreadConversationState({
        id: "thread-123",
        turns: [],
        latestCollaborationMode: {
          mode: "delegate",
          settings: {
            model: null,
            reasoning_effort: null,
            developer_instructions: null,
            extraSetting: "not-allowed",
          },
          extraModeField: "not-allowed",
        },
      }),
    ).toThrowError(/ThreadConversationState did not match expected schema/);
  });

  it("parses thread conversation state with modelChanged item", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-model",
              type: "modelChanged",
              fromModel: "gpt-5.3-codex-spark",
              toModel: "gpt-5.3-codex",
            },
          ],
        },
      ],
      requests: [],
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("modelChanged");
  });
});
