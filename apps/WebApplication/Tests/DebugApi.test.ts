import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DEBUG_LIST_LIMIT,
  listDebugClientErrors,
  listDebugHistory,
  replayHistoryEntry
} from "@/Features/Debugging/DataAccess/DebugApi";
import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";

function createJsonResponse(body: StructuredDataValue): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DebugApi", () => {
  it("uses the default history query limit when no limit is provided", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        history: []
      })
    );

    await listDebugHistory();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/debug/history?limit=${String(DEFAULT_DEBUG_LIST_LIMIT)}`);
  });

  it("rejects invalid debug-history limits before issuing a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(listDebugHistory(0)).rejects.toThrowError();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid debug-error limits before issuing a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(listDebugClientErrors(2_500)).rejects.toThrowError();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects replay requests with blank entry identifiers before issuing a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      replayHistoryEntry({
        entryId: "   ",
        waitForResponse: true
      })
    ).rejects.toThrowError();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects debug-error responses when action detail fields violate schema", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        data: [
          {
            errorId: "error-1",
            sessionId: "session-1",
            origin: "client",
            source: "farfield-web",
            operation: "send-message",
            message: "Request failed",
            severity: "error",
            name: null,
            stack: null,
            requestId: null,
            threadId: null,
            url: null,
            occurredAt: "2026-02-26T00:00:00.000Z",
            recordedAt: "2026-02-26T00:00:00.000Z",
            details: {
              actionId: 42
            }
          }
        ],
        sessionId: "session-1",
        sessionLogPath: "/tmp/session.ndjson"
      })
    );

    await expect(listDebugClientErrors()).rejects.toThrowError();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
