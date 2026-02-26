export interface EventRefreshFlags {
  refreshCore: boolean;
  refreshHistory: boolean;
  refreshSelectedThread: boolean;
}

const EMPTY_EVENT_REFRESH_FLAGS: EventRefreshFlags = {
  refreshCore: false,
  refreshHistory: false,
  refreshSelectedThread: false
};

function createEmptyEventRefreshFlags(): EventRefreshFlags {
  return {
    refreshCore: EMPTY_EVENT_REFRESH_FLAGS.refreshCore,
    refreshHistory: EMPTY_EVENT_REFRESH_FLAGS.refreshHistory,
    refreshSelectedThread: EMPTY_EVENT_REFRESH_FLAGS.refreshSelectedThread
  };
}

export function mergeEventRefreshFlags(
  existingRefreshFlags: EventRefreshFlags,
  nextRefreshFlags: EventRefreshFlags
): EventRefreshFlags {
  return {
    refreshCore: existingRefreshFlags.refreshCore || nextRefreshFlags.refreshCore,
    refreshHistory: existingRefreshFlags.refreshHistory || nextRefreshFlags.refreshHistory,
    refreshSelectedThread:
      existingRefreshFlags.refreshSelectedThread || nextRefreshFlags.refreshSelectedThread
  };
}

export function hasEventRefreshWork(refreshFlags: EventRefreshFlags): boolean {
  return (
    refreshFlags.refreshCore
    || refreshFlags.refreshHistory
    || refreshFlags.refreshSelectedThread
  );
}

export class EventRefreshScheduler {
  private pendingRefreshFlags: EventRefreshFlags;
  private refreshTimer: number | null;
  private readonly refreshDelayMs: number;

  public constructor(refreshDelayMs: number) {
    if (!Number.isInteger(refreshDelayMs) || refreshDelayMs < 0) {
      throw new Error("EventRefreshScheduler requires a non-negative integer refreshDelayMs");
    }
    this.refreshDelayMs = refreshDelayMs;
    this.pendingRefreshFlags = createEmptyEventRefreshFlags();
    this.refreshTimer = null;
  }

  public enqueueRefresh(
    refreshFlags: EventRefreshFlags,
    executeRefresh: (refreshFlags: EventRefreshFlags) => Promise<void>
  ): void {
    this.pendingRefreshFlags = mergeEventRefreshFlags(this.pendingRefreshFlags, refreshFlags);

    if (!hasEventRefreshWork(this.pendingRefreshFlags)) {
      this.clearRefreshTimer();
      return;
    }

    this.clearRefreshTimer();
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      const nextRefreshFlags = this.pendingRefreshFlags;
      this.clearPendingRefreshFlags();
      if (!hasEventRefreshWork(nextRefreshFlags)) {
        return;
      }
      void executeRefresh(nextRefreshFlags);
    }, this.refreshDelayMs);
  }

  public dispose(): void {
    this.clearRefreshTimer();
    this.clearPendingRefreshFlags();
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer === null) {
      return;
    }
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }

  private clearPendingRefreshFlags(): void {
    this.pendingRefreshFlags = createEmptyEventRefreshFlags();
  }
}
