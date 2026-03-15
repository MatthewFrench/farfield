/**
 * Owns debug HTTP boundary orchestration for request dispatch and response parsing.
 * Non-trivial request-building and debug-error wire mapping are delegated to explicit owner modules.
 */
import {
  CreateDebugClientErrorBodySchema,
  FarfieldDebugErrorClearEnvelopeSchema,
  FarfieldDebugErrorCreateEnvelopeSchema,
} from "@farfield/protocol";
import { z } from "zod";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { StructuredDataValueSchema } from "@/Shared/Contracts/StructuredDataValue";
import {
  request,
  requestInitWithOptions,
  requestNoContent,
} from "@/Shared/Transport/FarfieldHttpTransport";
import {
  buildDeleteRequestInit,
  buildJsonPostRequestInit,
  buildListRequestPath,
  buildMemberRequestPath,
  CLIENT_ERRORS_ENDPOINT,
  DEFAULT_DEBUG_LIST_LIMIT,
  HISTORY_LIST_ENDPOINT,
  parseTraceMarkNote,
  parseTraceStartLabel,
  REPLAY_ENDPOINT,
  TRACE_MARK_ENDPOINT,
  TRACE_START_ENDPOINT,
  TRACE_STATUS_ENDPOINT,
  TRACE_STOP_ENDPOINT,
} from "./DebugApiRequestContracts";
import {
  type ApiDebugErrorDetailResponse,
  type ApiDebugErrorListResponse,
  DebugErrorDetailEnvelopeSchema,
  DebugErrorListEnvelopeSchema,
} from "./DebugErrorEnvelopeContracts";

const TraceSummarySchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string(),
    startedAt: z.string(),
    stoppedAt: z.string().nullable(),
    eventCount: z.number().int().nonnegative(),
    path: z.string().trim().min(1),
  })
  .strip();

const TraceStatusSchema = z
  .object({
    ok: z.literal(true),
    active: TraceSummarySchema.nullable(),
    recent: z.array(TraceSummarySchema),
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
    meta: z.record(StructuredDataValueSchema),
  })
  .strip();

const HistoryListSchema = z
  .object({
    ok: z.literal(true),
    history: z.array(HistoryEntrySchema),
  })
  .strip();

export type ApiDebugHistoryResponse = z.infer<typeof HistoryListSchema>;

const HistoryDetailSchema = z
  .object({
    ok: z.literal(true),
    entry: HistoryEntrySchema,
    fullPayload: StructuredDataValueSchema,
  })
  .strip();

export type ApiDebugHistoryDetailResponse = z.infer<typeof HistoryDetailSchema>;

const DebugErrorCreateEnvelopeSchema = FarfieldDebugErrorCreateEnvelopeSchema;
export type ApiDebugErrorCreateResponse = z.infer<typeof DebugErrorCreateEnvelopeSchema>;

const DebugErrorClearEnvelopeSchema = FarfieldDebugErrorClearEnvelopeSchema;
export type ApiDebugErrorClearResponse = z.infer<typeof DebugErrorClearEnvelopeSchema>;

const ReplayHistoryEntryInputSchema = z
  .object({
    entryId: z.string().trim().min(1),
    waitForResponse: z.boolean(),
  })
  .strict();

const ReplayHistoryEntryResponseSchema = z
  .object({
    ok: z.literal(true),
    replayed: z.literal(true),
    queued: z.boolean().optional(),
    response: z.record(StructuredDataValueSchema).optional(),
  })
  .strict();

export type ApiReplayHistoryEntryResponse = z.infer<typeof ReplayHistoryEntryResponseSchema>;
export type ApiReplayHistoryEntryInput = z.infer<typeof ReplayHistoryEntryInputSchema>;

export type ApiCreateDebugClientErrorInput = z.infer<typeof CreateDebugClientErrorBodySchema>;
export { DEFAULT_DEBUG_LIST_LIMIT } from "./DebugApiRequestContracts";
export type {
  ApiDebugErrorDetailResponse,
  ApiDebugErrorDetails,
  ApiDebugErrorListResponse,
} from "./DebugErrorEnvelopeContracts";

