export interface RuntimeRefreshMeasurement {
  startedAtEpochMilliseconds: number;
  startedAtHighResolutionMilliseconds: number;
}

export interface RuntimeRefreshObservabilitySnapshot {
  totalRefreshCount: number;
  succeededRefreshCount: number;
  failedRefreshCount: number;
  inFlightRefreshCount: number;
  lastDurationMilliseconds: number | null;
  averageDurationMilliseconds: number | null;
  longestDurationMilliseconds: number | null;
  lastStartedAtEpochMilliseconds: number | null;
  lastCompletedAtEpochMilliseconds: number | null;
}

/**
 * Tracks runtime refresh counters and timing so startup/manual refresh behavior can be
 * inspected without coupling composition code to ad-hoc logging.
 */
export class RuntimeRefreshObservabilityOwner {
  private totalRefreshCount: number;
  private succeededRefreshCount: number;
  private failedRefreshCount: number;
  private inFlightRefreshCount: number;
  private totalDurationMilliseconds: number;
  private lastDurationMilliseconds: number | null;
  private longestDurationMilliseconds: number | null;
  private lastStartedAtEpochMilliseconds: number | null;
  private lastCompletedAtEpochMilliseconds: number | null;

  public constructor() {
    this.totalRefreshCount = 0;
    this.succeededRefreshCount = 0;
    this.failedRefreshCount = 0;
    this.inFlightRefreshCount = 0;
    this.totalDurationMilliseconds = 0;
    this.lastDurationMilliseconds = null;
    this.longestDurationMilliseconds = null;
    this.lastStartedAtEpochMilliseconds = null;
    this.lastCompletedAtEpochMilliseconds = null;
  }

  public beginRefresh(): RuntimeRefreshMeasurement {
    const startedAtEpochMilliseconds = Date.now();
    const startedAtHighResolutionMilliseconds = performance.now();

    this.totalRefreshCount += 1;
    this.inFlightRefreshCount += 1;
    this.lastStartedAtEpochMilliseconds = startedAtEpochMilliseconds;

    return {
      startedAtEpochMilliseconds,
      startedAtHighResolutionMilliseconds
    };
  }

  public completeRefreshSuccess(measurement: RuntimeRefreshMeasurement): void {
    this.succeededRefreshCount += 1;
    this.completeRefresh(measurement);
  }

  public completeRefreshFailure(measurement: RuntimeRefreshMeasurement): void {
    this.failedRefreshCount += 1;
    this.completeRefresh(measurement);
  }

  public readSnapshot(): RuntimeRefreshObservabilitySnapshot {
    const completedRefreshCount = this.succeededRefreshCount + this.failedRefreshCount;
    const averageDurationMilliseconds = completedRefreshCount > 0
      ? this.totalDurationMilliseconds / completedRefreshCount
      : null;

    return {
      totalRefreshCount: this.totalRefreshCount,
      succeededRefreshCount: this.succeededRefreshCount,
      failedRefreshCount: this.failedRefreshCount,
      inFlightRefreshCount: this.inFlightRefreshCount,
      lastDurationMilliseconds: this.lastDurationMilliseconds,
      averageDurationMilliseconds,
      longestDurationMilliseconds: this.longestDurationMilliseconds,
      lastStartedAtEpochMilliseconds: this.lastStartedAtEpochMilliseconds,
      lastCompletedAtEpochMilliseconds: this.lastCompletedAtEpochMilliseconds
    };
  }

  private completeRefresh(measurement: RuntimeRefreshMeasurement): void {
    const durationMilliseconds = Math.max(0, performance.now() - measurement.startedAtHighResolutionMilliseconds);

    this.lastDurationMilliseconds = durationMilliseconds;
    this.totalDurationMilliseconds += durationMilliseconds;
    this.longestDurationMilliseconds = this.longestDurationMilliseconds === null
      ? durationMilliseconds
      : Math.max(this.longestDurationMilliseconds, durationMilliseconds);
    this.lastCompletedAtEpochMilliseconds = Date.now();
    this.inFlightRefreshCount = Math.max(0, this.inFlightRefreshCount - 1);
  }
}
