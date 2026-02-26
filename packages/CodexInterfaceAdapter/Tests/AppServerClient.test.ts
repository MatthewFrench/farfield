import { ProtocolValidationError, type JsonValue } from "@farfield/protocol";
import { describe, expect, it, vi, type Mock } from "vitest";
import { AppServerClient } from "../Source/AppServerClient.js";
import type { AppServerTransport } from "../Source/AppServerTransport.js";

type AppServerRequestFunction = (
  method: string,
  params: object,
  timeoutMs?: number
) => Promise<JsonValue>;
type AppServerCloseFunction = () => Promise<void>;
type AppServerRequestMock = Mock<AppServerRequestFunction>;
type AppServerCloseMock = Mock<AppServerCloseFunction>;

interface AppServerTransportDouble {
  transport: AppServerTransport;
  request: AppServerRequestMock;
  close: AppServerCloseMock;
}

function createTransportDouble(): AppServerTransportDouble {
  const request: AppServerRequestMock = vi.fn<AppServerRequestFunction>();
  request.mockResolvedValue({});

  const close: AppServerCloseMock = vi.fn<AppServerCloseFunction>();
  close.mockResolvedValue(undefined);

  const transport: AppServerTransport = {
    request,
    close
  };

  return {
    transport,
    request,
    close
  };
}

function createThreadConversationResponse(threadId: string): JsonValue {
  return {
    thread: {
      id: threadId,
      turns: [],
      requests: []
    }
  };
}

function createThreadListItem(threadId: string): JsonValue {
  return {
    id: threadId,
    preview: `Thread ${threadId}`,
    createdAt: 1,
    updatedAt: 2,
    source: "opencode",
    cwd: "/tmp/workspace"
  };
}

describe("AppServerClient.sendUserMessage", () => {
  it("sends the expected request payload", async () => {
    const transportDouble = createTransportDouble();
    const client = new AppServerClient(transportDouble.transport);
    await client.sendUserMessage("thread-1", "hello");

    expect(transportDouble.request).toHaveBeenCalledWith("sendUserMessage", {
      conversationId: "thread-1",
      items: [
        {
          type: "text",
          data: {
            text: "hello"
          }
        }
      ]
    });
  });

  it("accepts response when server adds extra keys", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      ok: true
    });

    const client = new AppServerClient(transportDouble.transport);
    await expect(client.sendUserMessage("thread-1", "hello")).resolves.toBeUndefined();
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
      persistExtendedHistory: true
    });
  });

  it("respects explicit persistExtendedHistory=false", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue(createThreadConversationResponse("thread-1"));

    const client = new AppServerClient(transportDouble.transport);
    await client.resumeThread("thread-1", {
      persistExtendedHistory: false
    });

    expect(transportDouble.request).toHaveBeenCalledWith("thread/resume", {
      threadId: "thread-1",
      persistExtendedHistory: false
    });
  });
});

describe("AppServerClient.listThreads", () => {
  it("passes sortKey and cwd when provided", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      data: [],
      nextCursor: null
    });

    const client = new AppServerClient(transportDouble.transport);
    await client.listThreads({
      limit: 50,
      archived: false,
      sortKey: "updated_at",
      cwd: "/tmp/workspace"
    });

    expect(transportDouble.request).toHaveBeenCalledWith("thread/list", {
      limit: 50,
      archived: false,
      cursor: null,
      sortKey: "updated_at",
      cwd: "/tmp/workspace"
    });
  });

  it("throws protocol validation errors when list response shape is invalid", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      invalid: true
    });

    const client = new AppServerClient(transportDouble.transport);
    await expect(
      client.listThreads({
        limit: 10,
        archived: false
      })
    ).rejects.toBeInstanceOf(ProtocolValidationError);
  });
});

