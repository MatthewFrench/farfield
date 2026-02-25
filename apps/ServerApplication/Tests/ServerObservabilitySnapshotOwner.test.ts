import { describe, expect, it } from "vitest";
import { AgentRegistry } from "../Source/Agents/Registry.js";
import { ThreadAdapterResolver } from "../Source/Agents/ThreadAdapterResolver.js";
import { ThreadIndex } from "../Source/Agents/ThreadIndex.js";
import { EventStreamClientRegistry } from "../Source/Network/EventStreamClientRegistry.js";
import { EventLoopLagObservabilityOwner } from "../Source/Network/EventLoopLagObservabilityOwner.js";
import { PushDispatchConcurrencyCoordinator } from "../Source/Network/PushDispatchConcurrencyCoordinator.js";
import { PushMutationConcurrencyCoordinator } from "../Source/Network/PushMutationConcurrencyCoordinator.js";
import { RequestObservabilityOwner } from "../Source/Network/RequestObservabilityOwner.js";
import { ServerObservabilitySnapshotOwner } from "../Source/Network/ServerObservabilitySnapshotOwner.js";
import { ThreadConcurrencyCoordinator } from "../Source/Network/ThreadConcurrencyCoordinator.js";
import { ThreadListAggregationCache } from "../Source/Network/ThreadListAggregationCache.js";

describe("ServerObservabilitySnapshotOwner", () => {
  it("returns structured cache, concurrency, and streaming observability snapshot", async () => {
    const threadListAggregationCache = new ThreadListAggregationCache(1_000, 10);
    const threadConcurrencyCoordinator = new ThreadConcurrencyCoordinator();
    const pushDispatchConcurrencyCoordinator = new PushDispatchConcurrencyCoordinator(
      50,
      () => true,
      async () => {}
    );
    const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();
    const eventStreamClientRegistry = new EventStreamClientRegistry(1_000);
    const eventLoopLagObservabilityOwner = new EventLoopLagObservabilityOwner(10, 16);
    const requestObservabilityOwner = new RequestObservabilityOwner(16, 16);
    const threadAdapterResolver = new ThreadAdapterResolver(new AgentRegistry([]), new ThreadIndex());
    eventLoopLagObservabilityOwner.start();

    threadListAggregationCache.write(
      {
        enabledAgentIds: ["codex"],
        limit: 20,
        archived: false,
        all: false,
        maxPages: 10,
        sortKey: "updated_at",
        cwd: null
      },
      {
        mergedData: [],
        combinedTruncated: false
      }
    );

    await threadConcurrencyCoordinator.runExclusive("thread_1", async () => {});
    pushDispatchConcurrencyCoordinator.schedule("thread_1");
    requestObservabilityOwner.recordRequestStarted({
      requestId: "request_1",
      actionId: "action_1",
      actionName: "startup-critical.threads.active",
      method: "GET",
      pathname: "/api/threads",
      startedAt: "2026-02-25T00:00:00.000Z",
      queueDelayMs: 1
    });
    requestObservabilityOwner.recordRequestCompleted({
      requestId: "request_1",
      actionId: "action_1",
      actionName: "startup-critical.threads.active",
      method: "GET",
      pathname: "/api/threads",
      startedAt: "2026-02-25T00:00:00.000Z",
      statusCode: 200,
      durationMs: 25,
      queueDelayMs: 1,
      completedAt: "2026-02-25T00:00:00.000Z"
    });

    const owner = new ServerObservabilitySnapshotOwner({
      threadListAggregationCache,
      threadConcurrencyCoordinator,
      pushDispatchConcurrencyCoordinator,
      pushMutationConcurrencyCoordinator,
      eventStreamClientRegistry,
      threadAdapterResolver,
      requestObservabilityOwner,
      eventLoopLagObservabilityOwner
    });
    const snapshot = owner.readSnapshot();

    expect(snapshot.recordedAt.length).toBeGreaterThan(0);
    expect(snapshot.cache.threadListAggregation.entryCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.concurrency.thread.queuedExecutionCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.concurrency.pushDispatch.scheduledCheckCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.concurrency.pushMutation.queuedExecutionCount).toBeGreaterThanOrEqual(0);
    expect(snapshot.streaming.eventStream.activeClientCount).toBe(0);
    expect(snapshot.routing.threadAdapterResolver.unregisteredDiscoveryAttemptCount).toBe(0);
    expect(snapshot.routing.threadAdapterResolver.unregisteredDiscoveryMissCacheHitCount).toBe(0);
    expect(snapshot.performance.requestRouting.totalRequestCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.performance.requestRouting.startupRequestTimings.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.performance.requestRouting.requestLifecycleEvents.length).toBeGreaterThanOrEqual(2);
    expect(snapshot.performance.eventLoop.sampleIntervalMs).toBe(10);

    pushDispatchConcurrencyCoordinator.stop();
    eventStreamClientRegistry.stopKeepalive();
    eventLoopLagObservabilityOwner.stop();
  });
});
