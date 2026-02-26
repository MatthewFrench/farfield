import type {
  CapabilityAgentsResponse,
  CapabilityCollaborationModesResponse,
  CapabilityConfigDefaultsResponse,
  CapabilityHealthResponse,
  CapabilityModelsResponse
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugErrorListResponse,
  DebugHistoryResponse,
  DebugTraceStatusResponse
} from "@/Features/Debugging/DataAccess/DebugServerClient";
import type { DebugWorkspaceDataSnapshot } from "@/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
import type { ThreadListResponse } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import type { LoadActiveThreadStateResult } from "@/Features/Threads/StateManagement/ThreadListStateController";

/**
 * Shared contract surface for application-shell core-data snapshots.
 * Use this module so startup loaders and snapshot appliers stay in sync.
 */
export interface CoreDataCapabilitySnapshot {
  modes: CapabilityCollaborationModesResponse;
  models: CapabilityModelsResponse;
  defaults: CapabilityConfigDefaultsResponse | null;
  fetchedAt: number;
}

export type CoreDataHealthResponse = CapabilityHealthResponse;
export type CoreDataConfigDefaultsResponse = CapabilityConfigDefaultsResponse;
export type CoreDataThreadsResponse = ThreadListResponse;
export type CoreDataModesResponse = CapabilityCollaborationModesResponse;
export type CoreDataModelsResponse = CapabilityModelsResponse;
export type CoreDataAgentsResponse = CapabilityAgentsResponse;
export type CoreDataTraceStatusResponse = DebugTraceStatusResponse;
export type CoreDataHistoryResponse = DebugHistoryResponse;
export type CoreDataDebugErrorsResponse = DebugErrorListResponse;
export type CoreDataAgentDescriptor = CoreDataAgentsResponse["agents"][number];

export interface CoreDataSnapshotStateDelta {
  nextHealth?: CoreDataHealthResponse;
  nextActiveThreadState?: LoadActiveThreadStateResult;
  nextTraceStatus?: CoreDataTraceStatusResponse;
  nextAgents?: CoreDataAgentsResponse | null;
  nextCapabilities?: CoreDataCapabilitySnapshot;
  debugWorkspaceData?: DebugWorkspaceDataSnapshot | null;
}
