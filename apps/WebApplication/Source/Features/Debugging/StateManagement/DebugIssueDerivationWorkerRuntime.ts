/// <reference lib="webworker" />

import { DebugIssueStateResolver } from "../DomainModel/DebugIssueStateResolver";
import {
  type DebugIssueDerivationResult,
  type DebugIssueDerivationWorkerRequest,
  type DebugIssueDerivationWorkerResponse,
  parseDebugIssueDerivationWorkerRequest,
} from "./DebugIssueDerivationWorkerContracts";

const WORKER_REQUEST_PARSE_FAILURE_REASON = "Invalid debug issue derivation worker request";
const WORKER_REQUEST_PROCESSING_FAILURE_REASON =
  "Debug issue derivation worker request processing failed";

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
const debugIssueStateResolver = new DebugIssueStateResolver();

function postResponse(response: DebugIssueDerivationWorkerResponse): void {
  workerScope.postMessage(response);
}

function readDerivedResult(request: DebugIssueDerivationWorkerRequest): DebugIssueDerivationResult {
  const debugErrorIssues = debugIssueStateResolver.readDebugErrorIssues(request.input.debugErrors);
  const debugWarningIssues = debugIssueStateResolver.readDebugWarningIssues(
    request.input.historyEntries,
  );
  const runtimeRequestErrorOperationMetrics =
    debugIssueStateResolver.readRuntimeRequestErrorOperationMetrics(request.input.debugErrors);
  const debugIssues = debugIssueStateResolver.readCombinedDebugIssues({
    debugErrorIssues,
    debugWarningIssues,
  });
  const filteredDebugIssues = debugIssueStateResolver.readFilteredDebugIssues({
    debugIssues,
    severityFilter: request.input.severityFilter,
    filterQuery: request.input.filterQuery,
  });
  const selectedDebugIssue = debugIssueStateResolver.readSelectedDebugIssue({
    debugIssues: filteredDebugIssues,
    selectedIssueIdentifier: request.input.selectedIssueIdentifier,
  });
  return {
    debugErrorIssues,
    debugWarningIssues,
    debugIssues,
    runtimeRequestErrorOperationMetrics,
    filteredDebugIssues,
    selectedDebugIssue,
  };
}

function handleRequest(request: DebugIssueDerivationWorkerRequest): void {
  try {
    const result = readDerivedResult(request);
    postResponse({
      requestId: request.requestId,
      kind: "success",
      result,
    });
  } catch {
    postResponse({
      requestId: request.requestId,
      kind: "failure",
      reason: WORKER_REQUEST_PROCESSING_FAILURE_REASON,
    });
  }
}

workerScope.addEventListener("message", (event) => {
  let parsedRequest: DebugIssueDerivationWorkerRequest;
  try {
    parsedRequest = parseDebugIssueDerivationWorkerRequest(event.data);
  } catch {
    postResponse({
      requestId: 0,
      kind: "failure",
      reason: WORKER_REQUEST_PARSE_FAILURE_REASON,
    });
    return;
  }

  handleRequest(parsedRequest);
});
