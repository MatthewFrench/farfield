import { useCallback, useMemo } from "react";
import {
  type RuntimeRefreshMeasurement,
  RuntimeRefreshObservabilityOwner,
} from "@/Application/StateManagement/RuntimeRefreshObservabilityOwner";
import { type ApplicationRuntimeRequestHandlers } from "@/Application/StateManagement/UseApplicationRuntimeRequestHandlers";
import { type ApplicationShellState } from "@/Application/StateManagement/UseApplicationShellState";
import { type CoreDataLoaders } from "@/Application/StateManagement/UseCoreDataLoaders";
import { type SelectedThreadLoaders } from "@/Features/Chat/StateManagement/UseSelectedThreadLoaders";

// Refresh handlers are required runtime-owned dependencies; missing refs indicate a composition bug.
const MISSING_CORE_DATA_LOADER_ERROR_MESSAGE =
  "Runtime refresh invariant violated: core-data loader is unavailable.";
const MISSING_SELECTED_THREAD_LOADER_ERROR_MESSAGE =
  "Runtime refresh invariant violated: selected-thread loader is unavailable for active selection.";

type CoreDataLoadFunction = CoreDataLoaders["loadCoreDataTracked"];
type SelectedThreadLoadFunction = SelectedThreadLoaders["loadSelectedThreadTracked"];

interface RuntimeRefreshShellState {
  loadCoreDataTrackedRef: ApplicationShellState["loadCoreDataTrackedRef"];
  loadSelectedThreadRef: ApplicationShellState["loadSelectedThreadRef"];
  selectedThreadIdRef: ApplicationShellState["selectedThreadIdRef"];
  setIsCoreLoading: ApplicationShellState["setIsCoreLoading"];
}

export interface UseApplicationRuntimeRefreshOrchestrationInput {
  applicationShellState: RuntimeRefreshShellState;
  loadCoreDataTracked: CoreDataLoadFunction;
  loadSelectedThreadTracked: SelectedThreadLoadFunction;
  handleRuntimeRequestError: ApplicationRuntimeRequestHandlers["handleRuntimeRequestError"];
}

export interface ApplicationRuntimeRefreshOrchestration {
  loadSelectedThreadIfPresentFromRuntimeState: () => Promise<void>;
  refreshCoreDataAndSelectedThread: () => Promise<void>;
}

function resolveCoreDataLoadFunction(
  loadCoreDataFunction: CoreDataLoadFunction | null,
): CoreDataLoadFunction {
  if (loadCoreDataFunction === null) {
    throw new Error(MISSING_CORE_DATA_LOADER_ERROR_MESSAGE);
  }
  return loadCoreDataFunction;
}

async function refreshSelectedThreadIfPresent(
  selectedThreadIdentifier: string | null,
  loadSelectedThreadFunction: SelectedThreadLoadFunction | null,
): Promise<void> {
  if (selectedThreadIdentifier === null) {
    return;
  }
  if (loadSelectedThreadFunction === null) {
    throw new Error(MISSING_SELECTED_THREAD_LOADER_ERROR_MESSAGE);
  }
  await loadSelectedThreadFunction(selectedThreadIdentifier);
}

function completeRuntimeRefreshMeasurement(
  runtimeRefreshObservabilityOwner: RuntimeRefreshObservabilityOwner,
  measurement: RuntimeRefreshMeasurement,
  didCompleteRefresh: boolean,
): void {
  if (didCompleteRefresh) {
    runtimeRefreshObservabilityOwner.completeRefreshSuccess(measurement);
    return;
  }
  runtimeRefreshObservabilityOwner.completeRefreshFailure(measurement);
}

export function useApplicationRuntimeRefreshOrchestration(
  input: UseApplicationRuntimeRefreshOrchestrationInput,
): ApplicationRuntimeRefreshOrchestration {
  const runtimeRefreshObservabilityOwner = useMemo(
    () => new RuntimeRefreshObservabilityOwner(),
    [],
  );

  // Push bootstrap can complete at any time; resolve selected-thread refresh from the latest runtime selection ref.
  const loadSelectedThreadIfPresentFromRuntimeState = useCallback(async (): Promise<void> => {
    const selectedThreadIdentifier = input.applicationShellState.selectedThreadIdRef.current;
    if (selectedThreadIdentifier === null || selectedThreadIdentifier.length === 0) {
      return;
    }
    await input.loadSelectedThreadTracked(selectedThreadIdentifier);
  }, [input.applicationShellState.selectedThreadIdRef, input.loadSelectedThreadTracked]);

  // Keep refresh ordering and loading-state transitions consistent for startup
  // and manual header refresh actions through one runtime-owned operation.
  const refreshCoreDataAndSelectedThread = useCallback(async (): Promise<void> => {
    const measurement = runtimeRefreshObservabilityOwner.beginRefresh();
    let didCompleteRefresh = false;

    input.applicationShellState.setIsCoreLoading(true);
    try {
      const loadCoreDataFunction = resolveCoreDataLoadFunction(
        input.applicationShellState.loadCoreDataTrackedRef.current,
      );
      await loadCoreDataFunction();
      await refreshSelectedThreadIfPresent(
        input.applicationShellState.selectedThreadIdRef.current,
        input.applicationShellState.loadSelectedThreadRef.current,
      );
      didCompleteRefresh = true;
    } catch (error) {
      input.handleRuntimeRequestError(error);
    } finally {
      completeRuntimeRefreshMeasurement(
        runtimeRefreshObservabilityOwner,
        measurement,
        didCompleteRefresh,
      );
      input.applicationShellState.setIsCoreLoading(false);
    }
  }, [
    input.applicationShellState.loadCoreDataTrackedRef,
    input.applicationShellState.loadSelectedThreadRef,
    input.applicationShellState.selectedThreadIdRef,
    input.applicationShellState.setIsCoreLoading,
    input.handleRuntimeRequestError,
    runtimeRefreshObservabilityOwner,
  ]);

  return {
    loadSelectedThreadIfPresentFromRuntimeState,
    refreshCoreDataAndSelectedThread,
  };
}
