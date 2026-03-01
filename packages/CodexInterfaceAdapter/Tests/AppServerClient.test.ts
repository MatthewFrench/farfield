import {
  type JsonValue,
  ProtocolValidationError,
  type ThreadConversationRequestResponse,
} from "@farfield/protocol";
import { describe, expect, it, type Mock, vi } from "vitest";
import { AppServerClient } from "../Source/AppServerClient.js";
import type {
  AppServerReadNotificationEventsInput,
  AppServerReadNotificationEventsResult,
  AppServerTransport,
} from "../Source/AppServerTransport.js";

type AppServerRequestFunction = (
  method: string,
  params: object,
  timeoutMs?: number,
) => Promise<JsonValue>;
type AppServerCloseFunction = () => Promise<void>;
type AppServerRespondFunction = (
  requestId: number,
  response: ThreadConversationRequestResponse,
) => Promise<void>;
type AppServerReadNotificationEventsFunction = (
  input: AppServerReadNotificationEventsInput,
) => AppServerReadNotificationEventsResult;
type AppServerReadPendingServerRequestsFunction = () => {
  requestId: number;
  method: string;
  params: JsonValue | null;
  receivedAtMilliseconds: number;
}[];
type AppServerRequestMock = Mock<AppServerRequestFunction>;
type AppServerCloseMock = Mock<AppServerCloseFunction>;
type AppServerRespondMock = Mock<AppServerRespondFunction>;
type AppServerReadNotificationEventsMock = Mock<AppServerReadNotificationEventsFunction>;
type AppServerReadPendingServerRequestsMock = Mock<AppServerReadPendingServerRequestsFunction>;

interface AppServerTransportDouble {
  transport: AppServerTransport;
  request: AppServerRequestMock;
  respond: AppServerRespondMock;
  readNotificationEvents: AppServerReadNotificationEventsMock;
  readPendingServerRequests: AppServerReadPendingServerRequestsMock;
  close: AppServerCloseMock;
}

function createTransportDouble(): AppServerTransportDouble {
  const request: AppServerRequestMock = vi.fn<AppServerRequestFunction>();
  request.mockResolvedValue({});
  const respond: AppServerRespondMock = vi.fn<AppServerRespondFunction>();
  respond.mockResolvedValue(undefined);
  const readNotificationEvents: AppServerReadNotificationEventsMock =
    vi.fn<AppServerReadNotificationEventsFunction>();
  readNotificationEvents.mockReturnValue({
    events: [],
    nextSequence: 0,
    firstAvailableSequence: 0,
    resetRequired: false,
  });
  const readPendingServerRequests: AppServerReadPendingServerRequestsMock =
    vi.fn<AppServerReadPendingServerRequestsFunction>();
  readPendingServerRequests.mockReturnValue([]);

  const close: AppServerCloseMock = vi.fn<AppServerCloseFunction>();
  close.mockResolvedValue(undefined);

  const transport: AppServerTransport = {
    request,
    respond,
    readNotificationEvents,
    readPendingServerRequests,
    close,
  };

  return {
    transport,
    request,
    respond,
    readNotificationEvents,
    readPendingServerRequests,
    close,
  };
}

function createThreadConversationResponse(threadId: string): JsonValue {
  return {
    thread: {
      id: threadId,
      turns: [],
      requests: [],
    },
  };
}

function createThreadListItem(threadId: string): JsonValue {
  return {
    id: threadId,
    preview: `Thread ${threadId}`,
    createdAt: 1,
    updatedAt: 2,
    source: "opencode",
    cwd: "/tmp/workspace",
  };
}

describe("AppServerClient.startTurn", () => {
  it("sends turn/start payload with normalized text input and thread id", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      turn: {
        id: "turn-1",
      },
    });

    const client = new AppServerClient(transportDouble.transport);
    await client.startTurn({
      threadId: "thread-1",
      text: "hello",
      cwd: "/tmp/project",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("turn/start", {
      threadId: "thread-1",
      input: [
        {
          type: "text",
          text: "hello",
        },
      ],
      cwd: "/tmp/project",
      attachments: [],
    });
  });

  it("inherits template model and effort when overrides are omitted", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      turn: {
        id: "turn-2",
      },
    });

    const client = new AppServerClient(transportDouble.transport);
    await client.startTurn({
      threadId: "thread-1",
      text: "hello",
      turnStartTemplate: {
        threadId: "thread-1",
        input: [
          {
            type: "text",
            text: "existing",
          },
        ],
        attachments: [],
        model: "gpt-5",
        effort: "medium",
      },
    });

    expect(transportDouble.request).toHaveBeenCalledWith(
      "turn/start",
      expect.objectContaining({
        model: "gpt-5",
        effort: "medium",
      }),
    );
  });
});

describe("AppServerClient.steerTurn", () => {
  it("sends turn/steer payload with thread and expected turn identifiers", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      turnId: "turn-2",
    });

    const client = new AppServerClient(transportDouble.transport);
    await client.steerTurn("thread-1", "turn-1", "update direction");

    expect(transportDouble.request).toHaveBeenCalledWith("turn/steer", {
      threadId: "thread-1",
      expectedTurnId: "turn-1",
      input: [
        {
          type: "text",
          text: "update direction",
        },
      ],
    });
  });

  it("validates steer identifiers before transport request", async () => {
    const transportDouble = createTransportDouble();
    const client = new AppServerClient(transportDouble.transport);

    await expect(client.steerTurn("thread-1", "", "update direction")).rejects.toThrowError();
    expect(transportDouble.request).not.toHaveBeenCalled();
  });
});

