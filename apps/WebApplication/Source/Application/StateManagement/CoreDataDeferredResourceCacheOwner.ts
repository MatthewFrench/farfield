import { z } from "zod";
import type { CoreDataAgentsResponse, CoreDataHealthResponse } from "./CoreDataSnapshotContracts";

const PositiveMillisecondsSchema = z.number().finite().positive();
const EpochMillisecondsSchema = z.number().finite().nonnegative();

const DEFAULT_HEALTH_TIME_TO_LIVE_MILLISECONDS = 15_000;
const DEFAULT_AGENTS_TIME_TO_LIVE_MILLISECONDS = 60_000;

interface DeferredResourceSnapshot<ValueType> {
  fetchedAtEpochMilliseconds: number;
  value: ValueType;
}

/**
 * Owns TTL-based cache state for deferred core-data resources that do not need to be fetched on
 * every thread-list refresh. Health and agent descriptors can be temporarily stale without
 * harming core chat/sidebar behavior.
 */
export class CoreDataDeferredResourceCacheOwner {
  private readonly healthTimeToLiveMilliseconds: number;
  private readonly agentsTimeToLiveMilliseconds: number;
  private healthSnapshot: DeferredResourceSnapshot<CoreDataHealthResponse> | null;
  private agentsSnapshot: DeferredResourceSnapshot<CoreDataAgentsResponse> | null;

  public constructor(input?: {
    healthTimeToLiveMilliseconds?: number;
    agentsTimeToLiveMilliseconds?: number;
  }) {
    this.healthTimeToLiveMilliseconds = PositiveMillisecondsSchema.parse(
      input?.healthTimeToLiveMilliseconds ?? DEFAULT_HEALTH_TIME_TO_LIVE_MILLISECONDS,
    );
    this.agentsTimeToLiveMilliseconds = PositiveMillisecondsSchema.parse(
      input?.agentsTimeToLiveMilliseconds ?? DEFAULT_AGENTS_TIME_TO_LIVE_MILLISECONDS,
    );
    this.healthSnapshot = null;
    this.agentsSnapshot = null;
  }

  public readHealthIfFresh(nowEpochMilliseconds = Date.now()): CoreDataHealthResponse | null {
    return this.readSnapshotIfFresh(
      this.healthSnapshot,
      this.healthTimeToLiveMilliseconds,
      nowEpochMilliseconds,
    );
  }

  public writeHealth(value: CoreDataHealthResponse, fetchedAtEpochMilliseconds = Date.now()): void {
    this.healthSnapshot = {
      fetchedAtEpochMilliseconds: EpochMillisecondsSchema.parse(fetchedAtEpochMilliseconds),
      value,
    };
  }

  public readAgentsIfFresh(nowEpochMilliseconds = Date.now()): CoreDataAgentsResponse | null {
    return this.readSnapshotIfFresh(
      this.agentsSnapshot,
      this.agentsTimeToLiveMilliseconds,
      nowEpochMilliseconds,
    );
  }

  public writeAgents(value: CoreDataAgentsResponse, fetchedAtEpochMilliseconds = Date.now()): void {
    this.agentsSnapshot = {
      fetchedAtEpochMilliseconds: EpochMillisecondsSchema.parse(fetchedAtEpochMilliseconds),
      value,
    };
  }

  private readSnapshotIfFresh<ValueType>(
    snapshot: DeferredResourceSnapshot<ValueType> | null,
    timeToLiveMilliseconds: number,
    nowEpochMilliseconds: number,
  ): ValueType | null {
    if (snapshot === null) {
      return null;
    }

    const now = EpochMillisecondsSchema.parse(nowEpochMilliseconds);
    if (now - snapshot.fetchedAtEpochMilliseconds >= timeToLiveMilliseconds) {
      return null;
    }

    return snapshot.value;
  }
}
