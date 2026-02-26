import {
  FarfieldDebugErrorClearEnvelopeSchema,
  CreateDebugClientErrorBodySchema,
  FarfieldDebugErrorCreateEnvelopeSchema
} from "@farfield/protocol";
import { z } from "zod";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import {
  applyRequestOptions,
  request,
  requestInitWithOptions,
  requestNoContent
} from "@/Shared/Transport/FarfieldHttpTransport";
import { StructuredDataValueSchema } from "@/Shared/Contracts/StructuredDataValue";

const JSON_CONTENT_TYPE_HEADERS = {
  "Content-Type": "application/json"
};
const TRACE_STATUS_ENDPOINT = "/api/debug/trace/status";
const TRACE_START_ENDPOINT = "/api/debug/trace/start";
const TRACE_MARK_ENDPOINT = "/api/debug/trace/mark";
const TRACE_STOP_ENDPOINT = "/api/debug/trace/stop";
const HISTORY_LIST_ENDPOINT = "/api/debug/history";
const CLIENT_ERRORS_ENDPOINT = "/api/debug/client-errors";
const REPLAY_ENDPOINT = "/api/debug/replay";
const DebugListLimitSchema = z.number().int().min(1).max(1_000);
const DEBUG_ERROR_DETAIL_ACTION_IDENTIFIER_KEY = "actionId";
const DEBUG_ERROR_DETAIL_ACTION_NAME_KEY = "actionName";

const TraceStatusSchema = z
  .object({
    ok: z.literal(true),
    active: z
      .object({
        id: z.string(),
        label: z.string(),
        startedAt: z.string(),
        stoppedAt: z.string().nullable(),
        eventCount: z.number().int().nonnegative(),
        path: z.string()
      })
      .nullable(),
    recent: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        startedAt: z.string(),
        stoppedAt: z.string().nullable(),
        eventCount: z.number().int().nonnegative(),
        path: z.string()
      })
    )
  })
  .passthrough();
export type ApiTraceStatusResponse = z.infer<typeof TraceStatusSchema>;

const HistoryListSchema = z
  .object({
    ok: z.literal(true),
    history: z.array(
      z.object({
        id: z.string(),
        at: z.string(),
        source: z.enum(["ipc", "app", "system"]),
        direction: z.enum(["in", "out", "system"]),
        payload: StructuredDataValueSchema.optional(),
        meta: z.record(StructuredDataValueSchema)
      })
    )
  })
  .passthrough();
export type ApiDebugHistoryResponse = z.infer<typeof HistoryListSchema>;

const HistoryDetailSchema = z
  .object({
    ok: z.literal(true),
    entry: HistoryListSchema.shape.history.element,
    fullPayload: StructuredDataValueSchema
  })
  .passthrough();
export type ApiDebugHistoryDetailResponse = z.infer<typeof HistoryDetailSchema>;

const DebugErrorCreateEnvelopeSchema = FarfieldDebugErrorCreateEnvelopeSchema;
export type ApiDebugErrorCreateResponse = z.infer<typeof DebugErrorCreateEnvelopeSchema>;

const DebugErrorClearEnvelopeSchema = FarfieldDebugErrorClearEnvelopeSchema;
export type ApiDebugErrorClearResponse = z.infer<typeof DebugErrorClearEnvelopeSchema>;

const DebugErrorDetailsSchema = z
  .object({
    [DEBUG_ERROR_DETAIL_ACTION_IDENTIFIER_KEY]: z.string().trim().min(1).optional(),
    [DEBUG_ERROR_DETAIL_ACTION_NAME_KEY]: z.string().trim().min(1).optional()
  })
  .catchall(StructuredDataValueSchema);
export type ApiDebugErrorDetails = z.infer<typeof DebugErrorDetailsSchema>;

const DebugErrorEventSchema = z
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

const DebugErrorListEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(DebugErrorEventSchema),
    sessionId: z.string().trim().min(1),
    sessionLogPath: z.string().trim().min(1)
  })
  .strict();
export type ApiDebugErrorListResponse = z.infer<typeof DebugErrorListEnvelopeSchema>;

const DebugErrorDetailEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    error: DebugErrorEventSchema,
    sessionId: z.string().trim().min(1),
    sessionLogPath: z.string().trim().min(1)
  })
  .strict();
export type ApiDebugErrorDetailResponse = z.infer<typeof DebugErrorDetailEnvelopeSchema>;

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
    response: z.object({}).passthrough().optional()
  })
  .strict();
export type ApiReplayHistoryEntryResponse = z.infer<typeof ReplayHistoryEntryResponseSchema>;
export type ApiReplayHistoryEntryInput = z.infer<typeof ReplayHistoryEntryInputSchema>;

