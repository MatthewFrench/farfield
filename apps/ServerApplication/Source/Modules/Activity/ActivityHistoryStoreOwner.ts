import type { HistoryEntry } from "../../Network/DebugContracts.js";

export interface ActivityHistoryRetentionStatistics {
  historyEntryCount: number;
  detailPayloadEntryCount: number;
  replayPayloadEntryCount: number;
  totalDetailPayloadBytes: number;
  totalReplayPayloadBytes: number;
  historyLimit: number;
  detailRetentionMaximumBytes: number;
  replayRetentionMaximumBytes: number;
  historyEntryEvictionCount: number;
  detailPayloadEvictionCount: number;
  replayPayloadEvictionCount: number;
}

interface AppendActivityHistoryEntryInput {
  entry: HistoryEntry;
  detailPayload: HistoryEntry["payload"];
  replayPayload: HistoryEntry["payload"] | null;
}

interface ActivityHistoryStoreOwnerOptions {
  historyLimit: number;
  detailRetentionMaximumBytes: number;
  replayRetentionMaximumBytes: number;
}

function measurePayloadBytes(payload: HistoryEntry["payload"]): number {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

/**
 * Owns bounded activity-history entry retention plus separate detail/replay payload budgets.
 * Visible history entries, detail payloads, and replay payloads are related but not identical
 * retention surfaces, so each is tracked and evicted explicitly.
 */
export class ActivityHistoryStoreOwner {
  private readonly history: HistoryEntry[] = [];
  private readonly detailPayloadById = new Map<string, HistoryEntry["payload"]>();
  private readonly detailPayloadBytesById = new Map<string, number>();
  private readonly replayPayloadById = new Map<string, HistoryEntry["payload"]>();
  private readonly replayPayloadBytesById = new Map<string, number>();
  private readonly replayPayloadEntryIdentifiers: string[] = [];
  private totalDetailPayloadBytes = 0;
  private totalReplayPayloadBytes = 0;
  private historyEntryEvictionCount = 0;
  private detailPayloadEvictionCount = 0;
  private replayPayloadEvictionCount = 0;
  private readonly historyLimit: number;
  private readonly detailRetentionMaximumBytes: number;
  private readonly replayRetentionMaximumBytes: number;

  public constructor(options: ActivityHistoryStoreOwnerOptions) {
    this.historyLimit = options.historyLimit;
    this.detailRetentionMaximumBytes = options.detailRetentionMaximumBytes;
    this.replayRetentionMaximumBytes = options.replayRetentionMaximumBytes;
  }

  public readHistoryEntries(): HistoryEntry[] {
    return this.history.map((historyEntry) => ({
      ...historyEntry,
      meta: { ...historyEntry.meta },
    }));
  }

  public readHistoryDetailPayload(entryId: string): HistoryEntry["payload"] | null {
    return this.detailPayloadById.get(entryId) ?? null;
  }

  public readReplayPayload(entryId: string): HistoryEntry["payload"] | null {
    return this.replayPayloadById.get(entryId) ?? null;
  }

  public readHistoryCount(): number {
    return this.history.length;
  }

  public readRetentionStatistics(): ActivityHistoryRetentionStatistics {
    return {
      historyEntryCount: this.history.length,
      detailPayloadEntryCount: this.detailPayloadById.size,
      replayPayloadEntryCount: this.replayPayloadById.size,
      totalDetailPayloadBytes: this.totalDetailPayloadBytes,
      totalReplayPayloadBytes: this.totalReplayPayloadBytes,
      historyLimit: this.historyLimit,
      detailRetentionMaximumBytes: this.detailRetentionMaximumBytes,
      replayRetentionMaximumBytes: this.replayRetentionMaximumBytes,
      historyEntryEvictionCount: this.historyEntryEvictionCount,
      detailPayloadEvictionCount: this.detailPayloadEvictionCount,
      replayPayloadEvictionCount: this.replayPayloadEvictionCount,
    };
  }

  public appendHistoryEntry(input: AppendActivityHistoryEntryInput): void {
    this.history.push(input.entry);
    this.storeDetailPayload(input.entry.id, input.detailPayload);
    if (input.replayPayload !== null) {
      this.storeReplayPayload(input.entry.id, input.replayPayload);
    }
    this.enforceHistoryEntryAndDetailRetentionBudget();
    this.enforceReplayRetentionBudget();
  }

  private storeDetailPayload(entryId: string, payload: HistoryEntry["payload"]): void {
    const payloadBytes = measurePayloadBytes(payload);
    this.detailPayloadById.set(entryId, payload);
    this.detailPayloadBytesById.set(entryId, payloadBytes);
    this.totalDetailPayloadBytes += payloadBytes;
  }

  private storeReplayPayload(entryId: string, payload: HistoryEntry["payload"]): void {
    const payloadBytes = measurePayloadBytes(payload);
    this.replayPayloadById.set(entryId, payload);
    this.replayPayloadBytesById.set(entryId, payloadBytes);
    this.replayPayloadEntryIdentifiers.push(entryId);
    this.totalReplayPayloadBytes += payloadBytes;
  }

  private enforceHistoryEntryAndDetailRetentionBudget(): void {
    while (
      this.history.length > this.historyLimit ||
      this.totalDetailPayloadBytes > this.detailRetentionMaximumBytes
    ) {
      const removedEntry = this.history.shift();
      if (removedEntry === undefined) {
        return;
      }
      this.historyEntryEvictionCount += 1;
      this.deleteDetailPayload(removedEntry.id);
      this.deleteReplayPayload(removedEntry.id);
    }
  }

  private enforceReplayRetentionBudget(): void {
    while (this.totalReplayPayloadBytes > this.replayRetentionMaximumBytes) {
      const oldestReplayPayloadEntryIdentifier = this.replayPayloadEntryIdentifiers.shift();
      if (oldestReplayPayloadEntryIdentifier === undefined) {
        return;
      }
      if (!this.replayPayloadById.has(oldestReplayPayloadEntryIdentifier)) {
        continue;
      }
      this.deleteReplayPayload(oldestReplayPayloadEntryIdentifier);
    }
  }

  private deleteDetailPayload(entryId: string): void {
    const payloadBytes = this.detailPayloadBytesById.get(entryId);
    if (payloadBytes !== undefined) {
      this.totalDetailPayloadBytes -= payloadBytes;
      this.detailPayloadBytesById.delete(entryId);
      this.detailPayloadEvictionCount += 1;
    }
    this.detailPayloadById.delete(entryId);
  }

  private deleteReplayPayload(entryId: string): void {
    const payloadBytes = this.replayPayloadBytesById.get(entryId);
    if (payloadBytes !== undefined) {
      this.totalReplayPayloadBytes -= payloadBytes;
      this.replayPayloadBytesById.delete(entryId);
      this.replayPayloadEvictionCount += 1;
    }
    this.replayPayloadById.delete(entryId);
  }
}
