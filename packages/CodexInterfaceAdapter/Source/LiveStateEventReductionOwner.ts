import {
  type ThreadConversationState,
  type ThreadStreamPatch,
  type ThreadStreamStateChangedBroadcast,
} from "@farfield/protocol";
import {
  createThreadStreamReductionError,
  normalizeErrorCause,
} from "./LiveStateErrorContracts.js";
import { applyStrictPatch } from "./LiveStatePatchApplicationOwner.js";

const NO_TURN_PARAMS_TEMPLATE_ERROR_MESSAGE = "No turn params template found in conversation state";
const THREAD_STREAM_CHANGE_TYPE_SNAPSHOT = "snapshot";

export interface ThreadStreamDerivedState {
  ownerClientId: string | null;
  conversationState: ThreadConversationState | null;
}

function applyEventPatchSequence(
  threadId: string,
  eventIndex: number,
  event: ThreadStreamStateChangedBroadcast,
  sourceConversationState: ThreadConversationState,
  patches: ThreadStreamPatch[],
): ThreadConversationState {
  // Stream reduction keeps strict per-patch validation so failures retain
  // deterministic event/patch localization metadata for diagnostics.
  let updatedConversationState = sourceConversationState;
  for (let patchIndex = 0; patchIndex < patches.length; patchIndex += 1) {
    const patch = patches[patchIndex];
    if (!patch) {
      continue;
    }
    try {
      updatedConversationState = applyStrictPatch(updatedConversationState, patch);
    } catch (error) {
      const normalizedCause = normalizeErrorCause(error);
      throw createThreadStreamReductionError(
        threadId,
        eventIndex,
        patchIndex,
        event,
        patch,
        normalizedCause,
      );
    }
  }
  return updatedConversationState;
}

function createEmptyThreadStreamDerivedState(): ThreadStreamDerivedState {
  return {
    ownerClientId: null,
    conversationState: null,
  };
}

function createNextThreadStreamDerivedState(
  previous: ThreadStreamDerivedState,
  sourceClientId: string,
): ThreadStreamDerivedState {
  return {
    ownerClientId: sourceClientId,
    conversationState: previous.conversationState,
  };
}

function reduceThreadStreamEvent(
  byThread: Map<string, ThreadStreamDerivedState>,
  event: ThreadStreamStateChangedBroadcast,
  eventIndex: number,
): void {
  const threadId = event.params.conversationId;
  const previous = byThread.get(threadId) ?? createEmptyThreadStreamDerivedState();
  const next = createNextThreadStreamDerivedState(previous, event.sourceClientId);
  const change = event.params.change;
  const changeType = change.type;

  if (changeType === THREAD_STREAM_CHANGE_TYPE_SNAPSHOT) {
    next.conversationState = change.conversationState;
    byThread.set(threadId, next);
    return;
  }
  if (next.conversationState !== null) {
    next.conversationState = applyEventPatchSequence(
      threadId,
      eventIndex,
      event,
      next.conversationState,
      change.patches,
    );
    byThread.set(threadId, next);
    return;
  }

  // Event ownership still advances to the most recent producer even when
  // patch events arrive before a thread has emitted its first snapshot.
  byThread.set(threadId, next);
}

export function reduceThreadStreamEvents(
  events: ThreadStreamStateChangedBroadcast[],
): Map<string, ThreadStreamDerivedState> {
  const byThread = new Map<string, ThreadStreamDerivedState>();

  // Apply events strictly in caller-provided order so replay remains deterministic.
  for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex];
    if (!event) {
      continue;
    }
    reduceThreadStreamEvent(byThread, event, eventIndex);
  }

  return byThread;
}

export function findLatestTurnParamsTemplate(
  conversationState: ThreadConversationState,
): NonNullable<ThreadConversationState["turns"][number]["params"]> {
  for (let i = conversationState.turns.length - 1; i >= 0; i -= 1) {
    const turn = conversationState.turns[i];
    if (turn?.params) {
      return turn.params;
    }
  }

  throw new Error(NO_TURN_PARAMS_TEMPLATE_ERROR_MESSAGE);
}
