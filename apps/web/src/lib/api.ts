import {
  AppServerCollaborationModeListResponseSchema,
  CreateDebugClientErrorBodySchema,
  CreatePushSubscriptionBodySchema,
  DeletePushSubscriptionBodySchema,
  DeletePushSubscriptionResponseSchema,
  DebugErrorCreateResponseSchema,
  DebugErrorDetailResponseSchema,
  DebugErrorListResponseSchema,
  AppServerListModelsResponseSchema,
  AppServerListThreadsResponseSchema,
  AppServerReadThreadResponseSchema,
  AppServerStartThreadResponseSchema,
  CreatePushSubscriptionResponseSchema,
  PushLocalCaStatusResponseSchema,
  PushSendLatestResponseSchema,
  PushStatusResponseSchema,
  PushReceiptLatestResponseSchema,
  type CollaborationMode,
  ThreadConversationStateSchema,
  UserInputRequestSchema,
  UserInputResponsePayloadSchema,
  VapidPublicKeyResponseSchema
} from "@farfield/protocol";
import { z } from "zod";

const ApiEnvelopeSchema = z
  .object({
    ok: z.boolean()
  })
  .passthrough();

const REQUEST_TIMEOUT_MS = 30_000;

const ApiErrorEnvelopeSchema = z
  .object({
    ok: z.literal(false),
    error: z.string()
  })
  .passthrough();

const AppServerOperationStatsSchema = z
  .object({
    totalCount: z.number().int().nonnegative(),
    successCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    timeoutCount: z.number().int().nonnegative(),
    inFlightCount: z.number().int().nonnegative(),
    lastStartedAt: z.string().nullable(),
    lastCompletedAt: z.string().nullable(),
    lastDurationMs: z.number().int().nonnegative().nullable(),
    lastStatus: z.union([z.literal("ok"), z.literal("error"), z.null()]),
    lastError: z.string().nullable()
  })
  .strict();

const AppServerOperationsSchema = z
  .object({
    "thread/list": AppServerOperationStatsSchema,
    "model/list": AppServerOperationStatsSchema,
    "collaborationMode/list": AppServerOperationStatsSchema
  })
  .strict();

const AppServerStderrStatsSchema = z
  .object({
    benignSuppressedCount: z.number().int().nonnegative(),
    emittedInWindow: z.number().int().nonnegative(),
    maxEventsPerWindow: z.number().int().positive(),
    rateLimitedSuppressedCount: z.number().int().nonnegative(),
    rateLimitedSuppressedInWindow: z.number().int().nonnegative(),
    windowMs: z.number().int().positive(),
    windowStartedAt: z.string().datetime()
  })
  .strict();

const IpcHistoryRateLimitSchema = z
  .object({
    maxEventsPerWindow: z.number().int().positive(),
    recordedInWindow: z.number().int().nonnegative(),
    suppressedInWindow: z.number().int().nonnegative(),
    totalSuppressedCount: z.number().int().nonnegative(),
    windowMs: z.number().int().positive(),
    windowStartedAt: z.string().datetime()
  })
  .strict();

const HealthResponseSchema = z
  .object({
    ok: z.literal(true),
    state: z
      .object({
        appReady: z.boolean(),
        ipcConnected: z.boolean(),
        ipcInitialized: z.boolean(),
        gitCommit: z.string().nullable().optional(),
        lastError: z.string().nullable(),
        historyCount: z.number().int().nonnegative(),
        threadOwnerCount: z.number().int().nonnegative(),
        trackedThreadEventCount: z.number().int().nonnegative().optional(),
        untrackedThreadEventCount: z.number().int().nonnegative().optional(),
        invalidPushPayloadsLast5m: z.number().int().nonnegative().optional(),
        eventsAuthRejectsLast5m: z.number().int().nonnegative().optional(),
        pushReceiptAuthRejectsLast5m: z.number().int().nonnegative().optional(),
        eventsSessionBootstrapsLast5m: z.number().int().nonnegative().optional(),
        eventsSessionRejectsLast5m: z.number().int().nonnegative().optional(),
        activeEventsSessions: z.number().int().nonnegative().optional(),
        appServerRequestTimeoutMs: z.number().int().positive().optional(),
        appServerOperations: AppServerOperationsSchema.optional(),
        appServerStderr: AppServerStderrStatsSchema.optional(),
        ipcHistoryRateLimit: IpcHistoryRateLimitSchema.optional()
      })
      .passthrough()
  })
  .strict();

