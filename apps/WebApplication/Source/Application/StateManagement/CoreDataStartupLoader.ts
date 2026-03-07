import { type Dispatch, type MutableRefObject, type SetStateAction, startTransition } from "react";
import { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { CapabilitySnapshotCache } from "@/Features/Capabilities/DataAccess/CapabilitySnapshotCache";
import { DebugServerClient } from "@/Features/Debugging/DataAccess/DebugServerClient";
import {
  DebugWorkspaceDataReader,
  type DebugWorkspaceDataSnapshot,
} from "@/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
import { DebugWorkspaceStateStore } from "@/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import {
  type LoadActiveThreadStateInput,
  type LoadActiveThreadStateResult,
  ThreadListStateController,
} from "@/Features/Threads/StateManagement/ThreadListStateController";
import type { AgentId, ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import { isRequestCanceledError } from "@/Shared/Errors/RequestCanceledError";
import { CoreDataDeferredResourceCacheOwner } from "./CoreDataDeferredResourceCacheOwner";
import type {
  CoreDataAgentDescriptor,
  CoreDataCapabilitySnapshot,
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
  STARTUP_DEFERRED_TRACE_STATUS_OPERATION,
} from "./CoreDataStartupRequestProfile";

const STARTUP_TAGGED_ERROR_PATTERN = /^[a-z][a-z0-9._-]{1,64}:\s*(.+)$/i;
const STARTUP_DEFERRED_FAILED_TO_FETCH_PATTERN =
  /^Request failed for \/.+: Failed to fetch status=n\/a$/i;
const STARTUP_DEFERRED_EMPTY_JSON_RESPONSE_PATTERN =
  /^Invalid JSON response from \/.+: empty response status=200 OK requestId .+$/i;
const STARTUP_DEFERRED_RESTART_STATUS_PATTERN = /^Request failed for \/.+ status=(502|503|504)\b/i;
const STARTUP_DEFERRED_INVALID_JSON_RESTART_STATUS_PATTERN =
  /^Invalid JSON response from \/.+ status=(502|503|504)\b/i;
const THREAD_LIST_UPDATED_AT_SORT_KEY = "updated_at" as const;
// Yield one event-loop turn so critical startup reads can commit before non-critical hydration starts.
const DEFERRED_STARTUP_NEXT_TURN_DELAY_MILLISECONDS = 0;
const DEFERRED_STARTUP_RETRY_DELAY_MILLISECONDS = 500;
const DEFERRED_STARTUP_MAXIMUM_RETRY_ATTEMPTS = 2;
const STARTUP_CRITICAL_THREAD_READ_FROM_CACHE = true;
const CONFIG_DEFAULTS_AGENT_ID: AgentId = "codex";

type Health = CoreDataHealthResponse;
type ConfigDefaults = CoreDataConfigDefaultsResponse;
type ThreadsResponse = CoreDataThreadsResponse;
type ModesResponse = CoreDataModesResponse;
type ModelsResponse = CoreDataModelsResponse;
type TraceStatus = CoreDataTraceStatusResponse;
type HistoryResponse = CoreDataHistoryResponse;
type DebugErrorsResponse = CoreDataDebugErrorsResponse;
type AgentDescriptor = CoreDataAgentDescriptor;
type CoreDataSnapshotPartial = CoreDataSnapshotStateDelta;

interface ActionRequestOptions {
  actionId: string;
  requestOptions: ApiRequestOptions;
}

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
  retryAttemptCount: number;
  reportDeferredStartupFailure: DeferredStartupFailureReporter;
}

interface CapabilitySnapshotReadInput {
  capabilityServerClient: CapabilityServerClient;
  modesRequestOptions: ApiRequestOptions;
  modelsRequestOptions: ApiRequestOptions;
  defaultsRequestOptions: ApiRequestOptions;
}

type SnapshotStateApplier = (snapshotPartial: CoreDataSnapshotPartial) => void;
type DeferredStartupFailureReporter = <ErrorType>(operation: string, error: ErrorType) => void;

