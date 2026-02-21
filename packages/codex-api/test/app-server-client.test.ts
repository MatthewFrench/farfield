import { describe, expect, it, vi } from "vitest";
import { AppServerClient } from "../src/app-server-client.js";
import type { AppServerTransport } from "../src/app-server-transport.js";

describe("AppServerClient.sendUserMessage", () => {
  it("sends the expected request payload", async () => {
    const transport: AppServerTransport = {
      request: vi.fn().mockResolvedValue({}),
      close: vi.fn().mockResolvedValue(undefined)
    };

    const client = new AppServerClient(transport);
    await client.sendUserMessage("thread-1", "hello");

    expect(transport.request).toHaveBeenCalledWith("sendUserMessage", {
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
    const transport: AppServerTransport = {
      request: vi.fn().mockResolvedValue({ ok: true }),
      close: vi.fn().mockResolvedValue(undefined)
    };

    const client = new AppServerClient(transport);
    await expect(client.sendUserMessage("thread-1", "hello")).resolves.toBeUndefined();
  });
});

describe("AppServerClient.resumeThread", () => {
  it("sends the expected resume request payload", async () => {
    const transport: AppServerTransport = {
      request: vi.fn().mockResolvedValue({
        thread: {
          id: "thread-1",
          turns: [],
          requests: []
        }
      }),
      close: vi.fn().mockResolvedValue(undefined)
    };

    const client = new AppServerClient(transport);
    await client.resumeThread("thread-1");

    expect(transport.request).toHaveBeenCalledWith("thread/resume", {
      threadId: "thread-1",
      persistExtendedHistory: true
    });
  });
});

describe("AppServerClient.listThreads", () => {
  it("passes sortKey and cwd when provided", async () => {
    const transport: AppServerTransport = {
      request: vi.fn().mockResolvedValue({
        data: [],
        nextCursor: null
      }),
      close: vi.fn().mockResolvedValue(undefined)
    };

    const client = new AppServerClient(transport);
    await client.listThreads({
      limit: 50,
      archived: false,
      sortKey: "updated_at",
      cwd: "/tmp/workspace"
    });

    expect(transport.request).toHaveBeenCalledWith("thread/list", {
      limit: 50,
      archived: false,
      cursor: null,
      sortKey: "updated_at",
      cwd: "/tmp/workspace"
    });
  });
});

describe("AppServerClient.readThread", () => {
  it("uses an extended timeout when includeTurns is true", async () => {
    const request = vi.fn().mockResolvedValue({
      thread: {
        id: "thread-1",
        turns: [],
        requests: []
      }
    });
    const transport: AppServerTransport = {
      request,
      close: vi.fn().mockResolvedValue(undefined)
    };

    const client = new AppServerClient(transport);
    await client.readThread("thread-1", true);

    expect(request).toHaveBeenCalledWith("thread/read", {
      threadId: "thread-1",
      includeTurns: true
    }, 90_000);
  });

  it("uses default timeout when includeTurns is false", async () => {
    const request = vi.fn().mockResolvedValue({
      thread: {
        id: "thread-1",
        turns: [],
        requests: []
      }
    });
    const transport: AppServerTransport = {
      request,
      close: vi.fn().mockResolvedValue(undefined)
    };

    const client = new AppServerClient(transport);
    await client.readThread("thread-1", false);

    expect(request).toHaveBeenCalledWith("thread/read", {
      threadId: "thread-1",
      includeTurns: false
    }, undefined);
  });
});

describe("AppServerClient.readConfig", () => {
  it("requests config/read with includeLayers=false by default", async () => {
    const transport: AppServerTransport = {
      request: vi.fn().mockResolvedValue({
        config: {}
      }),
      close: vi.fn().mockResolvedValue(undefined)
    };

    const client = new AppServerClient(transport);
    await client.readConfig();

    expect(transport.request).toHaveBeenCalledWith("config/read", {
      includeLayers: false
    });
  });

  it("passes includeLayers=true when requested", async () => {
    const transport: AppServerTransport = {
      request: vi.fn().mockResolvedValue({
        config: {
          model: "gpt-5.3-codex",
          model_reasoning_effort: "medium",
          profile: "default",
          profiles: {}
        }
      }),
      close: vi.fn().mockResolvedValue(undefined)
    };

    const client = new AppServerClient(transport);
    await client.readConfig({ includeLayers: true });

    expect(transport.request).toHaveBeenCalledWith("config/read", {
      includeLayers: true
    });
  });
});

describe("AppServerClient.unarchiveThread", () => {
  it("sends thread/unarchive and parses response", async () => {
    const transport: AppServerTransport = {
      request: vi.fn().mockResolvedValue({
        thread: {
          id: "thread-1",
          preview: "Recovered thread",
          createdAt: 1,
          updatedAt: 2,
          source: "opencode",
          cwd: "/tmp/workspace"
        }
      }),
      close: vi.fn().mockResolvedValue(undefined)
    };

    const client = new AppServerClient(transport);
    const thread = await client.unarchiveThread("thread-1");

    expect(transport.request).toHaveBeenCalledWith("thread/unarchive", {
      threadId: "thread-1"
    });
    expect(thread.id).toBe("thread-1");
    expect(thread.preview).toBe("Recovered thread");
  });
});
