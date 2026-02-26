import { ZodError } from "zod";
import { describe, expect, it, vi } from "vitest";
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

const OBSERVABILITY_RECORDED_AT_TIMESTAMP = "2026-02-25T00:00:00.000Z";
const THREAD_LIST_CACHE_TIME_TO_LIVE_MILLISECONDS = 1_000;
const THREAD_LIST_CACHE_MAXIMUM_ENTRIES = 10;
const PUSH_DISPATCH_DEBOUNCE_MILLISECONDS = 50;
const EVENT_STREAM_KEEPALIVE_INTERVAL_MILLISECONDS = 1_000;
const EVENT_LOOP_SAMPLE_INTERVAL_MILLISECONDS = 10;
const EVENT_LOOP_MAXIMUM_SAMPLE_COUNT = 16;
const REQUEST_OBSERVABILITY_MAX_SAMPLES_PER_ROUTE = 16;
const REQUEST_OBSERVABILITY_MAX_STARTUP_REQUEST_ENTRIES = 16;

interface ServerObservabilitySnapshotOwnerFixture {
  owner: ServerObservabilitySnapshotOwner;
  threadListAggregationCache: ThreadListAggregationCache;
  threadConcurrencyCoordinator: ThreadConcurrencyCoordinator;
  pushDispatchConcurrencyCoordinator: PushDispatchConcurrencyCoordinator;
  requestObservabilityOwner: RequestObservabilityOwner;
  threadAdapterResolver: ThreadAdapterResolver;
  eventStreamClientRegistry: EventStreamClientRegistry;
  eventLoopLagObservabilityOwner: EventLoopLagObservabilityOwner;
}

function createFixture(readNowIsoString: () => string = () => OBSERVABILITY_RECORDED_AT_TIMESTAMP): ServerObservabilitySnapshotOwnerFixture {
  const threadListAggregationCache = new ThreadListAggregationCache(
    THREAD_LIST_CACHE_TIME_TO_LIVE_MILLISECONDS,
    THREAD_LIST_CACHE_MAXIMUM_ENTRIES
  );
  const threadConcurrencyCoordinator = new ThreadConcurrencyCoordinator();
  const pushDispatchConcurrencyCoordinator = new PushDispatchConcurrencyCoordinator(
    PUSH_DISPATCH_DEBOUNCE_MILLISECONDS,
    () => true,
    async () => {}
  );
  const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();
  const eventStreamClientRegistry = new EventStreamClientRegistry(EVENT_STREAM_KEEPALIVE_INTERVAL_MILLISECONDS);
  const eventLoopLagObservabilityOwner = new EventLoopLagObservabilityOwner(
    EVENT_LOOP_SAMPLE_INTERVAL_MILLISECONDS,
    EVENT_LOOP_MAXIMUM_SAMPLE_COUNT
  );
  const requestObservabilityOwner = new RequestObservabilityOwner(
    REQUEST_OBSERVABILITY_MAX_SAMPLES_PER_ROUTE,
    REQUEST_OBSERVABILITY_MAX_STARTUP_REQUEST_ENTRIES
  );
  const threadAdapterResolver = new ThreadAdapterResolver(new AgentRegistry([]), new ThreadIndex());

  eventLoopLagObservabilityOwner.start();

  const owner = new ServerObservabilitySnapshotOwner({
    threadListAggregationCache,
    threadConcurrencyCoordinator,
    pushDispatchConcurrencyCoordinator,
    pushMutationConcurrencyCoordinator,
    eventStreamClientRegistry,
    threadAdapterResolver,
    requestObservabilityOwner,
    eventLoopLagObservabilityOwner,
    readNowIsoString
  });

  return {
    owner,
    threadListAggregationCache,
    threadConcurrencyCoordinator,
    pushDispatchConcurrencyCoordinator,
    requestObservabilityOwner,
    threadAdapterResolver,
    eventStreamClientRegistry,
    eventLoopLagObservabilityOwner
  };
}

function disposeFixture(fixture: ServerObservabilitySnapshotOwnerFixture): void {
  fixture.pushDispatchConcurrencyCoordinator.stop();
  fixture.eventStreamClientRegistry.stopKeepalive();
  fixture.eventLoopLagObservabilityOwner.stop();
}

