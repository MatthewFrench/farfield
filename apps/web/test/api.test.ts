import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bootstrapEventsSession,
  getConfigDefaults,
  getDebugClientError,
  listThreads
} from "../src/lib/api";

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
      "Request failed for /api/debug/client-errors/error_1: The string did not match the expected pattern."
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
    expect(parsedUrl.searchParams.get("sortKey")).toBe("updated_at");
    expect(parsedUrl.searchParams.get("cwd")).toBe("/tmp/workspace");
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
});
