import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  startTransition,
  useEffect,
  useRef,
} from "react";
import {
  type CapabilityReadNotificationEventsOptions,
  type CapabilityServerClient,
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import { isThreadNotLoadedReadError } from "@/Features/Chat/DomainModel/ReadThreadErrorClassifier";
import { type ApplySelectedThreadStreamDeltaInput } from "@/Features/Chat/StateManagement/UseSelectedThreadLoaders";
import type {
  DebugErrorListResponse,
  DebugHistoryResponse,
} from "@/Features/Debugging/DataAccess/DebugServerClient";
import { DebugWorkspaceDataReader } from "@/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
import { DebugWorkspaceStateStore } from "@/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import {
  type ThreadRuntimeStatusByThreadIdentifier,
  type ThreadSidebarRuntimeSummary,
} from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { type ThreadListStateController } from "@/Features/Threads/StateManagement/ThreadListStateController";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import { isRequestCanceledError } from "@/Shared/Errors/RequestCanceledError";
import { EventRefreshScheduler } from "./EventRefreshScheduler";
import { EventStreamConnectionCoordinator } from "./EventStreamConnectionCoordinator";
import { type EventStreamRefreshDecisionReader } from "./EventStreamRefreshDecisionEngine";
import {
  isScheduledRefreshDocumentVisible,
  readScheduledRefreshExecutionSnapshot,
  shouldRefreshDebugWorkspace,
} from "./EventStreamScheduledRefreshPolicy";
import {
  refreshPendingServerRequestThreadStatuses,
  shouldRefreshPendingServerRequestThreadStatuses,
  usePendingServerRequestThreadStatusHydrationEffect,
} from "./PendingServerRequestThreadStatusRefreshOwner";
import { readRuntimeNotificationProjection } from "./RuntimeNotificationProjectionParser";
import { RuntimeNotificationReadObservabilityOwner } from "./RuntimeNotificationReadObservabilityOwner";
import { applyRuntimeThreadStatusUpdates } from "./RuntimeThreadStatusStateReducer";
import { RuntimeWarningBannerPolicyOwner } from "./RuntimeWarningBannerPolicyOwner";
import {
  createInitialThreadSidebarRuntimeSummary,
  readLatestModelRerouteEventForThread,
  readLatestThreadProgressEventForThread,
  readLatestThreadTokenUsageUpdateForThread,
  readLatestWarningEvent,
  readThreadRuntimeModelRerouteSummary,
  readThreadRuntimeProgressSummary,
  readThreadSidebarAccountSummary,
  readThreadSidebarAppsSummary,
  readThreadSidebarRateLimitSummary,
  readThreadSidebarTokenUsageSummary,
} from "./ThreadSidebarRuntimeSummaryProjection";
import type { SelectedThreadLoaderOptions } from "./UseCoreDataLoaders";
import { useThreadSidebarRuntimeHydrationEffect } from "./UseThreadSidebarRuntimeHydrationEffect";

const NOTIFICATION_EVENTS_REFRESH_LIMIT = 80;
const SIDEBAR_APPS_LIST_LIMIT = 100;
const SELECTED_THREAD_INCREMENTAL_REFRESH_OPTIONS: SelectedThreadLoaderOptions = {
  includeReadThread: true,
  includeTurns: false,
};
const TRANSIENT_NOTIFICATION_PROJECTION_ROUTE_PATTERNS = [
  /\/api\/notifications\/events\b/i,
  /\/api\/account\b/i,
  /\/api\/account\/rate-limits\b/i,
  /\/api\/apps\b/i,
  /\/api\/server-requests\/pending\b/i,
] as const;
const TRANSIENT_NOTIFICATION_PROJECTION_FAILED_TO_FETCH_PATTERN = /failed to fetch status=n\/a/i;
const TRANSIENT_NOTIFICATION_PROJECTION_EMPTY_RESPONSE_PATTERN = /empty response status=200/i;
const TRANSIENT_NOTIFICATION_PROJECTION_STATUS_PATTERN = /status=(502|503|504)\b/i;

