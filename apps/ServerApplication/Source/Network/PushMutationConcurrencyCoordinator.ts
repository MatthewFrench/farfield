export interface PushMutationConcurrencyCoordinatorStatistics {
  queuedExecutionCount: number;
  completedExecutionCount: number;
  failedExecutionCount: number;
  hasInFlightOperation: boolean;
}

export class PushMutationConcurrencyCoordinator {
  private executionTail: Promise<void>;
  private queuedExecutionCount: number;
  private completedExecutionCount: number;
  private failedExecutionCount: number;

  public constructor() {
    this.executionTail = Promise.resolve();
    this.queuedExecutionCount = 0;
    this.completedExecutionCount = 0;
    this.failedExecutionCount = 0;
  }

  public async runExclusive<ResultType>(
    operation: () => Promise<ResultType>
  ): Promise<ResultType> {
    this.queuedExecutionCount += 1;

    const previousTail = this.executionTail;
    let releaseCurrentTail: () => void = () => {};
    const currentTail = new Promise<void>((resolve) => {
      releaseCurrentTail = resolve;
    });
    this.executionTail = previousTail.then(() => currentTail);

    await previousTail;
    try {
      const result = await operation();
      this.completedExecutionCount += 1;
      return result;
    } catch (error) {
      this.failedExecutionCount += 1;
      throw error;
    } finally {
      releaseCurrentTail();
    }
  }

  public readStatistics(): PushMutationConcurrencyCoordinatorStatistics {
    return {
      queuedExecutionCount: this.queuedExecutionCount,
      completedExecutionCount: this.completedExecutionCount,
      failedExecutionCount: this.failedExecutionCount,
      hasInFlightOperation: this.queuedExecutionCount > (this.completedExecutionCount + this.failedExecutionCount)
    };
  }
}