const WebShellHealthResponseSchema = z
  .object({
    ok: z.literal(true),
    service: z.literal("farfield-web-shell"),
    buildId: z.string().min(1),
    gitCommit: z.string().nullable(),
    serviceWorkerVersion: z.string().nullable(),
    timestamp: z.string().datetime()
  })
  .strict();

const LiveStateResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string(),
    ownerClientId: z.string().nullable(),
    conversationState: z.union([ThreadConversationStateSchema, z.null()])
  })
  .strict();

const StreamEventsResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string(),
    ownerClientId: z.string().nullable(),
    events: z.array(z.unknown())
  })
  .strict();

const CreateThreadResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string()
  })
  .merge(AppServerStartThreadResponseSchema)
  .strict();

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
  .strict();

const HistoryListSchema = z
  .object({
    ok: z.literal(true),
    history: z.array(
      z.object({
        id: z.string(),
        at: z.string(),
        source: z.enum(["ipc", "app", "system"]),
        direction: z.enum(["in", "out", "system"]),
        payload: z.unknown(),
        meta: z.record(z.unknown())
      })
    )
  })
  .strict();

const HistoryDetailSchema = z
  .object({
    ok: z.literal(true),
    entry: HistoryListSchema.shape.history.element,
    fullPayload: z.unknown()
  })
  .strict();

const DebugErrorCreateEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(DebugErrorCreateResponseSchema)
  .strict();

const DebugErrorListEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(DebugErrorListResponseSchema)
  .strict();

const DebugErrorDetailEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(DebugErrorDetailResponseSchema)
  .strict();

const PushStatusEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushStatusResponseSchema)
  .strict();

const PushVapidPublicKeyEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(VapidPublicKeyResponseSchema)
  .strict();

const PushReceiptLatestEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushReceiptLatestResponseSchema)
  .strict();

const PushSendLatestEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushSendLatestResponseSchema)
  .strict();

const PushLocalCaStatusEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushLocalCaStatusResponseSchema)
  .strict();

const PushTestResponseSchema = z
  .object({
    ok: z.literal(true),
    dryRun: z.boolean(),
    notificationId: z.string().nullable(),
    ready: z.boolean(),
    reason: z.string(),
    attempted: z.number().int().nonnegative(),
    delivered: z.number().int().nonnegative(),
    failures: z.number().int().nonnegative()
  })
  .strict();

const EventsSessionBootstrapResponseSchema = z
  .object({
    ok: z.literal(true),
    authRequired: z.boolean(),
    bootstrapped: z.boolean(),
    expiresAt: z.string().datetime().nullable()
  })
  .strict();

