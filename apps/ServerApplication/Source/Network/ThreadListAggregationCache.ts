import type { FarfieldThreadListItem } from "@farfield/protocol";
import type { AgentId } from "../Agents/Types.js";

export type ThreadListSortKey = "created_at" | "updated_at";
export type ThreadListItemWithAgentId = FarfieldThreadListItem;

export interface ThreadListAggregationQuery {
  enabledAgentIds: AgentId[];
  limit: number;
  archived: boolean;
  all: boolean;
  maxPages: number;
  sortKey: ThreadListSortKey;
  cwd: string | null;
}

export interface ThreadListAggregationSnapshot {
  mergedData: ThreadListItemWithAgentId[];
  combinedTruncated: boolean;
}

export type ThreadListAggregationCacheReadState = "hit" | "miss" | "coalesced";

export interface ThreadListAggregationCacheReadResult {
  snapshot: ThreadListAggregationSnapshot;
  readState: ThreadListAggregationCacheReadState;
}

export interface ThreadListAggregationCacheStatistics {
  hitCount: number;
  missCount: number;
  coalescedCount: number;
  evictionCount: number;
  invalidationCount: number;
  entryCount: number;
  inFlightCount: number;
}

type ThreadListAggregationCacheKey = string;

interface ThreadListAggregationCacheKeyPayload {
  enabledAgentIds: AgentId[];
  limit: number;
  archived: boolean;
  all: boolean;
  maxPages: number;
  sortKey: ThreadListSortKey;
  cwd: string | null;
}

interface ThreadListAggregationCacheEntry {
  query: ThreadListAggregationQuery;
  snapshot: ThreadListAggregationSnapshot;
  expiresAtEpochMs: number;
}

interface ThreadListAggregationInFlightSnapshot {
  query: ThreadListAggregationQuery;
  writeVersion: number;
  snapshotPromise: Promise<ThreadListAggregationSnapshot>;
}

/**
 * Owns process-local aggregation cache state for thread-list snapshots.
 *
 * Ownership contract:
 * 1. Cache key strategy: normalize query inputs first, then build a deterministic
 *    serialized key payload from the normalized query.
 * 2. Invalidation strategy: mutation owners call explicit invalidation APIs;
 *    write-version gating prevents stale in-flight loads from writing into a newer cache epoch.
 * 3. Bounds strategy: keep LRU ordering in `entryByKey` and evict oldest entries once
 *    `maximumEntries` is exceeded.
 * 4. Observability strategy: expose monotonic read/write/invalidation counters through
 *    `readStatistics` for debug snapshot owners.
 */
export class ThreadListAggregationCache {
  private readonly timeToLiveMs: number;
  private readonly maximumEntries: number;
  private readonly entryByKey: Map<ThreadListAggregationCacheKey, ThreadListAggregationCacheEntry>;
  private readonly inFlightSnapshotByKey: Map<
    ThreadListAggregationCacheKey,
    ThreadListAggregationInFlightSnapshot
  >;
  private hitCount: number;
  private missCount: number;
  private coalescedCount: number;
  private evictionCount: number;
  private invalidationCount: number;
  private writeVersion: number;

  public constructor(timeToLiveMs: number, maximumEntries: number) {
    if (!Number.isInteger(timeToLiveMs) || timeToLiveMs <= 0) {
      throw new Error("ThreadListAggregationCache requires positive integer timeToLiveMs");
    }
    if (!Number.isInteger(maximumEntries) || maximumEntries <= 0) {
      throw new Error("ThreadListAggregationCache requires positive integer maximumEntries");
    }
    this.timeToLiveMs = timeToLiveMs;
    this.maximumEntries = maximumEntries;
    this.entryByKey = new Map<ThreadListAggregationCacheKey, ThreadListAggregationCacheEntry>();
    this.inFlightSnapshotByKey = new Map<
      ThreadListAggregationCacheKey,
      ThreadListAggregationInFlightSnapshot
    >();
    this.hitCount = 0;
    this.missCount = 0;
    this.coalescedCount = 0;
    this.evictionCount = 0;
    this.invalidationCount = 0;
    this.writeVersion = 0;
  }

  public readFresh(query: ThreadListAggregationQuery): ThreadListAggregationSnapshot | null {
    const normalizedQuery = this.normalizeQuery(query);
    const key = this.buildKey(normalizedQuery);
    const entry = this.readFreshByKey(key);
    return entry ? this.cloneSnapshot(entry.snapshot) : null;
  }

  public async readFreshOrLoad(
    query: ThreadListAggregationQuery,
    loadSnapshot: () => Promise<ThreadListAggregationSnapshot>,
  ): Promise<ThreadListAggregationCacheReadResult> {
    const normalizedQuery = this.normalizeQuery(query);
    const key = this.buildKey(normalizedQuery);
    const cachedEntry = this.readFreshByKey(key);
    if (cachedEntry) {
      this.hitCount += 1;
      return {
        snapshot: this.cloneSnapshot(cachedEntry.snapshot),
        readState: "hit",
      };
    }

    const existingInFlightSnapshot = this.inFlightSnapshotByKey.get(key);
    if (existingInFlightSnapshot && existingInFlightSnapshot.writeVersion === this.writeVersion) {
      this.coalescedCount += 1;
      const loadedSnapshot = await existingInFlightSnapshot.snapshotPromise;
      return {
        snapshot: this.cloneSnapshot(loadedSnapshot),
        readState: "coalesced",
      };
    }
    if (existingInFlightSnapshot) {
      this.inFlightSnapshotByKey.delete(key);
    }

    this.missCount += 1;
    const writeVersion = this.writeVersion;
    const inFlightSnapshotPromise = loadSnapshot()
      .then((loadedSnapshot) => {
        if (writeVersion === this.writeVersion) {
          this.writeByKey(normalizedQuery, key, loadedSnapshot);
        }
        return this.cloneSnapshot(loadedSnapshot);
      })
      .finally(() => {
        const inFlightSnapshot = this.inFlightSnapshotByKey.get(key);
        if (inFlightSnapshot?.snapshotPromise === inFlightSnapshotPromise) {
          this.inFlightSnapshotByKey.delete(key);
        }
      });

    this.inFlightSnapshotByKey.set(key, {
      query: normalizedQuery,
      writeVersion,
      snapshotPromise: inFlightSnapshotPromise,
    });
    const loadedSnapshot = await inFlightSnapshotPromise;
    return {
      snapshot: this.cloneSnapshot(loadedSnapshot),
      readState: "miss",
    };
  }

