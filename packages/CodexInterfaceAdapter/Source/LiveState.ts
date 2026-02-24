import { z } from "zod";
import {
  JsonValueSchema,
  type JsonObject,
  type JsonValue,
  type ThreadConversationState,
  parseThreadConversationState,
  type ThreadStreamPatch,
  type ThreadStreamStateChangedBroadcast
} from "@farfield/protocol";

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function patchPathSegmentLabel(segment: number | string): string {
  return typeof segment === "number" ? `[${segment}]` : segment;
}

function parseArrayIndex(segment: number | string): number {
  if (typeof segment === "number") {
    if (!Number.isInteger(segment) || segment < 0) {
      throw new Error(`Patch array index invalid: ${String(segment)}`);
    }
    return segment;
  }
  if (!/^(0|[1-9]\d*)$/.test(segment)) {
    throw new Error(`Patch array index invalid: ${String(segment)}`);
  }
  return Number(segment);
}

function isJsonArray(value: JsonValue): value is JsonValue[] {
  return z.array(JsonValueSchema).safeParse(value).success;
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return z.record(JsonValueSchema).safeParse(value).success;
}

function assertPathExists(target: JsonValue, path: (number | string)[]): void {
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
      const key = typeof segment === "number" ? String(segment) : segment;
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
}

function requirePatchValue(patch: ThreadStreamPatch): JsonValue {
  const parsedValue = JsonValueSchema.safeParse(patch.value);
  if (!parsedValue.success) {
    throw new Error(`Patch ${patch.op} requires a structured value`);
  }
  return parsedValue.data;
}

export function applyStrictPatch(
  source: ThreadConversationState,
  patch: ThreadStreamPatch
): ThreadConversationState {
  const state = JsonValueSchema.parse(cloneState(source));

  if (patch.path.length === 0) {
    throw new Error("Patch path cannot be empty");
  }

  const parentPath = patch.path.slice(0, -1);
  const last = patch.path[patch.path.length - 1];
  if (last === undefined) {
    throw new Error("Patch path cannot be empty");
  }

  assertPathExists(state, parentPath);

  let parent: JsonValue = state;
  for (const segment of parentPath) {
    if (isJsonArray(parent)) {
      const index = parseArrayIndex(segment);
      const next = parent[index];
      if (next === undefined) {
        throw new Error(`Patch path segment missing: ${patchPathSegmentLabel(segment)}`);
      }
      parent = next;
      continue;
    }

    const key = typeof segment === "number" ? String(segment) : segment;
    if (!isJsonObject(parent)) {
      throw new Error(`Patch path invalid at segment ${patchPathSegmentLabel(segment)}`);
    }
    const next = parent[key];
    if (next === undefined) {
      throw new Error(`Patch path segment missing: ${patchPathSegmentLabel(segment)}`);
    }
    parent = next;
  }

  if (isJsonArray(parent)) {
    if (patch.op === "add" && last === "-") {
      parent.push(requirePatchValue(patch));
      return parseThreadConversationState(state);
    }

    const arrayIndex = parseArrayIndex(last);

    if (patch.op === "add") {
      if (arrayIndex < 0 || arrayIndex > parent.length) {
        throw new Error(`Patch add index out of range: ${String(last)}`);
      }
      parent.splice(arrayIndex, 0, requirePatchValue(patch));
      return parseThreadConversationState(state);
    }

    if (patch.op === "replace") {
      if (arrayIndex < 0 || arrayIndex >= parent.length) {
        throw new Error(`Patch replace index out of range: ${String(last)}`);
      }
      parent[arrayIndex] = requirePatchValue(patch);
      return parseThreadConversationState(state);
    }

    if (patch.op === "remove") {
      if (arrayIndex < 0 || arrayIndex >= parent.length) {
        throw new Error(`Patch remove index out of range: ${String(last)}`);
      }
      parent.splice(arrayIndex, 1);
      return parseThreadConversationState(state);
    }
  }

  if (isJsonObject(parent)) {
    const key = typeof last === "number" ? String(last) : last;
    if (patch.op === "remove") {
      if (!Object.prototype.hasOwnProperty.call(parent, key)) {
        throw new Error(`Patch remove key missing: ${key}`);
      }
      delete parent[key];
      return parseThreadConversationState(state);
    }

    parent[key] = requirePatchValue(patch);
    return parseThreadConversationState(state);
  }

  throw new Error("Patch target type mismatch");
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

function toErrorMessage(error: Error | string | JsonValue): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

export function reduceThreadStreamEvents(
  events: ThreadStreamStateChangedBroadcast[]
): Map<string, ThreadStreamDerivedState> {
  const byThread = new Map<string, ThreadStreamDerivedState>();

  for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex] as ThreadStreamStateChangedBroadcast;
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

    let updated = next.conversationState;
    for (let patchIndex = 0; patchIndex < change.patches.length; patchIndex += 1) {
      const patch = change.patches[patchIndex] as ThreadStreamPatch;
      try {
        updated = applyStrictPatch(updated, patch);
      } catch (error) {
        const normalizedCause = (() => {
          if (error instanceof Error || typeof error === "string") {
            return error;
          }
          const structuredError = JsonValueSchema.safeParse(error);
          return structuredError.success ? structuredError.data : String(error);
        })();
        throw new ThreadStreamReductionError(
          `Thread stream reduction failed for thread ${threadId} at event ${eventIndex}, patch ${patchIndex}: ${toErrorMessage(
            normalizedCause
          )}`,
          {
            threadId,
            eventIndex,
            patchIndex,
            event,
            patch
          },
          normalizedCause
        );
      }
    }

    next.conversationState = updated;
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

  throw new Error("No turn params template found in conversation state");
}
