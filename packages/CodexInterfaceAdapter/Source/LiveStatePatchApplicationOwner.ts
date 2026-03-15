import {
  type JsonObject,
  type JsonValue,
  JsonValueSchema,
  parseThreadConversationState,
  type ThreadConversationState,
  type ThreadStreamPatch,
} from "@farfield/protocol";
import {
  createPatchSequenceFailureError,
  createPatchSequenceInvalidStateError,
  normalizeErrorCause,
} from "./LiveStateErrorContracts.js";

type PatchPathSegment = number | string;

const PATCH_OPERATION_ADD = "add";
const PATCH_OPERATION_REPLACE = "replace";
const PATCH_OPERATION_REMOVE = "remove";
const PATCH_APPEND_PATH_SEGMENT = "-";
const NON_NEGATIVE_ARRAY_INDEX_SEGMENT_PATTERN = /^(0|[1-9]\d*)$/;
const EMPTY_PATCH_PATH_ERROR_MESSAGE = "Patch path cannot be empty";
const PATCH_TARGET_TYPE_MISMATCH_ERROR_MESSAGE = "Patch target type mismatch";
const UNSUPPORTED_PATCH_OPERATION_ERROR_MESSAGE_PREFIX = "Unsupported patch operation";

function cloneState<ValueType>(value: ValueType): ValueType {
  return JSON.parse(JSON.stringify(value)) as ValueType;
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
  return Object.hasOwn(target, key);
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
    lastSegment,
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
  patch: ThreadStreamPatch,
): void {
  const mutableTarget = target;
  const operation = patch.op;
  switch (operation) {
    case PATCH_OPERATION_ADD: {
      if (lastSegment === PATCH_APPEND_PATH_SEGMENT) {
        mutableTarget.push(requirePatchValue(patch));
        return;
      }

      const arrayIndex = parseArrayIndex(lastSegment);
      if (arrayIndex < 0 || arrayIndex > mutableTarget.length) {
        throw new Error(`Patch add index out of range: ${String(lastSegment)}`);
      }
      mutableTarget.splice(arrayIndex, 0, requirePatchValue(patch));
      return;
    }
    case PATCH_OPERATION_REPLACE: {
      const arrayIndex = parseArrayIndex(lastSegment);
      if (arrayIndex < 0 || arrayIndex >= mutableTarget.length) {
        throw new Error(`Patch replace index out of range: ${String(lastSegment)}`);
      }
      mutableTarget[arrayIndex] = requirePatchValue(patch);
      return;
    }
    case PATCH_OPERATION_REMOVE: {
      const arrayIndex = parseArrayIndex(lastSegment);
      if (arrayIndex < 0 || arrayIndex >= mutableTarget.length) {
        throw new Error(`Patch remove index out of range: ${String(lastSegment)}`);
      }
      mutableTarget.splice(arrayIndex, 1);
      return;
    }
    default:
      throw new Error(`${UNSUPPORTED_PATCH_OPERATION_ERROR_MESSAGE_PREFIX}: ${String(operation)}`);
  }
}

function applyObjectPatch(
  target: JsonObject,
  lastSegment: PatchPathSegment,
  patch: ThreadStreamPatch,
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

  if (operation === PATCH_OPERATION_REPLACE) {
    if (!hasOwnJsonProperty(mutableTarget, key)) {
      throw new Error(`Patch replace key missing: ${key}`);
    }
    mutableTarget[key] = requirePatchValue(patch);
    return;
  }

  if (operation !== PATCH_OPERATION_ADD) {
    throw new Error(`${UNSUPPORTED_PATCH_OPERATION_ERROR_MESSAGE_PREFIX}: ${String(operation)}`);
  }

  mutableTarget[key] = requirePatchValue(patch);
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

function applyPatchSequenceToMutableState(
  mutableState: JsonValue,
  patches: ThreadStreamPatch[],
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

function getLastAppliedPatchIndex(patchCount: number): number {
  return patchCount > 0 ? patchCount - 1 : 0;
}

function localizeFirstInvalidFinalStatePatchIndex(
  source: ThreadConversationState,
  patches: ThreadStreamPatch[],
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
  patch: ThreadStreamPatch,
): ThreadConversationState {
  const state = JsonValueSchema.parse(cloneState(source));
  applyPatchToState(state, patch);
  return parseThreadConversationState(state);
}

export function applyStrictPatchSequence(
  source: ThreadConversationState,
  patches: ThreadStreamPatch[],
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
  patches: ThreadStreamPatch[],
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
