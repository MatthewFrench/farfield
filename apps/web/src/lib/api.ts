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
const REQUEST_ID_HEADER_NAME = "X-Farfield-Request-Id";
const ACTION_ID_HEADER_NAME = "X-Farfield-Action-Id";
const ACTION_NAME_HEADER_NAME = "X-Farfield-Action-Name";

export class RequestCanceledError extends Error {
  constructor(path: string) {
    super(`Request canceled for ${path}`);
    this.name = "RequestCanceledError";
  }
}

export function isRequestCanceledError(error: Error): boolean {
  return error instanceof RequestCanceledError;
}

const ApiErrorEnvelopeSchema = z
  .object({
    ok: z.literal(false),
    error: z.string()
  })
  .passthrough();

const HealthResponseSchema = z
  .object({
    ok: z.literal(true),
    state: z
      .object({
        appReady: z.boolean(),
        ipcConnected: z.boolean(),
        ipcInitialized: z.boolean(),
        workspaceDir: z.string().nullable().optional(),
        gitCommit: z.string().nullable().optional(),
        lastError: z.string().nullable(),
        historyCount: z.number().int().nonnegative(),
        threadOwnerCount: z.number().int().nonnegative()
      })
      .passthrough()
  })
  .passthrough();

const LiveStateResponseSchema: z.ZodObject<
  {
    ok: z.ZodLiteral<true>;
    threadId: z.ZodString;
    ownerClientId: z.ZodNullable<z.ZodString>;
    conversationState: z.ZodUnion<[typeof ThreadConversationStateSchema, z.ZodNull]>;
    liveStateError: z.ZodNullable<
      z.ZodObject<{
        kind: z.ZodLiteral<"reductionFailed">;
        message: z.ZodString;
        eventIndex: z.ZodNullable<z.ZodNumber>;
        patchIndex: z.ZodNullable<z.ZodNumber>;
      }>
    >;
  },
  "passthrough"
> = z
  .object({
    ok: z.literal(true),
    threadId: z.string(),
    ownerClientId: z.string().nullable(),
    conversationState: z.union([ThreadConversationStateSchema, z.null()]),
    liveStateError: z
      .object({
        kind: z.literal("reductionFailed"),
        message: z.string(),
        eventIndex: z.number().int().nonnegative().nullable(),
        patchIndex: z.number().int().nonnegative().nullable()
      })
      .nullable()
  })
  .passthrough();

const StreamEventsResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string(),
    ownerClientId: z.string().nullable(),
    events: z.array(z.unknown())
  })
  .passthrough();

const CreateThreadResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string(),
    agentId: z.enum(["codex", "opencode"])
  })
  .merge(AppServerStartThreadResponseSchema)
  .passthrough();

const ArchiveThreadResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1)
  })
  .strict();

const UnarchiveThreadResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1)
  })
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
  .passthrough();

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
  .passthrough();

