import { useMemo } from "react";
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
}

export interface ApplicationDebugIssueDerivedState {
  debugErrorIssues: ApplicationDerivedState["debugErrorIssues"];
  debugWarningIssues: ApplicationDerivedState["debugWarningIssues"];
  debugIssues: ApplicationDerivedState["debugIssues"];
  runtimeRequestErrorOperationMetrics: ApplicationDerivedState["runtimeRequestErrorOperationMetrics"];
  filteredDebugIssues: ApplicationDerivedState["filteredDebugIssues"];
  selectedDebugIssue: ApplicationDerivedState["selectedDebugIssue"];
}

export function useApplicationDebugIssueDerivedState(
  input: UseApplicationDebugIssueDerivedStateInput,
): ApplicationDebugIssueDerivedState {
  const debugErrorIssues = useMemo(
    () => input.debugIssueStateResolver.readDebugErrorIssues(input.debugErrors),
    [input.debugErrors, input.debugIssueStateResolver],
  );

  const debugWarningIssues = useMemo(
    () => input.debugIssueStateResolver.readDebugWarningIssues(input.history),
    [input.debugIssueStateResolver, input.history],
  );

  const runtimeRequestErrorOperationMetrics = useMemo(
    () => input.debugIssueStateResolver.readRuntimeRequestErrorOperationMetrics(input.debugErrors),
    [input.debugErrors, input.debugIssueStateResolver],
  );

  const debugIssues = useMemo(
    () =>
      input.debugIssueStateResolver.readCombinedDebugIssues({
        debugErrorIssues,
        debugWarningIssues,
      }),
    [debugErrorIssues, input.debugIssueStateResolver, debugWarningIssues],
  );

  const filteredDebugIssues = useMemo(
    () =>
      input.debugIssueStateResolver.readFilteredDebugIssues({
        debugIssues,
        severityFilter: input.debugIssueSeverityFilter,
        filterQuery: input.debugIssueFilterQuery,
      }),
    [
      input.debugIssueFilterQuery,
      input.debugIssueSeverityFilter,
      input.debugIssueStateResolver,
      debugIssues,
    ],
  );

  const selectedDebugIssue = useMemo(
    () =>
      input.debugIssueStateResolver.readSelectedDebugIssue({
        debugIssues: filteredDebugIssues,
        selectedIssueIdentifier: input.selectedDebugIssueId,
      }),
    [input.debugIssueStateResolver, filteredDebugIssues, input.selectedDebugIssueId],
  );

  return {
    debugErrorIssues,
    debugWarningIssues,
    debugIssues,
    runtimeRequestErrorOperationMetrics,
    filteredDebugIssues,
    selectedDebugIssue,
  };
}
