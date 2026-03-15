import { performance } from "node:perf_hooks";
import {
  appendSampleWindowValue,
  readNearestRankPercentile,
  readSampleWindowMaximum,
} from "./RequestTimingSampleWindow.js";

export interface PushMutationConcurrencyCoordinatorStatistics {
  queuedExecutionCount: number;
  completedExecutionCount: number;
  failedExecutionCount: number;
  hasInFlightOperation: boolean;
  pendingExecutionCount: number;
  blockedExecutionCount: number;
  lastBlockedWaitMs: number;
  p95BlockedWaitMs: number;
  maxBlockedWaitMs: number;
}

const MINIMUM_PENDING_EXECUTION_COUNT = 0;
const BLOCKED_WAIT_SAMPLE_WINDOW_MAXIMUM = 240;

interface QueuedExecution {
  enqueuedAtHighResolutionMilliseconds: number;
  previousTail: Promise<void>;
  releaseCurrentTail: () => void;
}

/**
 * Owns process-wide serialization for push mutation operations.
 * Invariant: at most one operation executes at a time, and queued operations continue even after failures.
 */
export class PushMutationConcurrencyCoordinator {
  private executionTail: Promise<void>;
  private pendingExecutionCount: number;
  private queuedExecutionCount: number;
  private completedExecutionCount: number;
  private failedExecutionCount: number;
  private readonly blockedWaitSamplesMs: number[];
  private blockedExecutionCount: number;
  private lastBlockedWaitMs: number;

  public constructor() {
    this.executionTail = Promise.resolve();
    this.pendingExecutionCount = 0;
    this.queuedExecutionCount = 0;
    this.completedExecutionCount = 0;
    this.failedExecutionCount = 0;
    this.blockedWaitSamplesMs = [];
    this.blockedExecutionCount = 0;
    this.lastBlockedWaitMs = 0;
  }

  public async runExclusive<ResultType>(operation: () => Promise<ResultType>): Promise<ResultType> {
    this.recordQueuedExecution();
    const queuedExecution = this.enqueueExecution();
    try {
      await queuedExecution.previousTail;
      this.recordBlockedWait(queuedExecution);
      const result = await operation();
      this.completedExecutionCount += 1;
      return result;
    } catch (error) {
      this.failedExecutionCount += 1;
      throw error;
    } finally {
      this.finishQueuedExecution(queuedExecution);
    }
  }

  public readStatistics(): PushMutationConcurrencyCoordinatorStatistics {
    return {
      queuedExecutionCount: this.queuedExecutionCount,
      completedExecutionCount: this.completedExecutionCount,
      failedExecutionCount: this.failedExecutionCount,
      hasInFlightOperation: this.pendingExecutionCount > 0,
      pendingExecutionCount: this.pendingExecutionCount,
      blockedExecutionCount: this.blockedExecutionCount,
      lastBlockedWaitMs: this.lastBlockedWaitMs,
      p95BlockedWaitMs: readNearestRankPercentile({
        values: this.blockedWaitSamplesMs,
        percentile: 95,
      }),
      maxBlockedWaitMs: readSampleWindowMaximum(this.blockedWaitSamplesMs),
    };
  }

  private recordQueuedExecution(): void {
    this.queuedExecutionCount += 1;
    this.pendingExecutionCount += 1;
  }

  private enqueueExecution(): QueuedExecution {
    const enqueuedAtHighResolutionMilliseconds = performance.now();
    const previousTail = this.executionTail;
    let releaseCurrentTail: () => void = () => void 0;
    const currentTail = new Promise<void>((resolve) => {
      releaseCurrentTail = resolve;
    });
    // Keep the queue moving even if a prior tail unexpectedly rejects.
    this.executionTail = previousTail.then(
      () => currentTail,
      () => currentTail,
    );

    return {
      enqueuedAtHighResolutionMilliseconds,
      previousTail,
      releaseCurrentTail,
    };
  }

  private recordBlockedWait(queuedExecution: QueuedExecution): void {
    const blockedWaitMs = Math.max(
      0,
      performance.now() - queuedExecution.enqueuedAtHighResolutionMilliseconds,
    );
    this.lastBlockedWaitMs = blockedWaitMs;
    appendSampleWindowValue(
      this.blockedWaitSamplesMs,
      blockedWaitMs,
      BLOCKED_WAIT_SAMPLE_WINDOW_MAXIMUM,
    );
    if (blockedWaitMs > 0) {
      this.blockedExecutionCount += 1;
    }
  }

  private finishQueuedExecution(queuedExecution: QueuedExecution): void {
    this.pendingExecutionCount = Math.max(
      MINIMUM_PENDING_EXECUTION_COUNT,
      this.pendingExecutionCount - 1,
    );
    queuedExecution.releaseCurrentTail();
  }
}
