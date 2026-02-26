import type {
  Dispatch,
  MutableRefObject,
  SetStateAction
} from "react";
import type {
  CoreDataAgentDescriptor,
  CoreDataAgentsResponse,
  CoreDataCapabilitySnapshot,
  CoreDataConfigDefaultsResponse,
  CoreDataDebugErrorsResponse,
  CoreDataHealthResponse,
  CoreDataHistoryResponse,
  CoreDataModesResponse,
  CoreDataModelsResponse,
  CoreDataSnapshotStateDelta,
  CoreDataThreadsResponse,
  CoreDataTraceStatusResponse
} from "./CoreDataSnapshotContracts";
import { DebugWorkspaceStateStore } from "@/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import { ThreadGroupSelectors } from "@/Features/Threads/DomainModel/ThreadGroupSelectors";
import {
  type LoadActiveThreadStateResult,
  ThreadListStateController
} from "@/Features/Threads/StateManagement/ThreadListStateController";
import type { AgentId } from "@/Shared/Contracts/ApiContracts";
import type { DebugWorkspaceDataSnapshot } from "@/Features/Debugging/StateManagement/DebugWorkspaceDataReader";

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
type ModeDescriptor = ModesResponse["data"][number];
type ModelDescriptor = ModelsResponse["data"][number];
type SignatureSegment = string | null | undefined;
type ModeSignatureSegments = readonly [
  modeIdentifier: ModeDescriptor["mode"],
  modeName: ModeDescriptor["name"],
  modeReasoningEffort: ModeDescriptor["reasoning_effort"]
];
type ModelSignatureSegments = readonly [
  modelIdentifier: ModelDescriptor["id"],
  modelDisplayName: ModelDescriptor["displayName"]
];

const SIGNATURE_SEGMENT_DELIMITER = "|";
const EMPTY_SIGNATURE_SEGMENT = "";
const FIRST_ENABLED_AGENT_INDEX = 0;
const PRIMARY_RECENT_TRACE_INDEX = 0;

interface CapabilitiesCollectionSnapshot {
  modes: ModesResponse["data"];
  models: ModelsResponse["data"];
  defaults: ConfigDefaults | null;
  modesSignature: string[];
  modelsSignature: string[];
}

interface TraceStatusComparisonSnapshot {
  activeIdentifier: string | null;
  activeEventCount: number | null;
  recentTraceCount: number;
  primaryRecentIdentifier: string | null;
  primaryRecentEventCount: number | null;
}

