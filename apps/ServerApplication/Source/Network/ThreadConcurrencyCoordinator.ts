const EMPTY_THREAD_IDENTIFIER_ERROR_MESSAGE = "ThreadConcurrencyCoordinator requires non-empty threadId";

export interface ThreadConcurrencyCoordinatorStatistics {
  queuedExecutionCount: number;
  completedExecutionCount: number;
  failedExecutionCount: number;
  activeThreadCount: number;
}

export class ThreadConcurrencyCoordinator {
  private readonly tailByThreadId: Map<string, Promise<void>>;
  private queuedExecutionCount: number;
  private completedExecutionCount: number;
  private failedExecutionCount: number;

  public constructor() {
    this.tailByThreadId = new Map<string, Promise<void>>();
    this.queuedExecutionCount = 0;
    this.completedExecutionCount = 0;
    this.failedExecutionCount = 0;
  }

  public async runExclusive<ResultType>(
    threadId: string,
    operation: () => Promise<ResultType>
  ): Promise<ResultType> {
    const normalizedThreadId = this.normalizeThreadId(threadId);

    this.queuedExecutionCount += 1;

    const previousTail = this.tailByThreadId.get(normalizedThreadId) ?? Promise.resolve();
    let releaseCurrentTail: () => void = () => {};
    const currentTail = new Promise<void>((resolve) => {
      releaseCurrentTail = resolve;
    });
    const chainedTail = previousTail.then(() => currentTail);
    this.tailByThreadId.set(normalizedThreadId, chainedTail);

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

      if (this.tailByThreadId.get(normalizedThreadId) === chainedTail) {
        this.tailByThreadId.delete(normalizedThreadId);
      }
    }
  }

  public readStatistics(): ThreadConcurrencyCoordinatorStatistics {
    return {
      queuedExecutionCount: this.queuedExecutionCount,
      completedExecutionCount: this.completedExecutionCount,
      failedExecutionCount: this.failedExecutionCount,
      activeThreadCount: this.tailByThreadId.size
    };
  }

  private normalizeThreadId(threadId: string): string {
    const normalizedThreadId = threadId.trim();
    if (normalizedThreadId.length === 0) {
      throw new Error(EMPTY_THREAD_IDENTIFIER_ERROR_MESSAGE);
    }
    return normalizedThreadId;
  }
}
