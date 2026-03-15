import type { ThreadListResponse } from "../DomainModel/ThreadGroupTypes";

interface ThreadQueryCacheEntry {
  response: ThreadListResponse;
  expiresAtEpochMs: number;
}

interface ThreadQueryCacheDependencies {
  readCurrentEpochMilliseconds?: () => number;
}

const INVALID_CACHE_TIME_TO_LIVE_MESSAGE =
  "ThreadQueryCache requires a positive timeToLiveMs value";
const INVALID_CACHE_MAXIMUM_ENTRIES_MESSAGE =
  "ThreadQueryCache requires a positive integer maximumEntries value";

/**
 * Owns in-memory thread-list query caching.
 * Entries are bounded by TTL and least-recently-used eviction so thread-list refreshes can read
 * immediately during short bursts without unbounded growth.
 *
 * Freshness and retention are separate:
 * 1. `readFresh` enforces the interactive freshness window.
 * 2. stale entries remain retained for baseline sidebar sync and cache-first rendering until LRU
 *    eviction or explicit `invalidateAll`.
 */
export class ThreadQueryCache {
  private readonly timeToLiveMs: number;
  private readonly maximumEntries: number;
  private readonly readCurrentEpochMilliseconds: () => number;
  private readonly entryByKey: Map<string, ThreadQueryCacheEntry>;

  public constructor(
    timeToLiveMs: number,
    maximumEntries: number,
    dependencies?: ThreadQueryCacheDependencies,
  ) {
    if (!Number.isFinite(timeToLiveMs) || timeToLiveMs <= 0) {
      throw new Error(INVALID_CACHE_TIME_TO_LIVE_MESSAGE);
    }
    if (!Number.isInteger(maximumEntries) || maximumEntries <= 0) {
      throw new Error(INVALID_CACHE_MAXIMUM_ENTRIES_MESSAGE);
    }
    this.timeToLiveMs = timeToLiveMs;
    this.maximumEntries = maximumEntries;
    this.readCurrentEpochMilliseconds = dependencies?.readCurrentEpochMilliseconds ?? Date.now;
    this.entryByKey = new Map<string, ThreadQueryCacheEntry>();
  }

  public readFresh(cacheKey: string): ThreadListResponse | null {
    const entry = this.entryByKey.get(cacheKey);
    if (!entry) {
      return null;
    }
    if (this.readCurrentEpochMilliseconds() >= entry.expiresAtEpochMs) {
      return null;
    }
    // Move the key to the end to keep eviction least-recently-used.
    this.entryByKey.delete(cacheKey);
    this.entryByKey.set(cacheKey, entry);
    return entry.response;
  }

  public readCached(cacheKey: string): ThreadListResponse | null {
    return this.entryByKey.get(cacheKey)?.response ?? null;
  }

  public write(cacheKey: string, response: ThreadListResponse): void {
    if (this.entryByKey.has(cacheKey)) {
      this.entryByKey.delete(cacheKey);
    }
    this.entryByKey.set(cacheKey, {
      response,
      expiresAtEpochMs: this.readCurrentEpochMilliseconds() + this.timeToLiveMs,
    });
    this.evictUntilWithinBounds();
  }

  public invalidate(cacheKey: string): void {
    const entry = this.entryByKey.get(cacheKey);
    if (!entry) {
      return;
    }
    this.entryByKey.set(cacheKey, {
      response: entry.response,
      expiresAtEpochMs: 0,
    });
  }

  public invalidateAll(): void {
    this.entryByKey.clear();
  }

  private evictUntilWithinBounds(): void {
    while (this.entryByKey.size > this.maximumEntries) {
      const oldestKeyIteratorResult = this.entryByKey.keys().next();
      if (oldestKeyIteratorResult.done === true) {
        return;
      }
      this.entryByKey.delete(oldestKeyIteratorResult.value);
    }
  }
}