  public readStatistics(): ThreadListAggregationCacheStatistics {
    // These counters are process-lifetime observability values, not per-request metrics.
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      coalescedCount: this.coalescedCount,
      evictionCount: this.evictionCount,
      invalidationCount: this.invalidationCount,
      entryCount: this.entryByKey.size,
      inFlightCount: this.inFlightSnapshotByKey.size,
    };
  }

  public write(query: ThreadListAggregationQuery, snapshot: ThreadListAggregationSnapshot): void {
    const normalizedQuery = this.normalizeQuery(query);
    const key = this.buildKey(normalizedQuery);
    this.writeByKey(normalizedQuery, key, snapshot);
  }

  public invalidateAll(): void {
    this.invalidateWhere(() => true);
  }

  public invalidateWhere(predicate: (query: ThreadListAggregationQuery) => boolean): void {
    const invalidatedEntryCount = this.invalidateEntries(predicate);
    const invalidatedInFlightCount = this.invalidateInFlightSnapshots(predicate);
    if (invalidatedEntryCount + invalidatedInFlightCount > 0) {
      this.invalidationCount += 1;
      // Advance cache epoch so stale in-flight operations cannot write into a newer invalidated state.
      this.writeVersion += 1;
    }
  }

  private readFreshByKey(
    key: ThreadListAggregationCacheKey,
  ): ThreadListAggregationCacheEntry | null {
    const entry = this.entryByKey.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() >= entry.expiresAtEpochMs) {
      this.entryByKey.delete(key);
      return null;
    }

    // Keep most-recently-used entries at the end for deterministic eviction.
    this.entryByKey.delete(key);
    this.entryByKey.set(key, entry);
    return entry;
  }

  private cloneSnapshot(snapshot: ThreadListAggregationSnapshot): ThreadListAggregationSnapshot {
    return {
      mergedData: snapshot.mergedData.map((threadListItem) =>
        this.cloneThreadListItem(threadListItem),
      ),
      combinedTruncated: snapshot.combinedTruncated,
    };
  }

  private writeByKey(
    query: ThreadListAggregationQuery,
    key: ThreadListAggregationCacheKey,
    snapshot: ThreadListAggregationSnapshot,
  ): void {
    if (this.entryByKey.has(key)) {
      this.entryByKey.delete(key);
    }

    this.entryByKey.set(key, {
      query: this.cloneQuery(query),
      snapshot: this.cloneSnapshot(snapshot),
      expiresAtEpochMs: Date.now() + this.timeToLiveMs,
    });

    this.evictUntilWithinBounds();
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

  private invalidateEntries(predicate: (query: ThreadListAggregationQuery) => boolean): number {
    let invalidatedEntryCount = 0;
    for (const [key, entry] of this.entryByKey.entries()) {
      if (!predicate(entry.query)) {
        continue;
      }
      this.entryByKey.delete(key);
      invalidatedEntryCount += 1;
    }
    return invalidatedEntryCount;
  }

  private invalidateInFlightSnapshots(
    predicate: (query: ThreadListAggregationQuery) => boolean,
  ): number {
    let invalidatedInFlightCount = 0;
    for (const [key, inFlightSnapshot] of this.inFlightSnapshotByKey.entries()) {
      if (!predicate(inFlightSnapshot.query)) {
        continue;
      }
      this.inFlightSnapshotByKey.delete(key);
      invalidatedInFlightCount += 1;
    }
    return invalidatedInFlightCount;
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

  private cloneQuery(query: ThreadListAggregationQuery): ThreadListAggregationQuery {
    return {
      enabledAgentIds: [...query.enabledAgentIds],
      limit: query.limit,
      archived: query.archived,
      all: query.all,
      maxPages: query.maxPages,
      sortKey: query.sortKey,
      cwd: query.cwd,
    };
  }

  private cloneThreadListItem(
    threadListItem: ThreadListItemWithAgentId,
  ): ThreadListItemWithAgentId {
    return {
      ...threadListItem,
    };
  }

  private buildKeyPayload(query: ThreadListAggregationQuery): ThreadListAggregationCacheKeyPayload {
    return {
      enabledAgentIds: query.enabledAgentIds,
      limit: query.limit,
      archived: query.archived,
      all: query.all,
      maxPages: query.maxPages,
      sortKey: query.sortKey,
      cwd: query.cwd,
    };
  }

  private buildKey(query: ThreadListAggregationQuery): ThreadListAggregationCacheKey {
    return JSON.stringify(this.buildKeyPayload(query));
  }
}
