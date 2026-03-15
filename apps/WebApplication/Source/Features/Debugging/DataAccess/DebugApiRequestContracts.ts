/**
 * Owns debug endpoint tokens and request-builder contracts.
 * Invariant: all path inputs are validated before transport dispatch.
 */
import { z } from "zod";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { applyRequestOptions } from "@/Shared/Transport/FarfieldHttpTransport";

const REQUEST_METHOD_POST = "POST";
const REQUEST_METHOD_DELETE = "DELETE";
const APPLICATION_JSON_CONTENT_TYPE_HEADER_NAME = "Content-Type";
const APPLICATION_JSON_CONTENT_TYPE_HEADER_VALUE = "application/json";
const JSON_CONTENT_TYPE_HEADERS = {
  [APPLICATION_JSON_CONTENT_TYPE_HEADER_NAME]: APPLICATION_JSON_CONTENT_TYPE_HEADER_VALUE,
};
const ROUTE_SEGMENT_SEPARATOR = "/";
const DEBUG_LIST_LIMIT_QUERY_KEY = "limit";
const TRACE_START_LABEL_MAXIMUM_LENGTH = 120;
const TRACE_MARK_NOTE_MAXIMUM_LENGTH = 500;

export const TRACE_STATUS_ENDPOINT = "/api/debug/trace/status";
export const TRACE_START_ENDPOINT = "/api/debug/trace/start";
export const TRACE_MARK_ENDPOINT = "/api/debug/trace/mark";
export const TRACE_STOP_ENDPOINT = "/api/debug/trace/stop";
export const HISTORY_LIST_ENDPOINT = "/api/debug/history";
export const CLIENT_ERRORS_ENDPOINT = "/api/debug/client-errors";
export const REPLAY_ENDPOINT = "/api/debug/replay";

export const DEFAULT_DEBUG_LIST_LIMIT = 120;

// Debug list reads can include high-cardinality history and error details.
// Keep the boundary request limit bounded so debug reads remain responsive.
const DebugListLimitSchema = z.number().int().min(1).max(1_000);
const TraceStartLabelSchema = z.string().min(1).max(TRACE_START_LABEL_MAXIMUM_LENGTH);
const TraceMarkNoteSchema = z.string().max(TRACE_MARK_NOTE_MAXIMUM_LENGTH);
const DebugIdentifierSchema = z.string().trim().min(1);

export function parseTraceStartLabel(label: string): string {
  return TraceStartLabelSchema.parse(label);
}

export function parseTraceMarkNote(note: string): string {
  return TraceMarkNoteSchema.parse(note);
}

export function buildListRequestPath(endpoint: string, limit: number): string {
  const parsedLimit = DebugListLimitSchema.parse(limit);
  return `${endpoint}?${DEBUG_LIST_LIMIT_QUERY_KEY}=${String(parsedLimit)}`;
}

export function buildMemberRequestPath(endpoint: string, identifier: string): string {
  const parsedIdentifier = DebugIdentifierSchema.parse(identifier);
  return `${endpoint}${ROUTE_SEGMENT_SEPARATOR}${encodeURIComponent(parsedIdentifier)}`;
}

export function buildJsonPostRequestInit(
  bodyText: string,
  options?: ApiRequestOptions,
): RequestInit {
  return applyRequestOptions(
    {
      method: REQUEST_METHOD_POST,
      headers: JSON_CONTENT_TYPE_HEADERS,
      body: bodyText,
    },
    options,
  );
}

export function buildDeleteRequestInit(options?: ApiRequestOptions): RequestInit {
  return applyRequestOptions(
    {
      method: REQUEST_METHOD_DELETE,
    },
    options,
  );
}
