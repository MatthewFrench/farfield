import { listThreads, type ApiListThreadsOptions } from "./ThreadApi";
import type { ThreadListLoadOptions, ThreadListResponse } from "../DomainModel/ThreadGroupTypes";

export class ThreadServerClient {
  public async listThreads(options: ThreadListLoadOptions): Promise<ThreadListResponse> {
    const requestOptions: ApiListThreadsOptions = {
      limit: options.limit,
      archived: options.archived,
      all: true,
      maxPages: options.maxPages
    };

    if (options.sortKey) {
      requestOptions.sortKey = options.sortKey;
    }
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

    return listThreads(requestOptions);
  }
}
