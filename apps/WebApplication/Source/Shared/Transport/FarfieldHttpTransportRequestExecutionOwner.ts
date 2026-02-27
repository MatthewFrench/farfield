/**
 * Owns request dispatch semantics: request-id assignment, timeout policy, and abort behavior.
 */
import {
  REQUEST_ID_HEADER_NAME,
  REQUEST_ID_LABEL,
} from "@/Shared/Contracts/RequestMetadataContracts";
import { RequestCanceledError } from "@/Shared/Errors/RequestCanceledError";
import {
  buildRequestFailureMessageWithReason,
  createEmptyResponseTextSummary,
  createRequestFailureError,
} from "./FarfieldHttpTransportResponseOwner";

const REQUEST_TIMEOUT_MILLISECONDS = 120_000;
const REQUEST_TIMEOUT_MESSAGE_PREFIX = "Request timed out for";
const FETCH_ABORT_ERROR_NAME = "AbortError";
const CLIENT_REQUEST_ID_RANDOM_MAX_EXCLUSIVE = 1_000_000_000;
const CLIENT_REQUEST_ID_HEX_RADIX = 16;

function createClientRequestId(): string {
  return `req_${String(Date.now())}_${Math.floor(Math.random() * CLIENT_REQUEST_ID_RANDOM_MAX_EXCLUSIVE).toString(CLIENT_REQUEST_ID_HEX_RADIX)}`;
}

function buildTimeoutErrorMessage(path: string, requestId: string): string {
  return `${REQUEST_TIMEOUT_MESSAGE_PREFIX} ${path} after ${String(REQUEST_TIMEOUT_MILLISECONDS)}ms ${REQUEST_ID_LABEL} ${requestId}`;
}

function isAbortError(error: Error): boolean {
  return error.name === FETCH_ABORT_ERROR_NAME;
}

// Timeout semantics: the request budget starts when fetch is dispatched, and timeout aborts are
// treated differently from caller-signal aborts so cancellation reporting stays deterministic.
export async function performRequest(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const requestId = createClientRequestId();
  headers.set(REQUEST_ID_HEADER_NAME, requestId);
  const timeoutController = new AbortController();
  const timeoutState = {
    didTimeout: false,
  };
  const timeoutHandle = setTimeout(() => {
    timeoutState.didTimeout = true;
    timeoutController.abort();
  }, REQUEST_TIMEOUT_MILLISECONDS);
  const inheritedSignal = init?.signal;
  const onAbortInheritedSignal = () => {
    timeoutController.abort();
  };
  if (inheritedSignal) {
    if (inheritedSignal.aborted) {
      timeoutController.abort();
    } else {
      inheritedSignal.addEventListener("abort", onAbortInheritedSignal, {
        once: true,
      });
    }
  }

  try {
    return await fetch(path, {
      ...init,
      headers,
      signal: timeoutController.signal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && isAbortError(error)) {
      if (timeoutState.didTimeout === true) {
        throw new Error(buildTimeoutErrorMessage(path, requestId));
      }
      throw new RequestCanceledError(path);
    }
    throw createRequestFailureError(
      path,
      requestId,
      null,
      createEmptyResponseTextSummary(),
      buildRequestFailureMessageWithReason(path, message),
    );
  } finally {
    clearTimeout(timeoutHandle);
    if (inheritedSignal) {
      inheritedSignal.removeEventListener("abort", onAbortInheritedSignal);
    }
  }
}
