import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { applyTrustedPatchSequence, StrictPatchSequenceError } from "@farfield/api";
import {
  JsonValueSchema,
  parseThreadStreamStateChangedBroadcast,
  ProtocolValidationError,
  type JsonValue,
  type IpcFrame,
  type ThreadStreamStateChangedBroadcast
} from "@farfield/protocol";
import { logger } from "../../Shared/Logging/Logger.js";
import { resolveOwnerClientId } from "../../Modules/Threads/ThreadOwner.js";
import type {
  AgentReadStreamEventsInput,
  AgentThreadLiveState,
  AgentThreadStreamEvents
} from "../Types.js";
import { THREAD_STREAM_STATE_CHANGED_METHOD } from "../ThreadStreamStateChangedContract.js";

interface ThreadLiveStateProjection {
  ownerClientId: string | null;
  conversationState: AgentThreadLiveState["conversationState"];
  liveStateError: AgentThreadLiveState["liveStateError"];
}

interface InvalidThreadStreamEventDetail {
  threadId: string | null;
  error: string;
  issues?: string[];
  rawPayload: IpcFrame;
  loggedAt: string;
}

interface ThreadStreamEventEntry {
  sequence: number;
  frame: IpcFrame;
}

interface ThreadStreamSequenceWindow {
  nextSequence: number;
  firstAvailableSequence: number;
}

interface ThreadStreamReductionFailureLocalization {
  message: string;
  eventIndex: number;
  patchIndex: number | null;
}

export interface CodexIpcFrameDescription {
  method: string;
  threadId: string | null;
}

export interface CodexThreadStreamStateOwnerOptions {
  invalidStreamEventsLogPath?: string;
  streamEventLimit?: number;
}

const DEFAULT_STREAM_EVENT_LIMIT = 400;
const MINIMUM_STREAM_EVENT_LIMIT = 1;
const INITIAL_STREAM_EVENT_SEQUENCE = 0;
const RESET_CURSOR_SEQUENCE_OFFSET = 1;
const RESPONSE_METHOD_DESCRIPTION = "response";
const INVALID_THREAD_STREAM_EVENT_DETAIL_LOG_NAME = "codex-invalid-thread-stream-event-detail";
const THREAD_STREAM_REDUCTION_FAILED_LOG_NAME = "codex-thread-stream-reduction-failed";
const INVALID_THREAD_STREAM_EVENT_DETAIL_WRITE_FAILED_LOG_NAME =
  "codex-invalid-thread-stream-event-detail-write-failed";
const INVALID_THREAD_STREAM_EVENT_DIRECTORY_CREATE_FAILED_LOG_NAME =
  "codex-invalid-thread-stream-event-detail-directory-create-failed";
const STREAM_EVENT_LIMIT_ERROR_MESSAGE =
  "CodexThreadStreamStateOwner streamEventLimit must be a positive integer.";
const THREAD_IDENTIFIER_CANDIDATES_SCHEMA = z
  .object({
    conversationId: z.string().optional(),
    threadId: z.string().optional(),
    turnId: z.string().optional()
  })
  .passthrough();
type ThreadIdentifierCandidates = z.infer<typeof THREAD_IDENTIFIER_CANDIDATES_SCHEMA>;
const DEFAULT_INVALID_STREAM_EVENT_LOG_PATH = path.resolve(
  process.cwd(),
  ".runtime",
  "logs",
  "threads",
  "invalid-thread-stream-events.ndjson"
);

export class CodexThreadStreamStateOwner {
  private readonly invalidStreamEventsLogPath: string;
  private readonly streamEventLimit: number;
  private readonly threadOwnerById = new Map<string, string>();
  private readonly streamEventEntriesByThreadId = new Map<string, ThreadStreamEventEntry[]>();
  private readonly liveStateProjectionByThreadId = new Map<string, ThreadLiveStateProjection>();

