export interface SelectedThreadRefreshRequest {
  threadId: string;
  includeTurns: boolean;
  includeReadThread: boolean;
}

export interface SelectedThreadRefreshRunInput {
  request: SelectedThreadRefreshRequest;
  executeRefresh: (
    request: SelectedThreadRefreshRequest,
    signal: AbortSignal
  ) => Promise<void>;
  isCanceledError: (error: Error) => boolean;
}

export class SelectedThreadRefreshConcurrencyCoordinator {
  private inFlightRefresh: Promise<void> | null;
  private queuedRefreshRequest: SelectedThreadRefreshRequest | null;
  private activeRefreshAbortController: AbortController | null;
  private activeThreadId: string | null;

  public constructor() {
    this.inFlightRefresh = null;
    this.queuedRefreshRequest = null;
    this.activeRefreshAbortController = null;
    this.activeThreadId = null;
  }

  public cancelActiveRefresh(): void {
    this.activeRefreshAbortController?.abort();
  }

  public async run(input: SelectedThreadRefreshRunInput): Promise<void> {
    if (this.inFlightRefresh) {
      this.queuedRefreshRequest = this.queuedRefreshRequest
        ? this.mergeRequests(this.queuedRefreshRequest, input.request)
        : input.request;
      if (this.activeThreadId && this.activeThreadId !== input.request.threadId) {
        this.activeRefreshAbortController?.abort();
      }
      await this.inFlightRefresh;
      return;
    }

    const runQueue = async (): Promise<void> => {
      let nextRequest: SelectedThreadRefreshRequest | null = input.request;
      while (nextRequest) {
        this.queuedRefreshRequest = null;
        this.activeThreadId = nextRequest.threadId;

        const abortController = new AbortController();
        this.activeRefreshAbortController = abortController;

        try {
          await input.executeRefresh(nextRequest, abortController.signal);
        } catch (error) {
          if (
            error instanceof Error
            && input.isCanceledError(error)
            && this.queuedRefreshRequest
          ) {
            nextRequest = this.queuedRefreshRequest;
            continue;
          }
          throw error;
        }

        nextRequest = this.queuedRefreshRequest;
      }
    };

    const inFlightRefresh = runQueue().finally(() => {
      this.reset();
    });
    this.inFlightRefresh = inFlightRefresh;
    await inFlightRefresh;
  }

  private mergeRequests(
    existing: SelectedThreadRefreshRequest,
    incoming: SelectedThreadRefreshRequest
  ): SelectedThreadRefreshRequest {
    if (existing.threadId !== incoming.threadId) {
      return incoming;
    }

    return {
      threadId: existing.threadId,
      includeTurns: existing.includeTurns || incoming.includeTurns,
      includeReadThread: existing.includeReadThread || incoming.includeReadThread
    };
  }

  private reset(): void {
    this.inFlightRefresh = null;
    this.queuedRefreshRequest = null;
    this.activeRefreshAbortController = null;
    this.activeThreadId = null;
  }
}