export interface CoreDataStartupLoaderDependencies {
  debugHistoryLimit: number;
  debugErrorListLimit: number;
  threadListLimit: number;
  threadListMaxPages: number;
  capabilityServerClient: CapabilityServerClient;
  capabilitySnapshotCache: CapabilitySnapshotCache<CoreDataCapabilitySnapshot>;
  threadListStateController: ThreadListStateController;
  debugServerClient: DebugServerClient;
  debugWorkspaceDataReader: DebugWorkspaceDataReader;
  debugWorkspaceStateStore: DebugWorkspaceStateStore;
  deferredResourceCacheOwner: CoreDataDeferredResourceCacheOwner;
  selectedThreadIdRef: MutableRefObject<string | null>;
  activeTabRef: MutableRefObject<"chat" | "debug">;
  unreadThreadIdsRef: MutableRefObject<Record<string, true>>;
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
  ensureApiSessionBootstrapped: () => Promise<boolean>;
  buildActionRequestOptions: (actionName: string) => ActionRequestOptions;
  readInitialModeKey: (modes: ModesResponse["data"]) => string;
  handleRuntimeRequestError: <ErrorType>(error: ErrorType) => void;
}

function createStartupTaggedError<ErrorType>(operation: string, error: ErrorType): Error {
  const message = toErrorMessage(error).trim();
  if (STARTUP_TAGGED_ERROR_PATTERN.test(message)) {
    return new Error(message);
  }
  return new Error(`${operation}: ${message}`);
}

function readThreadLoadActionMetadata(requestOptions: ApiRequestOptions): ThreadLoadActionMetadata {
  const metadata: ThreadLoadActionMetadata = {};
  if (requestOptions.actionId !== undefined && requestOptions.actionId.length > 0) {
    metadata.actionId = requestOptions.actionId;
  }
  if (requestOptions.actionName !== undefined && requestOptions.actionName.length > 0) {
    metadata.actionName = requestOptions.actionName;
  }
  return metadata;
}

function createActiveThreadStateLoadRequest(
  input: BuildActiveThreadStateLoadRequestInput,
): LoadActiveThreadStateInput {
  return {
    limit: input.threadListLimit,
    maxPages: input.threadListMaxPages,
    sortKey: THREAD_LIST_UPDATED_AT_SORT_KEY,
    previousUnreadThreadIdentifiers: input.previousUnreadThreadIdentifiers,
    selectedThreadIdentifier: input.selectedThreadIdentifier,
    readFromCache: input.readFromCache,
    ...readThreadLoadActionMetadata(input.requestOptions),
  };
}

function applyDeferredStartupResult<ResultValue>(
  input: DeferredStartupResultApplicationInput<ResultValue>,
): void {
  if (input.result.status === "fulfilled") {
    input.onFulfilled(input.result.value);
    return;
  }

  if (shouldIgnoreDeferredStartupFailure(input.result.reason)) {
    return;
  }
  if (
    shouldRetryDeferredStartupFailure(input.result.reason) &&
    input.retryAttemptCount < DEFERRED_STARTUP_MAXIMUM_RETRY_ATTEMPTS
  ) {
    return;
  }
  input.reportDeferredStartupFailure(input.operation, input.result.reason);
}

function shouldIgnoreDeferredStartupFailure<ErrorType>(error: ErrorType): boolean {
  if (error instanceof Error && isRequestCanceledError(error)) {
    return true;
  }
  return false;
}

function shouldRetryDeferredStartupFailure<ErrorType>(error: ErrorType): boolean {
  const message = toErrorMessage(error);
  return (
    STARTUP_DEFERRED_FAILED_TO_FETCH_PATTERN.test(message) ||
    STARTUP_DEFERRED_EMPTY_JSON_RESPONSE_PATTERN.test(message) ||
    STARTUP_DEFERRED_RESTART_STATUS_PATTERN.test(message) ||
    STARTUP_DEFERRED_INVALID_JSON_RESTART_STATUS_PATTERN.test(message)
  );
}

