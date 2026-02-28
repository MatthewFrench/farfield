interface PushDiagnosticsRefreshStateOwnerOptions {
  timeToLiveMilliseconds: number;
  readNowMilliseconds?: () => number;
}

interface RunPushDiagnosticsRefreshInput {
  refreshTask: () => Promise<void>;
  forceRefresh: boolean;
}

/**
 * Owns push diagnostics refresh cadence for settings surfaces.
 * The owner enforces one in-flight refresh and a time-to-live window so
 * section-entry refreshes stay lightweight while preserving explicit user refresh actions.
 */
export class PushDiagnosticsRefreshStateOwner {
  private readonly timeToLiveMilliseconds: number;
  private readonly readNowMilliseconds: () => number;
  private inFlightRefreshPromise: Promise<void> | null;
  private lastSuccessfulRefreshAtMilliseconds: number | null;

  public constructor(options: PushDiagnosticsRefreshStateOwnerOptions) {
    if (!Number.isInteger(options.timeToLiveMilliseconds) || options.timeToLiveMilliseconds < 0) {
      throw new Error(
        "PushDiagnosticsRefreshStateOwner requires non-negative integer timeToLiveMilliseconds",
      );
    }
    this.timeToLiveMilliseconds = options.timeToLiveMilliseconds;
    this.readNowMilliseconds = options.readNowMilliseconds ?? (() => Date.now());
    this.inFlightRefreshPromise = null;
    this.lastSuccessfulRefreshAtMilliseconds = null;
  }

  public async runRefresh(input: RunPushDiagnosticsRefreshInput): Promise<void> {
    if (this.inFlightRefreshPromise !== null) {
      await this.inFlightRefreshPromise;
      return;
    }

    if (!input.forceRefresh && this.readRefreshWindowIsActive()) {
      return;
    }

    const refreshPromise = this.runRefreshTask(input.refreshTask);
    this.inFlightRefreshPromise = refreshPromise;
    try {
      await refreshPromise;
    } finally {
      if (this.inFlightRefreshPromise === refreshPromise) {
        this.inFlightRefreshPromise = null;
      }
    }
  }

  private async runRefreshTask(task: () => Promise<void>): Promise<void> {
    await task();
    this.lastSuccessfulRefreshAtMilliseconds = this.readNowMilliseconds();
  }

  private readRefreshWindowIsActive(): boolean {
    const lastSuccessfulRefreshAtMilliseconds = this.lastSuccessfulRefreshAtMilliseconds;
    if (lastSuccessfulRefreshAtMilliseconds === null) {
      return false;
    }

    return (
      this.readNowMilliseconds() - lastSuccessfulRefreshAtMilliseconds < this.timeToLiveMilliseconds
    );
  }
}
