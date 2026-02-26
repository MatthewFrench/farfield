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
  CapabilityServerClient
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import {
  DebugServerClient
} from "@/Features/Debugging/DataAccess/DebugServerClient";
import {
  DebugWorkspaceDataReader,
  type DebugWorkspaceDataSnapshot
} from "@/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
import { DebugWorkspaceStateStore } from "@/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import {
  type LoadActiveThreadStateInput,
  type LoadActiveThreadStateResult,
  ThreadListStateController
} from "@/Features/Threads/StateManagement/ThreadListStateController";
import type {
  AgentId,
  ApiRequestOptions
} from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import { applyCoreDataSnapshotState } from "./CoreDataSnapshotStateApplier";
import type {
  CoreDataAgentDescriptor,
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

type CoreDataSnapshotPartial = CoreDataSnapshotStateDelta;

type SnapshotStateApplier = (snapshotPartial: CoreDataSnapshotPartial) => void;
type DeferredStartupFailureReporter = <ErrorType,>(operation: string, error: ErrorType) => void;

interface ThreadLoadActionMetadata {
  actionId?: string;
  actionName?: string;
}

interface BuildActiveThreadStateLoadRequestInput {
  threadListLimit: number;
  threadListMaxPages: number;
  previousUnreadThreadIdentifiers: Record<string, true>;
  selectedThreadIdentifier: string | null;
  readFromCache: boolean;
  requestOptions: ApiRequestOptions;
}

interface DeferredStartupResultApplicationInput<ResultValue> {
  result: PromiseSettledResult<ResultValue>;
  operation: string;
  onFulfilled: (value: ResultValue) => void;
  reportDeferredStartupFailure: DeferredStartupFailureReporter;
}

interface CapabilitySnapshotReadInput {
  capabilityServerClient: CapabilityServerClient;
  modesRequestOptions: ApiRequestOptions;
  modelsRequestOptions: ApiRequestOptions;
  defaultsRequestOptions: ApiRequestOptions;
}

interface DeferredStartupReadsInput {
  activeTabRef: MutableRefObject<"chat" | "debug">;
  debugHistoryLimit: number;
  debugErrorListLimit: number;
  capabilityServerClient: CapabilityServerClient;
  capabilitySnapshotCache: CapabilitySnapshotCache<CoreDataCapabilitySnapshot>;
  debugServerClient: DebugServerClient;
  debugWorkspaceDataReader: DebugWorkspaceDataReader;
  buildActionRequestOptions: (actionName: string) => ActionRequestOptions;
  deferredStartupSequenceRef: MutableRefObject<number>;
  deferredStartupSequence: number;
  applySnapshotState: SnapshotStateApplier;
  reportDeferredStartupFailure: DeferredStartupFailureReporter;
}

const STARTUP_TAGGED_ERROR_PATTERN = /^[a-z][a-z0-9._-]{1,64}:\s*(.+)$/i;
const THREAD_LIST_UPDATED_AT_SORT_KEY = "updated_at" as const;
// Yield one event-loop turn so critical startup reads can commit before non-critical hydration starts.
const DEFERRED_STARTUP_NEXT_TURN_DELAY_MILLISECONDS = 0;
const CONFIG_DEFAULTS_AGENT_ID: AgentId = "codex";

function createStartupTaggedError<ErrorType>(operation: string, error: ErrorType): Error {
  const message = toErrorMessage(error).trim();
  if (STARTUP_TAGGED_ERROR_PATTERN.test(message)) {
    return new Error(message);
  }
  return new Error(`${operation}: ${message}`);
}

function readThreadLoadActionMetadata(requestOptions: ApiRequestOptions): ThreadLoadActionMetadata {
  const metadata: ThreadLoadActionMetadata = {};
  if (requestOptions.actionId) {
    metadata.actionId = requestOptions.actionId;
  }
  if (requestOptions.actionName) {
    metadata.actionName = requestOptions.actionName;
  }
  return metadata;
}

function createActiveThreadStateLoadRequest(
  input: BuildActiveThreadStateLoadRequestInput
): LoadActiveThreadStateInput {
  return {
    limit: input.threadListLimit,
    maxPages: input.threadListMaxPages,
    sortKey: THREAD_LIST_UPDATED_AT_SORT_KEY,
    previousUnreadThreadIdentifiers: input.previousUnreadThreadIdentifiers,
    selectedThreadIdentifier: input.selectedThreadIdentifier,
    readFromCache: input.readFromCache,
    ...readThreadLoadActionMetadata(input.requestOptions)
  };
}

function applyDeferredStartupResult<ResultValue>(
  input: DeferredStartupResultApplicationInput<ResultValue>
): void {
  if (input.result.status === "fulfilled") {
    input.onFulfilled(input.result.value);
    return;
  }

  input.reportDeferredStartupFailure(input.operation, input.result.reason);
}

async function readCapabilitySnapshot(input: CapabilitySnapshotReadInput): Promise<CoreDataCapabilitySnapshot> {
  const [modesResponse, modelsResponse, defaultsResponse] = await Promise.all([
    input.capabilityServerClient.listCollaborationModes(input.modesRequestOptions),
    input.capabilityServerClient.listModels(input.modelsRequestOptions),
    // Config defaults are optional at startup; preserve capability hydration even if this request fails.
    input.capabilityServerClient.readConfigDefaults({
      agentId: CONFIG_DEFAULTS_AGENT_ID,
      ...input.defaultsRequestOptions
    }).catch(() => null)
  ]);

  return {
    modes: modesResponse,
    models: modelsResponse,
    defaults: defaultsResponse,
    fetchedAt: Date.now()
  };
}

async function runDeferredStartupReads(input: DeferredStartupReadsInput): Promise<void> {
  if (input.deferredStartupSequenceRef.current !== input.deferredStartupSequence) {
    return;
  }

  const shouldLoadDebugWorkspaceData = input.activeTabRef.current === "debug";
  const now = Date.now();

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
      readCapabilitySnapshot({
        capabilityServerClient: input.capabilityServerClient,
        modesRequestOptions: startupDeferredModesRequest.requestOptions,
        modelsRequestOptions: startupDeferredModelsRequest.requestOptions,
        defaultsRequestOptions: startupDeferredDefaultsRequest.requestOptions
      }),
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

  const [nextHealthResult, nextAgentsResult, nextCapabilitiesResult, nextTraceStatusResult, nextDebugWorkspaceDataResult] = await Promise.allSettled([
    input.capabilityServerClient.readHealthStatus(startupDeferredHealthRequest.requestOptions),
    input.capabilityServerClient.listAgents(startupDeferredAgentsRequest.requestOptions),
    capabilitiesPromise,
    shouldLoadDebugWorkspaceData
      ? input.debugServerClient.readTraceStatus(startupDeferredTraceStatusRequest.requestOptions)
      : Promise.resolve<TraceStatus | null>(null),
    debugWorkspaceDataPromise
  ]);

  if (input.deferredStartupSequenceRef.current !== input.deferredStartupSequence) {
    return;
  }

  applyDeferredStartupResult({
    result: nextHealthResult,
    operation: STARTUP_DEFERRED_HEALTH_OPERATION,
    onFulfilled: (nextHealth) => {
      input.applySnapshotState({
        nextHealth
      });
    },
    reportDeferredStartupFailure: input.reportDeferredStartupFailure
  });

  applyDeferredStartupResult({
    result: nextAgentsResult,
    operation: STARTUP_DEFERRED_AGENTS_OPERATION,
    onFulfilled: (nextAgents) => {
      input.applySnapshotState({
        nextAgents
      });
    },
    reportDeferredStartupFailure: input.reportDeferredStartupFailure
  });

  applyDeferredStartupResult({
    result: nextCapabilitiesResult,
    operation: STARTUP_DEFERRED_MODES_OPERATION,
    onFulfilled: (nextCapabilities) => {
      input.applySnapshotState({
        nextCapabilities
      });
    },
    reportDeferredStartupFailure: input.reportDeferredStartupFailure
  });

  applyDeferredStartupResult({
    result: nextTraceStatusResult,
    operation: STARTUP_DEFERRED_TRACE_STATUS_OPERATION,
    onFulfilled: (nextTraceStatus) => {
      if (nextTraceStatus) {
        input.applySnapshotState({
          nextTraceStatus
        });
      }
    },
    reportDeferredStartupFailure: input.reportDeferredStartupFailure
  });

  applyDeferredStartupResult({
    result: nextDebugWorkspaceDataResult,
    operation: STARTUP_DEFERRED_DEBUG_HISTORY_OPERATION,
    onFulfilled: (debugWorkspaceData) => {
      if (debugWorkspaceData) {
        input.applySnapshotState({
          debugWorkspaceData
        });
      }
    },
    reportDeferredStartupFailure: input.reportDeferredStartupFailure
  });
}

function scheduleDeferredStartupReads(input: DeferredStartupReadsInput): void {
  window.setTimeout(runDeferredStartupReads, DEFERRED_STARTUP_NEXT_TURN_DELAY_MILLISECONDS, input);
}

async function runDeferredThreadRevalidation(
  threadListStateController: ThreadListStateController,
  threadLoadRequest: BuildActiveThreadStateLoadRequestInput,
  applySnapshotState: SnapshotStateApplier,
  reportDeferredStartupFailure: DeferredStartupFailureReporter
): Promise<void> {
  try {
    const networkActiveThreadState = await threadListStateController.loadActiveThreadState(
      createActiveThreadStateLoadRequest(threadLoadRequest)
    );
    applySnapshotState({
      nextActiveThreadState: networkActiveThreadState
    });
  } catch (error) {
    reportDeferredStartupFailure(STARTUP_DEFERRED_THREADS_REVALIDATE_OPERATION, error);
  }
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

/**
 * Owns application-shell startup reads:
 * critical thread state first, then deferred capability/debug hydration and optional cache revalidation.
 */
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
      nextActiveThreadState = await input.threadListStateController.loadActiveThreadState(
        createActiveThreadStateLoadRequest({
          threadListLimit: input.threadListLimit,
          threadListMaxPages: input.threadListMaxPages,
          previousUnreadThreadIdentifiers: input.unreadThreadIdsRef.current,
          selectedThreadIdentifier: input.selectedThreadIdRef.current,
          // Prefer hot cache reads for event-driven refresh responsiveness.
          // Mutation owners invalidate this cache key before invoking refresh.
          readFromCache: true,
          requestOptions: startupCriticalThreadsRequest.requestOptions
        })
      );
    } catch (error) {
      throw createStartupTaggedError(STARTUP_CRITICAL_THREADS_OPERATION, error);
    }

    applySnapshotState({
      nextActiveThreadState
    });

    const deferredStartupSequence = deferredStartupSequenceRef.current + 1;
    deferredStartupSequenceRef.current = deferredStartupSequence;

    scheduleDeferredStartupReads({
      activeTabRef: input.activeTabRef,
      debugHistoryLimit: input.debugHistoryLimit,
      debugErrorListLimit: input.debugErrorListLimit,
      capabilityServerClient: input.capabilityServerClient,
      capabilitySnapshotCache: input.capabilitySnapshotCache,
      debugServerClient: input.debugServerClient,
      debugWorkspaceDataReader: input.debugWorkspaceDataReader,
      buildActionRequestOptions: input.buildActionRequestOptions,
      deferredStartupSequenceRef,
      deferredStartupSequence,
      applySnapshotState,
      reportDeferredStartupFailure
    });

    if (nextActiveThreadState.loadedFromCache) {
      const startupDeferredThreadRevalidateRequest = input.buildActionRequestOptions(
        STARTUP_DEFERRED_THREADS_REVALIDATE_OPERATION
      );
      // Keep cache-first responsiveness but revalidate active threads in the background so
      // external updates (for example event-stream-driven updates) still converge quickly.
      void runDeferredThreadRevalidation(
        input.threadListStateController,
        {
          threadListLimit: input.threadListLimit,
          threadListMaxPages: input.threadListMaxPages,
          previousUnreadThreadIdentifiers: nextActiveThreadState.nextUnreadThreadIdentifiers,
          selectedThreadIdentifier: input.selectedThreadIdRef.current,
          readFromCache: false,
          requestOptions: startupDeferredThreadRevalidateRequest.requestOptions
        },
        applySnapshotState,
        reportDeferredStartupFailure
      );
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
        sortKey: THREAD_LIST_UPDATED_AT_SORT_KEY,
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
