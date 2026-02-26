import {
  startTransition,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { isRequestCanceledError } from "@/Shared/Errors/RequestCanceledError";
import type {
  DebugErrorListResponse,
  DebugHistoryResponse
} from "@/Features/Debugging/DataAccess/DebugServerClient";
import { DebugWorkspaceDataReader } from "@/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
import { DebugWorkspaceStateStore } from "@/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import { type ApplySelectedThreadStreamDeltaInput } from "@/Features/Chat/StateManagement/UseSelectedThreadLoaders";
import type { SelectedThreadLoaderOptions } from "./UseCoreDataLoaders";
import { EventRefreshScheduler, type EventRefreshFlags } from "./EventRefreshScheduler";
import { EventStreamConnectionCoordinator } from "./EventStreamConnectionCoordinator";
import { EventStreamRefreshDecisionEngine } from "./EventStreamRefreshDecisionEngine";

const DOCUMENT_VISIBILITY_STATE_VISIBLE = "visible";
const DEBUG_APPLICATION_TAB = "debug";
const SELECTED_THREAD_INCREMENTAL_REFRESH_OPTIONS: SelectedThreadLoaderOptions = {
  includeReadThread: true,
  includeTurns: false
};

interface ScheduledRefreshExecutionSnapshot {
  activeTab: "chat" | "debug";
  selectedThreadId: string | null;
}

function isScheduledRefreshDocumentVisible(): boolean {
  return document.visibilityState === DOCUMENT_VISIBILITY_STATE_VISIBLE;
}

function readScheduledRefreshExecutionSnapshot(
  activeTabRef: MutableRefObject<"chat" | "debug">,
  selectedThreadIdRef: MutableRefObject<string | null>
): ScheduledRefreshExecutionSnapshot {
  return {
    activeTab: activeTabRef.current,
    selectedThreadId: selectedThreadIdRef.current
  };
}

function shouldRefreshDebugWorkspace(
  refreshFlags: EventRefreshFlags,
  activeTab: "chat" | "debug"
): boolean {
  return !refreshFlags.refreshCore && refreshFlags.refreshHistory && activeTab === DEBUG_APPLICATION_TAB;
}

export interface UseEventStreamEffectsInput {
  debugHistoryLimit: number;
  debugErrorListLimit: number;
  eventRefreshScheduler: EventRefreshScheduler;
  eventStreamConnectionCoordinator: EventStreamConnectionCoordinator;
  eventStreamRefreshDecisionEngine: EventStreamRefreshDecisionEngine;
  activeTabRef: MutableRefObject<"chat" | "debug">;
  selectedThreadIdRef: MutableRefObject<string | null>;
  loadCoreDataTrackedRef: MutableRefObject<(() => Promise<void>) | null>;
  loadSelectedThreadRef: MutableRefObject<((threadId: string, options?: SelectedThreadLoaderOptions) => Promise<void>) | null>;
  debugWorkspaceDataReader: DebugWorkspaceDataReader;
  debugWorkspaceStateStore: DebugWorkspaceStateStore;
  debugErrorsSignatureRef: MutableRefObject<string[]>;
  eventsConnectedRef: MutableRefObject<boolean>;
  setHistory: Dispatch<SetStateAction<DebugHistoryResponse["history"]>>;
  setDebugErrors: Dispatch<SetStateAction<DebugErrorListResponse["data"]>>;
  setDebugErrorSessionId: Dispatch<SetStateAction<string>>;
  setDebugErrorSessionLogPath: Dispatch<SetStateAction<string>>;
  applySelectedThreadStreamDelta: (input: ApplySelectedThreadStreamDeltaInput) => void;
  handleRuntimeRequestError: <ErrorType,>(error: ErrorType) => void;
}

export function useEventStreamEffects(input: UseEventStreamEffectsInput): void {
  useEffect(() => {
    input.eventStreamConnectionCoordinator.start({
      eventRefreshScheduler: input.eventRefreshScheduler,
      eventStreamRefreshDecisionEngine: input.eventStreamRefreshDecisionEngine,
      readSnapshot: () => ({
        activeTab: input.activeTabRef.current,
        selectedThreadId: input.selectedThreadIdRef.current
      }),
      executeScheduledRefresh: async (flags) => {
        if (!isScheduledRefreshDocumentVisible()) {
          return;
        }

        try {
          // Freeze mutable refs once so each scheduled refresh run applies one consistent snapshot.
          const scheduledRefreshSnapshot = readScheduledRefreshExecutionSnapshot(
            input.activeTabRef,
            input.selectedThreadIdRef
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
              input.debugErrorListLimit
            );

            startTransition(() => {
              input.setHistory((previousHistory) =>
                input.debugWorkspaceStateStore.readNextHistory(previousHistory, debugWorkspaceSnapshot.history)
              );

              if (
                input.debugWorkspaceStateStore.shouldApplyDebugErrors(
                  input.debugErrorsSignatureRef.current,
                  debugWorkspaceSnapshot.debugErrorsSignature
                )
              ) {
                input.debugErrorsSignatureRef.current = debugWorkspaceSnapshot.debugErrorsSignature;
                input.setDebugErrors(debugWorkspaceSnapshot.debugErrors);
              }

              input.setDebugErrorSessionId(debugWorkspaceSnapshot.debugErrorSessionId);
              input.setDebugErrorSessionLogPath(debugWorkspaceSnapshot.debugErrorSessionLogPath);
            });
          }

          if (
            flags.refreshSelectedThread
            && scheduledRefreshSnapshot.selectedThreadId
            && loadSelectedThreadFunction
          ) {
            refreshOperations.push(
              loadSelectedThreadFunction(
                scheduledRefreshSnapshot.selectedThreadId,
                SELECTED_THREAD_INCREMENTAL_REFRESH_OPTIONS
              )
            );
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
          streamEventsSinceSequenceUsed: threadStreamDelta.streamEventsSinceSequenceUsed
        });
      },
      onConnectionStatusChange: (connected) => {
        input.eventsConnectedRef.current = connected;
      }
    });

    return () => {
      input.eventStreamConnectionCoordinator.stop();
    };
  }, [
    input.activeTabRef,
    input.debugErrorListLimit,
    input.debugErrorsSignatureRef,
    input.debugHistoryLimit,
    input.debugWorkspaceDataReader,
    input.debugWorkspaceStateStore,
    input.eventRefreshScheduler,
    input.eventStreamConnectionCoordinator,
    input.eventStreamRefreshDecisionEngine,
    input.eventsConnectedRef,
    input.applySelectedThreadStreamDelta,
    input.handleRuntimeRequestError,
    input.loadCoreDataTrackedRef,
    input.loadSelectedThreadRef,
    input.selectedThreadIdRef,
    input.setDebugErrorSessionId,
    input.setDebugErrorSessionLogPath,
    input.setDebugErrors,
    input.setHistory
  ]);
}
