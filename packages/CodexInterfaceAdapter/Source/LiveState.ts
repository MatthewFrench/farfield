import {
  JsonValueSchema,
  type JsonObject,
  type JsonValue,
  type ThreadConversationState,
  parseThreadConversationState,
  type ThreadStreamPatch,
  type ThreadStreamStateChangedBroadcast
} from "@farfield/protocol";

type PatchPathSegment = number | string;

const PATCH_APPEND_PATH_SEGMENT = "-";
const NON_NEGATIVE_ARRAY_INDEX_SEGMENT_PATTERN = /^(0|[1-9]\d*)$/;
const EMPTY_PATCH_PATH_ERROR_MESSAGE = "Patch path cannot be empty";
const PATCH_SEQUENCE_FAILURE_MESSAGE_PREFIX = "Patch sequence failed at index";
const PATCH_SEQUENCE_INVALID_STATE_MESSAGE_PREFIX =
  "Patch sequence produced invalid conversation state at index";
const NO_TURN_PARAMS_TEMPLATE_ERROR_MESSAGE = "No turn params template found in conversation state";

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function patchPathSegmentLabel(segment: PatchPathSegment): string {
  return typeof segment === "number" ? `[${segment}]` : segment;
}

function parseArrayIndex(segment: PatchPathSegment): number {
  if (typeof segment === "number") {
    if (!Number.isInteger(segment) || segment < 0) {
      throw new Error(`Patch array index invalid: ${String(segment)}`);
    }
    return segment;
  }
  if (!NON_NEGATIVE_ARRAY_INDEX_SEGMENT_PATTERN.test(segment)) {
    throw new Error(`Patch array index invalid: ${String(segment)}`);
  }
  return Number(segment);
}

function toObjectPathKey(segment: PatchPathSegment): string {
  return typeof segment === "number" ? String(segment) : segment;
}

