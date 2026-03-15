import { useEffect, useMemo, useRef, useState } from "react";
import type { DebugIssueDerivationResult } from "@/Features/Debugging/StateManagement/DebugIssueDerivationWorkerContracts";
import { DEBUG_ISSUE_DERIVATION_WORKER_DISPOSED_ERROR_MESSAGE } from "@/Features/Debugging/StateManagement/DebugIssueDerivationWorkerOwner";
import {
  beginGlobalPerformanceOperation,
  completeGlobalPerformanceOperation,
} from "@/Shared/Performance/ClientPerformanceFreezeProbeOwner";
import {
  type ApplicationDerivedState,
  type UseApplicationDerivedStateInput,
} from "./UseApplicationDerivedStateContracts";

interface UseApplicationDebugIssueDerivedStateInput {
  debugErrors: UseApplicationDerivedStateInput["debugErrors"];
  history: UseApplicationDerivedStateInput["history"];
  debugIssueSeverityFilter: UseApplicationDerivedStateInput["debugIssueSeverityFilter"];
  debugIssueFilterQuery: UseApplicationDerivedStateInput["debugIssueFilterQuery"];
  selectedDebugIssueId: UseApplicationDerivedStateInput["selectedDebugIssueId"];
  debugIssueStateResolver: UseApplicationDerivedStateInput["debugIssueStateResolver"];
  debugIssueDerivationWorkerOwner?: UseApplicationDerivedStateInput["debugIssueDerivationWorkerOwner"];
}

export interface ApplicationDebugIssueDerivedState {
  debugErrorIssues: ApplicationDerivedState["debugErrorIssues"];
  debugWarningIssues: ApplicationDerivedState["debugWarningIssues"];
  debugIssues: ApplicationDerivedState["debugIssues"];
  runtimeRequestErrorOperationMetrics: ApplicationDerivedState["runtimeRequestErrorOperationMetrics"];
  filteredDebugIssues: ApplicationDerivedState["filteredDebugIssues"];
  selectedDebugIssue: ApplicationDerivedState["selectedDebugIssue"];
}

const INITIAL_ASYNCHRONOUS_DERIVED_STATE: ApplicationDebugIssueDerivedState = {
  debugErrorIssues: [],
  debugWarningIssues: [],
  debugIssues: [],
  runtimeRequestErrorOperationMetrics: [],
  filteredDebugIssues: [],
  selectedDebugIssue: null,
};

const INITIAL_REQUEST_SEQUENCE = 0;
const DEBUG_ISSUE_DERIVATION_OPERATION = "debug-issue-derive-in-thread";

function mapAsynchronousResultToDerivedState(
  result: DebugIssueDerivationResult,
): ApplicationDebugIssueDerivedState {
  return {
    debugErrorIssues: result.debugErrorIssues,
    debugWarningIssues: result.debugWarningIssues,
    debugIssues: result.debugIssues,
    runtimeRequestErrorOperationMetrics: result.runtimeRequestErrorOperationMetrics,
    filteredDebugIssues: result.filteredDebugIssues,
    selectedDebugIssue: result.selectedDebugIssue,
  };
}