async function readCapabilitySnapshot(
  input: CapabilitySnapshotReadInput,
): Promise<CoreDataCapabilitySnapshot> {
  const [modesResponse, modelsResponse, defaultsResponse] = await Promise.all([
    input.capabilityServerClient.listCollaborationModes(input.modesRequestOptions),
    input.capabilityServerClient.listModels(input.modelsRequestOptions),
    // Config defaults are optional at startup; preserve capability hydration even if this request fails.
    input.capabilityServerClient
      .readConfigDefaults({
        agentId: CONFIG_DEFAULTS_AGENT_ID,
        ...input.defaultsRequestOptions,
      })
      .catch(() => null),
  ]);

  return {
    modes: modesResponse,
    models: modelsResponse,
    defaults: defaultsResponse,
    fetchedAt: Date.now(),
  };
}

function applyDeferredStartupSnapshotResult<ResultValue>(input: {
  result: PromiseSettledResult<ResultValue>;
  operation: string;
  toSnapshotPartial: (value: ResultValue) => CoreDataSnapshotPartial | null;
  retryAttemptCount: number;
  applySnapshotState: SnapshotStateApplier;
  reportDeferredStartupFailure: DeferredStartupFailureReporter;
}): void {
  applyDeferredStartupResult({
    result: input.result,
    operation: input.operation,
    retryAttemptCount: input.retryAttemptCount,
    onFulfilled: (resultValue) => {
      const nextSnapshotPartial = input.toSnapshotPartial(resultValue);
      if (nextSnapshotPartial) {
        input.applySnapshotState(nextSnapshotPartial);
      }
    },
    reportDeferredStartupFailure: input.reportDeferredStartupFailure,
  });
}

/**
 * Owns critical startup thread reads and deferred non-critical hydration orchestration.
 * The owner enforces deterministic startup sequencing and stale-result cancellation.
 */
export class CoreDataStartupLoader {
  private deps: CoreDataStartupLoaderDependencies;
  private deferredStartupSequence = 0;

  public constructor(dependencies: CoreDataStartupLoaderDependencies) {
    this.deps = dependencies;
  }

  public updateDependencies(dependencies: CoreDataStartupLoaderDependencies): void {
    this.deps = dependencies;
  }

