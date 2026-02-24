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
import type { SelectedThreadLoaderOptions } from "./UseCoreDataLoaders";
import { EventRefreshScheduler } from "./EventRefreshScheduler";
import { EventStreamConnectionCoordinator } from "./EventStreamConnectionCoordinator";
import { EventStreamRefreshDecisionEngine } from "./EventStreamRefreshDecisionEngine";

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
        if (document.visibilityState !== "visible") {
          return;
        }

        try {
          const loadCoreDataFunction = input.loadCoreDataTrackedRef.current;
          const loadSelectedThreadFunction = input.loadSelectedThreadRef.current;

          if (flags.refreshCore) {
            if (loadCoreDataFunction) {
              await loadCoreDataFunction();
            }
          } else if (flags.refreshHistory && input.activeTabRef.current === "debug") {
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

          if (flags.refreshSelectedThread && input.selectedThreadIdRef.current && loadSelectedThreadFunction) {
            await loadSelectedThreadFunction(input.selectedThreadIdRef.current, {
              includeReadThread: true,
              includeTurns: false
            });
          }
        } catch (error) {
          if (error instanceof Error && isRequestCanceledError(error)) {
            return;
          }
          input.handleRuntimeRequestError(error);
        }
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
