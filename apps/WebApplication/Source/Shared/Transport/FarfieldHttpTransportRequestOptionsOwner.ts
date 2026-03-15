/**
 * Owns request option normalization and action metadata header shaping for transport calls.
 */
import {
  type ApiRequestHeaderOptions,
  ApiRequestHeaderOptionsSchema,
  type ApiRequestOptions,
} from "@/Shared/Contracts/ApiContracts";
import {
  ACTION_ID_HEADER_NAME,
  ACTION_NAME_HEADER_NAME,
} from "@/Shared/Contracts/RequestMetadataContracts";

function readValidatedRequestHeaderOptions(options: ApiRequestOptions): ApiRequestHeaderOptions {
  return ApiRequestHeaderOptionsSchema.parse({
    actionId: options.actionId,
    actionName: options.actionName,
  });
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

  const nextRequestInit: RequestInit = {
    ...init,
  };
  if (options.signal !== undefined) {
    nextRequestInit.signal = options.signal;
  }

  const hasRequestOptionHeaders =
    validatedRequestHeaderOptions.actionId !== undefined ||
    validatedRequestHeaderOptions.actionName !== undefined;
  if (init.headers !== undefined || hasRequestOptionHeaders) {
    nextRequestInit.headers = nextHeaders;
  }

  return nextRequestInit;
}

export function requestInitWithOptions(options?: ApiRequestOptions): RequestInit | undefined {
  if (!options) {
    return undefined;
  }

  const nextRequestInit = applyRequestOptions({}, options);
  return Object.keys(nextRequestInit).length > 0 ? nextRequestInit : undefined;
}
