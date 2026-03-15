import type { IpcFrame, JsonValue } from "@farfield/protocol";

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

function areJsonValuesEqual(
  leftValue: JsonValue | undefined,
  rightValue: JsonValue | undefined,
): boolean {
  if (leftValue === rightValue) {
    return true;
  }
  if (leftValue === undefined || rightValue === undefined) {
    return false;
  }
  if (leftValue === null || rightValue === null) {
    return leftValue === rightValue;
  }
  if (Array.isArray(leftValue) || Array.isArray(rightValue)) {
    if (!Array.isArray(leftValue) || !Array.isArray(rightValue)) {
      return false;
    }
    if (leftValue.length !== rightValue.length) {
      return false;
    }
    for (let index = 0; index < leftValue.length; index += 1) {
      const leftItem = leftValue[index];
      const rightItem = rightValue[index];
      if (!areJsonValuesEqual(leftItem, rightItem)) {
        return false;
      }
    }
    return true;
  }
  if (typeof leftValue === "object" || typeof rightValue === "object") {
    if (typeof leftValue !== "object" || typeof rightValue !== "object") {
      return false;
    }
    const leftKeys = Object.keys(leftValue);
    const rightKeys = Object.keys(rightValue);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    for (const leftKey of leftKeys) {
      if (!(leftKey in rightValue)) {
        return false;
      }
      if (!areJsonValuesEqual(leftValue[leftKey], rightValue[leftKey])) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function areIpcFramesEqual(previousEvent: IpcFrame, nextEvent: IpcFrame): boolean {
  if (previousEvent === nextEvent) {
    return true;
  }
  if (previousEvent.type !== nextEvent.type) {
    return false;
  }

  switch (previousEvent.type) {
    case "request":
      return (
        nextEvent.type === "request" &&
        previousEvent.requestId === nextEvent.requestId &&
        previousEvent.method === nextEvent.method &&
        previousEvent.targetClientId === nextEvent.targetClientId &&
        previousEvent.sourceClientId === nextEvent.sourceClientId &&
        previousEvent.version === nextEvent.version &&
        areJsonValuesEqual(previousEvent.params, nextEvent.params)
      );
    case "response":
      return (
        nextEvent.type === "response" &&
        previousEvent.requestId === nextEvent.requestId &&
        previousEvent.method === nextEvent.method &&
        previousEvent.handledByClientId === nextEvent.handledByClientId &&
        previousEvent.resultType === nextEvent.resultType &&
        areJsonValuesEqual(previousEvent.result, nextEvent.result) &&
        areJsonValuesEqual(previousEvent.error, nextEvent.error)
      );
    case "broadcast":
      return (
        nextEvent.type === "broadcast" &&
        previousEvent.method === nextEvent.method &&
        previousEvent.sourceClientId === nextEvent.sourceClientId &&
        previousEvent.targetClientId === nextEvent.targetClientId &&
        previousEvent.version === nextEvent.version &&
        areJsonValuesEqual(previousEvent.params, nextEvent.params)
      );
    case "client-discovery-request":
      return (
        nextEvent.type === "client-discovery-request" &&
        previousEvent.requestId === nextEvent.requestId &&
        areIpcFramesEqual(previousEvent.request, nextEvent.request)
      );
    case "client-discovery-response":
      return (
        nextEvent.type === "client-discovery-response" &&
        previousEvent.requestId === nextEvent.requestId &&
        previousEvent.response.canHandle === nextEvent.response.canHandle
      );
  }
}

function areStreamEventsEqual(previousEvents: IpcFrame[], nextEvents: IpcFrame[]): boolean {
  if (previousEvents.length !== nextEvents.length) {
    return false;
  }

  for (let index = 0; index < previousEvents.length; index += 1) {
    const previousEvent = previousEvents[index];
    const nextEvent = nextEvents[index];
    if (previousEvent === undefined || nextEvent === undefined) {
      return false;
    }
    if (!areIpcFramesEqual(previousEvent, nextEvent)) {
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
