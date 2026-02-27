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
  expectedSinceSequence: number | null;
}

// Bounds client-owned stream history to avoid unbounded growth during long-lived sessions.
const STREAM_EVENT_RETENTION_LIMIT = 400;

function areStreamEventsEqual(previousEvents: IpcFrame[], nextEvents: IpcFrame[]): boolean {
  if (previousEvents.length !== nextEvents.length) {
    return false;
  }

  for (let index = 0; index < previousEvents.length; index += 1) {
    const previousEvent = previousEvents[index];
    const nextEvent = nextEvents[index];
    if (JSON.stringify(previousEvent) !== JSON.stringify(nextEvent)) {
      return false;
    }
  }
  return true;
}

export function resolveNextStreamEventsState(input: ResolveNextStreamEventsStateInput): IpcFrame[] {
  if (input.streamEventsSnapshot.resetRequired) {
    if (areStreamEventsEqual(input.previousStreamEvents, input.streamEventsSnapshot.events)) {
      return input.previousStreamEvents;
    }
    return input.streamEventsSnapshot.events;
  }

  if (input.streamEventsSinceSequenceUsed !== null) {
    if (input.streamEventsSinceSequenceUsed !== input.expectedSinceSequence) {
      return input.previousStreamEvents;
    }

    if (input.streamEventsSnapshot.events.length === 0) {
      return input.previousStreamEvents;
    }

    // Cursor-scoped reads include only unseen events, so append order is deterministic.
    const mergedEvents = input.previousStreamEvents.concat(input.streamEventsSnapshot.events);
    return mergedEvents.length > STREAM_EVENT_RETENTION_LIMIT
      ? mergedEvents.slice(-STREAM_EVENT_RETENTION_LIMIT)
      : mergedEvents;
  }

  if (areStreamEventsEqual(input.previousStreamEvents, input.streamEventsSnapshot.events)) {
    return input.previousStreamEvents;
  }
  return input.streamEventsSnapshot.events;
}
