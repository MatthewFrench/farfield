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
import { logger } from "../../Logger.js";
import { resolveOwnerClientId } from "../../ThreadOwner.js";
import type { AgentThreadLiveState, AgentThreadStreamEvents } from "../Types.js";

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

export class CodexThreadStreamStateOwner {
  private readonly invalidStreamEventsLogPath: string;
  private readonly threadOwnerById = new Map<string, string>();
  private readonly streamEventsByThreadId = new Map<string, IpcFrame[]>();
  private readonly liveStateProjectionByThreadId = new Map<string, ThreadLiveStateProjection>();

  public constructor(options: CodexThreadStreamStateOwnerOptions = {}) {
    this.invalidStreamEventsLogPath = options.invalidStreamEventsLogPath ??
      process.env["FARFIELD_INVALID_STREAM_LOG_PATH"] ??
      path.resolve(process.cwd(), "invalid-thread-stream-events.jsonl");
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

  public readStreamEvents(threadId: string, limit: number): AgentThreadStreamEvents {
    return {
      ownerClientId: this.threadOwnerById.get(threadId) ?? null,
      events: (this.streamEventsByThreadId.get(threadId) ?? []).slice(-limit)
    };
  }

  private appendStreamEvent(conversationId: string, frame: IpcFrame): void {
    const currentEvents = this.streamEventsByThreadId.get(conversationId) ?? [];
    currentEvents.push(frame);
    if (currentEvents.length > STREAM_EVENT_LIMIT) {
      currentEvents.splice(0, currentEvents.length - STREAM_EVENT_LIMIT);
    }
    this.streamEventsByThreadId.set(conversationId, currentEvents);
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
