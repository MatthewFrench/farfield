import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useRef,
} from "react";
import { ApplicationRouteStateMapper } from "@/Application/DomainModel/ApplicationRouteStateMapper";
import type { DebugIssue } from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import { DebugIssueStateResolver } from "@/Features/Debugging/DomainModel/DebugIssueStateResolver";
import { LastViewedThreadPreferenceStore } from "@/Features/Threads/DataAccess/LastViewedThreadPreferenceStore";
import { ThreadListStateController } from "@/Features/Threads/StateManagement/ThreadListStateController";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";

const DEBUG_APPLICATION_TAB = "debug";
const DOCUMENT_VISIBILITY_STATE_VISIBLE = "visible";
const LAST_VIEWED_THREAD_WRITE_OPERATION = "last-viewed-thread:write";
const LAST_VIEWED_THREAD_CLEAR_OPERATION = "last-viewed-thread:clear";

function readNextWatchdogDelayMilliseconds(
  eventsConnected: boolean,
  connectedMinimumIntervalMilliseconds: number,
  disconnectedIntervalMilliseconds: number,
): number {
  return eventsConnected ? connectedMinimumIntervalMilliseconds : disconnectedIntervalMilliseconds;
}

interface WatchdogRefreshDecisionInput {
  eventsConnected: boolean;
  nowMilliseconds: number;
  lastCoreRefreshAtMilliseconds: number;
  connectedMinimumIntervalMilliseconds: number;
}

function isDocumentVisible(): boolean {
  return document.visibilityState === DOCUMENT_VISIBILITY_STATE_VISIBLE;
}

function shouldRefreshCoreDataForWatchdogCycle(input: WatchdogRefreshDecisionInput): boolean {
  if (!input.eventsConnected) {
    // Invariant: disconnected mode relies on the watchdog as the authoritative refresh cadence.
    return true;
  }

  const elapsedSinceLastCoreRefreshMilliseconds =
    input.nowMilliseconds - input.lastCoreRefreshAtMilliseconds;
  return elapsedSinceLastCoreRefreshMilliseconds >= input.connectedMinimumIntervalMilliseconds;
}

function createLastViewedThreadPreferenceError<ErrorType>(
  operation: string,
  error: ErrorType,
): Error {
  return new Error(`${operation}: ${toErrorMessage(error).trim()}`);
}

export interface UseApplicationRefreshEffectsInput {
  selectedThreadId: string | null;
  activeTab: "chat" | "debug";
  unreadThreadIds: Record<string, true>;
  isArchivedThreadsOpen: boolean;
  hasLoadedArchivedThreads: boolean;
  filteredDebugIssues: DebugIssue[];
  selectedDebugIssueId: string;
  selectedThreadIdRef: MutableRefObject<string | null>;
  activeTabRef: MutableRefObject<"chat" | "debug">;
  unreadThreadIdsRef: MutableRefObject<Record<string, true>>;
  isArchivedThreadsOpenRef: MutableRefObject<boolean>;
  hasLoadedArchivedThreadsRef: MutableRefObject<boolean>;
  coreRefreshIntervalRef: MutableRefObject<number | null>;
  eventsConnectedRef: MutableRefObject<boolean>;
  lastCoreRefreshAtRef: MutableRefObject<number>;
  setUnreadThreadIds: Dispatch<SetStateAction<Record<string, true>>>;
  setSelectedThreadId: Dispatch<SetStateAction<string | null>>;
  setActiveTab: Dispatch<SetStateAction<"chat" | "debug">>;
  setSelectedDebugIssueId: Dispatch<SetStateAction<string>>;
  threadListStateController: ThreadListStateController;
  lastViewedThreadPreferenceStore: LastViewedThreadPreferenceStore;
  debugIssueStateResolver: DebugIssueStateResolver;
  applicationRouteStateMapper: ApplicationRouteStateMapper;
  loadCoreDataTracked: () => Promise<void>;
  loadArchivedThreads: () => Promise<void>;
  refreshCoreDataAndSelectedThread: () => Promise<void>;
  refreshPushClientState: () => Promise<void>;
  handleRuntimeRequestError: <ErrorType>(error: ErrorType) => void;
  coreRefreshIntervalMs: number;
  coreRefreshConnectedMinIntervalMs: number;
}

