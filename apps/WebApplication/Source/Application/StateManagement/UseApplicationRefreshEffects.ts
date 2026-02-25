import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { ApplicationRouteStateMapper } from "@/Application/DomainModel/ApplicationRouteStateMapper";
import { DebugIssueStateResolver } from "@/Features/Debugging/DomainModel/DebugIssueStateResolver";
import { ThreadListStateController } from "@/Features/Threads/StateManagement/ThreadListStateController";
import type { DebugIssue } from "@/Features/Debugging/DomainModel/DebugIssueContracts";

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
  debugIssueStateResolver: DebugIssueStateResolver;
  applicationRouteStateMapper: ApplicationRouteStateMapper;
  loadCoreDataTracked: () => Promise<void>;
  loadArchivedThreads: () => Promise<void>;
  refreshCoreDataAndSelectedThread: () => Promise<void>;
  refreshPushClientState: () => Promise<void>;
  handleRuntimeRequestError: <ErrorType,>(error: ErrorType) => void;
  coreRefreshIntervalMs: number;
  coreRefreshConnectedMinIntervalMs: number;
}

export function useApplicationRefreshEffects(input: UseApplicationRefreshEffectsInput): void {
  useEffect(() => {
    input.selectedThreadIdRef.current = input.selectedThreadId;
    if (!input.selectedThreadId) {
      return;
    }

    input.setUnreadThreadIds((previousUnreadThreadIdentifiers) =>
      input.threadListStateController.computeUnreadThreadIdentifiersAfterSelectionChange({
        previousUnreadThreadIdentifiers,
        selectedThreadIdentifier: input.selectedThreadId
      })
    );
  }, [
    input.selectedThreadId,
    input.selectedThreadIdRef,
    input.setUnreadThreadIds,
    input.threadListStateController
  ]);

  useEffect(() => {
    input.unreadThreadIdsRef.current = input.unreadThreadIds;
  }, [input.unreadThreadIds, input.unreadThreadIdsRef]);

  useEffect(() => {
    input.activeTabRef.current = input.activeTab;
  }, [input.activeTab, input.activeTabRef]);

  useEffect(() => {
    if (input.activeTab !== "debug") {
      return;
    }

    void input.loadCoreDataTracked().catch((error) => {
      input.handleRuntimeRequestError(error);
    });
  }, [input.activeTab, input.handleRuntimeRequestError, input.loadCoreDataTracked]);

  useEffect(() => {
    const nextSelectedDebugIssueIdentifier = input.debugIssueStateResolver.readNextSelectedDebugIssueIdentifier({
      debugIssues: input.filteredDebugIssues,
      selectedIssueIdentifier: input.selectedDebugIssueId
    });

    if (nextSelectedDebugIssueIdentifier !== input.selectedDebugIssueId) {
      input.setSelectedDebugIssueId(nextSelectedDebugIssueIdentifier);
    }
  }, [
    input.debugIssueStateResolver,
    input.filteredDebugIssues,
    input.selectedDebugIssueId,
    input.setSelectedDebugIssueId
  ]);

  useEffect(() => {
    input.isArchivedThreadsOpenRef.current = input.isArchivedThreadsOpen;
  }, [input.isArchivedThreadsOpen, input.isArchivedThreadsOpenRef]);

  useEffect(() => {
    input.hasLoadedArchivedThreadsRef.current = input.hasLoadedArchivedThreads;
  }, [input.hasLoadedArchivedThreads, input.hasLoadedArchivedThreadsRef]);

  useEffect(() => {
    const onPopState = () => {
      const nextRouteState = input.applicationRouteStateMapper.parseFromPathname(window.location.pathname);
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
      tab: input.activeTab
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
    void input.refreshPushClientState();
  }, [input.refreshPushClientState]);

  useEffect(() => {
    if (!input.isArchivedThreadsOpen) {
      return;
    }
    void input.loadArchivedThreads();
  }, [input.isArchivedThreadsOpen, input.loadArchivedThreads]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
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

    const scheduleNextWatchdog = (delayMilliseconds: number): void => {
      input.coreRefreshIntervalRef.current = window.setTimeout(() => {
        void runWatchdogCycle();
      }, delayMilliseconds);
    };

    const runWatchdogCycle = async (): Promise<void> => {
      if (disposed) {
        return;
      }

      if (document.visibilityState === "visible") {
        const now = Date.now();
        const shouldRefreshWhenDisconnected = !input.eventsConnectedRef.current;
        const shouldRefreshWhenConnected = (
          input.eventsConnectedRef.current
          && now - input.lastCoreRefreshAtRef.current >= input.coreRefreshConnectedMinIntervalMs
        );

        if (shouldRefreshWhenDisconnected || shouldRefreshWhenConnected) {
          try {
            await input.loadCoreDataTracked();
          } catch (error) {
            input.handleRuntimeRequestError(error);
          }
        }
      }

      if (disposed) {
        return;
      }
      scheduleNextWatchdog(
        input.eventsConnectedRef.current
          ? input.coreRefreshConnectedMinIntervalMs
          : input.coreRefreshIntervalMs
      );
    };

    scheduleNextWatchdog(
      input.eventsConnectedRef.current
        ? input.coreRefreshConnectedMinIntervalMs
        : input.coreRefreshIntervalMs
    );

    return () => {
      disposed = true;
      if (input.coreRefreshIntervalRef.current !== null) {
        window.clearTimeout(input.coreRefreshIntervalRef.current);
        input.coreRefreshIntervalRef.current = null;
      }
    };
  }, [
    input.coreRefreshConnectedMinIntervalMs,
    input.coreRefreshIntervalMs,
    input.coreRefreshIntervalRef,
    input.eventsConnectedRef,
    input.handleRuntimeRequestError,
    input.lastCoreRefreshAtRef,
    input.loadCoreDataTracked
  ]);
}
