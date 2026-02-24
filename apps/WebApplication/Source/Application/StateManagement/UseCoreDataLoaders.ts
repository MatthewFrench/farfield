import {
  startTransition,
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { CoreDataRefreshConcurrencyCoordinator } from "./CoreDataRefreshConcurrencyCoordinator";
import {
  CapabilitySnapshotCache
} from "@/Features/Capabilities/DataAccess/CapabilitySnapshotCache";
import {
  CapabilityServerClient,
  type CapabilityAgentsResponse,
  type CapabilityCollaborationModesResponse,
  type CapabilityConfigDefaultsResponse,
  type CapabilityHealthResponse,
  type CapabilityModelsResponse
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import {
  DebugServerClient,
  type DebugErrorListResponse,
  type DebugHistoryResponse,
  type DebugTraceStatusResponse
} from "@/Features/Debugging/DataAccess/DebugServerClient";
import {
  DebugWorkspaceDataReader
} from "@/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
import { DebugWorkspaceStateStore } from "@/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import type { ThreadListResponse } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { ThreadListStateController } from "@/Features/Threads/StateManagement/ThreadListStateController";
import type { AgentId } from "@/Shared/Contracts/ApiContracts";
import { applyCoreDataSnapshotState } from "./CoreDataSnapshotStateApplier";

export interface CoreDataCapabilitySnapshot {
  modes: CapabilityCollaborationModesResponse;
  models: CapabilityModelsResponse;
  defaults: CapabilityConfigDefaultsResponse | null;
  fetchedAt: number;
}

export interface SelectedThreadLoaderOptions {
  includeTurns?: boolean;
  includeReadThread?: boolean;
}

export type SelectedThreadLoader = (
  threadId: string,
  options?: SelectedThreadLoaderOptions
) => Promise<void>;

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
  loadCoreDataTrackedRef: MutableRefObject<(() => Promise<void>) | null>;
  loadSelectedThreadRef: MutableRefObject<SelectedThreadLoader | null>;
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
  setIsCoreLoading: Dispatch<SetStateAction<boolean>>;
  ensureApiSessionBootstrapped: () => Promise<boolean>;
  readInitialModeKey: (modes: ModesResponse["data"]) => string;
  handleRuntimeRequestError: <ErrorType,>(error: ErrorType) => void;
}

export interface CoreDataLoaders {
  loadCoreData: () => Promise<void>;
  loadArchivedThreads: () => Promise<void>;
  loadCoreDataTracked: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

export function useCoreDataLoaders(input: UseCoreDataLoadersInput): CoreDataLoaders {
  const loadCoreData = useCallback(async () => {
    const hasSession = await input.ensureApiSessionBootstrapped();
    if (!hasSession) {
      return;
    }

    const now = Date.now();
    const shouldLoadDebugWorkspaceData = input.activeTabRef.current === "debug";
    const capabilitiesPromise = input.capabilitySnapshotCache.readSnapshot(
      () =>
        Promise.all([
          input.capabilityServerClient.listCollaborationModes(),
          input.capabilityServerClient.listModels(),
          input.capabilityServerClient.readConfigDefaults({ agentId: "codex" }).catch(() => null)
        ]).then(([modesResponse, modelsResponse, defaultsResponse]) => ({
          modes: modesResponse,
          models: modelsResponse,
          defaults: defaultsResponse,
          fetchedAt: Date.now()
        })),
      now
    );

    const debugWorkspaceDataPromise = shouldLoadDebugWorkspaceData
      ? input.debugWorkspaceDataReader.readSnapshot(input.debugHistoryLimit, input.debugErrorListLimit)
      : Promise.resolve(null);

    const [
      nextHealth,
      nextActiveThreadState,
      nextTraceStatus,
      nextAgents,
      nextCapabilities,
      debugWorkspaceData
    ] = await Promise.all([
      input.capabilityServerClient.readHealthStatus(),
      input.threadListStateController.loadActiveThreadState({
        limit: input.threadListLimit,
        maxPages: input.threadListMaxPages,
        sortKey: "updated_at",
        previousUnreadThreadIdentifiers: input.unreadThreadIdsRef.current,
        selectedThreadIdentifier: input.selectedThreadIdRef.current,
        readFromCache: false
      }),
      input.debugServerClient.readTraceStatus(),
      input.capabilityServerClient.listAgents().catch(() => null),
      capabilitiesPromise,
      debugWorkspaceDataPromise
    ]);

    startTransition(() => {
      applyCoreDataSnapshotState({
        nextHealth,
        nextActiveThreadState,
        nextTraceStatus,
        nextAgents,
        nextCapabilities,
        debugWorkspaceData,
        debugWorkspaceStateStore: input.debugWorkspaceStateStore,
        threadListStateController: input.threadListStateController,
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
        readInitialModeKey: input.readInitialModeKey
      });
    });
  }, [
    input.activeTabRef,
    input.capabilityServerClient,
    input.capabilitySnapshotCache,
    input.debugErrorListLimit,
    input.debugErrorsSignatureRef,
    input.debugHistoryLimit,
    input.debugServerClient,
    input.debugWorkspaceDataReader,
    input.debugWorkspaceStateStore,
    input.ensureApiSessionBootstrapped,
    input.hasHydratedAgentSelectionRef,
    input.modelsSignatureRef,
    input.modesSignatureRef,
    input.readInitialModeKey,
    input.selectedThreadIdRef,
    input.setAgentDescriptors,
    input.setConfigDefaults,
    input.setDebugErrors,
    input.setDebugErrorSessionId,
    input.setDebugErrorSessionLogPath,
    input.setHealth,
    input.setHistory,
    input.setModels,
    input.setModes,
    input.setSelectedAgentId,
    input.setSelectedModeKey,
    input.setSelectedThreadId,
    input.setThreads,
    input.setTraceStatus,
    input.setUnreadThreadIds,
    input.threadListLimit,
    input.threadListMaxPages,
    input.threadListStateController,
    input.unreadThreadIdsRef
  ]);

  const loadArchivedThreads = useCallback(async () => {
    input.setIsArchivedThreadsLoading(true);
    try {
      const archivedState = await input.threadListStateController.loadArchivedThreadState({
        limit: input.threadListLimit,
        maxPages: input.archivedThreadListMaxPages,
        sortKey: "updated_at",
        readFromCache: true
      });

      startTransition(() => {
        if (archivedState.didChangeArchivedThreads) {
          input.setArchivedThreads(archivedState.nextArchivedThreads);
        }
        input.setArchivedThreadsTruncated(archivedState.isTruncated);
        input.setHasLoadedArchivedThreads(true);
      });
    } catch (error) {
      input.handleRuntimeRequestError(error);
    } finally {
      input.setIsArchivedThreadsLoading(false);
    }
  }, [
    input.archivedThreadListMaxPages,
    input.handleRuntimeRequestError,
    input.setArchivedThreads,
    input.setArchivedThreadsTruncated,
    input.setHasLoadedArchivedThreads,
    input.setIsArchivedThreadsLoading,
    input.threadListLimit,
    input.threadListStateController
  ]);

  const loadCoreDataTracked = useCallback(async () => {
    await input.coreDataRefreshConcurrencyCoordinator.run(async () => {
      await loadCoreData();
      if (input.isArchivedThreadsOpenRef.current || input.hasLoadedArchivedThreadsRef.current) {
        await loadArchivedThreads();
      }
      input.lastCoreRefreshAtRef.current = Date.now();
    });
  }, [
    input.coreDataRefreshConcurrencyCoordinator,
    input.hasLoadedArchivedThreadsRef,
    input.isArchivedThreadsOpenRef,
    input.lastCoreRefreshAtRef,
    loadArchivedThreads,
    loadCoreData
  ]);

  const refreshAll = useCallback(async () => {
    input.setIsCoreLoading(true);
    try {
      // Non-mutating refresh paths keep list caches warm; mutation handlers invalidate explicitly.
      const loadCoreDataFunction = input.loadCoreDataTrackedRef.current;
      const loadSelectedThreadFunction = input.loadSelectedThreadRef.current;
      if (loadCoreDataFunction) {
        await loadCoreDataFunction();
      }
      if (input.selectedThreadIdRef.current && loadSelectedThreadFunction) {
        await loadSelectedThreadFunction(input.selectedThreadIdRef.current);
      }
    } catch (error) {
      input.handleRuntimeRequestError(error);
    } finally {
      input.setIsCoreLoading(false);
    }
  }, [
    input.handleRuntimeRequestError,
    input.loadCoreDataTrackedRef,
    input.loadSelectedThreadRef,
    input.selectedThreadIdRef,
    input.setIsCoreLoading
  ]);

  return {
    loadCoreData,
    loadArchivedThreads,
    loadCoreDataTracked,
    refreshAll
  };
}
