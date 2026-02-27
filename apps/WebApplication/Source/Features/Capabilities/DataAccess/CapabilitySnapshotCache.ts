import { z } from "zod";

export interface CapabilitySnapshotRecord {
  fetchedAt: number;
}

const REFRESH_INTERVAL_MILLISECONDS_SCHEMA = z.number().finite().positive();
const EPOCH_TIMESTAMP_MILLISECONDS_SCHEMA = z.number().finite().nonnegative();
const INVALID_REFRESH_INTERVAL_MESSAGE =
  "CapabilitySnapshotCache requires a positive refreshIntervalMs value";

export class CapabilitySnapshotCache<Snapshot extends CapabilitySnapshotRecord> {
  private readonly refreshIntervalMs: number;
  private snapshot: Snapshot | null;
  private inFlightSnapshotRequest: Promise<Snapshot> | null;
  private snapshotMutationSequence: number;

  public constructor(refreshIntervalMs: number) {
    this.refreshIntervalMs = readRefreshIntervalMilliseconds(refreshIntervalMs);
    this.snapshot = null;
    this.inFlightSnapshotRequest = null;
    this.snapshotMutationSequence = 0;
  }

  public readSnapshotIfFresh(nowEpochMs: number = Date.now()): Snapshot | null {
    const nowEpochMilliseconds = readEpochTimestampMilliseconds(nowEpochMs, "nowEpochMs");
    if (!this.snapshot) {
      return null;
    }
    const snapshotFetchedAtEpochMilliseconds = readEpochTimestampMilliseconds(
      this.snapshot.fetchedAt,
      "snapshot.fetchedAt",
    );
    if (nowEpochMilliseconds - snapshotFetchedAtEpochMilliseconds >= this.refreshIntervalMs) {
      return null;
    }
    return this.snapshot;
  }

  public overwriteSnapshot(snapshot: Snapshot): void {
    readEpochTimestampMilliseconds(snapshot.fetchedAt, "snapshot.fetchedAt");
    this.snapshot = snapshot;
    this.snapshotMutationSequence += 1;
  }

  public clearSnapshot(): void {
    this.snapshot = null;
    this.snapshotMutationSequence += 1;
  }

  public async readSnapshot(
    loadSnapshot: () => Promise<Snapshot>,
    nowEpochMs: number = Date.now(),
  ): Promise<Snapshot> {
    const freshSnapshot = this.readSnapshotIfFresh(nowEpochMs);
    if (freshSnapshot) {
      return freshSnapshot;
    }
    if (this.inFlightSnapshotRequest) {
      return this.inFlightSnapshotRequest;
    }

    const snapshotMutationSequenceAtReadStart = this.snapshotMutationSequence;
    const inFlightSnapshotRequest = loadSnapshot()
      .then((snapshot) => {
        if (snapshotMutationSequenceAtReadStart === this.snapshotMutationSequence) {
          this.overwriteSnapshot(snapshot);
        }
        return snapshot;
      })
      .finally(() => {
        this.inFlightSnapshotRequest = null;
      });

    this.inFlightSnapshotRequest = inFlightSnapshotRequest;
    return inFlightSnapshotRequest;
  }
}

function readRefreshIntervalMilliseconds(value: number): number {
  const parsedValue = REFRESH_INTERVAL_MILLISECONDS_SCHEMA.safeParse(value);
  if (!parsedValue.success) {
    throw new Error(INVALID_REFRESH_INTERVAL_MESSAGE);
  }
  return parsedValue.data;
}

function readEpochTimestampMilliseconds(value: number, valueName: string): number {
  const parsedValue = EPOCH_TIMESTAMP_MILLISECONDS_SCHEMA.safeParse(value);
  if (!parsedValue.success) {
    throw new Error(
      `CapabilitySnapshotCache requires ${valueName} to be a finite non-negative epoch timestamp`,
    );
  }
  return parsedValue.data;
}