interface RuntimeNotificationProjectionCursorState {
  nextSequence: number | null;
}

function createInitialRuntimeNotificationProjectionCursorState(): RuntimeNotificationProjectionCursorState {
  return {
    nextSequence: null,
  };
}

function createEmptyThreadRuntimeStatusByThreadIdentifier(): ThreadRuntimeStatusByThreadIdentifier {
  return {};
}

function readNotificationEventsRequestOptions(input: {
  selectedAgentId: AgentId;
  notificationProjectionCursorState: RuntimeNotificationProjectionCursorState;
}): CapabilityReadNotificationEventsOptions {
  return {
    agentId: input.selectedAgentId,
    limit: NOTIFICATION_EVENTS_REFRESH_LIMIT,
    sinceSequence: input.notificationProjectionCursorState.nextSequence,
  };
}

interface UseRuntimeProjectionResetEffectInput {
  selectedAgentId: AgentId;
  setThreadRuntimeStatusByThreadIdentifier: Dispatch<
    SetStateAction<ThreadRuntimeStatusByThreadIdentifier>
  >;
  setThreadSidebarRuntimeSummary: Dispatch<SetStateAction<ThreadSidebarRuntimeSummary>>;
}

function useRuntimeProjectionResetEffect(
  input: UseRuntimeProjectionResetEffectInput,
  runtimeNotificationProjectionCursorStateRef: MutableRefObject<RuntimeNotificationProjectionCursorState>,
  runtimeWarningBannerPolicyOwnerRef: MutableRefObject<RuntimeWarningBannerPolicyOwner>,
): void {
  useEffect(() => {
    const runtimeNotificationProjectionCursorState = runtimeNotificationProjectionCursorStateRef;
    runtimeNotificationProjectionCursorState.current =
      createInitialRuntimeNotificationProjectionCursorState();
    runtimeWarningBannerPolicyOwnerRef.current.resetSelectedThread(null);
    input.setThreadRuntimeStatusByThreadIdentifier(
      createEmptyThreadRuntimeStatusByThreadIdentifier(),
    );
    input.setThreadSidebarRuntimeSummary(createInitialThreadSidebarRuntimeSummary());
  }, [
    input.selectedAgentId,
    input.setThreadRuntimeStatusByThreadIdentifier,
    input.setThreadSidebarRuntimeSummary,
  ]);
}

interface UseRuntimeWarningThreadSwitchEffectInput {
  selectedThreadId: string | null;
  setThreadSidebarRuntimeSummary: Dispatch<SetStateAction<ThreadSidebarRuntimeSummary>>;
}

function useRuntimeWarningThreadSwitchEffect(
  input: UseRuntimeWarningThreadSwitchEffectInput,
  runtimeWarningBannerPolicyOwnerRef: MutableRefObject<RuntimeWarningBannerPolicyOwner>,
): void {
  useEffect(() => {
    const threadSwitchRequiresWarningClear =
      runtimeWarningBannerPolicyOwnerRef.current.readThreadSwitchRequiresWarningClear(
        input.selectedThreadId,
      );
    if (!threadSwitchRequiresWarningClear) {
      return;
    }
    input.setThreadSidebarRuntimeSummary((previousSummary) => {
      if (previousSummary.warning === null) {
        return previousSummary;
      }
      return {
        ...previousSummary,
        warning: null,
      };
    });
  }, [input.selectedThreadId, input.setThreadSidebarRuntimeSummary]);
}

function isMissingSelectedThreadReadError<ErrorType>(error: ErrorType): boolean {
  return isThreadNotLoadedReadError(toErrorMessage(error));
}