describe("AppServerClient.listThreadsAll", () => {
  it("starts pagination from an explicit initial cursor", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      data: [createThreadListItem("thread-1")],
      nextCursor: null
    });

    const client = new AppServerClient(transportDouble.transport);
    const response = await client.listThreadsAll({
      limit: 1,
      archived: false,
      cursor: "cursor-start",
      maxPages: 5
    });

    expect(transportDouble.request).toHaveBeenCalledWith("thread/list", {
      limit: 1,
      archived: false,
      cursor: "cursor-start"
    });
    expect(response).toEqual({
      data: [createThreadListItem("thread-1")],
      nextCursor: null,
      pages: 1,
      truncated: false
    });
  });

  it("aggregates pages until nextCursor is null", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request
      .mockResolvedValueOnce({
        data: [createThreadListItem("thread-1")],
        nextCursor: "cursor-1"
      })
      .mockResolvedValueOnce({
        data: [createThreadListItem("thread-2")],
        nextCursor: null
      });

    const client = new AppServerClient(transportDouble.transport);
    const response = await client.listThreadsAll({
      limit: 1,
      archived: false,
      maxPages: 5,
      sortKey: "updated_at",
      cwd: "/tmp/workspace"
    });

    expect(response).toEqual({
      data: [createThreadListItem("thread-1"), createThreadListItem("thread-2")],
      nextCursor: null,
      pages: 2,
      truncated: false
    });
    expect(transportDouble.request).toHaveBeenNthCalledWith(1, "thread/list", {
      limit: 1,
      archived: false,
      cursor: null,
      sortKey: "updated_at",
      cwd: "/tmp/workspace"
    });
    expect(transportDouble.request).toHaveBeenNthCalledWith(2, "thread/list", {
      limit: 1,
      archived: false,
      cursor: "cursor-1",
      sortKey: "updated_at",
      cwd: "/tmp/workspace"
    });
  });

  it("returns truncated responses when maxPages is reached", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request
      .mockResolvedValueOnce({
        data: [createThreadListItem("thread-1")],
        nextCursor: "cursor-1"
      })
      .mockResolvedValueOnce({
        data: [createThreadListItem("thread-2")],
        nextCursor: "cursor-2"
      });

    const client = new AppServerClient(transportDouble.transport);
    const response = await client.listThreadsAll({
      limit: 1,
      archived: true,
      maxPages: 2
    });

    expect(response).toEqual({
      data: [createThreadListItem("thread-1"), createThreadListItem("thread-2")],
      nextCursor: "cursor-2",
      pages: 2,
      truncated: true
    });
  });

  it("stops pagination when the page is empty", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      data: [],
      nextCursor: "cursor-ignored"
    });

    const client = new AppServerClient(transportDouble.transport);
    const response = await client.listThreadsAll({
      limit: 5,
      archived: false,
      maxPages: 3
    });

    expect(response).toEqual({
      data: [],
      nextCursor: null,
      pages: 1,
      truncated: false
    });
  });
});

describe("AppServerClient.readThread", () => {
  it("uses an extended timeout when includeTurns is omitted", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue(createThreadConversationResponse("thread-1"));

    const client = new AppServerClient(transportDouble.transport);
    await client.readThread("thread-1");

    expect(transportDouble.request).toHaveBeenCalledWith("thread/read", {
      threadId: "thread-1",
      includeTurns: true
    }, 90_000);
  });

  it("uses default timeout when includeTurns is false", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue(createThreadConversationResponse("thread-1"));

    const client = new AppServerClient(transportDouble.transport);
    await client.readThread("thread-1", false);

    expect(transportDouble.request).toHaveBeenCalledWith("thread/read", {
      threadId: "thread-1",
      includeTurns: false
    }, undefined);
  });
});

describe("AppServerClient.readConfig", () => {
  it("requests config/read with includeLayers=false by default", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      config: {}
    });

    const client = new AppServerClient(transportDouble.transport);
    await client.readConfig();

    expect(transportDouble.request).toHaveBeenCalledWith("config/read", {
      includeLayers: false
    });
  });

  it("passes includeLayers=true when requested", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      config: {
        model: "gpt-5.3-codex",
        model_reasoning_effort: "medium",
        profile: "default",
        profiles: {}
      }
    });

    const client = new AppServerClient(transportDouble.transport);
    await client.readConfig({ includeLayers: true });

    expect(transportDouble.request).toHaveBeenCalledWith("config/read", {
      includeLayers: true
    });
  });
});

describe("AppServerClient.unarchiveThread", () => {
  it("sends thread/unarchive and parses response", async () => {
    const transportDouble = createTransportDouble();
    transportDouble.request.mockResolvedValue({
      thread: createThreadListItem("thread-1")
    });

    const client = new AppServerClient(transportDouble.transport);
    const thread = await client.unarchiveThread("thread-1");

    expect(transportDouble.request).toHaveBeenCalledWith("thread/unarchive", {
      threadId: "thread-1"
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
      cwd: "/tmp/workspace"
    });

    const client = new AppServerClient(transportDouble.transport);

    const response = await client.startThread({
      cwd: "/tmp/workspace",
      model: "gpt-5.3-codex",
      approvalPolicy: "never"
    });

    expect(transportDouble.request).toHaveBeenCalledWith("thread/start", {
      cwd: "/tmp/workspace",
      model: "gpt-5.3-codex",
      approvalPolicy: "never"
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
      invalid: true
    });

    const client = new AppServerClient(transportDouble.transport);
    await expect(client.listModels()).rejects.toBeInstanceOf(ProtocolValidationError);
    expect(transportDouble.request).toHaveBeenCalledWith("model/list", {
      limit: 100
    });
  });

  it("delegates close calls to transport", async () => {
    const transportDouble = createTransportDouble();
    const client = new AppServerClient(transportDouble.transport);

    await client.close();
    expect(transportDouble.close).toHaveBeenCalledTimes(1);
  });
});
