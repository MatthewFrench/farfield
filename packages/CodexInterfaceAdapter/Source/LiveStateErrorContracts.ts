import type {
  JsonValue,
  ThreadStreamPatch,
  ThreadStreamStateChangedBroadcast
} from "@farfield/protocol";
import { JsonValueSchema } from "@farfield/protocol";

const PATCH_SEQUENCE_FAILURE_MESSAGE_PREFIX = "Patch sequence failed at index";
const PATCH_SEQUENCE_INVALID_STATE_MESSAGE_PREFIX =
  "Patch sequence produced invalid conversation state at index";
const STRICT_PATCH_SEQUENCE_ERROR_NAME = "StrictPatchSequenceError";
const THREAD_STREAM_REDUCTION_ERROR_NAME = "ThreadStreamReductionError";

export type LiveStateErrorCause = Error | string | JsonValue;

export class StrictPatchSequenceError extends Error {
  public readonly patchIndex: number;
  public override readonly cause: LiveStateErrorCause | undefined;

  public constructor(
    message: string,
    patchIndex: number,
    cause?: LiveStateErrorCause
  ) {
    super(message);
    this.name = STRICT_PATCH_SEQUENCE_ERROR_NAME;
    this.patchIndex = patchIndex;
    this.cause = cause;
  }
}

export function createPatchSequenceFailureError(
  patchIndex: number,
  cause: LiveStateErrorCause
): StrictPatchSequenceError {
  return new StrictPatchSequenceError(
    `${PATCH_SEQUENCE_FAILURE_MESSAGE_PREFIX} ${String(patchIndex)}: ${toErrorMessage(cause)}`,
    patchIndex,
    cause
  );
}

export function createPatchSequenceInvalidStateError(
  patchIndex: number,
  cause: LiveStateErrorCause
): StrictPatchSequenceError {
  return new StrictPatchSequenceError(
    `${PATCH_SEQUENCE_INVALID_STATE_MESSAGE_PREFIX} ${String(patchIndex)}: ${toErrorMessage(cause)}`,
    patchIndex,
    cause
  );
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
  public override readonly cause: LiveStateErrorCause | undefined;

  public constructor(
    message: string,
    details: ThreadStreamReductionErrorDetails,
    cause?: LiveStateErrorCause
  ) {
    super(message);
    this.name = THREAD_STREAM_REDUCTION_ERROR_NAME;
    this.details = details;
    this.cause = cause;
  }
}

export function createThreadStreamReductionError(
  threadId: string,
  eventIndex: number,
  patchIndex: number,
  event: ThreadStreamStateChangedBroadcast,
  patch: ThreadStreamPatch,
  cause: LiveStateErrorCause
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

export function toErrorMessage(error: LiveStateErrorCause): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

export function normalizeErrorCause<ErrorType>(error: ErrorType): LiveStateErrorCause {
  if (error instanceof Error || typeof error === "string") {
    return error;
  }

  const structuredError = JsonValueSchema.safeParse(error);
  return structuredError.success ? structuredError.data : String(error);
}
