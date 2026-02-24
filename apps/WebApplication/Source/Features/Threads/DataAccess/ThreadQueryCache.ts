import type { ThreadListResponse } from "../DomainModel/ThreadGroupTypes";

interface ThreadQueryCacheEntry {
  response: ThreadListResponse;
  expiresAtEpochMs: number;
}

export class ThreadQueryCache {
  private readonly timeToLiveMs: number;
  private readonly maximumEntries: number;
  private readonly entryByKey: Map<string, ThreadQueryCacheEntry>;

  public constructor(timeToLiveMs: number, maximumEntries: number) {
    if (!Number.isFinite(timeToLiveMs) || timeToLiveMs <= 0) {
      throw new Error("ThreadQueryCache requires a positive timeToLiveMs value");
    }
    if (!Number.isInteger(maximumEntries) || maximumEntries <= 0) {
      throw new Error("ThreadQueryCache requires a positive integer maximumEntries value");
    }
    this.timeToLiveMs = timeToLiveMs;
    this.maximumEntries = maximumEntries;
    this.entryByKey = new Map<string, ThreadQueryCacheEntry>();
  }

  public readFresh(cacheKey: string): ThreadListResponse | null {
    const entry = this.entryByKey.get(cacheKey);
    if (!entry) {
      return null;
    }
    if (Date.now() >= entry.expiresAtEpochMs) {
      this.entryByKey.delete(cacheKey);
      return null;
    }
    // Move the key to the end to keep eviction least-recently-used.
    this.entryByKey.delete(cacheKey);
    this.entryByKey.set(cacheKey, entry);
    return entry.response;
  }

  public write(cacheKey: string, response: ThreadListResponse): void {
    if (this.entryByKey.has(cacheKey)) {
      this.entryByKey.delete(cacheKey);
    }
    this.entryByKey.set(cacheKey, {
      response,
      expiresAtEpochMs: Date.now() + this.timeToLiveMs
    });
    this.evictUntilWithinBounds();
  }

  public invalidate(cacheKey: string): void {
    this.entryByKey.delete(cacheKey);
  }

  public invalidateAll(): void {
    this.entryByKey.clear();
  }

  private evictUntilWithinBounds(): void {
    while (this.entryByKey.size > this.maximumEntries) {
      const oldestKeyIteratorResult = this.entryByKey.keys().next();
      if (oldestKeyIteratorResult.done) {
        return;
      }
      this.entryByKey.delete(oldestKeyIteratorResult.value);
    }
  }
}
