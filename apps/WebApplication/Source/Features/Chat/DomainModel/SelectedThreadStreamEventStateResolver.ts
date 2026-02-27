import type { IpcFrame } from "@farfield/protocol";

interface StreamEventsSnapshotContract {
  events: IpcFrame[];
  nextSequence: number;
  resetRequired: boolean;
}

interface ResolveNextStreamEventsStateInput {
  previousStreamEvents: IpcFrame[];
  streamEventsSnapshot: StreamEventsSnapshotContract;
  streamEventsSinceSequenceUsed: number | null;
}

// Bounds client-owned stream history to avoid unbounded growth during long-lived sessions.
const STREAM_EVENT_RETENTION_LIMIT = 400;

function matchesStreamEventTail(previousEvents: IpcFrame[], nextEvents: IpcFrame[]): boolean {
  const previousLastEvent = previousEvents[previousEvents.length - 1];
  const nextLastEvent = nextEvents[nextEvents.length - 1];
  const previousLastSignature = previousLastEvent ? JSON.stringify(previousLastEvent) : "";
  const nextLastSignature = nextLastEvent ? JSON.stringify(nextLastEvent) : "";
  // Deliberately coarse guard: when lengths and trailing signatures match, treat snapshots as equivalent.
  return previousEvents.length === nextEvents.length && previousLastSignature === nextLastSignature;
}

export function resolveNextStreamEventsState(input: ResolveNextStreamEventsStateInput): IpcFrame[] {
  if (input.streamEventsSnapshot.resetRequired) {
    if (matchesStreamEventTail(input.previousStreamEvents, input.streamEventsSnapshot.events)) {
      return input.previousStreamEvents;
    }
    return input.streamEventsSnapshot.events;
  }

  if (input.streamEventsSinceSequenceUsed !== null) {
    if (input.streamEventsSnapshot.events.length === 0) {
      return input.previousStreamEvents;
    }

    // Cursor-scoped reads include only unseen events, so append order is deterministic.
    const mergedEvents = input.previousStreamEvents.concat(input.streamEventsSnapshot.events);
    return mergedEvents.length > STREAM_EVENT_RETENTION_LIMIT
      ? mergedEvents.slice(-STREAM_EVENT_RETENTION_LIMIT)
      : mergedEvents;
  }

  if (matchesStreamEventTail(input.previousStreamEvents, input.streamEventsSnapshot.events)) {
    return input.previousStreamEvents;
  }
  return input.streamEventsSnapshot.events;
}
