/**
 * Owns HTTP request execution, envelope parsing, and request-failure diagnostics for web data-access modules.
 * Invariant: JSON parsing always uses the full response body; truncation is diagnostic-only.
 */
import { FarfieldApiErrorResponseSchema } from "@farfield/protocol";
import { z } from "zod";
import {
  type ApiRequestHeaderOptions,
  ApiRequestHeaderOptionsSchema,
  type ApiRequestOptions,
} from "@/Shared/Contracts/ApiContracts";
import { type FarfieldHttpRequestFailureDetails } from "@/Shared/Contracts/FarfieldHttpRequestFailureDetails";
import {
  ACTION_ID_HEADER_NAME,
  ACTION_NAME_HEADER_NAME,
  REQUEST_ID_HEADER_NAME,
  REQUEST_ID_LABEL,
  RequestIdentifierInMessagePattern,
} from "@/Shared/Contracts/RequestMetadataContracts";
import {
  type StructuredDataValue,
  StructuredDataValueSchema,
} from "@/Shared/Contracts/StructuredDataValue";
import { RequestCanceledError } from "@/Shared/Errors/RequestCanceledError";

const ApiEnvelopeSchema = z
  .object({
    ok: z.boolean(),
  })
  .passthrough();
type ApiEnvelope = z.infer<typeof ApiEnvelopeSchema>;

// Thread and capability reads can exceed one minute on cold local agent startup.
// Keep request budgets above that window so startup does not fail into error state.
const REQUEST_TIMEOUT_MILLISECONDS = 120_000;
const MAX_RESPONSE_TEXT_LENGTH = 4_000;
const RESPONSE_TEXT_TRUNCATION_SUFFIX = "... [truncated]";
const REQUEST_FAILURE_ERROR_NAME = "FarfieldHttpRequestFailureError";
const REQUEST_FAILURE_MESSAGE_PREFIX = "Request failed for";
const INVALID_JSON_RESPONSE_MESSAGE_PREFIX = "Invalid JSON response from";
const INVALID_API_ENVELOPE_MESSAGE_PREFIX = "Invalid API envelope from";
const REQUEST_TIMEOUT_MESSAGE_PREFIX = "Request timed out for";
const EMPTY_RESPONSE_REASON = "empty response";
const STATUS_LABEL = "status=";
const MISSING_STATUS_LABEL = "n/a";
const FETCH_ABORT_ERROR_NAME = "AbortError";
const CLIENT_REQUEST_ID_RANDOM_MAX_EXCLUSIVE = 1_000_000_000;
const CLIENT_REQUEST_ID_HEX_RADIX = 16;
const ApiErrorEnvelopeSchema = FarfieldApiErrorResponseSchema;
const RequestPathSchema = z.string().trim().min(1, "Request path must not be blank.");

interface ResponseTextSummary {
  responseText: string | null;
  responseTextLength: number | null;
  responseTextTruncated: boolean;
}

interface ResponseBodyReadResult {
  parseText: string | null;
  responseTextSummary: ResponseTextSummary;
}

interface StructuredDataDecodeSuccess {
  kind: "success";
  data: StructuredDataValue;
}

interface StructuredDataDecodeFailure {
  kind: "failure";
  reason: string;
}

type StructuredDataDecodeResult = StructuredDataDecodeSuccess | StructuredDataDecodeFailure;

interface ApiEnvelopeDecodeSuccess {
  kind: "success";
  envelope: ApiEnvelope;
}

interface ApiEnvelopeDecodeFailure {
  kind: "failure";
  reason: string;
}

type ApiEnvelopeDecodeResult = ApiEnvelopeDecodeSuccess | ApiEnvelopeDecodeFailure;

export class FarfieldHttpRequestFailureError extends Error {
  public readonly requestFailureDetails: FarfieldHttpRequestFailureDetails;

  public constructor(message: string, requestFailureDetails: FarfieldHttpRequestFailureDetails) {
    super(message);
    this.name = REQUEST_FAILURE_ERROR_NAME;
    this.requestFailureDetails = requestFailureDetails;
  }
}

function readNonEmptyTrimmedText(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.length === 0) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRequestPath(path: string): string {
  return RequestPathSchema.parse(path);
}

