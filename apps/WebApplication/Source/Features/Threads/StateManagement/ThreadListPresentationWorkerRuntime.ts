/// <reference lib="webworker" />

import { ThreadListPresentationStateResolver } from "./ThreadListPresentationStateResolver";
import {
  parseThreadListPresentationWorkerRequest,
  type ThreadListPresentationWorkerRequest,
  type ThreadListPresentationWorkerResponse,
} from "./ThreadListPresentationWorkerContracts";

const WORKER_REQUEST_PARSE_FAILURE_REASON = "Invalid thread list presentation worker request";
const WORKER_REQUEST_PROCESSING_FAILURE_REASON =
  "Thread list presentation worker request processing failed";

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
const threadListPresentationStateResolver = new ThreadListPresentationStateResolver();

function postResponse(response: ThreadListPresentationWorkerResponse): void {
  workerScope.postMessage(response);
}

function handleRequest(request: ThreadListPresentationWorkerRequest): void {
  try {
    const state = threadListPresentationStateResolver.readState(request.input);
    postResponse({
      requestId: request.requestId,
      kind: "success",
      result: {
        selectedThread: state.selectedThread,
        activeProjectGroups: state.activeProjectGroups,
        archivedProjectGroups: state.archivedProjectGroups,
        archivedThreadIdentifiers: Array.from(state.archivedThreadIdentifiers),
        archivedSectionThreadCount: state.archivedSectionThreadCount,
      },
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
  let parsedRequest: ThreadListPresentationWorkerRequest;
  try {
    parsedRequest = parseThreadListPresentationWorkerRequest(event.data);
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