  /**
   * Owns per-thread stream event retention and live-state projection.
   * Stream sequence values are monotonic and reused as deterministic reduction
   * failure localization metadata (`eventIndex`) for client resynchronization.
   */
  public constructor(options: CodexThreadStreamStateOwnerOptions = {}) {
    // Invalid event logs are intentionally routed through one owner path so malformed
    // stream payloads can be audited without coupling to transport pipeline internals.
    this.invalidStreamEventsLogPath = options.invalidStreamEventsLogPath
      ?? DEFAULT_INVALID_STREAM_EVENT_LOG_PATH;
    this.streamEventLimit = options.streamEventLimit ?? DEFAULT_STREAM_EVENT_LIMIT;
    if (!Number.isInteger(this.streamEventLimit) || this.streamEventLimit < MINIMUM_STREAM_EVENT_LIMIT) {
      throw new Error(STREAM_EVENT_LIMIT_ERROR_MESSAGE);
    }
    this.ensureInvalidStreamEventLogDirectoryExists();
  }

  public describeFrame(frame: IpcFrame): CodexIpcFrameDescription {
    return {
      method: this.readFrameMethod(frame),
      threadId: this.extractThreadId(frame)
    };
  }

  public ingestInboundFrame(frame: IpcFrame): void {
    if (!this.isThreadStreamStateChangedFrame(frame)) {
      return;
    }

    let streamStateChangedBroadcast: ThreadStreamStateChangedBroadcast;
    try {
      streamStateChangedBroadcast = parseThreadStreamStateChangedBroadcast(
        frame as JsonValue
      );
    } catch (error) {
      const invalidEventDetail = this.createInvalidStreamEventDetail(frame, error);
      logger.warn(invalidEventDetail, INVALID_THREAD_STREAM_EVENT_DETAIL_LOG_NAME);
      this.writeInvalidStreamEventDetail(invalidEventDetail);
      return;
    }

    const conversationId = streamStateChangedBroadcast.params.conversationId;
    this.threadOwnerById.set(conversationId, streamStateChangedBroadcast.sourceClientId);
    const eventSequence = this.appendStreamEvent(conversationId, frame);
    this.projectThreadLiveState(streamStateChangedBroadcast, eventSequence);
  }

  public getThreadOwnerCount(): number {
    return this.threadOwnerById.size;
  }

  public clearThreadOwner(threadId: string): void {
    this.threadOwnerById.delete(threadId);
  }

  public resolveKnownOwnerClientId(
    threadId: string,
    overrideOwnerClientId: string | null | undefined
  ): string | null {
    const normalizedMappedOwnerClientId = normalizeNullableIdentifier(this.threadOwnerById.get(threadId));
    if (normalizedMappedOwnerClientId !== null) {
      return normalizedMappedOwnerClientId;
    }

    return normalizeNullableIdentifier(overrideOwnerClientId);
  }

  public resolveRequiredOwnerClientId(
    threadId: string,
    overrideOwnerClientId: string | null | undefined
  ): string {
    return resolveOwnerClientId(
      this.threadOwnerById,
      threadId,
      overrideOwnerClientId ?? undefined
    );
  }

  public getProjectedConversationState(
    threadId: string
  ): AgentThreadLiveState["conversationState"] | null {
    return this.liveStateProjectionByThreadId.get(threadId)?.conversationState ?? null;
  }

  public readLiveState(threadId: string): AgentThreadLiveState {
    const projectedState = this.liveStateProjectionByThreadId.get(threadId);
    if (!projectedState) {
      return {
        ownerClientId: this.readOwnerClientId(threadId),
        conversationState: null,
        liveStateError: null
      };
    }

    return {
      ownerClientId: projectedState.ownerClientId ?? this.readOwnerClientId(threadId),
      conversationState: projectedState.conversationState,
      liveStateError: projectedState.liveStateError
    };
  }

  public readStreamEvents(threadId: string, input: AgentReadStreamEventsInput): AgentThreadStreamEvents {
    const threadStreamEntries = this.streamEventEntriesByThreadId.get(threadId) ?? [];
    const sequenceWindow = this.readThreadStreamSequenceWindow(threadStreamEntries);
    const resetRequired = this.isResetRequired(input.sinceSequence, sequenceWindow.firstAvailableSequence);
    const selectedEntries = this.selectStreamEntriesForRead(threadStreamEntries, input, resetRequired);
    return this.createStreamEventsSliceResponse(
      threadId,
      selectedEntries,
      sequenceWindow,
      resetRequired
    );
  }