export function useApplicationRefreshEffects(input: UseApplicationRefreshEffectsInput): void {
  const previousSelectedThreadIdentifierRef = useRef<string | null>(input.selectedThreadId);

  useEffect(() => {
    const previousSelectedThreadIdentifier = previousSelectedThreadIdentifierRef.current;
    previousSelectedThreadIdentifierRef.current = input.selectedThreadId;
    const selectedThreadIdRef = input.selectedThreadIdRef;
    selectedThreadIdRef.current = input.selectedThreadId;
    if (input.selectedThreadId === null || input.selectedThreadId.length === 0) {
      if (
        previousSelectedThreadIdentifier !== null &&
        previousSelectedThreadIdentifier.length > 0
      ) {
        try {
          input.lastViewedThreadPreferenceStore.clearLastViewedThreadIdentifier();
        } catch (error) {
          input.handleRuntimeRequestError(
            createLastViewedThreadPreferenceError(LAST_VIEWED_THREAD_CLEAR_OPERATION, error),
          );
        }
      }
      return;
    }
    try {
      input.lastViewedThreadPreferenceStore.writeLastViewedThreadIdentifier(input.selectedThreadId);
    } catch (error) {
      input.handleRuntimeRequestError(
        createLastViewedThreadPreferenceError(LAST_VIEWED_THREAD_WRITE_OPERATION, error),
      );
    }

    input.setUnreadThreadIds((previousUnreadThreadIdentifiers) =>
      input.threadListStateController.computeUnreadThreadIdentifiersAfterSelectionChange({
        previousUnreadThreadIdentifiers,
        selectedThreadIdentifier: input.selectedThreadId,
      }),
    );
  }, [
    input.selectedThreadId,
    input.selectedThreadIdRef,
    input.handleRuntimeRequestError,
    input.setUnreadThreadIds,
    input.lastViewedThreadPreferenceStore,
    input.threadListStateController,
  ]);

  useEffect(() => {
    const unreadThreadIdsRef = input.unreadThreadIdsRef;
    unreadThreadIdsRef.current = input.unreadThreadIds;
  }, [input.unreadThreadIds, input.unreadThreadIdsRef]);

  useEffect(() => {
    const activeTabRef = input.activeTabRef;
    activeTabRef.current = input.activeTab;
  }, [input.activeTab, input.activeTabRef]);

  useEffect(() => {
    if (input.activeTab !== DEBUG_APPLICATION_TAB) {
      return;
    }

    void input.loadCoreDataTracked().catch((error) => {
      input.handleRuntimeRequestError(error);
    });
  }, [input.activeTab, input.handleRuntimeRequestError, input.loadCoreDataTracked]);

  useEffect(() => {
    const nextSelectedDebugIssueIdentifier =
      input.debugIssueStateResolver.readNextSelectedDebugIssueIdentifier({
        debugIssues: input.filteredDebugIssues,
        selectedIssueIdentifier: input.selectedDebugIssueId,
      });

    if (nextSelectedDebugIssueIdentifier !== input.selectedDebugIssueId) {
      input.setSelectedDebugIssueId(nextSelectedDebugIssueIdentifier);
    }
  }, [
    input.debugIssueStateResolver,
    input.filteredDebugIssues,
    input.selectedDebugIssueId,
    input.setSelectedDebugIssueId,
  ]);

  useEffect(() => {
    const isArchivedThreadsOpenRef = input.isArchivedThreadsOpenRef;
    isArchivedThreadsOpenRef.current = input.isArchivedThreadsOpen;
  }, [input.isArchivedThreadsOpen, input.isArchivedThreadsOpenRef]);

  useEffect(() => {
    const hasLoadedArchivedThreadsRef = input.hasLoadedArchivedThreadsRef;
    hasLoadedArchivedThreadsRef.current = input.hasLoadedArchivedThreads;
  }, [input.hasLoadedArchivedThreads, input.hasLoadedArchivedThreadsRef]);

  useEffect(() => {
    const onPopState = () => {
      const nextRouteState = input.applicationRouteStateMapper.parseFromPathname(
        window.location.pathname,
      );
      input.setSelectedThreadId(nextRouteState.threadId);
      input.setActiveTab(nextRouteState.tab);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [input.applicationRouteStateMapper, input.setActiveTab, input.setSelectedThreadId]);

  useEffect(() => {
    const nextPath = input.applicationRouteStateMapper.buildPath({
      threadId: input.selectedThreadId,
      tab: input.activeTab,
    });
    if (window.location.pathname === nextPath) {
      return;
    }
    window.history.replaceState(null, "", nextPath);
  }, [input.activeTab, input.applicationRouteStateMapper, input.selectedThreadId]);

  useEffect(() => {
    void input.refreshCoreDataAndSelectedThread().catch((error) => {
      input.handleRuntimeRequestError(error);
    });
  }, [input.handleRuntimeRequestError, input.refreshCoreDataAndSelectedThread]);

  useEffect(() => {
    void input.refreshPushClientState().catch((error) => {
      input.handleRuntimeRequestError(error);
    });
  }, [input.handleRuntimeRequestError, input.refreshPushClientState]);

  useEffect(() => {
    if (!input.isArchivedThreadsOpen) {
      return;
    }
    void input.loadArchivedThreads().catch((error) => {
      input.handleRuntimeRequestError(error);
    });
  }, [input.handleRuntimeRequestError, input.isArchivedThreadsOpen, input.loadArchivedThreads]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!isDocumentVisible()) {
        return;
      }
      void input.loadCoreDataTracked().catch((error) => input.handleRuntimeRequestError(error));
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [input.handleRuntimeRequestError, input.loadCoreDataTracked]);

  useEffect(() => {
    let disposed = false;
    const isDisposed = (): boolean => disposed;
    const coreRefreshIntervalRef = input.coreRefreshIntervalRef;

    const scheduleNextWatchdog = (delayMilliseconds: number): void => {
      coreRefreshIntervalRef.current = window.setTimeout(() => {
        void runWatchdogCycle();
      }, delayMilliseconds);
    };

    const scheduleNextWatchdogForCurrentConnectionState = (): void => {
      scheduleNextWatchdog(
        readNextWatchdogDelayMilliseconds(
          input.eventsConnectedRef.current,
          input.coreRefreshConnectedMinIntervalMs,
          input.coreRefreshIntervalMs,
        ),
      );
    };

    const runWatchdogCycle = async (): Promise<void> => {
      if (isDisposed()) {
        return;
      }

      if (isDocumentVisible()) {
        const shouldRefreshCoreData = shouldRefreshCoreDataForWatchdogCycle({
          eventsConnected: input.eventsConnectedRef.current,
          nowMilliseconds: Date.now(),
          lastCoreRefreshAtMilliseconds: input.lastCoreRefreshAtRef.current,
          connectedMinimumIntervalMilliseconds: input.coreRefreshConnectedMinIntervalMs,
        });

        if (shouldRefreshCoreData) {
          try {
            await input.loadCoreDataTracked();
          } catch (error) {
            input.handleRuntimeRequestError(error);
          }
        }
      }

      if (isDisposed()) {
        return;
      }
      scheduleNextWatchdogForCurrentConnectionState();
    };

    scheduleNextWatchdogForCurrentConnectionState();

    return () => {
      disposed = true;
      if (coreRefreshIntervalRef.current !== null) {
        window.clearTimeout(coreRefreshIntervalRef.current);
        coreRefreshIntervalRef.current = null;
      }
    };
  }, [
    input.coreRefreshConnectedMinIntervalMs,
    input.coreRefreshIntervalMs,
    input.coreRefreshIntervalRef,
    input.eventsConnectedRef,
    input.handleRuntimeRequestError,
    input.lastCoreRefreshAtRef,
    input.loadCoreDataTracked,
  ]);
}
