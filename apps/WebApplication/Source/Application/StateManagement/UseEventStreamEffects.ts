import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  startTransition,
  useEffect,
  useRef,
} from "react";
import {
  type CapabilityAccountRateLimitsResponse,
  type CapabilityAccountResponse,
  type CapabilityAppsResponse,
  type CapabilityReadNotificationEventsOptions,
  type CapabilityServerClient,
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
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
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import { isRequestCanceledError } from "@/Shared/Errors/RequestCanceledError";
import { type EventRefreshFlags, EventRefreshScheduler } from "./EventRefreshScheduler";
import { EventStreamConnectionCoordinator } from "./EventStreamConnectionCoordinator";
import { type EventStreamRefreshDecisionReader } from "./EventStreamRefreshDecisionEngine";
import { readRuntimeNotificationProjection } from "./RuntimeNotificationProjectionParser";
import { RuntimeNotificationReadObservabilityOwner } from "./RuntimeNotificationReadObservabilityOwner";
import { applyRuntimeThreadStatusUpdates } from "./RuntimeThreadStatusStateReducer";
import type { SelectedThreadLoaderOptions } from "./UseCoreDataLoaders";

const DOCUMENT_VISIBILITY_STATE_VISIBLE = "visible";
const DEBUG_APPLICATION_TAB = "debug";
const NOTIFICATION_EVENTS_REFRESH_LIMIT = 80;
const SIDEBAR_APPS_LIST_LIMIT = 100;
const SIDEBAR_RUNTIME_SUMMARY_REFRESH_OPERATION = "refresh-sidebar-runtime-summary";
const SELECTED_THREAD_INCREMENTAL_REFRESH_OPTIONS: SelectedThreadLoaderOptions = {
  includeReadThread: true,
  includeTurns: false,
};

interface ScheduledRefreshExecutionSnapshot {
  activeTab: "chat" | "debug";
  selectedThreadId: string | null;
}

interface RuntimeNotificationProjectionCursorState {
  nextSequence: number | null;
}

function isScheduledRefreshDocumentVisible(): boolean {
  return document.visibilityState === DOCUMENT_VISIBILITY_STATE_VISIBLE;
}

function readScheduledRefreshExecutionSnapshot(
  activeTabRef: MutableRefObject<"chat" | "debug">,
  selectedThreadIdRef: MutableRefObject<string | null>,
): ScheduledRefreshExecutionSnapshot {
  return {
    activeTab: activeTabRef.current,
    selectedThreadId: selectedThreadIdRef.current,
  };
}

function shouldRefreshDebugWorkspace(
  refreshFlags: EventRefreshFlags,
  activeTab: "chat" | "debug",
): boolean {
  return (
    !refreshFlags.refreshCore && refreshFlags.refreshHistory && activeTab === DEBUG_APPLICATION_TAB
  );
}

function createInitialRuntimeNotificationProjectionCursorState(): RuntimeNotificationProjectionCursorState {
  return {
    nextSequence: null,
  };
}

function createEmptyThreadRuntimeStatusByThreadIdentifier(): ThreadRuntimeStatusByThreadIdentifier {
  return {};
}

function createInitialThreadSidebarRuntimeSummary(): ThreadSidebarRuntimeSummary {
  return {
    account: null,
    rateLimits: null,
    apps: null,
  };
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

function readThreadSidebarAccountSummary(
  response: CapabilityAccountResponse,
): NonNullable<ThreadSidebarRuntimeSummary["account"]> {
  if (response.account === null) {
    return {
      mode: "signedOut",
      planType: null,
      email: null,
      requiresOpenaiAuth: response.requiresOpenaiAuth,
      refreshedAtMilliseconds: Date.now(),
    };
  }

  if (response.account.type === "apiKey") {
    return {
      mode: "apiKey",
      planType: null,
      email: null,
      requiresOpenaiAuth: response.requiresOpenaiAuth,
      refreshedAtMilliseconds: Date.now(),
    };
  }

  return {
    mode: "chatgpt",
    planType: response.account.planType,
    email: response.account.email,
    requiresOpenaiAuth: response.requiresOpenaiAuth,
    refreshedAtMilliseconds: Date.now(),
  };
}

function readThreadSidebarRateLimitSummary(
  response: CapabilityAccountRateLimitsResponse,
): NonNullable<ThreadSidebarRuntimeSummary["rateLimits"]> {
  return {
    limitId: response.rateLimits?.limitId ?? null,
    planType: response.rateLimits?.planType ?? null,
    usedPercent: response.rateLimits?.primary?.usedPercent ?? null,
    refreshedAtMilliseconds: Date.now(),
  };
}

function readThreadSidebarAppsSummary(
  response: CapabilityAppsResponse,
): NonNullable<ThreadSidebarRuntimeSummary["apps"]> {
  return {
    appCount: response.data.length,
    refreshedAtMilliseconds: Date.now(),
  };
}

interface RefreshThreadSidebarRuntimeSummaryInput {
  selectedAgentId: AgentId;
  canReadAccount: boolean;
  canReadAccountRateLimits: boolean;
  canListApps: boolean;
  capabilityServerClient: CapabilityServerClient;
  setThreadSidebarRuntimeSummary: Dispatch<SetStateAction<ThreadSidebarRuntimeSummary>>;
  shouldCancel: () => boolean;
}

async function refreshThreadSidebarRuntimeSummary(
  input: RefreshThreadSidebarRuntimeSummaryInput,
): Promise<void> {
  const refreshOperations: Promise<void>[] = [];

  if (input.canReadAccount) {
    const refreshAccountSummary = async (): Promise<void> => {
      const accountResponse = await input.capabilityServerClient.readAccount({
        agentId: input.selectedAgentId,
      });
      if (input.shouldCancel()) {
        return;
      }
      input.setThreadSidebarRuntimeSummary((previousSummary) => ({
        ...previousSummary,
        account: readThreadSidebarAccountSummary(accountResponse),
      }));
    };
    refreshOperations.push(refreshAccountSummary());
  }

  if (input.canReadAccountRateLimits) {
    const refreshRateLimitsSummary = async (): Promise<void> => {
      const rateLimitsResponse = await input.capabilityServerClient.readAccountRateLimits({
        agentId: input.selectedAgentId,
      });
      if (input.shouldCancel()) {
        return;
      }
      input.setThreadSidebarRuntimeSummary((previousSummary) => ({
        ...previousSummary,
        rateLimits: readThreadSidebarRateLimitSummary(rateLimitsResponse),
      }));
    };
    refreshOperations.push(refreshRateLimitsSummary());
  }

  if (input.canListApps) {
    const refreshAppsSummary = async (): Promise<void> => {
      const appsResponse = await input.capabilityServerClient.listApps({
        limit: SIDEBAR_APPS_LIST_LIMIT,
      });
      if (input.shouldCancel()) {
        return;
      }
      input.setThreadSidebarRuntimeSummary((previousSummary) => ({
        ...previousSummary,
        apps: readThreadSidebarAppsSummary(appsResponse),
      }));
    };
    refreshOperations.push(refreshAppsSummary());
  }

  if (refreshOperations.length === 0) {
    return;
  }

  await Promise.all(refreshOperations);
}

export interface UseEventStreamEffectsInput {
  debugHistoryLimit: number;
  debugErrorListLimit: number;
  ensureApiSessionBootstrapped: () => Promise<boolean>;
  eventRefreshScheduler: EventRefreshScheduler;
  eventStreamConnectionCoordinator: EventStreamConnectionCoordinator;
  eventStreamRefreshDecisionEngine: EventStreamRefreshDecisionReader;
  activeTabRef: MutableRefObject<"chat" | "debug">;
  selectedThreadIdRef: MutableRefObject<string | null>;
  loadCoreDataTrackedRef: MutableRefObject<(() => Promise<void>) | null>;
  loadSelectedThreadRef: MutableRefObject<
    ((threadId: string, options?: SelectedThreadLoaderOptions) => Promise<void>) | null
  >;
  debugWorkspaceDataReader: DebugWorkspaceDataReader;
  debugWorkspaceStateStore: DebugWorkspaceStateStore;
  debugErrorsSignatureRef: MutableRefObject<string[]>;
  eventsConnectedRef: MutableRefObject<boolean>;
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

export function useEventStreamEffects(input: UseEventStreamEffectsInput): void {
  const runtimeNotificationProjectionCursorStateRef =
    useRef<RuntimeNotificationProjectionCursorState>(
      createInitialRuntimeNotificationProjectionCursorState(),
    );
  const runtimeNotificationReadObservabilityOwnerRef =
    useRef<RuntimeNotificationReadObservabilityOwner>(
      new RuntimeNotificationReadObservabilityOwner(),
    );

  useEffect(() => {
    runtimeNotificationProjectionCursorStateRef.current =
      createInitialRuntimeNotificationProjectionCursorState();
    input.setThreadRuntimeStatusByThreadIdentifier(
      createEmptyThreadRuntimeStatusByThreadIdentifier(),
    );
    input.setThreadSidebarRuntimeSummary(createInitialThreadSidebarRuntimeSummary());
  }, [
    input.selectedAgentId,
    input.setThreadRuntimeStatusByThreadIdentifier,
    input.setThreadSidebarRuntimeSummary,
  ]);

  useEffect(() => {
    let shouldCancelRefresh = false;

    const hydrateThreadSidebarRuntimeSummary = async (): Promise<void> => {
      try {
        await refreshThreadSidebarRuntimeSummary({
          selectedAgentId: input.selectedAgentId,
          canReadAccount: input.canReadAccount,
          canReadAccountRateLimits: input.canReadAccountRateLimits,
          canListApps: input.canListApps,
          capabilityServerClient: input.capabilityServerClient,
          setThreadSidebarRuntimeSummary: input.setThreadSidebarRuntimeSummary,
          shouldCancel: () => shouldCancelRefresh,
        });
      } catch (error) {
        if (shouldCancelRefresh) {
          return;
        }
        if (error instanceof Error && isRequestCanceledError(error)) {
          return;
        }
        input.handleRuntimeRequestError({
          operation: SIDEBAR_RUNTIME_SUMMARY_REFRESH_OPERATION,
          error,
        });
      }
    };

    void hydrateThreadSidebarRuntimeSummary();
    return () => {
      shouldCancelRefresh = true;
    };
  }, [
    input.selectedAgentId,
    input.canReadAccount,
    input.canReadAccountRateLimits,
    input.canListApps,
    input.capabilityServerClient,
    input.setThreadSidebarRuntimeSummary,
    input.handleRuntimeRequestError,
  ]);

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

            try {
              // Freeze mutable refs once so each scheduled refresh run applies one consistent snapshot.
              const scheduledRefreshSnapshot = readScheduledRefreshExecutionSnapshot(
                input.activeTabRef,
                input.selectedThreadIdRef,
              );
              const loadCoreDataFunction = input.loadCoreDataTrackedRef.current;
              const loadSelectedThreadFunction = input.loadSelectedThreadRef.current;
              const refreshOperations: Array<Promise<void>> = [];

              if (flags.refreshCore) {
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
                const runtimeNotificationProjectionCursorState =
                  runtimeNotificationProjectionCursorStateRef.current;
                const notificationEventsResponse =
                  await input.capabilityServerClient.readNotificationEvents(
                    readNotificationEventsRequestOptions({
                      selectedAgentId: input.selectedAgentId,
                      notificationProjectionCursorState: runtimeNotificationProjectionCursorState,
                    }),
                  );
                const runtimeNotificationProjection = readRuntimeNotificationProjection(
                  notificationEventsResponse,
                );
                runtimeNotificationProjectionCursorStateRef.current = {
                  nextSequence: runtimeNotificationProjection.nextSequence,
                };

                input.setThreadRuntimeStatusByThreadIdentifier((previousThreadStatusByThreadId) => {
                  if (
                    runtimeNotificationProjection.resetRequired &&
                    runtimeNotificationProjection.threadStatusUpdates.length === 0
                  ) {
                    return Object.keys(previousThreadStatusByThreadId).length > 0
                      ? createEmptyThreadRuntimeStatusByThreadIdentifier()
                      : previousThreadStatusByThreadId;
                  }

                  const baselineThreadStatusByThreadIdentifier =
                    runtimeNotificationProjection.resetRequired
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

                runtimeNotificationReadObservabilityOwnerRef.current.recordRead({
                  processedEventCount: runtimeNotificationProjection.processedEventCount,
                  relevantEventCount: runtimeNotificationProjection.relevantEventCount,
                  threadStatusUpdateCount: runtimeNotificationProjection.threadStatusUpdates.length,
                  requestedRateLimitRefresh:
                    runtimeNotificationProjection.shouldRefreshAccountRateLimits,
                  requestedAppsRefresh: runtimeNotificationProjection.shouldRefreshApps,
                  resetRequired: runtimeNotificationProjection.resetRequired,
                });

                if (runtimeNotificationProjection.shouldRefreshAccount && input.canReadAccount) {
                  const accountResponse = await input.capabilityServerClient.readAccount({
                    agentId: input.selectedAgentId,
                  });
                  input.setThreadSidebarRuntimeSummary((previousSummary) => ({
                    ...previousSummary,
                    account: readThreadSidebarAccountSummary(accountResponse),
                  }));
                }

                if (
                  runtimeNotificationProjection.shouldRefreshAccountRateLimits &&
                  input.canReadAccountRateLimits
                ) {
                  const rateLimitsResponse =
                    await input.capabilityServerClient.readAccountRateLimits({
                      agentId: input.selectedAgentId,
                    });
                  input.setThreadSidebarRuntimeSummary((previousSummary) => ({
                    ...previousSummary,
                    rateLimits: readThreadSidebarRateLimitSummary(rateLimitsResponse),
                  }));
                }

                if (runtimeNotificationProjection.shouldRefreshApps && input.canListApps) {
                  const appsResponse = await input.capabilityServerClient.listApps({
                    limit: SIDEBAR_APPS_LIST_LIMIT,
                  });
                  input.setThreadSidebarRuntimeSummary((previousSummary) => ({
                    ...previousSummary,
                    apps: readThreadSidebarAppsSummary(appsResponse),
                  }));
                }
              }

              if (refreshOperations.length > 0) {
                await Promise.all(refreshOperations);
              }
            } catch (error) {
              if (error instanceof Error && isRequestCanceledError(error)) {
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
    input.selectedThreadIdRef,
    input.setThreadRuntimeStatusByThreadIdentifier,
    input.setThreadSidebarRuntimeSummary,
    input.setDebugErrorSessionId,
    input.setDebugErrorSessionLogPath,
    input.setDebugErrors,
    input.setHistory,
  ]);
}
