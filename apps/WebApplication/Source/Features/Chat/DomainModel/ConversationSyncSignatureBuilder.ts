import type { ThreadConversationState } from "@farfield/protocol";
import type { ModeSelectionConversationState } from "./ModeSelectionStateResolver";
import type { ModeSelectionStateResolver } from "./ModeSelectionStateResolver";

export type ConversationStateLike = ModeSelectionConversationState & Pick<
  ThreadConversationState,
  "id" | "updatedAt" | "turns"
>;

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

  public readConversationStateUpdatedAt(
    state: ConversationStateLike | null | undefined
  ): number {
    return state?.updatedAt ?? Number.NEGATIVE_INFINITY;
  }

  public buildLiveStateSyncSignature(
    state: LiveStateLike | null | undefined,
    appDefaultModel: string,
    appDefaultEffort: string
  ): string {
    if (!state) {
      return "";
    }

    const conversationState = state.conversationState;
    return [
      state.threadId,
      state.ownerClientId ?? "",
      String(this.readConversationStateUpdatedAt(conversationState)),
      String(conversationState?.turns.length ?? -1),
      this.modeSelectionStateResolver.readModeSelectionSignatureFromConversationState(
        conversationState,
        appDefaultModel,
        appDefaultEffort
      ),
      this.readConversationProgressSignature(conversationState)
    ].join("|");
  }

  public buildReadThreadSyncSignature(
    state: ReadThreadLike | null | undefined,
    appDefaultModel: string,
    appDefaultEffort: string
  ): string {
    if (!state) {
      return "";
    }

    const conversationState = state.thread;
    return [
      conversationState.id ?? "",
      String(this.readConversationStateUpdatedAt(conversationState)),
      String(conversationState.turns.length),
      this.modeSelectionStateResolver.readModeSelectionSignatureFromConversationState(
        conversationState,
        appDefaultModel,
        appDefaultEffort
      ),
      this.readConversationProgressSignature(conversationState)
    ].join("|");
  }

  private readConversationProgressSignature(
    state: ConversationStateLike | null | undefined
  ): string {
    if (!state) {
      return "";
    }

    const lastTurn = state.turns[state.turns.length - 1];
    if (!lastTurn) {
      return "no-turns";
    }

    const lastTurnId = lastTurn.id ?? lastTurn.turnId ?? "";
    const items = lastTurn.items;
    const lastItem = items[items.length - 1];

    return [
      String(state.turns.length),
      lastTurnId,
      lastTurn.status ?? "",
      String(items.length),
      lastItem?.id ?? "",
      lastItem?.type ?? ""
    ].join("|");
  }
}
