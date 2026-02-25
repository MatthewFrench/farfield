import { describe, expect, it } from "vitest";
import { RequestObservabilityOwner } from "../Source/Network/RequestObservabilityOwner.js";

describe("RequestObservabilityOwner", () => {
  it("tracks route and startup request timing summaries", () => {
    const owner = new RequestObservabilityOwner(8, 8, 16);

    owner.recordRequestStarted({
      requestId: "request_1",
      actionId: "action_1",
      actionName: "startup-critical.threads.active",
      method: "GET",
      pathname: "/api/threads/thread_123",
      startedAt: "2026-02-25T00:00:00.000Z",
      queueDelayMs: 2
    });
    owner.recordRequestCompleted({
      requestId: "request_1",
      actionId: "action_1",
      actionName: "startup-critical.threads.active",
      method: "GET",
      pathname: "/api/threads/thread_123",
      startedAt: "2026-02-25T00:00:00.000Z",
      statusCode: 200,
      durationMs: 32,
      queueDelayMs: 2,
      completedAt: "2026-02-25T00:00:00.000Z"
    });

    owner.recordRequestStarted({
      requestId: "request_2",
      actionId: null,
      actionName: null,
      method: "GET",
      pathname: "/api/threads/thread_123",
      startedAt: "2026-02-25T00:00:01.000Z",
      queueDelayMs: 5
    });
    owner.recordRequestCompleted({
      requestId: "request_2",
      actionId: null,
      actionName: null,
      method: "GET",
      pathname: "/api/threads/thread_123",
      startedAt: "2026-02-25T00:00:01.000Z",
      statusCode: 503,
      durationMs: 78,
      queueDelayMs: 5,
      completedAt: "2026-02-25T00:00:01.000Z"
    });

    const snapshot = owner.readSnapshot();

    expect(snapshot.totalRequestCount).toBe(2);
    expect(snapshot.totalErrorCount).toBe(1);
    expect(snapshot.inFlightRequestCount).toBe(0);
    expect(snapshot.routeTimings[0]?.route).toBe("/api/threads/:threadId");
    expect(snapshot.routeTimings[0]?.requestCount).toBe(2);
    expect(snapshot.startupRequestTimings[0]?.actionName).toBe("startup-critical.threads.active");
    expect(snapshot.requestLifecycleEvents.length).toBe(4);
    expect(snapshot.requestLifecycleEvents[0]?.phase).toBe("started");
    expect(snapshot.requestLifecycleEvents[3]).toMatchObject({
      phase: "completed",
      requestId: "request_2",
      outcome: "error",
      statusCode: 503
    });
  });

  it("bounds request lifecycle timeline entries", () => {
    const owner = new RequestObservabilityOwner(8, 8, 3);
    owner.recordRequestStarted({
      requestId: "request_1",
      actionId: null,
      actionName: null,
      method: "GET",
      pathname: "/api/health",
      startedAt: "2026-02-25T00:00:00.000Z",
      queueDelayMs: 1
    });
    owner.recordRequestCompleted({
      requestId: "request_1",
      actionId: null,
      actionName: null,
      method: "GET",
      pathname: "/api/health",
      startedAt: "2026-02-25T00:00:00.000Z",
      statusCode: 200,
      durationMs: 5,
      queueDelayMs: 1,
      completedAt: "2026-02-25T00:00:00.005Z"
    });
    owner.recordRequestStarted({
      requestId: "request_2",
      actionId: null,
      actionName: null,
      method: "GET",
      pathname: "/api/health",
      startedAt: "2026-02-25T00:00:01.000Z",
      queueDelayMs: 0
    });
    owner.recordRequestCompleted({
      requestId: "request_2",
      actionId: null,
      actionName: null,
      method: "GET",
      pathname: "/api/health",
      startedAt: "2026-02-25T00:00:01.000Z",
      statusCode: 200,
      durationMs: 4,
      queueDelayMs: 0,
      completedAt: "2026-02-25T00:00:01.004Z"
    });

    const snapshot = owner.readSnapshot();
    expect(snapshot.requestLifecycleEvents).toEqual([
      expect.objectContaining({
        phase: "completed",
        requestId: "request_1"
      }),
      expect.objectContaining({
        phase: "started",
        requestId: "request_2"
      }),
      expect.objectContaining({
        phase: "completed",
        requestId: "request_2"
      })
    ]);
  });
});
