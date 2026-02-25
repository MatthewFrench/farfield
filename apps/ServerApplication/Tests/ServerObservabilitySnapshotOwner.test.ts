import { describe, expect, it } from "vitest";
import { AgentRegistry } from "../Source/Agents/Registry.js";
import { ThreadAdapterResolver } from "../Source/Agents/ThreadAdapterResolver.js";
import { ThreadIndex } from "../Source/Agents/ThreadIndex.js";
import { EventStreamClientRegistry } from "../Source/Network/EventStreamClientRegistry.js";
import { PushDispatchConcurrencyCoordinator } from "../Source/Network/PushDispatchConcurrencyCoordinator.js";
import { PushMutationConcurrencyCoordinator } from "../Source/Network/PushMutationConcurrencyCoordinator.js";
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
    const threadAdapterResolver = new ThreadAdapterResolver(new AgentRegistry([]), new ThreadIndex());

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

    const owner = new ServerObservabilitySnapshotOwner({
      threadListAggregationCache,
      threadConcurrencyCoordinator,
      pushDispatchConcurrencyCoordinator,
      pushMutationConcurrencyCoordinator,
      eventStreamClientRegistry,
      threadAdapterResolver
    });
    const snapshot = owner.readSnapshot();

    expect(snapshot.recordedAt.length).toBeGreaterThan(0);
    expect(snapshot.cache.threadListAggregation.entryCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.concurrency.thread.queuedExecutionCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.concurrency.pushDispatch.scheduledCheckCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.concurrency.pushMutation.queuedExecutionCount).toBeGreaterThanOrEqual(0);
    expect(snapshot.streaming.eventStream.activeClientCount).toBe(0);
    expect(snapshot.routing.threadAdapterResolver.unregisteredDiscoveryAttemptCount).toBe(0);

    pushDispatchConcurrencyCoordinator.stop();
    eventStreamClientRegistry.stopKeepalive();
  });
});
