import type { ThreadListResponse } from "../DomainModel/ThreadGroupTypes";

export class ThreadRefreshConcurrencyCoordinator {
  private readonly inFlightRequestByKey: Map<string, Promise<ThreadListResponse>>;

  public constructor() {
    this.inFlightRequestByKey = new Map<string, Promise<ThreadListResponse>>();
  }

  public async runSingleFlight(
    requestKey: string,
    task: () => Promise<ThreadListResponse>
  ): Promise<ThreadListResponse> {
    const existingInFlightRequest = this.inFlightRequestByKey.get(requestKey);
    if (existingInFlightRequest) {
      return existingInFlightRequest;
    }

    const inFlightRequest = task().finally(() => {
      this.inFlightRequestByKey.delete(requestKey);
    });
    this.inFlightRequestByKey.set(requestKey, inFlightRequest);
    return inFlightRequest;
  }
}