function readValidatedRequestHeaderOptions(options: ApiRequestOptions): ApiRequestHeaderOptions {
  return ApiRequestHeaderOptionsSchema.parse({
    actionId: options.actionId,
    actionName: options.actionName,
  });
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
  const normalized = text.trim();
  if (normalized.length <= MAX_RESPONSE_TEXT_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_RESPONSE_TEXT_LENGTH)}${RESPONSE_TEXT_TRUNCATION_SUFFIX}`;
}

function createEmptyResponseTextSummary(): ResponseTextSummary {
  return {
    responseText: null,
    responseTextLength: null,
    responseTextTruncated: false,
  };
}

function summarizeResponseText(rawText: string): ResponseTextSummary {
  const normalized = rawText.trim();
  if (normalized.length === 0) {
    return createEmptyResponseTextSummary();
  }

  if (normalized.length <= MAX_RESPONSE_TEXT_LENGTH) {
    return {
      responseText: normalized,
      responseTextLength: normalized.length,
      responseTextTruncated: false,
    };
  }

  return {
    responseText: trimRequestBody(normalized),
    responseTextLength: normalized.length,
    responseTextTruncated: true,
  };
}

// Parse the full response body for correctness and keep truncation only for diagnostic payloads.
async function readResponseBody(response: Response): Promise<ResponseBodyReadResult> {
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

function decodeStructuredDataValue(parseText: string): StructuredDataDecodeResult {
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

function decodeApiEnvelope(data: StructuredDataValue): ApiEnvelopeDecodeResult {
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

function buildInvalidJsonResponseMessage(path: string, reason: string): string {
  return `${INVALID_JSON_RESPONSE_MESSAGE_PREFIX} ${path}: ${reason}`;
}

function buildInvalidApiEnvelopeMessage(path: string, reason: string): string {
  return `${INVALID_API_ENVELOPE_MESSAGE_PREFIX} ${path}: ${reason}`;
}

function createRequestFailureError(
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

function createClientRequestId(): string {
  return `req_${String(Date.now())}_${Math.floor(Math.random() * CLIENT_REQUEST_ID_RANDOM_MAX_EXCLUSIVE).toString(CLIENT_REQUEST_ID_HEX_RADIX)}`;
}

function readResponseRequestId(response: Response): string | null {
  const rawValue = response.headers.get(REQUEST_ID_HEADER_NAME);
  return readNonEmptyTrimmedText(rawValue);
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

function buildRequestFailureMessage(path: string): string {
  return `${REQUEST_FAILURE_MESSAGE_PREFIX} ${path}`;
}

function buildRequestFailureMessageWithReason(path: string, reason: string): string {
  return `${buildRequestFailureMessage(path)}: ${reason}`;
}

function buildTimeoutErrorMessage(path: string, requestId: string): string {
  return `${REQUEST_TIMEOUT_MESSAGE_PREFIX} ${path} after ${String(REQUEST_TIMEOUT_MILLISECONDS)}ms ${REQUEST_ID_LABEL} ${requestId}`;
}

function isAbortError(error: Error): boolean {
  return error.name === FETCH_ABORT_ERROR_NAME;
}

// Parse strict error envelopes only; extra keys are treated as contract drift and revert to generic failures.
function readApiErrorMessage(data: StructuredDataValue | null): string | null {
  if (data === null) {
    return null;
  }
  const parsedError = ApiErrorEnvelopeSchema.safeParse(data);
  return parsedError.success ? parsedError.data.error : null;
}

function resolveFailureBaseMessage(path: string, data: StructuredDataValue | null): string {
  const apiErrorMessage = readApiErrorMessage(data);
  return apiErrorMessage ?? buildRequestFailureMessage(path);
}

// Timeout semantics: the request budget starts when fetch is dispatched, and timeout aborts are
// treated differently from caller-signal aborts so cancellation reporting stays deterministic.
async function performRequest(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const requestId = createClientRequestId();
  headers.set(REQUEST_ID_HEADER_NAME, requestId);
  let response: Response;
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
      inheritedSignal.addEventListener("abort", onAbortInheritedSignal, { once: true });
    }
  }
  try {
    response = await fetch(path, {
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
  return response;
}

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
  const data = decodedStructuredData.data;

  const decodedEnvelope = decodeApiEnvelope(data);
  if (decodedEnvelope.kind === "failure") {
    throw createRequestFailureError(
      normalizedPath,
      responseRequestId,
      response,
      responseBody.responseTextSummary,
      buildInvalidApiEnvelopeMessage(normalizedPath, decodedEnvelope.reason),
    );
  }
  const envelope = decodedEnvelope.envelope;

  if (!response.ok || envelope.ok === false) {
    throw createRequestFailureError(
      normalizedPath,
      responseRequestId,
      response,
      responseBody.responseTextSummary,
      resolveFailureBaseMessage(normalizedPath, data),
    );
  }

  return data;
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
  const data = decodedStructuredData.kind === "success" ? decodedStructuredData.data : null;
  throw createRequestFailureError(
    normalizedPath,
    responseRequestId,
    response,
    responseBody.responseTextSummary,
    resolveFailureBaseMessage(normalizedPath, data),
  );
}

export function applyRequestOptions(init: RequestInit, options?: ApiRequestOptions): RequestInit {
  if (!options) {
    return init;
  }

  const validatedRequestHeaderOptions = readValidatedRequestHeaderOptions(options);
  const nextHeaders = new Headers(init.headers);
  if (validatedRequestHeaderOptions.actionId !== undefined) {
    nextHeaders.set(ACTION_ID_HEADER_NAME, validatedRequestHeaderOptions.actionId);
  }
  if (validatedRequestHeaderOptions.actionName !== undefined) {
    nextHeaders.set(ACTION_NAME_HEADER_NAME, validatedRequestHeaderOptions.actionName);
  }

  const nextInit: RequestInit = {
    ...init,
  };
  if (options.signal) {
    nextInit.signal = options.signal;
  }

  const hasRequestOptionHeaders =
    validatedRequestHeaderOptions.actionId !== undefined ||
    validatedRequestHeaderOptions.actionName !== undefined;
  if (init.headers !== undefined || hasRequestOptionHeaders) {
    nextInit.headers = nextHeaders;
  }

  return nextInit;
}

export function requestInitWithOptions(options?: ApiRequestOptions): RequestInit | undefined {
  if (!options) {
    return undefined;
  }
  const nextInit = applyRequestOptions({}, options);
  return Object.keys(nextInit).length > 0 ? nextInit : undefined;
}
