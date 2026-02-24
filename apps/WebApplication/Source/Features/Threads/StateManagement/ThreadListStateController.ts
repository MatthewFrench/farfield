import { ThreadServerClient } from "../DataAccess/ThreadServerClient";
import { ThreadQueryCache } from "../DataAccess/ThreadQueryCache";
import type { ThreadListLoadOptions, ThreadListResponse } from "../DomainModel/ThreadGroupTypes";
import { ThreadRefreshConcurrencyCoordinator } from "./ThreadRefreshConcurrencyCoordinator";
import {
  ThreadListPresentationStateResolver,
  type ThreadListPresentationStateInput,
  type ThreadListPresentationStateResult
} from "./ThreadListPresentationStateResolver";
import {
  ThreadListStateStore,
  type InitialThreadSelectionComputationInput,
  type UnreadThreadSelectionUpdateInput
} from "./ThreadListStateStore";

const ACTIVE_THREADS_CACHE_KEY = "threads:active";
const ARCHIVED_THREADS_CACHE_KEY = "threads:archived";

export interface LoadActiveThreadStateInput {
  limit: number;
  maxPages: number;
  sortKey: "created_at" | "updated_at";
  previousUnreadThreadIdentifiers: Record<string, true>;
  selectedThreadIdentifier: string | null;
  readFromCache: boolean;
}

export interface LoadActiveThreadStateResult {
  didChangeThreads: boolean;
  nextThreads: ThreadListResponse["data"];
  nextUnreadThreadIdentifiers: Record<string, true>;
  // Indicates the read was served from the in-memory query cache.
  loadedFromCache: boolean;
}

export interface LoadArchivedThreadStateInput {
  limit: number;
  maxPages: number;
  sortKey: "created_at" | "updated_at";
  readFromCache: boolean;
}

export interface LoadArchivedThreadStateResult {
  didChangeArchivedThreads: boolean;
  nextArchivedThreads: ThreadListResponse["data"];
  isTruncated: boolean;
  // Indicates the read was served from the in-memory query cache.
  loadedFromCache: boolean;
}

interface LoadThreadListResult {
  response: ThreadListResponse;
  loadedFromCache: boolean;
}

export interface ComputeInitialSelectedThreadIdentifierInput
  extends InitialThreadSelectionComputationInput {}

export interface ComputeUnreadThreadIdentifiersAfterSelectionChangeInput
  extends UnreadThreadSelectionUpdateInput {}

export interface ReadThreadListPresentationStateInput extends ThreadListPresentationStateInput {}
export interface ReadThreadListPresentationStateResult extends ThreadListPresentationStateResult {}

interface ThreadListStateControllerDependencies {
  threadServerClient: ThreadServerClient;
  threadQueryCache: ThreadQueryCache;
  threadRefreshConcurrencyCoordinator: ThreadRefreshConcurrencyCoordinator;
  threadListStateStore: ThreadListStateStore;
  threadListPresentationStateResolver: ThreadListPresentationStateResolver;
}

export class ThreadListStateController {
  private readonly threadServerClient: ThreadServerClient;
  private readonly threadQueryCache: ThreadQueryCache;
  private readonly threadRefreshConcurrencyCoordinator: ThreadRefreshConcurrencyCoordinator;
  private readonly threadListStateStore: ThreadListStateStore;
  private readonly threadListPresentationStateResolver: ThreadListPresentationStateResolver;

  /**
   * Owns active and archived thread list loading policy, including cache keys and
   * mutation-scoped invalidation boundaries consumed by action coordinators.
   */
  public constructor(dependencies: ThreadListStateControllerDependencies) {
    this.threadServerClient = dependencies.threadServerClient;
    this.threadQueryCache = dependencies.threadQueryCache;
    this.threadRefreshConcurrencyCoordinator = dependencies.threadRefreshConcurrencyCoordinator;
    this.threadListStateStore = dependencies.threadListStateStore;
    this.threadListPresentationStateResolver = dependencies.threadListPresentationStateResolver;
  }

