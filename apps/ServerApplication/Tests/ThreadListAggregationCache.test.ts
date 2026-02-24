import { describe, expect, it } from "vitest";
import {
  ThreadListAggregationCache,
  type ThreadListAggregationQuery,
  type ThreadListAggregationSnapshot
} from "../Source/Network/ThreadListAggregationCache.js";

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

describe("ThreadListAggregationCache", () => {
  it("reads a fresh written entry", () => {
    const cache = new ThreadListAggregationCache(200, 4);
    const query = buildQuery();

    cache.write(query, buildSnapshot({ combinedTruncated: true }));

    const value = cache.readFresh(query);
    expect(value).not.toBeNull();
    expect(value?.combinedTruncated).toBe(true);
  });

  it("expires entries after time to live", async () => {
    const cache = new ThreadListAggregationCache(30, 4);
    const query = buildQuery();

    cache.write(query, buildSnapshot());
    await new Promise<void>((resolve) => setTimeout(resolve, 45));

    expect(cache.readFresh(query)).toBeNull();
  });

  it("evicts least-recently-used entries when entry bounds are exceeded", () => {
    const cache = new ThreadListAggregationCache(1_000, 2);

    const firstQuery = buildQuery({ cwd: "/workspace/first" });
    const secondQuery = buildQuery({ cwd: "/workspace/second" });
    const thirdQuery = buildQuery({ cwd: "/workspace/third" });

    cache.write(firstQuery, buildSnapshot());
    cache.write(secondQuery, buildSnapshot());
    cache.readFresh(firstQuery);
    cache.write(thirdQuery, buildSnapshot());

    expect(cache.readFresh(firstQuery)).not.toBeNull();
    expect(cache.readFresh(secondQuery)).toBeNull();
    expect(cache.readFresh(thirdQuery)).not.toBeNull();
    expect(cache.readStatistics().evictionCount).toBe(1);
  });

  it("coalesces concurrent loads for the same query key", async () => {
    const cache = new ThreadListAggregationCache(1_000, 4);
    const query = buildQuery();

    let resolveLoad: ((value: ThreadListAggregationSnapshot) => void) | null = null;
    const loader = () => new Promise<ThreadListAggregationSnapshot>((resolve) => {
      resolveLoad = resolve;
    });

    const firstReadPromise = cache.readFreshOrLoad(query, loader);
    const secondReadPromise = cache.readFreshOrLoad(query, loader);

    expect(cache.readStatistics().inFlightCount).toBe(1);
    resolveLoad?.(buildSnapshot());

    const [firstReadResult, secondReadResult] = await Promise.all([
      firstReadPromise,
      secondReadPromise
    ]);

    expect(firstReadResult.readState).toBe("miss");
    expect(secondReadResult.readState).toBe("coalesced");

    const thirdReadResult = await cache.readFreshOrLoad(query, async () => {
      throw new Error("cache hit should not execute loader");
    });
    expect(thirdReadResult.readState).toBe("hit");
  });

  it("does not write stale in-flight results after invalidation", async () => {
    const cache = new ThreadListAggregationCache(1_000, 4);
    const query = buildQuery();

    let resolveLoad: ((value: ThreadListAggregationSnapshot) => void) | null = null;
    const readPromise = cache.readFreshOrLoad(query, () => new Promise<ThreadListAggregationSnapshot>((resolve) => {
      resolveLoad = resolve;
    }));

    cache.invalidateAll();
    resolveLoad?.(buildSnapshot({ combinedTruncated: true }));

    await readPromise;

    expect(cache.readFresh(query)).toBeNull();
    expect(cache.readStatistics().invalidationCount).toBe(1);
  });
});
