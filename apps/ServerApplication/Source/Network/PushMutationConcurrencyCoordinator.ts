export interface PushMutationConcurrencyCoordinatorStatistics {
  queuedExecutionCount: number;
  completedExecutionCount: number;
  failedExecutionCount: number;
  hasInFlightOperation: boolean;
}

const MINIMUM_PENDING_EXECUTION_COUNT = 0;

interface QueuedExecution {
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

  public constructor() {
    this.executionTail = Promise.resolve();
    this.pendingExecutionCount = 0;
    this.queuedExecutionCount = 0;
    this.completedExecutionCount = 0;
    this.failedExecutionCount = 0;
  }

  public async runExclusive<ResultType>(operation: () => Promise<ResultType>): Promise<ResultType> {
    this.recordQueuedExecution();
    const queuedExecution = this.enqueueExecution();
    try {
      await queuedExecution.previousTail;
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
    };
  }

  private recordQueuedExecution(): void {
    this.queuedExecutionCount += 1;
    this.pendingExecutionCount += 1;
  }

  private enqueueExecution(): QueuedExecution {
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
      previousTail,
      releaseCurrentTail,
    };
  }

  private finishQueuedExecution(queuedExecution: QueuedExecution): void {
    this.pendingExecutionCount = Math.max(
      MINIMUM_PENDING_EXECUTION_COUNT,
      this.pendingExecutionCount - 1,
    );
    queuedExecution.releaseCurrentTail();
  }
}
