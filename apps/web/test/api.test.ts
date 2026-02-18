import { afterEach, describe, expect, it, vi } from "vitest";
import { getDebugClientError } from "../src/lib/api";

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
});