function isTransientNotificationProjectionRefreshError<ErrorType>(error: ErrorType): boolean {
  const message = toErrorMessage(error);
  if (!TRANSIENT_NOTIFICATION_PROJECTION_ROUTE_PATTERNS.some((pattern) => pattern.test(message))) {
    return false;
  }

  return (
    TRANSIENT_NOTIFICATION_PROJECTION_FAILED_TO_FETCH_PATTERN.test(message) ||
    TRANSIENT_NOTIFICATION_PROJECTION_EMPTY_RESPONSE_PATTERN.test(message) ||
    TRANSIENT_NOTIFICATION_PROJECTION_STATUS_PATTERN.test(message)
  );
}

export interface UseEventStreamEffectsInput {
  debugHistoryLimit: number;
  debugErrorListLimit: number;
  isSidebarVisible: boolean;
  ensureApiSessionBootstrapped: () => Promise<boolean>;
  eventRefreshScheduler: EventRefreshScheduler;
  eventStreamConnectionCoordinator: EventStreamConnectionCoordinator;
  eventStreamRefreshDecisionEngine: EventStreamRefreshDecisionReader;
  selectedThreadId: string | null;
  activeTabRef: MutableRefObject<"chat" | "debug">;
  selectedThreadIdRef: MutableRefObject<string | null>;
  setSelectedThreadId: Dispatch<SetStateAction<string | null>>;
  setErrorMessage: Dispatch<SetStateAction<string>>;
  loadCoreDataTrackedRef: MutableRefObject<(() => Promise<void>) | null>;
  loadSelectedThreadRef: MutableRefObject<
    ((threadId: string, options?: SelectedThreadLoaderOptions) => Promise<void>) | null
  >;
  debugWorkspaceDataReader: DebugWorkspaceDataReader;
  debugWorkspaceStateStore: DebugWorkspaceStateStore;
  debugErrorsSignatureRef: MutableRefObject<string[]>;
  eventsConnectedRef: MutableRefObject<boolean>;
  threadListStateController: ThreadListStateController;
  capabilityServerClient: CapabilityServerClient;
  selectedAgentId: AgentId;
  canReadNotificationEvents: boolean;
  canReadAccount: boolean;
  canReadAccountRateLimits: boolean;
  canListApps: boolean;
  setThreadRuntimeStatusByThreadIdentifier: Dispatch<
    SetStateAction<ThreadRuntimeStatusByThreadIdentifier>
  >;
  setThreadSidebarRuntimeSummary: Dispatch<SetStateAction<ThreadSidebarRuntimeSummary>>;
  setHistory: Dispatch<SetStateAction<DebugHistoryResponse["history"]>>;
  setDebugErrors: Dispatch<SetStateAction<DebugErrorListResponse["data"]>>;
  setDebugErrorSessionId: Dispatch<SetStateAction<string>>;
  setDebugErrorSessionLogPath: Dispatch<SetStateAction<string>>;
  applySelectedThreadStreamDelta: (input: ApplySelectedThreadStreamDeltaInput) => void;
  handleRuntimeRequestError: <ErrorType>(error: ErrorType) => void;
}

interface ApplyNotificationProjectionRefreshInput {
  input: UseEventStreamEffectsInput;
  selectedThreadId: string | null;
  runtimeNotificationProjectionCursorStateRef: MutableRefObject<RuntimeNotificationProjectionCursorState>;
  runtimeNotificationReadObservabilityOwnerRef: MutableRefObject<RuntimeNotificationReadObservabilityOwner>;
  runtimeWarningBannerPolicyOwnerRef: MutableRefObject<RuntimeWarningBannerPolicyOwner>;
}