  public async loadCoreData(): Promise<void> {
    const applySnapshotState: SnapshotStateApplier = (snapshotPartial) => {
      startTransition(() => {
        applyCoreDataSnapshotState({
          ...snapshotPartial,
          debugWorkspaceStateStore: this.deps.debugWorkspaceStateStore,
          threadListStateController: this.deps.threadListStateController,
          debugErrorsSignatureRef: this.deps.debugErrorsSignatureRef,
          modesSignatureRef: this.deps.modesSignatureRef,
          modelsSignatureRef: this.deps.modelsSignatureRef,
          hasHydratedAgentSelectionRef: this.deps.hasHydratedAgentSelectionRef,
          setHealth: this.deps.setHealth,
          setThreads: this.deps.setThreads,
          setUnreadThreadIds: this.deps.setUnreadThreadIds,
          setModes: this.deps.setModes,
          setModels: this.deps.setModels,
          setConfigDefaults: this.deps.setConfigDefaults,
          setTraceStatus: this.deps.setTraceStatus,
          setHistory: this.deps.setHistory,
          setDebugErrors: this.deps.setDebugErrors,
          setDebugErrorSessionId: this.deps.setDebugErrorSessionId,
          setDebugErrorSessionLogPath: this.deps.setDebugErrorSessionLogPath,
          setAgentDescriptors: this.deps.setAgentDescriptors,
          setSelectedAgentId: this.deps.setSelectedAgentId,
          setSelectedThreadId: this.deps.setSelectedThreadId,
          setSelectedModeKey: this.deps.setSelectedModeKey,
          readInitialModeKey: this.deps.readInitialModeKey,
        });
      });
    };

    const reportDeferredStartupFailure: DeferredStartupFailureReporter = (operation, error) => {
      this.deps.handleRuntimeRequestError(createStartupTaggedError(operation, error));
    };

    const hasSession = await this.deps.ensureApiSessionBootstrapped();
    if (!hasSession) {
      return;
    }

    const startupCriticalThreadsRequest = this.deps.buildActionRequestOptions(
      STARTUP_CRITICAL_THREADS_OPERATION,
    );
    let nextActiveThreadState: LoadActiveThreadStateResult;
    try {
      nextActiveThreadState = await this.deps.threadListStateController.loadActiveThreadState(
        createActiveThreadStateLoadRequest({
          threadListLimit: this.deps.threadListLimit,
          threadListMaxPages: this.deps.threadListMaxPages,
          previousUnreadThreadIdentifiers: this.deps.unreadThreadIdsRef.current,
          selectedThreadIdentifier: this.deps.selectedThreadIdRef.current,
          // Prefer hot cache reads for event-driven refresh responsiveness.
          // Mutation owners invalidate this cache key before invoking refresh.
          readFromCache: STARTUP_CRITICAL_THREAD_READ_FROM_CACHE,
          requestOptions: startupCriticalThreadsRequest.requestOptions,
        }),
      );
    } catch (error) {
      throw createStartupTaggedError(STARTUP_CRITICAL_THREADS_OPERATION, error);
    }

    applySnapshotState({
      nextActiveThreadState,
    });

    const deferredStartupSequence = this.deferredStartupSequence + 1;
    this.deferredStartupSequence = deferredStartupSequence;

    // Keep startup sequencing deterministic: apply critical thread state first, then defer non-critical reads.
    this.scheduleDeferredStartupReads({
      deferredStartupSequence,
      retryAttemptCount: 0,
      shouldRevalidateActiveThreads: nextActiveThreadState.loadedFromCache,
      applySnapshotState,
      reportDeferredStartupFailure,
    });
  }

  private isDeferredStartupReadStale(deferredStartupSequence: number): boolean {
    return this.deferredStartupSequence !== deferredStartupSequence;
  }

  private scheduleDeferredStartupReads(input: {
    deferredStartupSequence: number;
    retryAttemptCount: number;
    shouldRevalidateActiveThreads: boolean;
    applySnapshotState: SnapshotStateApplier;
    reportDeferredStartupFailure: DeferredStartupFailureReporter;
  }): void {
    const delayMilliseconds =
      input.retryAttemptCount > 0
        ? DEFERRED_STARTUP_RETRY_DELAY_MILLISECONDS
        : DEFERRED_STARTUP_NEXT_TURN_DELAY_MILLISECONDS;
    window.setTimeout(() => {
      void this.runDeferredStartupReads(input);
    }, delayMilliseconds);
  }