function isJsonArray(value: JsonValue): value is JsonValue[] {
  return Array.isArray(value);
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function splitPatchPath(path: PatchPathSegment[]): {
  parentPath: PatchPathSegment[];
  lastSegment: PatchPathSegment;
} {
  if (path.length === 0) {
    throw new Error(EMPTY_PATCH_PATH_ERROR_MESSAGE);
  }

  const lastSegment = path[path.length - 1];
  if (lastSegment === undefined) {
    throw new Error(EMPTY_PATCH_PATH_ERROR_MESSAGE);
  }

  return {
    parentPath: path.slice(0, -1),
    lastSegment
  };
}

function resolvePathValue(target: JsonValue, path: PatchPathSegment[]): JsonValue {
  let cursor = target;
  for (const segment of path) {
    if (isJsonArray(cursor)) {
      const index = parseArrayIndex(segment);
      if (index < 0 || index >= cursor.length) {
        throw new Error(`Patch path segment out of range: ${patchPathSegmentLabel(segment)}`);
      }
      const next = cursor[index];
      if (next === undefined) {
        throw new Error(`Patch path segment missing: ${patchPathSegmentLabel(segment)}`);
      }
      cursor = next;
      continue;
    }

    if (isJsonObject(cursor)) {
      const key = toObjectPathKey(segment);
      if (!Object.prototype.hasOwnProperty.call(cursor, key)) {
        throw new Error(`Patch path segment missing: ${patchPathSegmentLabel(segment)}`);
      }
      const next = cursor[key];
      if (next === undefined) {
        throw new Error(`Patch path segment missing: ${patchPathSegmentLabel(segment)}`);
      }
      cursor = next;
      continue;
    }

    throw new Error(`Patch path invalid at segment ${patchPathSegmentLabel(segment)}`);
  }

  return cursor;
}

function requirePatchValue(patch: ThreadStreamPatch): JsonValue {
  if (patch.value === undefined) {
    throw new Error(`Patch ${patch.op} requires a structured value`);
  }
  return patch.value;
}

function applyPatchToState(state: JsonValue, patch: ThreadStreamPatch): void {
  const stateValue = state;

  const { parentPath, lastSegment } = splitPatchPath(patch.path);
  const parent = resolvePathValue(stateValue, parentPath);

  if (isJsonArray(parent)) {
    if (patch.op === "add" && lastSegment === PATCH_APPEND_PATH_SEGMENT) {
      parent.push(requirePatchValue(patch));
      return;
    }

    const arrayIndex = parseArrayIndex(lastSegment);

    if (patch.op === "add") {
      if (arrayIndex < 0 || arrayIndex > parent.length) {
        throw new Error(`Patch add index out of range: ${String(lastSegment)}`);
      }
      parent.splice(arrayIndex, 0, requirePatchValue(patch));
      return;
    }

    if (patch.op === "replace") {
      if (arrayIndex < 0 || arrayIndex >= parent.length) {
        throw new Error(`Patch replace index out of range: ${String(lastSegment)}`);
      }
      parent[arrayIndex] = requirePatchValue(patch);
      return;
    }

    if (patch.op === "remove") {
      if (arrayIndex < 0 || arrayIndex >= parent.length) {
        throw new Error(`Patch remove index out of range: ${String(lastSegment)}`);
      }
      parent.splice(arrayIndex, 1);
      return;
    }
  }

  if (isJsonObject(parent)) {
    const key = toObjectPathKey(lastSegment);
    if (patch.op === "remove") {
      if (!Object.prototype.hasOwnProperty.call(parent, key)) {
        throw new Error(`Patch remove key missing: ${key}`);
      }
      delete parent[key];
      return;
    }

    parent[key] = requirePatchValue(patch);
    return;
  }

  throw new Error("Patch target type mismatch");
}

export class StrictPatchSequenceError extends Error {
  public readonly patchIndex: number;
  public override readonly cause: Error | string | JsonValue | undefined;

  public constructor(
    message: string,
    patchIndex: number,
    cause?: Error | string | JsonValue
  ) {
    super(message);
    this.name = "StrictPatchSequenceError";
    this.patchIndex = patchIndex;
    this.cause = cause;
  }
}

function getLastAppliedPatchIndex(patchCount: number): number {
  return patchCount > 0 ? patchCount - 1 : 0;
}

function createPatchSequenceFailureError(
  patchIndex: number,
  cause: Error | string | JsonValue
): StrictPatchSequenceError {
  return new StrictPatchSequenceError(
    `${PATCH_SEQUENCE_FAILURE_MESSAGE_PREFIX} ${String(patchIndex)}: ${toErrorMessage(cause)}`,
    patchIndex,
    cause
  );
}

function createPatchSequenceInvalidStateError(
  patchIndex: number,
  cause: Error | string | JsonValue
): StrictPatchSequenceError {
  return new StrictPatchSequenceError(
    `${PATCH_SEQUENCE_INVALID_STATE_MESSAGE_PREFIX} ${String(patchIndex)}: ${toErrorMessage(cause)}`,
    patchIndex,
    cause
  );
}

function applyPatchSequenceToMutableState(
  mutableState: JsonValue,
  patches: ThreadStreamPatch[]
): void {
  for (let patchIndex = 0; patchIndex < patches.length; patchIndex += 1) {
    const patch = patches[patchIndex];
    if (!patch) {
      continue;
    }

    try {
      applyPatchToState(mutableState, patch);
    } catch (error) {
      const normalizedCause = normalizeErrorCause(error);
      throw createPatchSequenceFailureError(patchIndex, normalizedCause);
    }
  }
}

function localizeFirstInvalidFinalStatePatchIndex(
  source: ThreadConversationState,
  patches: ThreadStreamPatch[]
): number {
  const defaultFailingPatchIndex = getLastAppliedPatchIndex(patches.length);
  if (patches.length === 0) {
    return defaultFailingPatchIndex;
  }

  // Replay runs only for terminal validation failures so steady-state reduction
  // avoids per-patch schema parsing in this strict sequence helper.
  const replayState = JsonValueSchema.parse(cloneState(source));
  for (let patchIndex = 0; patchIndex < patches.length; patchIndex += 1) {
    const patch = patches[patchIndex];
    if (!patch) {
      continue;
    }

    applyPatchToState(replayState, patch);
    try {
      parseThreadConversationState(replayState);
    } catch {
      return patchIndex;
    }
  }

  return defaultFailingPatchIndex;
}

export function applyStrictPatch(
  source: ThreadConversationState,
  patch: ThreadStreamPatch
): ThreadConversationState {
  const state = JsonValueSchema.parse(cloneState(source));
  applyPatchToState(state, patch);
  return parseThreadConversationState(state);
}

export function applyStrictPatchSequence(
  source: ThreadConversationState,
  patches: ThreadStreamPatch[]
): ThreadConversationState {
  const state = JsonValueSchema.parse(cloneState(source));
  applyPatchSequenceToMutableState(state, patches);

  try {
    return parseThreadConversationState(state);
  } catch (error) {
    const failingPatchIndex = localizeFirstInvalidFinalStatePatchIndex(source, patches);
    const normalizedCause = normalizeErrorCause(error);
    throw createPatchSequenceInvalidStateError(failingPatchIndex, normalizedCause);
  }
}

/**
 * Applies stream patches to an already-validated conversation state without cloning or
 * per-patch schema validation while still enforcing one end-state schema validation.
 * This hot-path reducer is reserved for trusted stream payloads parsed at transport boundaries.
 */
export function applyTrustedPatchSequence(
  source: ThreadConversationState,
  patches: ThreadStreamPatch[]
): ThreadConversationState {
  const mutableState = source as JsonValue;
  applyPatchSequenceToMutableState(mutableState, patches);

  try {
    return parseThreadConversationState(mutableState);
  } catch (error) {
    const failingPatchIndex = getLastAppliedPatchIndex(patches.length);
    const normalizedCause = normalizeErrorCause(error);
    throw createPatchSequenceInvalidStateError(failingPatchIndex, normalizedCause);
  }
}

export interface ThreadStreamDerivedState {
  ownerClientId: string | null;
  conversationState: ThreadConversationState | null;
}

export interface ThreadStreamReductionErrorDetails {
  threadId: string;
  eventIndex: number;
  patchIndex: number;
  event: ThreadStreamStateChangedBroadcast;
  patch: ThreadStreamPatch;
}

export class ThreadStreamReductionError extends Error {
  public readonly details: ThreadStreamReductionErrorDetails;
  public override readonly cause: Error | string | JsonValue | undefined;

  public constructor(
    message: string,
    details: ThreadStreamReductionErrorDetails,
    cause?: Error | string | JsonValue
  ) {
    super(message);
    this.name = "ThreadStreamReductionError";
    this.details = details;
    this.cause = cause;
  }
}

function createThreadStreamReductionError(
  threadId: string,
  eventIndex: number,
  patchIndex: number,
  event: ThreadStreamStateChangedBroadcast,
  patch: ThreadStreamPatch,
  cause: Error | string | JsonValue
): ThreadStreamReductionError {
  return new ThreadStreamReductionError(
    `Thread stream reduction failed for thread ${threadId} at event ${eventIndex}, patch ${patchIndex}: ${toErrorMessage(
      cause
    )}`,
    {
      threadId,
      eventIndex,
      patchIndex,
      event,
      patch
    },
    cause
  );
}

function toErrorMessage(error: Error | string | JsonValue): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

function normalizeErrorCause<ErrorType>(error: ErrorType): Error | string | JsonValue {
  if (error instanceof Error || typeof error === "string") {
    return error;
  }

  const structuredError = JsonValueSchema.safeParse(error);
  return structuredError.success ? structuredError.data : String(error);
}

function applyEventPatchSequence(
  threadId: string,
  eventIndex: number,
  event: ThreadStreamStateChangedBroadcast,
  sourceConversationState: ThreadConversationState,
  patches: ThreadStreamPatch[]
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
        normalizedCause
      );
    }
  }
  return updatedConversationState;
}

