import type { FarfieldThreadStreamDeltaEvent } from "@farfield/protocol";
import type { AgentThreadLiveState, AgentThreadStreamEvents } from "../Agents/Types.js";
import { logger } from "../Shared/Logging/Logger.js";
import type { EventStreamClientRegistry } from "./EventStreamClientRegistry.js";
import type { ThreadSendProgressObservabilityOwner } from "./ThreadSendProgressObservabilityOwner.js";

// Stream deltas stay bounded to keep per-publish work predictable under bursty traffic.
const THREAD_STREAM_DELTA_STREAM_EVENT_LIMIT = 400;
const THREAD_STREAM_DELTA_EVENT_TYPE: FarfieldThreadStreamDeltaEvent["type"] =
  "thread-stream-delta";
const FARFIELD_DELTA_SNAPSHOT_OK = true as const;
const THREAD_STREAM_DELTA_PUBLISH_FAILED_LOG_EVENT = "thread-stream-delta-publish-failed";

export interface ThreadStreamDeltaEventPublisherStatistics {
  scheduledPublishCount: number;
  startedPublishCount: number;
  completedPublishCount: number;
  failedPublishCount: number;
  broadcastCount: number;
  suppressedBroadcastCount: number;
  pendingThreadCount: number;
  inFlightThreadCount: number;
}

export interface ThreadStreamDeltaEventPublisherDependencies {
  eventStreamClientRegistry: EventStreamClientRegistry;
  threadSendProgressObservabilityOwner: ThreadSendProgressObservabilityOwner;
  readThreadLiveState: (threadId: string) => Promise<AgentThreadLiveState>;
  readThreadStreamEvents: (
    threadId: string,
    sinceSequence: number | null,
    limit: number,
  ) => Promise<AgentThreadStreamEvents>;
}

interface ThreadStreamDeltaEventBuildInput {
  threadId: string;
  sinceSequence: number | null;
  liveStateSnapshot: AgentThreadLiveState;
  streamEventsSnapshot: AgentThreadStreamEvents;
}

interface ThreadLiveStateBroadcastMarker {
  ownerClientId: AgentThreadLiveState["ownerClientId"];
  conversationState: AgentThreadLiveState["conversationState"];
  liveStateError: AgentThreadLiveState["liveStateError"];
}

/**
 * Owns stream-delta publication from in-memory thread projections to the shared event stream.
 * The owner coalesces per-thread triggers and publishes deterministic cursor-based deltas so
 * web clients can append or reset without full selected-thread refetches.
 */
export class ThreadStreamDeltaEventPublisher {
  private readonly eventStreamClientRegistry: EventStreamClientRegistry;
  private readonly threadSendProgressObservabilityOwner: ThreadSendProgressObservabilityOwner;
  private readonly readThreadLiveState: (threadId: string) => Promise<AgentThreadLiveState>;
  private readonly readThreadStreamEvents: (
    threadId: string,
    sinceSequence: number | null,
    limit: number,
  ) => Promise<AgentThreadStreamEvents>;
  private readonly inFlightThreadIdSet: Set<string>;
  private readonly pendingThreadIdSet: Set<string>;
  private readonly lastDeliveredSequenceByThreadId: Map<string, number>;
  private readonly lastBroadcastMarkerByThreadId: Map<string, ThreadLiveStateBroadcastMarker>;
  private scheduledPublishCount: number;
  private startedPublishCount: number;
  private completedPublishCount: number;
  private failedPublishCount: number;
  private broadcastCount: number;
  private suppressedBroadcastCount: number;

  public constructor(dependencies: ThreadStreamDeltaEventPublisherDependencies) {
    this.eventStreamClientRegistry = dependencies.eventStreamClientRegistry;
    this.threadSendProgressObservabilityOwner = dependencies.threadSendProgressObservabilityOwner;
    this.readThreadLiveState = dependencies.readThreadLiveState;
    this.readThreadStreamEvents = dependencies.readThreadStreamEvents;
    this.inFlightThreadIdSet = new Set<string>();
    this.pendingThreadIdSet = new Set<string>();
    this.lastDeliveredSequenceByThreadId = new Map<string, number>();
    this.lastBroadcastMarkerByThreadId = new Map<string, ThreadLiveStateBroadcastMarker>();
    this.scheduledPublishCount = 0;
    this.startedPublishCount = 0;
    this.completedPublishCount = 0;
    this.failedPublishCount = 0;
    this.broadcastCount = 0;
    this.suppressedBroadcastCount = 0;
  }

