import { describe, expect, it } from "vitest";
import { type ThreadListSnapshotPersistenceStore } from "@/Features/Threads/DataAccess/ThreadListSnapshotIndexedDatabaseStore";
import { ThreadQueryCache } from "@/Features/Threads/DataAccess/ThreadQueryCache";
import { ThreadServerClient } from "@/Features/Threads/DataAccess/ThreadServerClient";
import type {
  ThreadListItem,
  ThreadListLoadOptions,
  ThreadListResponse,
} from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import {
  type ThreadDisplayNamePersistenceStore,
  ThreadDisplayNameStateOwner,
} from "@/Features/Threads/StateManagement/ThreadDisplayNameStateOwner";
import { ThreadListCacheKeyByName } from "@/Features/Threads/StateManagement/ThreadListCacheKeyContracts";
import { ThreadListPresentationStateResolver } from "@/Features/Threads/StateManagement/ThreadListPresentationStateResolver";
import { ThreadListStateController } from "@/Features/Threads/StateManagement/ThreadListStateController";
import { ThreadListStateStore } from "@/Features/Threads/StateManagement/ThreadListStateStore";
import { ThreadRefreshConcurrencyCoordinator } from "@/Features/Threads/StateManagement/ThreadRefreshConcurrencyCoordinator";

function buildThreadListResponse(input: {
  threadOneUpdatedAt: number;
  threadTwoUpdatedAt: number;
}): ThreadListResponse {
  return {
    data: [
      {
        id: "thread-1",
        preview: "Thread one",
        createdAt: 1_700_000_000,
        updatedAt: input.threadOneUpdatedAt,
        cwd: "/tmp/project",
        source: "opencode",
        agentId: "opencode",
      },
      {
        id: "thread-2",
        preview: "Thread two",
        createdAt: 1_700_000_010,
        updatedAt: input.threadTwoUpdatedAt,
        cwd: "/tmp/project",
        source: "opencode",
        agentId: "opencode",
      },
    ],
    nextCursor: null,
    pages: 1,
    truncated: false,
  };
}

function buildThreadListResponseFromThreadIdentifiers(
  threadIdentifiers: string[],
  updatedAtSeed: number,
): ThreadListResponse {
  return {
    data: threadIdentifiers.map((threadIdentifier, index) => ({
      id: threadIdentifier,
      preview: `Thread ${threadIdentifier}`,
      createdAt: updatedAtSeed + index,
      updatedAt: updatedAtSeed + index + 1,
      cwd: "/tmp/project",
      source: "opencode",
      agentId: "opencode",
    })),
    nextCursor: null,
    pages: 1,
    truncated: false,
  };
}

class TestThreadServerClient extends ThreadServerClient {
  private readonly responseByArchiveMode: {
    active: ThreadListResponse;
    archived: ThreadListResponse;
  };
  private listRequestCount: number;
  private readonly listRequestOptions: ThreadListLoadOptions[];

  public constructor(input: {
    active: ThreadListResponse;
    archived: ThreadListResponse;
  }) {
    super();
    this.responseByArchiveMode = {
      active: input.active,
      archived: input.archived,
    };
    this.listRequestCount = 0;
    this.listRequestOptions = [];
  }

  public getListRequestCount(): number {
    return this.listRequestCount;
  }

  public readListRequestOptions(): ThreadListLoadOptions[] {
    return this.listRequestOptions;
  }

  public override async listThreads(options: ThreadListLoadOptions): Promise<ThreadListResponse> {
    this.listRequestCount += 1;
    this.listRequestOptions.push({ ...options });
    return options.archived
      ? this.responseByArchiveMode.archived
      : this.responseByArchiveMode.active;
  }
}

class TestThreadDisplayNamePreferenceStore implements ThreadDisplayNamePersistenceStore {
  private readonly pruneCalls: string[][];

  public constructor() {
    this.pruneCalls = [];
  }

  public readThreadDisplayName(_threadIdentifier: string): string | null {
    return null;
  }

  public writeThreadDisplayName(_threadIdentifier: string, _threadDisplayName: string): void {}

  public clearThreadDisplayName(_threadIdentifier: string): void {}

  public pruneThreadDisplayNames(retainedThreadIdentifiers: string[]): void {
    this.pruneCalls.push([...retainedThreadIdentifiers]);
  }

  public readPruneCalls(): string[][] {
    return this.pruneCalls.map((call) => [...call]);
  }
}