  private appendStreamEvent(conversationId: string, frame: IpcFrame): number {
    const currentEntries = this.streamEventEntriesByThreadId.get(conversationId) ?? [];
    const sequence = this.readNextSequence(currentEntries);
    currentEntries.push({
      sequence,
      frame
    });
    if (currentEntries.length > this.streamEventLimit) {
      currentEntries.splice(0, currentEntries.length - this.streamEventLimit);
    }
    this.streamEventEntriesByThreadId.set(conversationId, currentEntries);
    return sequence;
  }

  private readNextSequence(entries: ThreadStreamEventEntry[]): number {
    const lastEntry = entries[entries.length - 1];
    return lastEntry ? lastEntry.sequence + 1 : INITIAL_STREAM_EVENT_SEQUENCE;
  }

  private readThreadStreamSequenceWindow(entries: ThreadStreamEventEntry[]): ThreadStreamSequenceWindow {
    const nextSequence = this.readNextSequence(entries);
    const firstAvailableSequence = entries.length > 0 ? entries[0]!.sequence : nextSequence;
    return {
      nextSequence,
      firstAvailableSequence
    };
  }

  private isResetRequired(sinceSequence: number | null, firstAvailableSequence: number): boolean {
    // Cursor values represent the last seen event sequence, so subtract one to compare against retained floor.
    return sinceSequence !== null
      && sinceSequence < firstAvailableSequence - RESET_CURSOR_SEQUENCE_OFFSET;
  }

  private selectStreamEntriesForRead(
    entries: ThreadStreamEventEntry[],
    input: AgentReadStreamEventsInput,
    resetRequired: boolean
  ): ThreadStreamEventEntry[] {
    const { sinceSequence, limit } = input;
    if (resetRequired || sinceSequence === null) {
      return entries.slice(-limit);
    }

    return entries.filter((entry) => entry.sequence > sinceSequence);
  }

  private createStreamEventsSliceResponse(
    threadId: string,
    selectedEntries: ThreadStreamEventEntry[],
    sequenceWindow: ThreadStreamSequenceWindow,
    resetRequired: boolean
  ): AgentThreadStreamEvents {
    return {
      ownerClientId: this.readOwnerClientId(threadId),
      events: selectedEntries.map((entry) => entry.frame),
      nextSequence: sequenceWindow.nextSequence,
      firstAvailableSequence: sequenceWindow.firstAvailableSequence,
      resetRequired
    };
  }

  private readOwnerClientId(threadId: string): string | null {
    return this.threadOwnerById.get(threadId) ?? null;
  }

  private projectThreadLiveState(
    event: ThreadStreamStateChangedBroadcast,
    eventIndex: number
  ): void {
    const threadId = event.params.conversationId;
    const previousProjection = this.liveStateProjectionByThreadId.get(threadId) ?? {
      ownerClientId: this.threadOwnerById.get(threadId) ?? null,
      conversationState: null,
      liveStateError: null
    };

    const change = event.params.change;
    if (change.type === "snapshot") {
      this.liveStateProjectionByThreadId.set(threadId, {
        ownerClientId: event.sourceClientId,
        conversationState: change.conversationState,
        liveStateError: null
      });
      return;
    }

    if (!previousProjection.conversationState) {
      this.liveStateProjectionByThreadId.set(threadId, {
        ownerClientId: event.sourceClientId,
        conversationState: null,
        liveStateError: null
      });
      return;
    }

    let updatedConversationState = previousProjection.conversationState;
    try {
      updatedConversationState = applyTrustedPatchSequence(updatedConversationState, change.patches);
    } catch (error) {
      const reductionFailureLocalization = this.createReductionFailureLocalization(error, eventIndex);
      logger.error(
        {
          threadId,
          error: reductionFailureLocalization.message,
          eventIndex: reductionFailureLocalization.eventIndex,
          patchIndex: reductionFailureLocalization.patchIndex
        },
        THREAD_STREAM_REDUCTION_FAILED_LOG_NAME
      );
      this.liveStateProjectionByThreadId.set(threadId, {
        ownerClientId: event.sourceClientId,
        conversationState: null,
        liveStateError: {
          kind: "reductionFailed",
          message: reductionFailureLocalization.message,
          eventIndex: reductionFailureLocalization.eventIndex,
          patchIndex: reductionFailureLocalization.patchIndex
        }
      });
      return;
    }

    this.liveStateProjectionByThreadId.set(threadId, {
      ownerClientId: event.sourceClientId,
      conversationState: updatedConversationState,
      liveStateError: null
    });
  }

