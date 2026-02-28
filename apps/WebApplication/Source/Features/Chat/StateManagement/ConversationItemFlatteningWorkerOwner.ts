import { type FlattenedConversationItem } from "../DomainModel/ConversationItemFlattener";
import {
  type ConversationItemFlatteningInput,
  type ConversationItemFlatteningWorkerRequest,
  type ConversationItemFlatteningWorkerResponse,
  safeParseConversationItemFlatteningWorkerResponse,
} from "./ConversationItemFlatteningWorkerContracts";

interface PendingConversationItemFlatteningRequest {
  resolve: (flattenedItems: FlattenedConversationItem[]) => void;
  reject: (error: Error) => void;
}

export interface ConversationItemFlatteningMessageWorker {
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  addEventListener(type: "error", listener: (event: Event) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "error", listener: (event: Event) => void): void;
  postMessage(message: ConversationItemFlatteningWorkerRequest): void;
  terminate(): void;
}

export interface ConversationItemFlatteningWorkerOwnerDependencies {
  createWorker: () => ConversationItemFlatteningMessageWorker;
}

export const CONVERSATION_ITEM_FLATTENING_WORKER_DISPOSED_ERROR_MESSAGE =
  "ConversationItemFlatteningWorkerOwner has been disposed.";
const WORKER_ERROR_MESSAGE = "Conversation item flattening worker error";
const WORKER_RESPONSE_ERROR_MESSAGE_PREFIX = "Conversation item flattening worker response error";
const WORKER_FAILURE_RESPONSE_ERROR_MESSAGE_PREFIX =
  "Conversation item flattening worker failed to read flattened items";
const WORKER_INVALID_RESPONSE_ERROR_MESSAGE_PREFIX =
  "Conversation item flattening worker returned an invalid response";
const INITIAL_REQUEST_IDENTIFIER = 1;

function buildWorkerResponseErrorMessage(reason: string): string {
  return `${WORKER_RESPONSE_ERROR_MESSAGE_PREFIX}: ${reason}`;
}

export interface ConversationItemFlatteningReader {
  readFlattenedConversationItems(
    input: ConversationItemFlatteningInput,
  ): Promise<FlattenedConversationItem[]>;
}

/**
 * Owns asynchronous conversation-item flattening over a dedicated worker.
 * Request identifiers preserve deterministic result correlation under concurrent rerenders.
 */
export class ConversationItemFlatteningWorkerOwner implements ConversationItemFlatteningReader {
  private readonly worker: ConversationItemFlatteningMessageWorker;
  private readonly messageListener: (event: MessageEvent) => void;
  private readonly errorListener: (event: Event) => void;
  private readonly pendingRequests: Map<number, PendingConversationItemFlatteningRequest>;
  private nextRequestIdentifier: number;
  private disposed: boolean;

  public constructor(dependencies: ConversationItemFlatteningWorkerOwnerDependencies) {
    this.worker = dependencies.createWorker();
    this.messageListener = (event) => {
      this.handleWorkerMessage(event);
    };
    this.errorListener = (event) => {
      this.handleWorkerError(event);
    };
    this.pendingRequests = new Map<number, PendingConversationItemFlatteningRequest>();
    this.nextRequestIdentifier = INITIAL_REQUEST_IDENTIFIER;
    this.disposed = false;

    this.worker.addEventListener("message", this.messageListener);
    this.worker.addEventListener("error", this.errorListener);
  }

  public readFlattenedConversationItems(
    input: ConversationItemFlatteningInput,
  ): Promise<FlattenedConversationItem[]> {
    if (this.disposed) {
      return Promise.reject(new Error(CONVERSATION_ITEM_FLATTENING_WORKER_DISPOSED_ERROR_MESSAGE));
    }

    const requestIdentifier = this.nextRequestIdentifier;
    this.nextRequestIdentifier += 1;
    const request: ConversationItemFlatteningWorkerRequest = {
      requestId: requestIdentifier,
      input: {
        turns: input.turns,
        isGenerating: input.isGenerating,
      },
    };

    return new Promise<FlattenedConversationItem[]>((resolve, reject) => {
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
    this.rejectPendingRequests(
      new Error(CONVERSATION_ITEM_FLATTENING_WORKER_DISPOSED_ERROR_MESSAGE),
    );
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const parsedResponseResult = safeParseConversationItemFlatteningWorkerResponse(event.data);
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
    pendingRequest: PendingConversationItemFlatteningRequest,
    response: ConversationItemFlatteningWorkerResponse,
  ): void {
    if (response.kind === "success") {
      pendingRequest.resolve(response.flattenedItems);
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
