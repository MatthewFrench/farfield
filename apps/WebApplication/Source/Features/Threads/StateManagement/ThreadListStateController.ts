import { ThreadQueryCache } from "../DataAccess/ThreadQueryCache";
import { ThreadServerClient } from "../DataAccess/ThreadServerClient";
import type { ThreadListLoadOptions, ThreadListResponse } from "../DomainModel/ThreadGroupTypes";
import { ThreadDisplayNameStateOwner } from "./ThreadDisplayNameStateOwner";
import {
  readThreadListCacheKeyForArchiveState,
  ThreadListCacheKeyByName,
} from "./ThreadListCacheKeyContracts";
import {
  type ThreadListPresentationComputationStatsSnapshot,
  type ThreadListPresentationStateInput,
  ThreadListPresentationStateResolver,
  type ThreadListPresentationStateResult,
} from "./ThreadListPresentationStateResolver";
import {
  type InitialThreadSelectionComputationInput,
  ThreadListStateStore,
  type UnreadThreadSelectionUpdateInput,
} from "./ThreadListStateStore";
import { ThreadRefreshConcurrencyCoordinator } from "./ThreadRefreshConcurrencyCoordinator";

const THREAD_LIST_RESPONSE_NOT_TRUNCATED = false;

class InMemoryThreadDisplayNamePreferenceStore {
  public readThreadDisplayName(_threadIdentifier: string): string | null {
    return null;
  }

  public writeThreadDisplayName(_threadIdentifier: string, _threadDisplayName: string): void {
    // Non-browser construction paths keep display names in owner memory only.
  }

  public clearThreadDisplayName(_threadIdentifier: string): void {
    // Non-browser construction paths keep display names in owner memory only.
  }

  public pruneThreadDisplayNames(_retainedThreadIdentifiers: string[]): void {
    // Non-browser construction paths keep display names in owner memory only.
  }
}

export interface LoadActiveThreadStateInput {
  limit: number;
  maxPages: number;
  sortKey: "created_at" | "updated_at";
  previousUnreadThreadIdentifiers: Record<string, true>;
  selectedThreadIdentifier: string | null;
  readFromCache: boolean;
  actionId?: string;
  actionName?: string;
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
  actionId?: string;
  actionName?: string;
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

interface BuildThreadListLoadOptionsInput {
  archived: boolean;
  limit: number;
  maxPages: number;
  sortKey: "created_at" | "updated_at";
  actionId?: string;
  actionName?: string;
}

interface ThreadListActionMetadata {
  actionId?: string;
  actionName?: string;
}

interface LoadThreadListForArchiveModeInput {
  archived: boolean;
  limit: number;
  maxPages: number;
  sortKey: "created_at" | "updated_at";
  readFromCache: boolean;
  actionId?: string;
  actionName?: string;
}

export interface ComputeInitialSelectedThreadIdentifierInput
  extends InitialThreadSelectionComputationInput {}

export interface ComputeUnreadThreadIdentifiersAfterSelectionChangeInput
  extends UnreadThreadSelectionUpdateInput {}

export interface ReadThreadListPresentationStateInput extends ThreadListPresentationStateInput {}
export interface ReadThreadListPresentationStateResult extends ThreadListPresentationStateResult {}
export interface ReadThreadListPresentationComputationStatsSnapshot
  extends ThreadListPresentationComputationStatsSnapshot {}

interface ThreadListStateControllerDependencies {
  threadServerClient: ThreadServerClient;
  threadQueryCache: ThreadQueryCache;
  threadRefreshConcurrencyCoordinator: ThreadRefreshConcurrencyCoordinator;
  threadListStateStore: ThreadListStateStore;
  threadListPresentationStateResolver: ThreadListPresentationStateResolver;
  threadDisplayNameStateOwner?: ThreadDisplayNameStateOwner;
}

export class ThreadListStateController {
  private readonly threadServerClient: ThreadServerClient;
  private readonly threadQueryCache: ThreadQueryCache;
  private readonly threadRefreshConcurrencyCoordinator: ThreadRefreshConcurrencyCoordinator;
  private readonly threadListStateStore: ThreadListStateStore;
  private readonly threadListPresentationStateResolver: ThreadListPresentationStateResolver;
  private readonly threadDisplayNameStateOwner: ThreadDisplayNameStateOwner;
  private activeThreadIdentifiers: Set<string>;
  private archivedThreadIdentifiers: Set<string>;
  private hasLoadedActiveThreadState: boolean;
  private hasLoadedArchivedThreadState: boolean;

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
    this.threadDisplayNameStateOwner =
      dependencies.threadDisplayNameStateOwner ??
      new ThreadDisplayNameStateOwner({
        threadDisplayNamePreferenceStore: new InMemoryThreadDisplayNamePreferenceStore(),
      });
    this.activeThreadIdentifiers = new Set<string>();
    this.archivedThreadIdentifiers = new Set<string>();
    this.hasLoadedActiveThreadState = false;
    this.hasLoadedArchivedThreadState = false;
  }

