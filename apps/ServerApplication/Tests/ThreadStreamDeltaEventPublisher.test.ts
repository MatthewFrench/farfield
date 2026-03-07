import type { FarfieldEventStreamEvent, FarfieldThreadStreamDeltaEvent } from "@farfield/protocol";
import { describe, expect, it, vi } from "vitest";
import type { AgentThreadLiveState, AgentThreadStreamEvents } from "../Source/Agents/Types.js";
import { EventStreamClientRegistry } from "../Source/Network/EventStreamClientRegistry.js";
import { ThreadSendProgressObservabilityOwner } from "../Source/Network/ThreadSendProgressObservabilityOwner.js";
import { ThreadStreamDeltaEventPublisher } from "../Source/Network/ThreadStreamDeltaEventPublisher.js";

const THREAD_STREAM_DELTA_EVENT_TYPE: FarfieldThreadStreamDeltaEvent["type"] =
  "thread-stream-delta";
const THREAD_STREAM_DELTA_STREAM_EVENT_LIMIT = 400;

interface StreamEventsSnapshotInput {
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
}

interface DeferredPromise<ValueType> {
  promise: Promise<ValueType>;
  resolve: (value: ValueType) => void;
}

function createLiveStateSnapshot(
  conversationState: AgentThreadLiveState["conversationState"] = null,
): AgentThreadLiveState {
  return {
    ownerClientId: null,
    conversationState,
    liveStateError: null,
  };
}

function createConversationState(
  threadId: string,
): NonNullable<AgentThreadLiveState["conversationState"]> {
  return {
    id: threadId,
    title: null,
    turns: [],
    requests: [],
    latestModel: null,
    latestReasoningEffort: null,
    latestCollaborationMode: null,
    hasUnreadTurn: false,
  };
}

function createStreamEventsSnapshot(input: StreamEventsSnapshotInput): AgentThreadStreamEvents {
  return {
    ownerClientId: null,
    events: [],
    nextSequence: input.nextSequence,
    firstAvailableSequence: input.firstAvailableSequence,
    resetRequired: input.resetRequired,
  };
}

