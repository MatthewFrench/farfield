export interface EventRefreshFlags {
  refreshCore: boolean;
  refreshHistory: boolean;
  refreshSelectedThread: boolean;
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
    this.pendingRefreshFlags = {
      refreshCore: false,
      refreshHistory: false,
      refreshSelectedThread: false
    };
    this.refreshTimer = null;
  }

  public enqueueRefresh(
    refreshFlags: EventRefreshFlags,
    executeRefresh: (refreshFlags: EventRefreshFlags) => Promise<void>
  ): void {
    this.pendingRefreshFlags = {
      refreshCore: this.pendingRefreshFlags.refreshCore || refreshFlags.refreshCore,
      refreshHistory: this.pendingRefreshFlags.refreshHistory || refreshFlags.refreshHistory,
      refreshSelectedThread: this.pendingRefreshFlags.refreshSelectedThread || refreshFlags.refreshSelectedThread
    };

    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      const nextRefreshFlags = this.pendingRefreshFlags;
      this.pendingRefreshFlags = {
        refreshCore: false,
        refreshHistory: false,
        refreshSelectedThread: false
      };
      void executeRefresh(nextRefreshFlags);
    }, this.refreshDelayMs);
  }

  public dispose(): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.pendingRefreshFlags = {
      refreshCore: false,
      refreshHistory: false,
      refreshSelectedThread: false
    };
  }
}
