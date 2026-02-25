import type { FarfieldThreadStreamDeltaEvent } from "@farfield/protocol";
import { logger } from "../Shared/Logging/Logger.js";
import type {
  AgentThreadLiveState,
  AgentThreadStreamEvents
} from "../Agents/Types.js";
import type { EventStreamClientRegistry } from "./EventStreamClientRegistry.js";

const STREAM_EVENT_LIMIT = 400;

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

  public constructor(dependencies: ThreadStreamDeltaEventPublisherDependencies) {
    this.eventStreamClientRegistry = dependencies.eventStreamClientRegistry;
    this.readThreadLiveState = dependencies.readThreadLiveState;
    this.readThreadStreamEvents = dependencies.readThreadStreamEvents;
    this.inFlightThreadIdSet = new Set<string>();
    this.pendingThreadIdSet = new Set<string>();
    this.lastPublishedSequenceByThreadId = new Map<string, number>();
  }

  public schedulePublish(threadId: string): void {
    const normalizedThreadId = threadId.trim();
    if (normalizedThreadId.length === 0) {
      return;
    }

    this.pendingThreadIdSet.add(normalizedThreadId);
    if (this.inFlightThreadIdSet.has(normalizedThreadId)) {
      return;
    }

    this.inFlightThreadIdSet.add(normalizedThreadId);
    queueMicrotask(() => {
      void this.publishPendingThread(normalizedThreadId);
    });
  }

  private async publishPendingThread(threadId: string): Promise<void> {
    try {
      while (this.pendingThreadIdSet.delete(threadId)) {
        await this.publishThreadDelta(threadId);
      }
    } catch (error) {
      logger.warn(
        {
          threadId,
          error: toErrorMessage(error)
        },
        "thread-stream-delta-publish-failed"
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
