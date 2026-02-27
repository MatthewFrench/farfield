/**
 * Composes shared transport owners into the public HTTP boundary API for web data-access modules.
 * Invariant: JSON parsing always uses the full response body; truncation is diagnostic-only.
 */
import { z } from "zod";
import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";
import { performRequest } from "./FarfieldHttpTransportRequestExecutionOwner";
import {
  buildInvalidApiEnvelopeMessage,
  buildInvalidJsonResponseMessage,
  buildRequestFailureMessageWithReason,
  createRequestFailureError,
  decodeApiEnvelope,
  decodeStructuredDataValue,
  EMPTY_RESPONSE_REASON,
  readResponseBody,
  readResponseRequestId,
  resolveFailureBaseMessage,
} from "./FarfieldHttpTransportResponseOwner";

const RequestPathSchema = z.string().trim().min(1, "Request path must not be blank.");

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

  const decodedStructuredData = decodeStructuredDataValue(responseBody.parseText);
  if (decodedStructuredData.kind === "failure") {
    throw createRequestFailureError(
      normalizedPath,
      responseRequestId,
      response,
      responseBody.responseTextSummary,
      buildInvalidJsonResponseMessage(normalizedPath, decodedStructuredData.reason),
    );
  }

  const decodedEnvelope = decodeApiEnvelope(decodedStructuredData.data);
  if (decodedEnvelope.kind === "failure") {
    throw createRequestFailureError(
      normalizedPath,
      responseRequestId,
      response,
      responseBody.responseTextSummary,
      buildInvalidApiEnvelopeMessage(normalizedPath, decodedEnvelope.reason),
    );
  }

  if (!response.ok || decodedEnvelope.envelope.ok === false) {
    throw createRequestFailureError(
      normalizedPath,
      responseRequestId,
      response,
      responseBody.responseTextSummary,
      resolveFailureBaseMessage(normalizedPath, decodedStructuredData.data),
    );
  }

  return decodedStructuredData.data;
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

  const decodedStructuredData = decodeStructuredDataValue(responseBody.parseText);
  const responseData = decodedStructuredData.kind === "success" ? decodedStructuredData.data : null;
  throw createRequestFailureError(
    normalizedPath,
    responseRequestId,
    response,
    responseBody.responseTextSummary,
    resolveFailureBaseMessage(normalizedPath, responseData),
  );
}
