import { describe, expect, it } from "vitest";
import { ThreadQueryCache } from "@/Features/Threads/DataAccess/ThreadQueryCache";
import type { ThreadListResponse } from "@/Features/Threads/DomainModel/ThreadGroupTypes";

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
        agentId: "codex"
      }
    ],
    nextCursor: null
  };
}

describe("ThreadQueryCache", () => {
  it("expires entries when the injected cache clock reaches the time-to-live boundary", () => {
    let currentEpochMilliseconds = 1_000;
    const cache = new ThreadQueryCache(50, 4, {
      readCurrentEpochMilliseconds: () => currentEpochMilliseconds
    });

    cache.write("threads:active", buildThreadListResponse("thread-active"));

    currentEpochMilliseconds = 1_049;
    expect(cache.readFresh("threads:active")).not.toBeNull();

    currentEpochMilliseconds = 1_050;
    expect(cache.readFresh("threads:active")).toBeNull();
  });

  it("evicts least-recently-used keys while preserving recently read entries", () => {
    const cache = new ThreadQueryCache(1_000, 2, {
      readCurrentEpochMilliseconds: () => 100
    });

    const activeResponse = buildThreadListResponse("thread-active");
    const archivedResponse = buildThreadListResponse("thread-archived");
    const removedResponse = buildThreadListResponse("thread-removed");

    cache.write("threads:active", activeResponse);
    cache.write("threads:archived", archivedResponse);

    // Re-read active to keep it at the end of the LRU order before the next write.
    expect(cache.readFresh("threads:active")).toEqual(activeResponse);

    cache.write("threads:removed", removedResponse);

    expect(cache.readFresh("threads:active")).toEqual(activeResponse);
    expect(cache.readFresh("threads:archived")).toBeNull();
    expect(cache.readFresh("threads:removed")).toEqual(removedResponse);
  });
});