describe("AppServerClient.forkThread", () => {
  it("sends thread/fork payload with default persistExtendedHistory=true", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      thread: createThreadListItem("thread-2"),
      model: "gpt-5",
      modelProvider: "openai",
      cwd: "/tmp/workspace",
      approvalPolicy: "on-request",
      sandbox: "workspace-write",
      reasoningEffort: null,
    });

    const client = new AppServerClient(transportDouble.transport);
    await client.forkThread("thread-1");

    expect(transportDouble.request).toHaveBeenCalledWith("thread/fork", {
      threadId: "thread-1",
      persistExtendedHistory: true,
    });
  });

  it("respects explicit persistExtendedHistory=false on thread/fork", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      thread: createThreadListItem("thread-2"),
      model: "gpt-5",
      modelProvider: "openai",
      cwd: "/tmp/workspace",
      approvalPolicy: "on-request",
      sandbox: "workspace-write",
      reasoningEffort: null,
    });

    const client = new AppServerClient(transportDouble.transport);
    await client.forkThread("thread-1", {
      persistExtendedHistory: false,
    });

    expect(transportDouble.request).toHaveBeenCalledWith("thread/fork", {
      threadId: "thread-1",
      persistExtendedHistory: false,
    });
  });
});

describe("AppServerClient.setThreadName", () => {
  it("sends thread/name/set payload with thread id and trimmed name", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({});

    const client = new AppServerClient(transportDouble.transport);
    await client.setThreadName("thread-1", "  Better name  ");

    expect(transportDouble.request).toHaveBeenCalledWith("thread/name/set", {
      threadId: "thread-1",
      name: "Better name",
    });
  });

  it("rejects empty thread names before transport request", async () => {
    const transportDouble = createTransportDouble();
    const client = new AppServerClient(transportDouble.transport);

    await expect(client.setThreadName("thread-1", "   ")).rejects.toThrowError();
    expect(transportDouble.request).not.toHaveBeenCalled();
  });
});

describe("AppServerClient.rollbackThread", () => {
  it("sends thread/rollback payload with required turn count", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue(createThreadConversationResponse("thread-1"));

    const client = new AppServerClient(transportDouble.transport);
    await client.rollbackThread("thread-1", 2);

    expect(transportDouble.request).toHaveBeenCalledWith("thread/rollback", {
      threadId: "thread-1",
      numTurns: 2,
    });
  });

  it("rejects invalid numTurns before transport request", async () => {
    const transportDouble = createTransportDouble();
    const client = new AppServerClient(transportDouble.transport);

    await expect(client.rollbackThread("thread-1", 0)).rejects.toThrowError();
    expect(transportDouble.request).not.toHaveBeenCalled();
  });
});

describe("AppServerClient.compactThread", () => {
  it("sends thread/compact/start payload with thread id", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({});

    const client = new AppServerClient(transportDouble.transport);
    await client.compactThread("thread-1");

    expect(transportDouble.request).toHaveBeenCalledWith("thread/compact/start", {
      threadId: "thread-1",
    });
  });

  it("validates thread id before transport request", async () => {
    const transportDouble = createTransportDouble();
    const client = new AppServerClient(transportDouble.transport);

    await expect(client.compactThread("")).rejects.toThrowError();
    expect(transportDouble.request).not.toHaveBeenCalled();
  });
});

describe("AppServerClient.cleanThreadBackgroundTerminals", () => {
  it("sends thread/backgroundTerminals/clean payload with thread id", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({});

    const client = new AppServerClient(transportDouble.transport);
    await client.cleanThreadBackgroundTerminals("thread-1");

    expect(transportDouble.request).toHaveBeenCalledWith("thread/backgroundTerminals/clean", {
      threadId: "thread-1",
    });
  });

  it("validates thread id before transport request", async () => {
    const transportDouble = createTransportDouble();
    const client = new AppServerClient(transportDouble.transport);

    await expect(client.cleanThreadBackgroundTerminals("")).rejects.toThrowError();
    expect(transportDouble.request).not.toHaveBeenCalled();
  });
});

describe("AppServerClient.startReview", () => {
  it("sends review/start payload with explicit target and delivery", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      reviewThreadId: "thread-review-1",
      turn: {
        id: "turn-review-1",
      },
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.startReview({
      threadId: "thread-1",
      target: {
        type: "baseBranch",
        branch: "main",
      },
      delivery: "detached",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("review/start", {
      threadId: "thread-1",
      target: {
        type: "baseBranch",
        branch: "main",
      },
      delivery: "detached",
    });
    expect(result).toEqual({
      reviewThreadId: "thread-review-1",
      turnId: "turn-review-1",
    });
  });

  it("validates review target payload before transport request", async () => {
    const transportDouble = createTransportDouble();
    const client = new AppServerClient(transportDouble.transport);

    await expect(
      client.startReview({
        threadId: "thread-1",
        target: {
          type: "custom",
          instructions: "",
        },
      }),
    ).rejects.toThrowError();
    expect(transportDouble.request).not.toHaveBeenCalled();
  });
});

describe("AppServerClient.interruptTurn", () => {
  it("sends turn/interrupt payload with thread and turn identifiers", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({});

    const client = new AppServerClient(transportDouble.transport);
    await client.interruptTurn("thread-1", "turn-1");

    expect(transportDouble.request).toHaveBeenCalledWith("turn/interrupt", {
      threadId: "thread-1",
      turnId: "turn-1",
    });
  });

  it("validates turn identifiers before transport request", async () => {
    const transportDouble = createTransportDouble();
    const client = new AppServerClient(transportDouble.transport);

    await expect(client.interruptTurn("thread-1", "")).rejects.toThrowError();
    expect(transportDouble.request).not.toHaveBeenCalled();
  });
});

describe("AppServerClient.submitServerRequestResponse", () => {
  it("forwards parsed response payload through transport.respond", async () => {
    const transportDouble = createTransportDouble();
    const client = new AppServerClient(transportDouble.transport);

    await client.submitServerRequestResponse(17, {
      method: "item/tool/requestUserInput",
      payload: {
        answers: {
          choice: {
            answers: ["A"],
          },
        },
      },
    });

    expect(transportDouble.respond).toHaveBeenCalledWith(17, {
      method: "item/tool/requestUserInput",
      payload: {
        answers: {
          choice: {
            answers: ["A"],
          },
        },
      },
    });
  });
});

