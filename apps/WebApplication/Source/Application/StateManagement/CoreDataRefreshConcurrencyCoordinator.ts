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

    const inFlightRefresh = (async () => {
      do {
        this.isRefreshQueued = false;
        await executeRefresh();
      } while (this.isRefreshQueued);
    })().finally(() => {
      this.inFlightRefresh = null;
      this.isRefreshQueued = false;
    });

    this.inFlightRefresh = inFlightRefresh;
    await inFlightRefresh;
  }
}
