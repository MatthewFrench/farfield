import { listThreads, type ApiListThreadsOptions } from "./ThreadApi";
import type { ThreadListLoadOptions, ThreadListResponse } from "../DomainModel/ThreadGroupTypes";

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
      sortKey: options.sortKey
    };
    if (options.cwd) {
      requestOptions.cwd = options.cwd;
    }
    if (options.signal) {
      requestOptions.signal = options.signal;
    }
    if (options.actionId) {
      requestOptions.actionId = options.actionId;
    }
    if (options.actionName) {
      requestOptions.actionName = options.actionName;
    }
    return requestOptions;
  }
}