describe("AppServerClient.notification and server-request reads", () => {
  it("delegates readNotificationEvents to transport owner", () => {
    const transportDouble = createTransportDouble();
    transportDouble.readNotificationEvents.mockReturnValue({
      events: [
        {
          sequence: 2,
          method: "turn/started",
          params: {
            threadId: "thread-1",
          },
          receivedAtMilliseconds: 123,
        },
      ],
      nextSequence: 3,
      firstAvailableSequence: 0,
      resetRequired: false,
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = client.readNotificationEvents({
      limit: 20,
      sinceSequence: 1,
    });

    expect(result.nextSequence).toBe(3);
    expect(transportDouble.readNotificationEvents).toHaveBeenCalledWith({
      limit: 20,
      sinceSequence: 1,
    });
  });

  it("delegates readPendingServerRequests to transport owner", () => {
    const transportDouble = createTransportDouble();
    transportDouble.readPendingServerRequests.mockReturnValue([
      {
        requestId: 44,
        method: "item/tool/requestUserInput",
        params: {
          threadId: "thread-1",
        },
        receivedAtMilliseconds: 200,
      },
    ]);

    const client = new AppServerClient(transportDouble.transport);
    const result = client.readPendingServerRequests();

    expect(result).toEqual([
      {
        requestId: 44,
        method: "item/tool/requestUserInput",
        params: {
          threadId: "thread-1",
        },
        receivedAtMilliseconds: 200,
      },
    ]);
  });
});

describe("AppServerClient.resumeThread", () => {
  it("sends the expected resume request payload", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue(createThreadConversationResponse("thread-1"));

    const client = new AppServerClient(transportDouble.transport);
    await client.resumeThread("thread-1");

    expect(transportDouble.request).toHaveBeenCalledWith("thread/resume", {
      threadId: "thread-1",
      persistExtendedHistory: true,
    });
  });

  it("respects explicit persistExtendedHistory=false", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue(createThreadConversationResponse("thread-1"));

    const client = new AppServerClient(transportDouble.transport);
    await client.resumeThread("thread-1", {
      persistExtendedHistory: false,
    });

    expect(transportDouble.request).toHaveBeenCalledWith("thread/resume", {
      threadId: "thread-1",
      persistExtendedHistory: false,
    });
  });
});

describe("AppServerClient.listThreads", () => {
  it("passes sortKey and cwd when provided", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      data: [],
      nextCursor: null,
    });

    const client = new AppServerClient(transportDouble.transport);
    await client.listThreads({
      limit: 50,
      archived: false,
      sortKey: "updated_at",
      cwd: "/tmp/workspace",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("thread/list", {
      limit: 50,
      archived: false,
      cursor: null,
      sortKey: "updated_at",
      cwd: "/tmp/workspace",
    });
  });

  it("preserves explicit empty cursor and cwd values", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      data: [],
      nextCursor: null,
    });

    const client = new AppServerClient(transportDouble.transport);
    await client.listThreads({
      limit: 50,
      archived: false,
      cursor: "",
      cwd: "",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("thread/list", {
      limit: 50,
      archived: false,
      cursor: "",
      cwd: "",
    });
  });

  it("throws protocol validation errors when list response shape is invalid", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      invalid: true,
    });

    const client = new AppServerClient(transportDouble.transport);
    await expect(
      client.listThreads({
        limit: 10,
        archived: false,
      }),
    ).rejects.toBeInstanceOf(ProtocolValidationError);
  });
});

describe("AppServerClient.listLoadedThreads", () => {
  it("sends thread/loaded/list with empty parameters by default", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      data: ["thread-1", "thread-2"],
      nextCursor: null,
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.listLoadedThreads();

    expect(transportDouble.request).toHaveBeenCalledWith("thread/loaded/list", {});
    expect(result).toEqual({
      data: ["thread-1", "thread-2"],
      nextCursor: null,
    });
  });

  it("preserves explicit cursor and nullable limit parameters", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      data: [],
      nextCursor: "cursor-2",
    });

    const client = new AppServerClient(transportDouble.transport);
    await client.listLoadedThreads({
      cursor: "",
      limit: null,
    });

    expect(transportDouble.request).toHaveBeenCalledWith("thread/loaded/list", {
      cursor: "",
      limit: null,
    });
  });

  it("throws protocol validation errors when loaded-list response shape is invalid", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      data: [1, 2, 3],
      nextCursor: null,
    });

    const client = new AppServerClient(transportDouble.transport);
    await expect(client.listLoadedThreads()).rejects.toBeInstanceOf(ProtocolValidationError);
  });
});

describe("AppServerClient.unsubscribeThread", () => {
  it("sends thread/unsubscribe payload and returns unsubscribe status", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      status: "unsubscribed",
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.unsubscribeThread("thread-1");

    expect(transportDouble.request).toHaveBeenCalledWith("thread/unsubscribe", {
      threadId: "thread-1",
    });
    expect(result).toBe("unsubscribed");
  });

  it("validates thread id before transport request", async () => {
    const transportDouble = createTransportDouble();
    const client = new AppServerClient(transportDouble.transport);

    await expect(client.unsubscribeThread("")).rejects.toThrowError();
    expect(transportDouble.request).not.toHaveBeenCalled();
  });
});

