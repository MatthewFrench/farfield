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
      queueDelayMs: 2,
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
      completedAt: "2026-02-25T00:00:00.000Z",
    });

    owner.recordRequestStarted({
      requestId: "request_2",
      actionId: null,
      actionName: null,
      method: "GET",
      pathname: "/api/threads/thread_123",
      startedAt: "2026-02-25T00:00:01.000Z",
      queueDelayMs: 5,
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
      completedAt: "2026-02-25T00:00:01.000Z",
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
      statusCode: 503,
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
      queueDelayMs: 1,
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
      completedAt: "2026-02-25T00:00:00.005Z",
    });
    owner.recordRequestStarted({
      requestId: "request_2",
      actionId: null,
      actionName: null,
      method: "GET",
      pathname: "/api/health",
      startedAt: "2026-02-25T00:00:01.000Z",
      queueDelayMs: 0,
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
      completedAt: "2026-02-25T00:00:01.004Z",
    });

    const snapshot = owner.readSnapshot();
    expect(snapshot.requestLifecycleEvents).toEqual([
      expect.objectContaining({
        phase: "completed",
        requestId: "request_1",
      }),
      expect.objectContaining({
        phase: "started",
        requestId: "request_2",
      }),
      expect.objectContaining({
        phase: "completed",
        requestId: "request_2",
      }),
    ]);
  });

  it("normalizes metrics route paths with explicit debug and thread route classification", () => {
    const owner = new RequestObservabilityOwner(8, 8, 16);
    const observations = [
      {
        requestId: "request_1",
        method: "GET",
        pathname: "/api/debug/client-errors/session-log",
        durationMs: 10,
      },
      {
        requestId: "request_2",
        method: "GET",
        pathname: "/api/debug/client-errors/error_identifier",
        durationMs: 11,
      },
      {
        requestId: "request_3",
        method: "GET",
        pathname: "/api/debug/history/history_entry_1",
        durationMs: 12,
      },
      {
        requestId: "request_4",
        method: "GET",
        pathname: "/api/debug/trace/1700000000000-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/download",
        durationMs: 13,
      },
      {
        requestId: "request_5",
        method: "POST",
        pathname: "/api/threads/thread_123/messages",
        durationMs: 14,
      },
      {
        requestId: "request_6",
        method: "GET",
        pathname: "/api/debug/replay/0123456789abcdef",
        durationMs: 15,
      },
    ];

    for (const observation of observations) {
      owner.recordRequestStarted({
        requestId: observation.requestId,
        actionId: null,
        actionName: null,
        method: observation.method,
        pathname: observation.pathname,
        startedAt: "2026-02-25T00:00:00.000Z",
        queueDelayMs: 0,
      });
      owner.recordRequestCompleted({
        requestId: observation.requestId,
        actionId: null,
        actionName: null,
        method: observation.method,
        pathname: observation.pathname,
        startedAt: "2026-02-25T00:00:00.000Z",
        statusCode: 200,
        durationMs: observation.durationMs,
        queueDelayMs: 0,
        completedAt: "2026-02-25T00:00:00.001Z",
      });
    }

    const snapshot = owner.readSnapshot();
    const routeTimingByMethodAndRoute = new Map(
      snapshot.routeTimings.map((routeTiming) => [
        `${routeTiming.method} ${routeTiming.route}`,
        routeTiming,
      ]),
    );

    expect(
      routeTimingByMethodAndRoute.get("GET /api/debug/client-errors/session-log")?.requestCount,
    ).toBe(1);
    expect(
      routeTimingByMethodAndRoute.get("GET /api/debug/client-errors/:clientErrorId")?.requestCount,
    ).toBe(1);
    expect(
      routeTimingByMethodAndRoute.get("GET /api/debug/history/:historyEntryId")?.requestCount,
    ).toBe(1);
    expect(
      routeTimingByMethodAndRoute.get("GET /api/debug/trace/:traceId/download")?.requestCount,
    ).toBe(1);
    expect(
      routeTimingByMethodAndRoute.get("POST /api/threads/:threadId/messages")?.requestCount,
    ).toBe(1);
    expect(routeTimingByMethodAndRoute.get("GET /api/debug/replay/:id")?.requestCount).toBe(1);
  });

  it("normalizes lifecycle pathnames before storing start and completion events", () => {
    const owner = new RequestObservabilityOwner(8, 8, 16);
    const rawPathname = "https://example.test/api/threads/thread_123/messages?include=history";

    owner.recordRequestStarted({
      requestId: "request_1",
      actionId: null,
      actionName: null,
      method: "POST",
      pathname: rawPathname,
      startedAt: "2026-02-25T00:00:00.000Z",
      queueDelayMs: 1,
    });
    owner.recordRequestCompleted({
      requestId: "request_1",
      actionId: null,
      actionName: null,
      method: "POST",
      pathname: rawPathname,
      startedAt: "2026-02-25T00:00:00.000Z",
      statusCode: 200,
      durationMs: 12,
      queueDelayMs: 1,
      completedAt: "2026-02-25T00:00:00.012Z",
    });

    const snapshot = owner.readSnapshot();
    expect(snapshot.requestLifecycleEvents[0]).toMatchObject({
      phase: "started",
      pathname: "/api/threads/thread_123/messages",
    });
    expect(snapshot.requestLifecycleEvents[1]).toMatchObject({
      phase: "completed",
      pathname: "/api/threads/thread_123/messages",
      outcome: "success",
    });
    expect(snapshot.routeTimings[0]?.route).toBe("/api/threads/:threadId/messages");
  });

  it("bounds tracked route timing entries and retains recently touched routes", () => {
    const owner = new RequestObservabilityOwner(8, 8, 16, 2);
    const routeObservations = [
      {
        requestId: "request_a1",
        pathname: "/route-a",
        durationMs: 10,
      },
      {
        requestId: "request_b1",
        pathname: "/route-b",
        durationMs: 11,
      },
      {
        requestId: "request_a2",
        pathname: "/route-a",
        durationMs: 12,
      },
      {
        requestId: "request_c1",
        pathname: "/route-c",
        durationMs: 13,
      },
    ];

    for (const routeObservation of routeObservations) {
      owner.recordRequestStarted({
        requestId: routeObservation.requestId,
        actionId: null,
        actionName: null,
        method: "GET",
        pathname: routeObservation.pathname,
        startedAt: "2026-02-25T00:00:00.000Z",
        queueDelayMs: 0,
      });
      owner.recordRequestCompleted({
        requestId: routeObservation.requestId,
        actionId: null,
        actionName: null,
        method: "GET",
        pathname: routeObservation.pathname,
        startedAt: "2026-02-25T00:00:00.000Z",
        statusCode: 200,
        durationMs: routeObservation.durationMs,
        queueDelayMs: 0,
        completedAt: "2026-02-25T00:00:00.001Z",
      });
    }

    const snapshot = owner.readSnapshot();
    const routeTimingByRoute = new Map(
      snapshot.routeTimings.map((routeTiming) => [routeTiming.route, routeTiming]),
    );

    expect(snapshot.routeTimings).toHaveLength(2);
    expect(routeTimingByRoute.has("/route-a")).toBe(true);
    expect(routeTimingByRoute.has("/route-b")).toBe(false);
    expect(routeTimingByRoute.has("/route-c")).toBe(true);
    expect(routeTimingByRoute.get("/route-a")?.requestCount).toBe(2);
    expect(routeTimingByRoute.get("/route-c")?.requestCount).toBe(1);
  });

  it("uses rolling route sample windows for percentile metrics", () => {
    const owner = new RequestObservabilityOwner(3, 8, 16);
    const routeObservations = [
      {
        requestId: "request_1",
        durationMs: 10,
        queueDelayMs: 1,
      },
      {
        requestId: "request_2",
        durationMs: 20,
        queueDelayMs: 2,
      },
      {
        requestId: "request_3",
        durationMs: 30,
        queueDelayMs: 3,
      },
      {
        requestId: "request_4",
        durationMs: 40,
        queueDelayMs: 4,
      },
    ];

    for (const routeObservation of routeObservations) {
      owner.recordRequestStarted({
        requestId: routeObservation.requestId,
        actionId: null,
        actionName: null,
        method: "GET",
        pathname: "/api/health",
        startedAt: "2026-02-25T00:00:00.000Z",
        queueDelayMs: routeObservation.queueDelayMs,
      });
      owner.recordRequestCompleted({
        requestId: routeObservation.requestId,
        actionId: null,
        actionName: null,
        method: "GET",
        pathname: "/api/health",
        startedAt: "2026-02-25T00:00:00.000Z",
        statusCode: 200,
        durationMs: routeObservation.durationMs,
        queueDelayMs: routeObservation.queueDelayMs,
        completedAt: "2026-02-25T00:00:00.001Z",
      });
    }

    const snapshot = owner.readSnapshot();
    expect(snapshot.routeTimings[0]).toMatchObject({
      route: "/api/health",
      requestCount: 4,
      lastDurationMs: 40,
      p50DurationMs: 30,
      p95DurationMs: 40,
      p99DurationMs: 40,
      lastQueueDelayMs: 4,
      p95QueueDelayMs: 4,
      maxQueueDelayMs: 4,
    });
  });

  it("sorts route timing summaries by p95 duration and then request volume", () => {
    const owner = new RequestObservabilityOwner(8, 8, 16);
    const routeObservations = [
      {
        requestId: "request_slow_1",
        pathname: "/slow-route",
        durationMs: 60,
      },
      {
        requestId: "request_tied_high_1",
        pathname: "/tied-high-volume-route",
        durationMs: 40,
      },
      {
        requestId: "request_tied_high_2",
        pathname: "/tied-high-volume-route",
        durationMs: 40,
      },
      {
        requestId: "request_tied_low_1",
        pathname: "/tied-low-volume-route",
        durationMs: 40,
      },
    ];

    for (const routeObservation of routeObservations) {
      owner.recordRequestStarted({
        requestId: routeObservation.requestId,
        actionId: null,
        actionName: null,
        method: "GET",
        pathname: routeObservation.pathname,
        startedAt: "2026-02-25T00:00:00.000Z",
        queueDelayMs: 0,
      });
      owner.recordRequestCompleted({
        requestId: routeObservation.requestId,
        actionId: null,
        actionName: null,
        method: "GET",
        pathname: routeObservation.pathname,
        startedAt: "2026-02-25T00:00:00.000Z",
        statusCode: 200,
        durationMs: routeObservation.durationMs,
        queueDelayMs: 0,
        completedAt: "2026-02-25T00:00:00.001Z",
      });
    }

    const snapshot = owner.readSnapshot();
    expect(snapshot.routeTimings.map((routeTiming) => routeTiming.route)).toEqual([
      "/slow-route",
      "/tied-high-volume-route",
      "/tied-low-volume-route",
    ]);
  });

  it("rejects non-positive route timing entry limits", () => {
    expect(() => new RequestObservabilityOwner(8, 8, 16, 0)).toThrowError(
      "RequestObservabilityOwner requires positive integer maxRouteTimingEntries",
    );
  });
});