const HistoryDetailSchema = z
  .object({
    ok: z.literal(true),
    entry: HistoryListSchema.shape.history.element,
    fullPayload: z.unknown()
  })
  .passthrough();

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

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await performRequest(path, init);
  const responseRequestId = readResponseRequestId(response);

  let data: unknown;
  try {
    data = (await response.json()) as unknown;
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

async function requestNoContent(path: string, init?: RequestInit): Promise<void> {
  const response = await performRequest(path, init);
  const responseRequestId = readResponseRequestId(response);
  if (response.ok) {
    return;
  }

  let data: unknown = null;
  try {
    data = (await response.json()) as unknown;
  } catch {
    // Ignore parse failures here and surface status-based failure below.
  }

  const parsedError = ApiErrorEnvelopeSchema.safeParse(data);
  throw new Error(
    appendRequestId(parsedError.success ? parsedError.data.error : `Request failed for ${path}`, responseRequestId)
  );
}

export interface ApiRequestOptions {
  signal?: AbortSignal;
  actionId?: string;
  actionName?: string;
}

function applyRequestOptions(init: RequestInit, options?: ApiRequestOptions): RequestInit {
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

function requestInitWithOptions(options?: ApiRequestOptions): RequestInit | undefined {
  if (!options) {
    return undefined;
  }
  const nextInit = applyRequestOptions({}, options);
  return Object.keys(nextInit).length > 0 ? nextInit : undefined;
}

function stripOk(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const { ok: _ok, ...rest } = value as Record<string, unknown>;
  return rest;
}

export async function getHealth(options?: ApiRequestOptions): Promise<z.infer<typeof HealthResponseSchema>> {
  return HealthResponseSchema.parse(await request("/api/health", requestInitWithOptions(options)));
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

const AgentIdSchema = z.enum(["codex", "opencode"]);
export type AgentId = z.infer<typeof AgentIdSchema>;
const ReasoningEffortSchema = z.enum(["none", "minimal", "low", "medium", "high", "xhigh"]);

const AgentCapabilitiesSchema = z
  .object({
    canListModels: z.boolean(),
    canListCollaborationModes: z.boolean(),
    canSetCollaborationMode: z.boolean(),
    canSubmitUserInput: z.boolean(),
    canReadLiveState: z.boolean(),
    canReadStreamEvents: z.boolean()
  })
  .strict();

const AgentsResponseSchema = z
  .object({
    ok: z.literal(true),
    agents: z.array(
      z.object({
        id: AgentIdSchema,
        label: z.string(),
        enabled: z.boolean(),
        connected: z.boolean(),
        capabilities: AgentCapabilitiesSchema,
        projectDirectories: z.array(z.string())
      })
    ),
    defaultAgentId: AgentIdSchema
  })
  .strict();

export async function listAgents(options?: ApiRequestOptions): Promise<z.infer<typeof AgentsResponseSchema>> {
  return AgentsResponseSchema.parse(await request("/api/agents", requestInitWithOptions(options)));
}

const ConfigDefaultsResponseSchema = z
  .object({
    ok: z.literal(true),
    agentId: z.union([AgentIdSchema, z.null()]),
    model: z.union([z.string(), z.null()]),
    reasoningEffort: z.union([ReasoningEffortSchema, z.null()])
  })
  .strict();

export async function getConfigDefaults(options?: {
  agentId?: AgentId;
  signal?: AbortSignal;
  actionId?: string;
  actionName?: string;
}): Promise<z.infer<typeof ConfigDefaultsResponseSchema>> {
  const params = new URLSearchParams();
  if (options?.agentId) {
    params.set("agentId", options.agentId);
  }
  const suffix = params.toString();
  return ConfigDefaultsResponseSchema.parse(
    await request(
      suffix.length > 0 ? `/api/config/defaults?${suffix}` : "/api/config/defaults",
      requestInitWithOptions(options)
    )
  );
}

const ThreadListItemWithAgentSchema = AppServerListThreadsResponseSchema.shape.data.element.and(
  z
    .object({
      agentId: z.enum(["codex", "opencode"]),
      source: z.string().optional(),
      removed: z.boolean().optional(),
      projectRemoved: z.boolean().optional(),
      projectState: z.enum(["active", "removed"]).optional()
    })
    .passthrough()
);

const ThreadListResponseSchema = z
  .object({
    data: z.array(ThreadListItemWithAgentSchema),
    nextCursor: z.union([z.string(), z.null(), z.undefined()]).transform((v) => v ?? null),
    pages: z.number().int().nonnegative().optional(),
    truncated: z.boolean().optional()
  });

export async function listThreads(options: {
  limit: number;
  archived: boolean;
  all: boolean;
  maxPages: number;
  sortKey?: "created_at" | "updated_at";
  cwd?: string;
  signal?: AbortSignal;
  actionId?: string;
  actionName?: string;
}): Promise<z.infer<typeof ThreadListResponseSchema>> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit));
  params.set("archived", options.archived ? "1" : "0");
  params.set("all", options.all ? "1" : "0");
  params.set("maxPages", String(options.maxPages));
  if (options.sortKey) {
    params.set("sortKey", options.sortKey);
  }
  if (options.cwd) {
    params.set("cwd", options.cwd);
  }

  const data = await request(`/api/threads?${params.toString()}`, requestInitWithOptions(options));
  return ThreadListResponseSchema.parse(stripOk(data));
}

const ReadThreadResponseWithAgentSchema = AppServerReadThreadResponseSchema.extend({
  agentId: z.enum(["codex", "opencode"])
});

export async function readThread(
  threadId: string,
  options?: { includeTurns?: boolean; signal?: AbortSignal; actionId?: string; actionName?: string }
): Promise<z.infer<typeof ReadThreadResponseWithAgentSchema>> {
  const includeTurns = options?.includeTurns ?? true;
  const data = await request(
    `/api/threads/${encodeURIComponent(threadId)}?includeTurns=${includeTurns ? "true" : "false"}`,
    requestInitWithOptions(options)
  );
  return ReadThreadResponseWithAgentSchema.parse(stripOk(data));
}

