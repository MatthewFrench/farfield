/**
 * Owns debug HTTP boundary parsing, wire-to-contract mapping, and request builders.
 * Invariant: each debug payload is parsed once at this boundary and projected to strict app-owned contracts.
 */
import {
  CreateDebugClientErrorBodySchema,
  FarfieldDebugErrorClearEnvelopeSchema,
  FarfieldDebugErrorCreateEnvelopeSchema,
  FarfieldDebugErrorDetailEnvelopeSchema,
  FarfieldDebugErrorListEnvelopeSchema
} from "@farfield/protocol";
import { z } from "zod";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import {
  applyRequestOptions,
  request,
  requestInitWithOptions,
  requestNoContent
} from "@/Shared/Transport/FarfieldHttpTransport";
import {
  StructuredDataValueSchema,
  type StructuredDataValue
} from "@/Shared/Contracts/StructuredDataValue";

const REQUEST_METHOD_POST = "POST";
const REQUEST_METHOD_DELETE = "DELETE";
const APPLICATION_JSON_CONTENT_TYPE_HEADER_NAME = "Content-Type";
const APPLICATION_JSON_CONTENT_TYPE_HEADER_VALUE = "application/json";
const JSON_CONTENT_TYPE_HEADERS = {
  [APPLICATION_JSON_CONTENT_TYPE_HEADER_NAME]: APPLICATION_JSON_CONTENT_TYPE_HEADER_VALUE
};
const TRACE_STATUS_ENDPOINT = "/api/debug/trace/status";
const TRACE_START_ENDPOINT = "/api/debug/trace/start";
const TRACE_MARK_ENDPOINT = "/api/debug/trace/mark";
const TRACE_STOP_ENDPOINT = "/api/debug/trace/stop";
const HISTORY_LIST_ENDPOINT = "/api/debug/history";
const CLIENT_ERRORS_ENDPOINT = "/api/debug/client-errors";
const REPLAY_ENDPOINT = "/api/debug/replay";
const ROUTE_SEGMENT_SEPARATOR = "/";
const DEBUG_LIST_LIMIT_QUERY_KEY = "limit";
const TRACE_START_LABEL_MAXIMUM_LENGTH = 120;
const TRACE_MARK_NOTE_MAXIMUM_LENGTH = 500;

// Debug list reads can include high-cardinality history and error details.
// Keep the boundary request limit bounded so debug reads remain responsive.
const DebugListLimitSchema = z.number().int().min(1).max(1_000);
const TraceStartLabelSchema = z.string().min(1).max(TRACE_START_LABEL_MAXIMUM_LENGTH);
const TraceMarkNoteSchema = z.string().max(TRACE_MARK_NOTE_MAXIMUM_LENGTH);
const DebugIdentifierSchema = z.string().trim().min(1);
const DEBUG_ERROR_DETAIL_ACTION_IDENTIFIER_KEY = "actionId";
const DEBUG_ERROR_DETAIL_ACTION_NAME_KEY = "actionName";

const TraceSummarySchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string(),
    startedAt: z.string(),
    stoppedAt: z.string().nullable(),
    eventCount: z.number().int().nonnegative(),
    path: z.string().trim().min(1)
  })
  .strip();
const TraceStatusSchema = z
  .object({
    ok: z.literal(true),
    active: TraceSummarySchema.nullable(),
    recent: z.array(TraceSummarySchema)
  })
  .strip();
export type ApiTraceStatusResponse = z.infer<typeof TraceStatusSchema>;

const HistoryEntrySchema = z
  .object({
    id: z.string().trim().min(1),
    at: z.string(),
    source: z.enum(["ipc", "app", "system"]),
    direction: z.enum(["in", "out", "system"]),
    payload: StructuredDataValueSchema.optional(),
    meta: z.record(StructuredDataValueSchema)
  })
  .strip();
const HistoryListSchema = z
  .object({
    ok: z.literal(true),
    history: z.array(HistoryEntrySchema)
  })
  .strip();
export type ApiDebugHistoryResponse = z.infer<typeof HistoryListSchema>;

const HistoryDetailSchema = z
  .object({
    ok: z.literal(true),
    entry: HistoryEntrySchema,
    fullPayload: StructuredDataValueSchema
  })
  .strip();