/**
 * Applies one core data snapshot into app shell state with strict identity checks.
 * Signature builders and comparator helpers are centralized here to keep write rules
 * deterministic across startup loads and refresh loops.
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

function buildSignatureEntry(
  segments: ReadonlyArray<SignatureSegment>
): string {
  return segments.map((segment) => segment ?? EMPTY_SIGNATURE_SEGMENT).join(SIGNATURE_SEGMENT_DELIMITER);
}

function readModeSignatureSegments(mode: ModeDescriptor): ModeSignatureSegments {
  return [mode.mode, mode.name, mode.reasoning_effort];
}

function readModelSignatureSegments(model: ModelDescriptor): ModelSignatureSegments {
  return [model.id, model.displayName];
}

function buildModesSignature(modes: ModesResponse["data"]): string[] {
  return modes.map((mode) =>
    buildSignatureEntry(readModeSignatureSegments(mode))
  );
}

function buildModelsSignature(models: ModelsResponse["data"]): string[] {
  return models.map((model) =>
    buildSignatureEntry(readModelSignatureSegments(model))
  );
}

function readCapabilitiesCollectionSnapshot(
  capabilities: CoreDataCapabilitySnapshot | undefined
): CapabilitiesCollectionSnapshot | null {
  if (!capabilities) {
    return null;
  }

  const nextModes = capabilities.modes.data;
  const nextModels = capabilities.models.data;
  return {
    modes: nextModes,
    models: nextModels,
    defaults: capabilities.defaults,
    modesSignature: buildModesSignature(nextModes),
    modelsSignature: buildModelsSignature(nextModels)
  };
}

function readTraceStatusComparisonSnapshot(
  traceStatus: TraceStatus
): TraceStatusComparisonSnapshot {
  const activeTrace = traceStatus.active;
  const primaryRecentTrace = traceStatus.recent[PRIMARY_RECENT_TRACE_INDEX];
  return {
    activeIdentifier: activeTrace?.id ?? null,
    activeEventCount: activeTrace?.eventCount ?? null,
    recentTraceCount: traceStatus.recent.length,
    primaryRecentIdentifier: primaryRecentTrace?.id ?? null,
    primaryRecentEventCount: primaryRecentTrace?.eventCount ?? null
  };
}

function shouldReusePreviousHealth(previousHealth: Health | null, nextHealth: Health): boolean {
  if (!previousHealth) {
    return false;
  }

  return (
    previousHealth.state.appReady === nextHealth.state.appReady
    && previousHealth.state.ipcConnected === nextHealth.state.ipcConnected
    && previousHealth.state.ipcInitialized === nextHealth.state.ipcInitialized
    && previousHealth.state.gitCommit === nextHealth.state.gitCommit
    && previousHealth.state.lastError === nextHealth.state.lastError
    && previousHealth.state.historyCount === nextHealth.state.historyCount
    && previousHealth.state.threadOwnerCount === nextHealth.state.threadOwnerCount
  );
}

function shouldReusePreviousConfigDefaults(
  previousDefaults: ConfigDefaults | null,
  nextDefaults: ConfigDefaults
): boolean {
  if (!previousDefaults) {
    return false;
  }

  return (
    previousDefaults.agentId === nextDefaults.agentId
    && previousDefaults.model === nextDefaults.model
    && previousDefaults.reasoningEffort === nextDefaults.reasoningEffort
  );
}

function shouldReusePreviousTraceStatus(
  previousTraceStatus: TraceStatus | null,
  nextTraceStatus: TraceStatus
): boolean {
  if (!previousTraceStatus) {
    return false;
  }

  const previousTraceStatusSnapshot = readTraceStatusComparisonSnapshot(previousTraceStatus);
  const nextTraceStatusSnapshot = readTraceStatusComparisonSnapshot(nextTraceStatus);
  return (
    previousTraceStatusSnapshot.activeIdentifier === nextTraceStatusSnapshot.activeIdentifier
    && previousTraceStatusSnapshot.activeEventCount === nextTraceStatusSnapshot.activeEventCount
    && previousTraceStatusSnapshot.recentTraceCount === nextTraceStatusSnapshot.recentTraceCount
    && previousTraceStatusSnapshot.primaryRecentIdentifier === nextTraceStatusSnapshot.primaryRecentIdentifier
    && previousTraceStatusSnapshot.primaryRecentEventCount === nextTraceStatusSnapshot.primaryRecentEventCount
  );
}

function shouldReusePreviousAgentDescriptors(
  previousDescriptors: AgentDescriptor[],
  nextDescriptors: AgentDescriptor[]
): boolean {
  return (
    previousDescriptors.length === nextDescriptors.length
    && previousDescriptors.every((descriptor, index) => {
      const nextDescriptor = nextDescriptors[index];
      if (!nextDescriptor) {
        return false;
      }
      return (
        descriptor.id === nextDescriptor.id
        && descriptor.enabled === nextDescriptor.enabled
        && descriptor.connected === nextDescriptor.connected
      );
    })
  );
}

function readEnabledAgentIdentifiers(nextAgents: AgentsResponse): AgentId[] {
  return nextAgents.agents
    .filter((agent) => agent.enabled)
    .map((agent) => agent.id);
}

function readNextDefaultAgentIdentifier(
  nextAgents: AgentsResponse,
  enabledAgentIdentifiers: readonly AgentId[]
): AgentId {
  return enabledAgentIdentifiers.includes(nextAgents.defaultAgentId)
    ? nextAgents.defaultAgentId
    : (enabledAgentIdentifiers[FIRST_ENABLED_AGENT_INDEX] ?? nextAgents.defaultAgentId);
}

function applySignedCollectionStateUpdate<InputCollection>(input: {
  previousSignatureRef: MutableRefObject<string[]>;
  nextSignature: string[];
  nextCollection: InputCollection;
  setCollection: Dispatch<SetStateAction<InputCollection>>;
}): void {
  if (ThreadGroupSelectors.signaturesMatch(input.previousSignatureRef.current, input.nextSignature)) {
    return;
  }

  input.previousSignatureRef.current = input.nextSignature;
  input.setCollection(input.nextCollection);
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

function applyHealthSnapshot(input: {
  nextHealth: Health;
  setHealth: Dispatch<SetStateAction<Health | null>>;
}): void {
  input.setHealth((previousHealth) => {
    if (shouldReusePreviousHealth(previousHealth, input.nextHealth)) {
      return previousHealth;
    }
    return input.nextHealth;
  });
}

function applyActiveThreadSnapshot(input: {
  nextActiveThreadState: LoadActiveThreadStateResult;
  setThreads: Dispatch<SetStateAction<ThreadsResponse["data"]>>;
  setUnreadThreadIds: Dispatch<SetStateAction<Record<string, true>>>;
}): ThreadsResponse["data"] {
  if (input.nextActiveThreadState.didChangeThreads) {
    input.setThreads(input.nextActiveThreadState.nextThreads);
  }

  input.setUnreadThreadIds((previousUnreadThreadIdentifiers) => {
    if (
      ThreadGroupSelectors.unreadThreadIdentifierMapsMatch(
        previousUnreadThreadIdentifiers,
        input.nextActiveThreadState.nextUnreadThreadIdentifiers
      )
    ) {
      return previousUnreadThreadIdentifiers;
    }
    return input.nextActiveThreadState.nextUnreadThreadIdentifiers;
  });

  return input.nextActiveThreadState.nextThreads;
}

function applyCapabilitiesSnapshot(input: {
  nextCapabilitiesSnapshot: CapabilitiesCollectionSnapshot;
  modesSignatureRef: MutableRefObject<string[]>;
  modelsSignatureRef: MutableRefObject<string[]>;
  setModes: Dispatch<SetStateAction<ModesResponse["data"]>>;
  setModels: Dispatch<SetStateAction<ModelsResponse["data"]>>;
  setConfigDefaults: Dispatch<SetStateAction<ConfigDefaults | null>>;
}): void {
  applySignedCollectionStateUpdate({
    previousSignatureRef: input.modesSignatureRef,
    nextSignature: input.nextCapabilitiesSnapshot.modesSignature,
    nextCollection: input.nextCapabilitiesSnapshot.modes,
    setCollection: input.setModes
  });
  applySignedCollectionStateUpdate({
    previousSignatureRef: input.modelsSignatureRef,
    nextSignature: input.nextCapabilitiesSnapshot.modelsSignature,
    nextCollection: input.nextCapabilitiesSnapshot.models,
    setCollection: input.setModels
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

function applyTraceStatusSnapshot(input: {
  nextTraceStatus: TraceStatus;
  setTraceStatus: Dispatch<SetStateAction<TraceStatus | null>>;
}): void {
  input.setTraceStatus((previousTraceStatus) => {
    if (shouldReusePreviousTraceStatus(previousTraceStatus, input.nextTraceStatus)) {
      return previousTraceStatus;
    }
    return input.nextTraceStatus;
  });
}

function applyAgentSnapshot(input: {
  nextAgents: AgentsResponse;
  hasHydratedAgentSelectionRef: MutableRefObject<boolean>;
  setAgentDescriptors: Dispatch<SetStateAction<AgentDescriptor[]>>;
  setSelectedAgentId: Dispatch<SetStateAction<AgentId>>;
}): AgentId {
  input.setAgentDescriptors((previousDescriptors) => {
    if (shouldReusePreviousAgentDescriptors(previousDescriptors, input.nextAgents.agents)) {
      return previousDescriptors;
    }
    return input.nextAgents.agents;
  });

  const enabledAgents = readEnabledAgentIdentifiers(input.nextAgents);
  const nextDefaultAgent = readNextDefaultAgentIdentifier(input.nextAgents, enabledAgents);
  input.setSelectedAgentId((currentAgentId) => {
    if (!input.hasHydratedAgentSelectionRef.current) {
      input.hasHydratedAgentSelectionRef.current = true;
      return nextDefaultAgent;
    }
    return enabledAgents.includes(currentAgentId) ? currentAgentId : nextDefaultAgent;
  });
  return nextDefaultAgent;
}

function applySelectedThreadSnapshot(input: {
  preferredAgentId: AgentId | null;
  nextThreadsForSelection: ThreadsResponse["data"];
  threadListStateController: ThreadListStateController;
  setSelectedThreadId: Dispatch<SetStateAction<string | null>>;
}): void {
  input.setSelectedThreadId((currentSelectedThreadIdentifier) =>
    input.threadListStateController.computeInitialSelectedThreadIdentifier({
      currentSelectedThreadIdentifier,
      preferredAgentIdentifier: input.preferredAgentId,
      nextThreads: input.nextThreadsForSelection
    })
  );
}

function applySelectedModeKeySnapshot(input: {
  nextCapabilitiesSnapshot: CapabilitiesCollectionSnapshot;
  readInitialModeKey: (modes: ModesResponse["data"]) => string;
  setSelectedModeKey: Dispatch<SetStateAction<string>>;
}): void {
  input.setSelectedModeKey((currentModeKey) => {
    if (currentModeKey.length > 0) {
      return currentModeKey;
    }
    return input.readInitialModeKey(input.nextCapabilitiesSnapshot.modes);
  });
}

export function applyCoreDataSnapshotState(input: ApplyCoreDataSnapshotStateInput): void {
  const nextCapabilitiesSnapshot = readCapabilitiesCollectionSnapshot(input.nextCapabilities);
  let nextThreadsForSelection: ThreadsResponse["data"] | null = null;

  if (input.nextHealth) {
    applyHealthSnapshot({
      nextHealth: input.nextHealth,
      setHealth: input.setHealth
    });
  }

  if (input.nextActiveThreadState) {
    nextThreadsForSelection = applyActiveThreadSnapshot({
      nextActiveThreadState: input.nextActiveThreadState,
      setThreads: input.setThreads,
      setUnreadThreadIds: input.setUnreadThreadIds
    });
  }

  if (nextCapabilitiesSnapshot) {
    applyCapabilitiesSnapshot({
      nextCapabilitiesSnapshot,
      modesSignatureRef: input.modesSignatureRef,
      modelsSignatureRef: input.modelsSignatureRef,
      setModes: input.setModes,
      setModels: input.setModels,
      setConfigDefaults: input.setConfigDefaults
    });
  }

  if (input.nextTraceStatus) {
    applyTraceStatusSnapshot({
      nextTraceStatus: input.nextTraceStatus,
      setTraceStatus: input.setTraceStatus
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

  const preferredAgentId = input.nextAgents
    ? applyAgentSnapshot({
      nextAgents: input.nextAgents,
      hasHydratedAgentSelectionRef: input.hasHydratedAgentSelectionRef,
      setAgentDescriptors: input.setAgentDescriptors,
      setSelectedAgentId: input.setSelectedAgentId
    })
    : null;

  if (nextThreadsForSelection) {
    applySelectedThreadSnapshot({
      preferredAgentId,
      nextThreadsForSelection,
      threadListStateController: input.threadListStateController,
      setSelectedThreadId: input.setSelectedThreadId
    });
  }

  if (nextCapabilitiesSnapshot) {
    applySelectedModeKeySnapshot({
      nextCapabilitiesSnapshot,
      readInitialModeKey: input.readInitialModeKey,
      setSelectedModeKey: input.setSelectedModeKey
    });
  }
}