export async function createThread(input?: {
  agentId?: AgentId;
  cwd?: string;
  model?: string;
  modelProvider?: string;
  personality?: string;
  sandbox?: string;
  approvalPolicy?: string;
  ephemeral?: boolean;
}, options?: ApiRequestOptions): Promise<z.infer<typeof CreateThreadResponseSchema>> {
  const data = await request(
    "/api/threads",
    applyRequestOptions(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input ?? {})
      },
      options
    )
  );
  return CreateThreadResponseSchema.parse(data);
}

export async function archiveThread(threadId: string, options?: ApiRequestOptions): Promise<void> {
  const data = await request(
    `/api/threads/${encodeURIComponent(threadId)}/archive`,
    applyRequestOptions(
      {
        method: "POST"
      },
      options
    )
  );
  ArchiveThreadResponseSchema.parse(data);
}

export async function unarchiveThread(threadId: string, options?: ApiRequestOptions): Promise<void> {
  const data = await request(
    `/api/threads/${encodeURIComponent(threadId)}/unarchive`,
    applyRequestOptions(
      {
        method: "POST"
      },
      options
    )
  );
  UnarchiveThreadResponseSchema.parse(data);
}

export async function listCollaborationModes(
  options?: ApiRequestOptions
): Promise<z.infer<typeof AppServerCollaborationModeListResponseSchema>> {
  const data = await request("/api/collaboration-modes", requestInitWithOptions(options));
  return AppServerCollaborationModeListResponseSchema.parse(stripOk(data));
}

export async function listModels(options?: ApiRequestOptions): Promise<z.infer<typeof AppServerListModelsResponseSchema>> {
  const data = await request("/api/models?limit=200", requestInitWithOptions(options));
  return AppServerListModelsResponseSchema.parse(stripOk(data));
}

export async function getLiveState(
  threadId: string,
  options?: ApiRequestOptions
): Promise<z.infer<typeof LiveStateResponseSchema>> {
  const data = await request(
    `/api/threads/${encodeURIComponent(threadId)}/live-state`,
    requestInitWithOptions(options)
  );
  return LiveStateResponseSchema.parse(data);
}

export async function getStreamEvents(
  threadId: string,
  options?: ApiRequestOptions
): Promise<z.infer<typeof StreamEventsResponseSchema>> {
  const data = await request(
    `/api/threads/${encodeURIComponent(threadId)}/stream-events?limit=80`,
    requestInitWithOptions(options)
  );
  return StreamEventsResponseSchema.parse(data);
}

export async function sendMessage(input: {
  threadId: string;
  ownerClientId?: string;
  text: string;
  cwd?: string;
}, options?: ApiRequestOptions): Promise<void> {
  const { threadId, ...body } = input;

  await requestNoContent(
    `/api/threads/${encodeURIComponent(threadId)}/messages`,
    applyRequestOptions(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      },
      options
    )
  );
}

export async function setCollaborationMode(input: {
  threadId: string;
  ownerClientId?: string;
  collaborationMode: CollaborationMode;
}, options?: ApiRequestOptions): Promise<void> {
  const { threadId, ...body } = input;

  await requestNoContent(
    `/api/threads/${encodeURIComponent(threadId)}/collaboration-mode`,
    applyRequestOptions(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      },
      options
    )
  );
}

export async function submitUserInput(input: {
  threadId: string;
  ownerClientId?: string;
  requestId: number;
  response: z.infer<typeof UserInputResponsePayloadSchema>;
}, options?: ApiRequestOptions): Promise<void> {
  UserInputResponsePayloadSchema.parse(input.response);

  const { threadId, ...body } = input;

  await requestNoContent(
    `/api/threads/${encodeURIComponent(threadId)}/user-input`,
    applyRequestOptions(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      },
      options
    )
  );
}

export async function interruptThread(input: {
  threadId: string;
  ownerClientId?: string;
}, options?: ApiRequestOptions): Promise<void> {
  const { threadId, ...body } = input;

  await requestNoContent(
    `/api/threads/${encodeURIComponent(threadId)}/interrupt`,
    applyRequestOptions(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      },
      options
    )
  );
}

