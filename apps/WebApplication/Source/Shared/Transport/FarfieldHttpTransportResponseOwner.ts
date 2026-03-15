/**
 * Owns response-body parsing, envelope decoding, and request-failure message construction.
 */
import { FarfieldApiErrorResponseSchema } from "@farfield/protocol";
import { z } from "zod";
import type { FarfieldHttpRequestFailureDetails } from "@/Shared/Contracts/FarfieldHttpRequestFailureDetails";
import {
  REQUEST_ID_HEADER_NAME,
  REQUEST_ID_LABEL,
  RequestIdentifierInMessagePattern,
} from "@/Shared/Contracts/RequestMetadataContracts";
import {
  type StructuredDataValue,
  StructuredDataValueSchema,
} from "@/Shared/Contracts/StructuredDataValue";
import { FarfieldHttpRequestFailureError } from "./FarfieldHttpRequestFailureError";

const ApiEnvelopeSchema = z
  .object({
    ok: z.boolean(),
  })
  .passthrough();

type ApiEnvelope = z.infer<typeof ApiEnvelopeSchema>;

const MAX_RESPONSE_TEXT_LENGTH = 4_000;
const RESPONSE_TEXT_TRUNCATION_SUFFIX = "... [truncated]";
const REQUEST_FAILURE_MESSAGE_PREFIX = "Request failed for";
const INVALID_JSON_RESPONSE_MESSAGE_PREFIX = "Invalid JSON response from";
const INVALID_API_ENVELOPE_MESSAGE_PREFIX = "Invalid API envelope from";
const STATUS_LABEL = "status=";
const MISSING_STATUS_LABEL = "n/a";

export const EMPTY_RESPONSE_REASON = "empty response";

interface StructuredDataDecodeSuccess {
  kind: "success";
  data: StructuredDataValue;
}

interface StructuredDataDecodeFailure {
  kind: "failure";
  reason: string;
}

export type StructuredDataDecodeResult = StructuredDataDecodeSuccess | StructuredDataDecodeFailure;

interface ApiEnvelopeDecodeSuccess {
  kind: "success";
  envelope: ApiEnvelope;
}

interface ApiEnvelopeDecodeFailure {
  kind: "failure";
  reason: string;
}

export type ApiEnvelopeDecodeResult = ApiEnvelopeDecodeSuccess | ApiEnvelopeDecodeFailure;

export interface ResponseTextSummary {
  responseText: string | null;
  responseTextLength: number | null;
  responseTextTruncated: boolean;
}

export interface ResponseBodyReadResult {
  parseText: string | null;
  responseTextSummary: ResponseTextSummary;
}

function readNonEmptyTrimmedText(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.length === 0) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function appendRequestId(message: string, requestId: string | null): string {
  if (requestId === null || requestId.length === 0) {
    return message;
  }

  if (RequestIdentifierInMessagePattern.test(message)) {
    return message;
  }

  return `${message} ${REQUEST_ID_LABEL} ${requestId}`;
}

function buildFailureMessage(
  baseMessage: string,
  context: FarfieldHttpRequestFailureDetails,
): string {
  const statusTextValue = readNonEmptyTrimmedText(context.statusText);
  const statusText = statusTextValue === null ? "" : ` ${statusTextValue}`;
  const requestId = readNonEmptyTrimmedText(context.requestId);
  const status = String(context.status ?? MISSING_STATUS_LABEL);
  const message = `${baseMessage} ${STATUS_LABEL}${status}${statusText}`.trim();
  return appendRequestId(message, requestId);
}

