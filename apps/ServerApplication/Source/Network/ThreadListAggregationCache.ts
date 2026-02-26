import type { AppServerListThreadsResponse } from "@farfield/protocol";
import type { AgentId } from "../Agents/Types.js";

export type ThreadListSortKey = "created_at" | "updated_at";
export type ThreadListItemWithAgentId = AppServerListThreadsResponse["data"][number] & { agentId: AgentId };

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

export class ThreadListAggregationCache {
  private readonly timeToLiveMs: number;
  private readonly maximumEntries: number;
  private readonly entryByKey: Map<string, ThreadListAggregationCacheEntry>;
  private readonly inFlightSnapshotByKey: Map<string, ThreadListAggregationInFlightSnapshot>;
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
    this.entryByKey = new Map<string, ThreadListAggregationCacheEntry>();
    this.inFlightSnapshotByKey = new Map<string, ThreadListAggregationInFlightSnapshot>();
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
    loadSnapshot: () => Promise<ThreadListAggregationSnapshot>
  ): Promise<ThreadListAggregationCacheReadResult> {
    const normalizedQuery = this.normalizeQuery(query);
    const key = this.buildKey(normalizedQuery);
    const cachedEntry = this.readFreshByKey(key);
    if (cachedEntry) {
      this.hitCount += 1;
      return {
        snapshot: this.cloneSnapshot(cachedEntry.snapshot),
        readState: "hit"
      };
    }

    const existingInFlightSnapshot = this.inFlightSnapshotByKey.get(key);
    if (existingInFlightSnapshot && existingInFlightSnapshot.writeVersion === this.writeVersion) {
      this.coalescedCount += 1;
      const loadedSnapshot = await existingInFlightSnapshot.snapshotPromise;
      return {
        snapshot: this.cloneSnapshot(loadedSnapshot),
        readState: "coalesced"
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
      snapshotPromise: inFlightSnapshotPromise
    });
    const loadedSnapshot = await inFlightSnapshotPromise;
    return {
      snapshot: this.cloneSnapshot(loadedSnapshot),
      readState: "miss"
    };
  }

  public readStatistics(): ThreadListAggregationCacheStatistics {
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      coalescedCount: this.coalescedCount,
      evictionCount: this.evictionCount,
      invalidationCount: this.invalidationCount,
      entryCount: this.entryByKey.size,
      inFlightCount: this.inFlightSnapshotByKey.size
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
    let invalidated = false;

    for (const [key, entry] of this.entryByKey.entries()) {
      if (!predicate(entry.query)) {
        continue;
      }
      this.entryByKey.delete(key);
      invalidated = true;
    }

    for (const [key, inFlightSnapshot] of this.inFlightSnapshotByKey.entries()) {
      if (!predicate(inFlightSnapshot.query)) {
        continue;
      }
      this.inFlightSnapshotByKey.delete(key);
      invalidated = true;
    }

    if (invalidated) {
      this.invalidationCount += 1;
      this.writeVersion += 1;
    }
  }

  private readFreshByKey(key: string): ThreadListAggregationCacheEntry | null {
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
      mergedData: snapshot.mergedData.map((threadListItem) => this.cloneThreadListItem(threadListItem)),
      combinedTruncated: snapshot.combinedTruncated
    };
  }

  private writeByKey(
    query: ThreadListAggregationQuery,
    key: string,
    snapshot: ThreadListAggregationSnapshot
  ): void {
    if (this.entryByKey.has(key)) {
      this.entryByKey.delete(key);
    }

    this.entryByKey.set(key, {
      query: this.cloneQuery(query),
      snapshot: this.cloneSnapshot(snapshot),
      expiresAtEpochMs: Date.now() + this.timeToLiveMs
    });

    this.evictUntilWithinBounds();
  }

  private evictUntilWithinBounds(): void {
    while (this.entryByKey.size > this.maximumEntries) {
      const oldestEntryKey = this.entryByKey.keys().next().value;
      if (!oldestEntryKey) {
        return;
      }
      this.entryByKey.delete(oldestEntryKey);
      this.evictionCount += 1;
    }
  }

  private normalizeQuery(query: ThreadListAggregationQuery): ThreadListAggregationQuery {
    return {
      enabledAgentIds: [...query.enabledAgentIds].sort((left, right) => left.localeCompare(right)),
      limit: query.limit,
      archived: query.archived,
      all: query.all,
      maxPages: query.maxPages,
      sortKey: query.sortKey,
      cwd: query.cwd
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
      cwd: query.cwd
    };
  }

  private cloneThreadListItem(threadListItem: ThreadListItemWithAgentId): ThreadListItemWithAgentId {
    return {
      ...threadListItem
    };
  }

  private buildKey(query: ThreadListAggregationQuery): string {
    return JSON.stringify({
      enabledAgentIds: query.enabledAgentIds,
      limit: query.limit,
      archived: query.archived,
      all: query.all,
      maxPages: query.maxPages,
      sortKey: query.sortKey,
      cwd: query.cwd
    });
  }
}