  public async loadActiveThreadState(input: LoadActiveThreadStateInput): Promise<LoadActiveThreadStateResult> {
    const threadListResult = await this.loadThreadList(
      ACTIVE_THREADS_CACHE_KEY,
      {
        archived: false,
        limit: input.limit,
        maxPages: input.maxPages,
        sortKey: input.sortKey
      },
      input.readFromCache
    );

    const stateResult = this.threadListStateStore.computeActiveThreadState({
      nextThreads: threadListResult.response.data,
      previousUnreadThreadIdentifiers: input.previousUnreadThreadIdentifiers,
      selectedThreadIdentifier: input.selectedThreadIdentifier
    });

    return {
      didChangeThreads: stateResult.didChangeThreads,
      nextThreads: stateResult.nextThreads,
      nextUnreadThreadIdentifiers: stateResult.nextUnreadThreadIdentifiers,
      loadedFromCache: threadListResult.loadedFromCache
    };
  }

  public async loadArchivedThreadState(input: LoadArchivedThreadStateInput): Promise<LoadArchivedThreadStateResult> {
    const threadListResult = await this.loadThreadList(
      ARCHIVED_THREADS_CACHE_KEY,
      {
        archived: true,
        limit: input.limit,
        maxPages: input.maxPages,
        sortKey: input.sortKey
      },
      input.readFromCache
    );

    const stateResult = this.threadListStateStore.computeArchivedThreadState({
      nextArchivedThreads: threadListResult.response.data
    });

    return {
      didChangeArchivedThreads: stateResult.didChangeArchivedThreads,
      nextArchivedThreads: stateResult.nextArchivedThreads,
      isTruncated: (
        (threadListResult.response.truncated ?? false)
        || threadListResult.response.nextCursor !== null
      ),
      loadedFromCache: threadListResult.loadedFromCache
    };
  }

  public invalidateActiveThreadQuery(): void {
    this.threadQueryCache.invalidate(ACTIVE_THREADS_CACHE_KEY);
  }

  public invalidateArchivedThreadQuery(): void {
    this.threadQueryCache.invalidate(ARCHIVED_THREADS_CACHE_KEY);
  }

  public invalidateThreadQueries(): void {
    this.invalidateActiveThreadQuery();
    this.invalidateArchivedThreadQuery();
  }

  public computeInitialSelectedThreadIdentifier(
    input: ComputeInitialSelectedThreadIdentifierInput
  ): string | null {
    return this.threadListStateStore.computeInitialSelectedThreadIdentifier(input);
  }

  public computeUnreadThreadIdentifiersAfterSelectionChange(
    input: ComputeUnreadThreadIdentifiersAfterSelectionChangeInput
  ): Record<string, true> {
    return this.threadListStateStore.computeUnreadThreadIdentifiersAfterSelectionChange(input);
  }

  public readThreadListPresentationState(
    input: ReadThreadListPresentationStateInput
  ): ReadThreadListPresentationStateResult {
    return this.threadListPresentationStateResolver.readState(input);
  }

  public resetState(): void {
    this.threadListStateStore.resetState();
  }

  private async loadThreadList(
    cacheKey: string,
    loadOptions: ThreadListLoadOptions,
    readFromCache: boolean
  ): Promise<LoadThreadListResult> {
    if (readFromCache) {
      const cachedResponse = this.threadQueryCache.readFresh(cacheKey);
      if (cachedResponse) {
        return {
          response: cachedResponse,
          loadedFromCache: true
        };
      }
    }

    const response = await this.threadRefreshConcurrencyCoordinator.runSingleFlight(cacheKey, async () => {
      const nextResponse = await this.threadServerClient.listThreads(loadOptions);
      this.threadQueryCache.write(cacheKey, nextResponse);
      return nextResponse;
    });

    return {
      response,
      loadedFromCache: false
    };
  }
}
