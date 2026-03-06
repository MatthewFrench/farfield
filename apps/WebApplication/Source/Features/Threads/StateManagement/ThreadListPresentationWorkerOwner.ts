import {
  beginGlobalPerformanceOperation,
  type ClientPerformanceOperationToken,
  completeGlobalPerformanceOperation,
} from "@/Shared/Performance/ClientPerformanceFreezeProbeOwner";
import type {
  ThreadListPresentationStateInput,
  ThreadListPresentationStateResult,
} from "./ThreadListPresentationStateResolver";
import {
  safeParseThreadListPresentationWorkerResponse,
  type ThreadListPresentationWorkerRequest,
  type ThreadListPresentationWorkerResponse,
} from "./ThreadListPresentationWorkerContracts";

interface PendingThreadListPresentationRequest {
  resolve: (state: ThreadListPresentationStateResult) => void;
  reject: (error: Error) => void;
  operationToken: ClientPerformanceOperationToken | null;
}

export interface ThreadListPresentationMessageWorker {
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  addEventListener(type: "error", listener: (event: Event) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "error", listener: (event: Event) => void): void;
  postMessage(message: ThreadListPresentationWorkerRequest): void;
  terminate(): void;
}

export interface ThreadListPresentationWorkerOwnerDependencies {
  createWorker: () => ThreadListPresentationMessageWorker;
}

export const THREAD_LIST_PRESENTATION_WORKER_DISPOSED_ERROR_MESSAGE =
  "ThreadListPresentationWorkerOwner has been disposed.";
const WORKER_ERROR_MESSAGE = "Thread list presentation worker error";
const WORKER_RESPONSE_ERROR_MESSAGE_PREFIX = "Thread list presentation worker response error";
const WORKER_FAILURE_RESPONSE_ERROR_MESSAGE_PREFIX =
  "Thread list presentation worker failed to read presentation state";
const WORKER_INVALID_RESPONSE_ERROR_MESSAGE_PREFIX =
  "Thread list presentation worker returned an invalid response";
const INITIAL_REQUEST_IDENTIFIER = 1;

function buildWorkerResponseErrorMessage(reason: string): string {
  return `${WORKER_RESPONSE_ERROR_MESSAGE_PREFIX}: ${reason}`;
}

export interface ThreadListPresentationReader {
  readState(input: ThreadListPresentationStateInput): Promise<ThreadListPresentationStateResult>;
}

/**
 * Owns asynchronous thread-list presentation derivation over a dedicated worker.
 * Responses are mapped by request identifier to preserve deterministic state progression.
 */
export class ThreadListPresentationWorkerOwner implements ThreadListPresentationReader {
  private readonly worker: ThreadListPresentationMessageWorker;
  private readonly messageListener: (event: MessageEvent) => void;
  private readonly errorListener: (event: Event) => void;
  private readonly pendingRequests: Map<number, PendingThreadListPresentationRequest>;
  private nextRequestIdentifier: number;
  private disposed: boolean;

  public constructor(dependencies: ThreadListPresentationWorkerOwnerDependencies) {
    this.worker = dependencies.createWorker();
    this.messageListener = (event) => {
      this.handleWorkerMessage(event);
    };
    this.errorListener = (event) => {
      this.handleWorkerError(event);
    };
    this.pendingRequests = new Map<number, PendingThreadListPresentationRequest>();
    this.nextRequestIdentifier = INITIAL_REQUEST_IDENTIFIER;
    this.disposed = false;

    this.worker.addEventListener("message", this.messageListener);
    this.worker.addEventListener("error", this.errorListener);
  }

  public readState(
    input: ThreadListPresentationStateInput,
  ): Promise<ThreadListPresentationStateResult> {
    if (this.disposed) {
      return Promise.reject(new Error(THREAD_LIST_PRESENTATION_WORKER_DISPOSED_ERROR_MESSAGE));
    }

    const requestIdentifier = this.nextRequestIdentifier;
    this.nextRequestIdentifier += 1;
    const request: ThreadListPresentationWorkerRequest = {
      requestId: requestIdentifier,
      input,
    };
    const operationToken = beginGlobalPerformanceOperation(
      "thread-list-presentation-worker-roundtrip",
      {
        requestId: requestIdentifier,
        activeThreadCount: input.threads.length,
        archivedThreadCount: input.archivedThreads.length,
        hasSelectedThreadIdentifier: input.selectedThreadIdentifier !== null,
      },
    );

    return new Promise<ThreadListPresentationStateResult>((resolve, reject) => {
      this.pendingRequests.set(requestIdentifier, {
        resolve,
        reject,
        operationToken,
      });
      this.worker.postMessage(request);
    });
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.worker.removeEventListener("message", this.messageListener);
    this.worker.removeEventListener("error", this.errorListener);
    this.worker.terminate();
    this.rejectPendingRequests(new Error(THREAD_LIST_PRESENTATION_WORKER_DISPOSED_ERROR_MESSAGE));
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const parsedResponseResult = safeParseThreadListPresentationWorkerResponse(event.data);
    if (!parsedResponseResult.success) {
      this.rejectPendingRequests(
        new Error(
          buildWorkerResponseErrorMessage(
            `${WORKER_INVALID_RESPONSE_ERROR_MESSAGE_PREFIX}: ${parsedResponseResult.error.message}`,
          ),
        ),
        "failed",
      );
      return;
    }

    const parsedResponse = parsedResponseResult.data;
    const pendingRequest = this.pendingRequests.get(parsedResponse.requestId);
    if (!pendingRequest) {
      return;
    }

    this.pendingRequests.delete(parsedResponse.requestId);
    this.resolveOrRejectPendingRequest(pendingRequest, parsedResponse);
  }

  private resolveOrRejectPendingRequest(
    pendingRequest: PendingThreadListPresentationRequest,
    response: ThreadListPresentationWorkerResponse,
  ): void {
    if (response.kind === "success") {
      completeGlobalPerformanceOperation(pendingRequest.operationToken, "succeeded", {
        requestId: response.requestId,
        activeProjectGroupCount: response.result.activeProjectGroups.length,
        archivedProjectGroupCount: response.result.archivedProjectGroups.length,
      });
      pendingRequest.resolve({
        selectedThread: response.result.selectedThread,
        activeProjectGroups: response.result.activeProjectGroups,
        archivedProjectGroups: response.result.archivedProjectGroups,
        archivedThreadIdentifiers: new Set(response.result.archivedThreadIdentifiers),
        archivedSectionThreadCount: response.result.archivedSectionThreadCount,
      });
      return;
    }
    completeGlobalPerformanceOperation(pendingRequest.operationToken, "failed", {
      requestId: response.requestId,
      reason: response.reason,
    });
    pendingRequest.reject(
      new Error(
        buildWorkerResponseErrorMessage(
          `${WORKER_FAILURE_RESPONSE_ERROR_MESSAGE_PREFIX}: ${response.reason}`,
        ),
      ),
    );
  }

  private handleWorkerError(_: Event): void {
    this.rejectPendingRequests(
      new Error(buildWorkerResponseErrorMessage(WORKER_ERROR_MESSAGE)),
      "failed",
    );
  }

  private rejectPendingRequests(error: Error, outcome: "failed" | "canceled" = "canceled"): void {
    for (const pendingRequest of this.pendingRequests.values()) {
      completeGlobalPerformanceOperation(pendingRequest.operationToken, outcome, {
        message: error.message,
      });
      pendingRequest.reject(error);
    }
    this.pendingRequests.clear();
  }
}