function waitForScheduledPublish(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function createDeferredPromise<ValueType>(): DeferredPromise<ValueType> {
  let resolvePromise: ((value: ValueType) => void) | null = null;
  const promise = new Promise<ValueType>((resolve) => {
    resolvePromise = resolve;
  });
  if (!resolvePromise) {
    throw new Error("Expected deferred resolve function");
  }
  return {
    promise,
    resolve: resolvePromise,
  };
}

function readThreadStreamDeltaEvent(
  broadcastCall: [FarfieldEventStreamEvent] | undefined,
  missingEventErrorMessage: string,
): FarfieldThreadStreamDeltaEvent {
  if (!broadcastCall) {
    throw new Error(missingEventErrorMessage);
  }
  const [broadcastEvent] = broadcastCall;
  expect(broadcastEvent.type).toBe(THREAD_STREAM_DELTA_EVENT_TYPE);
  if (broadcastEvent.type !== THREAD_STREAM_DELTA_EVENT_TYPE) {
    throw new Error("Expected thread-stream-delta event payload");
  }
  return broadcastEvent;
}

describe("ThreadStreamDeltaEventPublisher", () => {
  it("publishes thread stream deltas with deterministic cursor metadata", async () => {
    const eventStreamClientRegistry = new EventStreamClientRegistry(1_000);
    const broadcastSpy = vi.spyOn(eventStreamClientRegistry, "broadcast");
    const readThreadLiveState = vi.fn(async (_threadId: string) => createLiveStateSnapshot());
    const streamEventsSnapshots: AgentThreadStreamEvents[] = [
      createStreamEventsSnapshot({
        nextSequence: 4,
        firstAvailableSequence: 0,
        resetRequired: true,
      }),
      createStreamEventsSnapshot({
        nextSequence: 9,
        firstAvailableSequence: 0,
        resetRequired: true,
      }),
    ];
    const readThreadStreamEvents = vi.fn(
      async (_threadId: string, _sinceSequence: number | null, _limit: number) => {
        const nextSnapshot = streamEventsSnapshots.shift();
        if (!nextSnapshot) {
          throw new Error("Expected stream-events snapshot fixture");
        }
        return nextSnapshot;
      },
    );
    const publisher = new ThreadStreamDeltaEventPublisher({
      eventStreamClientRegistry,
      threadSendProgressObservabilityOwner: new ThreadSendProgressObservabilityOwner(),
      readThreadLiveState,
      readThreadStreamEvents,
    });

    publisher.schedulePublish("thread-1");
    await waitForScheduledPublish();

    publisher.schedulePublish("thread-1");
    await waitForScheduledPublish();

    expect(readThreadLiveState).toHaveBeenCalledTimes(2);
    expect(readThreadStreamEvents).toHaveBeenNthCalledWith(
      1,
      "thread-1",
      null,
      THREAD_STREAM_DELTA_STREAM_EVENT_LIMIT,
    );
    expect(readThreadStreamEvents).toHaveBeenNthCalledWith(
      2,
      "thread-1",
      3,
      THREAD_STREAM_DELTA_STREAM_EVENT_LIMIT,
    );
    expect(broadcastSpy).toHaveBeenCalledTimes(2);

    const firstBroadcastEvent = readThreadStreamDeltaEvent(
      broadcastSpy.mock.calls[0],
      "Expected first thread delta broadcast",
    );
    expect(firstBroadcastEvent.delta.streamEventsSinceSequenceUsed).toBeNull();
    expect(firstBroadcastEvent.delta.streamEventsSnapshot.nextSequence).toBe(4);

    const secondBroadcastEvent = readThreadStreamDeltaEvent(
      broadcastSpy.mock.calls[1],
      "Expected second thread delta broadcast",
    );
    expect(secondBroadcastEvent.delta.streamEventsSinceSequenceUsed).toBe(3);
    expect(secondBroadcastEvent.delta.streamEventsSnapshot.nextSequence).toBe(9);
    expect(publisher.readStatistics()).toMatchObject({
      scheduledPublishCount: 2,
      startedPublishCount: 2,
      completedPublishCount: 2,
      failedPublishCount: 0,
      broadcastCount: 2,
      suppressedBroadcastCount: 0,
    });
  });

  it("suppresses broadcasts for empty non-reset snapshots without advancing cursor", async () => {
    const eventStreamClientRegistry = new EventStreamClientRegistry(1_000);
    const broadcastSpy = vi.spyOn(eventStreamClientRegistry, "broadcast");
    const readThreadLiveState = vi.fn(async (_threadId: string) => createLiveStateSnapshot());
    const streamEventsSnapshots: AgentThreadStreamEvents[] = [
      createStreamEventsSnapshot({
        nextSequence: 5,
        firstAvailableSequence: 0,
        resetRequired: false,
      }),
      createStreamEventsSnapshot({
        nextSequence: 8,
        firstAvailableSequence: 0,
        resetRequired: true,
      }),
    ];
    const readThreadStreamEvents = vi.fn(
      async (_threadId: string, _sinceSequence: number | null, _limit: number) => {
        const nextSnapshot = streamEventsSnapshots.shift();
        if (!nextSnapshot) {
          throw new Error("Expected stream-events snapshot fixture");
        }
        return nextSnapshot;
      },
    );
    const publisher = new ThreadStreamDeltaEventPublisher({
      eventStreamClientRegistry,
      threadSendProgressObservabilityOwner: new ThreadSendProgressObservabilityOwner(),
      readThreadLiveState,
      readThreadStreamEvents,
    });

    publisher.schedulePublish("thread-1");
    await waitForScheduledPublish();

    expect(broadcastSpy).not.toHaveBeenCalled();

    publisher.schedulePublish("thread-1");
    await waitForScheduledPublish();

    expect(readThreadStreamEvents).toHaveBeenNthCalledWith(
      1,
      "thread-1",
      null,
      THREAD_STREAM_DELTA_STREAM_EVENT_LIMIT,
    );
    expect(readThreadStreamEvents).toHaveBeenNthCalledWith(
      2,
      "thread-1",
      null,
      THREAD_STREAM_DELTA_STREAM_EVENT_LIMIT,
    );
    expect(broadcastSpy).toHaveBeenCalledTimes(1);

    const broadcastEvent = readThreadStreamDeltaEvent(
      broadcastSpy.mock.calls[0],
      "Expected thread delta broadcast after reset-required snapshot",
    );
    expect(broadcastEvent.delta.streamEventsSinceSequenceUsed).toBeNull();
    expect(broadcastEvent.delta.streamEventsSnapshot.nextSequence).toBe(8);
    expect(publisher.readStatistics()).toMatchObject({
      scheduledPublishCount: 2,
      broadcastCount: 1,
      suppressedBroadcastCount: 1,
    });
  });

  it("publishes a live-state-only delta when stream events are empty but live state changed", async () => {
    const eventStreamClientRegistry = new EventStreamClientRegistry(1_000);
    const broadcastSpy = vi.spyOn(eventStreamClientRegistry, "broadcast");
    const liveStateSnapshots: AgentThreadLiveState[] = [
      createLiveStateSnapshot(createConversationState("thread-1")),
      createLiveStateSnapshot(createConversationState("thread-1")),
    ];
    const readThreadLiveState = vi.fn(async () => {
      const nextSnapshot = liveStateSnapshots.shift();
      if (!nextSnapshot) {
        throw new Error("Expected live-state snapshot fixture");
      }
      return nextSnapshot;
    });
    const readThreadStreamEvents = vi.fn(async () =>
      createStreamEventsSnapshot({
        nextSequence: 5,
        firstAvailableSequence: 0,
        resetRequired: false,
      }),
    );
    const publisher = new ThreadStreamDeltaEventPublisher({
      eventStreamClientRegistry,
      threadSendProgressObservabilityOwner: new ThreadSendProgressObservabilityOwner(),
      readThreadLiveState,
      readThreadStreamEvents,
    });

    publisher.schedulePublish("thread-1");
    await waitForScheduledPublish();

    expect(broadcastSpy).toHaveBeenCalledTimes(1);

    publisher.schedulePublish("thread-1");
    await waitForScheduledPublish();

    expect(broadcastSpy).toHaveBeenCalledTimes(1);
    expect(publisher.readStatistics()).toMatchObject({
      scheduledPublishCount: 2,
      broadcastCount: 1,
      suppressedBroadcastCount: 1,
    });
  });

  it("records failed publish cycles and recovers on later schedules", async () => {
    const eventStreamClientRegistry = new EventStreamClientRegistry(1_000);
    const broadcastSpy = vi.spyOn(eventStreamClientRegistry, "broadcast");
    let shouldThrow = true;
    const readThreadLiveState = vi.fn(async (_threadId: string) => {
      if (shouldThrow) {
        shouldThrow = false;
        throw new Error("live state unavailable");
      }
      return createLiveStateSnapshot();
    });
    const readThreadStreamEvents = vi.fn(async () => {
      return createStreamEventsSnapshot({
        nextSequence: 3,
        firstAvailableSequence: 0,
        resetRequired: true,
      });
    });
    const publisher = new ThreadStreamDeltaEventPublisher({
      eventStreamClientRegistry,
      threadSendProgressObservabilityOwner: new ThreadSendProgressObservabilityOwner(),
      readThreadLiveState,
      readThreadStreamEvents,
    });

    publisher.schedulePublish("thread-1");
    await waitForScheduledPublish();
    publisher.schedulePublish("thread-1");
    await waitForScheduledPublish();

    expect(broadcastSpy).toHaveBeenCalledTimes(1);
    expect(publisher.readStatistics()).toMatchObject({
      scheduledPublishCount: 2,
      failedPublishCount: 1,
      broadcastCount: 1,
    });
  });

  it("drains queued schedules in a single in-flight publish loop", async () => {
    const eventStreamClientRegistry = new EventStreamClientRegistry(1_000);
    const broadcastSpy = vi.spyOn(eventStreamClientRegistry, "broadcast");
    const firstLiveStateDeferred = createDeferredPromise<AgentThreadLiveState>();
    let liveStateReadCount = 0;
    const readThreadLiveState = vi.fn(async (_threadId: string) => {
      liveStateReadCount += 1;
      if (liveStateReadCount === 1) {
        return firstLiveStateDeferred.promise;
      }
      return createLiveStateSnapshot();
    });
    const streamEventsSnapshots: AgentThreadStreamEvents[] = [
      createStreamEventsSnapshot({
        nextSequence: 2,
        firstAvailableSequence: 0,
        resetRequired: true,
      }),
      createStreamEventsSnapshot({
        nextSequence: 6,
        firstAvailableSequence: 0,
        resetRequired: true,
      }),
    ];
    const readThreadStreamEvents = vi.fn(
      async (_threadId: string, _sinceSequence: number | null, _limit: number) => {
        const nextSnapshot = streamEventsSnapshots.shift();
        if (!nextSnapshot) {
          throw new Error("Expected stream-events snapshot fixture");
        }
        return nextSnapshot;
      },
    );
    const publisher = new ThreadStreamDeltaEventPublisher({
      eventStreamClientRegistry,
      threadSendProgressObservabilityOwner: new ThreadSendProgressObservabilityOwner(),
      readThreadLiveState,
      readThreadStreamEvents,
    });

    publisher.schedulePublish("thread-1");
    await waitForScheduledPublish();

    publisher.schedulePublish("thread-1");
    firstLiveStateDeferred.resolve(createLiveStateSnapshot());
    await waitForScheduledPublish();
    await waitForScheduledPublish();

    expect(readThreadLiveState).toHaveBeenCalledTimes(2);
    expect(readThreadStreamEvents).toHaveBeenNthCalledWith(
      1,
      "thread-1",
      null,
      THREAD_STREAM_DELTA_STREAM_EVENT_LIMIT,
    );
    expect(readThreadStreamEvents).toHaveBeenNthCalledWith(
      2,
      "thread-1",
      1,
      THREAD_STREAM_DELTA_STREAM_EVENT_LIMIT,
    );
    expect(broadcastSpy).toHaveBeenCalledTimes(2);

    const secondBroadcastEvent = readThreadStreamDeltaEvent(
      broadcastSpy.mock.calls[1],
      "Expected drained in-flight second broadcast",
    );
    expect(secondBroadcastEvent.delta.streamEventsSinceSequenceUsed).toBe(1);
    expect(secondBroadcastEvent.delta.streamEventsSnapshot.nextSequence).toBe(6);
    expect(publisher.readStatistics()).toMatchObject({
      scheduledPublishCount: 2,
      startedPublishCount: 1,
      completedPublishCount: 1,
      failedPublishCount: 0,
      broadcastCount: 2,
      suppressedBroadcastCount: 0,
    });
  });

  it("ignores blank thread identifiers", () => {
    const publisher = new ThreadStreamDeltaEventPublisher({
      eventStreamClientRegistry: new EventStreamClientRegistry(1_000),
      threadSendProgressObservabilityOwner: new ThreadSendProgressObservabilityOwner(),
      readThreadLiveState: async () => createLiveStateSnapshot(),
      readThreadStreamEvents: async () =>
        createStreamEventsSnapshot({
          nextSequence: 0,
          firstAvailableSequence: 0,
          resetRequired: false,
        }),
    });

    publisher.schedulePublish("   ");
    expect(publisher.readStatistics().scheduledPublishCount).toBe(0);
  });
});
