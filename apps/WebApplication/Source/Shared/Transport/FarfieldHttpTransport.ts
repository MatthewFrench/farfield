/**
 * Owns HTTP request execution, envelope parsing, and request-failure diagnostics for web data-access modules.
 * Invariant: JSON parsing always uses the full response body; truncation is diagnostic-only.
 */
import { FarfieldApiErrorResponseSchema } from "@farfield/protocol";
import { z } from "zod";
import { type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import {
  StructuredDataValueSchema,
  type StructuredDataValue
} from "@/Shared/Contracts/StructuredDataValue";
import { RequestCanceledError } from "@/Shared/Errors/RequestCanceledError";

const ApiEnvelopeSchema = z
  .object({
    ok: z.boolean()
  })
  .passthrough();

// Thread and capability reads can exceed one minute on cold local agent startup.
// Keep request budgets above that window so startup does not fail into error state.
const REQUEST_TIMEOUT_MS = 120_000;
const REQUEST_ID_HEADER_NAME = "X-Farfield-Request-Id";
const ACTION_ID_HEADER_NAME = "X-Farfield-Action-Id";
const ACTION_NAME_HEADER_NAME = "X-Farfield-Action-Name";
const MAX_RESPONSE_TEXT_LENGTH = 4000;
const ApiErrorEnvelopeSchema = FarfieldApiErrorResponseSchema;

interface ResponseTextSummary {
  responseText: string | null;
  responseTextLength: number | null;
  responseTextTruncated: boolean;
}

interface ResponseBodyReadResult {
  parseText: string | null;
  responseTextSummary: ResponseTextSummary;
}

export interface FarfieldHttpRequestFailureDetails {
  path: string;
  status: number | null;
  statusText: string | null;
  requestId: string | null;
  responseText: string | null;
  responseTextLength: number | null;
  responseTextTruncated: boolean;
}

export class FarfieldHttpRequestFailureError extends Error {
  public readonly requestFailureDetails: FarfieldHttpRequestFailureDetails;

  public constructor(message: string, requestFailureDetails: FarfieldHttpRequestFailureDetails) {
    super(message);
    this.name = "FarfieldHttpRequestFailureError";
    this.requestFailureDetails = requestFailureDetails;
  }
}

function buildFailureMessage(
  baseMessage: string,
  context: FarfieldHttpRequestFailureDetails
): string {
  const statusText = context.statusText?.trim().length ? ` ${context.statusText}` : "";
  const requestId = context.requestId && context.requestId.trim().length > 0 ? context.requestId : null;
  const statusTextParts = [
    "status=",
    String(context.status ?? "n/a"),
    statusText
  ];
  const message = `${baseMessage} ${statusTextParts.join("")}`.trim();
  return appendRequestId(message, requestId);
}

function trimRequestBody(text: string): string {
  const normalized = text.trim();
  if (normalized.length <= MAX_RESPONSE_TEXT_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_RESPONSE_TEXT_LENGTH)}... [truncated]`;
}

function createEmptyResponseTextSummary(): ResponseTextSummary {
  return {
    responseText: null,
    responseTextLength: null,
    responseTextTruncated: false
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
      responseTextTruncated: false
    };
  }

  return {
    responseText: trimRequestBody(normalized),
    responseTextLength: normalized.length,
    responseTextTruncated: true
  };
}

// Parse the full response body for correctness and keep truncation only for diagnostic payloads.
async function readResponseBody(response: Response): Promise<ResponseBodyReadResult> {
  try {
    const rawText = await response.clone().text();
    if (rawText.trim().length === 0) {
      return {
        parseText: null,
        responseTextSummary: createEmptyResponseTextSummary()
      };
    }

    return {
      parseText: rawText,
      responseTextSummary: summarizeResponseText(rawText)
    };
  } catch {
    return {
      parseText: null,
      responseTextSummary: createEmptyResponseTextSummary()
    };
  }
}

function createRequestFailureError(
  path: string,
  requestId: string | null,
  response: Response | null,
  responseTextSummary: ResponseTextSummary,
  baseMessage: string
): FarfieldHttpRequestFailureError {
  const context: FarfieldHttpRequestFailureDetails = {
    path,
    status: response ? response.status : null,
    statusText: response ? response.statusText : null,
    requestId,
    responseText: responseTextSummary.responseText,
    responseTextLength: responseTextSummary.responseTextLength,
    responseTextTruncated: responseTextSummary.responseTextTruncated
  };
  const message = buildFailureMessage(baseMessage, context);
  return new FarfieldHttpRequestFailureError(message, context);
}

function createClientRequestId(): string {
  return `req_${String(Date.now())}_${Math.floor(Math.random() * 1_000_000_000).toString(16)}`;
}

function readResponseRequestId(response: Response): string | null {
  if (!response.headers || typeof response.headers.get !== "function") {
    return null;
  }

  const rawValue = response.headers.get(REQUEST_ID_HEADER_NAME);
  if (!rawValue) {
    return null;
  }
  const normalized = rawValue.trim();
  return normalized.length > 0 ? normalized : null;
}

function appendRequestId(message: string, requestId: string | null): string {
  if (!requestId) {
    return message;
  }
  if (/\brequest(?:Id)?[ =:]+[a-z0-9._-]+/i.test(message)) {
    return message;
  }
  return `${message} requestId ${requestId}`;
}

async function performRequest(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const requestId = createClientRequestId();
  headers.set(REQUEST_ID_HEADER_NAME, requestId);
  let response: Response;
  const timeoutController = new AbortController();
  let didTimeout = false;
  const timeoutHandle = setTimeout(() => {
    didTimeout = true;
    timeoutController.abort();
  }, REQUEST_TIMEOUT_MS);
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
      signal: timeoutController.signal
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.name === "AbortError") {
      if (didTimeout) {
        throw new Error(
          `Request timed out for ${path} after ${String(REQUEST_TIMEOUT_MS)}ms requestId ${requestId}`
        );
      }
      throw new RequestCanceledError(path);
    }
    throw createRequestFailureError(
      path,
      requestId,
      null,
      createEmptyResponseTextSummary(),
      `Request failed for ${path}: ${message}`
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
  const response = await performRequest(path, init);
  const responseRequestId = readResponseRequestId(response);
  const responseBody = await readResponseBody(response);

  let data: StructuredDataValue;
  if (responseBody.parseText === null) {
    throw createRequestFailureError(
      path,
      responseRequestId,
      response,
      responseBody.responseTextSummary,
      `Invalid JSON response from ${path}: empty response`
    );
  }

  try {
    const rawJsonData = JSON.parse(responseBody.parseText);
    data = StructuredDataValueSchema.parse(rawJsonData);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createRequestFailureError(
      path,
      responseRequestId,
      response,
      responseBody.responseTextSummary,
      `Invalid JSON response from ${path}: ${message}`
    );
  }

  let envelope: z.infer<typeof ApiEnvelopeSchema>;
  try {
    envelope = ApiEnvelopeSchema.parse(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createRequestFailureError(
      path,
      responseRequestId,
      response,
      responseBody.responseTextSummary,
      `Invalid API envelope from ${path}: ${message}`
    );
  }

  if (!response.ok || envelope.ok === false) {
    const parsedError = ApiErrorEnvelopeSchema.safeParse(data);
    throw createRequestFailureError(
      path,
      responseRequestId,
      response,
      responseBody.responseTextSummary,
      parsedError.success ? parsedError.data.error : `Request failed for ${path}`
    );
  }

  return data;
}

export async function requestNoContent(path: string, init?: RequestInit): Promise<void> {
  const response = await performRequest(path, init);
  const responseRequestId = readResponseRequestId(response);
  if (response.ok) {
    return;
  }
  const responseBody = await readResponseBody(response);
  if (responseBody.parseText === null) {
    throw createRequestFailureError(
      path,
      responseRequestId,
      response,
      responseBody.responseTextSummary,
      `Request failed for ${path}: empty response`
    );
  }

  let data: StructuredDataValue | null = null;
  try {
    const rawJsonData = JSON.parse(responseBody.parseText);
    const parsedJsonData = StructuredDataValueSchema.safeParse(rawJsonData);
    data = parsedJsonData.success ? parsedJsonData.data : null;
  } catch {
    // Ignore parse failures here and surface status-based failure below.
  }

  const parsedError = ApiErrorEnvelopeSchema.safeParse(data);
  throw createRequestFailureError(
    path,
    responseRequestId,
    response,
    responseBody.responseTextSummary,
    parsedError.success ? parsedError.data.error : `Request failed for ${path}`
  );
}

export function applyRequestOptions(init: RequestInit, options?: ApiRequestOptions): RequestInit {
  if (!options) {
    return init;
  }

  const nextHeaders = new Headers(init.headers);
  if (options.actionId && options.actionId.trim().length > 0) {
    nextHeaders.set(ACTION_ID_HEADER_NAME, options.actionId.trim());
  }
  if (options.actionName && options.actionName.trim().length > 0) {
    nextHeaders.set(ACTION_NAME_HEADER_NAME, options.actionName.trim());
  }

  const nextInit: RequestInit = {
    ...init
  };
  if (options.signal) {
    nextInit.signal = options.signal;
  }

  let hasHeaders = false;
  nextHeaders.forEach(() => {
    hasHeaders = true;
  });
  if (hasHeaders) {
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