export type ApiDebugHistoryDetailResponse = z.infer<typeof HistoryDetailSchema>;

const DebugErrorCreateEnvelopeSchema = FarfieldDebugErrorCreateEnvelopeSchema;
export type ApiDebugErrorCreateResponse = z.infer<typeof DebugErrorCreateEnvelopeSchema>;

const DebugErrorClearEnvelopeSchema = FarfieldDebugErrorClearEnvelopeSchema;
export type ApiDebugErrorClearResponse = z.infer<typeof DebugErrorClearEnvelopeSchema>;

const DebugErrorActionIdentifierSchema = z.string().trim().min(1);
const DebugErrorActionNameSchema = z.string().trim().min(1);
const DebugErrorDetailsSchema = z
  .object({
    [DEBUG_ERROR_DETAIL_ACTION_IDENTIFIER_KEY]: DebugErrorActionIdentifierSchema.optional(),
    [DEBUG_ERROR_DETAIL_ACTION_NAME_KEY]: DebugErrorActionNameSchema.optional()
  })
  .catchall(StructuredDataValueSchema);
export type ApiDebugErrorDetails = z.infer<typeof DebugErrorDetailsSchema>;

const DebugErrorEventContractSchema = z
  .object({
    errorId: z.string().trim().min(1),
    sessionId: z.string().trim().min(1),
    origin: z.enum(["client", "server"]),
    source: z.string().trim().min(1),
    operation: z.string().trim().min(1),
    message: z.string().trim().min(1),
    severity: z.enum(["error", "warning"]),
    name: z.string().nullable(),
    stack: z.string().nullable(),
    requestId: z.string().nullable(),
    threadId: z.string().nullable(),
    url: z.string().nullable(),
    occurredAt: z.string().datetime(),
    recordedAt: z.string().datetime(),
    details: DebugErrorDetailsSchema
  })
  .strict();

type DebugErrorEventContract = z.infer<typeof DebugErrorEventContractSchema>;
type DebugErrorEventWire = z.infer<typeof FarfieldDebugErrorListEnvelopeSchema.shape.data.element>;

function mapDebugErrorDetailsWireToContract(
  value: z.infer<typeof FarfieldDebugErrorListEnvelopeSchema.shape.data.element.shape.details>
): ApiDebugErrorDetails {
  const details = z.record(StructuredDataValueSchema).parse(value);
  const actionIdentifierValue = details[DEBUG_ERROR_DETAIL_ACTION_IDENTIFIER_KEY];
  const actionNameValue = details[DEBUG_ERROR_DETAIL_ACTION_NAME_KEY];
  const mappedDetailEntries = Object.entries(details).filter(([detailKey]) =>
    detailKey !== DEBUG_ERROR_DETAIL_ACTION_IDENTIFIER_KEY
    && detailKey !== DEBUG_ERROR_DETAIL_ACTION_NAME_KEY
  );
  const mappedDetails = mappedDetailEntries.reduce<Record<string, StructuredDataValue>>(
    (accumulatedDetails, [detailKey, detailValue]) => ({
      ...accumulatedDetails,
      [detailKey]: detailValue
    }),
    {}
  );
  const mappedDetailsWithActionIdentifier = actionIdentifierValue === undefined
    ? mappedDetails
    : {
        ...mappedDetails,
        [DEBUG_ERROR_DETAIL_ACTION_IDENTIFIER_KEY]:
          DebugErrorActionIdentifierSchema.parse(actionIdentifierValue)
      };
  const mappedDetailsWithActionIdentifierAndName = actionNameValue === undefined
    ? mappedDetailsWithActionIdentifier
    : {
        ...mappedDetailsWithActionIdentifier,
        [DEBUG_ERROR_DETAIL_ACTION_NAME_KEY]: DebugErrorActionNameSchema.parse(actionNameValue)
      };

  return DebugErrorDetailsSchema.parse(mappedDetailsWithActionIdentifierAndName);
}

