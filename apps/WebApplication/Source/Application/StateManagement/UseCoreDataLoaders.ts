import {
  startTransition,
  useCallback,
  useRef,
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
  DebugWorkspaceDataReader,
  type DebugWorkspaceDataSnapshot
} from "@/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
import { DebugWorkspaceStateStore } from "@/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import type { ThreadListResponse } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import {
  type LoadActiveThreadStateResult,
  ThreadListStateController
} from "@/Features/Threads/StateManagement/ThreadListStateController";
import type {
  AgentId,
  ApiRequestOptions
} from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import { applyCoreDataSnapshotState } from "./CoreDataSnapshotStateApplier";
import {
  STARTUP_CRITICAL_THREADS_OPERATION,
  STARTUP_DEFERRED_AGENTS_OPERATION,
  STARTUP_DEFERRED_DEBUG_ERRORS_OPERATION,
  STARTUP_DEFERRED_DEBUG_HISTORY_OPERATION,
  STARTUP_DEFERRED_DEFAULTS_OPERATION,
  STARTUP_DEFERRED_HEALTH_OPERATION,
  STARTUP_DEFERRED_MODELS_OPERATION,
  STARTUP_DEFERRED_MODES_OPERATION,
  STARTUP_DEFERRED_THREADS_REVALIDATE_OPERATION,
  STARTUP_DEFERRED_TRACE_STATUS_OPERATION
} from "./CoreDataStartupRequestProfile";

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

interface ActionRequestOptions {
  actionId: string;
  requestOptions: ApiRequestOptions;
}

interface CoreDataSnapshotPartial {
  nextHealth?: Health;
  nextActiveThreadState?: LoadActiveThreadStateResult;
  nextTraceStatus?: TraceStatus;
  nextAgents?: AgentsResponse | null;
  nextCapabilities?: CoreDataCapabilitySnapshot;
  debugWorkspaceData?: DebugWorkspaceDataSnapshot | null;
}

function createStartupTaggedError<ErrorType>(operation: string, error: ErrorType): Error {
  const message = toErrorMessage(error).trim();
  if (/^[a-z][a-z0-9._-]{1,64}:\s*(.+)$/i.test(message)) {
    return new Error(message);
  }
  return new Error(`${operation}: ${message}`);
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
  handleRuntimeRequestError: <ErrorType,>(error: ErrorType) => void;
}

export interface CoreDataLoaders {
  loadCoreData: () => Promise<void>;
  loadArchivedThreads: () => Promise<void>;
  loadCoreDataTracked: () => Promise<void>;
}