export async function getTraceStatus(options?: ApiRequestOptions): Promise<ApiTraceStatusResponse> {
  const data = await request(TRACE_STATUS_ENDPOINT, requestInitWithOptions(options));
  return TraceStatusSchema.parse(data);
}

export async function startTrace(label: string, options?: ApiRequestOptions): Promise<void> {
  const parsedLabel = parseTraceStartLabel(label);
  await requestNoContent(
    TRACE_START_ENDPOINT,
    buildJsonPostRequestInit(JSON.stringify({ label: parsedLabel }), options),
  );
}

export async function markTrace(note: string, options?: ApiRequestOptions): Promise<void> {
  const parsedNote = parseTraceMarkNote(note);
  await requestNoContent(
    TRACE_MARK_ENDPOINT,
    buildJsonPostRequestInit(JSON.stringify({ note: parsedNote }), options),
  );
}

export async function stopTrace(options?: ApiRequestOptions): Promise<void> {
  await requestNoContent(TRACE_STOP_ENDPOINT, buildJsonPostRequestInit("{}", options));
}

export async function listDebugHistory(
  limit = DEFAULT_DEBUG_LIST_LIMIT,
  options?: ApiRequestOptions,
): Promise<ApiDebugHistoryResponse> {
  const data = await request(
    buildListRequestPath(HISTORY_LIST_ENDPOINT, limit),
    requestInitWithOptions(options),
  );
  return HistoryListSchema.parse(data);
}

export async function getHistoryEntry(
  entryId: string,
  options?: ApiRequestOptions,
): Promise<ApiDebugHistoryDetailResponse> {
  const data = await request(
    buildMemberRequestPath(HISTORY_LIST_ENDPOINT, entryId),
    requestInitWithOptions(options),
  );
  return HistoryDetailSchema.parse(data);
}

export async function createDebugClientError(
  input: ApiCreateDebugClientErrorInput,
  options?: ApiRequestOptions,
): Promise<ApiDebugErrorCreateResponse> {
  const body = CreateDebugClientErrorBodySchema.parse(input);
  const data = await request(
    CLIENT_ERRORS_ENDPOINT,
    buildJsonPostRequestInit(JSON.stringify(body), options),
  );
  return DebugErrorCreateEnvelopeSchema.parse(data);
}

export async function listDebugClientErrors(
  limit = DEFAULT_DEBUG_LIST_LIMIT,
  options?: ApiRequestOptions,
): Promise<ApiDebugErrorListResponse> {
  const data = await request(
    buildListRequestPath(CLIENT_ERRORS_ENDPOINT, limit),
    requestInitWithOptions(options),
  );
  return DebugErrorListEnvelopeSchema.parse(data);
}

export async function getDebugClientError(
  errorId: string,
  options?: ApiRequestOptions,
): Promise<ApiDebugErrorDetailResponse> {
  const data = await request(
    buildMemberRequestPath(CLIENT_ERRORS_ENDPOINT, errorId),
    requestInitWithOptions(options),
  );
  return DebugErrorDetailEnvelopeSchema.parse(data);
}

export async function clearDebugClientErrors(
  options?: ApiRequestOptions,
): Promise<ApiDebugErrorClearResponse> {
  const data = await request(CLIENT_ERRORS_ENDPOINT, buildDeleteRequestInit(options));
  return DebugErrorClearEnvelopeSchema.parse(data);
}

export async function replayHistoryEntry(
  input: ApiReplayHistoryEntryInput,
  options?: ApiRequestOptions,
): Promise<ApiReplayHistoryEntryResponse> {
  const body = ReplayHistoryEntryInputSchema.parse(input);
  const data = await request(
    REPLAY_ENDPOINT,
    buildJsonPostRequestInit(JSON.stringify(body), options),
  );
  return ReplayHistoryEntryResponseSchema.parse(data);
}
