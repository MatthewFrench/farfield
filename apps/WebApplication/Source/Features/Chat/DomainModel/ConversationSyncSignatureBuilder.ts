import type { ThreadConversationState } from "@farfield/protocol";
import type {
  ModeSelectionConversationState,
  ModeSelectionStateResolver,
} from "./ModeSelectionStateResolver";

// Signature ordering and sentinels are part of the stale-state detection contract.
const SIGNATURE_SEGMENT_DELIMITER = "|";
const EMPTY_SIGNATURE = "";
const EMPTY_SIGNATURE_SEGMENT = "";
const NO_TURNS_PROGRESS_SIGNATURE = "no-turns";
const MISSING_CONVERSATION_UPDATED_AT_SENTINEL = Number.NEGATIVE_INFINITY;
const MISSING_LIVE_CONVERSATION_TURN_COUNT_SENTINEL = -1;

export type ConversationStateLike = ModeSelectionConversationState &
  Pick<ThreadConversationState, "id" | "updatedAt" | "turns">;

export interface LiveStateLike {
  threadId: string;
  ownerClientId: string | null;
  conversationState: ConversationStateLike | null;
}

export interface ReadThreadLike {
  thread: ConversationStateLike;
}

export class ConversationSyncSignatureBuilder {
  private readonly modeSelectionStateResolver: ModeSelectionStateResolver;

  public constructor(modeSelectionStateResolver: ModeSelectionStateResolver) {
    this.modeSelectionStateResolver = modeSelectionStateResolver;
  }

  public readConversationStateUpdatedAt(state: ConversationStateLike | null | undefined): number {
    if (state === null || state === undefined) {
      return MISSING_CONVERSATION_UPDATED_AT_SENTINEL;
    }
    return state.updatedAt ?? MISSING_CONVERSATION_UPDATED_AT_SENTINEL;
  }

  public buildLiveStateSyncSignature(
    state: LiveStateLike | null | undefined,
    appDefaultModel: string,
    appDefaultEffort: string,
  ): string {
    if (state === null || state === undefined) {
      return EMPTY_SIGNATURE;
    }

    const conversationState = state.conversationState;
    return this.joinSignatureSegments(
      this.readLiveStateSyncSignatureSegments(
        state,
        conversationState,
        appDefaultModel,
        appDefaultEffort,
      ),
    );
  }

  public buildReadThreadSyncSignature(
    state: ReadThreadLike | null | undefined,
    appDefaultModel: string,
    appDefaultEffort: string,
  ): string {
    if (state === null || state === undefined) {
      return EMPTY_SIGNATURE;
    }

    const conversationState = state.thread;
    return this.joinSignatureSegments(
      this.readReadThreadSyncSignatureSegments(
        conversationState,
        appDefaultModel,
        appDefaultEffort,
      ),
    );
  }

  private readConversationProgressSignature(
    state: ConversationStateLike | null | undefined,
  ): string {
    if (state === null || state === undefined) {
      return EMPTY_SIGNATURE;
    }

    const lastTurn = this.readLastTurn(state);
    if (lastTurn === null) {
      return NO_TURNS_PROGRESS_SIGNATURE;
    }

    const lastItem = this.readLastTurnItem(lastTurn.items);
    return this.joinSignatureSegments([
      this.formatSignatureNumberSegment(state.turns.length),
      this.readTurnIdentifierSignatureSegment(lastTurn.id, lastTurn.turnId),
      this.normalizeOptionalSignatureSegment(lastTurn.status),
      this.formatSignatureNumberSegment(lastTurn.items.length),
      this.normalizeOptionalSignatureSegment(lastItem?.id),
      this.normalizeOptionalSignatureSegment(lastItem?.type),
    ]);
  }

  private readLiveStateSyncSignatureSegments(
    state: LiveStateLike,
    conversationState: ConversationStateLike | null,
    appDefaultModel: string,
    appDefaultEffort: string,
  ): readonly string[] {
    return [
      state.threadId,
      this.normalizeOptionalSignatureSegment(state.ownerClientId),
      this.formatSignatureNumberSegment(this.readConversationStateUpdatedAt(conversationState)),
      this.formatSignatureNumberSegment(this.readLiveConversationTurnCount(conversationState)),
      this.modeSelectionStateResolver.readModeSelectionSignatureFromConversationState(
        conversationState,
        appDefaultModel,
        appDefaultEffort,
      ),
      this.readConversationProgressSignature(conversationState),
    ];
  }

  private readReadThreadSyncSignatureSegments(
    conversationState: ConversationStateLike,
    appDefaultModel: string,
    appDefaultEffort: string,
  ): readonly string[] {
    return [
      this.normalizeOptionalSignatureSegment(conversationState.id),
      this.formatSignatureNumberSegment(this.readConversationStateUpdatedAt(conversationState)),
      this.formatSignatureNumberSegment(conversationState.turns.length),
      this.modeSelectionStateResolver.readModeSelectionSignatureFromConversationState(
        conversationState,
        appDefaultModel,
        appDefaultEffort,
      ),
      this.readConversationProgressSignature(conversationState),
    ];
  }

  private readLastTurn(
    state: ConversationStateLike,
  ): ConversationStateLike["turns"][number] | null {
    if (state.turns.length === 0) {
      return null;
    }
    return state.turns[state.turns.length - 1] ?? null;
  }

  private readLastTurnItem(
    items: ConversationStateLike["turns"][number]["items"],
  ): ConversationStateLike["turns"][number]["items"][number] | undefined {
    if (items.length === 0) {
      return undefined;
    }
    return items[items.length - 1];
  }

  private readLiveConversationTurnCount(conversationState: ConversationStateLike | null): number {
    if (conversationState === null) {
      return MISSING_LIVE_CONVERSATION_TURN_COUNT_SENTINEL;
    }
    return conversationState.turns.length;
  }

  private readTurnIdentifierSignatureSegment(
    turnIdentifier: string | null | undefined,
    legacyTurnIdentifier: string | null | undefined,
  ): string {
    if (turnIdentifier !== null && turnIdentifier !== undefined) {
      return turnIdentifier;
    }
    return this.normalizeOptionalSignatureSegment(legacyTurnIdentifier);
  }

  private normalizeOptionalSignatureSegment(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return EMPTY_SIGNATURE_SEGMENT;
    }
    return value;
  }

  private formatSignatureNumberSegment(value: number): string {
    return String(value);
  }

  private joinSignatureSegments(segments: readonly string[]): string {
    return segments.join(SIGNATURE_SEGMENT_DELIMITER);
  }
}
