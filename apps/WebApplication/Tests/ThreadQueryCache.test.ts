import { describe, expect, it } from "vitest";
import { ThreadQueryCache } from "@/Features/Threads/DataAccess/ThreadQueryCache";
import type { ThreadListResponse } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { ThreadListCacheKeyByName } from "@/Features/Threads/StateManagement/ThreadListCacheKeyContracts";

function buildThreadListResponse(threadIdentifier: string): ThreadListResponse {
  return {
    data: [
      {
        id: threadIdentifier,
        preview: `Preview for ${threadIdentifier}`,
        createdAt: 1_735_000_000_000,
        updatedAt: 1_735_000_000_100,
        cwd: "/tmp/thread-query-cache",
        path: "/tmp/thread-query-cache",
        agentId: "codex",
        hasUnreadTurn: null,
        isProjectRemoved: false,
      },
    ],
    nextCursor: null,
  };
}

describe("ThreadQueryCache", () => {
  it("expires entries when the injected cache clock reaches the time-to-live boundary", () => {
    let currentEpochMilliseconds = 1_000;
    const cache = new ThreadQueryCache(50, 4, {
      readCurrentEpochMilliseconds: () => currentEpochMilliseconds,
    });

    cache.write(ThreadListCacheKeyByName.activeThreads, buildThreadListResponse("thread-active"));

    currentEpochMilliseconds = 1_049;
    expect(cache.readFresh(ThreadListCacheKeyByName.activeThreads)).not.toBeNull();

    currentEpochMilliseconds = 1_050;
    expect(cache.readFresh(ThreadListCacheKeyByName.activeThreads)).toBeNull();
  });

  it("evicts least-recently-used keys while preserving recently read entries", () => {
    const cache = new ThreadQueryCache(1_000, 2, {
      readCurrentEpochMilliseconds: () => 100,
    });

    const activeResponse = buildThreadListResponse("thread-active");
    const archivedResponse = buildThreadListResponse("thread-archived");
    const removedResponse = buildThreadListResponse("thread-removed");

    cache.write(ThreadListCacheKeyByName.activeThreads, activeResponse);
    cache.write(ThreadListCacheKeyByName.archivedThreads, archivedResponse);

    // Re-read active to keep it at the end of the LRU order before the next write.
    expect(cache.readFresh(ThreadListCacheKeyByName.activeThreads)).toEqual(activeResponse);

    cache.write("threads:removed", removedResponse);

    expect(cache.readFresh(ThreadListCacheKeyByName.activeThreads)).toEqual(activeResponse);
    expect(cache.readFresh(ThreadListCacheKeyByName.archivedThreads)).toBeNull();
    expect(cache.readFresh("threads:removed")).toEqual(removedResponse);
  });

  it("marks entries stale without dropping the cached response baseline", () => {
    const cache = new ThreadQueryCache(1_000, 2, {
      readCurrentEpochMilliseconds: () => 100,
    });
    const activeResponse = buildThreadListResponse("thread-active");

    cache.write(ThreadListCacheKeyByName.activeThreads, activeResponse);
    cache.invalidate(ThreadListCacheKeyByName.activeThreads);

    expect(cache.readFresh(ThreadListCacheKeyByName.activeThreads)).toBeNull();
    expect(cache.readCached(ThreadListCacheKeyByName.activeThreads)).toEqual(activeResponse);
  });
});