function trimRequestBody(text: string): string {
  const normalizedText = text.trim();
  if (normalizedText.length <= MAX_RESPONSE_TEXT_LENGTH) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, MAX_RESPONSE_TEXT_LENGTH)}${RESPONSE_TEXT_TRUNCATION_SUFFIX}`;
}

export function createEmptyResponseTextSummary(): ResponseTextSummary {
  return {
    responseText: null,
    responseTextLength: null,
    responseTextTruncated: false,
  };
}

function summarizeResponseText(rawText: string): ResponseTextSummary {
  const normalizedText = rawText.trim();
  if (normalizedText.length === 0) {
    return createEmptyResponseTextSummary();
  }

  if (normalizedText.length <= MAX_RESPONSE_TEXT_LENGTH) {
    return {
      responseText: normalizedText,
      responseTextLength: normalizedText.length,
      responseTextTruncated: false,
    };
  }

  return {
    responseText: trimRequestBody(normalizedText),
    responseTextLength: normalizedText.length,
    responseTextTruncated: true,
  };
}

// Parse the full response body for correctness and keep truncation only for diagnostic payloads.
export async function readResponseBody(response: Response): Promise<ResponseBodyReadResult> {
  try {
    const rawText = await response.clone().text();
    if (rawText.trim().length === 0) {
      return {
        parseText: null,
        responseTextSummary: createEmptyResponseTextSummary(),
      };
    }

    return {
      parseText: rawText,
      responseTextSummary: summarizeResponseText(rawText),
    };
  } catch {
    return {
      parseText: null,
      responseTextSummary: createEmptyResponseTextSummary(),
    };
  }
}

export function decodeStructuredDataValue(parseText: string): StructuredDataDecodeResult {
  try {
    const rawJsonData = JSON.parse(parseText);
    const parsedStructuredData = StructuredDataValueSchema.safeParse(rawJsonData);
    if (!parsedStructuredData.success) {
      return {
        kind: "failure",
        reason: parsedStructuredData.error.message,
      };
    }

    return {
      kind: "success",
      data: parsedStructuredData.data,
    };
  } catch (error) {
    return {
      kind: "failure",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function decodeApiEnvelope(data: StructuredDataValue): ApiEnvelopeDecodeResult {
  const parsedEnvelope = ApiEnvelopeSchema.safeParse(data);
  if (!parsedEnvelope.success) {
    return {
      kind: "failure",
      reason: parsedEnvelope.error.message,
    };
  }

  return {
    kind: "success",
    envelope: parsedEnvelope.data,
  };
}

export function buildInvalidJsonResponseMessage(path: string, reason: string): string {
  return `${INVALID_JSON_RESPONSE_MESSAGE_PREFIX} ${path}: ${reason}`;
}

export function buildInvalidApiEnvelopeMessage(path: string, reason: string): string {
  return `${INVALID_API_ENVELOPE_MESSAGE_PREFIX} ${path}: ${reason}`;
}

export function buildRequestFailureMessage(path: string): string {
  return `${REQUEST_FAILURE_MESSAGE_PREFIX} ${path}`;
}

export function buildRequestFailureMessageWithReason(path: string, reason: string): string {
  return `${buildRequestFailureMessage(path)}: ${reason}`;
}

export function createRequestFailureError(
  path: string,
  requestId: string | null,
  response: Response | null,
  responseTextSummary: ResponseTextSummary,
  baseMessage: string,
): FarfieldHttpRequestFailureError {
  const context: FarfieldHttpRequestFailureDetails = {
    path,
    status: response ? response.status : null,
    statusText: response ? response.statusText : null,
    requestId,
    responseText: responseTextSummary.responseText,
    responseTextLength: responseTextSummary.responseTextLength,
    responseTextTruncated: responseTextSummary.responseTextTruncated,
  };
  const message = buildFailureMessage(baseMessage, context);
  return new FarfieldHttpRequestFailureError(message, context);
}

function readApiErrorMessage(data: StructuredDataValue | null): string | null {
  if (data === null) {
    return null;
  }

  const parsedError = FarfieldApiErrorResponseSchema.safeParse(data);
  return parsedError.success ? parsedError.data.error : null;
}

export function resolveFailureBaseMessage(path: string, data: StructuredDataValue | null): string {
  const apiErrorMessage = readApiErrorMessage(data);
  return apiErrorMessage ?? buildRequestFailureMessage(path);
}

export function readResponseRequestId(response: Response): string | null {
  const rawRequestIdentifier = response.headers.get(REQUEST_ID_HEADER_NAME);
  return readNonEmptyTrimmedText(rawRequestIdentifier);
}