describe("ServerObservabilitySnapshotOwner", () => {
  it("returns structured cache, concurrency, and streaming observability snapshot", async () => {
    const fixture = createFixture();

    try {
      fixture.threadListAggregationCache.write(
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

      await fixture.threadConcurrencyCoordinator.runExclusive("thread_1", async () => {});
      fixture.pushDispatchConcurrencyCoordinator.schedule("thread_1");
      fixture.requestObservabilityOwner.recordRequestStarted({
        requestId: "request_1",
        actionId: "action_1",
        actionName: "startup-critical.threads.active",
        method: "GET",
        pathname: "/api/threads",
        startedAt: OBSERVABILITY_RECORDED_AT_TIMESTAMP,
        queueDelayMs: 1
      });
      fixture.requestObservabilityOwner.recordRequestCompleted({
        requestId: "request_1",
        actionId: "action_1",
        actionName: "startup-critical.threads.active",
        method: "GET",
        pathname: "/api/threads",
        startedAt: OBSERVABILITY_RECORDED_AT_TIMESTAMP,
        statusCode: 200,
        durationMs: 25,
        queueDelayMs: 1,
        completedAt: OBSERVABILITY_RECORDED_AT_TIMESTAMP
      });

      const snapshot = fixture.owner.readSnapshot();

      expect(snapshot.recordedAt).toBe(OBSERVABILITY_RECORDED_AT_TIMESTAMP);
      expect(snapshot.cache.threadListAggregation.entryCount).toBeGreaterThanOrEqual(1);
      expect(snapshot.concurrency.thread.queuedExecutionCount).toBeGreaterThanOrEqual(1);
      expect(snapshot.concurrency.pushDispatch.scheduledCheckCount).toBeGreaterThanOrEqual(1);
      expect(snapshot.concurrency.pushMutation.queuedExecutionCount).toBeGreaterThanOrEqual(0);
      expect(snapshot.concurrency.thread).toStrictEqual({
        queuedExecutionCount: snapshot.concurrency.thread.queuedExecutionCount,
        completedExecutionCount: snapshot.concurrency.thread.completedExecutionCount,
        failedExecutionCount: snapshot.concurrency.thread.failedExecutionCount,
        activeThreadCount: snapshot.concurrency.thread.activeThreadCount
      });
      expect(snapshot.concurrency.pushDispatch).toStrictEqual({
        scheduledCheckCount: snapshot.concurrency.pushDispatch.scheduledCheckCount,
        startedCheckCount: snapshot.concurrency.pushDispatch.startedCheckCount,
        completedCheckCount: snapshot.concurrency.pushDispatch.completedCheckCount,
        skippedWhileInFlightCount: snapshot.concurrency.pushDispatch.skippedWhileInFlightCount,
        activeTimerCount: snapshot.concurrency.pushDispatch.activeTimerCount,
        inFlightThreadCount: snapshot.concurrency.pushDispatch.inFlightThreadCount
      });
      expect(snapshot.streaming.eventStream.activeClientCount).toBe(0);
      expect(snapshot.routing.threadAdapterResolver.unregisteredDiscoveryAttemptCount).toBe(0);
      expect(snapshot.routing.threadAdapterResolver.unregisteredDiscoveryMissCacheHitCount).toBe(0);
      expect(snapshot.performance.requestRouting.totalRequestCount).toBeGreaterThanOrEqual(1);
      expect(snapshot.performance.requestRouting.startupRequestTimings.length).toBeGreaterThanOrEqual(1);
      expect(snapshot.performance.requestRouting.requestLifecycleEvents.length).toBeGreaterThanOrEqual(2);
      expect(snapshot.performance.eventLoop.sampleIntervalMs).toBe(EVENT_LOOP_SAMPLE_INTERVAL_MILLISECONDS);
    } finally {
      disposeFixture(fixture);
    }
  });

  it("fails with schema validation metadata when the owner emits an invalid timestamp", () => {
    const fixture = createFixture(() => "invalid-recorded-at-value");

    try {
      expect(() => fixture.owner.readSnapshot()).toThrowError(ZodError);

      let validationError: ZodError | null = null;
      try {
        fixture.owner.readSnapshot();
      } catch (error) {
        if (error instanceof ZodError) {
          validationError = error;
        }
      }

      if (validationError === null) {
        throw new Error("Expected ServerObservabilitySnapshotOwner to throw a ZodError");
      }

      expect(validationError.issues.some((issue) => issue.path.join(".") === "recordedAt")).toBe(true);
    } finally {
      disposeFixture(fixture);
    }
  });

  it("propagates dependency statistics read failures without swallowing errors", () => {
    const fixture = createFixture();
    const dependencyFailure = new Error("Thread adapter resolver statistics unavailable");

    try {
      vi.spyOn(fixture.threadAdapterResolver, "readStatistics").mockImplementation(() => {
        throw dependencyFailure;
      });

      expect(() => fixture.owner.readSnapshot()).toThrow(dependencyFailure);
    } finally {
      vi.restoreAllMocks();
      disposeFixture(fixture);
    }
  });
});