describe("AppServerClient.readConfigRequirements", () => {
  it("sends configRequirements/read with empty parameters and returns normalized requirements", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      requirements: {
        allowedApprovalPolicies: ["on-request", "never"],
        enforceResidency: "us",
        network: {
          enabled: true,
          httpPort: 8080,
        },
      },
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.readConfigRequirements();

    expect(transportDouble.request).toHaveBeenCalledWith("configRequirements/read", {});
    expect(result).toEqual({
      requirements: {
        allowedApprovalPolicies: ["on-request", "never"],
        allowedSandboxModes: null,
        allowedWebSearchModes: null,
        enforceResidency: "us",
        network: {
          enabled: true,
          httpPort: 8080,
          socksPort: null,
          allowUpstreamProxy: null,
          dangerouslyAllowNonLoopbackProxy: null,
          dangerouslyAllowNonLoopbackAdmin: null,
          dangerouslyAllowAllUnixSockets: null,
          allowedDomains: null,
          deniedDomains: null,
          allowUnixSockets: null,
          allowLocalBinding: null,
        },
      },
    });
  });
});

describe("AppServerClient.listExperimentalFeatures", () => {
  it("sends experimentalFeature/list and returns strict feature contracts", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      data: [
        {
          name: "advanced-diff-view",
          stage: "beta",
          displayName: "Advanced Diff View",
          description: "Detailed diff review controls",
          announcement: null,
          enabled: true,
          defaultEnabled: false,
        },
      ],
      nextCursor: "cursor-1",
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.listExperimentalFeatures({
      cursor: null,
      limit: 25,
    });

    expect(transportDouble.request).toHaveBeenCalledWith("experimentalFeature/list", {
      cursor: null,
      limit: 25,
    });
    expect(result).toEqual({
      data: [
        {
          name: "advanced-diff-view",
          stage: "beta",
          displayName: "Advanced Diff View",
          description: "Detailed diff review controls",
          announcement: null,
          enabled: true,
          defaultEnabled: false,
        },
      ],
      nextCursor: "cursor-1",
    });
  });
});

describe("AppServerClient.listMcpServerStatuses", () => {
  it("projects mcp server status counts from mcpServerStatus/list response", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      data: [
        {
          name: "github",
          tools: {
            search_repositories: {
              enabled: true,
            },
            read_issue: {
              enabled: true,
            },
          },
          resources: [
            {
              uri: "mcp://github/issues",
            },
          ],
          resourceTemplates: [
            {
              name: "issue-by-number",
            },
          ],
          authStatus: "authenticated",
        },
      ],
      nextCursor: null,
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.listMcpServerStatuses();

    expect(transportDouble.request).toHaveBeenCalledWith("mcpServerStatus/list", {});
    expect(result).toEqual({
      data: [
        {
          name: "github",
          authStatus: "authenticated",
          toolCount: 2,
          resourceCount: 1,
          resourceTemplateCount: 1,
        },
      ],
      nextCursor: null,
    });
  });
});

describe("AppServerClient.listApps", () => {
  it("sends app/list and normalizes optional app fields", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      data: [
        {
          id: "app-github",
          name: "GitHub",
          isAccessible: true,
          isEnabled: true,
        },
      ],
      nextCursor: null,
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.listApps({
      forceRefetch: true,
      threadId: "thread-1",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("app/list", {
      threadId: "thread-1",
      forceRefetch: true,
    });
    expect(result).toEqual({
      data: [
        {
          id: "app-github",
          name: "GitHub",
          description: null,
          logoUrl: null,
          logoUrlDark: null,
          installUrl: null,
          isAccessible: true,
          isEnabled: true,
        },
      ],
      nextCursor: null,
    });
  });
});

describe("AppServerClient.listSkills", () => {
  it("sends skills/list and maps skill entries into strict typed rows", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      data: [
        {
          cwd: "/tmp/workspace",
          skills: [
            {
              name: "checks",
              description: "Run repository checks",
              shortDescription: "Checks",
              path: "/tmp/workspace/.codex/skills/checks/SKILL.md",
              scope: "repo",
              enabled: true,
            },
          ],
          errors: [
            {
              path: "/tmp/workspace/.codex/skills/broken/SKILL.md",
              message: "Invalid SKILL.md frontmatter",
            },
          ],
        },
      ],
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.listSkills({
      cwds: ["/tmp/workspace"],
      forceReload: true,
      perCwdExtraUserRoots: [
        {
          cwd: "/tmp/workspace",
          extraUserRoots: ["/tmp/skills-extra"],
        },
      ],
    });

    expect(transportDouble.request).toHaveBeenCalledWith("skills/list", {
      cwds: ["/tmp/workspace"],
      forceReload: true,
      perCwdExtraUserRoots: [
        {
          cwd: "/tmp/workspace",
          extraUserRoots: ["/tmp/skills-extra"],
        },
      ],
    });
    expect(result).toEqual({
      data: [
        {
          cwd: "/tmp/workspace",
          skills: [
            {
              name: "checks",
              description: "Run repository checks",
              shortDescription: "Checks",
              path: "/tmp/workspace/.codex/skills/checks/SKILL.md",
              scope: "repo",
              enabled: true,
            },
          ],
          errors: [
            {
              path: "/tmp/workspace/.codex/skills/broken/SKILL.md",
              message: "Invalid SKILL.md frontmatter",
            },
          ],
        },
      ],
    });
  });
});

describe("AppServerClient.readAccount", () => {
  it("sends account/read and maps account contract variants", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      account: {
        type: "chatgpt",
        email: "dev@example.com",
        planType: "pro",
      },
      requiresOpenaiAuth: false,
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.readAccount({
      refreshToken: true,
    });

    expect(transportDouble.request).toHaveBeenCalledWith("account/read", {
      refreshToken: true,
    });
    expect(result).toEqual({
      account: {
        type: "chatgpt",
        email: "dev@example.com",
        planType: "pro",
      },
      requiresOpenaiAuth: false,
    });
  });
});