class TestThreadListSnapshotPersistenceStore implements ThreadListSnapshotPersistenceStore {
  private readonly snapshotByCacheKey = new Map<string, ThreadListResponse>();

  public async readThreadListSnapshot(cacheKey: string): Promise<ThreadListResponse | null> {
    return this.snapshotByCacheKey.get(cacheKey) ?? null;
  }

  public async writeThreadListSnapshot(
    cacheKey: string,
    response: ThreadListResponse,
  ): Promise<void> {
    this.snapshotByCacheKey.set(cacheKey, response);
  }

  public async clearThreadListSnapshot(cacheKey: string): Promise<void> {
    this.snapshotByCacheKey.delete(cacheKey);
  }
}

class SequencedThreadServerClient extends ThreadServerClient {
  private readonly queuedResponses: ThreadListResponse[];
  private readonly listRequestOptions: ThreadListLoadOptions[];

  public constructor(queuedResponses: ThreadListResponse[]) {
    super();
    this.queuedResponses = [...queuedResponses];
    this.listRequestOptions = [];
  }

  public readListRequestOptions(): ThreadListLoadOptions[] {
    return [...this.listRequestOptions];
  }

  public override async listThreads(options: ThreadListLoadOptions): Promise<ThreadListResponse> {
    this.listRequestOptions.push({ ...options });
    const nextResponse = this.queuedResponses.shift();
    if (!nextResponse) {
      throw new Error("Expected queued thread-list response");
    }
    return nextResponse;
  }
}

