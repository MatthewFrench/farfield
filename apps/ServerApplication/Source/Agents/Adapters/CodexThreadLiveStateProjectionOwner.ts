import { applyTrustedPatchSequence, StrictPatchSequenceError } from "@farfield/api";
import type {
  ThreadConversationState,
  ThreadStreamPatch,
  ThreadStreamStateChangedBroadcast,
  TurnStartParams,
} from "@farfield/protocol";
import { logger } from "../../Shared/Logging/Logger.js";
import { type AgentThreadLiveState, AgentThreadLiveStateErrorKindByName } from "../Types.js";

interface ThreadLiveStateProjection {
  ownerClientId: string | null;
  conversationState: AgentThreadLiveState["conversationState"];
  liveStateError: AgentThreadLiveState["liveStateError"];
}

interface ThreadStreamReductionFailureLocalization {
  message: string;
  eventIndex: number;
  patchIndex: number | null;
}

interface ThreadPatchReductionInput {
  threadId: string;
  ownerClientId: string;
  patches: ThreadStreamPatch[];
  eventIndex: number;
}

const THREAD_STREAM_CHANGE_TYPE_SNAPSHOT = "snapshot";
const THREAD_STREAM_REDUCTION_FAILED_LOG_NAME = "codex-thread-stream-reduction-failed";
const TURN_IN_PROGRESS_STATUS = "inProgress";
const SYNTHETIC_TURN_IDENTIFIER_PREFIX = "optimistic-turn";

interface OptimisticTurnStartInput {
  threadId: string;
  ownerClientId: string | null;
  turnStartParams: TurnStartParams;
  nowMilliseconds: number;
  isSteering: boolean;
}

/**
 * Owns projected live-state reduction for thread stream snapshots and patches.
 * Patch failures are localized with deterministic event/patch indexes so clients
 * can reset and resynchronize without ambiguous error reporting.
 */
export class CodexThreadLiveStateProjectionOwner {
  private readonly liveStateProjectionByThreadId = new Map<string, ThreadLiveStateProjection>();
  private optimisticTurnSequence = 0;

  public projectEvent(
    event: ThreadStreamStateChangedBroadcast,
    eventIndex: number,
    ownerClientIdByThreadId: ReadonlyMap<string, string>,
  ): void {
    const threadId = event.params.conversationId;
    const change = event.params.change;
    if (change.type === THREAD_STREAM_CHANGE_TYPE_SNAPSHOT) {
      this.liveStateProjectionByThreadId.set(
        threadId,
        this.createThreadLiveStateProjection(event.sourceClientId, change.conversationState, null),
      );
      return;
    }

    const reducedProjection = this.projectPatchChange(
      {
        threadId,
        ownerClientId: event.sourceClientId,
        patches: change.patches,
        eventIndex,
      },
      ownerClientIdByThreadId,
    );
    this.liveStateProjectionByThreadId.set(threadId, reducedProjection);
  }

  public readProjectedConversationState(
    threadId: string,
  ): AgentThreadLiveState["conversationState"] | null {
    return this.liveStateProjectionByThreadId.get(threadId)?.conversationState ?? null;
  }

  public readLiveState(threadId: string, ownerClientId: string | null): AgentThreadLiveState {
    const projectedState = this.liveStateProjectionByThreadId.get(threadId);
    if (!projectedState) {
      return {
        ownerClientId,
        conversationState: null,
        liveStateError: null,
      };
    }

    return {
      ownerClientId: projectedState.ownerClientId ?? ownerClientId,
      conversationState: projectedState.conversationState,
      liveStateError: projectedState.liveStateError,
    };
  }

  public stageOptimisticTurnStart(input: OptimisticTurnStartInput): void {
    if (input.isSteering) {
      return;
    }

    const previousProjection = this.liveStateProjectionByThreadId.get(input.threadId);
    if (previousProjection?.conversationState === null || previousProjection === undefined) {
      return;
    }

    const previousConversationState = previousProjection.conversationState;
    const lastTurn = previousConversationState.turns[previousConversationState.turns.length - 1];
    if (lastTurn && isTurnInProgressStatus(lastTurn.status)) {
      return;
    }

    const nextConversationState = createOptimisticConversationState({
      previousConversationState,
      turnStartParams: input.turnStartParams,
      nowMilliseconds: input.nowMilliseconds,
      optimisticTurnIdentifier: this.readNextOptimisticTurnIdentifier(),
    });
    this.liveStateProjectionByThreadId.set(
      input.threadId,
      this.createThreadLiveStateProjection(
        input.ownerClientId ?? previousProjection.ownerClientId,
        nextConversationState,
        null,
      ),
    );
  }

