import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { DebugWorkspaceStateStore } from "@/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import type { ThreadListStateController } from "@/Features/Threads/StateManagement/ThreadListStateController";
import type { AgentId } from "@/Shared/Contracts/ApiContracts";
import { readCapabilitiesCollectionSnapshot } from "./CoreDataSnapshotCapabilitiesDerivation";
import type {
  CoreDataAgentDescriptor,
  CoreDataConfigDefaultsResponse,
  CoreDataDebugErrorsResponse,
  CoreDataHealthResponse,
  CoreDataHistoryResponse,
  CoreDataModelsResponse,
  CoreDataModesResponse,
  CoreDataSnapshotStateDelta,
  CoreDataThreadsResponse,
  CoreDataTraceStatusResponse,
} from "./CoreDataSnapshotContracts";
import {
  applyActiveThreadSnapshot,
  applyAgentSnapshot,
  applyCapabilitiesSnapshot,
  applyDebugWorkspaceSnapshot,
  applyHealthSnapshot,
  applySelectedModeKeySnapshot,
  applySelectedThreadSnapshot,
  applyTraceStatusSnapshot,
} from "./CoreDataSnapshotStateSectionAppliers";

type Health = CoreDataHealthResponse;
type ConfigDefaults = CoreDataConfigDefaultsResponse;
type ThreadsResponse = CoreDataThreadsResponse;
type ModesResponse = CoreDataModesResponse;
type ModelsResponse = CoreDataModelsResponse;
type TraceStatus = CoreDataTraceStatusResponse;
type HistoryResponse = CoreDataHistoryResponse;
type DebugErrorsResponse = CoreDataDebugErrorsResponse;
type AgentDescriptor = CoreDataAgentDescriptor;

/**
 * Applies one core data snapshot into app shell state with strict identity checks.
 * Signature and section-level apply logic are delegated to dedicated owner modules
 * so refresh orchestration remains deterministic and readable.
 */
export interface ApplyCoreDataSnapshotStateInput extends CoreDataSnapshotStateDelta {
  debugWorkspaceStateStore: DebugWorkspaceStateStore;
  threadListStateController: ThreadListStateController;
  debugErrorsSignatureRef: MutableRefObject<string[]>;
  modesSignatureRef: MutableRefObject<string[]>;
  modelsSignatureRef: MutableRefObject<string[]>;
  hasHydratedAgentSelectionRef: MutableRefObject<boolean>;
  setHealth: Dispatch<SetStateAction<Health | null>>;
  setThreads: Dispatch<SetStateAction<ThreadsResponse["data"]>>;
  setUnreadThreadIds: Dispatch<SetStateAction<Record<string, true>>>;
  setModes: Dispatch<SetStateAction<ModesResponse["data"]>>;
  setModels: Dispatch<SetStateAction<ModelsResponse["data"]>>;
  setConfigDefaults: Dispatch<SetStateAction<ConfigDefaults | null>>;
  setTraceStatus: Dispatch<SetStateAction<TraceStatus | null>>;
  setHistory: Dispatch<SetStateAction<HistoryResponse["history"]>>;
  setDebugErrors: Dispatch<SetStateAction<DebugErrorsResponse["data"]>>;
  setDebugErrorSessionId: Dispatch<SetStateAction<string>>;
  setDebugErrorSessionLogPath: Dispatch<SetStateAction<string>>;
  setAgentDescriptors: Dispatch<SetStateAction<AgentDescriptor[]>>;
  setSelectedAgentId: Dispatch<SetStateAction<AgentId>>;
  setSelectedThreadId: Dispatch<SetStateAction<string | null>>;
  setSelectedModeKey: Dispatch<SetStateAction<string>>;
  readInitialModeKey: (modes: ModesResponse["data"]) => string;
}

export function applyCoreDataSnapshotState(input: ApplyCoreDataSnapshotStateInput): void {
  const nextCapabilitiesSnapshot = readCapabilitiesCollectionSnapshot(input.nextCapabilities);
  let nextThreadsForSelection: ThreadsResponse["data"] | null = null;

  if (input.nextHealth) {
    applyHealthSnapshot({
      nextHealth: input.nextHealth,
      setHealth: input.setHealth,
    });
  }

  if (input.nextActiveThreadState) {
    nextThreadsForSelection = applyActiveThreadSnapshot({
      nextActiveThreadState: input.nextActiveThreadState,
      setThreads: input.setThreads,
      setUnreadThreadIds: input.setUnreadThreadIds,
    });
  }

  if (nextCapabilitiesSnapshot) {
    applyCapabilitiesSnapshot({
      nextCapabilitiesSnapshot,
      modesSignatureRef: input.modesSignatureRef,
      modelsSignatureRef: input.modelsSignatureRef,
      setModes: input.setModes,
      setModels: input.setModels,
      setConfigDefaults: input.setConfigDefaults,
    });
  }

  if (input.nextTraceStatus) {
    applyTraceStatusSnapshot({
      nextTraceStatus: input.nextTraceStatus,
      setTraceStatus: input.setTraceStatus,
    });
  }

  if (input.debugWorkspaceData) {
    applyDebugWorkspaceSnapshot({
      snapshot: input.debugWorkspaceData,
      debugWorkspaceStateStore: input.debugWorkspaceStateStore,
      debugErrorsSignatureRef: input.debugErrorsSignatureRef,
      setHistory: input.setHistory,
      setDebugErrors: input.setDebugErrors,
      setDebugErrorSessionId: input.setDebugErrorSessionId,
      setDebugErrorSessionLogPath: input.setDebugErrorSessionLogPath,
    });
  }

  const preferredAgentId = input.nextAgents
    ? applyAgentSnapshot({
        nextAgents: input.nextAgents,
        hasHydratedAgentSelectionRef: input.hasHydratedAgentSelectionRef,
        setAgentDescriptors: input.setAgentDescriptors,
        setSelectedAgentId: input.setSelectedAgentId,
      })
    : null;

  if (nextThreadsForSelection) {
    applySelectedThreadSnapshot({
      preferredAgentId,
      nextThreadsForSelection,
      threadListStateController: input.threadListStateController,
      setSelectedThreadId: input.setSelectedThreadId,
    });
  }

  if (nextCapabilitiesSnapshot) {
    applySelectedModeKeySnapshot({
      nextCapabilitiesSnapshot,
      readInitialModeKey: input.readInitialModeKey,
      setSelectedModeKey: input.setSelectedModeKey,
    });
  }
}
