import { describe, expect, it } from "vitest";
import type { CapabilityThreadStreamEventsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { mapThreadStreamEventsResult } from "@/Features/Debugging/StateManagement/DebugAppServerCoverageThreadStreamEventMappers";

describe("DebugAppServerCoverageThreadStreamEventMappers", () => {
  it("maps broadcast envelope metadata and cursor contract fields", () => {
    const response: CapabilityThreadStreamEventsResponse = {
      ok: true,
      threadId: "thread-coverage-1",
      ownerClientId: "client-owner-1",
      events: [
        {
          type: "broadcast",
          method: "turn/completed",
          sourceClientId: "client-codex",
          params: {
            sequence: 11,
            receivedAtMilliseconds: 17_000,
            payload: {
              status: "done",
            },
          },
        },
      ],
      nextSequence: 12,
      firstAvailableSequence: 3,
      resetRequired: false,
    };

    const result = mapThreadStreamEventsResult(response, 10);

    expect(result.threadId).toBe("thread-coverage-1");
    expect(result.sinceSequence).toBe(10);
    expect(result.ownerClientId).toBe("client-owner-1");
    expect(result.eventCount).toBe(1);
    expect(result.nextSequence).toBe(12);
    expect(result.firstAvailableSequence).toBe(3);
    expect(result.resetRequired).toBe(false);
    expect(result.methodCounts).toEqual([
      {
        method: "turn/completed",
        count: 1,
      },
    ]);
    expect(result.readAtIso8601).toEqual(expect.any(String));
    expect(result.events).toEqual([
      {
        frameType: "broadcast",
        method: "turn/completed",
        requestId: null,
        sourceClientId: "client-codex",
        sequence: 11,
        receivedAtMilliseconds: 17_000,
        preview: expect.stringContaining('"status": "done"'),
      },
    ]);
  });

  it("maps request, response, and client-discovery frames with stable summaries", () => {
    const response: CapabilityThreadStreamEventsResponse = {
      ok: true,
      threadId: "thread-coverage-2",
      ownerClientId: null,
      events: [
        {
          type: "request",
          requestId: "request-1",
          method: "item/tool/call",
          params: {
            toolName: "readFile",
            path: "README.md",
          },
          sourceClientId: "client-router",
        },
        {
          type: "response",
          requestId: "request-1",
          handledByClientId: "client-worker",
          resultType: "error",
          error: {
            code: "permission_denied",
            message: "Denied",
          },
        },
        {
          type: "client-discovery-request",
          requestId: "discover-1",
          request: {
            type: "request",
            requestId: "request-discovery",
            method: "turn/start",
            sourceClientId: "client-router",
            params: {
              threadId: "thread-coverage-2",
            },
          },
        },
        {
          type: "client-discovery-response",
          requestId: "discover-1",
          response: {
            canHandle: true,
          },
        },
      ],
      nextSequence: 30,
      firstAvailableSequence: 1,
      resetRequired: false,
    };

    const result = mapThreadStreamEventsResult(response, null);

    expect(result.sinceSequence).toBeNull();
    expect(result.eventCount).toBe(4);
    expect(result.methodCounts).toEqual([
      {
        method: "item/tool/call",
        count: 1,
      },
      {
        method: "turn/start",
        count: 1,
      },
    ]);
    expect(result.events[0]).toEqual({
      frameType: "request",
      method: "item/tool/call",
      requestId: "request-1",
      sourceClientId: "client-router",
      sequence: null,
      receivedAtMilliseconds: null,
      preview: expect.stringContaining('"toolName": "readFile"'),
    });
    expect(result.events[1]).toEqual({
      frameType: "response",
      method: null,
      requestId: "request-1",
      sourceClientId: "client-worker",
      sequence: null,
      receivedAtMilliseconds: null,
      preview: expect.stringContaining('"permission_denied"'),
    });
    expect(result.events[2]).toEqual({
      frameType: "client-discovery-request",
      method: "turn/start",
      requestId: "discover-1",
      sourceClientId: "client-router",
      sequence: null,
      receivedAtMilliseconds: null,
      preview: expect.stringContaining('"thread-coverage-2"'),
    });
    expect(result.events[3]).toEqual({
      frameType: "client-discovery-response",
      method: null,
      requestId: "discover-1",
      sourceClientId: null,
      sequence: null,
      receivedAtMilliseconds: null,
      preview: expect.stringContaining('"canHandle": true'),
    });
  });
});