  public schedulePublish(threadId: string): void {
    const normalizedThreadId = threadId.trim();
    if (normalizedThreadId.length === 0) {
      return;
    }
    this.scheduledPublishCount += 1;

    this.pendingThreadIdSet.add(normalizedThreadId);
    if (this.inFlightThreadIdSet.has(normalizedThreadId)) {
      return;
    }

    this.inFlightThreadIdSet.add(normalizedThreadId);
    queueMicrotask(() => {
      void this.publishPendingThread(normalizedThreadId);
    });
  }

  public readStatistics(): ThreadStreamDeltaEventPublisherStatistics {
    return {
      scheduledPublishCount: this.scheduledPublishCount,
      startedPublishCount: this.startedPublishCount,
      completedPublishCount: this.completedPublishCount,
      failedPublishCount: this.failedPublishCount,
      broadcastCount: this.broadcastCount,
      suppressedBroadcastCount: this.suppressedBroadcastCount,
      pendingThreadCount: this.pendingThreadIdSet.size,
      inFlightThreadCount: this.inFlightThreadIdSet.size,
    };
  }

  private async publishPendingThread(threadId: string): Promise<void> {
    this.startedPublishCount += 1;
    try {
      // Drain every queued signal for this thread while one in-flight loop owns progression.
      while (this.pendingThreadIdSet.delete(threadId)) {
        await this.publishThreadDelta(threadId);
      }
      this.completedPublishCount += 1;
    } catch (error) {
      this.failedPublishCount += 1;
      logger.warn(
        {
          threadId,
          error: toErrorMessage(error),
        },
        THREAD_STREAM_DELTA_PUBLISH_FAILED_LOG_EVENT,
      );
    } finally {
      this.inFlightThreadIdSet.delete(threadId);
      if (this.pendingThreadIdSet.has(threadId)) {
        this.schedulePublish(threadId);
      }
    }
  }

  private async publishThreadDelta(threadId: string): Promise<void> {
    const sinceSequence = this.lastDeliveredSequenceByThreadId.get(threadId) ?? null;
    const [liveStateSnapshot, streamEventsSnapshot] = await Promise.all([
      this.readThreadLiveState(threadId),
      this.readThreadStreamEvents(threadId, sinceSequence, THREAD_STREAM_DELTA_STREAM_EVENT_LIMIT),
    ]);
    // Persist cursor as the most recently delivered event sequence, never as nextSequence.
    const nextSinceSequence = resolveNextStreamEventsSinceSequence(
      sinceSequence,
      streamEventsSnapshot,
    );
    if (nextSinceSequence === null) {
      this.lastDeliveredSequenceByThreadId.delete(threadId);
    } else {
      this.lastDeliveredSequenceByThreadId.set(threadId, nextSinceSequence);
    }

    const liveStateMarker = createThreadLiveStateBroadcastMarker(liveStateSnapshot);
    const previousLiveStateMarker = this.lastBroadcastMarkerByThreadId.get(threadId) ?? null;
    if (
      shouldSuppressBroadcast({
        liveStateMarker,
        previousLiveStateMarker,
        streamEventsSnapshot,
      })
    ) {
      this.suppressedBroadcastCount += 1;
      return;
    }

    this.eventStreamClientRegistry.broadcast(
      this.buildThreadStreamDeltaEvent({
        threadId,
        sinceSequence,
        liveStateSnapshot,
        streamEventsSnapshot,
      }),
    );
    const nowEpochMilliseconds = Date.now();
    this.threadSendProgressObservabilityOwner.recordFirstPublishedThreadDelta(
      threadId,
      nowEpochMilliseconds,
    );
    this.threadSendProgressObservabilityOwner.recordFirstAssistantVisibleProgress(
      threadId,
      nowEpochMilliseconds,
      liveStateSnapshot,
    );
    this.lastBroadcastMarkerByThreadId.set(threadId, liveStateMarker);
    this.broadcastCount += 1;
  }