export type ApiCreateDebugClientErrorInput = z.infer<typeof CreateDebugClientErrorBodySchema>;
export const DEFAULT_DEBUG_LIST_LIMIT = 120;

export async function getTraceStatus(options?: ApiRequestOptions): Promise<ApiTraceStatusResponse> {
  const data = await request(TRACE_STATUS_ENDPOINT, requestInitWithOptions(options));
  return TraceStatusSchema.parse(data);
}

export async function startTrace(label: string, options?: ApiRequestOptions): Promise<void> {
  await requestNoContent(
    TRACE_START_ENDPOINT,
    applyRequestOptions(
      {
        method: "POST",
        headers: JSON_CONTENT_TYPE_HEADERS,
        body: JSON.stringify({ label })
      },
      options
    )
  );
}

export async function markTrace(note: string, options?: ApiRequestOptions): Promise<void> {
  await requestNoContent(
    TRACE_MARK_ENDPOINT,
    applyRequestOptions(
      {
        method: "POST",
        headers: JSON_CONTENT_TYPE_HEADERS,
        body: JSON.stringify({ note })
      },
      options
    )
  );
}

export async function stopTrace(options?: ApiRequestOptions): Promise<void> {
  await requestNoContent(
    TRACE_STOP_ENDPOINT,
    applyRequestOptions(
      {
        method: "POST",
        headers: JSON_CONTENT_TYPE_HEADERS,
        body: JSON.stringify({})
      },
      options
    )
  );
}

export async function listDebugHistory(
  limit = DEFAULT_DEBUG_LIST_LIMIT,
  options?: ApiRequestOptions
): Promise<ApiDebugHistoryResponse> {
  const parsedLimit = DebugListLimitSchema.parse(limit);
  const data = await request(
    `${HISTORY_LIST_ENDPOINT}?limit=${String(parsedLimit)}`,
    requestInitWithOptions(options)
  );
  return HistoryListSchema.parse(data);
}

export async function getHistoryEntry(
  entryId: string,
  options?: ApiRequestOptions
): Promise<ApiDebugHistoryDetailResponse> {
  const data = await request(
    `${HISTORY_LIST_ENDPOINT}/${encodeURIComponent(entryId)}`,
    requestInitWithOptions(options)
  );
  return HistoryDetailSchema.parse(data);
}

export async function createDebugClientError(
  input: ApiCreateDebugClientErrorInput,
  options?: ApiRequestOptions
): Promise<ApiDebugErrorCreateResponse> {
  const body = CreateDebugClientErrorBodySchema.parse(input);
  const data = await request(
    CLIENT_ERRORS_ENDPOINT,
    applyRequestOptions(
      {
        method: "POST",
        headers: JSON_CONTENT_TYPE_HEADERS,
        body: JSON.stringify(body)
      },
      options
    )
  );
  return DebugErrorCreateEnvelopeSchema.parse(data);
}

export async function listDebugClientErrors(
  limit = DEFAULT_DEBUG_LIST_LIMIT,
  options?: ApiRequestOptions
): Promise<ApiDebugErrorListResponse> {
  const parsedLimit = DebugListLimitSchema.parse(limit);
  const data = await request(
    `${CLIENT_ERRORS_ENDPOINT}?limit=${String(parsedLimit)}`,
    requestInitWithOptions(options)
  );
  return DebugErrorListEnvelopeSchema.parse(data);
}

export async function getDebugClientError(
  errorId: string,
  options?: ApiRequestOptions
): Promise<ApiDebugErrorDetailResponse> {
  const data = await request(
    `${CLIENT_ERRORS_ENDPOINT}/${encodeURIComponent(errorId)}`,
    requestInitWithOptions(options)
  );
  return DebugErrorDetailEnvelopeSchema.parse(data);
}

export async function clearDebugClientErrors(
  options?: ApiRequestOptions
): Promise<ApiDebugErrorClearResponse> {
  const data = await request(
    CLIENT_ERRORS_ENDPOINT,
    applyRequestOptions(
      {
        method: "DELETE"
      },
      options
    )
  );
  return DebugErrorClearEnvelopeSchema.parse(data);
}

export async function replayHistoryEntry(
  input: ApiReplayHistoryEntryInput,
  options?: ApiRequestOptions
): Promise<ApiReplayHistoryEntryResponse> {
  const body = ReplayHistoryEntryInputSchema.parse(input);
  const data = await request(
    REPLAY_ENDPOINT,
    applyRequestOptions(
      {
        method: "POST",
        headers: JSON_CONTENT_TYPE_HEADERS,
        body: JSON.stringify(body)
      },
      options
    )
  );
  return ReplayHistoryEntryResponseSchema.parse(data);
}