  public async loadActiveThreadState(
    input: LoadActiveThreadStateInput,
  ): Promise<LoadActiveThreadStateResult> {
    const threadListResult = await this.loadThreadListForArchiveMode({
      archived: false,
      limit: input.limit,
      maxPages: input.maxPages,
      sortKey: input.sortKey,
      readFromCache: input.readFromCache,
      ...this.buildThreadListActionMetadata(input.actionId, input.actionName),
    });

    const stateResult = this.threadListStateStore.computeActiveThreadState({
      nextThreads: threadListResult.response.data,
      previousUnreadThreadIdentifiers: input.previousUnreadThreadIdentifiers,
      selectedThreadIdentifier: input.selectedThreadIdentifier,
    });
    this.recordLoadedThreadIdentifiersForArchiveMode(false, stateResult.nextThreads);

    return {
      didChangeThreads: stateResult.didChangeThreads,
      nextThreads: stateResult.nextThreads,
      nextUnreadThreadIdentifiers: stateResult.nextUnreadThreadIdentifiers,
      loadedFromCache: threadListResult.loadedFromCache,
    };
  }

  public async loadArchivedThreadState(
    input: LoadArchivedThreadStateInput,
  ): Promise<LoadArchivedThreadStateResult> {
    const threadListResult = await this.loadThreadListForArchiveMode({
      archived: true,
      limit: input.limit,
      maxPages: input.maxPages,
      sortKey: input.sortKey,
      readFromCache: input.readFromCache,
      ...this.buildThreadListActionMetadata(input.actionId, input.actionName),
    });

    const stateResult = this.threadListStateStore.computeArchivedThreadState({
      nextArchivedThreads: threadListResult.response.data,
    });
    this.recordLoadedThreadIdentifiersForArchiveMode(true, stateResult.nextArchivedThreads);

    return {
      didChangeArchivedThreads: stateResult.didChangeArchivedThreads,
      nextArchivedThreads: stateResult.nextArchivedThreads,
      isTruncated: this.readThreadListIsTruncated(threadListResult.response),
      loadedFromCache: threadListResult.loadedFromCache,
    };
  }

  public invalidateActiveThreadQuery(): void {
    this.threadQueryCache.invalidate(ThreadListCacheKeyByName.activeThreads);
  }

  public invalidateArchivedThreadQuery(): void {
    this.threadQueryCache.invalidate(ThreadListCacheKeyByName.archivedThreads);
  }

  public invalidateThreadQueries(): void {
    this.invalidateActiveThreadQuery();
    this.invalidateArchivedThreadQuery();
  }

  public computeInitialSelectedThreadIdentifier(
    input: ComputeInitialSelectedThreadIdentifierInput,
  ): string | null {
    return this.threadListStateStore.computeInitialSelectedThreadIdentifier(input);
  }

  public computeUnreadThreadIdentifiersAfterSelectionChange(
    input: ComputeUnreadThreadIdentifiersAfterSelectionChangeInput,
  ): Record<string, true> {
    return this.threadListStateStore.computeUnreadThreadIdentifiersAfterSelectionChange(input);
  }

  public readThreadListPresentationState(
    input: ReadThreadListPresentationStateInput,
  ): ReadThreadListPresentationStateResult {
    return this.threadListPresentationStateResolver.readState(input);
  }

  public readThreadListPresentationComputationStats(): ReadThreadListPresentationComputationStatsSnapshot {
    return this.threadListPresentationStateResolver.readComputationStatsSnapshot();
  }

  public resetState(): void {
    this.threadListStateStore.resetState();
    this.activeThreadIdentifiers.clear();
    this.archivedThreadIdentifiers.clear();
    this.hasLoadedActiveThreadState = false;
    this.hasLoadedArchivedThreadState = false;
  }

