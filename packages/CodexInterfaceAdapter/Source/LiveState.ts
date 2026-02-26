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

const PATCH_OPERATION_ADD = "add";
const PATCH_OPERATION_REPLACE = "replace";
const PATCH_OPERATION_REMOVE = "remove";
const PATCH_APPEND_PATH_SEGMENT = "-";
const NON_NEGATIVE_ARRAY_INDEX_SEGMENT_PATTERN = /^(0|[1-9]\d*)$/;
const EMPTY_PATCH_PATH_ERROR_MESSAGE = "Patch path cannot be empty";
const PATCH_SEQUENCE_FAILURE_MESSAGE_PREFIX = "Patch sequence failed at index";
const PATCH_SEQUENCE_INVALID_STATE_MESSAGE_PREFIX =
  "Patch sequence produced invalid conversation state at index";
const NO_TURN_PARAMS_TEMPLATE_ERROR_MESSAGE = "No turn params template found in conversation state";
const PATCH_TARGET_TYPE_MISMATCH_ERROR_MESSAGE = "Patch target type mismatch";
const THREAD_STREAM_CHANGE_TYPE_SNAPSHOT = "snapshot";
const STRICT_PATCH_SEQUENCE_ERROR_NAME = "StrictPatchSequenceError";
const THREAD_STREAM_REDUCTION_ERROR_NAME = "ThreadStreamReductionError";
const UNSUPPORTED_PATCH_OPERATION_ERROR_MESSAGE_PREFIX = "Unsupported patch operation";

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

function hasOwnJsonProperty(target: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
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
      if (!hasOwnJsonProperty(cursor, key)) {
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

function applyArrayPatch(
  target: JsonValue[],
  lastSegment: PatchPathSegment,
  patch: ThreadStreamPatch
): void {
  const mutableTarget = target;
  const operation = patch.op;
  if (operation === PATCH_OPERATION_ADD && lastSegment === PATCH_APPEND_PATH_SEGMENT) {
    mutableTarget.push(requirePatchValue(patch));
    return;
  }

  const arrayIndex = parseArrayIndex(lastSegment);

  if (operation === PATCH_OPERATION_ADD) {
    if (arrayIndex < 0 || arrayIndex > mutableTarget.length) {
      throw new Error(`Patch add index out of range: ${String(lastSegment)}`);
    }
    mutableTarget.splice(arrayIndex, 0, requirePatchValue(patch));
    return;
  }

  if (operation === PATCH_OPERATION_REPLACE) {
    if (arrayIndex < 0 || arrayIndex >= mutableTarget.length) {
      throw new Error(`Patch replace index out of range: ${String(lastSegment)}`);
    }
    mutableTarget[arrayIndex] = requirePatchValue(patch);
    return;
  }

  if (arrayIndex < 0 || arrayIndex >= mutableTarget.length) {
    throw new Error(`Patch remove index out of range: ${String(lastSegment)}`);
  }
  mutableTarget.splice(arrayIndex, 1);
  return;

  throw new Error(`${UNSUPPORTED_PATCH_OPERATION_ERROR_MESSAGE_PREFIX}: ${String(operation)}`);
}

function applyObjectPatch(
  target: JsonObject,
  lastSegment: PatchPathSegment,
  patch: ThreadStreamPatch
): void {
  const mutableTarget = target;
  const operation = patch.op;
  const key = toObjectPathKey(lastSegment);
  if (operation === PATCH_OPERATION_REMOVE) {
    if (!hasOwnJsonProperty(mutableTarget, key)) {
      throw new Error(`Patch remove key missing: ${key}`);
    }
    delete mutableTarget[key];
    return;
  }

  mutableTarget[key] = requirePatchValue(patch);
  return;
}

function applyPatchToState(state: JsonValue, patch: ThreadStreamPatch): void {
  const { parentPath, lastSegment } = splitPatchPath(patch.path);
  const parent = resolvePathValue(state, parentPath);

  if (isJsonArray(parent)) {
    applyArrayPatch(parent, lastSegment, patch);
    return;
  }

  if (isJsonObject(parent)) {
    applyObjectPatch(parent, lastSegment, patch);
    return;
  }

  throw new Error(PATCH_TARGET_TYPE_MISMATCH_ERROR_MESSAGE);
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
    this.name = STRICT_PATCH_SEQUENCE_ERROR_NAME;
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
    this.name = THREAD_STREAM_REDUCTION_ERROR_NAME;
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

function createEmptyThreadStreamDerivedState(): ThreadStreamDerivedState {
  return {
    ownerClientId: null,
    conversationState: null
  };
}

function createNextThreadStreamDerivedState(
  previous: ThreadStreamDerivedState,
  sourceClientId: string
): ThreadStreamDerivedState {
  return {
    ownerClientId: sourceClientId,
    conversationState: previous.conversationState
  };
}

function reduceThreadStreamEvent(
  byThread: Map<string, ThreadStreamDerivedState>,
  event: ThreadStreamStateChangedBroadcast,
  eventIndex: number
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
      change.patches
    );
    byThread.set(threadId, next);
    return;
  }

  // Event ownership still advances to the most recent producer even when
  // patch events arrive before a thread has emitted its first snapshot.
  byThread.set(threadId, next);
}

export function reduceThreadStreamEvents(
  events: ThreadStreamStateChangedBroadcast[]
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
