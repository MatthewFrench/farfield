import { performance } from "node:perf_hooks";
import {
  appendSampleWindowValue,
  readNearestRankPercentile,
  readSampleWindowMaximum,
} from "./RequestTimingSampleWindow.js";

const EMPTY_THREAD_IDENTIFIER_ERROR_MESSAGE =
  "ThreadConcurrencyCoordinator requires non-empty threadId";
const MINIMUM_NORMALIZED_THREAD_IDENTIFIER_LENGTH = 1;
const MINIMUM_PENDING_EXECUTION_COUNT = 0;
const SINGLE_PENDING_EXECUTION_COUNT = 1;
const BLOCKED_WAIT_SAMPLE_WINDOW_MAXIMUM = 240;

interface QueuedThreadExecution {
  enqueuedAtHighResolutionMilliseconds: number;
  previousTail: Promise<void>;
  chainedTail: Promise<void>;
  releaseCurrentTail: () => void;
}

export interface ThreadConcurrencyCoordinatorStatistics {
  queuedExecutionCount: number;
  completedExecutionCount: number;
  failedExecutionCount: number;
  activeThreadCount: number;
  inFlightThreadCount: number;
  pendingExecutionCount: number;
  blockedExecutionCount: number;
  lastBlockedWaitMs: number;
  p95BlockedWaitMs: number;
  maxBlockedWaitMs: number;
}

/**
 * Owns deterministic per-thread serialization for thread mutation/read operations.
 * Invariant: each normalized thread identifier has at most one in-flight operation at a time.
 */
export class ThreadConcurrencyCoordinator {
  private readonly tailByThreadId: Map<string, Promise<void>>;
  private readonly pendingExecutionCountByThreadId: Map<string, number>;
  private readonly inFlightThreadIdSet: Set<string>;
  private pendingExecutionCount: number;
  private queuedExecutionCount: number;
  private completedExecutionCount: number;
  private failedExecutionCount: number;
  private readonly blockedWaitSamplesMs: number[];
  private blockedExecutionCount: number;
  private lastBlockedWaitMs: number;

  public constructor() {
    this.tailByThreadId = new Map<string, Promise<void>>();
    this.pendingExecutionCountByThreadId = new Map<string, number>();
    this.inFlightThreadIdSet = new Set<string>();
    this.pendingExecutionCount = 0;
    this.queuedExecutionCount = 0;
    this.completedExecutionCount = 0;
    this.failedExecutionCount = 0;
    this.blockedWaitSamplesMs = [];
    this.blockedExecutionCount = 0;
    this.lastBlockedWaitMs = 0;
  }

  public async runExclusive<ResultType>(
    threadId: string,
    operation: () => Promise<ResultType>,
  ): Promise<ResultType> {
    const normalizedThreadId = this.normalizeThreadId(threadId);
    this.recordQueuedExecution(normalizedThreadId);
    const queuedExecution = this.enqueueThreadExecution(normalizedThreadId);

    try {
      await queuedExecution.previousTail;
      this.recordBlockedWait(queuedExecution);
      this.inFlightThreadIdSet.add(normalizedThreadId);
      const result = await operation();
      this.completedExecutionCount += 1;
      return result;
    } catch (error) {
      this.failedExecutionCount += 1;
      throw error;
    } finally {
      this.finishQueuedExecution(normalizedThreadId, queuedExecution);
    }
  }

  public readStatistics(): ThreadConcurrencyCoordinatorStatistics {
    return {
      queuedExecutionCount: this.queuedExecutionCount,
      completedExecutionCount: this.completedExecutionCount,
      failedExecutionCount: this.failedExecutionCount,
      activeThreadCount: this.pendingExecutionCountByThreadId.size,
      inFlightThreadCount: this.inFlightThreadIdSet.size,
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

  private recordQueuedExecution(threadId: string): void {
    this.queuedExecutionCount += 1;
    this.pendingExecutionCount += 1;
    const currentThreadPendingExecutionCount =
      this.pendingExecutionCountByThreadId.get(threadId) ?? 0;
    this.pendingExecutionCountByThreadId.set(threadId, currentThreadPendingExecutionCount + 1);
  }

  private enqueueThreadExecution(threadId: string): QueuedThreadExecution {
    const enqueuedAtHighResolutionMilliseconds = performance.now();
    const previousTail = this.tailByThreadId.get(threadId) ?? Promise.resolve();
    let releaseCurrentTail: () => void = () => void 0;
    const currentTail = new Promise<void>((resolve) => {
      releaseCurrentTail = resolve;
    });
    const chainedTail = previousTail.then(
      () => currentTail,
      () => currentTail,
    );
    this.tailByThreadId.set(threadId, chainedTail);

    return {
      enqueuedAtHighResolutionMilliseconds,
      previousTail,
      chainedTail,
      releaseCurrentTail,
    };
  }

  private recordBlockedWait(queuedExecution: QueuedThreadExecution): void {
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

  private finishQueuedExecution(threadId: string, queuedExecution: QueuedThreadExecution): void {
    this.inFlightThreadIdSet.delete(threadId);
    this.releaseThreadPendingExecution(threadId);
    this.pendingExecutionCount = Math.max(
      MINIMUM_PENDING_EXECUTION_COUNT,
      this.pendingExecutionCount - 1,
    );
    queuedExecution.releaseCurrentTail();
    this.releaseThreadTailIfCurrent(threadId, queuedExecution.chainedTail);
  }

  private releaseThreadPendingExecution(threadId: string): void {
    const currentThreadPendingExecutionCount = this.pendingExecutionCountByThreadId.get(threadId);
    if (currentThreadPendingExecutionCount === undefined) {
      return;
    }

    if (currentThreadPendingExecutionCount <= SINGLE_PENDING_EXECUTION_COUNT) {
      this.pendingExecutionCountByThreadId.delete(threadId);
      return;
    }

    this.pendingExecutionCountByThreadId.set(threadId, currentThreadPendingExecutionCount - 1);
  }

  private releaseThreadTailIfCurrent(threadId: string, expectedTail: Promise<void>): void {
    if (this.tailByThreadId.get(threadId) === expectedTail) {
      this.tailByThreadId.delete(threadId);
    }
  }

  private normalizeThreadId(threadId: string): string {
    const normalizedThreadId = threadId.trim();
    if (normalizedThreadId.length < MINIMUM_NORMALIZED_THREAD_IDENTIFIER_LENGTH) {
      throw new Error(EMPTY_THREAD_IDENTIFIER_ERROR_MESSAGE);
    }
    return normalizedThreadId;
  }
}
