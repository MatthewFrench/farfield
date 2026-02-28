import { z } from "zod";
import {
  type StructuredDataValue,
  StructuredDataValueSchema,
} from "@/Shared/Contracts/StructuredDataValue";
import {
  type FarfieldHttpResponseDecodeWorkerRequest,
  type FarfieldHttpResponseDecodeWorkerResponse,
  safeParseFarfieldHttpResponseDecodeWorkerResponse,
} from "./FarfieldHttpResponseDecodeWorkerContracts";

interface PendingResponseDecodeRequest {
  resolve: (result: FarfieldHttpResponseDecodeResult) => void;
  reject: (error: Error) => void;
}

const ApiEnvelopeSchema = z
  .object({
    ok: z.boolean(),
  })
  .passthrough();

export interface FarfieldHttpResponseDecodeMessageWorker {
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  addEventListener(type: "error", listener: (event: Event) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "error", listener: (event: Event) => void): void;
  postMessage(message: FarfieldHttpResponseDecodeWorkerRequest): void;
  terminate(): void;
}

export interface FarfieldHttpResponseDecodeWorkerOwnerDependencies {
  createWorker: () => FarfieldHttpResponseDecodeMessageWorker;
}

export interface FarfieldHttpResponseDecodeSuccess {
  kind: "success";
  data: StructuredDataValue;
  envelopeOk: boolean;
}

export interface FarfieldHttpResponseDecodeFailure {
  kind: "failure";
  reasonKind: "invalid-json" | "invalid-structured-data" | "invalid-envelope";
  reason: string;
}

export type FarfieldHttpResponseDecodeResult =
  | FarfieldHttpResponseDecodeSuccess
  | FarfieldHttpResponseDecodeFailure;

const WORKER_DISPOSED_ERROR_MESSAGE = "FarfieldHttpResponseDecodeWorkerOwner has been disposed.";
const WORKER_ERROR_MESSAGE = "Farfield HTTP response decode worker error";
const WORKER_RESPONSE_ERROR_MESSAGE_PREFIX = "Farfield HTTP response decode worker response error";
const WORKER_FAILURE_RESPONSE_ERROR_MESSAGE_PREFIX =
  "Farfield HTTP response decode worker failed to decode payload";
const WORKER_INVALID_RESPONSE_ERROR_MESSAGE_PREFIX =
  "Farfield HTTP response decode worker returned an invalid response";
const INITIAL_REQUEST_IDENTIFIER = 1;

function buildWorkerResponseErrorMessage(reason: string): string {
  return `${WORKER_RESPONSE_ERROR_MESSAGE_PREFIX}: ${reason}`;
}

export interface FarfieldHttpResponseDecodeReader {
  readDecodedPayload(parseText: string): Promise<FarfieldHttpResponseDecodeResult>;
}

export class FarfieldHttpResponseDecodeInThreadOwner implements FarfieldHttpResponseDecodeReader {
  public async readDecodedPayload(parseText: string): Promise<FarfieldHttpResponseDecodeResult> {
    let rawJsonData: StructuredDataValue;
    try {
      rawJsonData = JSON.parse(parseText);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return {
        kind: "failure",
        reasonKind: "invalid-json",
        reason,
      };
    }

    const parsedStructuredData = StructuredDataValueSchema.safeParse(rawJsonData);
    if (!parsedStructuredData.success) {
      return {
        kind: "failure",
        reasonKind: "invalid-structured-data",
        reason: parsedStructuredData.error.message,
      };
    }

    const parsedEnvelope = ApiEnvelopeSchema.safeParse(parsedStructuredData.data);
    if (!parsedEnvelope.success) {
      return {
        kind: "failure",
        reasonKind: "invalid-envelope",
        reason: parsedEnvelope.error.message,
      };
    }

    return {
      kind: "success",
      data: parsedStructuredData.data,
      envelopeOk: parsedEnvelope.data.ok,
    };
  }
}

/**
 * Owns asynchronous response decode offloading over a dedicated worker.
 * Request identifiers preserve deterministic correlation under concurrent requests.
 */
export class FarfieldHttpResponseDecodeWorkerOwner implements FarfieldHttpResponseDecodeReader {
  private readonly worker: FarfieldHttpResponseDecodeMessageWorker;
  private readonly messageListener: (event: MessageEvent) => void;
  private readonly errorListener: (event: Event) => void;
  private readonly pendingRequests: Map<number, PendingResponseDecodeRequest>;
  private nextRequestIdentifier: number;
  private disposed: boolean;

  public constructor(dependencies: FarfieldHttpResponseDecodeWorkerOwnerDependencies) {
    this.worker = dependencies.createWorker();
    this.messageListener = (event) => {
      this.handleWorkerMessage(event);
    };
    this.errorListener = (event) => {
      this.handleWorkerError(event);
    };
    this.pendingRequests = new Map<number, PendingResponseDecodeRequest>();
    this.nextRequestIdentifier = INITIAL_REQUEST_IDENTIFIER;
    this.disposed = false;

    this.worker.addEventListener("message", this.messageListener);
    this.worker.addEventListener("error", this.errorListener);
  }

  public readDecodedPayload(parseText: string): Promise<FarfieldHttpResponseDecodeResult> {
    if (this.disposed) {
      return Promise.reject(new Error(WORKER_DISPOSED_ERROR_MESSAGE));
    }

    const requestIdentifier = this.nextRequestIdentifier;
    this.nextRequestIdentifier += 1;
    const request: FarfieldHttpResponseDecodeWorkerRequest = {
      requestId: requestIdentifier,
      parseText,
    };

    return new Promise<FarfieldHttpResponseDecodeResult>((resolve, reject) => {
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
    this.rejectPendingRequests(new Error(WORKER_DISPOSED_ERROR_MESSAGE));
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const parsedResponseResult = safeParseFarfieldHttpResponseDecodeWorkerResponse(event.data);
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
    pendingRequest: PendingResponseDecodeRequest,
    response: FarfieldHttpResponseDecodeWorkerResponse,
  ): void {
    if (response.kind === "success") {
      pendingRequest.resolve({
        kind: "success",
        data: response.data,
        envelopeOk: response.envelopeOk,
      });
      return;
    }

    pendingRequest.resolve({
      kind: "failure",
      reasonKind: response.reasonKind,
      reason: response.reason,
    });
  }

  private handleWorkerError(_: Event): void {
    this.rejectPendingRequests(
      new Error(
        buildWorkerResponseErrorMessage(
          `${WORKER_FAILURE_RESPONSE_ERROR_MESSAGE_PREFIX}: ${WORKER_ERROR_MESSAGE}`,
        ),
      ),
    );
  }

  private rejectPendingRequests(error: Error): void {
    for (const pendingRequest of this.pendingRequests.values()) {
      pendingRequest.reject(error);
    }
    this.pendingRequests.clear();
  }
}