export function reduceThreadStreamEvents(
  events: ThreadStreamStateChangedBroadcast[]
): Map<string, ThreadStreamDerivedState> {
  const byThread = new Map<string, ThreadStreamDerivedState>();

  for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex];
    if (!event) {
      continue;
    }
    const threadId = event.params.conversationId;
    const previous = byThread.get(threadId) ?? {
      ownerClientId: null,
      conversationState: null
    };

    const next: ThreadStreamDerivedState = {
      ownerClientId: event.sourceClientId,
      conversationState: previous.conversationState
    };

    const change = event.params.change;

    if (change.type === "snapshot") {
      next.conversationState = change.conversationState;
      byThread.set(threadId, next);
      continue;
    }

    if (!next.conversationState) {
      // The desktop app can emit patches before the first snapshot for a thread.
      // Ignore these until we have a concrete base state.
      byThread.set(threadId, next);
      continue;
    }

    next.conversationState = applyEventPatchSequence(
      threadId,
      eventIndex,
      event,
      next.conversationState,
      change.patches
    );
    byThread.set(threadId, next);
  }

  return byThread;
}

export function findLatestTurnParamsTemplate(
  conversationState: ThreadConversationState
): NonNullable<ThreadConversationState["turns"][number]["params"]> {
  for (let i = conversationState.turns.length - 1; i >= 0; i -= 1) {
    const turn = conversationState.turns[i];
    if (turn?.params) {
      return turn.params;
    }
  }

  throw new Error(NO_TURN_PARAMS_TEMPLATE_ERROR_MESSAGE);
}
