export interface RuntimeNotificationReadObservabilityRecord {
  processedEventCount: number;
  relevantEventCount: number;
  threadStatusUpdateCount: number;
  requestedRateLimitRefresh: boolean;
  requestedAppsRefresh: boolean;
  resetRequired: boolean;
}

export interface RuntimeNotificationReadObservabilitySummary {
  totalReadCount: number;
  totalProcessedEventCount: number;
  totalRelevantEventCount: number;
  totalThreadStatusUpdateCount: number;
  totalRateLimitRefreshRequests: number;
  totalAppsRefreshRequests: number;
  totalResetRequiredReads: number;
}

const DEFAULT_SUMMARY_SAMPLE_INTERVAL = 20;

/**
 * Owns bounded summary metrics for runtime notification projection reads.
 * Summaries are sampled at a fixed read interval or when reset-required batches occur.
 */
export class RuntimeNotificationReadObservabilityOwner {
  private readonly summarySampleInterval: number;
  private totalReadCount: number;
  private totalProcessedEventCount: number;
  private totalRelevantEventCount: number;
  private totalThreadStatusUpdateCount: number;
  private totalRateLimitRefreshRequests: number;
  private totalAppsRefreshRequests: number;
  private totalResetRequiredReads: number;

  public constructor(summarySampleInterval: number = DEFAULT_SUMMARY_SAMPLE_INTERVAL) {
    if (!Number.isInteger(summarySampleInterval) || summarySampleInterval <= 0) {
      throw new Error(
        "RuntimeNotificationReadObservabilityOwner requires a positive integer summarySampleInterval",
      );
    }
    this.summarySampleInterval = summarySampleInterval;
    this.totalReadCount = 0;
    this.totalProcessedEventCount = 0;
    this.totalRelevantEventCount = 0;
    this.totalThreadStatusUpdateCount = 0;
    this.totalRateLimitRefreshRequests = 0;
    this.totalAppsRefreshRequests = 0;
    this.totalResetRequiredReads = 0;
  }

  public recordRead(
    record: RuntimeNotificationReadObservabilityRecord,
  ): RuntimeNotificationReadObservabilitySummary | null {
    this.totalReadCount += 1;
    this.totalProcessedEventCount += record.processedEventCount;
    this.totalRelevantEventCount += record.relevantEventCount;
    this.totalThreadStatusUpdateCount += record.threadStatusUpdateCount;
    if (record.requestedRateLimitRefresh) {
      this.totalRateLimitRefreshRequests += 1;
    }
    if (record.requestedAppsRefresh) {
      this.totalAppsRefreshRequests += 1;
    }
    if (record.resetRequired) {
      this.totalResetRequiredReads += 1;
    }

    if (this.totalReadCount % this.summarySampleInterval !== 0 && record.resetRequired !== true) {
      return null;
    }

    return this.readSummary();
  }

  public readSummary(): RuntimeNotificationReadObservabilitySummary {
    return {
      totalReadCount: this.totalReadCount,
      totalProcessedEventCount: this.totalProcessedEventCount,
      totalRelevantEventCount: this.totalRelevantEventCount,
      totalThreadStatusUpdateCount: this.totalThreadStatusUpdateCount,
      totalRateLimitRefreshRequests: this.totalRateLimitRefreshRequests,
      totalAppsRefreshRequests: this.totalAppsRefreshRequests,
      totalResetRequiredReads: this.totalResetRequiredReads,
    };
  }
}
