interface PercentileReadRequest {
  values: readonly number[];
  percentileRank: number;
}

const DEFAULT_SAMPLE_INTERVAL_MILLISECONDS = 1_000;
const DEFAULT_MAXIMUM_SAMPLE_COUNT = 600;
const MINIMUM_POSITIVE_INTEGER = 1;
const NO_LAG_MILLISECONDS = 0;
const PERCENTILE_DENOMINATOR = 100;
const LAG_PERCENTILE_RANK_BY_NAME = {
  p50: 50,
  p95: 95,
  p99: 99
} as const;

type PositiveIntegerConfigurationFieldName = "sampleIntervalMs" | "maxSamples";

const POSITIVE_INTEGER_CONFIGURATION_ERROR_MESSAGE_BY_FIELD_NAME: Readonly<
  Record<PositiveIntegerConfigurationFieldName, string>
> = {
  sampleIntervalMs: "EventLoopLagObservabilityOwner requires a positive integer sampleIntervalMs",
  maxSamples: "EventLoopLagObservabilityOwner requires a positive integer maxSamples"
};

function assertPositiveIntegerConfiguration(
  value: number,
  fieldName: PositiveIntegerConfigurationFieldName
): void {
  if (!Number.isInteger(value) || value < MINIMUM_POSITIVE_INTEGER) {
    throw new Error(POSITIVE_INTEGER_CONFIGURATION_ERROR_MESSAGE_BY_FIELD_NAME[fieldName]);
  }
}

function readNearestRankPercentileIndex(sampleCount: number, percentileRank: number): number {
  return Math.max(
    0,
    Math.min(
      sampleCount - 1,
      Math.ceil((percentileRank / PERCENTILE_DENOMINATOR) * sampleCount) - 1
    )
  );
}

function readPercentileValue(request: PercentileReadRequest): number {
  if (request.values.length === 0) {
    return NO_LAG_MILLISECONDS;
  }

  // Nearest-rank keeps percentile values pinned to observed lag samples.
  const sortedValues = [...request.values].sort((left, right) => left - right);
  const percentileIndex = readNearestRankPercentileIndex(
    sortedValues.length,
    request.percentileRank
  );
  return sortedValues[percentileIndex] ?? NO_LAG_MILLISECONDS;
}

export interface EventLoopLagStatistics {
  sampleIntervalMs: number;
  sampleCount: number;
  lastLagMs: number;
  p50LagMs: number;
  p95LagMs: number;
  p99LagMs: number;
  maxLagMs: number;
}

interface EventLoopLagObservabilityOwnerDependencies {
  now?: () => number;
  scheduleInterval?: (callback: () => void, intervalMs: number) => NodeJS.Timeout;
  clearScheduledInterval?: (timerHandle: NodeJS.Timeout) => void;
}

/**
 * Owns event-loop lag sampling for server observability so request routing metrics can
 * be interpreted with scheduling-pressure context.
 */
export class EventLoopLagObservabilityOwner {
  private readonly sampleIntervalMs: number;
  private readonly maxSamples: number;
  private readonly now: () => number;
  private readonly scheduleInterval: (callback: () => void, intervalMs: number) => NodeJS.Timeout;
  private readonly clearScheduledInterval: (timerHandle: NodeJS.Timeout) => void;
  private readonly lagSamplesMs: number[];
  private expectedTickAtEpochMs: number | null;
  private timerHandle: NodeJS.Timeout | null;
  private lastLagMs: number;

  public constructor(
    sampleIntervalMs = DEFAULT_SAMPLE_INTERVAL_MILLISECONDS,
    maxSamples = DEFAULT_MAXIMUM_SAMPLE_COUNT,
    dependencies?: EventLoopLagObservabilityOwnerDependencies
  ) {
    assertPositiveIntegerConfiguration(sampleIntervalMs, "sampleIntervalMs");
    assertPositiveIntegerConfiguration(maxSamples, "maxSamples");

    this.sampleIntervalMs = sampleIntervalMs;
    this.maxSamples = maxSamples;
    this.now = dependencies?.now ?? (() => Date.now());
    this.scheduleInterval = dependencies?.scheduleInterval ?? ((callback, intervalMs) => setInterval(callback, intervalMs));
    this.clearScheduledInterval = dependencies?.clearScheduledInterval ?? ((timerHandle) => clearInterval(timerHandle));
    this.lagSamplesMs = [];
    this.expectedTickAtEpochMs = null;
    this.timerHandle = null;
    this.lastLagMs = NO_LAG_MILLISECONDS;
  }

  public start(): void {
    if (this.timerHandle !== null) {
      return;
    }

    this.expectedTickAtEpochMs = this.now() + this.sampleIntervalMs;
    this.timerHandle = this.scheduleInterval(() => {
      const nowEpochMs = this.now();
      const expectedTickAtEpochMs = this.expectedTickAtEpochMs;
      const lagMs = expectedTickAtEpochMs === null
        ? NO_LAG_MILLISECONDS
        : Math.max(NO_LAG_MILLISECONDS, nowEpochMs - expectedTickAtEpochMs);
      this.recordLagSample(lagMs);
      this.expectedTickAtEpochMs = nowEpochMs + this.sampleIntervalMs;
    }, this.sampleIntervalMs);
  }

  public stop(): void {
    if (this.timerHandle === null) {
      return;
    }
    this.clearScheduledInterval(this.timerHandle);
    this.timerHandle = null;
    this.expectedTickAtEpochMs = null;
  }

  public readCurrentLagMs(): number {
    return this.lastLagMs;
  }

  public readStatistics(): EventLoopLagStatistics {
    return {
      sampleIntervalMs: this.sampleIntervalMs,
      sampleCount: this.lagSamplesMs.length,
      lastLagMs: this.lastLagMs,
      p50LagMs: readPercentileValue({
        values: this.lagSamplesMs,
        percentileRank: LAG_PERCENTILE_RANK_BY_NAME.p50
      }),
      p95LagMs: readPercentileValue({
        values: this.lagSamplesMs,
        percentileRank: LAG_PERCENTILE_RANK_BY_NAME.p95
      }),
      p99LagMs: readPercentileValue({
        values: this.lagSamplesMs,
        percentileRank: LAG_PERCENTILE_RANK_BY_NAME.p99
      }),
      maxLagMs: this.lagSamplesMs.length > 0 ? Math.max(...this.lagSamplesMs) : NO_LAG_MILLISECONDS
    };
  }

  private recordLagSample(lagMs: number): void {
    this.lastLagMs = lagMs;
    if (this.lagSamplesMs.length === this.maxSamples) {
      this.lagSamplesMs.shift();
    }
    this.lagSamplesMs.push(lagMs);
  }
}