  private buildThreadStreamDeltaEvent(
    input: ThreadStreamDeltaEventBuildInput,
  ): FarfieldThreadStreamDeltaEvent {
    return {
      type: THREAD_STREAM_DELTA_EVENT_TYPE,
      delta: {
        threadId: input.threadId,
        liveStateSnapshot: {
          ok: FARFIELD_DELTA_SNAPSHOT_OK,
          threadId: input.threadId,
          ownerClientId: input.liveStateSnapshot.ownerClientId,
          conversationState: input.liveStateSnapshot.conversationState,
          liveStateError: input.liveStateSnapshot.liveStateError,
        },
        streamEventsSnapshot: {
          ok: FARFIELD_DELTA_SNAPSHOT_OK,
          threadId: input.threadId,
          ownerClientId: input.streamEventsSnapshot.ownerClientId,
          events: input.streamEventsSnapshot.events,
          nextSequence: input.streamEventsSnapshot.nextSequence,
          firstAvailableSequence: input.streamEventsSnapshot.firstAvailableSequence,
          resetRequired: input.streamEventsSnapshot.resetRequired,
        },
        streamEventsSinceSequenceUsed: input.sinceSequence,
      },
    };
  }
}

function shouldSuppressBroadcast(input: {
  liveStateMarker: ThreadLiveStateBroadcastMarker;
  previousLiveStateMarker: ThreadLiveStateBroadcastMarker | null;
  streamEventsSnapshot: AgentThreadStreamEvents;
}): boolean {
  if (input.streamEventsSnapshot.events.length > 0 || input.streamEventsSnapshot.resetRequired) {
    return false;
  }

  if (input.previousLiveStateMarker === null) {
    return !hasMeaningfulLiveState(input.liveStateMarker);
  }

  return areThreadLiveStateBroadcastMarkersEqual(
    input.previousLiveStateMarker,
    input.liveStateMarker,
  );
}

function resolveNextStreamEventsSinceSequence(
  previousSinceSequence: number | null,
  streamEventsSnapshot: AgentThreadStreamEvents,
): number | null {
  if (streamEventsSnapshot.nextSequence === 0) {
    return null;
  }

  if (streamEventsSnapshot.resetRequired || streamEventsSnapshot.events.length > 0) {
    return streamEventsSnapshot.nextSequence - 1;
  }

  return previousSinceSequence;
}

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

function createThreadLiveStateBroadcastMarker(
  liveStateSnapshot: AgentThreadLiveState,
): ThreadLiveStateBroadcastMarker {
  return {
    ownerClientId: liveStateSnapshot.ownerClientId,
    conversationState: liveStateSnapshot.conversationState,
    liveStateError: liveStateSnapshot.liveStateError,
  };
}

function hasMeaningfulLiveState(liveStateMarker: ThreadLiveStateBroadcastMarker): boolean {
  return (
    liveStateMarker.ownerClientId !== null ||
    liveStateMarker.conversationState !== null ||
    liveStateMarker.liveStateError !== null
  );
}

function areThreadLiveStateBroadcastMarkersEqual(
  left: ThreadLiveStateBroadcastMarker,
  right: ThreadLiveStateBroadcastMarker,
): boolean {
  return (
    left.ownerClientId === right.ownerClientId &&
    left.conversationState === right.conversationState &&
    areLiveStateErrorsEqual(left.liveStateError, right.liveStateError)
  );
}

function areLiveStateErrorsEqual(
  left: AgentThreadLiveState["liveStateError"],
  right: AgentThreadLiveState["liveStateError"],
): boolean {
  if (left === right) {
    return true;
  }
  if (left === null || right === null) {
    return false;
  }

  return (
    left.kind === right.kind &&
    left.message === right.message &&
    left.eventIndex === right.eventIndex &&
    left.patchIndex === right.patchIndex
  );
}
