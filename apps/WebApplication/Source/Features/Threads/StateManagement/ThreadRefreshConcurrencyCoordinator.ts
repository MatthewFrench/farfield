import type { ThreadListResponse } from "../DomainModel/ThreadGroupTypes";

/**
 * Owns single-flight coordination for thread-list refresh reads.
 * Equal request keys share one in-flight promise so list refresh bursts avoid duplicate transport work.
 */
export class ThreadRefreshConcurrencyCoordinator {
  private readonly inFlightRequestByKey: Map<string, Promise<ThreadListResponse>>;

  public constructor() {
    this.inFlightRequestByKey = new Map<string, Promise<ThreadListResponse>>();
  }

  public async runSingleFlight(
    requestKey: string,
    task: () => Promise<ThreadListResponse>,
  ): Promise<ThreadListResponse> {
    const existingInFlightRequest = this.inFlightRequestByKey.get(requestKey);
    if (existingInFlightRequest) {
      return existingInFlightRequest;
    }

    const inFlightRequest = this.trackInFlightRequest(requestKey, task);
    this.inFlightRequestByKey.set(requestKey, inFlightRequest);
    return inFlightRequest;
  }

  private trackInFlightRequest(
    requestKey: string,
    task: () => Promise<ThreadListResponse>,
  ): Promise<ThreadListResponse> {
    return task().finally(() => {
      this.inFlightRequestByKey.delete(requestKey);
    });
  }
}
