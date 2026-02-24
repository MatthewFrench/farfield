import {
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

const DebugErrorEventSchema = z
  .object({
    errorId: z.string().trim().min(1),
    sessionId: z.string().trim().min(1),
    origin: z.enum(["client", "server"]),
    source: z.string().trim().min(1),
    operation: z.string().trim().min(1),
    message: z.string().trim().min(1),
    name: z.string().nullable(),
    stack: z.string().nullable(),
    requestId: z.string().nullable(),
    threadId: z.string().nullable(),
    url: z.string().nullable(),
    occurredAt: z.string().datetime(),
    recordedAt: z.string().datetime(),
    details: z.record(StructuredDataValueSchema)
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

const ReplayHistoryEntryResponseSchema = z
  .object({
    ok: z.literal(true),
    replayed: z.literal(true),
    queued: z.boolean().optional(),
    response: z.object({}).passthrough().optional()
  })
  .strict();
export type ApiReplayHistoryEntryResponse = z.infer<typeof ReplayHistoryEntryResponseSchema>;

export interface ApiReplayHistoryEntryInput {
  entryId: string;
  waitForResponse: boolean;
}

export type ApiCreateDebugClientErrorInput = z.infer<typeof CreateDebugClientErrorBodySchema>;

export async function getTraceStatus(options?: ApiRequestOptions): Promise<ApiTraceStatusResponse> {
  const data = await request("/api/debug/trace/status", requestInitWithOptions(options));
  return TraceStatusSchema.parse(data);
}

export async function startTrace(label: string, options?: ApiRequestOptions): Promise<void> {
  await requestNoContent(
    "/api/debug/trace/start",
    applyRequestOptions(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label })
      },
      options
    )
  );
}

export async function markTrace(note: string, options?: ApiRequestOptions): Promise<void> {
  await requestNoContent(
    "/api/debug/trace/mark",
    applyRequestOptions(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note })
      },
      options
    )
  );
}

export async function stopTrace(options?: ApiRequestOptions): Promise<void> {
  await requestNoContent(
    "/api/debug/trace/stop",
    applyRequestOptions(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      },
      options
    )
  );
}

export async function listDebugHistory(
  limit = 120,
  options?: ApiRequestOptions
): Promise<ApiDebugHistoryResponse> {
  const data = await request(`/api/debug/history?limit=${String(limit)}`, requestInitWithOptions(options));
  return HistoryListSchema.parse(data);
}

export async function getHistoryEntry(
  entryId: string,
  options?: ApiRequestOptions
): Promise<ApiDebugHistoryDetailResponse> {
  const data = await request(`/api/debug/history/${encodeURIComponent(entryId)}`, requestInitWithOptions(options));
  return HistoryDetailSchema.parse(data);
}

export async function createDebugClientError(
  input: ApiCreateDebugClientErrorInput,
  options?: ApiRequestOptions
): Promise<ApiDebugErrorCreateResponse> {
  const body = CreateDebugClientErrorBodySchema.parse(input);
  const data = await request(
    "/api/debug/client-errors",
    applyRequestOptions(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      },
      options
    )
  );
  return DebugErrorCreateEnvelopeSchema.parse(data);
}

export async function listDebugClientErrors(
  limit = 120,
  options?: ApiRequestOptions
): Promise<ApiDebugErrorListResponse> {
  const data = await request(`/api/debug/client-errors?limit=${String(limit)}`, requestInitWithOptions(options));
  return DebugErrorListEnvelopeSchema.parse(data);
}

export async function getDebugClientError(
  errorId: string,
  options?: ApiRequestOptions
): Promise<ApiDebugErrorDetailResponse> {
  const data = await request(
    `/api/debug/client-errors/${encodeURIComponent(errorId)}`,
    requestInitWithOptions(options)
  );
  return DebugErrorDetailEnvelopeSchema.parse(data);
}

export async function replayHistoryEntry(
  input: ApiReplayHistoryEntryInput,
  options?: ApiRequestOptions
): Promise<ApiReplayHistoryEntryResponse> {
  const data = await request(
    "/api/debug/replay",
    applyRequestOptions(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      },
      options
    )
  );
  return ReplayHistoryEntryResponseSchema.parse(data);
}
