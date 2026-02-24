export interface CapabilitySnapshotRecord {
  fetchedAt: number;
}

export class CapabilitySnapshotCache<Snapshot extends CapabilitySnapshotRecord> {
  private readonly refreshIntervalMs: number;
  private snapshot: Snapshot | null;
  private inFlightSnapshotRequest: Promise<Snapshot> | null;

  public constructor(refreshIntervalMs: number) {
    if (!Number.isFinite(refreshIntervalMs) || refreshIntervalMs <= 0) {
      throw new Error("CapabilitySnapshotCache requires a positive refreshIntervalMs value");
    }
    this.refreshIntervalMs = refreshIntervalMs;
    this.snapshot = null;
    this.inFlightSnapshotRequest = null;
  }

  public readSnapshotIfFresh(nowEpochMs: number = Date.now()): Snapshot | null {
    if (!this.snapshot) {
      return null;
    }
    if (nowEpochMs - this.snapshot.fetchedAt >= this.refreshIntervalMs) {
      return null;
    }
    return this.snapshot;
  }

  public overwriteSnapshot(snapshot: Snapshot): void {
    this.snapshot = snapshot;
  }

  public clearSnapshot(): void {
    this.snapshot = null;
  }

  public async readSnapshot(
    loadSnapshot: () => Promise<Snapshot>,
    nowEpochMs: number = Date.now()
  ): Promise<Snapshot> {
    const freshSnapshot = this.readSnapshotIfFresh(nowEpochMs);
    if (freshSnapshot) {
      return freshSnapshot;
    }
    if (this.inFlightSnapshotRequest) {
      return this.inFlightSnapshotRequest;
    }

    const inFlightSnapshotRequest = loadSnapshot()
      .then((snapshot) => {
        this.overwriteSnapshot(snapshot);
        return snapshot;
      })
      .finally(() => {
        this.inFlightSnapshotRequest = null;
      });

    this.inFlightSnapshotRequest = inFlightSnapshotRequest;
    return inFlightSnapshotRequest;
  }
}