export function useCoreDataLoaders(input: UseCoreDataLoadersInput): CoreDataLoaders {
  const deferredStartupSequenceRef = useRef(0);

  const loadCoreData = useCallback(async () => {
    const applySnapshotState = (snapshotPartial: CoreDataSnapshotPartial): void => {
      startTransition(() => {
        applyCoreDataSnapshotState({
          ...snapshotPartial,
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
    };

    const reportDeferredStartupFailure = <ErrorType,>(operation: string, error: ErrorType): void => {
      input.handleRuntimeRequestError(createStartupTaggedError(operation, error));
    };

    const hasSession = await input.ensureApiSessionBootstrapped();
    if (!hasSession) {
      return;
    }

    const startupCriticalThreadsRequest = input.buildActionRequestOptions(STARTUP_CRITICAL_THREADS_OPERATION);
    let nextActiveThreadState: LoadActiveThreadStateResult;
    try {
      nextActiveThreadState = await input.threadListStateController.loadActiveThreadState({
        limit: input.threadListLimit,
        maxPages: input.threadListMaxPages,
        sortKey: "updated_at",
        previousUnreadThreadIdentifiers: input.unreadThreadIdsRef.current,
        selectedThreadIdentifier: input.selectedThreadIdRef.current,
        // Prefer hot cache reads for event-driven refresh responsiveness.
        // Mutation owners invalidate this cache key before invoking refresh.
        readFromCache: true,
        ...(startupCriticalThreadsRequest.requestOptions.actionId
          ? { actionId: startupCriticalThreadsRequest.requestOptions.actionId }
          : {}),
        ...(startupCriticalThreadsRequest.requestOptions.actionName
          ? { actionName: startupCriticalThreadsRequest.requestOptions.actionName }
          : {})
      });
    } catch (error) {
      throw createStartupTaggedError(STARTUP_CRITICAL_THREADS_OPERATION, error);
    }

    applySnapshotState({
      nextActiveThreadState
    });

    const deferredStartupSequence = deferredStartupSequenceRef.current + 1;
    deferredStartupSequenceRef.current = deferredStartupSequence;

    window.setTimeout(() => {
      void (async () => {
        if (deferredStartupSequenceRef.current !== deferredStartupSequence) {
          return;
        }

        const now = Date.now();
        const shouldLoadDebugWorkspaceData = input.activeTabRef.current === "debug";

        const startupDeferredHealthRequest = input.buildActionRequestOptions(STARTUP_DEFERRED_HEALTH_OPERATION);
        const startupDeferredAgentsRequest = input.buildActionRequestOptions(STARTUP_DEFERRED_AGENTS_OPERATION);
        const startupDeferredTraceStatusRequest = input.buildActionRequestOptions(
          STARTUP_DEFERRED_TRACE_STATUS_OPERATION
        );
        const startupDeferredModesRequest = input.buildActionRequestOptions(STARTUP_DEFERRED_MODES_OPERATION);
        const startupDeferredModelsRequest = input.buildActionRequestOptions(STARTUP_DEFERRED_MODELS_OPERATION);
        const startupDeferredDefaultsRequest = input.buildActionRequestOptions(STARTUP_DEFERRED_DEFAULTS_OPERATION);

        const capabilitiesPromise = input.capabilitySnapshotCache.readSnapshot(
          () =>
            Promise.all([
              input.capabilityServerClient.listCollaborationModes(startupDeferredModesRequest.requestOptions),
              input.capabilityServerClient.listModels(startupDeferredModelsRequest.requestOptions),
              input.capabilityServerClient.readConfigDefaults({
                agentId: "codex",
                ...startupDeferredDefaultsRequest.requestOptions
              }).catch(() => null)
            ]).then(([modesResponse, modelsResponse, defaultsResponse]) => ({
              modes: modesResponse,
              models: modelsResponse,
              defaults: defaultsResponse,
              fetchedAt: Date.now()
            })),
          now
        );

        const debugWorkspaceDataPromise = shouldLoadDebugWorkspaceData
          ? input.debugWorkspaceDataReader.readSnapshot(
            input.debugHistoryLimit,
            input.debugErrorListLimit,
            {
              historyRequestOptions: input.buildActionRequestOptions(
                STARTUP_DEFERRED_DEBUG_HISTORY_OPERATION
              ).requestOptions,
              debugErrorsRequestOptions: input.buildActionRequestOptions(
                STARTUP_DEFERRED_DEBUG_ERRORS_OPERATION
              ).requestOptions
            }
          )
          : Promise.resolve<DebugWorkspaceDataSnapshot | null>(null);

        const [
          nextHealthResult,
          nextAgentsResult,
          nextCapabilitiesResult,
          nextTraceStatusResult,
          nextDebugWorkspaceDataResult
        ] = await Promise.allSettled([
          input.capabilityServerClient.readHealthStatus(startupDeferredHealthRequest.requestOptions),
          input.capabilityServerClient.listAgents(startupDeferredAgentsRequest.requestOptions),
          capabilitiesPromise,
          shouldLoadDebugWorkspaceData
            ? input.debugServerClient.readTraceStatus(startupDeferredTraceStatusRequest.requestOptions)
            : Promise.resolve<TraceStatus | null>(null),
          debugWorkspaceDataPromise
        ]);

        if (deferredStartupSequenceRef.current !== deferredStartupSequence) {
          return;
        }

        if (nextHealthResult.status === "fulfilled") {
          applySnapshotState({
            nextHealth: nextHealthResult.value
          });
        } else {
          reportDeferredStartupFailure(STARTUP_DEFERRED_HEALTH_OPERATION, nextHealthResult.reason);
        }

        if (nextAgentsResult.status === "fulfilled") {
          applySnapshotState({
            nextAgents: nextAgentsResult.value
          });
        } else {
          reportDeferredStartupFailure(STARTUP_DEFERRED_AGENTS_OPERATION, nextAgentsResult.reason);
        }

        if (nextCapabilitiesResult.status === "fulfilled") {
          applySnapshotState({
            nextCapabilities: nextCapabilitiesResult.value
          });
        } else {
          reportDeferredStartupFailure(STARTUP_DEFERRED_MODES_OPERATION, nextCapabilitiesResult.reason);
        }

        if (nextTraceStatusResult.status === "fulfilled") {
          if (nextTraceStatusResult.value) {
            applySnapshotState({
              nextTraceStatus: nextTraceStatusResult.value
            });
          }
        } else {
          reportDeferredStartupFailure(STARTUP_DEFERRED_TRACE_STATUS_OPERATION, nextTraceStatusResult.reason);
        }

        if (nextDebugWorkspaceDataResult.status === "fulfilled") {
          if (nextDebugWorkspaceDataResult.value) {
            applySnapshotState({
              debugWorkspaceData: nextDebugWorkspaceDataResult.value
            });
          }
        } else {
          reportDeferredStartupFailure(STARTUP_DEFERRED_DEBUG_HISTORY_OPERATION, nextDebugWorkspaceDataResult.reason);
        }
      })();
    }, 0);

    if (nextActiveThreadState.loadedFromCache) {
      const startupDeferredThreadRevalidateRequest = input.buildActionRequestOptions(
        STARTUP_DEFERRED_THREADS_REVALIDATE_OPERATION
      );
      // Keep cache-first responsiveness but revalidate active threads in the background so
      // external updates (for example event-stream-driven updates) still converge quickly.
      void input.threadListStateController.loadActiveThreadState({
        limit: input.threadListLimit,
        maxPages: input.threadListMaxPages,
        sortKey: "updated_at",
        previousUnreadThreadIdentifiers: nextActiveThreadState.nextUnreadThreadIdentifiers,
        selectedThreadIdentifier: input.selectedThreadIdRef.current,
        readFromCache: false,
        ...(startupDeferredThreadRevalidateRequest.requestOptions.actionId
          ? { actionId: startupDeferredThreadRevalidateRequest.requestOptions.actionId }
          : {}),
        ...(startupDeferredThreadRevalidateRequest.requestOptions.actionName
          ? { actionName: startupDeferredThreadRevalidateRequest.requestOptions.actionName }
          : {})
      }).then((networkActiveThreadState) => {
        applySnapshotState({
          nextActiveThreadState: networkActiveThreadState
        });
      }).catch((error) => {
        reportDeferredStartupFailure(STARTUP_DEFERRED_THREADS_REVALIDATE_OPERATION, error);
      });
    }
  }, [
    input.activeTabRef,
    input.buildActionRequestOptions,
    input.capabilityServerClient,
    input.capabilitySnapshotCache,
    input.debugErrorListLimit,
    input.debugErrorsSignatureRef,
    input.debugHistoryLimit,
    input.debugServerClient,
    input.debugWorkspaceDataReader,
    input.debugWorkspaceStateStore,
    input.ensureApiSessionBootstrapped,
    input.handleRuntimeRequestError,
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

  return {
    loadCoreData,
    loadArchivedThreads,
    loadCoreDataTracked
  };
}
