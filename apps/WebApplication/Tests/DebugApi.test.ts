import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DEBUG_LIST_LIMIT,
  getDebugClientError,
  getHistoryEntry,
  getTraceStatus,
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
  it("projects trace-status payloads to strict app-owned contracts", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        active: {
          id: "trace-active",
          label: "active trace",
          startedAt: "2026-02-26T00:00:00.000Z",
          stoppedAt: null,
          eventCount: 4,
          path: "/tmp/trace-active.ndjson",
          extraKey: "ignored"
        },
        recent: [
          {
            id: "trace-recent",
            label: "recent trace",
            startedAt: "2026-02-26T00:01:00.000Z",
            stoppedAt: "2026-02-26T00:02:00.000Z",
            eventCount: 2,
            path: "/tmp/trace-recent.ndjson",
            extraKey: "ignored"
          }
        ],
        topLevelExtra: "ignored"
      })
    );

    const result = await getTraceStatus();

    expect(result).toEqual({
      ok: true,
      active: {
        id: "trace-active",
        label: "active trace",
        startedAt: "2026-02-26T00:00:00.000Z",
        stoppedAt: null,
        eventCount: 4,
        path: "/tmp/trace-active.ndjson"
      },
      recent: [
        {
          id: "trace-recent",
          label: "recent trace",
          startedAt: "2026-02-26T00:01:00.000Z",
          stoppedAt: "2026-02-26T00:02:00.000Z",
          eventCount: 2,
          path: "/tmp/trace-recent.ndjson"
        }
      ]
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("projects debug-history payloads to strict app-owned contracts", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        history: [
          {
            id: "history-1",
            at: "2026-02-26T00:00:00.000Z",
            source: "app",
            direction: "in",
            payload: {
              kind: "message"
            },
            meta: {
              requestId: "request-1"
            },
            extraKey: "ignored"
          }
        ],
        topLevelExtra: "ignored"
      })
    );

    const result = await listDebugHistory(1);

    expect(result).toEqual({
      ok: true,
      history: [
        {
          id: "history-1",
          at: "2026-02-26T00:00:00.000Z",
          source: "app",
          direction: "in",
          payload: {
            kind: "message"
          },
          meta: {
            requestId: "request-1"
          }
        }
      ]
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

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

  it("rejects history-entry reads with blank entry identifiers before issuing a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(getHistoryEntry("")).rejects.toThrowError();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects debug-error reads with blank identifiers before issuing a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(getDebugClientError("")).rejects.toThrowError();

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