async function applyNotificationProjectionRefresh(
  input: ApplyNotificationProjectionRefreshInput,
): Promise<void> {
  const runtimeNotificationProjectionCursorState =
    input.runtimeNotificationProjectionCursorStateRef;
  const runtimeNotificationProjectionCursorStateValue =
    runtimeNotificationProjectionCursorState.current;
  const notificationEventsResponse =
    await input.input.capabilityServerClient.readNotificationEvents(
      readNotificationEventsRequestOptions({
        selectedAgentId: input.input.selectedAgentId,
        notificationProjectionCursorState: runtimeNotificationProjectionCursorStateValue,
      }),
    );
  const runtimeNotificationProjection = readRuntimeNotificationProjection(
    notificationEventsResponse,
  );
  runtimeNotificationProjectionCursorState.current = {
    nextSequence: runtimeNotificationProjection.nextSequence,
  };

  input.input.setThreadRuntimeStatusByThreadIdentifier((previousThreadStatusByThreadId) => {
    if (
      runtimeNotificationProjection.resetRequired &&
      runtimeNotificationProjection.threadStatusUpdates.length === 0
    ) {
      return Object.keys(previousThreadStatusByThreadId).length > 0
        ? createEmptyThreadRuntimeStatusByThreadIdentifier()
        : previousThreadStatusByThreadId;
    }

    const baselineThreadStatusByThreadIdentifier = runtimeNotificationProjection.resetRequired
      ? createEmptyThreadRuntimeStatusByThreadIdentifier()
      : previousThreadStatusByThreadId;

    if (runtimeNotificationProjection.threadStatusUpdates.length === 0) {
      return baselineThreadStatusByThreadIdentifier;
    }

    const updateResult = applyRuntimeThreadStatusUpdates({
      previousStatusByThreadIdentifier: baselineThreadStatusByThreadIdentifier,
      updates: runtimeNotificationProjection.threadStatusUpdates,
    });

    return updateResult.nextStatusByThreadIdentifier;
  });

  const latestTokenUsageUpdateForSelectedThread = readLatestThreadTokenUsageUpdateForThread(
    runtimeNotificationProjection.threadTokenUsageUpdates,
    input.selectedThreadId,
  );
  const latestModelRerouteEventForSelectedThread = readLatestModelRerouteEventForThread(
    runtimeNotificationProjection.modelRerouteEvents,
    input.selectedThreadId,
  );
  const latestThreadProgressEventForSelectedThread = readLatestThreadProgressEventForThread(
    runtimeNotificationProjection.threadProgressEvents,
    input.selectedThreadId,
  );
  const latestWarningEvent = readLatestWarningEvent(
    runtimeNotificationProjection.warningEvents,
    input.selectedThreadId,
  );

  if (
    runtimeNotificationProjection.resetRequired ||
    latestTokenUsageUpdateForSelectedThread !== null ||
    latestModelRerouteEventForSelectedThread !== null ||
    latestThreadProgressEventForSelectedThread !== null ||
    latestWarningEvent !== null
  ) {
    input.input.setThreadSidebarRuntimeSummary((previousSummary) => {
      const nextTokenUsageSummary =
        latestTokenUsageUpdateForSelectedThread !== null
          ? readThreadSidebarTokenUsageSummary(latestTokenUsageUpdateForSelectedThread)
          : runtimeNotificationProjection.resetRequired
            ? null
            : previousSummary.tokenUsage;
      const nextModelRerouteSummary =
        latestModelRerouteEventForSelectedThread !== null
          ? readThreadRuntimeModelRerouteSummary(latestModelRerouteEventForSelectedThread)
          : runtimeNotificationProjection.resetRequired
            ? null
            : previousSummary.modelReroute;
      const nextThreadProgressSummary =
        latestThreadProgressEventForSelectedThread !== null
          ? readThreadRuntimeProgressSummary(latestThreadProgressEventForSelectedThread)
          : runtimeNotificationProjection.resetRequired
            ? null
            : previousSummary.progress;
      const nextWarningSummary =
        input.runtimeWarningBannerPolicyOwnerRef.current.readNextWarningSummary({
          previousSummary: previousSummary.warning,
          latestWarningEvent,
          resetRequired: runtimeNotificationProjection.resetRequired,
        });

      if (
        nextTokenUsageSummary === previousSummary.tokenUsage &&
        nextModelRerouteSummary === previousSummary.modelReroute &&
        nextThreadProgressSummary === previousSummary.progress &&
        nextWarningSummary === previousSummary.warning
      ) {
        return previousSummary;
      }

      return {
        ...previousSummary,
        progress: nextThreadProgressSummary,
        warning: nextWarningSummary,
        tokenUsage: nextTokenUsageSummary,
        modelReroute: nextModelRerouteSummary,
      };
    });
  }

  input.runtimeNotificationReadObservabilityOwnerRef.current.recordRead({
    processedEventCount: runtimeNotificationProjection.processedEventCount,
    relevantEventCount: runtimeNotificationProjection.relevantEventCount,
    threadStatusUpdateCount: runtimeNotificationProjection.threadStatusUpdates.length,
    requestedRateLimitRefresh: runtimeNotificationProjection.shouldRefreshAccountRateLimits,
    requestedAppsRefresh: runtimeNotificationProjection.shouldRefreshApps,
    resetRequired: runtimeNotificationProjection.resetRequired,
  });

  if (runtimeNotificationProjection.shouldRefreshAccount && input.input.canReadAccount) {
    const accountResponse = await input.input.capabilityServerClient.readAccount({
      agentId: input.input.selectedAgentId,
    });
    input.input.setThreadSidebarRuntimeSummary((previousSummary) => ({
      ...previousSummary,
      account: readThreadSidebarAccountSummary(accountResponse),
    }));
  }

  if (
    runtimeNotificationProjection.shouldRefreshAccountRateLimits &&
    input.input.canReadAccountRateLimits
  ) {
    const rateLimitsResponse = await input.input.capabilityServerClient.readAccountRateLimits({
      agentId: input.input.selectedAgentId,
    });
    input.input.setThreadSidebarRuntimeSummary((previousSummary) => ({
      ...previousSummary,
      rateLimits: readThreadSidebarRateLimitSummary(rateLimitsResponse),
    }));
  }

  if (runtimeNotificationProjection.shouldRefreshApps && input.input.canListApps) {
    const appsResponse = await input.input.capabilityServerClient.listApps({
      limit: SIDEBAR_APPS_LIST_LIMIT,
    });
    input.input.setThreadSidebarRuntimeSummary((previousSummary) => ({
      ...previousSummary,
      apps: readThreadSidebarAppsSummary(appsResponse),
    }));
  }

  if (
    shouldRefreshPendingServerRequestThreadStatuses({
      resetRequired: runtimeNotificationProjection.resetRequired,
      warningEvents: runtimeNotificationProjection.warningEvents,
    })
  ) {
    await refreshPendingServerRequestThreadStatuses({
      selectedAgentId: input.input.selectedAgentId,
      capabilityServerClient: input.input.capabilityServerClient,
      setThreadRuntimeStatusByThreadIdentifier:
        input.input.setThreadRuntimeStatusByThreadIdentifier,
    });
  }
}

