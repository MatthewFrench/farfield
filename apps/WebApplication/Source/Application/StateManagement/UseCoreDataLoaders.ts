import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useRef,
} from "react";
import { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { CapabilitySnapshotCache } from "@/Features/Capabilities/DataAccess/CapabilitySnapshotCache";
import { DebugServerClient } from "@/Features/Debugging/DataAccess/DebugServerClient";
import { DebugWorkspaceDataReader } from "@/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
import { DebugWorkspaceStateStore } from "@/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import { ThreadListStateController } from "@/Features/Threads/StateManagement/ThreadListStateController";
import type { AgentId, ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import {
  ArchivedThreadLoader,
  type ArchivedThreadLoaderDependencies,
} from "./ArchivedThreadLoader";
import { CoreDataRefreshConcurrencyCoordinator } from "./CoreDataRefreshConcurrencyCoordinator";
import type {
  CoreDataAgentDescriptor,
  CoreDataCapabilitySnapshot,
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
  CoreDataStartupLoader,
  type CoreDataStartupLoaderDependencies,
} from "./CoreDataStartupLoader";

export type { CoreDataCapabilitySnapshot } from "./CoreDataSnapshotContracts";

export interface SelectedThreadLoaderOptions {
  includeTurns?: boolean;
  includeReadThread?: boolean;
}

type Health = CoreDataHealthResponse;
type ConfigDefaults = CoreDataConfigDefaultsResponse;
type ThreadsResponse = CoreDataThreadsResponse;
type ModesResponse = CoreDataModesResponse;
type ModelsResponse = CoreDataModelsResponse;
type TraceStatus = CoreDataTraceStatusResponse;
type HistoryResponse = CoreDataHistoryResponse;
type DebugErrorsResponse = CoreDataDebugErrorsResponse;
type AgentDescriptor = CoreDataAgentDescriptor;

interface ActionRequestOptions {
  actionId: string;
  requestOptions: ApiRequestOptions;
}

function createStartupLoaderDependencies(
  input: UseCoreDataLoadersInput,
): CoreDataStartupLoaderDependencies {
  return {
    debugHistoryLimit: input.debugHistoryLimit,
    debugErrorListLimit: input.debugErrorListLimit,
    threadListLimit: input.threadListLimit,
    threadListMaxPages: input.threadListMaxPages,
    capabilityServerClient: input.capabilityServerClient,
    capabilitySnapshotCache: input.capabilitySnapshotCache,
    threadListStateController: input.threadListStateController,
    debugServerClient: input.debugServerClient,
    debugWorkspaceDataReader: input.debugWorkspaceDataReader,
    debugWorkspaceStateStore: input.debugWorkspaceStateStore,
    selectedThreadIdRef: input.selectedThreadIdRef,
    activeTabRef: input.activeTabRef,
    unreadThreadIdsRef: input.unreadThreadIdsRef,
    debugErrorsSignatureRef: input.debugErrorsSignatureRef,
    modesSignatureRef: input.modesSignatureRef,
    modelsSignatureRef: input.modelsSignatureRef,
    hasHydratedAgentSelectionRef: input.hasHydratedAgentSelectionRef,
    setHealth: input.setHealth,
    setThreads: input.setThreads,
    setUnreadThreadIds: input.setUnreadThreadIds,
    setModes: input.setModes,
    setModels: input.setModels,
    setConfigDefaults: input.setConfigDefaults,
    setTraceStatus: input.setTraceStatus,
    setHistory: input.setHistory,
    setDebugErrors: input.setDebugErrors,
    setDebugErrorSessionId: input.setDebugErrorSessionId,
    setDebugErrorSessionLogPath: input.setDebugErrorSessionLogPath,
    setAgentDescriptors: input.setAgentDescriptors,
    setSelectedAgentId: input.setSelectedAgentId,
    setSelectedThreadId: input.setSelectedThreadId,
    setSelectedModeKey: input.setSelectedModeKey,
    ensureApiSessionBootstrapped: input.ensureApiSessionBootstrapped,
    buildActionRequestOptions: input.buildActionRequestOptions,
    readInitialModeKey: input.readInitialModeKey,
    handleRuntimeRequestError: input.handleRuntimeRequestError,
  };
}

function createArchivedThreadLoaderDependencies(
  input: UseCoreDataLoadersInput,
): ArchivedThreadLoaderDependencies {
  return {
    threadListStateController: input.threadListStateController,
    threadListLimit: input.threadListLimit,
    archivedThreadListMaxPages: input.archivedThreadListMaxPages,
    setIsArchivedThreadsLoading: input.setIsArchivedThreadsLoading,
    setArchivedThreads: input.setArchivedThreads,
    setArchivedThreadsTruncated: input.setArchivedThreadsTruncated,
    setHasLoadedArchivedThreads: input.setHasLoadedArchivedThreads,
    handleRuntimeRequestError: input.handleRuntimeRequestError,
  };
}

export interface UseCoreDataLoadersInput {
  debugHistoryLimit: number;
  debugErrorListLimit: number;
  threadListLimit: number;
  threadListMaxPages: number;
  archivedThreadListMaxPages: number;
  capabilityServerClient: CapabilityServerClient;
  capabilitySnapshotCache: CapabilitySnapshotCache<CoreDataCapabilitySnapshot>;
  threadListStateController: ThreadListStateController;
  debugServerClient: DebugServerClient;
  debugWorkspaceDataReader: DebugWorkspaceDataReader;
  debugWorkspaceStateStore: DebugWorkspaceStateStore;
  coreDataRefreshConcurrencyCoordinator: CoreDataRefreshConcurrencyCoordinator;
  selectedThreadIdRef: MutableRefObject<string | null>;
  activeTabRef: MutableRefObject<"chat" | "debug">;
  unreadThreadIdsRef: MutableRefObject<Record<string, true>>;
  debugErrorsSignatureRef: MutableRefObject<string[]>;
  modesSignatureRef: MutableRefObject<string[]>;
  modelsSignatureRef: MutableRefObject<string[]>;
  hasHydratedAgentSelectionRef: MutableRefObject<boolean>;
  isArchivedThreadsOpenRef: MutableRefObject<boolean>;
  hasLoadedArchivedThreadsRef: MutableRefObject<boolean>;
  lastCoreRefreshAtRef: MutableRefObject<number>;
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
  setIsArchivedThreadsLoading: Dispatch<SetStateAction<boolean>>;
  setArchivedThreads: Dispatch<SetStateAction<ThreadsResponse["data"]>>;
  setArchivedThreadsTruncated: Dispatch<SetStateAction<boolean>>;
  setHasLoadedArchivedThreads: Dispatch<SetStateAction<boolean>>;
  ensureApiSessionBootstrapped: () => Promise<boolean>;
  buildActionRequestOptions: (actionName: string) => ActionRequestOptions;
  readInitialModeKey: (modes: ModesResponse["data"]) => string;
  handleRuntimeRequestError: <ErrorType>(error: ErrorType) => void;
}

export interface CoreDataLoaders {
  loadCoreData: () => Promise<void>;
  loadArchivedThreads: () => Promise<void>;
  loadCoreDataTracked: () => Promise<void>;
}

/**
 * Thin composition hook that wires core-data startup and archived-thread owner modules.
 */
export function useCoreDataLoaders(input: UseCoreDataLoadersInput): CoreDataLoaders {
  const startupLoaderReference = useRef<CoreDataStartupLoader | null>(null);
  if (startupLoaderReference.current === null) {
    startupLoaderReference.current = new CoreDataStartupLoader(
      createStartupLoaderDependencies(input),
    );
  } else {
    startupLoaderReference.current.updateDependencies(createStartupLoaderDependencies(input));
  }
  const startupLoader = startupLoaderReference.current;

  const archivedThreadLoaderReference = useRef<ArchivedThreadLoader | null>(null);
  if (archivedThreadLoaderReference.current === null) {
    archivedThreadLoaderReference.current = new ArchivedThreadLoader(
      createArchivedThreadLoaderDependencies(input),
    );
  } else {
    archivedThreadLoaderReference.current.updateDependencies(
      createArchivedThreadLoaderDependencies(input),
    );
  }
  const archivedThreadLoader = archivedThreadLoaderReference.current;

  const loadCoreData = useCallback(async () => {
    await startupLoader.loadCoreData();
  }, [startupLoader]);

  const loadArchivedThreads = useCallback(async () => {
    await archivedThreadLoader.loadArchivedThreads();
  }, [archivedThreadLoader]);

  const loadCoreDataTracked = useCallback(async () => {
    const lastCoreRefreshAtRef = input.lastCoreRefreshAtRef;
    await input.coreDataRefreshConcurrencyCoordinator.run(async () => {
      await loadCoreData();
      // Keep project ordering deterministic on first render by preloading archived-thread metadata.
      await loadArchivedThreads();
      lastCoreRefreshAtRef.current = Date.now();
    });
  }, [
    input.coreDataRefreshConcurrencyCoordinator,
    input.lastCoreRefreshAtRef,
    loadArchivedThreads,
    loadCoreData,
  ]);

  return {
    loadCoreData,
    loadArchivedThreads,
    loadCoreDataTracked,
  };
}
