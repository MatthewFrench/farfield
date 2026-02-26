import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FarfieldEventStreamEvent } from "@farfield/protocol";
import { EventStreamClientRegistry } from "../Source/Network/EventStreamClientRegistry.js";

function createHttpPair(): { req: IncomingMessage; res: ServerResponse } {
  const req = new IncomingMessage(new Socket());
  req.method = "GET";
  req.url = "/events";
  const res = new ServerResponse(req);
  return { req, res };
}

function buildRuntimeStateChangedEvent(): FarfieldEventStreamEvent {
  return {
    type: "runtime-state-changed",
    state: {
      appReady: true,
      ipcConnected: true,
      ipcInitialized: true,
      workspaceDir: null,
      gitCommit: null,
      lastError: null,
      historyCount: 0,
      threadOwnerCount: 0,
      pushSubscriptionCount: 0
    }
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("EventStreamClientRegistry", () => {
  it("tracks add, broadcast, and close lifecycle statistics", () => {
    const registry = new EventStreamClientRegistry(1_000);
    const { req, res } = createHttpPair();
    const writeHeadSpy = vi.spyOn(res, "writeHead").mockImplementation(() => res);
    const writeSpy = vi.spyOn(res, "write").mockImplementation(() => true);
    const initialEvent = buildRuntimeStateChangedEvent();

    registry.addClient(req, res, initialEvent);
    registry.broadcast(initialEvent);
    req.emit("close");

    const statistics = registry.readStatistics();
    expect(statistics.activeClientCount).toBe(0);
    expect(statistics.addedClientCount).toBe(1);
    expect(statistics.removedClientCount).toBe(1);
    expect(statistics.broadcastEventCount).toBe(1);
    expect(statistics.broadcastDeliveryAttemptCount).toBe(1);
    expect(writeHeadSpy).toHaveBeenCalledWith(200, expect.any(Object));
    expect(writeSpy).toHaveBeenCalled();
  });

  it("removes clients and increments failure counters when event writes throw", () => {
    const registry = new EventStreamClientRegistry(1_000);
    const { req, res } = createHttpPair();
    const writeSpy = vi.spyOn(res, "write").mockImplementation(() => true);
    const initialEvent = buildRuntimeStateChangedEvent();

    registry.addClient(req, res, initialEvent);
    writeSpy.mockImplementation(() => {
      throw new Error("socket closed");
    });

    registry.broadcast(initialEvent);

    const statistics = registry.readStatistics();
    expect(statistics.activeClientCount).toBe(0);
    expect(statistics.removedClientCount).toBe(1);
    expect(statistics.eventWriteFailureCount).toBe(1);
    expect(statistics.broadcastDeliveryAttemptCount).toBe(1);
  });

  it("counts keepalive write failures without leaving stale clients", async () => {
    vi.useFakeTimers();
    const registry = new EventStreamClientRegistry(1_000);
    const { req, res } = createHttpPair();
    const writeSpy = vi.spyOn(res, "write").mockImplementation(() => true);
    const initialEvent = buildRuntimeStateChangedEvent();

    registry.addClient(req, res, initialEvent);
    registry.startKeepalive();
    writeSpy.mockImplementation(() => {
      throw new Error("keepalive failed");
    });

    await vi.advanceTimersByTimeAsync(1_000);
    registry.stopKeepalive();

    const statistics = registry.readStatistics();
    expect(statistics.activeClientCount).toBe(0);
    expect(statistics.removedClientCount).toBe(1);
    expect(statistics.keepaliveWriteFailureCount).toBe(1);
    expect(statistics.keepaliveEnabled).toBe(false);
  });
});
