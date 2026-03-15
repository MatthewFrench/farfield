import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import type { FarfieldEventStreamEvent } from "@farfield/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventStreamClientRegistry } from "../Source/Network/EventStreamClientRegistry.js";

const EVENT_STREAM_RETRY_DIRECTIVE = "retry: 1000\n\n";
const EVENT_STREAM_KEEPALIVE_FRAME = ": keepalive\n\n";

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
      pushSubscriptionCount: 0,
    },
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

  it("removes one active client when both request and response close events fire", () => {
    const registry = new EventStreamClientRegistry(1_000);
    const { req, res } = createHttpPair();
    vi.spyOn(res, "write").mockImplementation(() => true);
    const initialEvent = buildRuntimeStateChangedEvent();

    registry.addClient(req, res, initialEvent);
    expect(req.listenerCount("close")).toBe(1);
    expect(res.listenerCount("close")).toBe(1);
    req.emit("close");
    res.emit("close");

    const statistics = registry.readStatistics();
    expect(statistics.activeClientCount).toBe(0);
    expect(statistics.addedClientCount).toBe(1);
    expect(statistics.removedClientCount).toBe(1);
    expect(req.listenerCount("close")).toBe(0);
    expect(res.listenerCount("close")).toBe(0);
  });

  it("writes initial events for new clients using the latest broadcast sequence", () => {
    const registry = new EventStreamClientRegistry(1_000);
    const firstClient = createHttpPair();
    const secondClient = createHttpPair();
    const firstWriteSpy = vi.spyOn(firstClient.res, "write").mockImplementation(() => true);
    const secondWriteSpy = vi.spyOn(secondClient.res, "write").mockImplementation(() => true);
    const initialEvent = buildRuntimeStateChangedEvent();

    registry.addClient(firstClient.req, firstClient.res, initialEvent);
    registry.broadcast(initialEvent);
    registry.addClient(secondClient.req, secondClient.res, initialEvent);

    expect(firstWriteSpy).toHaveBeenCalled();
    expect(secondWriteSpy).toHaveBeenNthCalledWith(1, EVENT_STREAM_RETRY_DIRECTIVE);
    expect(secondWriteSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('id: 1\ndata: {"sequence":1'),
    );
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

  it("keeps clients registered when event writes signal backpressure", () => {
    const registry = new EventStreamClientRegistry(1_000);
    const { req, res } = createHttpPair();
    const writeSpy = vi.spyOn(res, "write").mockImplementation(() => true);
    const destroySpy = vi.spyOn(res, "destroy").mockImplementation(() => res);
    const initialEvent = buildRuntimeStateChangedEvent();

    registry.addClient(req, res, initialEvent);
    writeSpy.mockImplementation(() => false);

    registry.broadcast(initialEvent);

    const statistics = registry.readStatistics();
    expect(statistics.activeClientCount).toBe(1);
    expect(statistics.removedClientCount).toBe(0);
    expect(statistics.eventWriteFailureCount).toBe(0);
    expect(destroySpy).not.toHaveBeenCalled();
  });

  it("flushes queued event frames after drain clears backpressure", () => {
    const registry = new EventStreamClientRegistry(1_000);
    const { req, res } = createHttpPair();
    const writeSpy = vi.spyOn(res, "write");
    const initialEvent = buildRuntimeStateChangedEvent();

    writeSpy.mockImplementationOnce(() => true);
    writeSpy.mockImplementationOnce(() => false);
    writeSpy.mockImplementation(() => true);

    registry.addClient(req, res, initialEvent);
    registry.broadcast(initialEvent);
    registry.broadcast(initialEvent);
    res.emit("drain");

    const statistics = registry.readStatistics();
    expect(statistics.activeClientCount).toBe(1);
    expect(statistics.broadcastDeliveryAttemptCount).toBe(2);
    expect(statistics.eventWriteFailureCount).toBe(0);
    expect(writeSpy).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('id: 1\ndata: {"sequence":1'),
    );
    expect(writeSpy).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('id: 2\ndata: {"sequence":2'),
    );
  });

  it("starts one keepalive interval when called repeatedly", async () => {
    vi.useFakeTimers();
    const registry = new EventStreamClientRegistry(1_000);
    const { req, res } = createHttpPair();
    const writeSpy = vi.spyOn(res, "write").mockImplementation(() => true);
    const initialEvent = buildRuntimeStateChangedEvent();

    registry.addClient(req, res, initialEvent);
    registry.startKeepalive();
    registry.startKeepalive();
    vi.advanceTimersByTime(1_000);
    registry.stopKeepalive();

    expect(writeSpy).toHaveBeenCalledTimes(3);
    expect(writeSpy).toHaveBeenLastCalledWith(EVENT_STREAM_KEEPALIVE_FRAME);
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

    vi.advanceTimersByTime(1_000);
    registry.stopKeepalive();

    const statistics = registry.readStatistics();
    expect(statistics.activeClientCount).toBe(0);
    expect(statistics.removedClientCount).toBe(1);
    expect(statistics.keepaliveWriteFailureCount).toBe(1);
    expect(statistics.keepaliveEnabled).toBe(false);
  });

  it("keeps clients registered when keepalive writes signal backpressure", async () => {
    vi.useFakeTimers();
    const registry = new EventStreamClientRegistry(1_000);
    const { req, res } = createHttpPair();
    const writeSpy = vi.spyOn(res, "write").mockImplementation(() => true);
    const destroySpy = vi.spyOn(res, "destroy").mockImplementation(() => res);
    const initialEvent = buildRuntimeStateChangedEvent();

    registry.addClient(req, res, initialEvent);
    registry.startKeepalive();
    writeSpy.mockImplementation(() => false);

    vi.advanceTimersByTime(1_000);
    registry.stopKeepalive();

    const statistics = registry.readStatistics();
    expect(statistics.activeClientCount).toBe(0);
    expect(statistics.removedClientCount).toBe(1);
    expect(statistics.keepaliveWriteFailureCount).toBe(0);
    expect(destroySpy).not.toHaveBeenCalled();
  });
});
