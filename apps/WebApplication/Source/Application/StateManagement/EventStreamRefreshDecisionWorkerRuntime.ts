/// <reference lib="webworker" />

import { EventStreamRefreshDecisionEngine } from "./EventStreamRefreshDecisionEngine";
import {
  type EventStreamRefreshDecisionWorkerRequest,
  type EventStreamRefreshDecisionWorkerResponse,
  parseEventStreamRefreshDecisionWorkerRequest,
} from "./EventStreamRefreshDecisionWorkerContracts";

const THREAD_ONLY_HISTORY_METHODS_SEPARATOR = "|";
const EMPTY_THREAD_ONLY_HISTORY_METHODS_SIGNATURE = "";
const WORKER_REQUEST_PARSE_FAILURE_REASON_PREFIX = "Invalid decision worker request";
const WORKER_REQUEST_PROCESSING_FAILURE_REASON = "Decision worker request processing failed";

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
let threadOnlyHistoryMethodsSignature = EMPTY_THREAD_ONLY_HISTORY_METHODS_SIGNATURE;
let decisionEngine = new EventStreamRefreshDecisionEngine([]);

function readThreadOnlyHistoryMethodsSignature(
  threadOnlyHistoryMethods: readonly string[],
): string {
  return threadOnlyHistoryMethods.join(THREAD_ONLY_HISTORY_METHODS_SEPARATOR);
}

function refreshDecisionEngineIfNeeded(threadOnlyHistoryMethods: readonly string[]): void {
  const nextSignature = readThreadOnlyHistoryMethodsSignature(threadOnlyHistoryMethods);
  if (nextSignature === threadOnlyHistoryMethodsSignature) {
    return;
  }

  decisionEngine = new EventStreamRefreshDecisionEngine(threadOnlyHistoryMethods);
  threadOnlyHistoryMethodsSignature = nextSignature;
}

function postResponse(response: EventStreamRefreshDecisionWorkerResponse): void {
  workerScope.postMessage(response);
}

function handleRequest(request: EventStreamRefreshDecisionWorkerRequest): void {
  refreshDecisionEngineIfNeeded(request.threadOnlyHistoryMethods);
  try {
    const decision = decisionEngine.readDecision(request.input);
    postResponse({
      requestId: request.requestId,
      kind: "success",
      decision,
    });
  } catch (_error) {
    postResponse({
      requestId: request.requestId,
      kind: "failure",
      reason: WORKER_REQUEST_PROCESSING_FAILURE_REASON,
    });
  }
}

workerScope.addEventListener("message", (event) => {
  let parsedRequest: EventStreamRefreshDecisionWorkerRequest;
  try {
    parsedRequest = parseEventStreamRefreshDecisionWorkerRequest(event.data);
  } catch {
    postResponse({
      requestId: 0,
      kind: "failure",
      reason: WORKER_REQUEST_PARSE_FAILURE_REASON_PREFIX,
    });
    return;
  }

  handleRequest(parsedRequest);
});
