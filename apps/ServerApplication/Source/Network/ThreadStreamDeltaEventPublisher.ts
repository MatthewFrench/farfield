import type { FarfieldThreadStreamDeltaEvent } from "@farfield/protocol";
import { logger } from "../Shared/Logging/Logger.js";
import type {
  AgentThreadLiveState,
  AgentThreadStreamEvents
} from "../Agents/Types.js";
import type { EventStreamClientRegistry } from "./EventStreamClientRegistry.js";

const STREAM_EVENT_LIMIT = 400;
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
  readThreadLiveState: (threadId: string) => Promise<AgentThreadLiveState>;
  readThreadStreamEvents: (
    threadId: string,
    sinceSequence: number | null,
    limit: number
  ) => Promise<AgentThreadStreamEvents>;
}

/**
 * Owns stream-delta publication from in-memory thread projections to the shared event stream.
 * The owner coalesces per-thread triggers and publishes deterministic cursor-based deltas so
 * web clients can append or reset without full selected-thread refetches.
 */
export class ThreadStreamDeltaEventPublisher {
  private readonly eventStreamClientRegistry: EventStreamClientRegistry;
  private readonly readThreadLiveState: (threadId: string) => Promise<AgentThreadLiveState>;
  private readonly readThreadStreamEvents: (
    threadId: string,
    sinceSequence: number | null,
    limit: number
  ) => Promise<AgentThreadStreamEvents>;
  private readonly inFlightThreadIdSet: Set<string>;
  private readonly pendingThreadIdSet: Set<string>;
  private readonly lastPublishedSequenceByThreadId: Map<string, number>;
  private scheduledPublishCount: number;
  private startedPublishCount: number;
  private completedPublishCount: number;
  private failedPublishCount: number;
  private broadcastCount: number;
  private suppressedBroadcastCount: number;

  public constructor(dependencies: ThreadStreamDeltaEventPublisherDependencies) {
    this.eventStreamClientRegistry = dependencies.eventStreamClientRegistry;
    this.readThreadLiveState = dependencies.readThreadLiveState;
    this.readThreadStreamEvents = dependencies.readThreadStreamEvents;
    this.inFlightThreadIdSet = new Set<string>();
    this.pendingThreadIdSet = new Set<string>();
    this.lastPublishedSequenceByThreadId = new Map<string, number>();
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
      inFlightThreadCount: this.inFlightThreadIdSet.size
    };
  }

  private async publishPendingThread(threadId: string): Promise<void> {
    this.startedPublishCount += 1;
    try {
      while (this.pendingThreadIdSet.delete(threadId)) {
        await this.publishThreadDelta(threadId);
      }
      this.completedPublishCount += 1;
    } catch (error) {
      this.failedPublishCount += 1;
      logger.warn(
        {
          threadId,
          error: toErrorMessage(error)
        },
        THREAD_STREAM_DELTA_PUBLISH_FAILED_LOG_EVENT
      );
    } finally {
      this.inFlightThreadIdSet.delete(threadId);
      if (this.pendingThreadIdSet.has(threadId)) {
        this.schedulePublish(threadId);
      }
    }
  }

  private async publishThreadDelta(threadId: string): Promise<void> {
    const sinceSequence = this.lastPublishedSequenceByThreadId.get(threadId) ?? null;
    const [liveStateSnapshot, streamEventsSnapshot] = await Promise.all([
      this.readThreadLiveState(threadId),
      this.readThreadStreamEvents(threadId, sinceSequence, STREAM_EVENT_LIMIT)
    ]);
    this.lastPublishedSequenceByThreadId.set(threadId, streamEventsSnapshot.nextSequence);

    if (streamEventsSnapshot.events.length === 0 && !streamEventsSnapshot.resetRequired) {
      this.suppressedBroadcastCount += 1;
      return;
    }

    const event: FarfieldThreadStreamDeltaEvent = {
      type: "thread-stream-delta",
      delta: {
        threadId,
        liveStateSnapshot: {
          ok: true,
          threadId,
          ownerClientId: liveStateSnapshot.ownerClientId,
          conversationState: liveStateSnapshot.conversationState,
          liveStateError: liveStateSnapshot.liveStateError
        },
        streamEventsSnapshot: {
          ok: true,
          threadId,
          ownerClientId: streamEventsSnapshot.ownerClientId,
          events: streamEventsSnapshot.events,
          nextSequence: streamEventsSnapshot.nextSequence,
          firstAvailableSequence: streamEventsSnapshot.firstAvailableSequence,
          resetRequired: streamEventsSnapshot.resetRequired
        },
        streamEventsSinceSequenceUsed: sinceSequence
      }
    };
    this.eventStreamClientRegistry.broadcast(event);
    this.broadcastCount += 1;
  }
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