describe("AppServerClient.readAuthStatus", () => {
  it("sends getAuthStatus and maps nullable auth status fields", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      authMethod: "chatgpt",
      authToken: null,
      requiresOpenaiAuth: true,
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.readAuthStatus({
      includeToken: true,
      refreshToken: true,
    });

    expect(transportDouble.request).toHaveBeenCalledWith("getAuthStatus", {
      includeToken: true,
      refreshToken: true,
    });
    expect(result).toEqual({
      authMethod: "chatgpt",
      authToken: null,
      requiresOpenaiAuth: true,
    });
  });
});

describe("AppServerClient.readUserInfo", () => {
  it("sends userInfo and maps user-info response fields", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      allegedUserEmail: "dev@example.com",
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.readUserInfo();

    expect(transportDouble.request).toHaveBeenCalledWith("userInfo", {});
    expect(result).toEqual({
      allegedUserEmail: "dev@example.com",
    });
  });
});

describe("AppServerClient.readAccountRateLimits", () => {
  it("sends account/rateLimits/read and normalizes snapshot contracts", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      rateLimits: {
        limitId: "codex",
        limitName: "Codex",
        planType: "pro",
        primary: {
          usedPercent: 42,
          resetsAt: 1_700_000_000,
          windowDurationMins: 60,
        },
      },
      rateLimitsByLimitId: {
        codex: {
          credits: {
            balance: "120.00",
            hasCredits: true,
            unlimited: false,
          },
          planType: "pro",
          primary: {
            usedPercent: 42,
          },
          secondary: null,
        },
      },
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.readAccountRateLimits();

    expect(transportDouble.request).toHaveBeenCalledWith("account/rateLimits/read", {});
    expect(result).toEqual({
      rateLimits: {
        credits: null,
        limitId: "codex",
        limitName: "Codex",
        planType: "pro",
        primary: {
          usedPercent: 42,
          resetsAt: 1_700_000_000,
          windowDurationMins: 60,
        },
        secondary: null,
      },
      rateLimitsByLimitId: {
        codex: {
          credits: {
            balance: "120.00",
            hasCredits: true,
            unlimited: false,
          },
          limitId: null,
          limitName: null,
          planType: "pro",
          primary: {
            usedPercent: 42,
            resetsAt: null,
            windowDurationMins: null,
          },
          secondary: null,
        },
      },
    });
  });
});

