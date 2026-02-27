import type { HistoryEntry } from "../../Network/DebugContracts.js";

/**
 * Owns bounded activity-history retention and full-payload lookup by entry id.
 */
export class ActivityHistoryStoreOwner {
  private readonly history: HistoryEntry[] = [];
  private readonly historyById = new Map<string, HistoryEntry["payload"]>();

  public constructor(private readonly historyLimit: number) {}

  public readHistoryEntries(): HistoryEntry[] {
    return this.history.map((historyEntry) => ({
      ...historyEntry,
      meta: { ...historyEntry.meta },
    }));
  }

  public readHistoryById(): Map<string, HistoryEntry["payload"]> {
    return new Map(this.historyById);
  }

  public readHistoryCount(): number {
    return this.history.length;
  }

  public appendHistoryEntry(entry: HistoryEntry, originalPayload: HistoryEntry["payload"]): void {
    this.history.push(entry);
    this.historyById.set(entry.id, originalPayload);

    if (this.history.length > this.historyLimit) {
      const removedEntry = this.history.shift();
      if (removedEntry) {
        this.historyById.delete(removedEntry.id);
      }
    }
  }
}
