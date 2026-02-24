export interface ChatScrollElementLike {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

export interface ChatBottomStateSynchronizationInput {
  scrollElement: ChatScrollElementLike;
  previousIsAtBottom: boolean;
}

export interface ChatBottomStateSynchronizationResult {
  nextIsAtBottom: boolean;
  changed: boolean;
}

export class ChatScrollStateCoordinator {
  private readonly bottomThresholdPx: number;

  public constructor(bottomThresholdPx: number) {
    if (!Number.isFinite(bottomThresholdPx) || bottomThresholdPx < 0) {
      throw new Error("ChatScrollStateCoordinator requires a non-negative finite bottomThresholdPx");
    }
    this.bottomThresholdPx = bottomThresholdPx;
  }

  public readDistanceFromBottom(scrollElement: ChatScrollElementLike): number {
    return scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
  }

  public readIsAtBottom(scrollElement: ChatScrollElementLike): boolean {
    return this.readDistanceFromBottom(scrollElement) <= this.bottomThresholdPx;
  }

  public synchronizeBottomState(
    input: ChatBottomStateSynchronizationInput
  ): ChatBottomStateSynchronizationResult {
    const nextIsAtBottom = this.readIsAtBottom(input.scrollElement);
    return {
      nextIsAtBottom,
      changed: nextIsAtBottom !== input.previousIsAtBottom
    };
  }

  public pinToBottom(scrollElement: ChatScrollElementLike): void {
    scrollElement.scrollTop = scrollElement.scrollHeight;
  }
}
