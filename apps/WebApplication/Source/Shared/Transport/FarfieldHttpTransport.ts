/**
 * Composes shared transport owners into the public HTTP boundary API for web data-access modules.
 * Invariant: JSON parsing always uses the full response body; truncation is diagnostic-only.
 */
import { z } from "zod";
import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";
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
const defaultHttpResponseDecodeExecutionMode =
  import.meta.env.MODE === "test" ? "in-thread" : "worker";
const HTTP_RESPONSE_DECODE_EXECUTION_MODE = HttpResponseDecodeExecutionModeSchema.parse(
  defaultHttpResponseDecodeExecutionMode,
);
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

export { FarfieldHttpRequestFailureError } from "./FarfieldHttpRequestFailureError";
export {
  applyRequestOptions,
  requestInitWithOptions,
} from "./FarfieldHttpTransportRequestOptionsOwner";

export async function request(path: string, init?: RequestInit): Promise<StructuredDataValue> {
  const normalizedPath = normalizeRequestPath(path);
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

  return decodedPayload.data;
}

export async function requestNoContent(path: string, init?: RequestInit): Promise<void> {
  const normalizedPath = normalizeRequestPath(path);
  const response = await performRequest(normalizedPath, init);
  const responseRequestId = readResponseRequestId(response);
  if (response.ok) {
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
}
