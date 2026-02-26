import type {
  Dispatch,
  MutableRefObject,
  SetStateAction
} from "react";
import type {
  CoreDataAgentDescriptor,
  CoreDataAgentsResponse,
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
import { ThreadListStateController } from "@/Features/Threads/StateManagement/ThreadListStateController";
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

const SIGNATURE_SEGMENT_DELIMITER = "|";
const EMPTY_SIGNATURE_SEGMENT = "";

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
  segments: ReadonlyArray<string | null | undefined>
): string {
  return segments.map((segment) => segment ?? EMPTY_SIGNATURE_SEGMENT).join(SIGNATURE_SEGMENT_DELIMITER);
}

function buildModesSignature(modes: ModesResponse["data"]): string[] {
  return modes.map((mode) =>
    buildSignatureEntry([mode.mode, mode.name, mode.reasoning_effort])
  );
}

function buildModelsSignature(models: ModelsResponse["data"]): string[] {
  return models.map((model) =>
    buildSignatureEntry([model.id, model.displayName])
  );
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

  return (
    previousTraceStatus.active?.id === nextTraceStatus.active?.id
    && previousTraceStatus.active?.eventCount === nextTraceStatus.active?.eventCount
    && previousTraceStatus.recent.length === nextTraceStatus.recent.length
    && previousTraceStatus.recent[0]?.id === nextTraceStatus.recent[0]?.id
    && previousTraceStatus.recent[0]?.eventCount === nextTraceStatus.recent[0]?.eventCount
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
    : (enabledAgentIdentifiers[0] ?? nextAgents.defaultAgentId);
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

export function applyCoreDataSnapshotState(input: ApplyCoreDataSnapshotStateInput): void {
  const nextCapabilities = input.nextCapabilities;
  const nextHealth = input.nextHealth;
  const nextActiveThreadState = input.nextActiveThreadState;
  const nextTraceStatus = input.nextTraceStatus;
  const nextModesSignature = nextCapabilities
    ? buildModesSignature(nextCapabilities.modes.data)
    : null;
  const nextModelsSignature = nextCapabilities
    ? buildModelsSignature(nextCapabilities.models.data)
    : null;

  let preferredAgentId: AgentId | null = null;
  let nextThreadsForSelection: ThreadsResponse["data"] | null = null;

  if (nextHealth) {
    input.setHealth((previousHealth) => {
      if (shouldReusePreviousHealth(previousHealth, nextHealth)) {
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

  if (nextCapabilities && nextModesSignature) {
    applySignedCollectionStateUpdate({
      previousSignatureRef: input.modesSignatureRef,
      nextSignature: nextModesSignature,
      nextCollection: nextCapabilities.modes.data,
      setCollection: input.setModes
    });
  }

  if (nextCapabilities && nextModelsSignature) {
    applySignedCollectionStateUpdate({
      previousSignatureRef: input.modelsSignatureRef,
      nextSignature: nextModelsSignature,
      nextCollection: nextCapabilities.models.data,
      setCollection: input.setModels
    });
  }

  if (nextCapabilities?.defaults) {
    const nextDefaults = nextCapabilities.defaults;
    input.setConfigDefaults((previousDefaults) => {
      if (shouldReusePreviousConfigDefaults(previousDefaults, nextDefaults)) {
        return previousDefaults;
      }
      return nextDefaults;
    });
  }

  if (nextTraceStatus) {
    input.setTraceStatus((previousTraceStatus) => {
      if (shouldReusePreviousTraceStatus(previousTraceStatus, nextTraceStatus)) {
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
      if (shouldReusePreviousAgentDescriptors(previousDescriptors, nextAgents.agents)) {
        return previousDescriptors;
      }
      return nextAgents.agents;
    });

    const enabledAgents = readEnabledAgentIdentifiers(nextAgents);
    const nextDefaultAgent = readNextDefaultAgentIdentifier(nextAgents, enabledAgents);

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