describe("Thread ownership modules", () => {
  it("ThreadQueryCache stores and invalidates entries", () => {
    const cache = new ThreadQueryCache(1_000, 4);
    const response = buildThreadListResponse({
      threadOneUpdatedAt: 1_700_000_000,
      threadTwoUpdatedAt: 1_700_000_001,
    });

    expect(cache.readFresh(ThreadListCacheKeyByName.activeThreads)).toBeNull();
    cache.write(ThreadListCacheKeyByName.activeThreads, response);
    expect(cache.readFresh(ThreadListCacheKeyByName.activeThreads)).toEqual(response);
    cache.invalidate(ThreadListCacheKeyByName.activeThreads);
    expect(cache.readFresh(ThreadListCacheKeyByName.activeThreads)).toBeNull();
  });

  it("ThreadQueryCache enforces maximum entries with least-recently-used eviction", () => {
    const cache = new ThreadQueryCache(10_000, 2);
    const response = buildThreadListResponse({
      threadOneUpdatedAt: 1_700_000_000,
      threadTwoUpdatedAt: 1_700_000_001,
    });

    cache.write(ThreadListCacheKeyByName.activeThreads, response);
    cache.write(ThreadListCacheKeyByName.archivedThreads, response);
    expect(cache.readFresh(ThreadListCacheKeyByName.activeThreads)).toEqual(response);

    cache.write("threads:removed-projects", response);

    expect(cache.readFresh(ThreadListCacheKeyByName.activeThreads)).toEqual(response);
    expect(cache.readFresh(ThreadListCacheKeyByName.archivedThreads)).toBeNull();
    expect(cache.readFresh("threads:removed-projects")).toEqual(response);
  });

  it("ThreadRefreshConcurrencyCoordinator coalesces same-key requests", async () => {
    const coordinator = new ThreadRefreshConcurrencyCoordinator();
    const response = buildThreadListResponse({
      threadOneUpdatedAt: 1_700_000_000,
      threadTwoUpdatedAt: 1_700_000_001,
    });
    let callCount = 0;
    const task = async (): Promise<ThreadListResponse> => {
      callCount += 1;
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10);
      });
      return response;
    };

    const [first, second] = await Promise.all([
      coordinator.runSingleFlight(ThreadListCacheKeyByName.activeThreads, task),
      coordinator.runSingleFlight(ThreadListCacheKeyByName.activeThreads, task),
    ]);

    expect(callCount).toBe(1);
    expect(first).toEqual(response);
    expect(second).toEqual(response);
  });

  it("ThreadListStateStore computes unread identifiers when thread timestamps increase", () => {
    const store = new ThreadListStateStore();

    const first = store.computeActiveThreadState({
      nextThreads: buildThreadListResponse({
        threadOneUpdatedAt: 1_700_000_000,
        threadTwoUpdatedAt: 1_700_000_001,
      }).data,
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: "thread-1",
    });
    expect(first.nextUnreadThreadIdentifiers).toEqual({});

    const second = store.computeActiveThreadState({
      nextThreads: buildThreadListResponse({
        threadOneUpdatedAt: 1_700_000_000,
        threadTwoUpdatedAt: 1_700_000_010,
      }).data,
      previousUnreadThreadIdentifiers: first.nextUnreadThreadIdentifiers,
      selectedThreadIdentifier: "thread-1",
    });

    expect(second.nextUnreadThreadIdentifiers).toEqual({ "thread-2": true });
  });

  it("ThreadListStateStore honors explicit hasUnreadTurn values from thread list contracts", () => {
    const store = new ThreadListStateStore();

    const state = store.computeActiveThreadState({
      nextThreads: [
        {
          id: "thread-explicit-unread",
          preview: "Thread unread",
          createdAt: 1_700_000_000,
          updatedAt: 1_700_000_001,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex",
          hasUnreadTurn: true,
        },
        {
          id: "thread-explicit-read",
          preview: "Thread read",
          createdAt: 1_700_000_002,
          updatedAt: 1_700_000_003,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex",
          hasUnreadTurn: false,
        },
        {
          id: "thread-selected",
          preview: "Thread selected",
          createdAt: 1_700_000_004,
          updatedAt: 1_700_000_005,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex",
          hasUnreadTurn: true,
        },
      ],
      previousUnreadThreadIdentifiers: {
        "thread-explicit-read": true,
        "thread-selected": true,
      },
      selectedThreadIdentifier: "thread-selected",
    });

    expect(state.nextUnreadThreadIdentifiers).toEqual({
      "thread-explicit-unread": true,
    });
  });

  it("ThreadListStateStore treats null unread signals as heuristic-managed state", () => {
    const store = new ThreadListStateStore();

    const first = store.computeActiveThreadState({
      nextThreads: [
        {
          id: "thread-heuristic",
          preview: "Thread heuristic",
          createdAt: 1_700_000_000,
          updatedAt: 1_700_000_001,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "opencode",
          hasUnreadTurn: null,
        },
      ],
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: null,
    });
    expect(first.nextUnreadThreadIdentifiers).toEqual({});

    const second = store.computeActiveThreadState({
      nextThreads: [
        {
          id: "thread-heuristic",
          preview: "Thread heuristic",
          createdAt: 1_700_000_000,
          updatedAt: 1_700_000_010,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "opencode",
          hasUnreadTurn: null,
        },
      ],
      previousUnreadThreadIdentifiers: first.nextUnreadThreadIdentifiers,
      selectedThreadIdentifier: null,
    });

    expect(second.nextUnreadThreadIdentifiers).toEqual({
      "thread-heuristic": true,
    });
  });

  it("ThreadListStateStore hydrates initial selected thread once using preferred agent", () => {
    const store = new ThreadListStateStore();
    const nextThreads: ThreadListItem[] = [
      {
        id: "thread-opencode",
        preview: "OpenCode thread",
        createdAt: 1_700_000_000,
        updatedAt: 1_700_000_001,
        cwd: "/tmp/project",
        source: "opencode",
        agentId: "opencode",
      },
      {
        id: "thread-codex",
        preview: "Codex thread",
        createdAt: 1_700_000_002,
        updatedAt: 1_700_000_003,
        cwd: "/tmp/project",
        source: "opencode",
        agentId: "codex",
      },
    ];

    const first = store.computeInitialSelectedThreadIdentifier({
      currentSelectedThreadIdentifier: null,
      preferredAgentIdentifier: "codex",
      nextThreads,
    });
    expect(first).toBe("thread-codex");

    const second = store.computeInitialSelectedThreadIdentifier({
      currentSelectedThreadIdentifier: null,
      preferredAgentIdentifier: "opencode",
      nextThreads,
    });
    expect(second).toBeNull();
  });

  it("ThreadListStateStore clears unread marker for selected thread", () => {
    const store = new ThreadListStateStore();
    const previousUnreadThreadIdentifiers: Record<string, true> = {
      "thread-1": true,
      "thread-2": true,
    };

    const nextUnreadThreadIdentifiers = store.computeUnreadThreadIdentifiersAfterSelectionChange({
      previousUnreadThreadIdentifiers,
      selectedThreadIdentifier: "thread-1",
    });
    expect(nextUnreadThreadIdentifiers).toEqual({ "thread-2": true });

    const unchangedUnreadThreadIdentifiers =
      store.computeUnreadThreadIdentifiersAfterSelectionChange({
        previousUnreadThreadIdentifiers: nextUnreadThreadIdentifiers,
        selectedThreadIdentifier: null,
      });
    expect(unchangedUnreadThreadIdentifiers).toBe(nextUnreadThreadIdentifiers);
  });

  it("ThreadListStateController reads from cache when allowed", async () => {
    const active = buildThreadListResponse({
      threadOneUpdatedAt: 1_700_000_000,
      threadTwoUpdatedAt: 1_700_000_001,
    });
    const archived = buildThreadListResponse({
      threadOneUpdatedAt: 1_600_000_000,
      threadTwoUpdatedAt: 1_600_000_001,
    });
    const serverClient = new TestThreadServerClient({ active, archived });
    const controller = new ThreadListStateController({
      threadServerClient: serverClient,
      threadQueryCache: new ThreadQueryCache(10_000, 8),
      threadRefreshConcurrencyCoordinator: new ThreadRefreshConcurrencyCoordinator(),
      threadListStateStore: new ThreadListStateStore(),
      threadListPresentationStateResolver: new ThreadListPresentationStateResolver(),
    });

    const firstRead = await controller.loadActiveThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: "thread-1",
      readFromCache: true,
    });

    const secondRead = await controller.loadActiveThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: "thread-1",
      readFromCache: true,
    });

    expect(firstRead.loadedFromCache).toBe(false);
    expect(secondRead.loadedFromCache).toBe(true);
    expect(serverClient.getListRequestCount()).toBe(1);
  });

  it("ThreadListStateController hydrates active threads from persisted snapshots", async () => {
    const active = buildThreadListResponse({
      threadOneUpdatedAt: 1_700_000_000,
      threadTwoUpdatedAt: 1_700_000_001,
    });
    const archived = buildThreadListResponse({
      threadOneUpdatedAt: 1_600_000_000,
      threadTwoUpdatedAt: 1_600_000_001,
    });
    const persistedSnapshotStore = new TestThreadListSnapshotPersistenceStore();
    await persistedSnapshotStore.writeThreadListSnapshot(
      ThreadListCacheKeyByName.activeThreads,
      active,
    );
    const serverClient = new TestThreadServerClient({ active, archived });
    const controller = new ThreadListStateController({
      threadServerClient: serverClient,
      threadQueryCache: new ThreadQueryCache(10_000, 8),
      threadListSnapshotPersistenceStore: persistedSnapshotStore,
      threadRefreshConcurrencyCoordinator: new ThreadRefreshConcurrencyCoordinator(),
      threadListStateStore: new ThreadListStateStore(),
      threadListPresentationStateResolver: new ThreadListPresentationStateResolver(),
    });

    const cachedRead = await controller.loadActiveThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: "thread-1",
      readFromCache: true,
    });

    expect(cachedRead.loadedFromCache).toBe(true);
    expect(cachedRead.nextThreads).toEqual(active.data);
    expect(serverClient.getListRequestCount()).toBe(0);
  });

  it("ThreadListStateController requests delta updates and merges by ordered thread identifiers", async () => {
    const baselineResponse: ThreadListResponse = {
      data: [
        {
          id: "thread-1",
          preview: "Thread one",
          createdAt: 1_700_000_000,
          updatedAt: 90,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex",
        },
        {
          id: "thread-2",
          preview: "Thread two",
          createdAt: 1_700_000_010,
          updatedAt: 80,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex",
        },
      ],
      nextCursor: null,
      pages: 1,
      truncated: false,
      sync: {
        mode: "full",
        sinceUpdatedAt: null,
        snapshotUpdatedAt: 90,
      },
    };
    const deltaResponse: ThreadListResponse = {
      data: [
        {
          id: "thread-2",
          preview: "Thread two",
          createdAt: 1_700_000_010,
          updatedAt: 95,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex",
        },
      ],
      nextCursor: null,
      pages: 1,
      truncated: false,
      orderedThreadIds: ["thread-2", "thread-1"],
      sync: {
        mode: "delta",
        sinceUpdatedAt: 90,
        snapshotUpdatedAt: 95,
      },
    };
    const serverClient = new SequencedThreadServerClient([baselineResponse, deltaResponse]);
    const controller = new ThreadListStateController({
      threadServerClient: serverClient,
      threadQueryCache: new ThreadQueryCache(10_000, 8),
      threadRefreshConcurrencyCoordinator: new ThreadRefreshConcurrencyCoordinator(),
      threadListStateStore: new ThreadListStateStore(),
      threadListPresentationStateResolver: new ThreadListPresentationStateResolver(),
    });

    await controller.loadActiveThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: null,
      readFromCache: false,
    });
    const secondRead = await controller.loadActiveThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: null,
      readFromCache: false,
    });

    expect(secondRead.nextThreads.map((thread) => thread.id)).toEqual(["thread-2", "thread-1"]);
    expect(secondRead.nextThreads[0]?.updatedAt).toBe(95);
    expect(serverClient.readListRequestOptions()).toEqual([
      {
        archived: false,
        limit: 80,
        maxPages: 20,
        sortKey: "updated_at",
      },
      {
        archived: false,
        limit: 80,
        maxPages: 20,
        sortKey: "updated_at",
        sinceUpdatedAt: 90,
      },
    ]);
  });

  it("ThreadListStateController isolates active and archived cache reads", async () => {
    const active = buildThreadListResponse({
      threadOneUpdatedAt: 1_700_000_000,
      threadTwoUpdatedAt: 1_700_000_001,
    });
    const archived = buildThreadListResponse({
      threadOneUpdatedAt: 1_600_000_000,
      threadTwoUpdatedAt: 1_600_000_001,
    });
    const serverClient = new TestThreadServerClient({ active, archived });
    const controller = new ThreadListStateController({
      threadServerClient: serverClient,
      threadQueryCache: new ThreadQueryCache(10_000, 8),
      threadRefreshConcurrencyCoordinator: new ThreadRefreshConcurrencyCoordinator(),
      threadListStateStore: new ThreadListStateStore(),
      threadListPresentationStateResolver: new ThreadListPresentationStateResolver(),
    });

    const firstActiveRead = await controller.loadActiveThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: "thread-1",
      readFromCache: true,
    });

    const firstArchivedRead = await controller.loadArchivedThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      readFromCache: true,
    });

    const secondActiveRead = await controller.loadActiveThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: "thread-1",
      readFromCache: true,
    });

    const secondArchivedRead = await controller.loadArchivedThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      readFromCache: true,
    });

    expect(firstActiveRead.loadedFromCache).toBe(false);
    expect(firstArchivedRead.loadedFromCache).toBe(false);
    expect(secondActiveRead.loadedFromCache).toBe(true);
    expect(secondArchivedRead.loadedFromCache).toBe(true);
    expect(serverClient.getListRequestCount()).toBe(2);
  });

  it("ThreadListStateController prunes display-name persistence after active and archived lists load", async () => {
    const active = buildThreadListResponseFromThreadIdentifiers(
      ["thread-active-one", "thread-active-two"],
      1_700_000_000,
    );
    const archived = buildThreadListResponseFromThreadIdentifiers(
      ["thread-archived-one"],
      1_600_000_000,
    );
    const serverClient = new TestThreadServerClient({ active, archived });
    const threadDisplayNamePreferenceStore = new TestThreadDisplayNamePreferenceStore();
    const threadDisplayNameStateOwner = new ThreadDisplayNameStateOwner({
      threadDisplayNamePreferenceStore,
    });
    const controller = new ThreadListStateController({
      threadServerClient: serverClient,
      threadQueryCache: new ThreadQueryCache(10_000, 8),
      threadRefreshConcurrencyCoordinator: new ThreadRefreshConcurrencyCoordinator(),
      threadListStateStore: new ThreadListStateStore(),
      threadListPresentationStateResolver: new ThreadListPresentationStateResolver(),
      threadDisplayNameStateOwner,
    });

    await controller.loadActiveThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: "thread-active-one",
      readFromCache: false,
    });
    expect(threadDisplayNamePreferenceStore.readPruneCalls()).toEqual([]);

    await controller.loadArchivedThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      readFromCache: false,
    });
    expect(threadDisplayNamePreferenceStore.readPruneCalls()).toEqual([
      ["thread-active-one", "thread-active-two", "thread-archived-one"],
    ]);

    controller.resetState();
    await controller.loadArchivedThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      readFromCache: false,
    });
    expect(threadDisplayNamePreferenceStore.readPruneCalls()).toEqual([
      ["thread-active-one", "thread-active-two", "thread-archived-one"],
    ]);

    await controller.loadActiveThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: "thread-active-one",
      readFromCache: false,
    });
    expect(threadDisplayNamePreferenceStore.readPruneCalls()).toEqual([
      ["thread-active-one", "thread-active-two", "thread-archived-one"],
      ["thread-active-one", "thread-active-two", "thread-archived-one"],
    ]);
  });

  it("ThreadListStateController forwards action metadata to thread list requests", async () => {
    const active = buildThreadListResponse({
      threadOneUpdatedAt: 1_700_000_000,
      threadTwoUpdatedAt: 1_700_000_001,
    });
    const archived = buildThreadListResponse({
      threadOneUpdatedAt: 1_600_000_000,
      threadTwoUpdatedAt: 1_600_000_001,
    });
    const serverClient = new TestThreadServerClient({ active, archived });
    const controller = new ThreadListStateController({
      threadServerClient: serverClient,
      threadQueryCache: new ThreadQueryCache(10_000, 8),
      threadRefreshConcurrencyCoordinator: new ThreadRefreshConcurrencyCoordinator(),
      threadListStateStore: new ThreadListStateStore(),
      threadListPresentationStateResolver: new ThreadListPresentationStateResolver(),
    });

    await controller.loadActiveThreadState({
      limit: 30,
      maxPages: 5,
      sortKey: "updated_at",
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: null,
      readFromCache: false,
      actionId: "action-active",
      actionName: "thread-list.refresh-active",
    });

    await controller.loadArchivedThreadState({
      limit: 10,
      maxPages: 2,
      sortKey: "created_at",
      readFromCache: false,
      actionId: "action-archived",
      actionName: "thread-list.refresh-archived",
    });

    expect(serverClient.readListRequestOptions()).toEqual([
      {
        archived: false,
        limit: 30,
        maxPages: 5,
        sortKey: "updated_at",
        actionId: "action-active",
        actionName: "thread-list.refresh-active",
      },
      {
        archived: true,
        limit: 10,
        maxPages: 2,
        sortKey: "created_at",
        actionId: "action-archived",
        actionName: "thread-list.refresh-archived",
      },
    ]);
  });

  it("ThreadListStateController marks archived list truncated when pagination cursor exists", async () => {
    const active = buildThreadListResponse({
      threadOneUpdatedAt: 1_700_000_000,
      threadTwoUpdatedAt: 1_700_000_001,
    });
    const archived: ThreadListResponse = {
      ...buildThreadListResponse({
        threadOneUpdatedAt: 1_600_000_000,
        threadTwoUpdatedAt: 1_600_000_001,
      }),
      nextCursor: "cursor-2",
      truncated: false,
    };
    const controller = new ThreadListStateController({
      threadServerClient: new TestThreadServerClient({ active, archived }),
      threadQueryCache: new ThreadQueryCache(10_000, 8),
      threadRefreshConcurrencyCoordinator: new ThreadRefreshConcurrencyCoordinator(),
      threadListStateStore: new ThreadListStateStore(),
      threadListPresentationStateResolver: new ThreadListPresentationStateResolver(),
    });

    const archivedState = await controller.loadArchivedThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      readFromCache: false,
    });

    expect(archivedState.isTruncated).toBe(true);
  });

  it("ThreadListStateController leaves archived list untruncated when cursor and flag are absent", async () => {
    const active = buildThreadListResponse({
      threadOneUpdatedAt: 1_700_000_000,
      threadTwoUpdatedAt: 1_700_000_001,
    });
    const archived: ThreadListResponse = {
      ...buildThreadListResponse({
        threadOneUpdatedAt: 1_600_000_000,
        threadTwoUpdatedAt: 1_600_000_001,
      }),
      nextCursor: null,
      truncated: false,
    };
    const controller = new ThreadListStateController({
      threadServerClient: new TestThreadServerClient({ active, archived }),
      threadQueryCache: new ThreadQueryCache(10_000, 8),
      threadRefreshConcurrencyCoordinator: new ThreadRefreshConcurrencyCoordinator(),
      threadListStateStore: new ThreadListStateStore(),
      threadListPresentationStateResolver: new ThreadListPresentationStateResolver(),
    });

    const archivedState = await controller.loadArchivedThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      readFromCache: false,
    });

    expect(archivedState.isTruncated).toBe(false);
  });
});