function useEventStreamConnectionLifecycleEffect(
  input: UseEventStreamEffectsInput,
  runtimeNotificationProjectionCursorStateRef: MutableRefObject<RuntimeNotificationProjectionCursorState>,
  runtimeNotificationReadObservabilityOwnerRef: MutableRefObject<RuntimeNotificationReadObservabilityOwner>,
  runtimeWarningBannerPolicyOwnerRef: MutableRefObject<RuntimeWarningBannerPolicyOwner>,
): void {
  const runtimeNotificationProjectionCursorState = runtimeNotificationProjectionCursorStateRef;

  useEffect(() => {
    let shouldStopConnectionStart = false;
    const startEventStreamConnection = async (): Promise<void> => {
      try {
        const hasApiSession = await input.ensureApiSessionBootstrapped();
        if (!hasApiSession || shouldStopConnectionStart) {
          return;
        }

        input.eventStreamConnectionCoordinator.start({
          eventRefreshScheduler: input.eventRefreshScheduler,
          eventStreamRefreshDecisionEngine: input.eventStreamRefreshDecisionEngine,
          readSnapshot: () => ({
            activeTab: input.activeTabRef.current,
            selectedThreadId: input.selectedThreadIdRef.current,
          }),
          executeScheduledRefresh: async (flags) => {
            if (!isScheduledRefreshDocumentVisible()) {
              return;
            }

            const scheduledRefreshSnapshot = readScheduledRefreshExecutionSnapshot(
              input.activeTabRef,
              input.selectedThreadIdRef,
            );
            try {
              // Freeze mutable refs once so each scheduled refresh run applies one consistent snapshot.
              const loadCoreDataFunction = input.loadCoreDataTrackedRef.current;
              const loadSelectedThreadFunction = input.loadSelectedThreadRef.current;
              const refreshOperations: Array<Promise<void>> = [];

              if (flags.refreshCore) {
                input.threadListStateController.invalidateActiveThreadQuery();
                if (loadCoreDataFunction) {
                  refreshOperations.push(loadCoreDataFunction());
                }
              } else if (shouldRefreshDebugWorkspace(flags, scheduledRefreshSnapshot.activeTab)) {
                const debugWorkspaceSnapshot = await input.debugWorkspaceDataReader.readSnapshot(
                  input.debugHistoryLimit,
                  input.debugErrorListLimit,
                );

                startTransition(() => {
                  input.setHistory((previousHistory) =>
                    input.debugWorkspaceStateStore.readNextHistory(
                      previousHistory,
                      debugWorkspaceSnapshot.history,
                    ),
                  );

                  if (
                    input.debugWorkspaceStateStore.shouldApplyDebugErrors(
                      input.debugErrorsSignatureRef.current,
                      debugWorkspaceSnapshot.debugErrorsSignature,
                    )
                  ) {
                    const debugErrorsSignatureRef = input.debugErrorsSignatureRef;
                    debugErrorsSignatureRef.current = debugWorkspaceSnapshot.debugErrorsSignature;
                    input.setDebugErrors(debugWorkspaceSnapshot.debugErrors);
                  }

                  input.setDebugErrorSessionId(debugWorkspaceSnapshot.debugErrorSessionId);
                  input.setDebugErrorSessionLogPath(
                    debugWorkspaceSnapshot.debugErrorSessionLogPath,
                  );
                });
              }

              if (
                flags.refreshSelectedThread &&
                scheduledRefreshSnapshot.selectedThreadId !== null &&
                scheduledRefreshSnapshot.selectedThreadId.length > 0 &&
                loadSelectedThreadFunction
              ) {
                refreshOperations.push(
                  loadSelectedThreadFunction(
                    scheduledRefreshSnapshot.selectedThreadId,
                    SELECTED_THREAD_INCREMENTAL_REFRESH_OPTIONS,
                  ),
                );
              }

              if (flags.refreshNotificationProjections && input.canReadNotificationEvents) {
                await applyNotificationProjectionRefresh({
                  input,
                  selectedThreadId: scheduledRefreshSnapshot.selectedThreadId,
                  runtimeNotificationProjectionCursorStateRef:
                    runtimeNotificationProjectionCursorState,
                  runtimeNotificationReadObservabilityOwnerRef,
                  runtimeWarningBannerPolicyOwnerRef,
                });
              }

              if (refreshOperations.length > 0) {
                await Promise.all(refreshOperations);
              }
            } catch (error) {
              if (error instanceof Error && isRequestCanceledError(error)) {
                return;
              }
              if (
                flags.refreshSelectedThread &&
                scheduledRefreshSnapshot.selectedThreadId !== null &&
                scheduledRefreshSnapshot.selectedThreadId.length > 0 &&
                isMissingSelectedThreadReadError(error)
              ) {
                if (
                  input.selectedThreadIdRef.current === scheduledRefreshSnapshot.selectedThreadId
                ) {
                  const selectedThreadIdRef = input.selectedThreadIdRef;
                  selectedThreadIdRef.current = null;
                  input.setSelectedThreadId(null);
                  input.setErrorMessage("");
                }
                return;
              }
              if (
                flags.refreshNotificationProjections &&
                isTransientNotificationProjectionRefreshError(error)
              ) {
                return;
              }
              input.handleRuntimeRequestError(error);
            }
          },
          applyThreadStreamDelta: (threadStreamDelta) => {
            input.applySelectedThreadStreamDelta({
              threadId: threadStreamDelta.threadId,
              liveStateSnapshot: threadStreamDelta.liveStateSnapshot,
              streamEventsSnapshot: threadStreamDelta.streamEventsSnapshot,
              streamEventsSinceSequenceUsed: threadStreamDelta.streamEventsSinceSequenceUsed,
            });
          },
          onConnectionStatusChange: (connected) => {
            const eventsConnectedRef = input.eventsConnectedRef;
            eventsConnectedRef.current = connected;
          },
        });
      } catch (error) {
        if (shouldStopConnectionStart) {
          return;
        }
        if (error instanceof Error && isRequestCanceledError(error)) {
          return;
        }
        input.handleRuntimeRequestError(error);
      }
    };
    void startEventStreamConnection();

    return () => {
      shouldStopConnectionStart = true;
      input.eventStreamConnectionCoordinator.stop();
    };
  }, [
    input.activeTabRef,
    input.ensureApiSessionBootstrapped,
    input.debugErrorListLimit,
    input.debugErrorsSignatureRef,
    input.debugHistoryLimit,
    input.debugWorkspaceDataReader,
    input.debugWorkspaceStateStore,
    input.eventRefreshScheduler,
    input.eventStreamConnectionCoordinator,
    input.eventStreamRefreshDecisionEngine,
    input.eventsConnectedRef,
    input.threadListStateController,
    input.capabilityServerClient,
    input.selectedAgentId,
    input.canReadNotificationEvents,
    input.canReadAccount,
    input.canReadAccountRateLimits,
    input.canListApps,
    input.applySelectedThreadStreamDelta,
    input.handleRuntimeRequestError,
    input.loadCoreDataTrackedRef,
    input.loadSelectedThreadRef,
    input.setErrorMessage,
    input.setSelectedThreadId,
    input.selectedThreadIdRef,
    input.setThreadRuntimeStatusByThreadIdentifier,
    input.setThreadSidebarRuntimeSummary,
    input.setDebugErrorSessionId,
    input.setDebugErrorSessionLogPath,
    input.setDebugErrors,
    input.setHistory,
  ]);
}

