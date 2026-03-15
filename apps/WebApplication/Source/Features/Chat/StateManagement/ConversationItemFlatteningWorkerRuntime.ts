/// <reference lib="webworker" />

import { ConversationItemFlattener } from "../DomainModel/ConversationItemFlattener";
import {
  type ConversationItemFlatteningWorkerRequest,
  type ConversationItemFlatteningWorkerResponse,
  parseConversationItemFlatteningWorkerRequest,
} from "./ConversationItemFlatteningWorkerContracts";

const WORKER_REQUEST_PARSE_FAILURE_REASON = "Invalid conversation item flattening worker request";
const WORKER_REQUEST_PROCESSING_FAILURE_REASON =
  "Conversation item flattening worker request processing failed";

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
const conversationItemFlattener = new ConversationItemFlattener();

function postResponse(response: ConversationItemFlatteningWorkerResponse): void {
  workerScope.postMessage(response);
}

function handleRequest(request: ConversationItemFlatteningWorkerRequest): void {
  try {
    const flattenedItems = conversationItemFlattener.flattenConversationItems(
      request.input.turns,
      request.input.isGenerating,
    );
    postResponse({
      requestId: request.requestId,
      kind: "success",
      flattenedItems,
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
  let parsedRequest: ConversationItemFlatteningWorkerRequest;
  try {
    parsedRequest = parseConversationItemFlatteningWorkerRequest(event.data);
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
