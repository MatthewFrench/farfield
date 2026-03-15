import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { DebugWorkspaceDataSnapshot } from "@/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
import type { DebugWorkspaceStateStore } from "@/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import { ThreadGroupSelectors } from "@/Features/Threads/DomainModel/ThreadGroupSelectors";
import {
  type LoadActiveThreadStateResult,
  type ThreadListStateController,
} from "@/Features/Threads/StateManagement/ThreadListStateController";
import type { AgentId } from "@/Shared/Contracts/ApiContracts";
import type { CapabilitiesCollectionSnapshot } from "./CoreDataSnapshotCapabilitiesDerivation";
import type {
  CoreDataAgentDescriptor,
  CoreDataAgentsResponse,
  CoreDataConfigDefaultsResponse,
  CoreDataDebugErrorsResponse,
  CoreDataHealthResponse,
  CoreDataHistoryResponse,
  CoreDataModelsResponse,
  CoreDataModesResponse,
  CoreDataThreadsResponse,
  CoreDataTraceStatusResponse,
} from "./CoreDataSnapshotContracts";
import {
  shouldReusePreviousAgentDescriptors,
  shouldReusePreviousConfigDefaults,
  shouldReusePreviousHealth,
  shouldReusePreviousTraceStatus,
} from "./CoreDataSnapshotReusePolicy";

type Health = CoreDataHealthResponse;
type ConfigDefaults = CoreDataConfigDefaultsResponse;
type ThreadsResponse = CoreDataThreadsResponse;
type ModesResponse = CoreDataModesResponse;
type ModelsResponse = CoreDataModelsResponse;
type AgentsResponse = CoreDataAgentsResponse;
type TraceStatus = CoreDataTraceStatusResponse;
type HistoryResponse = CoreDataHistoryResponse;
type DebugErrorsResponse = CoreDataDebugErrorsResponse;
type AgentDescriptor = CoreDataAgentDescriptor;

const FIRST_ENABLED_AGENT_INDEX = 0;

interface ApplySignedCollectionStateUpdateInput<InputCollection> {
  previousSignatureRef: MutableRefObject<string[]>;
  nextSignature: string[];
  nextCollection: InputCollection;
  setCollection: Dispatch<SetStateAction<InputCollection>>;
}

export interface ApplyDebugWorkspaceSnapshotInput {
  snapshot: DebugWorkspaceDataSnapshot;
  debugWorkspaceStateStore: DebugWorkspaceStateStore;
  debugErrorsSignatureRef: MutableRefObject<string[]>;
  setHistory: Dispatch<SetStateAction<HistoryResponse["history"]>>;
  setDebugErrors: Dispatch<SetStateAction<DebugErrorsResponse["data"]>>;
  setDebugErrorSessionId: Dispatch<SetStateAction<string>>;
  setDebugErrorSessionLogPath: Dispatch<SetStateAction<string>>;
}

export interface ApplyHealthSnapshotInput {
  nextHealth: Health;
  setHealth: Dispatch<SetStateAction<Health | null>>;
}

export interface ApplyActiveThreadSnapshotInput {
  nextActiveThreadState: LoadActiveThreadStateResult;
  setThreads: Dispatch<SetStateAction<ThreadsResponse["data"]>>;
  setUnreadThreadIds: Dispatch<SetStateAction<Record<string, true>>>;
}

export interface ApplyCapabilitiesSnapshotInput {
  nextCapabilitiesSnapshot: CapabilitiesCollectionSnapshot;
  modesSignatureRef: MutableRefObject<string[]>;
  modelsSignatureRef: MutableRefObject<string[]>;
  setModes: Dispatch<SetStateAction<ModesResponse["data"]>>;
  setModels: Dispatch<SetStateAction<ModelsResponse["data"]>>;
  setConfigDefaults: Dispatch<SetStateAction<ConfigDefaults | null>>;
}

export interface ApplyTraceStatusSnapshotInput {
  nextTraceStatus: TraceStatus;
  setTraceStatus: Dispatch<SetStateAction<TraceStatus | null>>;
}

export interface ApplyAgentSnapshotInput {
  nextAgents: AgentsResponse;
  hasHydratedAgentSelectionRef: MutableRefObject<boolean>;
  setAgentDescriptors: Dispatch<SetStateAction<AgentDescriptor[]>>;
  setSelectedAgentId: Dispatch<SetStateAction<AgentId>>;
}

export interface ApplySelectedThreadSnapshotInput {
  preferredAgentId: AgentId | null;
  nextThreadsForSelection: ThreadsResponse["data"];
  threadListStateController: ThreadListStateController;
  setSelectedThreadId: Dispatch<SetStateAction<string | null>>;
}

export interface ApplySelectedModeKeySnapshotInput {
  nextCapabilitiesSnapshot: CapabilitiesCollectionSnapshot;
  readInitialModeKey: (modes: ModesResponse["data"]) => string;
  setSelectedModeKey: Dispatch<SetStateAction<string>>;
}

function readEnabledAgentIdentifiers(nextAgents: AgentsResponse): AgentId[] {
  return nextAgents.agents.filter((agent) => agent.enabled).map((agent) => agent.id);
}

function readNextDefaultAgentIdentifier(
  nextAgents: AgentsResponse,
  enabledAgentIdentifiers: readonly AgentId[],
): AgentId {
  return enabledAgentIdentifiers.includes(nextAgents.defaultAgentId)
    ? nextAgents.defaultAgentId
    : (enabledAgentIdentifiers[FIRST_ENABLED_AGENT_INDEX] ?? nextAgents.defaultAgentId);
}

