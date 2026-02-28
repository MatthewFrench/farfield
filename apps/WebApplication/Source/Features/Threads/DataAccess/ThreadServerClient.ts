import type { ThreadListLoadOptions, ThreadListResponse } from "../DomainModel/ThreadGroupTypes";
import { type ApiListThreadsOptions, listThreads } from "./ThreadApi";

const LIST_ALL_THREADS_REQUEST_FLAG = true;

/**
 * Owns thread collection reads from the HTTP boundary.
 * Caching and invalidation policy live in thread state owners, not this transport adapter.
 */
export class ThreadServerClient {
  public async listThreads(options: ThreadListLoadOptions): Promise<ThreadListResponse> {
    return listThreads(this.buildListThreadsRequestOptions(options));
  }

  private buildListThreadsRequestOptions(options: ThreadListLoadOptions): ApiListThreadsOptions {
    const requestOptions: ApiListThreadsOptions = {
      limit: options.limit,
      archived: options.archived,
      all: LIST_ALL_THREADS_REQUEST_FLAG,
      maxPages: options.maxPages,
      sortKey: options.sortKey,
    };
    if (options.cwd !== undefined && options.cwd.length > 0) {
      requestOptions.cwd = options.cwd;
    }
    if (options.signal) {
      requestOptions.signal = options.signal;
    }
    if (options.actionId !== undefined && options.actionId.length > 0) {
      requestOptions.actionId = options.actionId;
    }
    if (options.actionName !== undefined && options.actionName.length > 0) {
      requestOptions.actionName = options.actionName;
    }
    if (options.sinceUpdatedAt !== undefined) {
      requestOptions.sinceUpdatedAt = options.sinceUpdatedAt;
    }
    return requestOptions;
  }
}
