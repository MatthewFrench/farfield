import type {
  Dispatch,
  MutableRefObject,
  SetStateAction
} from "react";
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
import { DebugWorkspaceStateStore } from "@/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import { ThreadGroupSelectors } from "@/Features/Threads/DomainModel/ThreadGroupSelectors";
import type { ThreadListResponse } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import {
  type LoadActiveThreadStateResult,
  ThreadListStateController
} from "@/Features/Threads/StateManagement/ThreadListStateController";
import type { AgentId } from "@/Shared/Contracts/ApiContracts";

interface CapabilitySnapshot {
  modes: CapabilityCollaborationModesResponse;
  models: CapabilityModelsResponse;
  defaults: CapabilityConfigDefaultsResponse | null;
  fetchedAt: number;
}

type Health = CapabilityHealthResponse;
type ConfigDefaults = CapabilityConfigDefaultsResponse;
type ThreadsResponse = ThreadListResponse;
type ModesResponse = CapabilityCollaborationModesResponse;
type ModelsResponse = CapabilityModelsResponse;
type AgentsResponse = CapabilityAgentsResponse;
type TraceStatus = DebugTraceStatusResponse;
type HistoryResponse = DebugHistoryResponse;
type DebugErrorsResponse = DebugErrorListResponse;
type AgentDescriptor = AgentsResponse["agents"][number];

