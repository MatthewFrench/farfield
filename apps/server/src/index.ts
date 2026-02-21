import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { AppServerRpcError, type SendRequestOptions } from "@farfield/api";
import {
  type AppServerListThreadsResponse,
  CreateDebugClientErrorBodySchema,
  CreatePushReceiptBodySchema,
  CreatePushSubscriptionBodySchema,
  type CreatePushReceiptBody,
  DeletePushSubscriptionBodySchema,
  type IpcFrame,
  type IpcRequestFrame,
  type PushNotificationPayload
} from "@farfield/protocol";
import { z } from "zod";
import {
  InterruptBodySchema,
  parseBody,
  ReplayBodySchema,
  SendMessageBodySchema,
  StartThreadBodySchema,
  SetModeBodySchema,
  SubmitUserInputBodySchema,
  TraceMarkBodySchema,
  TraceStartBodySchema
} from "./http-schemas.js";
import { logger } from "./logger.js";
import {
  parseServerCliOptions,
  formatServerHelpText
} from "./agents/cli-options.js";
import { AgentRegistry } from "./agents/registry.js";
import { ThreadIndex } from "./agents/thread-index.js";
import { CodexAgentAdapter } from "./agents/adapters/codex-agent.js";
import { OpenCodeAgentAdapter } from "./agents/adapters/opencode-agent.js";
import { ClientErrorStore } from "./client-error-store.js";
import { CompletionDetector } from "./completion-detector.js";
import { NtfyNotifier, parseNtfyConfigFromEnv } from "./ntfy-notifier.js";
import { PushReceiptStore } from "./push-receipt-store.js";
import { PushSendStore } from "./push-send-store.js";
import { PushService } from "./push-service.js";
import { migratePushStateFile, resolvePushStatePath } from "./push-state-path.js";
import { PushStore } from "./push-store.js";
import type { AgentAdapter, AgentDescriptor, AgentId, AgentThreadLiveState } from "./agents/types.js";

const HOST = process.env["HOST"] ?? "127.0.0.1";
const PORT = Number(process.env["PORT"] ?? 4311);
const HISTORY_LIMIT = 2_000;
const USER_AGENT = "farfield/0.2.0";
const IPC_RECONNECT_DELAY_MS = 1_000;
const NTFY_COMPLETION_DEBOUNCE_MS = 250;
const CAPABILITY_LIST_TIMEOUT_MS = 8_000;

const TRACE_DIR = path.resolve(process.cwd(), "traces");
const DEFAULT_WORKSPACE = path.resolve(process.cwd());
type ThreadSortKey = "created_at" | "updated_at";
type ThreadListItemWithAgentId = AppServerListThreadsResponse["data"][number] & { agentId: AgentId };

interface HistoryEntry {
  id: string;
  at: string;
  source: "ipc" | "app" | "system";
  direction: "in" | "out" | "system";
  payload: unknown;
  meta: Record<string, unknown>;
}

interface TraceSummary {
  id: string;
  label: string;
  startedAt: string;
  stoppedAt: string | null;
  eventCount: number;
  path: string;
}

interface ActiveTrace {
  summary: TraceSummary;
  stream: fs.WriteStream;
}

interface ParsedReplayFrame {
  type: "request" | "broadcast";
  method: string;
  params: IpcRequestFrame["params"];
  targetClientId?: string;
  version?: number;
}

const ThreadPreviewSchema = z
  .object({
    preview: z.string()
  })
  .passthrough();
const AgentIdParamSchema = z.enum(["codex", "opencode"]);
const ThreadSortKeyParamSchema = z.enum(["created_at", "updated_at"]);
const PushReceiptEventSchema = z.enum(["shown", "clicked", "error"]);
const PushTestBodySchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    title: z.string().min(1).optional(),
    body: z.string().optional(),
    dryRun: z.boolean().optional()
  })
  .strict();
const EventsSessionResponseSchema = z
  .object({
    ok: z.literal(true),
    authRequired: z.boolean(),
    bootstrapped: z.boolean(),
    expiresAt: z.string().datetime().nullable()
  })
  .strict();

function resolveCodexExecutablePath(): string {
  if (process.env["CODEX_CLI_PATH"]) {
    return process.env["CODEX_CLI_PATH"];
  }

  const desktopPath = "/Applications/Codex.app/Contents/Resources/codex";
  if (fs.existsSync(desktopPath)) {
    return desktopPath;
  }

  return "codex";
}

function resolveIpcSocketPath(): string {
  if (process.env["CODEX_IPC_SOCKET"]) {
    return process.env["CODEX_IPC_SOCKET"];
  }

  if (process.platform === "win32") {
    return "\\\\.\\pipe\\codex-ipc";
  }

  const uid = process.getuid?.() ?? 0;
  return path.join(os.tmpdir(), "codex-ipc", `ipc-${uid}.sock`);
}

function resolveGitCommitHash(): string | null {
  try {
    const hash = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: DEFAULT_WORKSPACE,
      encoding: "utf8"
    }).trim();
    return hash.length > 0 ? hash : null;
  } catch {
    return null;
  }
}

function parseInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  if (value === "1" || value === "true") {
    return true;
  }

  if (value === "0" || value === "false") {
    return false;
  }

  return fallback;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${String(timeoutMs)}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

const OptionalPathEnvSchema = z.string().trim().min(1).optional();
const API_TOKEN_HEADER_NAME = "x-farfield-token";
const API_TOKEN_RESPONSE_HEADER = "X-Farfield-Token";
const API_TOKEN = (process.env["API_TOKEN"] ?? process.env["PUSH_API_TOKEN"] ?? "").trim();
const API_AUTH_REQUIRED = API_TOKEN.length > 0;
const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PUSH_ENABLED = parseBoolean(process.env["PUSH_ENABLED"] ?? null, false);
const PUSH_PRIVATE_MODE_DEFAULT = parseBoolean(process.env["PUSH_PRIVATE_MODE_DEFAULT"] ?? null, true);
const PUSH_RECEIPTS_MAX_COUNT = parseInteger(process.env["PUSH_RECEIPTS_MAX_COUNT"] ?? null, 100);
const PUSH_RECEIPTS_MAX_AGE_DAYS = parseInteger(process.env["PUSH_RECEIPTS_MAX_AGE_DAYS"] ?? null, 7);
const WEB_HEALTH_BUILD_ID = (process.env["WEB_BUILD_ID"] ?? process.env["VITE_APP_BUILD_ID"] ?? "dev").trim() || "dev";
const WEB_HEALTH_SERVICE_WORKER_VERSION = (process.env["WEB_SERVICE_WORKER_VERSION"] ?? "").trim() || null;

function parseOptionalPathEnv(label: string, value: string | undefined): string | null {
  const parsed = OptionalPathEnvSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`${label} must be a non-empty path when set`);
  }
  if (!parsed.data) {
    return null;
  }
  return path.resolve(parsed.data);
}

function readHeader(req: IncomingMessage, name: string): string | null {
  const raw = req.headers[name];
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    const value = raw[0];
    return typeof value === "string" ? value : null;
  }
  return null;
}

function isAuthenticatedRequest(req: IncomingMessage): boolean {
  if (!API_AUTH_REQUIRED) {
    return true;
  }
  const providedToken = readHeader(req, API_TOKEN_HEADER_NAME);
  if (!providedToken) {
    return false;
  }
  return providedToken === API_TOKEN;
}

function requireApiAuth(req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
  if (!pathname.startsWith("/api/") && pathname !== "/events") {
    return true;
  }
  if (!isAuthenticatedRequest(req)) {
    jsonResponse(res, 401, {
      ok: false,
      error: `Unauthorized: missing or invalid ${API_TOKEN_RESPONSE_HEADER}`
    });
    return false;
  }
  return true;
}