function readApiToken(): string | null {
  const token = import.meta.env["VITE_API_TOKEN"] ?? import.meta.env["VITE_PUSH_API_TOKEN"];
  if (typeof token !== "string") {
    return null;
  }
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const headers = new Headers(init?.headers);
  const token = readApiToken();
  if (token) {
    try {
      headers.set("X-Farfield-Token", token);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid X-Farfield-Token header value: ${message}`);
    }
  }
  let response: Response;
  const timeoutController = new AbortController();
  const timeoutHandle = setTimeout(() => {
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
      throw new Error(`Request timed out for ${path} after ${String(REQUEST_TIMEOUT_MS)}ms`);
    }
    throw new Error(`Request failed for ${path}: ${message}`);
  } finally {
    clearTimeout(timeoutHandle);
    if (inheritedSignal) {
      inheritedSignal.removeEventListener("abort", onAbortInheritedSignal);
    }
  }

  let data: unknown;
  try {
    data = (await response.json()) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON response from ${path}: ${message}`);
  }

  let envelope: z.infer<typeof ApiEnvelopeSchema>;
  try {
    envelope = ApiEnvelopeSchema.parse(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid API envelope from ${path}: ${message}`);
  }

  if (!response.ok || envelope.ok === false) {
    const parsedError = ApiErrorEnvelopeSchema.safeParse(data);
    throw new Error(parsedError.success ? parsedError.data.error : `Request failed for ${path}`);
  }

  return data;
}

function stripOk(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const { ok: _ok, ...rest } = value as Record<string, unknown>;
  return rest;
}

export async function getHealth(): Promise<z.infer<typeof HealthResponseSchema>> {
  return HealthResponseSchema.parse(await request("/api/health"));
}

export async function bootstrapEventsSession(): Promise<z.infer<typeof EventsSessionBootstrapResponseSchema>> {
  return EventsSessionBootstrapResponseSchema.parse(
    await request("/api/events/session", {
      method: "POST"
    })
  );
}

export async function getWebShellHealth(): Promise<z.infer<typeof WebShellHealthResponseSchema>> {
  return WebShellHealthResponseSchema.parse(await request("/healthz"));
}

export async function listThreads(options: {
  limit: number;
  archived: boolean;
  all: boolean;
  maxPages: number;
}): Promise<z.infer<typeof AppServerListThreadsResponseSchema>> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit));
  params.set("archived", options.archived ? "1" : "0");
  params.set("all", options.all ? "1" : "0");
  params.set("maxPages", String(options.maxPages));

  const data = await request(`/api/threads?${params.toString()}`);
  return AppServerListThreadsResponseSchema.parse(stripOk(data));
}

export async function readThread(
  threadId: string,
  options?: { includeTurns?: boolean }
): Promise<z.infer<typeof AppServerReadThreadResponseSchema>> {
  const includeTurns = options?.includeTurns ?? true;
  const data = await request(
    `/api/threads/${encodeURIComponent(threadId)}?includeTurns=${includeTurns ? "true" : "false"}`
  );
  return AppServerReadThreadResponseSchema.parse(stripOk(data));
}

export async function createThread(input?: {
  cwd?: string;
  model?: string;
  modelProvider?: string;
  personality?: string;
  sandbox?: string;
  approvalPolicy?: string;
  ephemeral?: boolean;
}): Promise<z.infer<typeof CreateThreadResponseSchema>> {
  const data = await request("/api/threads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input ?? {})
  });
  return CreateThreadResponseSchema.parse(data);
}

export async function listCollaborationModes(): Promise<
  z.infer<typeof AppServerCollaborationModeListResponseSchema>
> {
  const data = await request("/api/collaboration-modes");
  return AppServerCollaborationModeListResponseSchema.parse(stripOk(data));
}

export async function listModels(): Promise<z.infer<typeof AppServerListModelsResponseSchema>> {
  const data = await request("/api/models?limit=200");
  return AppServerListModelsResponseSchema.parse(stripOk(data));
}

export async function getLiveState(threadId: string): Promise<z.infer<typeof LiveStateResponseSchema>> {
  const data = await request(`/api/threads/${encodeURIComponent(threadId)}/live-state`);
  return LiveStateResponseSchema.parse(data);
}

export async function getStreamEvents(threadId: string): Promise<z.infer<typeof StreamEventsResponseSchema>> {
  const data = await request(`/api/threads/${encodeURIComponent(threadId)}/stream-events?limit=80`);
  return StreamEventsResponseSchema.parse(data);
}

export async function sendMessage(input: {
  threadId: string;
  ownerClientId?: string;
  text: string;
  cwd?: string;
}): Promise<void> {
  const { threadId, ...body } = input;

  await request(`/api/threads/${encodeURIComponent(threadId)}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

export async function setCollaborationMode(input: {
  threadId: string;
  ownerClientId?: string;
  collaborationMode: CollaborationMode;
}): Promise<void> {
  const { threadId, ...body } = input;

  await request(`/api/threads/${encodeURIComponent(threadId)}/collaboration-mode`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

export async function submitUserInput(input: {
  threadId: string;
  ownerClientId?: string;
  requestId: number;
  response: z.infer<typeof UserInputResponsePayloadSchema>;
}): Promise<void> {
  UserInputResponsePayloadSchema.parse(input.response);

  const { threadId, ...body } = input;

  await request(`/api/threads/${encodeURIComponent(threadId)}/user-input`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

export async function interruptThread(input: {
  threadId: string;
  ownerClientId?: string;
}): Promise<void> {
  const { threadId, ...body } = input;

  await request(`/api/threads/${encodeURIComponent(threadId)}/interrupt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

export async function getTraceStatus(): Promise<z.infer<typeof TraceStatusSchema>> {
  const data = await request("/api/debug/trace/status");
  return TraceStatusSchema.parse(data);
}

export async function startTrace(label: string): Promise<void> {
  await request("/api/debug/trace/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label })
  });
}

export async function markTrace(note: string): Promise<void> {
  await request("/api/debug/trace/mark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note })
  });
}

export async function stopTrace(): Promise<void> {
  await request("/api/debug/trace/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
}

export async function listDebugHistory(limit = 120): Promise<z.infer<typeof HistoryListSchema>> {
  const data = await request(`/api/debug/history?limit=${String(limit)}`);
  return HistoryListSchema.parse(data);
}

export async function getHistoryEntry(entryId: string): Promise<z.infer<typeof HistoryDetailSchema>> {
  const data = await request(`/api/debug/history/${encodeURIComponent(entryId)}`);
  return HistoryDetailSchema.parse(data);
}

export async function createDebugClientError(
  input: z.infer<typeof CreateDebugClientErrorBodySchema>
): Promise<z.infer<typeof DebugErrorCreateEnvelopeSchema>> {
  const body = CreateDebugClientErrorBodySchema.parse(input);
  const data = await request("/api/debug/client-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return DebugErrorCreateEnvelopeSchema.parse(data);
}

export async function listDebugClientErrors(
  limit = 120
): Promise<z.infer<typeof DebugErrorListEnvelopeSchema>> {
  const data = await request(`/api/debug/client-errors?limit=${String(limit)}`);
  return DebugErrorListEnvelopeSchema.parse(data);
}

export async function getDebugClientError(
  errorId: string
): Promise<z.infer<typeof DebugErrorDetailEnvelopeSchema>> {
  const data = await request(`/api/debug/client-errors/${encodeURIComponent(errorId)}`);
  return DebugErrorDetailEnvelopeSchema.parse(data);
}

export async function replayHistoryEntry(input: {
  entryId: string;
  waitForResponse: boolean;
}): Promise<unknown> {
  return request("/api/debug/replay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function getPushStatus(): Promise<z.infer<typeof PushStatusEnvelopeSchema>> {
  const data = await request("/api/push/status");
  return PushStatusEnvelopeSchema.parse(data);
}

export async function getPushVapidPublicKey(): Promise<z.infer<typeof PushVapidPublicKeyEnvelopeSchema>> {
  const data = await request("/api/push/vapid-public-key");
  return PushVapidPublicKeyEnvelopeSchema.parse(data);
}

export async function getLatestPushReceipt(): Promise<z.infer<typeof PushReceiptLatestEnvelopeSchema>> {
  const data = await request("/api/push/receipts/latest");
  return PushReceiptLatestEnvelopeSchema.parse(data);
}

export async function getLatestPushSend(): Promise<z.infer<typeof PushSendLatestEnvelopeSchema>> {
  const data = await request("/api/push/sends/latest");
  return PushSendLatestEnvelopeSchema.parse(data);
}

export async function getPushLocalCaStatus(): Promise<z.infer<typeof PushLocalCaStatusEnvelopeSchema>> {
  const data = await request("/api/push/local-ca");
  return PushLocalCaStatusEnvelopeSchema.parse(data);
}

export async function savePushSubscription(
  input: z.infer<typeof CreatePushSubscriptionBodySchema>
): Promise<z.infer<typeof CreatePushSubscriptionResponseSchema>> {
  const body = CreatePushSubscriptionBodySchema.parse(input);
  const data = await request("/api/push/subscriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  return z
    .object({
      ok: z.literal(true)
    })
    .merge(CreatePushSubscriptionResponseSchema)
    .strict()
    .parse(data);
}

export async function deletePushSubscription(
  input: z.infer<typeof DeletePushSubscriptionBodySchema>
): Promise<z.infer<typeof DeletePushSubscriptionResponseSchema>> {
  const body = DeletePushSubscriptionBodySchema.parse(input);
  const data = await request("/api/push/subscriptions", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return z
    .object({
      ok: z.literal(true)
    })
    .merge(DeletePushSubscriptionResponseSchema)
    .strict()
    .parse(data);
}

export async function sendPushTestNotification(input: {
  threadId: string;
  turnId: string;
  title?: string;
  body?: string;
  dryRun?: boolean;
}): Promise<z.infer<typeof PushTestResponseSchema>> {
  const data = await request("/api/push/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  return PushTestResponseSchema.parse(data);
}

export function getPendingUserInputRequests(
  conversationState: z.infer<typeof ThreadConversationStateSchema> | null
): z.infer<typeof UserInputRequestSchema>[] {
  if (!conversationState) {
    return [];
  }

  return conversationState.requests.filter((request) => {
    if (request.method !== "item/tool/requestUserInput") {
      return false;
    }
    return request.completed !== true;
  });
}