function mapDebugErrorEventWireToContract(value: DebugErrorEventWire): DebugErrorEventContract {
  return {
    errorId: value.errorId,
    sessionId: value.sessionId,
    origin: value.origin,
    source: value.source,
    operation: value.operation,
    message: value.message,
    severity: value.severity,
    name: value.name,
    stack: value.stack,
    requestId: value.requestId,
    threadId: value.threadId,
    url: value.url,
    occurredAt: value.occurredAt,
    recordedAt: value.recordedAt,
    details: mapDebugErrorDetailsWireToContract(value.details)
  };
}

const DebugErrorEventSchema = FarfieldDebugErrorListEnvelopeSchema.shape.data.element
  .transform(mapDebugErrorEventWireToContract)
  .pipe(DebugErrorEventContractSchema);

const DebugErrorListEnvelopeContractSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(DebugErrorEventSchema),
    sessionId: z.string().trim().min(1),
    sessionLogPath: z.string().trim().min(1)
  })
  .strict();
type DebugErrorListEnvelopeContract = z.infer<typeof DebugErrorListEnvelopeContractSchema>;
export type ApiDebugErrorListResponse = DebugErrorListEnvelopeContract;

function mapDebugErrorListEnvelopeWireToContract(
  value: z.infer<typeof FarfieldDebugErrorListEnvelopeSchema>
): DebugErrorListEnvelopeContract {
  return {
    ok: value.ok,
    data: value.data.map((debugErrorEvent) => DebugErrorEventSchema.parse(debugErrorEvent)),
    sessionId: value.sessionId,
    sessionLogPath: value.sessionLogPath
  };
}

const DebugErrorListEnvelopeSchema = FarfieldDebugErrorListEnvelopeSchema
  .transform(mapDebugErrorListEnvelopeWireToContract)
  .pipe(DebugErrorListEnvelopeContractSchema);

const DebugErrorDetailEnvelopeContractSchema = z
  .object({
    ok: z.literal(true),
    error: DebugErrorEventSchema,
    sessionId: z.string().trim().min(1),
    sessionLogPath: z.string().trim().min(1)
  })
  .strict();
type DebugErrorDetailEnvelopeContract = z.infer<typeof DebugErrorDetailEnvelopeContractSchema>;
export type ApiDebugErrorDetailResponse = DebugErrorDetailEnvelopeContract;

function mapDebugErrorDetailEnvelopeWireToContract(
  value: z.infer<typeof FarfieldDebugErrorDetailEnvelopeSchema>
): DebugErrorDetailEnvelopeContract {
  return {
    ok: value.ok,
    error: DebugErrorEventSchema.parse(value.error),
    sessionId: value.sessionId,
    sessionLogPath: value.sessionLogPath
  };
}

const DebugErrorDetailEnvelopeSchema = FarfieldDebugErrorDetailEnvelopeSchema
  .transform(mapDebugErrorDetailEnvelopeWireToContract)
  .pipe(DebugErrorDetailEnvelopeContractSchema);

const ReplayHistoryEntryInputSchema = z
  .object({
    entryId: z.string().trim().min(1),
    waitForResponse: z.boolean()
  })
  .strict();

const ReplayHistoryEntryResponseSchema = z
  .object({
    ok: z.literal(true),
    replayed: z.literal(true),
    queued: z.boolean().optional(),
    response: z.record(StructuredDataValueSchema).optional()
  })
  .strict();
export type ApiReplayHistoryEntryResponse = z.infer<typeof ReplayHistoryEntryResponseSchema>;
export type ApiReplayHistoryEntryInput = z.infer<typeof ReplayHistoryEntryInputSchema>;

export type ApiCreateDebugClientErrorInput = z.infer<typeof CreateDebugClientErrorBodySchema>;
export const DEFAULT_DEBUG_LIST_LIMIT = 120;

function buildListRequestPath(endpoint: string, limit: number): string {
  const parsedLimit = DebugListLimitSchema.parse(limit);
  return `${endpoint}?${DEBUG_LIST_LIMIT_QUERY_KEY}=${String(parsedLimit)}`;
}

function buildMemberRequestPath(endpoint: string, identifier: string): string {
  const parsedIdentifier = DebugIdentifierSchema.parse(identifier);
  return `${endpoint}${ROUTE_SEGMENT_SEPARATOR}${encodeURIComponent(parsedIdentifier)}`;
}

