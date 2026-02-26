import { describe, expect, it, vi } from "vitest";
import type {
  AgentThreadLiveState,
  AgentThreadStreamEvents
} from "../Source/Agents/Types.js";
import { EventStreamClientRegistry } from "../Source/Network/EventStreamClientRegistry.js";
import { ThreadStreamDeltaEventPublisher } from "../Source/Network/ThreadStreamDeltaEventPublisher.js";

interface StreamEventsSnapshotInput {
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
}

function createLiveStateSnapshot(): AgentThreadLiveState {
  return {
    ownerClientId: null,
    conversationState: null,
    liveStateError: null
  };
}

function createStreamEventsSnapshot(input: StreamEventsSnapshotInput): AgentThreadStreamEvents {
  return {
    ownerClientId: null,
    events: [],
    nextSequence: input.nextSequence,
    firstAvailableSequence: input.firstAvailableSequence,
    resetRequired: input.resetRequired
  };
}

function waitForScheduledPublish(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
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
        resetRequired: true
      }),
      createStreamEventsSnapshot({
        nextSequence: 9,
        firstAvailableSequence: 0,
        resetRequired: true
      })
    ];
    const readThreadStreamEvents = vi.fn(
      async (_threadId: string, _sinceSequence: number | null, _limit: number) => {
        const nextSnapshot = streamEventsSnapshots.shift();
        if (!nextSnapshot) {
          throw new Error("Expected stream-events snapshot fixture");
        }
        return nextSnapshot;
      }
    );
    const publisher = new ThreadStreamDeltaEventPublisher({
      eventStreamClientRegistry,
      readThreadLiveState,
      readThreadStreamEvents
    });

    publisher.schedulePublish("thread-1");
    await waitForScheduledPublish();

    publisher.schedulePublish("thread-1");
    await waitForScheduledPublish();

    expect(readThreadLiveState).toHaveBeenCalledTimes(2);
    expect(readThreadStreamEvents).toHaveBeenNthCalledWith(1, "thread-1", null, 400);
    expect(readThreadStreamEvents).toHaveBeenNthCalledWith(2, "thread-1", 4, 400);
    expect(broadcastSpy).toHaveBeenCalledTimes(2);

    const firstBroadcastCall = broadcastSpy.mock.calls[0];
    if (!firstBroadcastCall) {
      throw new Error("Expected first thread delta broadcast");
    }
    const [firstBroadcastEvent] = firstBroadcastCall;
    expect(firstBroadcastEvent.type).toBe("thread-stream-delta");
    if (firstBroadcastEvent.type !== "thread-stream-delta") {
      throw new Error("Expected thread-stream-delta event payload");
    }
    expect(firstBroadcastEvent.delta.streamEventsSinceSequenceUsed).toBeNull();
    expect(firstBroadcastEvent.delta.streamEventsSnapshot.nextSequence).toBe(4);

    const secondBroadcastCall = broadcastSpy.mock.calls[1];
    if (!secondBroadcastCall) {
      throw new Error("Expected second thread delta broadcast");
    }
    const [secondBroadcastEvent] = secondBroadcastCall;
    expect(secondBroadcastEvent.type).toBe("thread-stream-delta");
    if (secondBroadcastEvent.type !== "thread-stream-delta") {
      throw new Error("Expected thread-stream-delta event payload");
    }
    expect(secondBroadcastEvent.delta.streamEventsSinceSequenceUsed).toBe(4);
    expect(secondBroadcastEvent.delta.streamEventsSnapshot.nextSequence).toBe(9);
    expect(publisher.readStatistics()).toMatchObject({
      scheduledPublishCount: 2,
      startedPublishCount: 2,
      completedPublishCount: 2,
      failedPublishCount: 0,
      broadcastCount: 2,
      suppressedBroadcastCount: 0
    });
  });

  it("suppresses broadcasts for empty non-reset snapshots while keeping cursor progression", async () => {
    const eventStreamClientRegistry = new EventStreamClientRegistry(1_000);
    const broadcastSpy = vi.spyOn(eventStreamClientRegistry, "broadcast");
    const readThreadLiveState = vi.fn(async (_threadId: string) => createLiveStateSnapshot());
    const streamEventsSnapshots: AgentThreadStreamEvents[] = [
      createStreamEventsSnapshot({
        nextSequence: 5,
        firstAvailableSequence: 0,
        resetRequired: false
      }),
      createStreamEventsSnapshot({
        nextSequence: 8,
        firstAvailableSequence: 0,
        resetRequired: true
      })
    ];
    const readThreadStreamEvents = vi.fn(
      async (_threadId: string, _sinceSequence: number | null, _limit: number) => {
        const nextSnapshot = streamEventsSnapshots.shift();
        if (!nextSnapshot) {
          throw new Error("Expected stream-events snapshot fixture");
        }
        return nextSnapshot;
      }
    );
    const publisher = new ThreadStreamDeltaEventPublisher({
      eventStreamClientRegistry,
      readThreadLiveState,
      readThreadStreamEvents
    });

    publisher.schedulePublish("thread-1");
    await waitForScheduledPublish();

    expect(broadcastSpy).not.toHaveBeenCalled();

    publisher.schedulePublish("thread-1");
    await waitForScheduledPublish();

    expect(readThreadStreamEvents).toHaveBeenNthCalledWith(1, "thread-1", null, 400);
    expect(readThreadStreamEvents).toHaveBeenNthCalledWith(2, "thread-1", 5, 400);
    expect(broadcastSpy).toHaveBeenCalledTimes(1);

    const broadcastCall = broadcastSpy.mock.calls[0];
    if (!broadcastCall) {
      throw new Error("Expected thread delta broadcast after reset-required snapshot");
    }
    const [broadcastEvent] = broadcastCall;
    expect(broadcastEvent.type).toBe("thread-stream-delta");
    if (broadcastEvent.type !== "thread-stream-delta") {
      throw new Error("Expected thread-stream-delta event payload");
    }
    expect(broadcastEvent.delta.streamEventsSinceSequenceUsed).toBe(5);
    expect(broadcastEvent.delta.streamEventsSnapshot.nextSequence).toBe(8);
    expect(publisher.readStatistics()).toMatchObject({
      scheduledPublishCount: 2,
      broadcastCount: 1,
      suppressedBroadcastCount: 1
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
        resetRequired: true
      });
    });
    const publisher = new ThreadStreamDeltaEventPublisher({
      eventStreamClientRegistry,
      readThreadLiveState,
      readThreadStreamEvents
    });

    publisher.schedulePublish("thread-1");
    await waitForScheduledPublish();
    publisher.schedulePublish("thread-1");
    await waitForScheduledPublish();

    expect(broadcastSpy).toHaveBeenCalledTimes(1);
    expect(publisher.readStatistics()).toMatchObject({
      scheduledPublishCount: 2,
      failedPublishCount: 1,
      broadcastCount: 1
    });
  });

  it("ignores blank thread identifiers", () => {
    const publisher = new ThreadStreamDeltaEventPublisher({
      eventStreamClientRegistry: new EventStreamClientRegistry(1_000),
      readThreadLiveState: async () => createLiveStateSnapshot(),
      readThreadStreamEvents: async () => createStreamEventsSnapshot({
        nextSequence: 0,
        firstAvailableSequence: 0,
        resetRequired: false
      })
    });

    publisher.schedulePublish("   ");
    expect(publisher.readStatistics().scheduledPublishCount).toBe(0);
  });
});
