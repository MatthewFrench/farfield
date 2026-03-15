import {
  type DebugIssueDerivationInput,
  type DebugIssueDerivationResult,
  type DebugIssueDerivationWorkerRequest,
  type DebugIssueDerivationWorkerResponse,
  safeParseDebugIssueDerivationWorkerResponse,
} from "./DebugIssueDerivationWorkerContracts";

interface PendingDebugIssueDerivationRequest {
  resolve: (result: DebugIssueDerivationResult) => void;
  reject: (error: Error) => void;
}

export interface DebugIssueDerivationMessageWorker {
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  addEventListener(type: "error", listener: (event: Event) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "error", listener: (event: Event) => void): void;
  postMessage(message: DebugIssueDerivationWorkerRequest): void;
  terminate(): void;
}

export interface DebugIssueDerivationWorkerOwnerDependencies {
  createWorker: () => DebugIssueDerivationMessageWorker;
}

export const DEBUG_ISSUE_DERIVATION_WORKER_DISPOSED_ERROR_MESSAGE =
  "DebugIssueDerivationWorkerOwner has been disposed.";
const WORKER_ERROR_MESSAGE = "Debug issue derivation worker error";
const WORKER_RESPONSE_ERROR_MESSAGE_PREFIX = "Debug issue derivation worker response error";
const WORKER_FAILURE_RESPONSE_ERROR_MESSAGE_PREFIX =
  "Debug issue derivation worker failed to read derived state";
const WORKER_INVALID_RESPONSE_ERROR_MESSAGE_PREFIX =
  "Debug issue derivation worker returned an invalid response";
const INITIAL_REQUEST_IDENTIFIER = 1;

function buildWorkerResponseErrorMessage(reason: string): string {
  return `${WORKER_RESPONSE_ERROR_MESSAGE_PREFIX}: ${reason}`;
}

export interface DebugIssueDerivationReader {
  readDerivedDebugIssueState(input: DebugIssueDerivationInput): Promise<DebugIssueDerivationResult>;
}

/**
 * Owns asynchronous debug-issue derivation over a dedicated worker.
 * Request identifiers preserve deterministic correlation across rapid filter and data updates.
 */
export class DebugIssueDerivationWorkerOwner implements DebugIssueDerivationReader {
  private readonly worker: DebugIssueDerivationMessageWorker;
  private readonly messageListener: (event: MessageEvent) => void;
  private readonly errorListener: (event: Event) => void;
  private readonly pendingRequests: Map<number, PendingDebugIssueDerivationRequest>;
  private nextRequestIdentifier: number;
  private disposed: boolean;

  public constructor(dependencies: DebugIssueDerivationWorkerOwnerDependencies) {
    this.worker = dependencies.createWorker();
    this.messageListener = (event) => {
      this.handleWorkerMessage(event);
    };
    this.errorListener = (event) => {
      this.handleWorkerError(event);
    };
    this.pendingRequests = new Map<number, PendingDebugIssueDerivationRequest>();
    this.nextRequestIdentifier = INITIAL_REQUEST_IDENTIFIER;
    this.disposed = false;

    this.worker.addEventListener("message", this.messageListener);
    this.worker.addEventListener("error", this.errorListener);
  }

  public readDerivedDebugIssueState(
    input: DebugIssueDerivationInput,
  ): Promise<DebugIssueDerivationResult> {
    if (this.disposed) {
      return Promise.reject(new Error(DEBUG_ISSUE_DERIVATION_WORKER_DISPOSED_ERROR_MESSAGE));
    }

    const requestIdentifier = this.nextRequestIdentifier;
    this.nextRequestIdentifier += 1;
    const request: DebugIssueDerivationWorkerRequest = {
      requestId: requestIdentifier,
      input,
    };

    return new Promise<DebugIssueDerivationResult>((resolve, reject) => {
      this.pendingRequests.set(requestIdentifier, { resolve, reject });
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
    this.rejectPendingRequests(new Error(DEBUG_ISSUE_DERIVATION_WORKER_DISPOSED_ERROR_MESSAGE));
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const parsedResponseResult = safeParseDebugIssueDerivationWorkerResponse(event.data);
    if (!parsedResponseResult.success) {
      this.rejectPendingRequests(
        new Error(
          buildWorkerResponseErrorMessage(
            `${WORKER_INVALID_RESPONSE_ERROR_MESSAGE_PREFIX}: ${parsedResponseResult.error.message}`,
          ),
        ),
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
    pendingRequest: PendingDebugIssueDerivationRequest,
    response: DebugIssueDerivationWorkerResponse,
  ): void {
    if (response.kind === "success") {
      pendingRequest.resolve(response.result);
      return;
    }
    pendingRequest.reject(
      new Error(
        buildWorkerResponseErrorMessage(
          `${WORKER_FAILURE_RESPONSE_ERROR_MESSAGE_PREFIX}: ${response.reason}`,
        ),
      ),
    );
  }

  private handleWorkerError(_: Event): void {
    this.rejectPendingRequests(new Error(buildWorkerResponseErrorMessage(WORKER_ERROR_MESSAGE)));
  }

  private rejectPendingRequests(error: Error): void {
    for (const pendingRequest of this.pendingRequests.values()) {
      pendingRequest.reject(error);
    }
    this.pendingRequests.clear();
  }
}
