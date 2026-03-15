import type { FarfieldThreadListResponse } from "@farfield/protocol";
import type { ThreadListAggregationQuery } from "./ThreadListAggregationCache.js";

type SidebarThreadSyncSnapshotCacheKey = string;

export interface SidebarThreadSyncSnapshotCacheStatistics {
  hitCount: number;
  missCount: number;
  writeCount: number;
  invalidationCount: number;
  evictionCount: number;
  entryCount: number;
}

interface SidebarThreadSyncSnapshotCacheEntry {
  query: ThreadListAggregationQuery;
  snapshot: SidebarThreadSyncSnapshot;
  expiresAtEpochMilliseconds: number;
}

export interface SidebarThreadSyncSnapshot {
  threadList: FarfieldThreadListResponse;
  snapshotUpdatedAt: number;
  snapshotVersion: string;
}

/**
 * Owns process-local sidebar-thread sync snapshots keyed by sidebar query.
 * The cache exists specifically so the sidebar sync endpoint can answer `notModified`
 * without forcing adapter fan-out or full thread-list payload work when no invalidation
 * has occurred for the same logical sidebar query.
 */
export class SidebarThreadSyncSnapshotCache {
  private readonly timeToLiveMilliseconds: number;
  private readonly maximumEntries: number;
  private readonly entryByKey = new Map<
    SidebarThreadSyncSnapshotCacheKey,
    SidebarThreadSyncSnapshotCacheEntry
  >();
  private hitCount: number;
  private missCount: number;
  private writeCount: number;
  private invalidationCount: number;
  private evictionCount: number;

  public constructor(timeToLiveMilliseconds: number, maximumEntries: number) {
    if (!Number.isInteger(timeToLiveMilliseconds) || timeToLiveMilliseconds <= 0) {
      throw new Error(
        "SidebarThreadSyncSnapshotCache requires positive integer timeToLiveMilliseconds",
      );
    }
    if (!Number.isInteger(maximumEntries) || maximumEntries <= 0) {
      throw new Error("SidebarThreadSyncSnapshotCache requires positive integer maximumEntries");
    }
    this.timeToLiveMilliseconds = timeToLiveMilliseconds;
    this.maximumEntries = maximumEntries;
    this.hitCount = 0;
    this.missCount = 0;
    this.writeCount = 0;
    this.invalidationCount = 0;
    this.evictionCount = 0;
  }

  public readFresh(query: ThreadListAggregationQuery): SidebarThreadSyncSnapshot | null {
    const normalizedQuery = this.normalizeQuery(query);
    const cacheKey = this.buildCacheKey(normalizedQuery);
    const entry = this.entryByKey.get(cacheKey);
    if (!entry) {
      this.missCount += 1;
      return null;
    }
    if (Date.now() >= entry.expiresAtEpochMilliseconds) {
      this.entryByKey.delete(cacheKey);
      this.missCount += 1;
      return null;
    }
    this.entryByKey.delete(cacheKey);
    this.entryByKey.set(cacheKey, entry);
    this.hitCount += 1;
    return this.cloneSnapshot(entry.snapshot);
  }

  public write(query: ThreadListAggregationQuery, snapshot: SidebarThreadSyncSnapshot): void {
    const normalizedQuery = this.normalizeQuery(query);
    const cacheKey = this.buildCacheKey(normalizedQuery);
    if (this.entryByKey.has(cacheKey)) {
      this.entryByKey.delete(cacheKey);
    }
    this.entryByKey.set(cacheKey, {
      query: this.normalizeQuery(normalizedQuery),
      snapshot: this.cloneSnapshot(snapshot),
      expiresAtEpochMilliseconds: Date.now() + this.timeToLiveMilliseconds,
    });
    this.writeCount += 1;
    this.evictUntilWithinBounds();
  }

  public invalidateWhere(predicate: (query: ThreadListAggregationQuery) => boolean): void {
    let invalidatedEntryCount = 0;
    for (const [cacheKey, entry] of this.entryByKey.entries()) {
      if (!predicate(entry.query)) {
        continue;
      }
      this.entryByKey.delete(cacheKey);
      invalidatedEntryCount += 1;
    }
    if (invalidatedEntryCount > 0) {
      this.invalidationCount += 1;
    }
  }

  public readStatistics(): SidebarThreadSyncSnapshotCacheStatistics {
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      writeCount: this.writeCount,
      invalidationCount: this.invalidationCount,
      evictionCount: this.evictionCount,
      entryCount: this.entryByKey.size,
    };
  }

  private normalizeQuery(query: ThreadListAggregationQuery): ThreadListAggregationQuery {
    return {
      enabledAgentIds: [...query.enabledAgentIds].sort((left, right) => left.localeCompare(right)),
      limit: query.limit,
      archived: query.archived,
      all: query.all,
      maxPages: query.maxPages,
      sortKey: query.sortKey,
      cwd: query.cwd,
    };
  }

  private buildCacheKey(query: ThreadListAggregationQuery): SidebarThreadSyncSnapshotCacheKey {
    return JSON.stringify(query);
  }

  private cloneSnapshot(snapshot: SidebarThreadSyncSnapshot): SidebarThreadSyncSnapshot {
    return {
      threadList: {
        data: snapshot.threadList.data.map((thread) => ({ ...thread })),
        nextCursor: snapshot.threadList.nextCursor,
        pages: snapshot.threadList.pages,
        truncated: snapshot.threadList.truncated,
        orderedThreadIds:
          snapshot.threadList.orderedThreadIds === undefined
            ? undefined
            : [...snapshot.threadList.orderedThreadIds],
        sync: snapshot.threadList.sync === undefined ? undefined : { ...snapshot.threadList.sync },
      },
      snapshotUpdatedAt: snapshot.snapshotUpdatedAt,
      snapshotVersion: snapshot.snapshotVersion,
    };
  }

  private evictUntilWithinBounds(): void {
    while (this.entryByKey.size > this.maximumEntries) {
      const oldestEntryResult = this.entryByKey.keys().next();
      if (oldestEntryResult.done === true) {
        return;
      }
      this.entryByKey.delete(oldestEntryResult.value);
      this.evictionCount += 1;
    }
  }
}
