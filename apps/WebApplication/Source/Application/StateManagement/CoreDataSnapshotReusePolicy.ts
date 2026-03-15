import type {
  CoreDataAgentDescriptor,
  CoreDataConfigDefaultsResponse,
  CoreDataHealthResponse,
  CoreDataTraceStatusResponse,
} from "./CoreDataSnapshotContracts";

type Health = CoreDataHealthResponse;
type ConfigDefaults = CoreDataConfigDefaultsResponse;
type TraceStatus = CoreDataTraceStatusResponse;
type AgentDescriptor = CoreDataAgentDescriptor;

const PRIMARY_RECENT_TRACE_INDEX = 0;

interface TraceStatusComparisonSnapshot {
  activeIdentifier: string | null;
  activeEventCount: number | null;
  recentTraceCount: number;
  primaryRecentIdentifier: string | null;
  primaryRecentEventCount: number | null;
}

function readTraceStatusComparisonSnapshot(
  traceStatus: TraceStatus,
): TraceStatusComparisonSnapshot {
  const activeTrace = traceStatus.active;
  const primaryRecentTrace = traceStatus.recent[PRIMARY_RECENT_TRACE_INDEX];
  return {
    activeIdentifier: activeTrace?.id ?? null,
    activeEventCount: activeTrace?.eventCount ?? null,
    recentTraceCount: traceStatus.recent.length,
    primaryRecentIdentifier: primaryRecentTrace?.id ?? null,
    primaryRecentEventCount: primaryRecentTrace?.eventCount ?? null,
  };
}

export function shouldReusePreviousHealth(
  previousHealth: Health | null,
  nextHealth: Health,
): boolean {
  if (!previousHealth) {
    return false;
  }

  return (
    previousHealth.state.appReady === nextHealth.state.appReady &&
    previousHealth.state.ipcConnected === nextHealth.state.ipcConnected &&
    previousHealth.state.ipcInitialized === nextHealth.state.ipcInitialized &&
    previousHealth.state.gitCommit === nextHealth.state.gitCommit &&
    previousHealth.state.lastError === nextHealth.state.lastError &&
    previousHealth.state.historyCount === nextHealth.state.historyCount &&
    previousHealth.state.threadOwnerCount === nextHealth.state.threadOwnerCount
  );
}

export function shouldReusePreviousConfigDefaults(
  previousDefaults: ConfigDefaults | null,
  nextDefaults: ConfigDefaults,
): boolean {
  if (!previousDefaults) {
    return false;
  }

  return (
    previousDefaults.agentId === nextDefaults.agentId &&
    previousDefaults.model === nextDefaults.model &&
    previousDefaults.reasoningEffort === nextDefaults.reasoningEffort
  );
}

export function shouldReusePreviousTraceStatus(
  previousTraceStatus: TraceStatus | null,
  nextTraceStatus: TraceStatus,
): boolean {
  if (!previousTraceStatus) {
    return false;
  }

  const previousTraceStatusSnapshot = readTraceStatusComparisonSnapshot(previousTraceStatus);
  const nextTraceStatusSnapshot = readTraceStatusComparisonSnapshot(nextTraceStatus);
  return (
    previousTraceStatusSnapshot.activeIdentifier === nextTraceStatusSnapshot.activeIdentifier &&
    previousTraceStatusSnapshot.activeEventCount === nextTraceStatusSnapshot.activeEventCount &&
    previousTraceStatusSnapshot.recentTraceCount === nextTraceStatusSnapshot.recentTraceCount &&
    previousTraceStatusSnapshot.primaryRecentIdentifier ===
      nextTraceStatusSnapshot.primaryRecentIdentifier &&
    previousTraceStatusSnapshot.primaryRecentEventCount ===
      nextTraceStatusSnapshot.primaryRecentEventCount
  );
}

export function shouldReusePreviousAgentDescriptors(
  previousDescriptors: AgentDescriptor[],
  nextDescriptors: AgentDescriptor[],
): boolean {
  return (
    previousDescriptors.length === nextDescriptors.length &&
    previousDescriptors.every((descriptor, index) => {
      const nextDescriptor = nextDescriptors[index];
      if (!nextDescriptor) {
        return false;
      }
      return (
        descriptor.id === nextDescriptor.id &&
        descriptor.enabled === nextDescriptor.enabled &&
        descriptor.connected === nextDescriptor.connected
      );
    })
  );
}