export function useApplicationDebugIssueDerivedState(
  input: UseApplicationDebugIssueDerivedStateInput,
): ApplicationDebugIssueDerivedState {
  const debugIssueDerivationWorkerOwner = input.debugIssueDerivationWorkerOwner ?? null;
  const requestSequenceReference = useRef<number>(INITIAL_REQUEST_SEQUENCE);
  const [asynchronousDerivedState, setAsynchronousDerivedState] =
    useState<ApplicationDebugIssueDerivedState>(INITIAL_ASYNCHRONOUS_DERIVED_STATE);
  const [asynchronousDerivationError, setAsynchronousDerivationError] = useState<Error | null>(
    null,
  );

  useEffect(() => {
    if (debugIssueDerivationWorkerOwner === null) {
      return;
    }

    const requestSequence = requestSequenceReference.current + 1;
    requestSequenceReference.current = requestSequence;
    let isDisposed = false;

    void debugIssueDerivationWorkerOwner
      .readDerivedDebugIssueState({
        debugErrors: input.debugErrors,
        historyEntries: input.history,
        severityFilter: input.debugIssueSeverityFilter,
        filterQuery: input.debugIssueFilterQuery,
        selectedIssueIdentifier: input.selectedDebugIssueId,
      })
      .then((result) => {
        if (isDisposed || requestSequenceReference.current !== requestSequence) {
          return;
        }
        setAsynchronousDerivationError(null);
        setAsynchronousDerivedState(mapAsynchronousResultToDerivedState(result));
      })
      .catch((error) => {
        if (isDisposed || requestSequenceReference.current !== requestSequence) {
          return;
        }
        if (error instanceof Error) {
          if (error.message === DEBUG_ISSUE_DERIVATION_WORKER_DISPOSED_ERROR_MESSAGE) {
            return;
          }
          setAsynchronousDerivationError(error);
          return;
        }
        setAsynchronousDerivationError(
          new Error("Debug issue worker derivation failed with a non-error rejection."),
        );
      });

    return () => {
      isDisposed = true;
    };
  }, [
    debugIssueDerivationWorkerOwner,
    input.debugErrors,
    input.history,
    input.debugIssueSeverityFilter,
    input.debugIssueFilterQuery,
    input.selectedDebugIssueId,
  ]);

  const inThreadDerivedState = useMemo<ApplicationDebugIssueDerivedState | null>(() => {
    if (debugIssueDerivationWorkerOwner !== null) {
      return null;
    }

    const operationToken = beginGlobalPerformanceOperation(DEBUG_ISSUE_DERIVATION_OPERATION, {
      debugErrorCount: input.debugErrors.length,
      historyEntryCount: input.history.length,
      filterQueryLength: input.debugIssueFilterQuery.length,
    });

    const debugErrorIssues = input.debugIssueStateResolver.readDebugErrorIssues(input.debugErrors);
    const debugWarningIssues = input.debugIssueStateResolver.readDebugWarningIssues(input.history);
    const runtimeRequestErrorOperationMetrics =
      input.debugIssueStateResolver.readRuntimeRequestErrorOperationMetrics(input.debugErrors);
    const debugIssues = input.debugIssueStateResolver.readCombinedDebugIssues({
      debugErrorIssues,
      debugWarningIssues,
    });
    const filteredDebugIssues = input.debugIssueStateResolver.readFilteredDebugIssues({
      debugIssues,
      severityFilter: input.debugIssueSeverityFilter,
      filterQuery: input.debugIssueFilterQuery,
    });
    const selectedDebugIssue = input.debugIssueStateResolver.readSelectedDebugIssue({
      debugIssues: filteredDebugIssues,
      selectedIssueIdentifier: input.selectedDebugIssueId,
    });

    const result = {
      debugErrorIssues,
      debugWarningIssues,
      debugIssues,
      runtimeRequestErrorOperationMetrics,
      filteredDebugIssues,
      selectedDebugIssue,
    };
    completeGlobalPerformanceOperation(operationToken, "succeeded", {
      debugIssueCount: debugIssues.length,
      filteredDebugIssueCount: filteredDebugIssues.length,
      hasSelectedDebugIssue: selectedDebugIssue !== null,
    });
    return result;
  }, [
    debugIssueDerivationWorkerOwner,
    input.debugErrors,
    input.history,
    input.debugIssueFilterQuery,
    input.debugIssueSeverityFilter,
    input.debugIssueStateResolver,
    input.selectedDebugIssueId,
  ]);

  if (asynchronousDerivationError !== null) {
    throw asynchronousDerivationError;
  }

  if (inThreadDerivedState !== null) {
    return inThreadDerivedState;
  }

  return asynchronousDerivedState;
}
