import type { ThreadListLoadOptions, ThreadListResponse } from "../DomainModel/ThreadGroupTypes";
import { type ApiListThreadsOptions, listThreads } from "./ThreadApi";
import {
  type ApiThreadSidebarSyncInput,
  type ApiThreadSidebarSyncResult,
  syncSidebarThreadList,
} from "./ThreadSidebarSyncApi";

const LIST_ALL_THREADS_REQUEST_FLAG = true;

/**
 * Owns thread collection reads from the HTTP boundary.
 * Caching and invalidation policy live in thread state owners, not this transport adapter.
 */
export class ThreadServerClient {
  public async listThreads(options: ThreadListLoadOptions): Promise<ThreadListResponse> {
    return listThreads(this.buildListThreadsRequestOptions(options));
  }

  public async syncSidebarThreadList(options: {
    archived: boolean;
    limit: number;
    maxPages: number;
    sortKey: "created_at" | "updated_at";
    cwd?: string;
    signal?: AbortSignal;
    actionId?: string;
    actionName?: string;
    knownSnapshotVersion: string | null;
  }): Promise<ApiThreadSidebarSyncResult> {
    return syncSidebarThreadList(this.buildThreadSidebarSyncRequestOptions(options));
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

  private buildThreadSidebarSyncRequestOptions(options: {
    archived: boolean;
    limit: number;
    maxPages: number;
    sortKey: "created_at" | "updated_at";
    cwd?: string;
    signal?: AbortSignal;
    actionId?: string;
    actionName?: string;
    knownSnapshotVersion: string | null;
  }): ApiThreadSidebarSyncInput {
    const requestOptions: ApiThreadSidebarSyncInput = {
      archived: options.archived,
      limit: options.limit,
      maxPages: options.maxPages,
      sortKey: options.sortKey,
      knownSnapshotVersion: options.knownSnapshotVersion,
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
    return requestOptions;
  }
}
