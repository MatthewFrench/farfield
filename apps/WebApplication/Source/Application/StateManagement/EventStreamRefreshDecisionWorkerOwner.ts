import {
  type EventStreamRefreshDecision,
  type EventStreamRefreshDecisionInput,
  type EventStreamRefreshDecisionReader,
} from "./EventStreamRefreshDecisionEngine";
import {
  type EventStreamRefreshDecisionWorkerRequest,
  type EventStreamRefreshDecisionWorkerResponse,
  safeParseEventStreamRefreshDecisionWorkerResponse,
} from "./EventStreamRefreshDecisionWorkerContracts";

interface PendingDecisionRequest {
  resolve: (decision: EventStreamRefreshDecision) => void;
  reject: (error: Error) => void;
}

export interface EventStreamRefreshDecisionMessageWorker {
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  addEventListener(type: "error", listener: (event: Event) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "error", listener: (event: Event) => void): void;
  postMessage(message: EventStreamRefreshDecisionWorkerRequest): void;
  terminate(): void;
}

export interface EventStreamRefreshDecisionWorkerOwnerDependencies {
  threadOnlyHistoryMethods: readonly string[];
  createWorker: () => EventStreamRefreshDecisionMessageWorker;
}

const THREAD_ONLY_HISTORY_METHODS_SEPARATOR = "|";
const WORKER_DISPOSED_ERROR_MESSAGE = "EventStreamRefreshDecisionWorkerOwner has been disposed.";
const WORKER_ERROR_MESSAGE_PREFIX = "Event stream decision worker error";
const WORKER_RESPONSE_ERROR_MESSAGE_PREFIX = "Event stream decision worker response error";
const WORKER_INVALID_RESPONSE_ERROR_MESSAGE_PREFIX =
  "Event stream decision worker returned an invalid response";
const WORKER_FAILURE_RESPONSE_ERROR_MESSAGE_PREFIX =
  "Event stream decision worker failed to read decision";
const INITIAL_REQUEST_IDENTIFIER = 1;

function buildWorkerResponseErrorMessage(reason: string): string {
  return `${WORKER_RESPONSE_ERROR_MESSAGE_PREFIX}: ${reason}`;
}

function normalizeThreadOnlyHistoryMethods(threadOnlyHistoryMethods: readonly string[]): string[] {
  const normalizedMethods: string[] = [];
  for (const threadOnlyHistoryMethod of threadOnlyHistoryMethods) {
    const normalizedMethod = threadOnlyHistoryMethod.trim();
    if (normalizedMethod.length === 0) {
      continue;
    }
    normalizedMethods.push(normalizedMethod);
  }
  return normalizedMethods;
}

function buildThreadOnlyHistoryMethodsSignature(
  threadOnlyHistoryMethods: readonly string[],
): string {
  return threadOnlyHistoryMethods.join(THREAD_ONLY_HISTORY_METHODS_SEPARATOR);
}

/**
 * Owns asynchronous event-stream decision execution over a dedicated worker.
 * Responses are correlated by request identifier so high-frequency event bursts remain deterministic.
 */
export class EventStreamRefreshDecisionWorkerOwner implements EventStreamRefreshDecisionReader {
  private readonly worker: EventStreamRefreshDecisionMessageWorker;
  private readonly threadOnlyHistoryMethods: string[];
  private readonly messageListener: (event: MessageEvent) => void;
  private readonly errorListener: (event: Event) => void;
  private readonly pendingDecisionRequests: Map<number, PendingDecisionRequest>;
  private nextRequestIdentifier: number;
  private disposed: boolean;

  public constructor(dependencies: EventStreamRefreshDecisionWorkerOwnerDependencies) {
    this.worker = dependencies.createWorker();
    this.threadOnlyHistoryMethods = normalizeThreadOnlyHistoryMethods(
      dependencies.threadOnlyHistoryMethods,
    );
    this.messageListener = (event) => {
      this.handleWorkerMessage(event);
    };
    this.errorListener = (event) => {
      this.handleWorkerError(event);
    };
    this.pendingDecisionRequests = new Map<number, PendingDecisionRequest>();
    this.nextRequestIdentifier = INITIAL_REQUEST_IDENTIFIER;
    this.disposed = false;

    this.worker.addEventListener("message", this.messageListener);
    this.worker.addEventListener("error", this.errorListener);
  }

  public readDecision(input: EventStreamRefreshDecisionInput): Promise<EventStreamRefreshDecision> {
    if (this.disposed) {
      return Promise.reject(new Error(WORKER_DISPOSED_ERROR_MESSAGE));
    }

    const requestIdentifier = this.nextRequestIdentifier;
    this.nextRequestIdentifier += 1;
    const request: EventStreamRefreshDecisionWorkerRequest = {
      requestId: requestIdentifier,
      threadOnlyHistoryMethods: this.threadOnlyHistoryMethods,
      input,
    };

    return new Promise<EventStreamRefreshDecision>((resolve, reject) => {
      this.pendingDecisionRequests.set(requestIdentifier, { resolve, reject });
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
    this.rejectPendingDecisionRequests(new Error(WORKER_DISPOSED_ERROR_MESSAGE));
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const parsedResponseResult = safeParseEventStreamRefreshDecisionWorkerResponse(event.data);
    if (!parsedResponseResult.success) {
      this.rejectPendingDecisionRequests(
        new Error(
          buildWorkerResponseErrorMessage(
            `${WORKER_INVALID_RESPONSE_ERROR_MESSAGE_PREFIX}: ${parsedResponseResult.error.message}`,
          ),
        ),
      );
      return;
    }

    const parsedResponse = parsedResponseResult.data;
    const pendingDecisionRequest = this.pendingDecisionRequests.get(parsedResponse.requestId);
    if (!pendingDecisionRequest) {
      return;
    }

    this.pendingDecisionRequests.delete(parsedResponse.requestId);
    this.resolveOrRejectPendingDecisionRequest(pendingDecisionRequest, parsedResponse);
  }

  private resolveOrRejectPendingDecisionRequest(
    pendingDecisionRequest: PendingDecisionRequest,
    response: EventStreamRefreshDecisionWorkerResponse,
  ): void {
    if (response.kind === "success") {
      pendingDecisionRequest.resolve(response.decision);
      return;
    }
    pendingDecisionRequest.reject(
      new Error(
        buildWorkerResponseErrorMessage(
          `${WORKER_FAILURE_RESPONSE_ERROR_MESSAGE_PREFIX}: ${response.reason}`,
        ),
      ),
    );
  }

  private handleWorkerError(_: Event): void {
    this.rejectPendingDecisionRequests(
      new Error(buildWorkerResponseErrorMessage(WORKER_ERROR_MESSAGE_PREFIX)),
    );
  }

  private rejectPendingDecisionRequests(error: Error): void {
    for (const pendingDecisionRequest of this.pendingDecisionRequests.values()) {
      pendingDecisionRequest.reject(error);
    }
    this.pendingDecisionRequests.clear();
  }

  public readWorkerConfigurationSignature(): string {
    return buildThreadOnlyHistoryMethodsSignature(this.threadOnlyHistoryMethods);
  }
}