function applySignedCollectionStateUpdate<InputCollection>(
  input: ApplySignedCollectionStateUpdateInput<InputCollection>,
): void {
  const previousSignatureRef = input.previousSignatureRef;
  if (ThreadGroupSelectors.signaturesMatch(previousSignatureRef.current, input.nextSignature)) {
    return;
  }

  previousSignatureRef.current = input.nextSignature;
  input.setCollection(input.nextCollection);
}

export function applyDebugWorkspaceSnapshot(input: ApplyDebugWorkspaceSnapshotInput): void {
  input.setHistory((previousHistory) =>
    input.debugWorkspaceStateStore.readNextHistory(previousHistory, input.snapshot.history),
  );

  if (
    input.debugWorkspaceStateStore.shouldApplyDebugErrors(
      input.debugErrorsSignatureRef.current,
      input.snapshot.debugErrorsSignature,
    )
  ) {
    const debugErrorsSignatureRef = input.debugErrorsSignatureRef;
    debugErrorsSignatureRef.current = input.snapshot.debugErrorsSignature;
    input.setDebugErrors(input.snapshot.debugErrors);
  }

  input.setDebugErrorSessionId(input.snapshot.debugErrorSessionId);
  input.setDebugErrorSessionLogPath(input.snapshot.debugErrorSessionLogPath);
}

export function applyHealthSnapshot(input: ApplyHealthSnapshotInput): void {
  input.setHealth((previousHealth) => {
    if (shouldReusePreviousHealth(previousHealth, input.nextHealth)) {
      return previousHealth;
    }
    return input.nextHealth;
  });
}

export function applyActiveThreadSnapshot(
  input: ApplyActiveThreadSnapshotInput,
): ThreadsResponse["data"] {
  if (input.nextActiveThreadState.didChangeThreads) {
    input.setThreads(input.nextActiveThreadState.nextThreads);
  }

  input.setUnreadThreadIds((previousUnreadThreadIdentifiers) => {
    if (
      ThreadGroupSelectors.unreadThreadIdentifierMapsMatch(
        previousUnreadThreadIdentifiers,
        input.nextActiveThreadState.nextUnreadThreadIdentifiers,
      )
    ) {
      return previousUnreadThreadIdentifiers;
    }
    return input.nextActiveThreadState.nextUnreadThreadIdentifiers;
  });

  return input.nextActiveThreadState.nextThreads;
}

export function applyCapabilitiesSnapshot(input: ApplyCapabilitiesSnapshotInput): void {
  applySignedCollectionStateUpdate({
    previousSignatureRef: input.modesSignatureRef,
    nextSignature: input.nextCapabilitiesSnapshot.modesSignature,
    nextCollection: input.nextCapabilitiesSnapshot.modes,
    setCollection: input.setModes,
  });
  applySignedCollectionStateUpdate({
    previousSignatureRef: input.modelsSignatureRef,
    nextSignature: input.nextCapabilitiesSnapshot.modelsSignature,
    nextCollection: input.nextCapabilitiesSnapshot.models,
    setCollection: input.setModels,
  });

  if (!input.nextCapabilitiesSnapshot.defaults) {
    return;
  }

  const nextDefaults = input.nextCapabilitiesSnapshot.defaults;
  input.setConfigDefaults((previousDefaults) => {
    if (shouldReusePreviousConfigDefaults(previousDefaults, nextDefaults)) {
      return previousDefaults;
    }
    return nextDefaults;
  });
}

export function applyTraceStatusSnapshot(input: ApplyTraceStatusSnapshotInput): void {
  input.setTraceStatus((previousTraceStatus) => {
    if (shouldReusePreviousTraceStatus(previousTraceStatus, input.nextTraceStatus)) {
      return previousTraceStatus;
    }
    return input.nextTraceStatus;
  });
}

export function applyAgentSnapshot(input: ApplyAgentSnapshotInput): AgentId {
  input.setAgentDescriptors((previousDescriptors) => {
    if (shouldReusePreviousAgentDescriptors(previousDescriptors, input.nextAgents.agents)) {
      return previousDescriptors;
    }
    return input.nextAgents.agents;
  });

  const enabledAgents = readEnabledAgentIdentifiers(input.nextAgents);
  const nextDefaultAgent = readNextDefaultAgentIdentifier(input.nextAgents, enabledAgents);
  input.setSelectedAgentId((currentAgentId) => {
    const hasHydratedAgentSelectionRef = input.hasHydratedAgentSelectionRef;
    if (!hasHydratedAgentSelectionRef.current) {
      hasHydratedAgentSelectionRef.current = true;
      return nextDefaultAgent;
    }
    return enabledAgents.includes(currentAgentId) ? currentAgentId : nextDefaultAgent;
  });
  return nextDefaultAgent;
}

export function applySelectedThreadSnapshot(input: ApplySelectedThreadSnapshotInput): void {
  input.setSelectedThreadId((currentSelectedThreadIdentifier) =>
    input.threadListStateController.computeInitialSelectedThreadIdentifier({
      currentSelectedThreadIdentifier,
      preferredAgentIdentifier: input.preferredAgentId,
      nextThreads: input.nextThreadsForSelection,
    }),
  );
}

export function applySelectedModeKeySnapshot(input: ApplySelectedModeKeySnapshotInput): void {
  input.setSelectedModeKey((currentModeKey) => {
    if (currentModeKey.length > 0) {
      return currentModeKey;
    }
    return input.readInitialModeKey(input.nextCapabilitiesSnapshot.modes);
  });
}
