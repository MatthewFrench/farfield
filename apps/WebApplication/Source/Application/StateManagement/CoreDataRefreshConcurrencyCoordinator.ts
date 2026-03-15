/**
 * Owns single-flight core-data refresh execution with deterministic queue coalescing.
 * While one refresh runs, additional run requests are merged into one follow-up cycle.
 */
export class CoreDataRefreshConcurrencyCoordinator {
  private inFlightRefresh: Promise<void> | null;
  private isRefreshQueued: boolean;

  public constructor() {
    this.inFlightRefresh = null;
    this.isRefreshQueued = false;
  }

  public async run(executeRefresh: () => Promise<void>): Promise<void> {
    if (this.inFlightRefresh) {
      this.isRefreshQueued = true;
      await this.inFlightRefresh;
      return;
    }

    this.inFlightRefresh = this.runQueuedRefreshes(executeRefresh).finally(() => {
      this.inFlightRefresh = null;
      this.isRefreshQueued = false;
    });

    await this.inFlightRefresh;
  }

  private async runQueuedRefreshes(executeRefresh: () => Promise<void>): Promise<void> {
    for (;;) {
      this.isRefreshQueued = false;
      try {
        await executeRefresh();
      } catch (refreshError) {
        // If another refresh request arrived while this cycle ran, execute the queued cycle
        // and report only the latest cycle failure.
        if (this.consumeRefreshQueuedState()) {
          continue;
        }
        throw refreshError;
      }
      if (!this.consumeRefreshQueuedState()) {
        return;
      }
    }
  }

  private consumeRefreshQueuedState(): boolean {
    const wasRefreshQueued = this.isRefreshQueued;
    this.isRefreshQueued = false;
    return wasRefreshQueued;
  }
}
