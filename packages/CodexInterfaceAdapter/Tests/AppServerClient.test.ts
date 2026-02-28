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
