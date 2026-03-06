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

interface CachedThreadSidebarRuntimeSummaryNetworkSnapshot {
  agentId: AgentId;
  fetchedAt: number;
  snapshot: ThreadSidebarRuntimeSummaryNetworkSnapshot;
}

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

    return cachedSnapshot.snapshot;
  }

  public writeSnapshot(
    agentIdentifier: AgentId,
    snapshot: ThreadSidebarRuntimeSummaryNetworkSnapshot,
    fetchedAtEpochMilliseconds = Date.now(),
  ): void {
    this.cachedSnapshotByAgentIdentifier.set(agentIdentifier, {
      agentId: agentIdentifier,
      fetchedAt: EpochMillisecondsSchema.parse(fetchedAtEpochMilliseconds),
      snapshot,
    });
  }
}