export interface ApplyCoreDataSnapshotStateInput {
  nextHealth?: Health;
  nextActiveThreadState?: LoadActiveThreadStateResult;
  nextTraceStatus?: TraceStatus;
  nextAgents?: AgentsResponse | null;
  nextCapabilities?: CapabilitySnapshot;
  debugWorkspaceData?: DebugWorkspaceDataSnapshot | null;
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

function applyDebugWorkspaceSnapshot(input: {
  snapshot: DebugWorkspaceDataSnapshot;
  debugWorkspaceStateStore: DebugWorkspaceStateStore;
  debugErrorsSignatureRef: MutableRefObject<string[]>;
  setHistory: Dispatch<SetStateAction<HistoryResponse["history"]>>;
  setDebugErrors: Dispatch<SetStateAction<DebugErrorsResponse["data"]>>;
  setDebugErrorSessionId: Dispatch<SetStateAction<string>>;
  setDebugErrorSessionLogPath: Dispatch<SetStateAction<string>>;
}): void {
  input.setHistory((previousHistory) =>
    input.debugWorkspaceStateStore.readNextHistory(previousHistory, input.snapshot.history)
  );

  if (
    input.debugWorkspaceStateStore.shouldApplyDebugErrors(
      input.debugErrorsSignatureRef.current,
      input.snapshot.debugErrorsSignature
    )
  ) {
    input.debugErrorsSignatureRef.current = input.snapshot.debugErrorsSignature;
    input.setDebugErrors(input.snapshot.debugErrors);
  }

  input.setDebugErrorSessionId(input.snapshot.debugErrorSessionId);
  input.setDebugErrorSessionLogPath(input.snapshot.debugErrorSessionLogPath);
}

export function applyCoreDataSnapshotState(input: ApplyCoreDataSnapshotStateInput): void {
  const nextCapabilities = input.nextCapabilities;
  const nextHealth = input.nextHealth;
  const nextActiveThreadState = input.nextActiveThreadState;
  const nextTraceStatus = input.nextTraceStatus;
  const nextModesSignature = nextCapabilities
    ? nextCapabilities.modes.data.map((mode) =>
      [mode.mode, mode.name, mode.reasoning_effort ?? ""].join("|")
    )
    : null;
  const nextModelsSignature = nextCapabilities
    ? nextCapabilities.models.data.map((model) =>
      [model.id, model.displayName ?? ""].join("|")
    )
    : null;

  let preferredAgentId: AgentId | null = null;
  let nextThreadsForSelection: ThreadsResponse["data"] | null = null;

  if (nextHealth) {
    input.setHealth((previousHealth) => {
      if (
        previousHealth
        && previousHealth.state.appReady === nextHealth.state.appReady
        && previousHealth.state.ipcConnected === nextHealth.state.ipcConnected
        && previousHealth.state.ipcInitialized === nextHealth.state.ipcInitialized
        && previousHealth.state.gitCommit === nextHealth.state.gitCommit
        && previousHealth.state.lastError === nextHealth.state.lastError
        && previousHealth.state.historyCount === nextHealth.state.historyCount
        && previousHealth.state.threadOwnerCount === nextHealth.state.threadOwnerCount
      ) {
        return previousHealth;
      }
      return nextHealth;
    });
  }

  if (nextActiveThreadState) {
    if (nextActiveThreadState.didChangeThreads) {
      input.setThreads(nextActiveThreadState.nextThreads);
    }
    nextThreadsForSelection = nextActiveThreadState.nextThreads;

    input.setUnreadThreadIds((previousUnreadThreadIdentifiers) => {
      if (
        ThreadGroupSelectors.unreadThreadIdentifierMapsMatch(
          previousUnreadThreadIdentifiers,
          nextActiveThreadState.nextUnreadThreadIdentifiers
        )
      ) {
        return previousUnreadThreadIdentifiers;
      }
      return nextActiveThreadState.nextUnreadThreadIdentifiers;
    });
  }

  if (
    nextCapabilities
    && nextModesSignature
    && !ThreadGroupSelectors.signaturesMatch(input.modesSignatureRef.current, nextModesSignature)
  ) {
    input.modesSignatureRef.current = nextModesSignature;
    input.setModes(nextCapabilities.modes.data);
  }

  if (
    nextCapabilities
    && nextModelsSignature
    && !ThreadGroupSelectors.signaturesMatch(input.modelsSignatureRef.current, nextModelsSignature)
  ) {
    input.modelsSignatureRef.current = nextModelsSignature;
    input.setModels(nextCapabilities.models.data);
  }

  if (nextCapabilities?.defaults) {
    input.setConfigDefaults((previousDefaults) => {
      if (
        previousDefaults
        && previousDefaults.agentId === nextCapabilities.defaults?.agentId
        && previousDefaults.model === nextCapabilities.defaults?.model
        && previousDefaults.reasoningEffort === nextCapabilities.defaults?.reasoningEffort
      ) {
        return previousDefaults;
      }
      return nextCapabilities.defaults;
    });
  }

  if (nextTraceStatus) {
    input.setTraceStatus((previousTraceStatus) => {
      if (
        previousTraceStatus
        && previousTraceStatus.active?.id === nextTraceStatus.active?.id
        && previousTraceStatus.active?.eventCount === nextTraceStatus.active?.eventCount
        && previousTraceStatus.recent.length === nextTraceStatus.recent.length
        && previousTraceStatus.recent[0]?.id === nextTraceStatus.recent[0]?.id
        && previousTraceStatus.recent[0]?.eventCount === nextTraceStatus.recent[0]?.eventCount
      ) {
        return previousTraceStatus;
      }
      return nextTraceStatus;
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
      setDebugErrorSessionLogPath: input.setDebugErrorSessionLogPath
    });
  }

  const nextAgents = input.nextAgents;
  if (nextAgents) {
    input.setAgentDescriptors((previousDescriptors) => {
      if (
        previousDescriptors.length === nextAgents.agents.length
        && previousDescriptors.every((descriptor, index) => {
          const nextDescriptor = nextAgents.agents[index];
          if (!nextDescriptor) {
            return false;
          }
          return (
            descriptor.id === nextDescriptor.id
            && descriptor.enabled === nextDescriptor.enabled
            && descriptor.connected === nextDescriptor.connected
          );
        })
      ) {
        return previousDescriptors;
      }
      return nextAgents.agents;
    });

    const enabledAgents = nextAgents.agents
      .filter((agent) => agent.enabled)
      .map((agent) => agent.id);
    const nextDefaultAgent = enabledAgents.includes(nextAgents.defaultAgentId)
      ? nextAgents.defaultAgentId
      : (enabledAgents[0] ?? nextAgents.defaultAgentId);

    preferredAgentId = nextDefaultAgent;
    input.setSelectedAgentId((currentAgentId) => {
      if (!input.hasHydratedAgentSelectionRef.current) {
        input.hasHydratedAgentSelectionRef.current = true;
        return nextDefaultAgent;
      }
      return enabledAgents.includes(currentAgentId) ? currentAgentId : nextDefaultAgent;
    });
  }

  if (nextThreadsForSelection) {
    input.setSelectedThreadId((currentSelectedThreadIdentifier) =>
      input.threadListStateController.computeInitialSelectedThreadIdentifier({
        currentSelectedThreadIdentifier,
        preferredAgentIdentifier: preferredAgentId,
        nextThreads: nextThreadsForSelection
      })
    );
  }

  if (nextCapabilities) {
    input.setSelectedModeKey((currentModeKey) => {
      if (currentModeKey) {
        return currentModeKey;
      }
      return input.readInitialModeKey(nextCapabilities.modes.data);
    });
  }
}