describe("AppServerClient.executeCommand", () => {
  it("sends command/exec payload and returns command output contracts", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      exitCode: 0,
      stdout: "/tmp/workspace\n",
      stderr: "",
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.executeCommand({
      command: ["pwd"],
      timeoutMilliseconds: 5_000,
      cwd: "/tmp/workspace",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("command/exec", {
      command: ["pwd"],
      timeoutMs: 5_000,
      cwd: "/tmp/workspace",
    });
    expect(result).toEqual({
      exitCode: 0,
      stdout: "/tmp/workspace\n",
      stderr: "",
    });
  });
});

describe("AppServerClient.uploadFeedback", () => {
  it("sends feedback/upload payload and returns typed response contracts", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      threadId: "thread-feedback-1",
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.uploadFeedback({
      classification: "quality",
      reason: "The output omitted expected edge-case handling.",
      includeLogs: true,
      threadId: "thread-1",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("feedback/upload", {
      classification: "quality",
      reason: "The output omitted expected edge-case handling.",
      includeLogs: true,
      threadId: "thread-1",
    });
    expect(result).toEqual({
      threadId: "thread-feedback-1",
    });
  });

  it("validates required classification before sending feedback/upload request", async () => {
    const transportDouble = createTransportDouble();
    const client = new AppServerClient(transportDouble.transport);

    await expect(
      client.uploadFeedback({
        classification: "",
        includeLogs: false,
      }),
    ).rejects.toThrowError();
    expect(transportDouble.request).not.toHaveBeenCalled();
  });
});

describe("AppServerClient.gitDiffToRemote", () => {
  it("sends gitDiffToRemote request and maps diff response contracts", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      sha: "abc123def456",
      diff: "diff --git a/file.ts b/file.ts\nindex 1..2 100644\n--- a/file.ts\n+++ b/file.ts\n",
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.gitDiffToRemote({
      cwd: "/tmp/workspace",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("gitDiffToRemote", {
      cwd: "/tmp/workspace",
    });
    expect(result).toEqual({
      sha: "abc123def456",
      diff: "diff --git a/file.ts b/file.ts\nindex 1..2 100644\n--- a/file.ts\n+++ b/file.ts\n",
    });
  });
});

describe("AppServerClient.fuzzyFileSearch", () => {
  it("sends fuzzyFileSearch request and maps file-match contracts", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      files: [
        {
          root: "/tmp/workspace",
          path: "Source/Main.tsx",
          file_name: "Main.tsx",
          score: 0.98,
          indices: [0, 1, 2],
        },
      ],
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.fuzzyFileSearch({
      query: "main",
      roots: ["/tmp/workspace"],
      cancellationToken: "token-1",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("fuzzyFileSearch", {
      query: "main",
      roots: ["/tmp/workspace"],
      cancellationToken: "token-1",
    });
    expect(result).toEqual({
      files: [
        {
          root: "/tmp/workspace",
          path: "Source/Main.tsx",
          fileName: "Main.tsx",
          score: 0.98,
          indices: [0, 1, 2],
        },
      ],
    });
  });
});

describe("AppServerClient.writeConfigValue", () => {
  it("sends config/value/write payload and returns typed config write result", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      status: "okOverridden",
      version: "v9",
      filePath: "/tmp/workspace/.codex/config.toml",
      overriddenMetadata: {
        message: "Workspace value overrides parent configuration layer.",
        overridingLayer: "workspace",
        effectiveValue: {
          enabled: true,
        },
      },
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.writeConfigValue({
      keyPath: "integrations.github",
      value: {
        enabled: true,
      },
      mergeStrategy: "upsert",
      filePath: "/tmp/workspace/.codex/config.toml",
      expectedVersion: "v8",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("config/value/write", {
      keyPath: "integrations.github",
      value: {
        enabled: true,
      },
      mergeStrategy: "upsert",
      filePath: "/tmp/workspace/.codex/config.toml",
      expectedVersion: "v8",
    });
    expect(result).toEqual({
      status: "okOverridden",
      version: "v9",
      filePath: "/tmp/workspace/.codex/config.toml",
      overriddenMetadata: {
        message: "Workspace value overrides parent configuration layer.",
        overridingLayer: "workspace",
        effectiveValue: {
          enabled: true,
        },
      },
    });
  });

  it("validates keyPath before sending config/value/write request", async () => {
    const transportDouble = createTransportDouble();
    const client = new AppServerClient(transportDouble.transport);

    await expect(
      client.writeConfigValue({
        keyPath: "",
        value: true,
        mergeStrategy: "replace",
      }),
    ).rejects.toThrowError();
    expect(transportDouble.request).not.toHaveBeenCalled();
  });
});

describe("AppServerClient.writeConfigBatch", () => {
  it("sends config/batchWrite payload and returns typed config write result", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      status: "ok",
      version: "v10",
      filePath: "/tmp/workspace/.codex/config.toml",
      overriddenMetadata: null,
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.writeConfigBatch({
      edits: [
        {
          keyPath: "integrations.github.enabled",
          value: true,
          mergeStrategy: "replace",
        },
        {
          keyPath: "integrations.github.scopes",
          value: ["repo", "read:org"],
          mergeStrategy: "upsert",
        },
      ],
      filePath: "/tmp/workspace/.codex/config.toml",
      expectedVersion: "v9",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("config/batchWrite", {
      edits: [
        {
          keyPath: "integrations.github.enabled",
          value: true,
          mergeStrategy: "replace",
        },
        {
          keyPath: "integrations.github.scopes",
          value: ["repo", "read:org"],
          mergeStrategy: "upsert",
        },
      ],
      filePath: "/tmp/workspace/.codex/config.toml",
      expectedVersion: "v9",
    });
    expect(result).toEqual({
      status: "ok",
      version: "v10",
      filePath: "/tmp/workspace/.codex/config.toml",
      overriddenMetadata: null,
    });
  });

  it("validates non-empty edit lists before sending config/batchWrite request", async () => {
    const transportDouble = createTransportDouble();
    const client = new AppServerClient(transportDouble.transport);

    await expect(
      client.writeConfigBatch({
        edits: [],
      }),
    ).rejects.toThrowError();
    expect(transportDouble.request).not.toHaveBeenCalled();
  });
});

describe("AppServerClient.startAccountLogin", () => {
  it("sends account/login/start and returns chatgpt login metadata", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      type: "chatgpt",
      loginId: "login-1",
      authUrl: "https://example.com/oauth",
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.startAccountLogin({
      type: "chatgpt",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("account/login/start", {
      type: "chatgpt",
    });
    expect(result).toEqual({
      type: "chatgpt",
      loginId: "login-1",
      authUrl: "https://example.com/oauth",
    });
  });

  it("sends explicit token-login payload when auth tokens are provided", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      type: "chatgptAuthTokens",
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.startAccountLogin({
      type: "chatgptAuthTokens",
      accessToken: "token-1",
      chatgptAccountId: "acct-1",
      chatgptPlanType: "pro",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("account/login/start", {
      type: "chatgptAuthTokens",
      accessToken: "token-1",
      chatgptAccountId: "acct-1",
      chatgptPlanType: "pro",
    });
    expect(result).toEqual({
      type: "chatgptAuthTokens",
    });
  });
});

describe("AppServerClient.cancelAccountLogin", () => {
  it("sends account/login/cancel with login identifier and returns cancel status", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      status: "canceled",
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.cancelAccountLogin({
      loginId: "login-1",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("account/login/cancel", {
      loginId: "login-1",
    });
    expect(result).toEqual({
      status: "canceled",
    });
  });
});

describe("AppServerClient.logoutAccount", () => {
  it("sends account/logout with empty parameters", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({});

    const client = new AppServerClient(transportDouble.transport);
    await client.logoutAccount();

    expect(transportDouble.request).toHaveBeenCalledWith("account/logout", {});
  });
});

describe("AppServerClient.reloadMcpServerConfig", () => {
  it("sends config/mcpServer/reload with empty parameters", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({});

    const client = new AppServerClient(transportDouble.transport);
    await client.reloadMcpServerConfig();

    expect(transportDouble.request).toHaveBeenCalledWith("config/mcpServer/reload", {});
  });
});

describe("AppServerClient.startMcpServerOauthLogin", () => {
  it("sends mcpServer/oauth/login payload and returns authorization url", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      authorizationUrl: "https://example.com/oauth/mcp",
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.startMcpServerOauthLogin({
      name: "github",
      scopes: ["read:org"],
      timeoutSeconds: 120,
    });

    expect(transportDouble.request).toHaveBeenCalledWith("mcpServer/oauth/login", {
      name: "github",
      scopes: ["read:org"],
      timeoutSecs: 120,
    });
    expect(result).toEqual({
      authorizationUrl: "https://example.com/oauth/mcp",
    });
  });
});

describe("AppServerClient.writeSkillsConfig", () => {
  it("sends skills/config/write payload and returns effective enabled state", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      effectiveEnabled: true,
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.writeSkillsConfig({
      path: "/tmp/workspace/.codex/skills/checks/SKILL.md",
      enabled: true,
    });

    expect(transportDouble.request).toHaveBeenCalledWith("skills/config/write", {
      path: "/tmp/workspace/.codex/skills/checks/SKILL.md",
      enabled: true,
    });
    expect(result).toEqual({
      effectiveEnabled: true,
    });
  });
});

describe("AppServerClient.listRemoteSkills", () => {
  it("sends skills/remote/list payload and returns remote skill summaries", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      data: [
        {
          id: "remote-skill-1",
          name: "Repository checks",
          description: "Run checks before review",
        },
      ],
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.listRemoteSkills({
      hazelnutScope: "personal",
      productSurface: "codex",
      enabled: true,
    });

    expect(transportDouble.request).toHaveBeenCalledWith("skills/remote/list", {
      hazelnutScope: "personal",
      productSurface: "codex",
      enabled: true,
    });
    expect(result).toEqual({
      data: [
        {
          id: "remote-skill-1",
          name: "Repository checks",
          description: "Run checks before review",
        },
      ],
    });
  });
});

describe("AppServerClient.exportRemoteSkill", () => {
  it("sends skills/remote/export payload and returns exported local path", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      id: "remote-skill-1",
      path: "/tmp/workspace/.codex/skills/repository-checks/SKILL.md",
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.exportRemoteSkill({
      hazelnutId: "remote-skill-1",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("skills/remote/export", {
      hazelnutId: "remote-skill-1",
    });
    expect(result).toEqual({
      id: "remote-skill-1",
      path: "/tmp/workspace/.codex/skills/repository-checks/SKILL.md",
    });
  });
});

describe("AppServerClient.detectExternalAgentConfig", () => {
  it("sends externalAgentConfig/detect payload and maps migration items", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      items: [
        {
          itemType: "AGENTS_MD",
          description: "Migrate AGENTS.md from ~/.claude",
          cwd: null,
        },
        {
          itemType: "CONFIG",
          description: "Import repository config",
          cwd: "/tmp/workspace",
        },
      ],
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.detectExternalAgentConfig({
      includeHome: true,
      cwds: ["/tmp/workspace"],
    });

    expect(transportDouble.request).toHaveBeenCalledWith("externalAgentConfig/detect", {
      includeHome: true,
      cwds: ["/tmp/workspace"],
    });
    expect(result).toEqual({
      items: [
        {
          itemType: "AGENTS_MD",
          description: "Migrate AGENTS.md from ~/.claude",
          cwd: null,
        },
        {
          itemType: "CONFIG",
          description: "Import repository config",
          cwd: "/tmp/workspace",
        },
      ],
    });
  });
});

describe("AppServerClient.importExternalAgentConfig", () => {
  it("sends externalAgentConfig/import payload with migration items", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({});

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.importExternalAgentConfig({
      migrationItems: [
        {
          itemType: "AGENTS_MD",
          description: "Migrate AGENTS.md from ~/.claude",
          cwd: null,
        },
        {
          itemType: "CONFIG",
          description: "Import repository config",
          cwd: "/tmp/workspace",
        },
      ],
    });

    expect(transportDouble.request).toHaveBeenCalledWith("externalAgentConfig/import", {
      migrationItems: [
        {
          itemType: "AGENTS_MD",
          description: "Migrate AGENTS.md from ~/.claude",
          cwd: null,
        },
        {
          itemType: "CONFIG",
          description: "Import repository config",
          cwd: "/tmp/workspace",
        },
      ],
    });
    expect(result).toEqual({});
  });
});

describe("AppServerClient.startThreadRealtime", () => {
  it("sends thread/realtime/start payload", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({});

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.startThreadRealtime({
      threadId: "thread-1",
      prompt: "Summarize the repository health.",
      sessionId: "session-1",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("thread/realtime/start", {
      threadId: "thread-1",
      prompt: "Summarize the repository health.",
      sessionId: "session-1",
    });
    expect(result).toEqual({});
  });
});

describe("AppServerClient.appendThreadRealtimeText", () => {
  it("sends thread/realtime/appendText payload", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({});

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.appendThreadRealtimeText({
      threadId: "thread-1",
      text: "Continue with concrete implementation details.",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("thread/realtime/appendText", {
      threadId: "thread-1",
      text: "Continue with concrete implementation details.",
    });
    expect(result).toEqual({});
  });
});

describe("AppServerClient.stopThreadRealtime", () => {
  it("sends thread/realtime/stop payload", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({});

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.stopThreadRealtime({
      threadId: "thread-1",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("thread/realtime/stop", {
      threadId: "thread-1",
    });
    expect(result).toEqual({});
  });
});

describe("AppServerClient.startWindowsSandboxSetup", () => {
  it("sends windowsSandbox/setupStart payload and maps started response", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      started: true,
    });

    const client = new AppServerClient(transportDouble.transport);
    const result = await client.startWindowsSandboxSetup({
      mode: "elevated",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("windowsSandbox/setupStart", {
      mode: "elevated",
    });
    expect(result).toEqual({
      started: true,
    });
  });
});

describe("AppServerClient.listThreadsAll", () => {
  it("starts pagination from an explicit initial cursor", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      data: [createThreadListItem("thread-1")],
      nextCursor: null,
    });

    const client = new AppServerClient(transportDouble.transport);
    const response = await client.listThreadsAll({
      limit: 1,
      archived: false,
      cursor: "cursor-start",
      maxPages: 5,
    });

    expect(transportDouble.request).toHaveBeenCalledWith("thread/list", {
      limit: 1,
      archived: false,
      cursor: "cursor-start",
    });
    expect(response).toEqual({
      data: [createThreadListItem("thread-1")],
      nextCursor: null,
      pages: 1,
      truncated: false,
    });
  });

  it("preserves explicit empty initial cursor and cwd values", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      data: [createThreadListItem("thread-1")],
      nextCursor: null,
    });

    const client = new AppServerClient(transportDouble.transport);
    await client.listThreadsAll({
      limit: 1,
      archived: false,
      cursor: "",
      cwd: "",
      maxPages: 1,
    });

    expect(transportDouble.request).toHaveBeenCalledWith("thread/list", {
      limit: 1,
      archived: false,
      cursor: "",
      cwd: "",
    });
  });

  it("aggregates pages until nextCursor is null", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request
      .mockResolvedValueOnce({
        data: [createThreadListItem("thread-1")],
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        data: [createThreadListItem("thread-2")],
        nextCursor: null,
      });

    const client = new AppServerClient(transportDouble.transport);
    const response = await client.listThreadsAll({
      limit: 1,
      archived: false,
      maxPages: 5,
      sortKey: "updated_at",
      cwd: "/tmp/workspace",
    });

    expect(response).toEqual({
      data: [createThreadListItem("thread-1"), createThreadListItem("thread-2")],
      nextCursor: null,
      pages: 2,
      truncated: false,
    });
    expect(transportDouble.request).toHaveBeenNthCalledWith(1, "thread/list", {
      limit: 1,
      archived: false,
      cursor: null,
      sortKey: "updated_at",
      cwd: "/tmp/workspace",
    });
    expect(transportDouble.request).toHaveBeenNthCalledWith(2, "thread/list", {
      limit: 1,
      archived: false,
      cursor: "cursor-1",
      sortKey: "updated_at",
      cwd: "/tmp/workspace",
    });
  });

  it("returns truncated responses when maxPages is reached", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request
      .mockResolvedValueOnce({
        data: [createThreadListItem("thread-1")],
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        data: [createThreadListItem("thread-2")],
        nextCursor: "cursor-2",
      });

    const client = new AppServerClient(transportDouble.transport);
    const response = await client.listThreadsAll({
      limit: 1,
      archived: true,
      maxPages: 2,
    });

    expect(response).toEqual({
      data: [createThreadListItem("thread-1"), createThreadListItem("thread-2")],
      nextCursor: "cursor-2",
      pages: 2,
      truncated: true,
    });
  });

  it("stops pagination when the page is empty", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      data: [],
      nextCursor: "cursor-ignored",
    });

    const client = new AppServerClient(transportDouble.transport);
    const response = await client.listThreadsAll({
      limit: 5,
      archived: false,
      maxPages: 3,
    });

    expect(response).toEqual({
      data: [],
      nextCursor: null,
      pages: 1,
      truncated: false,
    });
  });
});