  private writeInvalidStreamEventDetail(detail: InvalidThreadStreamEventDetail): void {
    try {
      const parsedDetail = JsonValueSchema.parse(detail);
      fs.appendFileSync(
        this.invalidStreamEventsLogPath,
        JSON.stringify(parsedDetail) + "\n",
        { encoding: "utf8" }
      );
    } catch (error) {
      logger.warn(
        {
          path: this.invalidStreamEventsLogPath,
          error: toErrorMessage(error)
        },
        INVALID_THREAD_STREAM_EVENT_DETAIL_WRITE_FAILED_LOG_NAME
      );
    }
  }

  private ensureInvalidStreamEventLogDirectoryExists(): void {
    try {
      fs.mkdirSync(path.dirname(this.invalidStreamEventsLogPath), {
        recursive: true
      });
    } catch (error) {
      logger.warn(
        {
          path: this.invalidStreamEventsLogPath,
          error: toErrorMessage(error)
        },
        INVALID_THREAD_STREAM_EVENT_DIRECTORY_CREATE_FAILED_LOG_NAME
      );
    }
  }

  private extractThreadId(frame: IpcFrame): string | null {
    if (this.isThreadStreamStateChangedFrame(frame)) {
      const parsedBroadcastParams = this.parseThreadIdentifierCandidates(frame.params);
      if (parsedBroadcastParams === null) {
        return null;
      }
      return normalizeNullableIdentifier(parsedBroadcastParams.conversationId);
    }

    if (frame.type !== "request") {
      return null;
    }

    const parsedRequestParams = this.parseThreadIdentifierCandidates(frame.params);
    if (parsedRequestParams === null) {
      return null;
    }

    const candidates = [
      parsedRequestParams.conversationId,
      parsedRequestParams.threadId,
      parsedRequestParams.turnId
    ];

    for (const candidate of candidates) {
      const normalizedCandidate = normalizeNullableIdentifier(candidate);
      if (normalizedCandidate !== null) {
        return normalizedCandidate;
      }
    }

    return null;
  }

  private readFrameMethod(frame: IpcFrame): string {
    if (frame.type === "request" || frame.type === "broadcast") {
      return frame.method;
    }
    if (frame.type === "response") {
      return frame.method ?? RESPONSE_METHOD_DESCRIPTION;
    }
    return frame.type;
  }

  private isThreadStreamStateChangedFrame(frame: IpcFrame): boolean {
    return frame.type === "broadcast" && frame.method === THREAD_STREAM_STATE_CHANGED_METHOD;
  }

  private parseThreadIdentifierCandidates(
    frameParams: IpcFrame["params"]
  ): ThreadIdentifierCandidates | null {
    const parsedCandidates = THREAD_IDENTIFIER_CANDIDATES_SCHEMA.safeParse(frameParams);
    if (!parsedCandidates.success) {
      return null;
    }
    return parsedCandidates.data;
  }

  private createInvalidStreamEventDetail<ErrorType>(
    frame: IpcFrame,
    error: ErrorType
  ): InvalidThreadStreamEventDetail {
    return {
      threadId: this.extractThreadId(frame),
      error: toErrorMessage(error),
      ...(error instanceof ProtocolValidationError ? { issues: error.issues } : {}),
      rawPayload: frame,
      loggedAt: new Date().toISOString()
    };
  }

  private createReductionFailureLocalization<ErrorType>(
    error: ErrorType,
    eventIndex: number
  ): ThreadStreamReductionFailureLocalization {
    return {
      message: toErrorMessage(error),
      eventIndex,
      patchIndex: readPatchIndex(error)
    };
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

function readPatchIndex<ErrorType>(error: ErrorType): number | null {
  if (!(error instanceof StrictPatchSequenceError)) {
    return null;
  }

  return Number.isInteger(error.patchIndex) && error.patchIndex >= 0
    ? error.patchIndex
    : null;
}

function normalizeNullableIdentifier(identifier: string | null | undefined): string | null {
  if (!identifier) {
    return null;
  }

  const trimmedIdentifier = identifier.trim();
  return trimmedIdentifier.length > 0 ? trimmedIdentifier : null;
}
