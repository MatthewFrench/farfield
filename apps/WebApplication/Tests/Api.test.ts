import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getConfigDefaults,
} from "../Source/Features/Capabilities/DataAccess/CapabilityApi";
import { getDebugClientError } from "../Source/Features/Debugging/DataAccess/DebugApi";
import { sendMessage } from "../Source/Features/Chat/DataAccess/ChatApi";
import {
  createThread,
  listThreads,
  unarchiveThread
} from "../Source/Features/Threads/DataAccess/ThreadApi";
import { bootstrapEventsSession } from "../Source/Application/DataAccess/WebShellApi";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("API envelope parsing", () => {
  it("accepts successful envelopes where detail payload has object-shaped error field", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        error: {
          errorId: "error_1",
          sessionId: "session_1",
          origin: "client",
          source: "web-app",
          operation: "debug:client-error-detail",
          message: "example",
          name: null,
          stack: null,
          requestId: null,
          threadId: null,
          url: null,
          occurredAt: "2026-02-18T00:00:00.000Z",
          recordedAt: "2026-02-18T00:00:01.000Z",
          details: {}
        },
        sessionId: "session_1",
        sessionLogPath: ".runtime/logs/errors/session-test.ndjson"
      })
    } as Response);

    const result = await getDebugClientError("error_1");
    expect(result.error.errorId).toBe("error_1");
    expect(result.sessionId).toBe("session_1");
  });

  it("throws server error message for non-ok envelopes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({
        ok: false,
        error: "Nope"
      })
    } as Response);

    await expect(getDebugClientError("error_1")).rejects.toThrow("Nope");
  });

  it("includes endpoint context when fetch throws before response", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("The string did not match the expected pattern.")
    );

    await expect(getDebugClientError("error_1")).rejects.toThrow(
      /Request failed for \/api\/debug\/client-errors\/error_1: The string did not match the expected pattern\. requestId /
    );
  });

  it("parses events session bootstrap response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        authRequired: true,
        bootstrapped: true,
        expiresAt: "2026-02-19T00:00:00.000Z"
      })
    } as Response);

    const result = await bootstrapEventsSession();
    expect(result.authRequired).toBe(true);
    expect(result.bootstrapped).toBe(true);
    expect(result.expiresAt).toBe("2026-02-19T00:00:00.000Z");
  });

  it("posts token payload for events session bootstrap when provided", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        authRequired: true,
        bootstrapped: true,
        expiresAt: "2026-02-19T00:00:00.000Z"
      })
    } as Response);

    await bootstrapEventsSession({
      apiToken: "token_123"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestInit?.method).toBe("POST");
    expect(new Headers(requestInit?.headers).get("Content-Type")).toBe("application/json");
    expect(String(requestInit?.body)).toBe(JSON.stringify({ apiToken: "token_123" }));
  });

  it("requests thread list with sortKey and cwd", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: [],
        nextCursor: null
      })
    } as Response);

    await listThreads({
      limit: 80,
      archived: false,
      all: true,
      maxPages: 20,
      sortKey: "updated_at",
      cwd: "/tmp/workspace"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    const parsedUrl = new URL(requestUrl, "http://localhost");
    expect(parsedUrl.pathname).toBe("/api/threads");
    expect(parsedUrl.searchParams.get("archived")).toBe("false");
    expect(parsedUrl.searchParams.get("all")).toBe("true");
    expect(parsedUrl.searchParams.get("sortKey")).toBe("updated_at");
    expect(parsedUrl.searchParams.get("cwd")).toBe("/tmp/workspace");
  });

  it("parses pagination metadata for thread list", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: [],
        nextCursor: "cursor_2",
        pages: 3,
        truncated: true
      })
    } as Response);

    const result = await listThreads({
      limit: 80,
      archived: true,
      all: true,
      maxPages: 20
    });

    expect(result.nextCursor).toBe("cursor_2");
    expect(result.pages).toBe(3);
    expect(result.truncated).toBe(true);
  });

  it("fails thread list parsing when required thread fields are invalid", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: [
          {
            id: "thread_1",
            preview: "hello",
            createdAt: 123,
            updatedAt: "not-a-number",
            agentId: "codex"
          }
        ],
        nextCursor: null
      })
    } as Response);

    await expect(
      listThreads({
        limit: 80,
        archived: false,
        all: true,
        maxPages: 20
      })
    ).rejects.toThrow(/updatedAt/);
  });

  it("parses config defaults response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        agentId: "codex",
        model: "gpt-5.3-codex",
        reasoningEffort: "xhigh"
      })
    } as Response);

    const result = await getConfigDefaults({ agentId: "codex" });
    expect(result.agentId).toBe("codex");
    expect(result.reasoningEffort).toBe("xhigh");
  });

  it("posts thread unarchive endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        threadId: "thread_123"
      })
    } as Response);

    await unarchiveThread("thread_123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(requestUrl).toBe("/api/threads/thread_123/unarchive");
  });

  it("returns strict create-thread response contract", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        threadId: "thread_123",
        agentId: "codex",
        thread: {
          id: "thread_123",
          preview: "hello",
          createdAt: 1,
          updatedAt: 1,
          cwd: "/tmp/workspace",
          cliVersion: "1.0.0",
          modelProvider: "openai",
          source: "cli",
          turns: []
        }
      })
    } as Response);

    const created = await createThread();
    expect(created).toEqual({
      threadId: "thread_123",
      agentId: "codex"
    });
  });

  it("succeeds for sendMessage when response has no JSON body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200
    } as Response);

    await sendMessage({
      threadId: "thread_123",
      text: "hello"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(requestUrl).toBe("/api/threads/thread_123/messages");
  });
});