export async function getTraceStatus(options?: ApiRequestOptions): Promise<z.infer<typeof TraceStatusSchema>> {
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
): Promise<z.infer<typeof HistoryListSchema>> {
  const data = await request(`/api/debug/history?limit=${String(limit)}`, requestInitWithOptions(options));
  return HistoryListSchema.parse(data);
}

export async function getHistoryEntry(
  entryId: string,
  options?: ApiRequestOptions
): Promise<z.infer<typeof HistoryDetailSchema>> {
  const data = await request(`/api/debug/history/${encodeURIComponent(entryId)}`, requestInitWithOptions(options));
  return HistoryDetailSchema.parse(data);
}

export async function createDebugClientError(
  input: z.infer<typeof CreateDebugClientErrorBodySchema>,
  options?: ApiRequestOptions
): Promise<z.infer<typeof DebugErrorCreateEnvelopeSchema>> {
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
): Promise<z.infer<typeof DebugErrorListEnvelopeSchema>> {
  const data = await request(`/api/debug/client-errors?limit=${String(limit)}`, requestInitWithOptions(options));
  return DebugErrorListEnvelopeSchema.parse(data);
}

export async function getDebugClientError(
  errorId: string,
  options?: ApiRequestOptions
): Promise<z.infer<typeof DebugErrorDetailEnvelopeSchema>> {
  const data = await request(
    `/api/debug/client-errors/${encodeURIComponent(errorId)}`,
    requestInitWithOptions(options)
  );
  return DebugErrorDetailEnvelopeSchema.parse(data);
}

export async function replayHistoryEntry(input: {
  entryId: string;
  waitForResponse: boolean;
}, options?: ApiRequestOptions): Promise<unknown> {
  return request(
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
}

export async function getPushStatus(options?: ApiRequestOptions): Promise<z.infer<typeof PushStatusEnvelopeSchema>> {
  const data = await request("/api/push/status", requestInitWithOptions(options));
  return PushStatusEnvelopeSchema.parse(data);
}

export async function getPushVapidPublicKey(
  options?: ApiRequestOptions
): Promise<z.infer<typeof PushVapidPublicKeyEnvelopeSchema>> {
  const data = await request("/api/push/vapid-public-key", requestInitWithOptions(options));
  return PushVapidPublicKeyEnvelopeSchema.parse(data);
}

export async function getLatestPushReceipt(
  options?: ApiRequestOptions
): Promise<z.infer<typeof PushReceiptLatestEnvelopeSchema>> {
  const data = await request("/api/push/receipts/latest", requestInitWithOptions(options));
  return PushReceiptLatestEnvelopeSchema.parse(data);
}

export async function getLatestPushSend(options?: ApiRequestOptions): Promise<z.infer<typeof PushSendLatestEnvelopeSchema>> {
  const data = await request("/api/push/sends/latest", requestInitWithOptions(options));
  return PushSendLatestEnvelopeSchema.parse(data);
}

export async function getPushLocalCaStatus(
  options?: ApiRequestOptions
): Promise<z.infer<typeof PushLocalCaStatusEnvelopeSchema>> {
  const data = await request("/api/push/local-ca", requestInitWithOptions(options));
  return PushLocalCaStatusEnvelopeSchema.parse(data);
}

export async function savePushSubscription(
  input: z.infer<typeof CreatePushSubscriptionBodySchema>,
  options?: ApiRequestOptions
): Promise<z.infer<typeof CreatePushSubscriptionResponseSchema>> {
  const body = CreatePushSubscriptionBodySchema.parse(input);
  const data = await request(
    "/api/push/subscriptions",
    applyRequestOptions(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      },
      options
    )
  );

  return z
    .object({
      ok: z.literal(true)
    })
    .merge(CreatePushSubscriptionResponseSchema)
    .strict()
    .parse(data);
}

export async function deletePushSubscription(
  input: z.infer<typeof DeletePushSubscriptionBodySchema>,
  options?: ApiRequestOptions
): Promise<z.infer<typeof DeletePushSubscriptionResponseSchema>> {
  const body = DeletePushSubscriptionBodySchema.parse(input);
  const data = await request(
    "/api/push/subscriptions",
    applyRequestOptions(
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      },
      options
    )
  );
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
}, options?: ApiRequestOptions): Promise<z.infer<typeof PushTestResponseSchema>> {
  const data = await request(
    "/api/push/test",
    applyRequestOptions(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
      },
      options
    )
  );
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