describe("AppServerClient.readThread", () => {
  it("uses an extended timeout when includeTurns is omitted", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue(createThreadConversationResponse("thread-1"));

    const client = new AppServerClient(transportDouble.transport);
    await client.readThread("thread-1");

    expect(transportDouble.request).toHaveBeenCalledWith(
      "thread/read",
      {
        threadId: "thread-1",
        includeTurns: true,
      },
      90_000,
    );
  });

  it("uses default timeout when includeTurns is false", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue(createThreadConversationResponse("thread-1"));

    const client = new AppServerClient(transportDouble.transport);
    await client.readThread("thread-1", false);

    expect(transportDouble.request).toHaveBeenCalledWith(
      "thread/read",
      {
        threadId: "thread-1",
        includeTurns: false,
      },
      undefined,
    );
  });
});

describe("AppServerClient.readConfig", () => {
  it("requests config/read with includeLayers=false by default", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      config: {},
    });

    const client = new AppServerClient(transportDouble.transport);
    await client.readConfig();

    expect(transportDouble.request).toHaveBeenCalledWith("config/read", {
      includeLayers: false,
    });
  });

  it("passes includeLayers=true when requested", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      config: {
        model: "gpt-5.3-codex",
        model_reasoning_effort: "medium",
        profile: "default",
        profiles: {},
      },
    });

    const client = new AppServerClient(transportDouble.transport);
    await client.readConfig({ includeLayers: true });

    expect(transportDouble.request).toHaveBeenCalledWith("config/read", {
      includeLayers: true,
    });
  });
});