export function useEventStreamEffects(input: UseEventStreamEffectsInput): void {
  const runtimeNotificationProjectionCursorStateRef =
    useRef<RuntimeNotificationProjectionCursorState>(
      createInitialRuntimeNotificationProjectionCursorState(),
    );
  const runtimeNotificationReadObservabilityOwnerRef =
    useRef<RuntimeNotificationReadObservabilityOwner>(
      new RuntimeNotificationReadObservabilityOwner(),
    );
  const runtimeWarningBannerPolicyOwnerRef = useRef<RuntimeWarningBannerPolicyOwner>(
    new RuntimeWarningBannerPolicyOwner(),
  );
  useRuntimeProjectionResetEffect(
    {
      selectedAgentId: input.selectedAgentId,
      setThreadRuntimeStatusByThreadIdentifier: input.setThreadRuntimeStatusByThreadIdentifier,
      setThreadSidebarRuntimeSummary: input.setThreadSidebarRuntimeSummary,
    },
    runtimeNotificationProjectionCursorStateRef,
    runtimeWarningBannerPolicyOwnerRef,
  );
  useRuntimeWarningThreadSwitchEffect(
    {
      selectedThreadId: input.selectedThreadId,
      setThreadSidebarRuntimeSummary: input.setThreadSidebarRuntimeSummary,
    },
    runtimeWarningBannerPolicyOwnerRef,
  );
  usePendingServerRequestThreadStatusHydrationEffect(input);
  useThreadSidebarRuntimeHydrationEffect(input);
  useEventStreamConnectionLifecycleEffect(
    input,
    runtimeNotificationProjectionCursorStateRef,
    runtimeNotificationReadObservabilityOwnerRef,
    runtimeWarningBannerPolicyOwnerRef,
  );
}