function buildJsonPostRequestInit(bodyText: string, options?: ApiRequestOptions): RequestInit {
  return applyRequestOptions(
    {
      method: REQUEST_METHOD_POST,
      headers: JSON_CONTENT_TYPE_HEADERS,
      body: bodyText
    },
    options
  );
}

function buildDeleteRequestInit(options?: ApiRequestOptions): RequestInit {
  return applyRequestOptions(
    {
      method: REQUEST_METHOD_DELETE
    },
    options
  );
}

export async function getTraceStatus(options?: ApiRequestOptions): Promise<ApiTraceStatusResponse> {
  const data = await request(TRACE_STATUS_ENDPOINT, requestInitWithOptions(options));
  return TraceStatusSchema.parse(data);
}

export async function startTrace(label: string, options?: ApiRequestOptions): Promise<void> {
  const parsedLabel = TraceStartLabelSchema.parse(label);
  await requestNoContent(
    TRACE_START_ENDPOINT,
    buildJsonPostRequestInit(JSON.stringify({ label: parsedLabel }), options)
  );
}

export async function markTrace(note: string, options?: ApiRequestOptions): Promise<void> {
  const parsedNote = TraceMarkNoteSchema.parse(note);
  await requestNoContent(
    TRACE_MARK_ENDPOINT,
    buildJsonPostRequestInit(JSON.stringify({ note: parsedNote }), options)
  );
}

export async function stopTrace(options?: ApiRequestOptions): Promise<void> {
  await requestNoContent(
    TRACE_STOP_ENDPOINT,
    buildJsonPostRequestInit("{}", options)
  );
}

export async function listDebugHistory(
  limit = DEFAULT_DEBUG_LIST_LIMIT,
  options?: ApiRequestOptions
): Promise<ApiDebugHistoryResponse> {
  const data = await request(buildListRequestPath(HISTORY_LIST_ENDPOINT, limit), requestInitWithOptions(options));
  return HistoryListSchema.parse(data);
}

export async function getHistoryEntry(
  entryId: string,
  options?: ApiRequestOptions
): Promise<ApiDebugHistoryDetailResponse> {
  const data = await request(buildMemberRequestPath(HISTORY_LIST_ENDPOINT, entryId), requestInitWithOptions(options));
  return HistoryDetailSchema.parse(data);
}

export async function createDebugClientError(
  input: ApiCreateDebugClientErrorInput,
  options?: ApiRequestOptions
): Promise<ApiDebugErrorCreateResponse> {
  const body = CreateDebugClientErrorBodySchema.parse(input);
  const data = await request(
    CLIENT_ERRORS_ENDPOINT,
    buildJsonPostRequestInit(JSON.stringify(body), options)
  );
  return DebugErrorCreateEnvelopeSchema.parse(data);
}

export async function listDebugClientErrors(
  limit = DEFAULT_DEBUG_LIST_LIMIT,
  options?: ApiRequestOptions
): Promise<ApiDebugErrorListResponse> {
  const data = await request(
    buildListRequestPath(CLIENT_ERRORS_ENDPOINT, limit),
    requestInitWithOptions(options)
  );
  return DebugErrorListEnvelopeSchema.parse(data);
}

export async function getDebugClientError(
  errorId: string,
  options?: ApiRequestOptions
): Promise<ApiDebugErrorDetailResponse> {
  const data = await request(buildMemberRequestPath(CLIENT_ERRORS_ENDPOINT, errorId), requestInitWithOptions(options));
  return DebugErrorDetailEnvelopeSchema.parse(data);
}

export async function clearDebugClientErrors(
  options?: ApiRequestOptions
): Promise<ApiDebugErrorClearResponse> {
  const data = await request(CLIENT_ERRORS_ENDPOINT, buildDeleteRequestInit(options));
  return DebugErrorClearEnvelopeSchema.parse(data);
}

export async function replayHistoryEntry(
  input: ApiReplayHistoryEntryInput,
  options?: ApiRequestOptions
): Promise<ApiReplayHistoryEntryResponse> {
  const body = ReplayHistoryEntryInputSchema.parse(input);
  const data = await request(REPLAY_ENDPOINT, buildJsonPostRequestInit(JSON.stringify(body), options));
  return ReplayHistoryEntryResponseSchema.parse(data);
}