  private projectPatchChange(
    input: ThreadPatchReductionInput,
    ownerClientIdByThreadId: ReadonlyMap<string, string>,
  ): ThreadLiveStateProjection {
    const previousProjection = this.readPreviousThreadLiveStateProjection(
      input.threadId,
      ownerClientIdByThreadId,
    );

    // Patch events are relative deltas; without a snapshot baseline there is no valid state to reduce.
    if (previousProjection.conversationState === null) {
      return this.createThreadLiveStateProjection(input.ownerClientId, null, null);
    }

    try {
      const updatedConversationState = applyTrustedPatchSequence(
        previousProjection.conversationState,
        input.patches,
      );
      return this.createThreadLiveStateProjection(
        input.ownerClientId,
        updatedConversationState,
        null,
      );
    } catch (error) {
      const reductionFailureLocalization = this.createReductionFailureLocalization(
        error,
        input.eventIndex,
      );
      this.logReductionFailure(input.threadId, reductionFailureLocalization);
      return this.createThreadLiveStateProjection(
        input.ownerClientId,
        null,
        this.createReductionFailedLiveStateError(reductionFailureLocalization),
      );
    }
  }

  private readPreviousThreadLiveStateProjection(
    threadId: string,
    ownerClientIdByThreadId: ReadonlyMap<string, string>,
  ): ThreadLiveStateProjection {
    const previousProjection = this.liveStateProjectionByThreadId.get(threadId);
    if (previousProjection) {
      return previousProjection;
    }

    return this.createThreadLiveStateProjection(
      ownerClientIdByThreadId.get(threadId) ?? null,
      null,
      null,
    );
  }

  private createThreadLiveStateProjection(
    ownerClientId: string | null,
    conversationState: AgentThreadLiveState["conversationState"],
    liveStateError: AgentThreadLiveState["liveStateError"],
  ): ThreadLiveStateProjection {
    return {
      ownerClientId,
      conversationState,
      liveStateError,
    };
  }

  private logReductionFailure(
    threadId: string,
    reductionFailureLocalization: ThreadStreamReductionFailureLocalization,
  ): void {
    logger.error(
      {
        threadId,
        error: reductionFailureLocalization.message,
        eventIndex: reductionFailureLocalization.eventIndex,
        patchIndex: reductionFailureLocalization.patchIndex,
      },
      THREAD_STREAM_REDUCTION_FAILED_LOG_NAME,
    );
  }

  private createReductionFailureLocalization<ErrorType>(
    error: ErrorType,
    eventIndex: number,
  ): ThreadStreamReductionFailureLocalization {
    return {
      message: toErrorMessage(error),
      eventIndex,
      patchIndex: readPatchIndex(error),
    };
  }

  private createReductionFailedLiveStateError(
    reductionFailureLocalization: ThreadStreamReductionFailureLocalization,
  ): AgentThreadLiveState["liveStateError"] {
    return {
      kind: AgentThreadLiveStateErrorKindByName.reductionFailed,
      message: reductionFailureLocalization.message,
      eventIndex: reductionFailureLocalization.eventIndex,
      patchIndex: reductionFailureLocalization.patchIndex,
    };
  }

  private readNextOptimisticTurnIdentifier(): string {
    this.optimisticTurnSequence += 1;
    return `${SYNTHETIC_TURN_IDENTIFIER_PREFIX}-${String(this.optimisticTurnSequence)}`;
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

  return Number.isInteger(error.patchIndex) && error.patchIndex >= 0 ? error.patchIndex : null;
}

function isTurnInProgressStatus(status: string): boolean {
  return status === TURN_IN_PROGRESS_STATUS;
}

function createOptimisticConversationState(input: {
  previousConversationState: ThreadConversationState;
  turnStartParams: TurnStartParams;
  nowMilliseconds: number;
  optimisticTurnIdentifier: string;
}): ThreadConversationState {
  const { previousConversationState, turnStartParams, nowMilliseconds, optimisticTurnIdentifier } =
    input;
  return {
    ...previousConversationState,
    turns: [
      ...previousConversationState.turns,
      {
        params: turnStartParams,
        turnId: optimisticTurnIdentifier,
        status: TURN_IN_PROGRESS_STATUS,
        turnStartedAtMs: nowMilliseconds,
        items: [],
      },
    ],
    updatedAt: nowMilliseconds,
    latestModel: turnStartParams.model ?? previousConversationState.latestModel,
    latestReasoningEffort:
      turnStartParams.effort ?? previousConversationState.latestReasoningEffort,
    latestCollaborationMode:
      turnStartParams.collaborationMode ?? previousConversationState.latestCollaborationMode,
    hasUnreadTurn: false,
  };
}
