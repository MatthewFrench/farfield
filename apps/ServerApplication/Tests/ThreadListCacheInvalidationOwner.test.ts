import { describe, expect, it } from "vitest";
import {
  ThreadListAggregationCache,
  type ThreadListAggregationQuery,
  type ThreadListAggregationSnapshot
} from "../Source/Network/ThreadListAggregationCache.js";
import { ThreadListCacheInvalidationOwner } from "../Source/Application/Bootstrap/ThreadListCacheInvalidationOwner.js";
import { THREAD_STREAM_STATE_CHANGED_METHOD } from "../Source/Application/ThreadStreamStateChangedHistoryBatchOwner.js";

function buildQuery(overrides: Partial<ThreadListAggregationQuery> = {}): ThreadListAggregationQuery {
  return {
    enabledAgentIds: ["codex"],
    limit: 20,
    archived: false,
    all: false,
    maxPages: 10,
    sortKey: "updated_at",
    cwd: null,
    ...overrides
  };
}

function buildSnapshot(
  overrides: Partial<ThreadListAggregationSnapshot> = {}
): ThreadListAggregationSnapshot {
  return {
    mergedData: [],
    combinedTruncated: false,
    ...overrides
  };
}

describe("ThreadListCacheInvalidationOwner", () => {
  it("invalidates all cache scopes for archive mutations", () => {
    const cache = new ThreadListAggregationCache(1_000, 8);
    const owner = new ThreadListCacheInvalidationOwner(cache);
    const activeQuery = buildQuery({ archived: false });
    const archivedQuery = buildQuery({ archived: true });

    cache.write(activeQuery, buildSnapshot({ combinedTruncated: true }));
    cache.write(archivedQuery, buildSnapshot({ combinedTruncated: false }));

    owner.invalidate("thread-archived", { threadId: "thread-1" });

    expect(cache.readFresh(activeQuery)).toBeNull();
    expect(cache.readFresh(archivedQuery)).toBeNull();
    expect(cache.readStatistics().invalidationCount).toBe(1);
  });

  it("debounces repeated stream-state invalidations for the same thread", () => {
    const cache = new ThreadListAggregationCache(1_000, 8);
    const owner = new ThreadListCacheInvalidationOwner(cache);
    const activeQuery = buildQuery({ archived: false });

    cache.write(activeQuery, buildSnapshot());
    owner.invalidate(THREAD_STREAM_STATE_CHANGED_METHOD, { threadId: "thread-1" });
    expect(cache.readFresh(activeQuery)).toBeNull();

    cache.write(activeQuery, buildSnapshot());
    owner.invalidate(THREAD_STREAM_STATE_CHANGED_METHOD, { threadId: "thread-1" });
    expect(cache.readFresh(activeQuery)).not.toBeNull();

    cache.write(activeQuery, buildSnapshot());
    owner.invalidate(THREAD_STREAM_STATE_CHANGED_METHOD, { threadId: "thread-2" });
    expect(cache.readFresh(activeQuery)).toBeNull();
    expect(cache.readStatistics().invalidationCount).toBe(2);
  });

  it("fails fast for unsupported invalidation reasons", () => {
    const cache = new ThreadListAggregationCache(1_000, 8);
    const owner = new ThreadListCacheInvalidationOwner(cache);

    expect(() => {
      owner.invalidate("thread-something-else");
    }).toThrow();
  });

  it("fails fast for invalid stream-state thread identifiers", () => {
    const cache = new ThreadListAggregationCache(1_000, 8);
    const owner = new ThreadListCacheInvalidationOwner(cache);

    expect(() => {
      owner.invalidate(THREAD_STREAM_STATE_CHANGED_METHOD, { threadId: 123 });
    }).toThrow();
  });
});