  private buildThreadListLoadOptions(
    input: BuildThreadListLoadOptionsInput,
  ): ThreadListLoadOptions {
    const loadOptions: ThreadListLoadOptions = {
      archived: input.archived,
      limit: input.limit,
      maxPages: input.maxPages,
      sortKey: input.sortKey,
    };
    if (input.actionId !== undefined && input.actionId.length > 0) {
      loadOptions.actionId = input.actionId;
    }
    if (input.actionName !== undefined && input.actionName.length > 0) {
      loadOptions.actionName = input.actionName;
    }
    return loadOptions;
  }

  private readThreadListIsTruncated(response: ThreadListResponse): boolean {
    return (
      (response.truncated ?? THREAD_LIST_RESPONSE_NOT_TRUNCATED) || response.nextCursor !== null
    );
  }

  private async loadThreadListForArchiveMode(
    input: LoadThreadListForArchiveModeInput,
  ): Promise<LoadThreadListResult> {
    const loadOptions = this.buildThreadListLoadOptions({
      archived: input.archived,
      limit: input.limit,
      maxPages: input.maxPages,
      sortKey: input.sortKey,
      ...this.buildThreadListActionMetadata(input.actionId, input.actionName),
    });
    return this.loadThreadList(
      readThreadListCacheKeyForArchiveState(input.archived),
      loadOptions,
      input.readFromCache,
    );
  }

  private buildThreadListActionMetadata(
    actionId: string | undefined,
    actionName: string | undefined,
  ): ThreadListActionMetadata {
    const actionMetadata: ThreadListActionMetadata = {};
    if (actionId !== undefined && actionId.length > 0) {
      actionMetadata.actionId = actionId;
    }
    if (actionName !== undefined && actionName.length > 0) {
      actionMetadata.actionName = actionName;
    }
    return actionMetadata;
  }

  private async loadThreadList(
    cacheKey: string,
    loadOptions: ThreadListLoadOptions,
    readFromCache: boolean,
  ): Promise<LoadThreadListResult> {
    if (readFromCache) {
      const cachedResponse = this.threadQueryCache.readFresh(cacheKey);
      if (cachedResponse) {
        const cachedResponseWithDisplayNames =
          this.applyDisplayNamesToThreadListResponse(cachedResponse);
        if (cachedResponseWithDisplayNames !== cachedResponse) {
          this.threadQueryCache.write(cacheKey, cachedResponseWithDisplayNames);
        }
        return {
          response: cachedResponseWithDisplayNames,
          loadedFromCache: true,
        };
      }
    }

    const response = await this.threadRefreshConcurrencyCoordinator.runSingleFlight(
      cacheKey,
      async () => {
        const nextResponse = await this.threadServerClient.listThreads(loadOptions);
        const responseWithDisplayNames = this.applyDisplayNamesToThreadListResponse(nextResponse);
        this.threadQueryCache.write(cacheKey, responseWithDisplayNames);
        return responseWithDisplayNames;
      },
    );

    return {
      response,
      loadedFromCache: false,
    };
  }

  private applyDisplayNamesToThreadListResponse(response: ThreadListResponse): ThreadListResponse {
    const nextThreadListItems = this.threadDisplayNameStateOwner.applyDisplayNamesToThreadList(
      response.data,
    );
    if (nextThreadListItems === response.data) {
      return response;
    }
    return {
      ...response,
      data: nextThreadListItems,
    };
  }

  private recordLoadedThreadIdentifiersForArchiveMode(
    archived: boolean,
    threads: ThreadListResponse["data"],
  ): void {
    const nextThreadIdentifiers = new Set(threads.map((thread) => thread.id));
    if (archived) {
      this.archivedThreadIdentifiers = nextThreadIdentifiers;
      this.hasLoadedArchivedThreadState = true;
    } else {
      this.activeThreadIdentifiers = nextThreadIdentifiers;
      this.hasLoadedActiveThreadState = true;
    }
    this.pruneThreadDisplayNamesWhenThreadListsLoaded();
  }

  private pruneThreadDisplayNamesWhenThreadListsLoaded(): void {
    if (!this.hasLoadedActiveThreadState || !this.hasLoadedArchivedThreadState) {
      return;
    }
    this.threadDisplayNameStateOwner.pruneThreadDisplayNames([
      ...this.activeThreadIdentifiers,
      ...this.archivedThreadIdentifiers,
    ]);
  }
}