describe("AppServerClient.unarchiveThread", () => {
  it("sends thread/unarchive and parses response", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      thread: createThreadListItem("thread-1"),
    });

    const client = new AppServerClient(transportDouble.transport);
    const thread = await client.unarchiveThread("thread-1");

    expect(transportDouble.request).toHaveBeenCalledWith("thread/unarchive", {
      threadId: "thread-1",
    });
    expect(thread.id).toBe("thread-1");
    expect(thread.preview).toBe("Thread thread-1");
  });
});

describe("AppServerClient.request and validation behavior", () => {
  it("sends startThread request payload and parses typed response", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      thread: createThreadListItem("thread-started"),
      model: "gpt-5.3-codex",
      modelProvider: "openai",
      cwd: "/tmp/workspace",
    });

    const client = new AppServerClient(transportDouble.transport);

    const response = await client.startThread({
      cwd: "/tmp/workspace",
      model: "gpt-5.3-codex",
      approvalPolicy: "never",
    });

    expect(transportDouble.request).toHaveBeenCalledWith("thread/start", {
      cwd: "/tmp/workspace",
      model: "gpt-5.3-codex",
      approvalPolicy: "never",
    });
    expect(response.thread.id).toBe("thread-started");
    expect(response.model).toBe("gpt-5.3-codex");
  });

  it("validates archiveThread input before transport request", async () => {
    const transportDouble = createTransportDouble();
    const client = new AppServerClient(transportDouble.transport);

    await expect(client.archiveThread("")).rejects.toThrowError();
    expect(transportDouble.request).not.toHaveBeenCalled();
  });

  it("throws protocol validation errors for invalid model/list responses", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      invalid: true,
    });

    const client = new AppServerClient(transportDouble.transport);
    await expect(client.listModels()).rejects.toBeInstanceOf(ProtocolValidationError);
    expect(transportDouble.request).toHaveBeenCalledWith("model/list", {
      limit: 100,
    });
  });

  it("delegates close calls to transport", async () => {
    const transportDouble = createTransportDouble();
    const client = new AppServerClient(transportDouble.transport);

    await client.close();
    expect(transportDouble.close).toHaveBeenCalledTimes(1);
  });
});