  private async runDeferredStartupReads(input: {
    deferredStartupSequence: number;
    retryAttemptCount: number;
    shouldRevalidateActiveThreads: boolean;
    applySnapshotState: SnapshotStateApplier;
    reportDeferredStartupFailure: DeferredStartupFailureReporter;
  }): Promise<void> {
    if (this.isDeferredStartupReadStale(input.deferredStartupSequence)) {
      return;
    }

    const shouldLoadDebugWorkspaceData = this.deps.activeTabRef.current === "debug";
    const now = Date.now();
    const startupDeferredHealthRequest = this.deps.buildActionRequestOptions(
      STARTUP_DEFERRED_HEALTH_OPERATION,
    );
    const startupDeferredAgentsRequest = this.deps.buildActionRequestOptions(
      STARTUP_DEFERRED_AGENTS_OPERATION,
    );
    const startupDeferredTraceStatusRequest = this.deps.buildActionRequestOptions(
      STARTUP_DEFERRED_TRACE_STATUS_OPERATION,
    );
    const startupDeferredModesRequest = this.deps.buildActionRequestOptions(
      STARTUP_DEFERRED_MODES_OPERATION,
    );
    const startupDeferredModelsRequest = this.deps.buildActionRequestOptions(
      STARTUP_DEFERRED_MODELS_OPERATION,
    );
    const startupDeferredDefaultsRequest = this.deps.buildActionRequestOptions(
      STARTUP_DEFERRED_DEFAULTS_OPERATION,
    );
    const startupDeferredThreadsRevalidateRequest = this.deps.buildActionRequestOptions(
      STARTUP_DEFERRED_THREADS_REVALIDATE_OPERATION,
    );

    const capabilitiesPromise = this.deps.capabilitySnapshotCache.readSnapshot(
      () =>
        readCapabilitySnapshot({
          capabilityServerClient: this.deps.capabilityServerClient,
          modesRequestOptions: startupDeferredModesRequest.requestOptions,
          modelsRequestOptions: startupDeferredModelsRequest.requestOptions,
          defaultsRequestOptions: startupDeferredDefaultsRequest.requestOptions,
        }),
      now,
    );
    const debugWorkspaceDataPromise = shouldLoadDebugWorkspaceData
      ? this.deps.debugWorkspaceDataReader.readSnapshot(
          this.deps.debugHistoryLimit,
          this.deps.debugErrorListLimit,
          {
            historyRequestOptions: this.deps.buildActionRequestOptions(
              STARTUP_DEFERRED_DEBUG_HISTORY_OPERATION,
            ).requestOptions,
            debugErrorsRequestOptions: this.deps.buildActionRequestOptions(
              STARTUP_DEFERRED_DEBUG_ERRORS_OPERATION,
            ).requestOptions,
          },
        )
      : Promise.resolve<DebugWorkspaceDataSnapshot | null>(null);
    const revalidateActiveThreadsPromise = input.shouldRevalidateActiveThreads
      ? this.deps.threadListStateController.loadActiveThreadState(
          createActiveThreadStateLoadRequest({
            threadListLimit: this.deps.threadListLimit,
            threadListMaxPages: this.deps.threadListMaxPages,
            previousUnreadThreadIdentifiers: this.deps.unreadThreadIdsRef.current,
            selectedThreadIdentifier: this.deps.selectedThreadIdRef.current,
            readFromCache: false,
            requestOptions: startupDeferredThreadsRevalidateRequest.requestOptions,
          }),
        )
      : Promise.resolve<LoadActiveThreadStateResult | null>(null);

    // Deferred startup reads are intentionally parallel so non-critical hydration stays bounded by the slowest read.
    const freshHealthSnapshot = this.deps.deferredResourceCacheOwner.readHealthIfFresh(now);
    const freshAgentsSnapshot = this.deps.deferredResourceCacheOwner.readAgentsIfFresh(now);
    const [
      nextHealthResult,
      nextAgentsResult,
      nextCapabilitiesResult,
      nextTraceStatusResult,
      nextDebugWorkspaceDataResult,
      nextRevalidatedActiveThreadsResult,
    ] = await Promise.allSettled([
      freshHealthSnapshot !== null
        ? Promise.resolve(freshHealthSnapshot)
        : this.deps.capabilityServerClient
            .readHealthStatus(startupDeferredHealthRequest.requestOptions)
            .then((nextHealth) => {
              this.deps.deferredResourceCacheOwner.writeHealth(nextHealth, now);
              return nextHealth;
            }),
      freshAgentsSnapshot !== null
        ? Promise.resolve(freshAgentsSnapshot)
        : this.deps.capabilityServerClient
            .listAgents(startupDeferredAgentsRequest.requestOptions)
            .then((nextAgents) => {
              this.deps.deferredResourceCacheOwner.writeAgents(nextAgents, now);
              return nextAgents;
            }),
      capabilitiesPromise,
      shouldLoadDebugWorkspaceData
        ? this.deps.debugServerClient.readTraceStatus(
            startupDeferredTraceStatusRequest.requestOptions,
          )
        : Promise.resolve<TraceStatus | null>(null),
      debugWorkspaceDataPromise,
      revalidateActiveThreadsPromise,
    ]);

    // If another startup pass advanced the sequence while these reads were in flight, discard stale completion.
    if (this.isDeferredStartupReadStale(input.deferredStartupSequence)) {
      return;
    }

    applyDeferredStartupSnapshotResult({
      result: nextHealthResult,
      operation: STARTUP_DEFERRED_HEALTH_OPERATION,
      toSnapshotPartial: (nextHealth) => ({ nextHealth }),
      retryAttemptCount: input.retryAttemptCount,
      applySnapshotState: input.applySnapshotState,
      reportDeferredStartupFailure: input.reportDeferredStartupFailure,
    });
    applyDeferredStartupSnapshotResult({
      result: nextAgentsResult,
      operation: STARTUP_DEFERRED_AGENTS_OPERATION,
      toSnapshotPartial: (nextAgents) => ({ nextAgents }),
      retryAttemptCount: input.retryAttemptCount,
      applySnapshotState: input.applySnapshotState,
      reportDeferredStartupFailure: input.reportDeferredStartupFailure,
    });
    applyDeferredStartupSnapshotResult({
      result: nextCapabilitiesResult,
      operation: STARTUP_DEFERRED_MODES_OPERATION,
      toSnapshotPartial: (nextCapabilities) => ({ nextCapabilities }),
      retryAttemptCount: input.retryAttemptCount,
      applySnapshotState: input.applySnapshotState,
      reportDeferredStartupFailure: input.reportDeferredStartupFailure,
    });
    applyDeferredStartupSnapshotResult({
      result: nextTraceStatusResult,
      operation: STARTUP_DEFERRED_TRACE_STATUS_OPERATION,
      toSnapshotPartial: (nextTraceStatus) => (nextTraceStatus ? { nextTraceStatus } : null),
      retryAttemptCount: input.retryAttemptCount,
      applySnapshotState: input.applySnapshotState,
      reportDeferredStartupFailure: input.reportDeferredStartupFailure,
    });
    applyDeferredStartupSnapshotResult({
      result: nextDebugWorkspaceDataResult,
      operation: STARTUP_DEFERRED_DEBUG_HISTORY_OPERATION,
      toSnapshotPartial: (debugWorkspaceData) =>
        debugWorkspaceData ? { debugWorkspaceData } : null,
      retryAttemptCount: input.retryAttemptCount,
      applySnapshotState: input.applySnapshotState,
      reportDeferredStartupFailure: input.reportDeferredStartupFailure,
    });
    applyDeferredStartupSnapshotResult({
      result: nextRevalidatedActiveThreadsResult,
      operation: STARTUP_DEFERRED_THREADS_REVALIDATE_OPERATION,
      toSnapshotPartial: (nextActiveThreadState) =>
        nextActiveThreadState === null ? null : { nextActiveThreadState },
      retryAttemptCount: input.retryAttemptCount,
      applySnapshotState: input.applySnapshotState,
      reportDeferredStartupFailure: input.reportDeferredStartupFailure,
    });

    if (
      input.retryAttemptCount < DEFERRED_STARTUP_MAXIMUM_RETRY_ATTEMPTS &&
      [
        nextHealthResult,
        nextAgentsResult,
        nextCapabilitiesResult,
        nextTraceStatusResult,
        nextDebugWorkspaceDataResult,
        nextRevalidatedActiveThreadsResult,
      ].some(
        (result) =>
          result.status === "rejected" && shouldRetryDeferredStartupFailure(result.reason),
      )
    ) {
      this.scheduleDeferredStartupReads({
        deferredStartupSequence: input.deferredStartupSequence,
        retryAttemptCount: input.retryAttemptCount + 1,
        shouldRevalidateActiveThreads: input.shouldRevalidateActiveThreads,
        applySnapshotState: input.applySnapshotState,
        reportDeferredStartupFailure: input.reportDeferredStartupFailure,
      });
    }
  }
}
