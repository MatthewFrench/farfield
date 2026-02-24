import { describe, expect, it } from "vitest";
import {
  parseAppServerCollaborationModeListResponse,
  parseAppServerConfigReadResponse,
  parseAppServerListModelsResponse,
  parseAppServerListThreadsResponse,
  parseAppServerReadThreadResponse,
  parseAppServerStartThreadResponse
} from "../Source/Index.js";

describe("codex-protocol app-server schemas", () => {
  it("parses collaboration mode list response", () => {
    const parsed = parseAppServerCollaborationModeListResponse({
      data: [
        {
          name: "Plan",
          mode: "plan",
          model: null,
          reasoning_effort: "medium",
          developer_instructions: "Instructions"
        }
      ]
    });

    expect(parsed.data[0]?.mode).toBe("plan");
  });

  it("parses app-server model/list response with modern model shape", () => {
    const parsed = parseAppServerListModelsResponse({
      data: [
        {
          id: "gpt-5.3-codex",
          model: "gpt-5.3-codex",
          upgrade: null,
          displayName: "GPT-5.3 Codex",
          description: "Latest frontier agentic coding model.",
          supportedReasoningEfforts: [
            {
              reasoningEffort: "medium",
              description: "Balanced"
            },
            {
              reasoningEffort: "xhigh",
              description: "Deep reasoning"
            }
          ],
          defaultReasoningEffort: "xhigh",
          inputModalities: ["text", "image"],
          supportsPersonality: true,
          isDefault: true,
          hidden: true
        }
      ],
      nextCursor: null
    });

    expect(parsed.data[0]?.id).toBe("gpt-5.3-codex");
    expect(parsed.data[0]?.["hidden"]).toBe(true);
  });

  it("parses unknown top-level keys in app-server model/list response", () => {
    const parsed = parseAppServerListModelsResponse({
      data: [
        {
          id: "gpt-5.3-codex",
          model: "gpt-5.3-codex",
          upgrade: null,
          displayName: "GPT-5.3 Codex",
          description: "Latest frontier agentic coding model.",
          supportedReasoningEfforts: [
            {
              reasoningEffort: "medium",
              description: "Balanced"
            }
          ],
          defaultReasoningEffort: "medium",
          inputModalities: ["text"],
          supportsPersonality: true,
          isDefault: true,
          hidden: false
        }
      ],
      nextCursor: null,
      hidden: true
    });

    expect(parsed["hidden"]).toBe(true);
  });

  it("parses app-server thread/list response from opencode agent", () => {
    const parsed = parseAppServerListThreadsResponse({
      data: [
        {
          id: "sess-1",
          preview: "Test Session",
          createdAt: 1700000000,
          updatedAt: 1700000100,
          cwd: "/tmp/project",
          source: "opencode"
        }
      ],
      nextCursor: null
    });

    expect(parsed.data[0]?.id).toBe("sess-1");
  });

  it("parses app-server thread/read response with subset validation", () => {
    const parsed = parseAppServerReadThreadResponse({
      thread: {
        id: "thread-123",
        preview: "hello",
        modelProvider: "openai",
        createdAt: 1700000000,
        updatedAt: 1700000000,
        cwd: "/tmp/workspace",
        source: "cli",
        path: "/tmp/thread.jsonl",
        cliVersion: "0.1.0",
        turns: [
          {
            id: "turn-1",
            status: "completed",
            items: [
              {
                id: "item-1",
                type: "agentMessage",
                text: "hello"
              }
            ]
          }
        ]
      }
    });

    expect(parsed.thread.id).toBe("thread-123");
    expect(parsed.thread.requests).toEqual([]);
    expect(parsed.thread.turns[0]?.status).toBe("completed");
  });

  it("parses app-server thread/start response", () => {
    const parsed = parseAppServerStartThreadResponse({
      thread: {
        id: "thread-456",
        preview: "",
        modelProvider: "openai",
        createdAt: 1700000000,
        updatedAt: 1700000000,
        cwd: "/tmp/workspace",
        path: "/tmp/rollout.jsonl",
        cliVersion: "0.1.0",
        source: "vscode",
        gitInfo: null,
        turns: []
      },
      model: "gpt-5.3-codex",
      modelProvider: "openai",
      cwd: "/tmp/workspace",
      approvalPolicy: "never",
      sandbox: {
        type: "dangerFullAccess"
      },
      reasoningEffort: "medium"
    });

    expect(parsed.thread.id).toBe("thread-456");
    expect(parsed.model).toBe("gpt-5.3-codex");
  });

  it("parses app-server thread/start response from opencode agent", () => {
    const parsed = parseAppServerStartThreadResponse({
      thread: {
        id: "sess-2",
        preview: "(untitled)",
        createdAt: 1700000000,
        updatedAt: 1700000000,
        cwd: "/tmp/project",
        source: "opencode"
      },
      cwd: "/tmp/project"
    });

    expect(parsed.thread.id).toBe("sess-2");
  });

  it("parses app-server config/read response for effective defaults", () => {
    const parsed = parseAppServerConfigReadResponse({
      config: {
        profile: "personal",
        model: "gpt-5.3-codex",
        model_reasoning_effort: "medium",
        profiles: {
          personal: {
            model: "gpt-5.3-codex",
            model_reasoning_effort: "xhigh"
          }
        }
      },
      origins: {},
      layers: null
    });

    expect(parsed.config.profile).toBe("personal");
    expect(parsed.config.model_reasoning_effort).toBe("medium");
    expect(parsed.config.profiles["personal"]?.model_reasoning_effort).toBe("xhigh");
  });
});
