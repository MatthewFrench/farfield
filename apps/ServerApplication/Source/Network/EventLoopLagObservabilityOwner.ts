interface PercentileSample {
  values: number[];
  percentile: number;
}

const DEFAULT_SAMPLE_INTERVAL_MILLISECONDS = 1_000;
const DEFAULT_MAXIMUM_SAMPLE_COUNT = 600;
const FIFTIETH_PERCENTILE = 50;
const NINETY_FIFTH_PERCENTILE = 95;
const NINETY_NINTH_PERCENTILE = 99;

function readPercentile(sample: PercentileSample): number {
  if (sample.values.length === 0) {
    return 0;
  }
  const sortedValues = [...sample.values].sort((left, right) => left - right);
  const percentileIndex = Math.max(
    0,
    Math.min(
      sortedValues.length - 1,
      Math.ceil((sample.percentile / 100) * sortedValues.length) - 1
    )
  );
  return sortedValues[percentileIndex] ?? 0;
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
    if (!Number.isInteger(sampleIntervalMs) || sampleIntervalMs <= 0) {
      throw new Error("EventLoopLagObservabilityOwner requires a positive integer sampleIntervalMs");
    }
    if (!Number.isInteger(maxSamples) || maxSamples <= 0) {
      throw new Error("EventLoopLagObservabilityOwner requires a positive integer maxSamples");
    }

    this.sampleIntervalMs = sampleIntervalMs;
    this.maxSamples = maxSamples;
    this.now = dependencies?.now ?? (() => Date.now());
    this.scheduleInterval = dependencies?.scheduleInterval ?? ((callback, intervalMs) => setInterval(callback, intervalMs));
    this.clearScheduledInterval = dependencies?.clearScheduledInterval ?? ((timerHandle) => clearInterval(timerHandle));
    this.lagSamplesMs = [];
    this.expectedTickAtEpochMs = null;
    this.timerHandle = null;
    this.lastLagMs = 0;
  }

  public start(): void {
    if (this.timerHandle) {
      return;
    }

    this.expectedTickAtEpochMs = this.now() + this.sampleIntervalMs;
    this.timerHandle = this.scheduleInterval(() => {
      const nowEpochMs = this.now();
      const expectedTickAtEpochMs = this.expectedTickAtEpochMs;
      const lagMs = expectedTickAtEpochMs === null
        ? 0
        : Math.max(0, nowEpochMs - expectedTickAtEpochMs);
      this.recordLagSample(lagMs);
      this.expectedTickAtEpochMs = nowEpochMs + this.sampleIntervalMs;
    }, this.sampleIntervalMs);
  }

  public stop(): void {
    if (!this.timerHandle) {
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
      p50LagMs: readPercentile({ values: this.lagSamplesMs, percentile: FIFTIETH_PERCENTILE }),
      p95LagMs: readPercentile({ values: this.lagSamplesMs, percentile: NINETY_FIFTH_PERCENTILE }),
      p99LagMs: readPercentile({ values: this.lagSamplesMs, percentile: NINETY_NINTH_PERCENTILE }),
      maxLagMs: this.lagSamplesMs.length > 0 ? Math.max(...this.lagSamplesMs) : 0
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
