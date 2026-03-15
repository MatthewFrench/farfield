/**
 * Composes shared transport owners into the public HTTP boundary API for web data-access modules.
 * Invariant: JSON parsing always uses the full response body; truncation is diagnostic-only.
 */
import { z } from "zod";
import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";
import { isRequestCanceledError } from "@/Shared/Errors/RequestCanceledError";
import {
  beginGlobalPerformanceOperation,
  completeGlobalPerformanceOperation,
} from "@/Shared/Performance/ClientPerformanceFreezeProbeOwner";
import {
  FarfieldHttpResponseDecodeInThreadOwner,
  type FarfieldHttpResponseDecodeReader,
  type FarfieldHttpResponseDecodeResult,
  FarfieldHttpResponseDecodeWorkerOwner,
} from "./FarfieldHttpResponseDecodeOwner";
import { performRequest } from "./FarfieldHttpTransportRequestExecutionOwner";
import {
  buildInvalidApiEnvelopeMessage,
  buildInvalidJsonResponseMessage,
  buildRequestFailureMessageWithReason,
  createRequestFailureError,
  EMPTY_RESPONSE_REASON,
  readResponseBody,
  readResponseRequestId,
  resolveFailureBaseMessage,
} from "./FarfieldHttpTransportResponseOwner";

const RequestPathSchema = z.string().trim().min(1, "Request path must not be blank.");
const HttpResponseDecodeExecutionModeSchema = z.enum(["worker", "in-thread"]);
const defaultHttpResponseDecodeExecutionMode = "in-thread";
const HTTP_RESPONSE_DECODE_EXECUTION_MODE = HttpResponseDecodeExecutionModeSchema.parse(
  defaultHttpResponseDecodeExecutionMode,
);
const DEFAULT_HTTP_METHOD = "GET";
const farfieldHttpResponseDecodeOwner: FarfieldHttpResponseDecodeReader =
  HTTP_RESPONSE_DECODE_EXECUTION_MODE === "worker"
    ? new FarfieldHttpResponseDecodeWorkerOwner({
        createWorker: () =>
          new Worker(new URL("./FarfieldHttpResponseDecodeWorkerRuntime.ts", import.meta.url), {
            type: "module",
          }),
      })
    : new FarfieldHttpResponseDecodeInThreadOwner();

function normalizeRequestPath(path: string): string {
  return RequestPathSchema.parse(path);
}

function readRequestMethod(init: RequestInit | undefined): string {
  const rawMethod = init?.method;
  if (rawMethod === undefined || rawMethod.trim().length === 0) {
    return DEFAULT_HTTP_METHOD;
  }
  return rawMethod.trim().toUpperCase();
}

export { FarfieldHttpRequestFailureError } from "./FarfieldHttpRequestFailureError";
export {
  applyRequestOptions,
  requestInitWithOptions,
} from "./FarfieldHttpTransportRequestOptionsOwner";

export async function request(path: string, init?: RequestInit): Promise<StructuredDataValue> {
  const normalizedPath = normalizeRequestPath(path);
  const requestMethod = readRequestMethod(init);
  const operationToken = beginGlobalPerformanceOperation("http-request", {
    path: normalizedPath,
    method: requestMethod,
    expectsNoContent: false,
  });
  try {
    const response = await performRequest(normalizedPath, init);
    const responseRequestId = readResponseRequestId(response);
    const responseBody = await readResponseBody(response);

    if (responseBody.parseText === null) {
      throw createRequestFailureError(
        normalizedPath,
        responseRequestId,
        response,
        responseBody.responseTextSummary,
        buildInvalidJsonResponseMessage(normalizedPath, EMPTY_RESPONSE_REASON),
      );
    }

    let decodedPayload: FarfieldHttpResponseDecodeResult;
    try {
      decodedPayload = await farfieldHttpResponseDecodeOwner.readDecodedPayload(
        responseBody.parseText,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw createRequestFailureError(
        normalizedPath,
        responseRequestId,
        response,
        responseBody.responseTextSummary,
        buildInvalidJsonResponseMessage(normalizedPath, reason),
      );
    }

    if (decodedPayload.kind === "failure") {
      const failureMessage =
        decodedPayload.reasonKind === "invalid-envelope"
          ? buildInvalidApiEnvelopeMessage(normalizedPath, decodedPayload.reason)
          : buildInvalidJsonResponseMessage(normalizedPath, decodedPayload.reason);
      throw createRequestFailureError(
        normalizedPath,
        responseRequestId,
        response,
        responseBody.responseTextSummary,
        failureMessage,
      );
    }

    if (!response.ok || decodedPayload.envelopeOk === false) {
      throw createRequestFailureError(
        normalizedPath,
        responseRequestId,
        response,
        responseBody.responseTextSummary,
        resolveFailureBaseMessage(normalizedPath, decodedPayload.data),
      );
    }

    completeGlobalPerformanceOperation(operationToken, "succeeded", {
      path: normalizedPath,
      method: requestMethod,
      status: response.status,
      requestId: responseRequestId,
      envelopeOk: decodedPayload.envelopeOk,
    });
    return decodedPayload.data;
  } catch (error) {
    completeGlobalPerformanceOperation(
      operationToken,
      error instanceof Error && isRequestCanceledError(error) ? "canceled" : "failed",
      {
        path: normalizedPath,
        method: requestMethod,
        message: error instanceof Error ? error.message : String(error),
      },
    );
    throw error;
  }
}

export async function requestNoContent(path: string, init?: RequestInit): Promise<void> {
  const normalizedPath = normalizeRequestPath(path);
  const requestMethod = readRequestMethod(init);
  const operationToken = beginGlobalPerformanceOperation("http-request", {
    path: normalizedPath,
    method: requestMethod,
    expectsNoContent: true,
  });
  try {
    const response = await performRequest(normalizedPath, init);
    const responseRequestId = readResponseRequestId(response);
    if (response.ok) {
      completeGlobalPerformanceOperation(operationToken, "succeeded", {
        path: normalizedPath,
        method: requestMethod,
        status: response.status,
        requestId: responseRequestId,
      });
      return;
    }

    const responseBody = await readResponseBody(response);
    if (responseBody.parseText === null) {
      throw createRequestFailureError(
        normalizedPath,
        responseRequestId,
        response,
        responseBody.responseTextSummary,
        buildRequestFailureMessageWithReason(normalizedPath, EMPTY_RESPONSE_REASON),
      );
    }

    let decodedPayload: FarfieldHttpResponseDecodeResult | null;
    try {
      decodedPayload = await farfieldHttpResponseDecodeOwner.readDecodedPayload(
        responseBody.parseText,
      );
    } catch {
      decodedPayload = null;
    }
    const responseData =
      decodedPayload && decodedPayload.kind === "success" ? decodedPayload.data : null;
    throw createRequestFailureError(
      normalizedPath,
      responseRequestId,
      response,
      responseBody.responseTextSummary,
      resolveFailureBaseMessage(normalizedPath, responseData),
    );
  } catch (error) {
    completeGlobalPerformanceOperation(
      operationToken,
      error instanceof Error && isRequestCanceledError(error) ? "canceled" : "failed",
      {
        path: normalizedPath,
        method: requestMethod,
        message: error instanceof Error ? error.message : String(error),
      },
    );
    throw error;
  }
}
