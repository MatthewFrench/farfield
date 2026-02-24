import { describe, expect, it } from "vitest";
import { ThreadQueryCache } from "@/Features/Threads/DataAccess/ThreadQueryCache";
import { ThreadServerClient } from "@/Features/Threads/DataAccess/ThreadServerClient";
import type {
  ThreadListItem,
  ThreadListLoadOptions,
  ThreadListResponse
} from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { ThreadListStateController } from "@/Features/Threads/StateManagement/ThreadListStateController";
import { ThreadListPresentationStateResolver } from "@/Features/Threads/StateManagement/ThreadListPresentationStateResolver";
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
        agentId: "codex"
      },
      {
        id: "thread-2",
        preview: "Thread two",
        createdAt: 1_700_000_010,
        updatedAt: input.threadTwoUpdatedAt,
        cwd: "/tmp/project",
        source: "opencode",
        agentId: "codex"
      }
    ],
    nextCursor: null,
    pages: 1,
    truncated: false
  };
}

class TestThreadServerClient extends ThreadServerClient {
  private readonly responseByArchiveMode: {
    active: ThreadListResponse;
    archived: ThreadListResponse;
  };
  private listRequestCount: number;

  public constructor(input: { active: ThreadListResponse; archived: ThreadListResponse }) {
    super();
    this.responseByArchiveMode = {
      active: input.active,
      archived: input.archived
    };
    this.listRequestCount = 0;
  }

  public getListRequestCount(): number {
    return this.listRequestCount;
  }

  public override async listThreads(options: ThreadListLoadOptions): Promise<ThreadListResponse> {
    this.listRequestCount += 1;
    return options.archived ? this.responseByArchiveMode.archived : this.responseByArchiveMode.active;
  }
}

describe("Thread ownership modules", () => {
  it("ThreadQueryCache stores and invalidates entries", () => {
    const cache = new ThreadQueryCache(1_000, 4);
    const response = buildThreadListResponse({
      threadOneUpdatedAt: 1_700_000_000,
      threadTwoUpdatedAt: 1_700_000_001
    });

    expect(cache.readFresh("threads:active")).toBeNull();
    cache.write("threads:active", response);
    expect(cache.readFresh("threads:active")).toEqual(response);
    cache.invalidate("threads:active");
    expect(cache.readFresh("threads:active")).toBeNull();
  });

  it("ThreadQueryCache enforces maximum entries with least-recently-used eviction", () => {
    const cache = new ThreadQueryCache(10_000, 2);
    const response = buildThreadListResponse({
      threadOneUpdatedAt: 1_700_000_000,
      threadTwoUpdatedAt: 1_700_000_001
    });

    cache.write("threads:active", response);
    cache.write("threads:archived", response);
    expect(cache.readFresh("threads:active")).toEqual(response);

    cache.write("threads:removed-projects", response);

    expect(cache.readFresh("threads:active")).toEqual(response);
    expect(cache.readFresh("threads:archived")).toBeNull();
    expect(cache.readFresh("threads:removed-projects")).toEqual(response);
  });

  it("ThreadRefreshConcurrencyCoordinator coalesces same-key requests", async () => {
    const coordinator = new ThreadRefreshConcurrencyCoordinator();
    const response = buildThreadListResponse({
      threadOneUpdatedAt: 1_700_000_000,
      threadTwoUpdatedAt: 1_700_000_001
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
      coordinator.runSingleFlight("threads:active", task),
      coordinator.runSingleFlight("threads:active", task)
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
        threadTwoUpdatedAt: 1_700_000_001
      }).data,
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: "thread-1"
    });
    expect(first.nextUnreadThreadIdentifiers).toEqual({});

    const second = store.computeActiveThreadState({
      nextThreads: buildThreadListResponse({
        threadOneUpdatedAt: 1_700_000_000,
        threadTwoUpdatedAt: 1_700_000_010
      }).data,
      previousUnreadThreadIdentifiers: first.nextUnreadThreadIdentifiers,
      selectedThreadIdentifier: "thread-1"
    });

    expect(second.nextUnreadThreadIdentifiers).toEqual({ "thread-2": true });
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
        agentId: "opencode"
      },
      {
        id: "thread-codex",
        preview: "Codex thread",
        createdAt: 1_700_000_002,
        updatedAt: 1_700_000_003,
        cwd: "/tmp/project",
        source: "opencode",
        agentId: "codex"
      }
    ];

    const first = store.computeInitialSelectedThreadIdentifier({
      currentSelectedThreadIdentifier: null,
      preferredAgentIdentifier: "codex",
      nextThreads
    });
    expect(first).toBe("thread-codex");

    const second = store.computeInitialSelectedThreadIdentifier({
      currentSelectedThreadIdentifier: null,
      preferredAgentIdentifier: "opencode",
      nextThreads
    });
    expect(second).toBeNull();
  });

  it("ThreadListStateStore clears unread marker for selected thread", () => {
    const store = new ThreadListStateStore();
    const previousUnreadThreadIdentifiers: Record<string, true> = {
      "thread-1": true,
      "thread-2": true
    };

    const nextUnreadThreadIdentifiers = store.computeUnreadThreadIdentifiersAfterSelectionChange({
      previousUnreadThreadIdentifiers,
      selectedThreadIdentifier: "thread-1"
    });
    expect(nextUnreadThreadIdentifiers).toEqual({ "thread-2": true });

    const unchangedUnreadThreadIdentifiers = store.computeUnreadThreadIdentifiersAfterSelectionChange({
      previousUnreadThreadIdentifiers: nextUnreadThreadIdentifiers,
      selectedThreadIdentifier: null
    });
    expect(unchangedUnreadThreadIdentifiers).toBe(nextUnreadThreadIdentifiers);
  });

  it("ThreadListStateController reads from cache when allowed", async () => {
    const active = buildThreadListResponse({
      threadOneUpdatedAt: 1_700_000_000,
      threadTwoUpdatedAt: 1_700_000_001
    });
    const archived = buildThreadListResponse({
      threadOneUpdatedAt: 1_600_000_000,
      threadTwoUpdatedAt: 1_600_000_001
    });
    const serverClient = new TestThreadServerClient({ active, archived });
    const controller = new ThreadListStateController({
      threadServerClient: serverClient,
      threadQueryCache: new ThreadQueryCache(10_000, 8),
      threadRefreshConcurrencyCoordinator: new ThreadRefreshConcurrencyCoordinator(),
      threadListStateStore: new ThreadListStateStore(),
      threadListPresentationStateResolver: new ThreadListPresentationStateResolver()
    });

    const firstRead = await controller.loadActiveThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: "thread-1",
      readFromCache: true
    });

    const secondRead = await controller.loadActiveThreadState({
      limit: 80,
      maxPages: 20,
      sortKey: "updated_at",
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: "thread-1",
      readFromCache: true
    });

    expect(firstRead.loadedFromCache).toBe(false);
    expect(secondRead.loadedFromCache).toBe(true);
    expect(serverClient.getListRequestCount()).toBe(1);
  });
});