function parseAgentId(value: string | null): AgentId | null {
  if (!value) {
    return null;
  }
  const parsed = AgentIdParamSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseThreadSortKey(value: string | null): ThreadSortKey | null {
  if (!value) {
    return null;
  }
  const parsed = ThreadSortKeyParamSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function normalizeOptionalString(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function compareThreadListItems(
  left: ThreadListItemWithAgentId,
  right: ThreadListItemWithAgentId,
  sortKey: ThreadSortKey
): number {
  const leftSortValue = sortKey === "created_at" ? left.createdAt : left.updatedAt;
  const rightSortValue = sortKey === "created_at" ? right.createdAt : right.updatedAt;

  if (leftSortValue !== rightSortValue) {
    return rightSortValue - leftSortValue;
  }

  if (left.updatedAt !== right.updatedAt) {
    return right.updatedAt - left.updatedAt;
  }

  if (left.createdAt !== right.createdAt) {
    return right.createdAt - left.createdAt;
  }

  const previewCompare = left.preview.localeCompare(right.preview);
  if (previewCompare !== 0) {
    return previewCompare;
  }

  return left.id.localeCompare(right.id);
}

function readThreadPreview(value: AgentThreadLiveState["conversationState"]): string {
  const parsed = ThreadPreviewSchema.safeParse(value);
  if (!parsed.success) {
    return "";
  }
  return parsed.data.preview;
}

function jsonResponse(res: ServerResponse, statusCode: number, body: unknown): void {
  const encoded = Buffer.from(JSON.stringify(body), "utf8");
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": encoded.length,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, x-farfield-token",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS"
  });
  res.end(encoded);
}

function eventResponse(res: ServerResponse, body: unknown): void {
  res.write(`data: ${JSON.stringify(body)}\n\n`);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk, "utf8"));
      continue;
    }
    chunks.push(chunk as Buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

function ensureTraceDirectory(): void {
  if (!fs.existsSync(TRACE_DIR)) {
    fs.mkdirSync(TRACE_DIR, { recursive: true });
  }
}

function parseReplayFrame(payload: unknown): ParsedReplayFrame {
  if (!payload || typeof payload !== "object") {
    throw new Error("Entry payload is unavailable");
  }

  const record = payload as Record<string, unknown>;
  const type = record["type"];
  if (type !== "request" && type !== "broadcast") {
    throw new Error("Only captured request and broadcast entries can be replayed");
  }

  const method = record["method"];
  if (typeof method !== "string" || method.trim().length === 0) {
    throw new Error("Captured IPC frame has invalid method");
  }

  const targetClientId = record["targetClientId"];
  const version = record["version"];

  return {
    type,
    method,
    params: record["params"],
    ...(typeof targetClientId === "string" ? { targetClientId } : {}),
    ...(typeof version === "number" ? { version } : {})
  };
}

function resolvePushLocalCaSourcePath(): string {
  const configuredPath = parseOptionalPathEnv("PUSH_LOCAL_CA_PATH", process.env["PUSH_LOCAL_CA_PATH"]);
  if (configuredPath) {
    return configuredPath;
  }

  const homeDirectory = os.homedir();
  if (process.platform === "darwin") {
    return path.join(
      homeDirectory,
      "Library",
      "Application Support",
      "Caddy",
      "pki",
      "authorities",
      "local",
      "root.crt"
    );
  }

  if (process.platform === "win32") {
    const appDataDirectory =
      parseOptionalPathEnv("APPDATA", process.env["APPDATA"]) ??
      path.join(homeDirectory, "AppData", "Roaming");
    return path.join(appDataDirectory, "Caddy", "pki", "authorities", "local", "root.crt");
  }

  const xdgDataHome =
    parseOptionalPathEnv("XDG_DATA_HOME", process.env["XDG_DATA_HOME"]) ??
    path.join(homeDirectory, ".local", "share");
  return path.join(xdgDataHome, "caddy", "pki", "authorities", "local", "root.crt");
}

function buildPushTestPayload(
  input: z.infer<typeof PushTestBodySchema>,
  privateMode: boolean
): PushNotificationPayload {
  const now = new Date().toISOString();
  const notificationId = `notif_${randomUUID()}`;
  const url = `/threads/${encodeURIComponent(input.threadId)}`;
  const title = input.title ?? "Farfield notification";
  const body = privateMode
    ? "A response is ready in Farfield."
    : (input.body ?? "A response is ready in Farfield.");

  return {
    notificationId,
    title,
    body,
    threadId: input.threadId,
    turnId: input.turnId,
    url,
    createdAt: now,
    web_push: {
      notification: {
        title,
        body,
        navigate: url,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: `thread:${input.threadId}`
      }
    }
  };
}

function trimNotificationText(value: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function buildThreadCompletionPushPayload(input: {
  threadId: string;
  turnId: string;
  preview: string;
  agentText: string;
  privateMode: boolean;
}): PushNotificationPayload {
  const createdAt = new Date().toISOString();
  const notificationId = `notif_${randomUUID()}`;
  const url = `/threads/${encodeURIComponent(input.threadId)}`;

  const title = input.privateMode
    ? "Farfield thread completed"
    : (() => {
      const candidate = trimNotificationText(input.preview, 120);
      return candidate.length > 0 ? candidate : "Farfield thread completed";
    })();

  const body = input.privateMode
    ? "A response is ready in Farfield."
    : (() => {
      const candidate = trimNotificationText(input.agentText, 320);
      return candidate.length > 0 ? candidate : "A response is ready in Farfield.";
    })();

  return {
    notificationId,
    title,
    body,
    threadId: input.threadId,
    turnId: input.turnId,
    url,
    createdAt,
    web_push: {
      notification: {
        title,
        body,
        navigate: url,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: `thread:${input.threadId}`
      }
    }
  };
}

const parsedCli = (() => {
  try {
    return parseServerCliOptions(process.argv.slice(2));
  } catch (error) {
    const message = toErrorMessage(error);
    process.stderr.write(`${message}\n`);
    process.stderr.write("Run with --help to see valid arguments.\n");
    process.exit(1);
  }
})();

if (parsedCli.showHelp) {
  process.stdout.write(formatServerHelpText());
  process.stdout.write("\n");
  process.exit(0);
}

const configuredAgentIds = parsedCli.agentIds;
const codexExecutable = resolveCodexExecutablePath();
const ipcSocketPath = resolveIpcSocketPath();
const gitCommit = resolveGitCommitHash();
const pushStatePathResolution = resolvePushStatePath({
  envPath: process.env["PUSH_STATE_PATH"],
  appDataPath: process.env["APPDATA"],
  xdgStateHome: process.env["XDG_STATE_HOME"],
  homeDirectory: os.homedir(),
  platform: process.platform,
  moduleDirectory: MODULE_DIRECTORY
});
const pushStateMigration = migratePushStateFile(pushStatePathResolution);
const pushReceiptsPath =
  parseOptionalPathEnv("PUSH_RECEIPTS_PATH", process.env["PUSH_RECEIPTS_PATH"]) ??
  path.join(path.dirname(pushStatePathResolution.filePath), "push-receipts.json");
const pushSendsPath =
  parseOptionalPathEnv("PUSH_SENDS_PATH", process.env["PUSH_SENDS_PATH"]) ??
  path.join(path.dirname(pushStatePathResolution.filePath), "push-sends.json");
const pushLocalCaSourcePath = resolvePushLocalCaSourcePath();
const pushVapidPublicKey = (process.env["PUSH_VAPID_PUBLIC_KEY"] ?? "").trim();
const pushVapidPrivateKey = (process.env["PUSH_VAPID_PRIVATE_KEY"] ?? "").trim();
const pushVapidSubject = (process.env["PUSH_VAPID_SUBJECT"] ?? "").trim();

if (
  PUSH_ENABLED &&
  (pushVapidPublicKey.length === 0 || pushVapidPrivateKey.length === 0 || pushVapidSubject.length === 0)
) {
  throw new Error(
    "PUSH_ENABLED=true requires PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY, and PUSH_VAPID_SUBJECT"
  );
}

const pushStore = new PushStore(pushStatePathResolution.filePath);
pushStore.load();
const pushReceiptStore = new PushReceiptStore(
  pushReceiptsPath,
  PUSH_RECEIPTS_MAX_COUNT,
  PUSH_RECEIPTS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
);
pushReceiptStore.load();
const pushSendStore = new PushSendStore(pushSendsPath);
pushSendStore.load();
const pushService = new PushService({
  enabled: PUSH_ENABLED,
  vapidPublicKey: pushVapidPublicKey,
  vapidPrivateKey: pushVapidPrivateKey,
  vapidSubject: pushVapidSubject
});
const clientErrorSessionStartedAt = new Date().toISOString();
const clientErrorSessionTimestamp = clientErrorSessionStartedAt.replace(/[:.]/g, "-");
const clientErrorSessionId = `session-${clientErrorSessionTimestamp}-${String(process.pid)}`;
const clientErrorLogPath =
  parseOptionalPathEnv("DEBUG_CLIENT_ERROR_LOG_PATH", process.env["DEBUG_CLIENT_ERROR_LOG_PATH"]) ??
  path.join(
    DEFAULT_WORKSPACE,
    ".runtime",
    "logs",
    "errors",
    `${clientErrorSessionId}.ndjson`
  );
const clientErrorMaxEntries = parseInteger(process.env["DEBUG_CLIENT_ERROR_MAX_ENTRIES"] ?? null, 2000);
const clientErrorStore = new ClientErrorStore(
  clientErrorLogPath,
  clientErrorSessionId,
  clientErrorMaxEntries
);

const history: HistoryEntry[] = [];
const historyById = new Map<string, unknown>();
const sseClients = new Set<ServerResponse>();
const SSE_KEEPALIVE_INTERVAL_MS = 15_000;
const threadIndex = new ThreadIndex();

let activeTrace: ActiveTrace | null = null;
const recentTraces: TraceSummary[] = [];
let runtimeLastError: string | null = null;
const completionWatermarks = new Map<string, string>();
for (const entry of pushStore.listCompletionWatermarks()) {
  completionWatermarks.set(entry.threadId, entry.marker);
}
const completionDetector = new CompletionDetector(completionWatermarks);
const ntfyNotifier = new NtfyNotifier(parseNtfyConfigFromEnv(process.env));
const completionCheckTimers = new Map<string, NodeJS.Timeout>();
const completionChecksInFlight = new Set<string>();

function recordTraceEvent(event: unknown): void {
  if (!activeTrace) {
    return;
  }

  activeTrace.summary.eventCount += 1;
  activeTrace.stream.write(`${JSON.stringify(event)}\n`);
}

function pushHistory(
  source: HistoryEntry["source"],
  direction: HistoryEntry["direction"],
  payload: unknown,
  meta: Record<string, unknown> = {}
): HistoryEntry {
  const entry: HistoryEntry = {
    id: randomUUID(),
    at: new Date().toISOString(),
    source,
    direction,
    payload,
    meta
  };

  history.push(entry);
  historyById.set(entry.id, payload);

  if (history.length > HISTORY_LIMIT) {
    const removed = history.shift();
    if (removed) {
      historyById.delete(removed.id);
    }
  }

  recordTraceEvent({ type: "history", ...entry });
  broadcastSse({ type: "history", entry });
  return entry;
}

function summarizeActionDetails(details: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  const keys = ["agentId", "threadId", "ownerClientId", "requestId", "textLength", "cwd", "model"];

  for (const key of keys) {
    const value = details[key];
    if (value !== undefined) {
      summary[key] = value;
    }
  }

  return summary;
}

function pushActionEvent(
  action: string,
  stage: "attempt" | "success" | "error",
  details: Record<string, unknown>
): void {
  logger.info(
    {
      action,
      stage,
      ...summarizeActionDetails(details)
    },
    "action-event"
  );
  pushHistory("app", "out", {
    type: "action",
    action,
    stage,
    ...details
  }, details);
}

function pushActionError(
  action: string,
  error: unknown,
  details: Record<string, unknown>
): string {
  const message = toErrorMessage(error);
  logger.error(
    {
      action,
      error: message,
      ...summarizeActionDetails(details)
    },
    "action-error"
  );
  pushActionEvent(action, "error", { ...details, error: message });
  pushSystem("Action failed", { action, ...details, error: message });
  return message;
}

function pushSystem(message: string, details: Record<string, unknown> = {}): void {
  logger.info({ message, ...details }, "system-event");
  pushHistory("system", "system", { message, details });
}

function recordServerErrorEvent(input: {
  source: string;
  operation: string;
  message: string;
  name: string | null;
  stack: string | null;
  requestId: string | null;
  threadId: string | null;
  url: string | null;
  details: Record<string, string | number | boolean | null>;
}): void {
  const occurredAt = new Date().toISOString();
  const event = clientErrorStore.recordServerError({
    source: input.source,
    operation: input.operation,
    message: input.message,
    name: input.name,
    stack: input.stack,
    requestId: input.requestId,
    threadId: input.threadId,
    url: input.url,
    details: input.details,
    occurredAt
  });

  logger.error(
    {
      errorId: event.errorId,
      origin: event.origin,
      source: event.source,
      operation: event.operation,
      requestId: event.requestId,
      threadId: event.threadId,
      message: event.message
    },
    "client-error-recorded"
  );
}

let codexAdapter: CodexAgentAdapter | null = null;
let openCodeAdapter: OpenCodeAgentAdapter | null = null;
const adapters: AgentAdapter[] = [];

async function checkAndNotifyThreadCompletion(threadId: string): Promise<void> {
  if (!codexAdapter) {
    return;
  }

  if (completionChecksInFlight.has(threadId)) {
    return;
  }
  completionChecksInFlight.add(threadId);

  try {
    const liveState = await codexAdapter.readLiveState(threadId);
    const completionCandidate = completionDetector.detect(threadId, liveState.conversationState);
    if (!completionCandidate) {
      return;
    }

    const hasNtfyTarget = ntfyNotifier.isEnabled();
    const subscriptions = pushService.isEnabled() ? pushStore.listSubscriptions() : [];
    const hasWebPushTarget = subscriptions.length > 0;
    if (!hasNtfyTarget && !hasWebPushTarget) {
      return;
    }

    const preview = readThreadPreview(liveState.conversationState);

    let ntfyDelivered = false;
    let ntfyMessageId: string | null = null;
    if (hasNtfyTarget) {
      try {
        const publishResult = await ntfyNotifier.publishThreadCompleted({
          threadId: completionCandidate.threadId,
          preview,
          agentText: completionCandidate.agentText
        });
        ntfyDelivered = true;
        ntfyMessageId = publishResult.messageId;
      } catch (error) {
        logger.warn(
          {
            threadId,
            error: toErrorMessage(error)
          },
          "ntfy-publish-failed"
        );
      }
    }

    let webPushAttempted = 0;
    let webPushDelivered = 0;
    let webPushFailures = 0;
    if (hasWebPushTarget) {
      const payload = buildThreadCompletionPushPayload({
        threadId: completionCandidate.threadId,
        turnId: completionCandidate.turnId,
        preview,
        agentText: completionCandidate.agentText,
        privateMode: subscriptions.some((subscription) => subscription.settings.privateMode)
      });

      try {
        const sendResult = await pushService.sendToSubscriptions(subscriptions, payload);
        webPushAttempted = sendResult.attempted;
        webPushDelivered = sendResult.delivered;
        webPushFailures = sendResult.failures.length;

        for (const endpoint of sendResult.prunedEndpoints) {
          pushStore.removeSubscriptionByEndpoint(endpoint);
        }

        pushSendStore.setLatest({
          notificationId: payload.notificationId,
          threadId: completionCandidate.threadId,
          turnId: completionCandidate.turnId,
          sentAt: payload.createdAt,
          attempted: sendResult.attempted,
          delivered: sendResult.delivered,
          failures: sendResult.failures.length
        });

        if (sendResult.failures.length > 0) {
          logger.warn(
            {
              threadId,
              failures: sendResult.failures
            },
            "push-completion-send-failed"
          );
        }
      } catch (error) {
        logger.warn(
          {
            threadId,
            error: toErrorMessage(error)
          },
          "push-completion-send-threw"
        );
      }
    }

    if (!ntfyDelivered && webPushDelivered === 0) {
      return;
    }

    pushStore.setCompletionWatermark(threadId, completionCandidate.marker);
    completionDetector.commit(threadId, completionCandidate.marker);
    pushSystem("thread completion notification sent", {
      threadId,
      ntfyDelivered,
      ...(ntfyMessageId ? { ntfyMessageId } : {}),
      webPushAttempted,
      webPushDelivered,
      webPushFailures
    });
  } catch (error) {
    logger.warn(
      {
        threadId,
        error: toErrorMessage(error)
      },
      "completion-notification-check-failed"
    );
  } finally {
    completionChecksInFlight.delete(threadId);
  }
}

function scheduleThreadCompletionCheck(threadId: string): void {
  const shouldRunCompletionCheck = ntfyNotifier.isEnabled()
    || (pushService.isEnabled() && pushStore.getSubscriptionCount() > 0);

  if (!shouldRunCompletionCheck) {
    return;
  }

  const existingTimer = completionCheckTimers.get(threadId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    completionCheckTimers.delete(threadId);
    void checkAndNotifyThreadCompletion(threadId);
  }, NTFY_COMPLETION_DEBOUNCE_MS);
  completionCheckTimers.set(threadId, timer);
}

for (const agentId of configuredAgentIds) {
  if (agentId === "codex") {
    codexAdapter = new CodexAgentAdapter({
      appExecutable: codexExecutable,
      socketPath: ipcSocketPath,
      workspaceDir: DEFAULT_WORKSPACE,
      userAgent: USER_AGENT,
      reconnectDelayMs: IPC_RECONNECT_DELAY_MS,
      onStateChange: () => {
        broadcastRuntimeState();
      }
    });

    codexAdapter.onIpcFrame((event) => {
      pushHistory("ipc", event.direction, event.frame, {
        method: event.method,
        threadId: event.threadId
      });
      if (event.method === "thread-stream-state-changed" && event.threadId) {
        scheduleThreadCompletionCheck(event.threadId);
      }
    });

    adapters.push(codexAdapter);
    continue;
  }

  if (agentId === "opencode") {
    openCodeAdapter = new OpenCodeAgentAdapter();
    adapters.push(openCodeAdapter);
  }
}

const registry = new AgentRegistry(adapters);

function buildAgentDescriptor(adapter: AgentAdapter, projectDirectories: string[]): AgentDescriptor {
  return {
    id: adapter.id,
    label: adapter.label,
    enabled: adapter.isEnabled(),
    connected: adapter.isConnected(),
    capabilities: adapter.capabilities,
    projectDirectories
  };
}

function getRuntimeStateSnapshot(): Record<string, unknown> {
  const codexRuntimeState = codexAdapter?.getRuntimeState();

  return {
    appExecutable: codexExecutable,
    socketPath: ipcSocketPath,
    workspaceDir: DEFAULT_WORKSPACE,
    gitCommit,
    appReady: codexRuntimeState?.appReady ?? false,
    ipcConnected: codexRuntimeState?.ipcConnected ?? false,
    ipcInitialized: codexRuntimeState?.ipcInitialized ?? false,
    codexAvailable: codexRuntimeState?.codexAvailable ?? false,
    lastError: runtimeLastError ?? codexRuntimeState?.lastError ?? null,
    historyCount: history.length,
    threadOwnerCount: codexAdapter?.getThreadOwnerCount() ?? 0,
    pushEnabled: pushService.isEnabled(),
    pushSubscriptionCount: pushStore.getSubscriptionCount(),
    pushReceiptCount: pushReceiptStore.getCount(),
    clientErrorCount: clientErrorStore.getCount(),
    activeTrace: activeTrace?.summary ?? null
  };
}

function broadcastSse(payload: unknown): void {
  for (const client of sseClients) {
    eventResponse(client, payload);
  }
}

function writeSseKeepalive(): void {
  for (const client of sseClients) {
    try {
      client.write(": keepalive\n\n");
    } catch {
      sseClients.delete(client);
    }
  }
}

function broadcastRuntimeState(): void {
  broadcastSse({
    type: "state",
    state: getRuntimeStateSnapshot()
  });
}

setInterval(() => {
  writeSseKeepalive();
}, SSE_KEEPALIVE_INTERVAL_MS);

function resolveCreateThreadAdapter(
  requestedAgentId: AgentId | undefined
): AgentAdapter | null {
  if (requestedAgentId) {
    const adapter = registry.getAdapter(requestedAgentId);
    if (!adapter) {
      return null;
    }
    if (!adapter.isEnabled()) {
      return null;
    }
    return adapter;
  }

  const defaultAgentId = registry.resolveDefaultAgentId();
  if (!defaultAgentId) {
    return null;
  }

  return registry.getAdapter(defaultAgentId);
}

function resolveAdapterForThread(threadId: string):
  | { ok: true; adapter: AgentAdapter; agentId: AgentId }
  | { ok: false; status: number; error: string } {
  const registeredAgentId = threadIndex.resolve(threadId);
  if (!registeredAgentId) {
    return {
      ok: false,
      status: 404,
      error: `Thread ${threadId} is not registered. Refresh thread list and try again.`
    };
  }

  const adapter = registry.getAdapter(registeredAgentId);
  if (!adapter || !adapter.isEnabled()) {
    return {
      ok: false,
      status: 503,
      error: `Agent ${registeredAgentId} is not enabled for thread ${threadId}.`
    };
  }

  if (!adapter.isConnected()) {
    return {
      ok: false,
      status: 503,
      error: `Agent ${registeredAgentId} is not connected for thread ${threadId}.`
    };
  }

  return {
    ok: true,
    adapter,
    agentId: registeredAgentId
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      jsonResponse(res, 400, { ok: false, error: "Missing request URL" });
      return;
    }

    if (req.method === "OPTIONS") {
      jsonResponse(res, 204, {});
      return;
    }

    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    const pathname = url.pathname;
    const segments = pathname.split("/").filter(Boolean);

    if (req.method === "GET" && pathname === "/healthz") {
      jsonResponse(res, 200, {
        ok: true,
        service: "farfield-web-shell",
        buildId: WEB_HEALTH_BUILD_ID,
        gitCommit,
        serviceWorkerVersion: WEB_HEALTH_SERVICE_WORKER_VERSION,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!requireApiAuth(req, res, pathname)) {
      return;
    }

    if (req.method === "GET" && pathname === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "x-farfield-token"
      });
      res.write("retry: 1000\n\n");

      sseClients.add(res);
      eventResponse(res, {
        type: "state",
        state: getRuntimeStateSnapshot()
      });

      req.on("close", () => {
        sseClients.delete(res);
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/health") {
      jsonResponse(res, 200, {
        ok: true,
        state: getRuntimeStateSnapshot()
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/events/session") {
      const response = EventsSessionResponseSchema.parse({
        ok: true,
        authRequired: API_AUTH_REQUIRED,
        bootstrapped: true,
        expiresAt: null
      });
      jsonResponse(res, 200, response);
      return;
    }

    if (req.method === "GET" && pathname === "/api/agents") {
      const descriptors = await Promise.all(
        registry.listAdapters().map(async (adapter) => {
          if (!adapter.listProjectDirectories || !adapter.isConnected()) {
            return buildAgentDescriptor(adapter, []);
          }

          try {
            const projectDirectories = await adapter.listProjectDirectories();
            return buildAgentDescriptor(adapter, projectDirectories);
          } catch (error) {
            logger.warn(
              {
                agentId: adapter.id,
                error: toErrorMessage(error)
              },
              "agent-project-directory-list-failed"
            );
            return buildAgentDescriptor(adapter, []);
          }
        })
      );

      const defaultAgentId = registry.resolveDefaultAgentId() ?? configuredAgentIds[0];

      jsonResponse(res, 200, {
        ok: true,
        agents: descriptors,
        defaultAgentId
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/threads") {
      const body = parseBody(StartThreadBodySchema, await readJsonBody(req));
      const adapter = resolveCreateThreadAdapter(body.agentId);

      if (!adapter) {
        jsonResponse(res, 503, {
          ok: false,
          error: body.agentId
            ? `Requested agent ${body.agentId} is not enabled.`
            : "No enabled agent is available."
        });
        return;
      }

      pushActionEvent("thread-create", "attempt", {
        agentId: adapter.id,
        cwd: body.cwd ?? null,
        model: body.model ?? null
      });

      try {
        const createInput = {
          ...(body.cwd
            ? { cwd: body.cwd }
            : adapter.id === "codex"
              ? { cwd: DEFAULT_WORKSPACE }
              : {}),
          ...(body.model ? { model: body.model } : {}),
          ...(body.modelProvider ? { modelProvider: body.modelProvider } : {}),
          ...(body.personality ? { personality: body.personality } : {}),
          ...(body.sandbox ? { sandbox: body.sandbox } : {}),
          ...(body.approvalPolicy ? { approvalPolicy: body.approvalPolicy } : {}),
          ...(typeof body.ephemeral === "boolean" ? { ephemeral: body.ephemeral } : {})
        };
        const result = await adapter.createThread(createInput);

        threadIndex.register(result.threadId, adapter.id);

        pushActionEvent("thread-create", "success", {
          agentId: adapter.id,
          threadId: result.threadId,
          cwd: result.cwd ?? result.thread.cwd ?? null
        });

        jsonResponse(res, 200, {
          ok: true,
          ...result,
          threadId: result.threadId,
          agentId: adapter.id
        });
      } catch (error) {
        const message = pushActionError("thread-create", error, {
          agentId: adapter.id,
          cwd: body.cwd ?? null
        });
        jsonResponse(res, 500, { ok: false, error: message });
      }
      return;
    }

    if (req.method === "GET" && pathname === "/api/threads") {
      const limit = parseInteger(url.searchParams.get("limit"), 80);
      const archived = parseBoolean(url.searchParams.get("archived"), false);
      const all = parseBoolean(url.searchParams.get("all"), false);
      const maxPages = parseInteger(url.searchParams.get("maxPages"), 20);
      const cursor = url.searchParams.get("cursor") ?? null;
      const requestedSortKey = url.searchParams.get("sortKey");
      const parsedSortKey = parseThreadSortKey(requestedSortKey);
      if (requestedSortKey && !parsedSortKey) {
        jsonResponse(res, 400, {
          ok: false,
          error: `Invalid sortKey: ${requestedSortKey}`
        });
        return;
      }
      const sortKey: ThreadSortKey = parsedSortKey ?? "updated_at";
      const cwd = normalizeOptionalString(url.searchParams.get("cwd"));

      const enabledAdapters = registry.listEnabled();
      const mergedData: ThreadListItemWithAgentId[] = [];
      let nextCursor: string | null = null;
      let combinedPages = 0;
      let hasPages = false;
      let combinedTruncated = false;
      let hasTruncated = false;

      for (const adapter of enabledAdapters) {
        try {
          const result = await adapter.listThreads({
            limit,
            archived,
            all,
            maxPages,
            cursor,
            sortKey,
            cwd
          });

          if (!nextCursor && result.nextCursor) {
            nextCursor = result.nextCursor;
          }
          if (typeof result.pages === "number") {
            combinedPages += result.pages;
            hasPages = true;
          }
          if (typeof result.truncated === "boolean") {
            combinedTruncated = combinedTruncated || result.truncated;
            hasTruncated = true;
          }

          for (const thread of result.data) {
            threadIndex.register(thread.id, adapter.id);
            mergedData.push({
              ...thread,
              agentId: adapter.id
            });
          }
        } catch (error) {
          logger.warn(
            {
              agentId: adapter.id,
              error: toErrorMessage(error)
            },
            "agent-list-threads-failed"
          );
        }
      }

      mergedData.sort((left, right) => compareThreadListItems(left, right, sortKey));

      jsonResponse(res, 200, {
        ok: true,
        data: mergedData,
        nextCursor,
        ...(hasPages ? { pages: combinedPages } : {}),
        ...(hasTruncated ? { truncated: combinedTruncated } : {})
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/config/defaults") {
      const requestedAgentRaw = url.searchParams.get("agentId");
      const requestedAgentId = parseAgentId(requestedAgentRaw);
      if (requestedAgentRaw && !requestedAgentId) {
        jsonResponse(res, 400, {
          ok: false,
          error: `Invalid agentId: ${requestedAgentRaw}`
        });
        return;
      }

      const resolvedAgentId = requestedAgentId ?? registry.resolveDefaultAgentId();
      if (!resolvedAgentId) {
        jsonResponse(res, 200, {
          ok: true,
          agentId: null,
          model: null,
          reasoningEffort: null
        });
        return;
      }

      const adapter = registry.getAdapter(resolvedAgentId);
      if (!adapter || !adapter.isEnabled() || !adapter.readConfigDefaults) {
        jsonResponse(res, 200, {
          ok: true,
          agentId: resolvedAgentId,
          model: null,
          reasoningEffort: null
        });
        return;
      }

      try {
        const defaults = await adapter.readConfigDefaults();
        jsonResponse(res, 200, {
          ok: true,
          agentId: resolvedAgentId,
          model: defaults.model,
          reasoningEffort: defaults.reasoningEffort
        });
      } catch (error) {
        logger.warn(
          {
            agentId: resolvedAgentId,
            error: toErrorMessage(error)
          },
          "agent-config-defaults-read-failed"
        );
        jsonResponse(res, 200, {
          ok: true,
          agentId: resolvedAgentId,
          model: null,
          reasoningEffort: null
        });
      }
      return;
    }

    if (req.method === "GET" && pathname === "/api/models") {
      const adapter = registry.resolveFirstWithCapability("canListModels");
      if (!adapter || !adapter.listModels) {
        jsonResponse(res, 200, {
          ok: true,
          data: [],
          nextCursor: null
        });
        return;
      }

      const limit = parseInteger(url.searchParams.get("limit"), 100);
      try {
        const result = await withTimeout(
          adapter.listModels(limit),
          CAPABILITY_LIST_TIMEOUT_MS,
          "models listing"
        );
        jsonResponse(res, 200, { ok: true, ...result });
      } catch (error) {
        const message = toErrorMessage(error);
        logger.warn(
          {
            error: message
          },
          "models-list-timeout"
        );
        jsonResponse(res, 503, {
          ok: false,
          error: `Failed to list models: ${message}`
        });
      }
      return;
    }

    if (req.method === "GET" && pathname === "/api/collaboration-modes") {
      const adapter = registry.resolveFirstWithCapability("canListCollaborationModes");
      if (!adapter || !adapter.listCollaborationModes) {
        jsonResponse(res, 200, {
          ok: true,
          data: []
        });
        return;
      }

      try {
        const result = await withTimeout(
          adapter.listCollaborationModes(),
          CAPABILITY_LIST_TIMEOUT_MS,
          "collaboration modes listing"
        );
        jsonResponse(res, 200, { ok: true, ...result });
      } catch (error) {
        const message = toErrorMessage(error);
        logger.warn(
          {
            error: message
          },
          "collaboration-modes-list-timeout"
        );
        jsonResponse(res, 503, {
          ok: false,
          error: `Failed to list collaboration modes: ${message}`
        });
      }
      return;
    }

    if (segments[0] === "api" && segments[1] === "push") {
      if (req.method === "GET" && pathname === "/api/push/status") {
        jsonResponse(res, 200, {
          ok: true,
          enabled: pushService.isEnabled(),
          permissionRequired: true,
          subscriptionCount: pushStore.getSubscriptionCount(),
          privateModeDefault: PUSH_PRIVATE_MODE_DEFAULT
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/push/vapid-public-key") {
        if (!pushService.isEnabled()) {
          jsonResponse(res, 503, {
            ok: false,
            error: "Push notifications are disabled"
          });
          return;
        }

        jsonResponse(res, 200, {
          ok: true,
          publicKey: pushService.getPublicKey()
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/push/receipts/latest") {
        jsonResponse(res, 200, {
          ok: true,
          latest: pushReceiptStore.getLatest(),
          count: pushReceiptStore.getCount()
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/push/receipts") {
        const body = parseBody(CreatePushReceiptBodySchema, await readJsonBody(req));
        const event = PushReceiptEventSchema.parse(body.event);
        const normalizedBody: CreatePushReceiptBody = {
          notificationId: body.notificationId,
          event,
          url: body.url,
          threadId: body.threadId ?? null,
          turnId: body.turnId ?? null,
          ...(body.message ? { message: body.message } : {}),
          createdAt: body.createdAt
        };

        pushReceiptStore.add({
          notificationId: normalizedBody.notificationId,
          event: normalizedBody.event,
          url: normalizedBody.url,
          threadId: normalizedBody.threadId ?? null,
          turnId: normalizedBody.turnId ?? null,
          message: normalizedBody.message ?? null,
          createdAt: normalizedBody.createdAt
        });

        jsonResponse(res, 200, {
          ok: true,
          recorded: true
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/push/sends/latest") {
        jsonResponse(res, 200, {
          ok: true,
          latest: pushSendStore.getLatest()
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/push/local-ca") {
        const available = fs.existsSync(pushLocalCaSourcePath);
        jsonResponse(res, 200, {
          ok: true,
          available,
          downloadPath: available ? "/api/push/local-ca/download" : null,
          sourcePath: available ? pushLocalCaSourcePath : null
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/push/local-ca/download") {
        if (!fs.existsSync(pushLocalCaSourcePath)) {
          jsonResponse(res, 404, {
            ok: false,
            error: "Local Caddy root certificate not found"
          });
          return;
        }

        const fileName = path.basename(pushLocalCaSourcePath);
        const data = fs.readFileSync(pushLocalCaSourcePath);
        res.writeHead(200, {
          "Content-Type": "application/x-pem-file",
          "Content-Length": data.length,
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Access-Control-Allow-Origin": "*"
        });
        res.end(data);
        return;
      }

      if (req.method === "POST" && pathname === "/api/push/subscriptions") {
        const body = parseBody(CreatePushSubscriptionBodySchema, await readJsonBody(req));
        const subscription = pushStore.upsertSubscription(body.subscription, {
          privateMode: body.settings?.privateMode ?? PUSH_PRIVATE_MODE_DEFAULT
        });
        jsonResponse(res, 200, {
          ok: true,
          subscriptionId: subscription.id
        });
        return;
      }

      if (req.method === "DELETE" && pathname === "/api/push/subscriptions") {
        const body = parseBody(DeletePushSubscriptionBodySchema, await readJsonBody(req));
        const deleted = pushStore.removeSubscriptionByEndpoint(body.endpoint);
        jsonResponse(res, 200, {
          ok: true,
          deleted
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/push/test") {
        const body = parseBody(PushTestBodySchema, await readJsonBody(req));
        const subscriptions = pushStore.listSubscriptions();
        const dryRun = body.dryRun === true;

        if (!pushService.isEnabled()) {
          jsonResponse(res, 200, {
            ok: true,
            dryRun,
            notificationId: null,
            ready: false,
            reason: "Push notifications are disabled",
            attempted: 0,
            delivered: 0,
            failures: 0
          });
          return;
        }

        if (subscriptions.length === 0) {
          jsonResponse(res, 200, {
            ok: true,
            dryRun,
            notificationId: null,
            ready: false,
            reason: "No push subscriptions registered",
            attempted: 0,
            delivered: 0,
            failures: 0
          });
          return;
        }

        if (dryRun) {
          jsonResponse(res, 200, {
            ok: true,
            dryRun: true,
            notificationId: null,
            ready: true,
            reason: "Push notifications are configured and subscriptions are present",
            attempted: subscriptions.length,
            delivered: 0,
            failures: 0
          });
          return;
        }

        const privateMode = subscriptions.every((subscription) => subscription.settings.privateMode);
        const payload = buildPushTestPayload(body, privateMode);
        const sendResult = await pushService.sendToSubscriptions(subscriptions, payload);

        for (const endpoint of sendResult.prunedEndpoints) {
          pushStore.removeSubscriptionByEndpoint(endpoint);
        }

        pushSendStore.setLatest({
          notificationId: payload.notificationId,
          threadId: payload.threadId,
          turnId: payload.turnId,
          sentAt: payload.createdAt,
          attempted: sendResult.attempted,
          delivered: sendResult.delivered,
          failures: sendResult.failures.length
        });

        jsonResponse(res, 200, {
          ok: true,
          dryRun: false,
          notificationId: payload.notificationId,
          ready: true,
          reason: "Push notification attempted",
          attempted: sendResult.attempted,
          delivered: sendResult.delivered,
          failures: sendResult.failures.length
        });
        return;
      }
    }

    if (segments[0] === "api" && segments[1] === "threads" && segments[2]) {
      const threadId = decodeURIComponent(segments[2]);
      const resolved = resolveAdapterForThread(threadId);
      if (!resolved.ok) {
        jsonResponse(res, resolved.status, {
          ok: false,
          error: resolved.error,
          threadId
        });
        return;
      }

      const adapter = resolved.adapter;

      if (req.method === "GET" && segments.length === 3) {
        const includeTurns = parseBoolean(url.searchParams.get("includeTurns"), true);

        try {
          const result = await adapter.readThread({ threadId, includeTurns });
          jsonResponse(res, 200, {
            ok: true,
            ...result,
            agentId: resolved.agentId
          });
          return;
        } catch (error) {
          if (
            resolved.agentId === "codex" &&
            codexAdapter &&
            error instanceof Error &&
            codexAdapter.isThreadNotLoadedError(error)
          ) {
            jsonResponse(res, 404, {
              ok: false,
              error: `Thread not loaded in app-server: ${threadId}`,
              threadId
            });
            return;
          }
          throw error;
        }
      }

      if (req.method === "GET" && segments[3] === "live-state") {
        if (!adapter.capabilities.canReadLiveState || !adapter.readLiveState) {
          jsonResponse(res, 400, {
            ok: false,
            error: `Agent ${resolved.agentId} does not support live thread state`,
            threadId
          });
          return;
        }

        const liveState = await adapter.readLiveState(threadId);
        jsonResponse(res, 200, {
          ok: true,
          threadId,
          ownerClientId: liveState.ownerClientId,
          conversationState: liveState.conversationState,
          liveStateError: liveState.liveStateError
        });
        return;
      }

      if (req.method === "GET" && segments[3] === "stream-events") {
        if (!adapter.capabilities.canReadStreamEvents || !adapter.readStreamEvents) {
          jsonResponse(res, 400, {
            ok: false,
            error: `Agent ${resolved.agentId} does not support stream events`,
            threadId
          });
          return;
        }

        const limit = parseInteger(url.searchParams.get("limit"), 60);
        const streamEvents = await adapter.readStreamEvents(threadId, limit);
        jsonResponse(res, 200, {
          ok: true,
          threadId,
          ownerClientId: streamEvents.ownerClientId,
          events: streamEvents.events
        });
        return;
      }

      if (req.method === "POST" && segments[3] === "messages") {
        const body = parseBody(SendMessageBodySchema, await readJsonBody(req));

        pushActionEvent("messages", "attempt", {
          agentId: resolved.agentId,
          threadId,
          textLength: body.text.length
        });

        try {
          await adapter.sendMessage({
            threadId,
            text: body.text,
            ...(body.ownerClientId ? { ownerClientId: body.ownerClientId } : {}),
            ...(body.cwd ? { cwd: body.cwd } : {}),
            ...(typeof body.isSteering === "boolean" ? { isSteering: body.isSteering } : {})
          });
        } catch (error) {
          const message = pushActionError("messages", error, {
            agentId: resolved.agentId,
            threadId
          });
          jsonResponse(res, 500, { ok: false, error: message, threadId });
          return;
        }

        pushActionEvent("messages", "success", {
          agentId: resolved.agentId,
          threadId
        });

        jsonResponse(res, 200, {
          ok: true,
          threadId
        });
        return;
      }

      if (req.method === "POST" && segments[3] === "archive") {
        if (!adapter.archiveThread) {
          jsonResponse(res, 400, {
            ok: false,
            error: `Agent ${resolved.agentId} does not support thread archive`,
            threadId
          });
          return;
        }

        pushActionEvent("thread-archive", "attempt", {
          agentId: resolved.agentId,
          threadId
        });

        try {
          await adapter.archiveThread({ threadId });
          pushActionEvent("thread-archive", "success", {
            agentId: resolved.agentId,
            threadId
          });
          jsonResponse(res, 200, {
            ok: true,
            threadId
          });
        } catch (error) {
          const message = pushActionError("thread-archive", error, {
            agentId: resolved.agentId,
            threadId
          });
          jsonResponse(res, 500, {
            ok: false,
            error: message,
            threadId
          });
        }
        return;
      }

      if (req.method === "POST" && segments[3] === "unarchive") {
        if (!adapter.unarchiveThread) {
          jsonResponse(res, 400, {
            ok: false,
            error: `Agent ${resolved.agentId} does not support thread unarchive`,
            threadId
          });
          return;
        }

        pushActionEvent("thread-unarchive", "attempt", {
          agentId: resolved.agentId,
          threadId
        });

        try {
          await adapter.unarchiveThread({ threadId });
          pushActionEvent("thread-unarchive", "success", {
            agentId: resolved.agentId,
            threadId
          });
          jsonResponse(res, 200, {
            ok: true,
            threadId
          });
        } catch (error) {
          const message = pushActionError("thread-unarchive", error, {
            agentId: resolved.agentId,
            threadId
          });
          jsonResponse(res, 500, {
            ok: false,
            error: message,
            threadId
          });
        }
        return;
      }

      if (req.method === "POST" && segments[3] === "collaboration-mode") {
        if (!adapter.capabilities.canSetCollaborationMode || !adapter.setCollaborationMode) {
          jsonResponse(res, 400, {
            ok: false,
            error: `Agent ${resolved.agentId} does not support collaboration modes`,
            threadId
          });
          return;
        }

        const body = parseBody(SetModeBodySchema, await readJsonBody(req));

        pushActionEvent("collaboration-mode", "attempt", {
          agentId: resolved.agentId,
          threadId,
          collaborationMode: body.collaborationMode
        });

        try {
          const result = await adapter.setCollaborationMode({
            threadId,
            ...(body.ownerClientId ? { ownerClientId: body.ownerClientId } : {}),
            collaborationMode: body.collaborationMode
          });

          pushActionEvent("collaboration-mode", "success", {
            agentId: resolved.agentId,
            threadId,
            ownerClientId: result.ownerClientId
          });

          jsonResponse(res, 200, {
            ok: true,
            threadId,
            ownerClientId: result.ownerClientId
          });
        } catch (error) {
          const message = pushActionError("collaboration-mode", error, {
            agentId: resolved.agentId,
            threadId
          });
          jsonResponse(res, 500, {
            ok: false,
            error: message,
            threadId
          });
        }
        return;
      }

      if (req.method === "POST" && segments[3] === "user-input") {
        if (!adapter.capabilities.canSubmitUserInput || !adapter.submitUserInput) {
          jsonResponse(res, 400, {
            ok: false,
            error: `Agent ${resolved.agentId} does not support user input submission`,
            threadId
          });
          return;
        }

        const body = parseBody(SubmitUserInputBodySchema, await readJsonBody(req));

        pushActionEvent("user-input", "attempt", {
          agentId: resolved.agentId,
          threadId,
          requestId: body.requestId
        });

        try {
          const result = await adapter.submitUserInput({
            threadId,
            ...(body.ownerClientId ? { ownerClientId: body.ownerClientId } : {}),
            requestId: body.requestId,
            response: body.response
          });

          pushActionEvent("user-input", "success", {
            agentId: resolved.agentId,
            threadId,
            ownerClientId: result.ownerClientId,
            requestId: result.requestId
          });

          jsonResponse(res, 200, {
            ok: true,
            threadId,
            ownerClientId: result.ownerClientId,
            requestId: result.requestId
          });
        } catch (error) {
          const message = pushActionError("user-input", error, {
            agentId: resolved.agentId,
            threadId,
            requestId: body.requestId
          });
          jsonResponse(res, 500, {
            ok: false,
            error: message,
            threadId,
            requestId: body.requestId
          });
        }
        return;
      }

      if (req.method === "POST" && segments[3] === "interrupt") {
        const body = parseBody(InterruptBodySchema, await readJsonBody(req));

        pushActionEvent("interrupt", "attempt", {
          agentId: resolved.agentId,
          threadId
        });

        try {
          await adapter.interrupt({
            threadId,
            ...(body.ownerClientId ? { ownerClientId: body.ownerClientId } : {})
          });
        } catch (error) {
          const message = pushActionError("interrupt", error, {
            agentId: resolved.agentId,
            threadId
          });
          jsonResponse(res, 500, { ok: false, error: message, threadId });
          return;
        }

        pushActionEvent("interrupt", "success", {
          agentId: resolved.agentId,
          threadId
        });

        jsonResponse(res, 200, {
          ok: true,
          threadId
        });
        return;
      }
    }

    if (segments[0] === "api" && segments[1] === "debug") {
      if (req.method === "POST" && pathname === "/api/debug/client-errors") {
        const body = parseBody(CreateDebugClientErrorBodySchema, await readJsonBody(req));
        const event = clientErrorStore.recordClientError(body);
        logger.error(
          {
            errorId: event.errorId,
            origin: event.origin,
            source: event.source,
            operation: event.operation,
            requestId: event.requestId,
            threadId: event.threadId,
            message: event.message
          },
          "client-error-recorded"
        );
        jsonResponse(res, 200, {
          ok: true,
          errorId: event.errorId,
          sessionId: event.sessionId,
          recordedAt: event.recordedAt
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/debug/client-errors") {
        const limit = parseInteger(url.searchParams.get("limit"), 120);
        const data = clientErrorStore.list(limit);
        jsonResponse(res, 200, {
          ok: true,
          data,
          sessionId: clientErrorStore.getSessionId(),
          sessionLogPath: clientErrorStore.getSessionLogPath()
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/debug/client-errors/session-log") {
        const filePath = clientErrorStore.getSessionLogPath();
        if (!fs.existsSync(filePath)) {
          jsonResponse(res, 404, {
            ok: false,
            error: "Client error session log not found"
          });
          return;
        }

        const fileName = path.basename(filePath);
        const data = fs.readFileSync(filePath);
        res.writeHead(200, {
          "Content-Type": "application/x-ndjson",
          "Content-Length": data.length,
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Access-Control-Allow-Origin": "*"
        });
        res.end(data);
        return;
      }

      const clientErrorIdSegment = segments[3];
      if (
        req.method === "GET" &&
        segments[2] === "client-errors" &&
        segments.length === 4 &&
        typeof clientErrorIdSegment === "string"
      ) {
        const errorId = decodeURIComponent(clientErrorIdSegment);
        const errorEvent = clientErrorStore.getById(errorId);
        if (!errorEvent) {
          jsonResponse(res, 404, {
            ok: false,
            error: "Client error not found"
          });
          return;
        }

        jsonResponse(res, 200, {
          ok: true,
          error: errorEvent,
          sessionId: clientErrorStore.getSessionId(),
          sessionLogPath: clientErrorStore.getSessionLogPath()
        });
        return;
      }

      const historyEntrySegment = segments[3];
      if (
        req.method === "GET" &&
        segments[2] === "history" &&
        segments.length === 4 &&
        typeof historyEntrySegment === "string"
      ) {
        const entryId = decodeURIComponent(historyEntrySegment);
        const entry = history.find((item) => item.id === entryId) ?? null;
        if (!entry) {
          jsonResponse(res, 404, { ok: false, error: "History entry not found" });
          return;
        }

        jsonResponse(res, 200, {
          ok: true,
          entry,
          fullPayload: historyById.get(entryId) ?? null
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/debug/history") {
        const limit = parseInteger(url.searchParams.get("limit"), 120);
        const data = history.slice(-limit);
        jsonResponse(res, 200, { ok: true, history: data });
        return;
      }

      if (req.method === "POST" && pathname === "/api/debug/replay") {
        if (!codexAdapter) {
          jsonResponse(res, 503, {
            ok: false,
            error: "Codex adapter is not enabled"
          });
          return;
        }

        if (!codexAdapter.isIpcReady()) {
          jsonResponse(res, 503, {
            ok: false,
            error: codexAdapter.getRuntimeState().lastError ?? "Desktop IPC is not connected"
          });
          return;
        }

        const body = parseBody(ReplayBodySchema, await readJsonBody(req));
        const entry = history.find((item) => item.id === body.entryId);
        if (!entry) {
          jsonResponse(res, 404, { ok: false, error: "History entry not found" });
          return;
        }

        let frame: ParsedReplayFrame;
        try {
          frame = parseReplayFrame(historyById.get(entry.id));
        } catch (error) {
          jsonResponse(res, 409, {
            ok: false,
            error: toErrorMessage(error)
          });
          return;
        }

        const options: SendRequestOptions = {
          ...(frame.targetClientId ? { targetClientId: frame.targetClientId } : {}),
          ...(typeof frame.version === "number" ? { version: frame.version } : {})
        };

        if (frame.type === "request") {
          const replayPromise = codexAdapter.replayRequest(frame.method, frame.params, options);

          if (body.waitForResponse) {
            const response = await replayPromise;
            jsonResponse(res, 200, {
              ok: true,
              replayed: true,
              response
            });
            return;
          }

          void replayPromise.catch((error) => {
            pushSystem("Replay request failed", {
              error: toErrorMessage(error),
              entryId: entry.id
            });
          });

          jsonResponse(res, 200, {
            ok: true,
            replayed: true,
            queued: true
          });
          return;
        }

        codexAdapter.replayBroadcast(frame.method, frame.params, options);
        jsonResponse(res, 200, { ok: true, replayed: true });
        return;
      }

      if (req.method === "GET" && pathname === "/api/debug/trace/status") {
        jsonResponse(res, 200, {
          ok: true,
          active: activeTrace?.summary ?? null,
          recent: recentTraces
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/debug/trace/start") {
        const body = parseBody(TraceStartBodySchema, await readJsonBody(req));
        if (activeTrace) {
          jsonResponse(res, 409, {
            ok: false,
            error: "A trace is already active"
          });
          return;
        }

        ensureTraceDirectory();
        const id = `${Date.now()}-${randomUUID()}`;
        const tracePath = path.join(TRACE_DIR, `${id}.ndjson`);
        const stream = fs.createWriteStream(tracePath, { flags: "a" });

        const summary: TraceSummary = {
          id,
          label: body.label,
          startedAt: new Date().toISOString(),
          stoppedAt: null,
          eventCount: 0,
          path: tracePath
        };

        activeTrace = {
          summary,
          stream
        };

        pushSystem("Trace started", {
          traceId: id,
          label: body.label
        });

        jsonResponse(res, 200, {
          ok: true,
          trace: summary
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/debug/trace/mark") {
        const body = parseBody(TraceMarkBodySchema, await readJsonBody(req));
        if (!activeTrace) {
          jsonResponse(res, 409, { ok: false, error: "No active trace" });
          return;
        }

        const marker = {
          type: "trace-marker",
          at: new Date().toISOString(),
          note: body.note
        };

        activeTrace.stream.write(`${JSON.stringify(marker)}\n`);
        activeTrace.summary.eventCount += 1;

        jsonResponse(res, 200, { ok: true });
        return;
      }

      if (req.method === "POST" && pathname === "/api/debug/trace/stop") {
        if (!activeTrace) {
          jsonResponse(res, 409, { ok: false, error: "No active trace" });
          return;
        }

        const trace = activeTrace;
        activeTrace = null;

        trace.summary.stoppedAt = new Date().toISOString();
        trace.stream.end();

        recentTraces.unshift(trace.summary);
        if (recentTraces.length > 20) {
          recentTraces.splice(20);
        }

        pushSystem("Trace stopped", { traceId: trace.summary.id });

        jsonResponse(res, 200, {
          ok: true,
          trace: trace.summary
        });
        return;
      }

      if (
        req.method === "GET" &&
        segments[2] === "trace" &&
        segments[3] &&
        segments[4] === "download"
      ) {
        const traceId = decodeURIComponent(segments[3]);
        const trace = recentTraces.find((item) => item.id === traceId);

        if (!trace || !fs.existsSync(trace.path)) {
          jsonResponse(res, 404, { ok: false, error: "Trace not found" });
          return;
        }

        const data = fs.readFileSync(trace.path);
        res.writeHead(200, {
          "Content-Type": "application/x-ndjson",
          "Content-Length": data.length,
          "Content-Disposition": `attachment; filename="${trace.id}.ndjson"`,
          "Access-Control-Allow-Origin": "*"
        });
        res.end(data);
        return;
      }
    }

    jsonResponse(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    runtimeLastError = toErrorMessage(error);
    if (error instanceof Error) {
      try {
        recordServerErrorEvent({
          source: "farfield-server",
          operation: "http:request",
          message: runtimeLastError,
          name: error.name,
          stack: error.stack ?? null,
          requestId: null,
          threadId: null,
          url: req.url ?? null,
          details: {
            method: req.method ?? "unknown"
          }
        });
      } catch (recordError) {
        logger.error(
          {
            error: toErrorMessage(recordError),
            originalError: runtimeLastError
          },
          "server-error-record-failed"
        );
      }
    }
    logger.error(
      {
        method: req.method ?? "unknown",
        url: req.url ?? "unknown",
        error: runtimeLastError
      },
      "request-failed"
    );
    pushSystem("Request failed", {
      error: runtimeLastError,
      method: req.method ?? "unknown",
      url: req.url ?? "unknown"
    });
    broadcastRuntimeState();
    jsonResponse(res, 500, {
      ok: false,
      error: runtimeLastError
    });
  }
});

async function start(): Promise<void> {
  ensureTraceDirectory();

  pushSystem("Starting Farfield monitor server", {
    appExecutable: codexExecutable,
    socketPath: ipcSocketPath,
    agentIds: configuredAgentIds
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      reject(error);
    };

    server.once("error", onError);
    server.listen(PORT, HOST, () => {
      server.off("error", onError);
      resolve();
    });
  });

  pushSystem("Monitor server ready", {
    url: `http://${HOST}:${PORT}`,
    appExecutable: codexExecutable,
    socketPath: ipcSocketPath,
    agentIds: configuredAgentIds
  });

  if (pushStateMigration.migrated) {
    pushSystem("Push state migrated", {
      fromPath: pushStateMigration.fromPath,
      toPath: pushStateMigration.toPath
    });
  }

  pushSystem("Push subsystem ready", {
    enabled: pushService.isEnabled(),
    configured: PUSH_ENABLED,
    requiresAuth: API_AUTH_REQUIRED,
    authConfigured: API_AUTH_REQUIRED,
    statePath: pushStatePathResolution.filePath,
    statePathSource: pushStatePathResolution.source,
    receiptsPath: pushReceiptsPath,
    sendsPath: pushSendsPath,
    receiptsMaxCount: PUSH_RECEIPTS_MAX_COUNT,
    receiptsMaxAgeDays: PUSH_RECEIPTS_MAX_AGE_DAYS,
    subscriptionCount: pushStore.getSubscriptionCount(),
    watermarkCount: pushStore.listCompletionWatermarks().length,
    receiptCount: pushReceiptStore.getCount()
  });

  pushSystem("Client error store ready", {
    sessionId: clientErrorStore.getSessionId(),
    sessionLogPath: clientErrorStore.getSessionLogPath(),
    maxEntries: clientErrorMaxEntries
  });

  pushSystem("ntfy notifier ready", ntfyNotifier.getSummary());

  for (const adapter of registry.listAdapters()) {
    try {
      await adapter.start();
      pushSystem("Agent connected", {
        agentId: adapter.id,
        connected: adapter.isConnected()
      });

      if (adapter.id === "opencode" && openCodeAdapter) {
        pushSystem("OpenCode backend connected", {
          url: openCodeAdapter.getUrl()
        });
      }
    } catch (error) {
      pushSystem("Agent failed to connect", {
        agentId: adapter.id,
        error: toErrorMessage(error)
      });
      logger.error(
        {
          agentId: adapter.id,
          error: toErrorMessage(error)
        },
        "agent-start-failed"
      );
    }
  }

  broadcastRuntimeState();
  logger.info({ url: `http://${HOST}:${PORT}` }, "monitor-server-ready");
}

async function shutdown(): Promise<void> {
  if (activeTrace) {
    activeTrace.stream.end();
    activeTrace = null;
  }

  for (const timer of completionCheckTimers.values()) {
    clearTimeout(timer);
  }
  completionCheckTimers.clear();

  await registry.stopAll();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

void start().catch((error) => {
  runtimeLastError = toErrorMessage(error);
  pushSystem("Monitor server failed to start", { error: runtimeLastError });
  logger.fatal({ error: runtimeLastError }, "monitor-server-failed-to-start");
  process.exit(1);
});
