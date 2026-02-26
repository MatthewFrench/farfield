export interface RuntimeRefreshMeasurement {
  startedAtEpochMilliseconds: number;
  startedAtHighResolutionMilliseconds: number;
}

export interface RuntimeRefreshObservabilityClock {
  readEpochMilliseconds: () => number;
  readHighResolutionMilliseconds: () => number;
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

const RUNTIME_REFRESH_OBSERVABILITY_DEFAULT_CLOCK: RuntimeRefreshObservabilityClock = {
  readEpochMilliseconds: () => Date.now(),
  readHighResolutionMilliseconds: () => performance.now()
};

/**
 * Tracks runtime refresh counters and timing so startup/manual refresh behavior can be
 * inspected without coupling composition code to ad-hoc logging.
 */
export class RuntimeRefreshObservabilityOwner {
  private readonly clock: RuntimeRefreshObservabilityClock;
  private totalRefreshCount: number;
  private succeededRefreshCount: number;
  private failedRefreshCount: number;
  private inFlightRefreshCount: number;
  private totalDurationMilliseconds: number;
  private lastDurationMilliseconds: number | null;
  private longestDurationMilliseconds: number | null;
  private lastStartedAtEpochMilliseconds: number | null;
  private lastCompletedAtEpochMilliseconds: number | null;

  public constructor(clock: RuntimeRefreshObservabilityClock = RUNTIME_REFRESH_OBSERVABILITY_DEFAULT_CLOCK) {
    this.clock = clock;
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
    const startedAtEpochMilliseconds = this.clock.readEpochMilliseconds();
    const startedAtHighResolutionMilliseconds = this.clock.readHighResolutionMilliseconds();

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
    const durationMilliseconds = Math.max(
      0,
      this.clock.readHighResolutionMilliseconds() - measurement.startedAtHighResolutionMilliseconds
    );

    this.lastDurationMilliseconds = durationMilliseconds;
    this.totalDurationMilliseconds += durationMilliseconds;
    this.longestDurationMilliseconds = this.longestDurationMilliseconds === null
      ? durationMilliseconds
      : Math.max(this.longestDurationMilliseconds, durationMilliseconds);
    this.lastCompletedAtEpochMilliseconds = this.clock.readEpochMilliseconds();
    this.inFlightRefreshCount = Math.max(0, this.inFlightRefreshCount - 1);
  }
}
