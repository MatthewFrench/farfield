import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { applyStrictPatch } from "@farfield/api";
import {
  JsonValueSchema,
  parseThreadStreamStateChangedBroadcast,
  ProtocolValidationError,
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

interface ThreadLiveStateProjection {
  ownerClientId: string | null;
  conversationState: AgentThreadLiveState["conversationState"];
  liveStateError: AgentThreadLiveState["liveStateError"];
}

interface InvalidThreadStreamEventDetail {
  error: string;
  issues?: string[];
  rawPayload: IpcFrame;
  loggedAt: string;
}

interface ThreadStreamEventEntry {
  sequence: number;
  frame: IpcFrame;
}

export interface CodexIpcFrameDescription {
  method: string;
  threadId: string | null;
}

export interface CodexThreadStreamStateOwnerOptions {
  invalidStreamEventsLogPath?: string;
}

const STREAM_EVENT_LIMIT = 400;
const THREAD_IDENTIFIER_CANDIDATES_SCHEMA = z
  .object({
    conversationId: z.string().optional(),
    threadId: z.string().optional(),
    turnId: z.string().optional()
  })
  .passthrough();
const DEFAULT_INVALID_STREAM_EVENT_LOG_PATH = path.resolve(
  process.cwd(),
  ".runtime",
  "logs",
  "threads",
  "invalid-thread-stream-events.ndjson"
);

export class CodexThreadStreamStateOwner {
  private readonly invalidStreamEventsLogPath: string;
  private readonly threadOwnerById = new Map<string, string>();
  private readonly streamEventEntriesByThreadId = new Map<string, ThreadStreamEventEntry[]>();
  private readonly liveStateProjectionByThreadId = new Map<string, ThreadLiveStateProjection>();

  public constructor(options: CodexThreadStreamStateOwnerOptions = {}) {
    // Invalid event logs are intentionally routed through one owner path so malformed
    // stream payloads can be audited without coupling to transport pipeline internals.
    this.invalidStreamEventsLogPath = options.invalidStreamEventsLogPath
      ?? DEFAULT_INVALID_STREAM_EVENT_LOG_PATH;
    this.ensureInvalidStreamEventLogDirectoryExists();
  }

  public describeFrame(frame: IpcFrame): CodexIpcFrameDescription {
    const method = frame.type === "request" || frame.type === "broadcast"
      ? frame.method
      : frame.type === "response"
        ? frame.method ?? "response"
        : frame.type;

    return {
      method,
      threadId: this.extractThreadId(frame)
    };
  }

  public ingestInboundFrame(frame: IpcFrame): void {
    if (frame.type !== "broadcast" || frame.method !== "thread-stream-state-changed") {
      return;
    }

    let streamStateChangedBroadcast: ThreadStreamStateChangedBroadcast;
    try {
      streamStateChangedBroadcast = parseThreadStreamStateChangedBroadcast(
        JsonValueSchema.parse(frame)
      );
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      logger.warn(
        {
          error: errorMessage,
          ...(error instanceof ProtocolValidationError ? { issues: error.issues } : {}),
          rawPayload: frame
        },
        "codex-invalid-thread-stream-event-detail"
      );
      this.writeInvalidStreamEventDetail({
        error: errorMessage,
        ...(error instanceof ProtocolValidationError ? { issues: error.issues } : {}),
        rawPayload: frame,
        loggedAt: new Date().toISOString()
      });
      return;
    }

    const conversationId = streamStateChangedBroadcast.params.conversationId;
    this.threadOwnerById.set(conversationId, streamStateChangedBroadcast.sourceClientId);
    this.appendStreamEvent(conversationId, frame);
    this.projectThreadLiveState(streamStateChangedBroadcast);
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
    const mappedOwnerClientId = this.threadOwnerById.get(threadId);
    if (mappedOwnerClientId && mappedOwnerClientId.trim()) {
      return mappedOwnerClientId.trim();
    }

    if (overrideOwnerClientId && overrideOwnerClientId.trim()) {
      return overrideOwnerClientId.trim();
    }

    return null;
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
        ownerClientId: this.threadOwnerById.get(threadId) ?? null,
        conversationState: null,
        liveStateError: null
      };
    }

    return {
      ownerClientId: projectedState.ownerClientId ?? this.threadOwnerById.get(threadId) ?? null,
      conversationState: projectedState.conversationState,
      liveStateError: projectedState.liveStateError
    };
  }

  public readStreamEvents(threadId: string, input: AgentReadStreamEventsInput): AgentThreadStreamEvents {
    const threadStreamEntries = this.streamEventEntriesByThreadId.get(threadId) ?? [];
    const nextSequence = this.readNextSequence(threadStreamEntries);
    const firstAvailableSequence = threadStreamEntries.length > 0
      ? threadStreamEntries[0]!.sequence
      : nextSequence;
    const { sinceSequence } = input;

    // If caller cursor is older than retained history, the client must reset from the returned slice.
    if (sinceSequence !== null && sinceSequence < firstAvailableSequence - 1) {
      return {
        ownerClientId: this.threadOwnerById.get(threadId) ?? null,
        events: threadStreamEntries.slice(-input.limit).map((entry) => entry.frame),
        nextSequence,
        firstAvailableSequence,
        resetRequired: true
      };
    }

    const selectedEntries = sinceSequence === null
      ? threadStreamEntries.slice(-input.limit)
      : threadStreamEntries.filter((entry) => entry.sequence > sinceSequence);

    return {
      ownerClientId: this.threadOwnerById.get(threadId) ?? null,
      events: selectedEntries.map((entry) => entry.frame),
      nextSequence,
      firstAvailableSequence,
      resetRequired: false
    };
  }

  private appendStreamEvent(conversationId: string, frame: IpcFrame): void {
    const currentEntries = this.streamEventEntriesByThreadId.get(conversationId) ?? [];
    const sequence = this.readNextSequence(currentEntries);
    currentEntries.push({
      sequence,
      frame
    });
    if (currentEntries.length > STREAM_EVENT_LIMIT) {
      currentEntries.splice(0, currentEntries.length - STREAM_EVENT_LIMIT);
    }
    this.streamEventEntriesByThreadId.set(conversationId, currentEntries);
  }

  private readNextSequence(entries: ThreadStreamEventEntry[]): number {
    const lastEntry = entries[entries.length - 1];
    return lastEntry ? lastEntry.sequence + 1 : 0;
  }

  private projectThreadLiveState(event: ThreadStreamStateChangedBroadcast): void {
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
    for (let patchIndex = 0; patchIndex < change.patches.length; patchIndex += 1) {
      const patch = change.patches[patchIndex];
      if (!patch) {
        continue;
      }

      try {
        updatedConversationState = applyStrictPatch(updatedConversationState, patch);
      } catch (error) {
        const errorMessage = toErrorMessage(error);
        logger.error(
          {
            threadId,
            error: errorMessage,
            patchIndex
          },
          "codex-thread-stream-reduction-failed"
        );
        this.liveStateProjectionByThreadId.set(threadId, {
          ownerClientId: event.sourceClientId,
          conversationState: null,
          liveStateError: {
            kind: "reductionFailed",
            message: errorMessage,
            eventIndex: null,
            patchIndex
          }
        });
        return;
      }
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
        "codex-invalid-thread-stream-event-detail-write-failed"
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
        "codex-invalid-thread-stream-event-detail-directory-create-failed"
      );
    }
  }

  private extractThreadId(frame: IpcFrame): string | null {
    if (frame.type === "broadcast" && frame.method === "thread-stream-state-changed") {
      const parsedBroadcastParams = THREAD_IDENTIFIER_CANDIDATES_SCHEMA.safeParse(frame.params);
      if (!parsedBroadcastParams.success || !parsedBroadcastParams.data.conversationId) {
        return null;
      }
      return parsedBroadcastParams.data.conversationId.trim() || null;
    }

    if (frame.type !== "request") {
      return null;
    }

    const parsedRequestParams = THREAD_IDENTIFIER_CANDIDATES_SCHEMA.safeParse(frame.params);
    if (!parsedRequestParams.success) {
      return null;
    }

    const requestParams = parsedRequestParams.data;
    const candidates = [
      requestParams.conversationId,
      requestParams.threadId,
      requestParams.turnId
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }

    return null;
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
