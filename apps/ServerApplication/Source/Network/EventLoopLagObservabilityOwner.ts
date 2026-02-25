interface PercentileSample {
  values: number[];
  percentile: number;
}

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

/**
 * Owns event-loop lag sampling for server observability so request routing metrics can
 * be interpreted with scheduling-pressure context.
 */
export class EventLoopLagObservabilityOwner {
  private readonly sampleIntervalMs: number;
  private readonly maxSamples: number;
  private readonly lagSamplesMs: number[];
  private expectedTickAtEpochMs: number | null;
  private timerHandle: NodeJS.Timeout | null;
  private lastLagMs: number;

  public constructor(sampleIntervalMs = 1_000, maxSamples = 600) {
    if (!Number.isInteger(sampleIntervalMs) || sampleIntervalMs <= 0) {
      throw new Error("EventLoopLagObservabilityOwner requires a positive integer sampleIntervalMs");
    }
    if (!Number.isInteger(maxSamples) || maxSamples <= 0) {
      throw new Error("EventLoopLagObservabilityOwner requires a positive integer maxSamples");
    }

    this.sampleIntervalMs = sampleIntervalMs;
    this.maxSamples = maxSamples;
    this.lagSamplesMs = [];
    this.expectedTickAtEpochMs = null;
    this.timerHandle = null;
    this.lastLagMs = 0;
  }

  public start(): void {
    if (this.timerHandle) {
      return;
    }

    this.expectedTickAtEpochMs = Date.now() + this.sampleIntervalMs;
    this.timerHandle = setInterval(() => {
      const nowEpochMs = Date.now();
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
    clearInterval(this.timerHandle);
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
      p50LagMs: readPercentile({ values: this.lagSamplesMs, percentile: 50 }),
      p95LagMs: readPercentile({ values: this.lagSamplesMs, percentile: 95 }),
      p99LagMs: readPercentile({ values: this.lagSamplesMs, percentile: 99 }),
      maxLagMs: this.lagSamplesMs.length > 0 ? Math.max(...this.lagSamplesMs) : 0
    };
  }

  private recordLagSample(lagMs: number): void {
    this.lastLagMs = lagMs;
    this.lagSamplesMs.push(lagMs);
    if (this.lagSamplesMs.length > this.maxSamples) {
      this.lagSamplesMs.shift();
    }
  }
}
