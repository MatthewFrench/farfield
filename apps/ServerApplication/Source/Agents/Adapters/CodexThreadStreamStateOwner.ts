import path from "node:path";
import {
  type IpcFrame,
  type JsonValue,
  parseThreadStreamStateChangedBroadcast,
  type TurnStartParams,
} from "@farfield/protocol";
import { resolveOwnerClientId } from "../../Modules/Threads/ThreadOwner.js";
import type {
  AgentReadStreamEventsInput,
  AgentThreadLiveState,
  AgentThreadStreamEvents,
} from "../Types.js";
import { CodexInvalidThreadStreamEventLogOwner } from "./CodexInvalidThreadStreamEventLogOwner.js";
import { normalizeNullableIdentifier } from "./CodexThreadIdentifierNormalization.js";
import { CodexThreadLiveStateProjectionOwner } from "./CodexThreadLiveStateProjectionOwner.js";
import {
  CodexThreadStreamEventHistoryOwner,
  DEFAULT_STREAM_EVENT_LIMIT,
} from "./CodexThreadStreamEventHistoryOwner.js";
import {
  type CodexIpcFrameDescription,
  describeCodexIpcFrame,
  isThreadStreamStateChangedFrame,
} from "./CodexThreadStreamFrameDescriptionContracts.js";

export type { CodexIpcFrameDescription } from "./CodexThreadStreamFrameDescriptionContracts.js";

export interface CodexThreadStreamStateOwnerOptions {
  invalidStreamEventsLogPath?: string;
  streamEventLimit?: number;
}

const DEFAULT_INVALID_STREAM_EVENT_LOG_PATH = path.resolve(
  process.cwd(),
  ".runtime",
  "logs",
  "threads",
  "invalid-thread-stream-events.ndjson",
);

export class CodexThreadStreamStateOwner {
  private readonly threadOwnerById = new Map<string, string>();
  private readonly streamEventHistoryOwner: CodexThreadStreamEventHistoryOwner;
  private readonly liveStateProjectionOwner = new CodexThreadLiveStateProjectionOwner();
  private readonly invalidThreadStreamEventLogOwner: CodexInvalidThreadStreamEventLogOwner;

  /**
   * Owns thread stream ingress orchestration and delegates history/projection/logging
   * concerns to dedicated owner modules with explicit contracts.
   */
  public constructor(options: CodexThreadStreamStateOwnerOptions = {}) {
    this.streamEventHistoryOwner = new CodexThreadStreamEventHistoryOwner(
      options.streamEventLimit ?? DEFAULT_STREAM_EVENT_LIMIT,
    );
    this.invalidThreadStreamEventLogOwner = new CodexInvalidThreadStreamEventLogOwner(
      options.invalidStreamEventsLogPath ?? DEFAULT_INVALID_STREAM_EVENT_LOG_PATH,
    );
  }

  public describeFrame(frame: IpcFrame): CodexIpcFrameDescription {
    return describeCodexIpcFrame(frame);
  }

  public ingestInboundFrame(frame: IpcFrame): void {
    if (!isThreadStreamStateChangedFrame(frame)) {
      return;
    }

    try {
      const streamStateChangedBroadcast = parseThreadStreamStateChangedBroadcast(
        frame as JsonValue,
      );
      const threadId = streamStateChangedBroadcast.params.conversationId;
      this.threadOwnerById.set(threadId, streamStateChangedBroadcast.sourceClientId);
      const eventSequence = this.streamEventHistoryOwner.appendStreamEvent(threadId, frame);
      this.liveStateProjectionOwner.projectEvent(
        streamStateChangedBroadcast,
        eventSequence,
        this.threadOwnerById,
      );
    } catch (error) {
      this.invalidThreadStreamEventLogOwner.recordInvalidThreadStreamEvent(frame, error);
    }
  }

  public getThreadOwnerCount(): number {
    return this.threadOwnerById.size;
  }

  public clearThreadOwner(threadId: string): void {
    this.threadOwnerById.delete(threadId);
  }

  public resolveKnownOwnerClientId(
    threadId: string,
    overrideOwnerClientId: string | null | undefined,
  ): string | null {
    const normalizedMappedOwnerClientId = normalizeNullableIdentifier(
      this.threadOwnerById.get(threadId),
    );
    if (normalizedMappedOwnerClientId !== null) {
      return normalizedMappedOwnerClientId;
    }

    return normalizeNullableIdentifier(overrideOwnerClientId);
  }

  public resolveRequiredOwnerClientId(
    threadId: string,
    overrideOwnerClientId: string | null | undefined,
  ): string {
    return resolveOwnerClientId(this.threadOwnerById, threadId, overrideOwnerClientId ?? undefined);
  }

  public getProjectedConversationState(
    threadId: string,
  ): AgentThreadLiveState["conversationState"] | null {
    return this.liveStateProjectionOwner.readProjectedConversationState(threadId);
  }

  public readProjectedHasUnreadTurnSignal(threadId: string): boolean | null {
    const projectedConversationState = this.getProjectedConversationState(threadId);
    if (projectedConversationState === null) {
      return null;
    }

    return projectedConversationState.hasUnreadTurn ?? null;
  }

  public readLiveState(threadId: string): AgentThreadLiveState {
    return this.liveStateProjectionOwner.readLiveState(threadId, this.readOwnerClientId(threadId));
  }

  public readStreamEvents(
    threadId: string,
    input: AgentReadStreamEventsInput,
  ): AgentThreadStreamEvents {
    return this.streamEventHistoryOwner.readStreamEvents(
      threadId,
      this.readOwnerClientId(threadId),
      input,
    );
  }

  public stageOptimisticTurnStart(input: {
    threadId: string;
    ownerClientId: string | null;
    turnStartParams: TurnStartParams;
    nowMilliseconds: number;
    isSteering: boolean;
  }): void {
    if (input.ownerClientId !== null) {
      this.threadOwnerById.set(input.threadId, input.ownerClientId);
    }
    this.liveStateProjectionOwner.stageOptimisticTurnStart(input);
  }

  private readOwnerClientId(threadId: string): string | null {
    return this.threadOwnerById.get(threadId) ?? null;
  }
}
