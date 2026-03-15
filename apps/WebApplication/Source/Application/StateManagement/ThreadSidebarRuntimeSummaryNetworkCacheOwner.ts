import { z } from "zod";
import type {
  ThreadSidebarAccountSummary,
  ThreadSidebarAppsSummary,
  ThreadSidebarRateLimitSummary,
} from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";

const SnapshotTimeToLiveMillisecondsSchema = z.number().finite().positive();
const EpochMillisecondsSchema = z.number().finite().nonnegative();

const DEFAULT_SNAPSHOT_TIME_TO_LIVE_MILLISECONDS = 60_000;

export interface ThreadSidebarRuntimeSummaryNetworkSnapshot {
  account: ThreadSidebarAccountSummary | null;
  rateLimits: ThreadSidebarRateLimitSummary | null;
  apps: ThreadSidebarAppsSummary | null;
}

export interface ThreadSidebarRuntimeSummaryNetworkSnapshotCoverage {
  account: boolean;
  rateLimits: boolean;
  apps: boolean;
}

interface CachedThreadSidebarRuntimeSummaryNetworkSnapshot {
  agentId: AgentId;
  fetchedAt: number;
  snapshot: ThreadSidebarRuntimeSummaryNetworkSnapshot;
  coverage: ThreadSidebarRuntimeSummaryNetworkSnapshotCoverage;
}

type ThreadSidebarRuntimeSummaryInFlightCacheKey = string;

/**
 * Owns bounded cache state for network-derived sidebar runtime summary slices.
 * Visibility-gated consumers can reuse the last snapshot immediately and refresh in the
 * background once the snapshot becomes stale.
 */
export class ThreadSidebarRuntimeSummaryNetworkCacheOwner {
  private readonly snapshotTimeToLiveMilliseconds: number;
  private readonly cachedSnapshotByAgentIdentifier = new Map<
    AgentId,
    CachedThreadSidebarRuntimeSummaryNetworkSnapshot
  >();
  private readonly inFlightSnapshotPromiseByCacheKey = new Map<
    ThreadSidebarRuntimeSummaryInFlightCacheKey,
    Promise<ThreadSidebarRuntimeSummaryNetworkSnapshot>
  >();

  public constructor(snapshotTimeToLiveMilliseconds = DEFAULT_SNAPSHOT_TIME_TO_LIVE_MILLISECONDS) {
    this.snapshotTimeToLiveMilliseconds = SnapshotTimeToLiveMillisecondsSchema.parse(
      snapshotTimeToLiveMilliseconds,
    );
  }

  public readSnapshot(agentIdentifier: AgentId): ThreadSidebarRuntimeSummaryNetworkSnapshot | null {
    return this.cachedSnapshotByAgentIdentifier.get(agentIdentifier)?.snapshot ?? null;
  }

  public readSnapshotIfFresh(
    agentIdentifier: AgentId,
    requiredCoverage: ThreadSidebarRuntimeSummaryNetworkSnapshotCoverage,
    nowEpochMilliseconds = Date.now(),
  ): ThreadSidebarRuntimeSummaryNetworkSnapshot | null {
    const cachedSnapshot = this.cachedSnapshotByAgentIdentifier.get(agentIdentifier);
    if (cachedSnapshot === undefined) {
      return null;
    }

    const now = EpochMillisecondsSchema.parse(nowEpochMilliseconds);
    if (now - cachedSnapshot.fetchedAt >= this.snapshotTimeToLiveMilliseconds) {
      return null;
    }

    if (!this.coversRequiredSlices(cachedSnapshot.coverage, requiredCoverage)) {
      return null;
    }

    return cachedSnapshot.snapshot;
  }

  public async readFreshOrLoad(input: {
    agentIdentifier: AgentId;
    requiredCoverage: ThreadSidebarRuntimeSummaryNetworkSnapshotCoverage;
    loadSnapshot: () => Promise<ThreadSidebarRuntimeSummaryNetworkSnapshot>;
  }): Promise<ThreadSidebarRuntimeSummaryNetworkSnapshot> {
    const freshSnapshot = this.readSnapshotIfFresh(input.agentIdentifier, input.requiredCoverage);
    if (freshSnapshot !== null) {
      return freshSnapshot;
    }

    const inFlightCacheKey = this.buildInFlightCacheKey(
      input.agentIdentifier,
      input.requiredCoverage,
    );
    const existingInFlightSnapshotPromise =
      this.inFlightSnapshotPromiseByCacheKey.get(inFlightCacheKey);
    if (existingInFlightSnapshotPromise !== undefined) {
      return existingInFlightSnapshotPromise;
    }

    const inFlightSnapshotPromise = input
      .loadSnapshot()
      .then((snapshot) => {
        this.writeSnapshot(input.agentIdentifier, snapshot, input.requiredCoverage);
        return snapshot;
      })
      .finally(() => {
        const currentInFlightSnapshotPromise =
          this.inFlightSnapshotPromiseByCacheKey.get(inFlightCacheKey);
        if (currentInFlightSnapshotPromise === inFlightSnapshotPromise) {
          this.inFlightSnapshotPromiseByCacheKey.delete(inFlightCacheKey);
        }
      });

    this.inFlightSnapshotPromiseByCacheKey.set(inFlightCacheKey, inFlightSnapshotPromise);
    return inFlightSnapshotPromise;
  }

  public writeSnapshot(
    agentIdentifier: AgentId,
    snapshot: ThreadSidebarRuntimeSummaryNetworkSnapshot,
    coverage: ThreadSidebarRuntimeSummaryNetworkSnapshotCoverage,
    fetchedAtEpochMilliseconds = Date.now(),
  ): void {
    this.cachedSnapshotByAgentIdentifier.set(agentIdentifier, {
      agentId: agentIdentifier,
      fetchedAt: EpochMillisecondsSchema.parse(fetchedAtEpochMilliseconds),
      snapshot,
      coverage,
    });
  }

  private coversRequiredSlices(
    actualCoverage: ThreadSidebarRuntimeSummaryNetworkSnapshotCoverage,
    requiredCoverage: ThreadSidebarRuntimeSummaryNetworkSnapshotCoverage,
  ): boolean {
    return (
      (!requiredCoverage.account || actualCoverage.account) &&
      (!requiredCoverage.rateLimits || actualCoverage.rateLimits) &&
      (!requiredCoverage.apps || actualCoverage.apps)
    );
  }

  private buildInFlightCacheKey(
    agentIdentifier: AgentId,
    requiredCoverage: ThreadSidebarRuntimeSummaryNetworkSnapshotCoverage,
  ): ThreadSidebarRuntimeSummaryInFlightCacheKey {
    return `${agentIdentifier}:${requiredCoverage.account ? "1" : "0"}:${requiredCoverage.rateLimits ? "1" : "0"}:${requiredCoverage.apps ? "1" : "0"}`;
  }
}
