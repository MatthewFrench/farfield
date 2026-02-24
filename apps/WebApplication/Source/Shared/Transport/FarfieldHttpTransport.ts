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

const REQUEST_TIMEOUT_MS = 30_000;
const REQUEST_ID_HEADER_NAME = "X-Farfield-Request-Id";
const ACTION_ID_HEADER_NAME = "X-Farfield-Action-Id";
const ACTION_NAME_HEADER_NAME = "X-Farfield-Action-Name";
const ApiErrorEnvelopeSchema = FarfieldApiErrorResponseSchema;

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
    throw new Error(`Request failed for ${path}: ${message} requestId ${requestId}`);
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

  let data: StructuredDataValue;
  try {
    const rawJsonData = await response.json();
    data = StructuredDataValueSchema.parse(rawJsonData);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(appendRequestId(`Invalid JSON response from ${path}: ${message}`, responseRequestId));
  }

  let envelope: z.infer<typeof ApiEnvelopeSchema>;
  try {
    envelope = ApiEnvelopeSchema.parse(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(appendRequestId(`Invalid API envelope from ${path}: ${message}`, responseRequestId));
  }

  if (!response.ok || envelope.ok === false) {
    const parsedError = ApiErrorEnvelopeSchema.safeParse(data);
    throw new Error(
      appendRequestId(parsedError.success ? parsedError.data.error : `Request failed for ${path}`, responseRequestId)
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

  let data: StructuredDataValue | null = null;
  try {
    const rawJsonData = await response.json();
    const parsedJsonData = StructuredDataValueSchema.safeParse(rawJsonData);
    data = parsedJsonData.success ? parsedJsonData.data : null;
  } catch {
    // Ignore parse failures here and surface status-based failure below.
  }

  const parsedError = ApiErrorEnvelopeSchema.safeParse(data);
  throw new Error(
    appendRequestId(parsedError.success ? parsedError.data.error : `Request failed for ${path}`, responseRequestId)
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
