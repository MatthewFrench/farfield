import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  AppServerClient,
  AppServerRpcError,
  AppServerTransportError,
  CodexMonitorService,
  DesktopIpcClient,
  reduceThreadStreamEvents,
  ThreadStreamReductionError,
  type SendRequestOptions
} from "@farfield/api";
import {
  CreatePushReceiptBodySchema,
  CreatePushSubscriptionBodySchema,
  DeletePushSubscriptionBodySchema,
  type CreateDebugClientErrorBody,
  type CollaborationMode,
  type IpcFrame,
  type PushNotificationPayload,
  type PushReceipt,
  type PushSendSummary,
  type ThreadConversationState,
  parseThreadStreamStateChangedBroadcast,
  parseUserInputResponsePayload
} from "@farfield/protocol";
import {
  CreateDebugClientErrorBodySchema,
  InterruptBodySchema,
  parseBody,
  ReplayBodySchema,
  SendMessageBodySchema,
  StartThreadBodySchema,
  SetModeBodySchema,
  SubmitUserInputBodySchema,
  PushTestBodySchema,
  TraceMarkBodySchema,
  TraceStartBodySchema
} from "./http-schemas.js";
import { logger } from "./logger.js";
import { resolveOwnerClientId } from "./thread-owner.js";
import { PushStore } from "./push-store.js";
import { PushReceiptStore } from "./push-receipt-store.js";
import { PushSendStore } from "./push-send-store.js";
import { CompletionDetector, type CompletionCandidate } from "./completion-detector.js";
import { PushService } from "./push-service.js";
import { migratePushStateFile, resolvePushStatePath } from "./push-state-path.js";
import { ClientErrorStore } from "./client-error-store.js";

const HOST = process.env["HOST"] ?? "127.0.0.1";
const PORT = Number(process.env["PORT"] ?? 4311);
const HISTORY_LIMIT = 2_000;
const USER_AGENT = "farfield/0.2.0";
const IPC_RECONNECT_DELAY_MS = 1_000;
const ANSI_ESCAPE_REGEX = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const INVALID_THREAD_STREAM_LOG_INTERVAL_MS = 30_000;
const ERROR_BUDGET_WINDOW_MS = 5 * 60_000;
const SERVER_CLIENT_ERROR_DEDUP_WINDOW_MS = 10_000;
const APP_SERVER_STDERR_LINE_MAX_LENGTH = 1_200;
const APP_SERVER_STDERR_WINDOW_MS = 10_000;
const APP_SERVER_STDERR_MAX_EVENTS_PER_WINDOW = 40;
const APP_SERVER_STDERR_BENIGN_SUMMARY_INTERVAL = 250;
const HISTORY_SSE_DEBOUNCE_MS = 100;
const IPC_HISTORY_WINDOW_MS = 1_000;
const IPC_HISTORY_MAX_EVENTS_PER_WINDOW = 120;
const TRACKED_THREAD_EVENTS_TTL_MS = 10 * 60_000;
const TRACKED_THREAD_EVENTS_MAX = 24;
const UNTRACKED_THREAD_EVENTS_MAX_PER_THREAD = 8;
const UNTRACKED_THREAD_EVENTS_MAX_THREADS = 128;
type AppServerOperationName = "thread/list" | "model/list" | "collaborationMode/list";

interface AppServerOperationStats {
  totalCount: number;
  successCount: number;
  errorCount: number;
  timeoutCount: number;
  inFlightCount: number;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastDurationMs: number | null;
  lastStatus: "ok" | "error" | null;
  lastError: string | null;
}

type AppServerOperationStatsByName = Record<AppServerOperationName, AppServerOperationStats>;

function createAppServerOperationStats(): AppServerOperationStatsByName {
  return {
    "thread/list": {
      totalCount: 0,
      successCount: 0,
      errorCount: 0,
      timeoutCount: 0,
      inFlightCount: 0,
      lastStartedAt: null,
      lastCompletedAt: null,
      lastDurationMs: null,
      lastStatus: null,
      lastError: null
    },
    "model/list": {
      totalCount: 0,
      successCount: 0,
      errorCount: 0,
      timeoutCount: 0,
      inFlightCount: 0,
      lastStartedAt: null,
      lastCompletedAt: null,
      lastDurationMs: null,
      lastStatus: null,
      lastError: null
    },
    "collaborationMode/list": {
      totalCount: 0,
      successCount: 0,
      errorCount: 0,
      timeoutCount: 0,
      inFlightCount: 0,
      lastStartedAt: null,
      lastCompletedAt: null,
      lastDurationMs: null,
      lastStatus: null,
      lastError: null
    }
  };
}

function readPositiveIntegerEnv(name: string, defaultValue: number): number {
  const rawValue = process.env[name];
  if (typeof rawValue === "undefined") {
    return defaultValue;
  }
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    throw new Error(`${name} must be a positive integer when set`);
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer when set`);
  }
  return parsed;
}

const TRACE_DIR = path.resolve(process.cwd(), "traces");
const CLIENT_ERROR_LOG_DIR = path.resolve(process.cwd(), ".runtime", "logs", "errors");
const DEFAULT_WORKSPACE = path.resolve(process.cwd());
const PUSH_STATE_RESOLUTION = resolvePushStatePath({
  envPath: process.env["PUSH_STATE_PATH"],
  appDataPath: process.env["APPDATA"],
  xdgStateHome: process.env["XDG_STATE_HOME"],
  homeDirectory: os.homedir(),
  platform: process.platform,
  moduleDirectory: MODULE_DIRECTORY
});
const PUSH_STATE_PATH = PUSH_STATE_RESOLUTION.filePath;
const PUSH_ENABLED = (process.env["PUSH_ENABLED"] ?? "false").toLowerCase() === "true";
const PUSH_PRIVATE_MODE_DEFAULT = (process.env["PUSH_PRIVATE_MODE_DEFAULT"] ?? "true").toLowerCase() !== "false";
const API_AUTH_TOKEN = (process.env["API_TOKEN"] ?? process.env["PUSH_API_TOKEN"] ?? "").trim();
const PUSH_VAPID_PUBLIC_KEY = (process.env["PUSH_VAPID_PUBLIC_KEY"] ?? "").trim();
const PUSH_VAPID_PRIVATE_KEY = (process.env["PUSH_VAPID_PRIVATE_KEY"] ?? "").trim();
const PUSH_VAPID_SUBJECT = (process.env["PUSH_VAPID_SUBJECT"] ?? "").trim();
const COMPLETION_STATE_BACKFILL_INTERVAL_MS = 2_000;
const MAX_PUSH_RECEIPTS = readPositiveIntegerEnv("PUSH_RECEIPTS_MAX_COUNT", 100);
const PUSH_RECEIPTS_MAX_AGE_DAYS = readPositiveIntegerEnv("PUSH_RECEIPTS_MAX_AGE_DAYS", 7);
const PUSH_RECEIPTS_MAX_AGE_MS = PUSH_RECEIPTS_MAX_AGE_DAYS * 24 * 60 * 60 * 1_000;
const APP_SERVER_REQUEST_TIMEOUT_MS = readPositiveIntegerEnv("APP_SERVER_REQUEST_TIMEOUT_MS", 60_000);
const PUSH_RECEIPTS_PATH = (() => {
  const configuredPath = process.env["PUSH_RECEIPTS_PATH"];
  if (typeof configuredPath === "string" && configuredPath.trim().length > 0) {
    return path.resolve(configuredPath.trim());
  }
  if (typeof configuredPath === "string" && configuredPath.trim().length === 0) {
    throw new Error("PUSH_RECEIPTS_PATH must be a non-empty path when set");
  }
  return path.join(path.dirname(PUSH_STATE_PATH), "push-receipts.json");
})();
const PUSH_SENDS_PATH = (() => {
  const configuredPath = process.env["PUSH_SENDS_PATH"];
  if (typeof configuredPath === "string" && configuredPath.trim().length > 0) {
    return path.resolve(configuredPath.trim());
  }
  if (typeof configuredPath === "string" && configuredPath.trim().length === 0) {
    throw new Error("PUSH_SENDS_PATH must be a non-empty path when set");
  }
  return path.join(path.dirname(PUSH_STATE_PATH), "push-sends.json");
})();
const LOCAL_CA_DOWNLOAD_PATH = "/api/push/local-ca/root.crt";
const LOCAL_CADDY_ROOT_CA_PATH = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Caddy",
  "pki",
  "authorities",
  "local",
  "root.crt"
);
const WEB_SHELL_SERVICE_WORKER_PATH = path.join(DEFAULT_WORKSPACE, "apps", "web", "public", "sw.js");
const WEB_SHELL_SERVICE_WORKER_VERSION = resolveFileContentHash(WEB_SHELL_SERVICE_WORKER_PATH);
const CLIENT_ERROR_SESSION_ID = `session_${randomUUID()}`;
const CLIENT_ERROR_MAX_ENTRIES = 2_000;
const CLIENT_ERROR_SESSION_LOG_PATH = path.join(
  CLIENT_ERROR_LOG_DIR,
  `session-${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}-${process.pid}.ndjson`
);

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

function resolveWebShellBuildId(gitCommit: string | null): string {
  const configured = (process.env["WEB_BUILD_ID"] ?? "").trim();
  if (configured.length > 0) {
    return configured;
  }
  if (process.env["NODE_ENV"] === "production") {
    return gitCommit ?? "dev";
  }
  return "dev";
}

function resolveFileContentHash(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function jsonResponse(res: ServerResponse, statusCode: number, body: unknown): void {
  const encoded = Buffer.from(JSON.stringify(body), "utf8");
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": encoded.length,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type,x-farfield-token",
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

function normalizeStderrLine(line: string): string {
  return line.replace(ANSI_ESCAPE_REGEX, "").trim();
}

interface AppServerStderrLineSummary {
  line: string;
  originalLength: number;
  truncated: boolean;
}

function isKnownBenignAppServerStderr(line: string): boolean {
  const normalized = normalizeStderrLine(line);
  return (
    normalized.includes("codex_core::rollout::list") &&
    normalized.includes("state db missing rollout path for thread")
  ) || (
    normalized.includes("codex_core::state_db: state db record_discrepancy:") &&
    normalized.includes("falling_back")
  );
}

function summarizeStderrLine(line: string): AppServerStderrLineSummary {
  const originalLength = line.length;
  if (originalLength <= APP_SERVER_STDERR_LINE_MAX_LENGTH) {
    return {
      line,
      originalLength,
      truncated: false
    };
  }

  return {
    line: `${line.slice(0, APP_SERVER_STDERR_LINE_MAX_LENGTH)}...`,
    originalLength,
    truncated: true
  };
}

interface AppServerStderrState {
  benignSuppressedCount: number;
  emittedInWindow: number;
  rateLimitedSuppressedCount: number;
  rateLimitedSuppressedInWindow: number;
  rateLimitNoticeEmitted: boolean;
  windowStartedAtMs: number;
}

interface IpcHistoryRateState {
  recordedInWindow: number;
  suppressedInWindow: number;
  totalSuppressedCount: number;
  windowNoticeEmitted: boolean;
  windowStartedAtMs: number;
}

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

const history: HistoryEntry[] = [];
const historyById = new Map<string, unknown>();

const threadOwnerById = new Map<string, string>();
const streamEventsByThreadId = new Map<string, IpcFrame[]>();
const trackedThreadEventsLastAccessById = new Map<string, number>();
const untrackedThreadEventsByThreadId = new Map<string, IpcFrame[]>();
const recentClientErrorByFingerprint = new Map<
  string,
  {
    timestampMs: number;
    errorId: string;
    recordedAt: string;
  }
>();
const invalidThreadStreamEventTimestampsMs: number[] = [];
const suppressedClientErrorReportTimestampsMs: number[] = [];
const invalidPushPayloadTimestampsMs: number[] = [];
const eventsAuthRejectedTimestampsMs: number[] = [];
const pushReceiptAuthRejectedTimestampsMs: number[] = [];
const appServerOperationStats = createAppServerOperationStats();
const appServerStderrState: AppServerStderrState = {
  benignSuppressedCount: 0,
  emittedInWindow: 0,
  rateLimitedSuppressedCount: 0,
  rateLimitedSuppressedInWindow: 0,
  rateLimitNoticeEmitted: false,
  windowStartedAtMs: Date.now()
};
const ipcHistoryRateState: IpcHistoryRateState = {
  recordedInWindow: 0,
  suppressedInWindow: 0,
  totalSuppressedCount: 0,
  windowNoticeEmitted: false,
  windowStartedAtMs: Date.now()
};

const sseClients = new Set<ServerResponse>();

let activeTrace: ActiveTrace | null = null;
const recentTraces: TraceSummary[] = [];
const invalidThreadStreamLastLoggedAtBySignature = new Map<string, number>();
let historySseBroadcastTimer: NodeJS.Timeout | null = null;

function pruneTimestampWindow(timestamps: number[], nowMs: number, windowMs: number): void {
  const cutoff = nowMs - windowMs;
  while (timestamps.length > 0 && timestamps[0]! < cutoff) {
    timestamps.shift();
  }
}

function pruneTrackedThreadEvents(nowMs: number): void {
  const cutoff = nowMs - TRACKED_THREAD_EVENTS_TTL_MS;
  for (const [threadId, lastAccessMs] of trackedThreadEventsLastAccessById) {
    if (lastAccessMs < cutoff) {
      trackedThreadEventsLastAccessById.delete(threadId);
    }
  }

  if (trackedThreadEventsLastAccessById.size <= TRACKED_THREAD_EVENTS_MAX) {
    return;
  }

  const byLastAccess = [...trackedThreadEventsLastAccessById.entries()].sort((left, right) => left[1] - right[1]);
  const overflowCount = byLastAccess.length - TRACKED_THREAD_EVENTS_MAX;
  for (const [threadId] of byLastAccess.slice(0, overflowCount)) {
    trackedThreadEventsLastAccessById.delete(threadId);
    streamEventsByThreadId.delete(threadId);
  }
}

function markThreadEventsTracked(threadId: string, nowMs: number = Date.now()): void {
  trackedThreadEventsLastAccessById.set(threadId, nowMs);
  pruneTrackedThreadEvents(nowMs);
  const pendingEvents = untrackedThreadEventsByThreadId.get(threadId);
  if (!pendingEvents || pendingEvents.length === 0) {
    return;
  }
  const currentEvents = streamEventsByThreadId.get(threadId) ?? [];
  currentEvents.push(...pendingEvents);
  if (currentEvents.length > 400) {
    currentEvents.splice(0, currentEvents.length - 400);
  }
  streamEventsByThreadId.set(threadId, currentEvents);
  untrackedThreadEventsByThreadId.delete(threadId);
}

function shouldCaptureThreadStreamEvent(threadId: string, nowMs: number): boolean {
  const lastAccessMs = trackedThreadEventsLastAccessById.get(threadId);
  if (typeof lastAccessMs !== "number") {
    return false;
  }
  trackedThreadEventsLastAccessById.set(threadId, nowMs);
  pruneTrackedThreadEvents(nowMs);
  return true;
}

function recordUntrackedThreadEvent(threadId: string, frame: IpcFrame): void {
  const pendingEvents = untrackedThreadEventsByThreadId.get(threadId) ?? [];
  pendingEvents.push(frame);
  if (pendingEvents.length > UNTRACKED_THREAD_EVENTS_MAX_PER_THREAD) {
    pendingEvents.splice(0, pendingEvents.length - UNTRACKED_THREAD_EVENTS_MAX_PER_THREAD);
  }
  untrackedThreadEventsByThreadId.set(threadId, pendingEvents);
  if (untrackedThreadEventsByThreadId.size <= UNTRACKED_THREAD_EVENTS_MAX_THREADS) {
    return;
  }
  const oldestThreadId = untrackedThreadEventsByThreadId.keys().next().value;
  if (typeof oldestThreadId === "string") {
    untrackedThreadEventsByThreadId.delete(oldestThreadId);
  }
}

function recordInvalidThreadStreamEvent(nowMs: number): void {
  invalidThreadStreamEventTimestampsMs.push(nowMs);
  pruneTimestampWindow(invalidThreadStreamEventTimestampsMs, nowMs, ERROR_BUDGET_WINDOW_MS);
}

function recordSuppressedClientErrorReport(nowMs: number): void {
  suppressedClientErrorReportTimestampsMs.push(nowMs);
  pruneTimestampWindow(suppressedClientErrorReportTimestampsMs, nowMs, ERROR_BUDGET_WINDOW_MS);
}

function recordInvalidPushPayload(nowMs: number): void {
  invalidPushPayloadTimestampsMs.push(nowMs);
  pruneTimestampWindow(invalidPushPayloadTimestampsMs, nowMs, ERROR_BUDGET_WINDOW_MS);
}

function recordEventsAuthRejected(nowMs: number): void {
  eventsAuthRejectedTimestampsMs.push(nowMs);
  pruneTimestampWindow(eventsAuthRejectedTimestampsMs, nowMs, ERROR_BUDGET_WINDOW_MS);
}

function recordPushReceiptAuthRejected(nowMs: number): void {
  pushReceiptAuthRejectedTimestampsMs.push(nowMs);
  pruneTimestampWindow(pushReceiptAuthRejectedTimestampsMs, nowMs, ERROR_BUDGET_WINDOW_MS);
}

function pruneRecentClientErrorFingerprints(nowMs: number): void {
  const cutoff = nowMs - SERVER_CLIENT_ERROR_DEDUP_WINDOW_MS;
  for (const [fingerprint, entry] of recentClientErrorByFingerprint) {
    if (entry.timestampMs < cutoff) {
      recentClientErrorByFingerprint.delete(fingerprint);
    }
  }
}

function buildClientErrorFingerprint(input: CreateDebugClientErrorBody): string {
  return [
    input.source,
    input.operation,
    input.message,
    input.requestId ?? "",
    input.threadId ?? "",
    input.url ?? "",
    JSON.stringify(input.details)
  ].join("\u001f");
}

function isAppServerTimeoutError(error: unknown): boolean {
  if (!(error instanceof AppServerTransportError)) {
    return false;
  }
  return error.message.toLowerCase().includes("timed out");
}

function resetAppServerStderrWindow(nowMs: number): void {
  appServerStderrState.windowStartedAtMs = nowMs;
  appServerStderrState.emittedInWindow = 0;
  appServerStderrState.rateLimitedSuppressedInWindow = 0;
  appServerStderrState.rateLimitNoticeEmitted = false;
}

function shouldEmitAppServerStderr(nowMs: number): boolean {
  if (nowMs - appServerStderrState.windowStartedAtMs >= APP_SERVER_STDERR_WINDOW_MS) {
    resetAppServerStderrWindow(nowMs);
  }

  if (appServerStderrState.emittedInWindow < APP_SERVER_STDERR_MAX_EVENTS_PER_WINDOW) {
    appServerStderrState.emittedInWindow += 1;
    return true;
  }

  appServerStderrState.rateLimitedSuppressedCount += 1;
  appServerStderrState.rateLimitedSuppressedInWindow += 1;
  return false;
}

function resetIpcHistoryWindow(nowMs: number): void {
  ipcHistoryRateState.recordedInWindow = 0;
  ipcHistoryRateState.suppressedInWindow = 0;
  ipcHistoryRateState.windowNoticeEmitted = false;
  ipcHistoryRateState.windowStartedAtMs = nowMs;
}

function shouldRecordIpcHistory(nowMs: number): boolean {
  if (nowMs - ipcHistoryRateState.windowStartedAtMs >= IPC_HISTORY_WINDOW_MS) {
    resetIpcHistoryWindow(nowMs);
  }

  if (ipcHistoryRateState.recordedInWindow < IPC_HISTORY_MAX_EVENTS_PER_WINDOW) {
    ipcHistoryRateState.recordedInWindow += 1;
    return true;
  }

  ipcHistoryRateState.suppressedInWindow += 1;
  ipcHistoryRateState.totalSuppressedCount += 1;
  return false;
}

const runtimeState = {
  appExecutable: resolveCodexExecutablePath(),
  socketPath: resolveIpcSocketPath(),
  gitCommit: resolveGitCommitHash(),
  appReady: false,
  ipcConnected: false,
  ipcInitialized: false,
  lastError: null as string | null,
  pushEnabled: PUSH_ENABLED,
  pushConfigured: false,
  pushStatePath: PUSH_STATE_PATH,
  pushStatePathSource: PUSH_STATE_RESOLUTION.source,
  pushReceiptsPath: PUSH_RECEIPTS_PATH,
  pushSendsPath: PUSH_SENDS_PATH,
  errorLogPath: CLIENT_ERROR_SESSION_LOG_PATH,
  errorSessionId: CLIENT_ERROR_SESSION_ID,
  pushReceiptsMaxCount: MAX_PUSH_RECEIPTS,
  pushReceiptsMaxAgeDays: PUSH_RECEIPTS_MAX_AGE_DAYS,
  appServerRequestTimeoutMs: APP_SERVER_REQUEST_TIMEOUT_MS
};

let bootstrapInFlight: Promise<void> | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;

function getRuntimeStateSnapshot(): Record<string, unknown> {
  const nowMs = Date.now();
  pruneTimestampWindow(invalidThreadStreamEventTimestampsMs, nowMs, ERROR_BUDGET_WINDOW_MS);
  pruneTimestampWindow(suppressedClientErrorReportTimestampsMs, nowMs, ERROR_BUDGET_WINDOW_MS);
  pruneTimestampWindow(invalidPushPayloadTimestampsMs, nowMs, ERROR_BUDGET_WINDOW_MS);
  pruneTimestampWindow(eventsAuthRejectedTimestampsMs, nowMs, ERROR_BUDGET_WINDOW_MS);
  pruneTimestampWindow(pushReceiptAuthRejectedTimestampsMs, nowMs, ERROR_BUDGET_WINDOW_MS);
  const latestPushSend = pushSendStore.getLatest();
  return {
    ...runtimeState,
    historyCount: history.length,
    threadOwnerCount: threadOwnerById.size,
    trackedThreadEventCount: trackedThreadEventsLastAccessById.size,
    untrackedThreadEventCount: untrackedThreadEventsByThreadId.size,
    activeTrace: activeTrace?.summary ?? null,
    pushSubscriptionCount: pushStore.getSubscriptionCount(),
    pushReceiptCount: pushReceiptStore.getCount(),
    errorCount: clientErrorStore.getCount(),
    appServerOperations: appServerOperationStats,
    appServerStderr: {
      benignSuppressedCount: appServerStderrState.benignSuppressedCount,
      emittedInWindow: appServerStderrState.emittedInWindow,
      maxEventsPerWindow: APP_SERVER_STDERR_MAX_EVENTS_PER_WINDOW,
      rateLimitedSuppressedCount: appServerStderrState.rateLimitedSuppressedCount,
      rateLimitedSuppressedInWindow: appServerStderrState.rateLimitedSuppressedInWindow,
      windowMs: APP_SERVER_STDERR_WINDOW_MS,
      windowStartedAt: new Date(appServerStderrState.windowStartedAtMs).toISOString()
    },
    ipcHistoryRateLimit: {
      maxEventsPerWindow: IPC_HISTORY_MAX_EVENTS_PER_WINDOW,
      recordedInWindow: ipcHistoryRateState.recordedInWindow,
      suppressedInWindow: ipcHistoryRateState.suppressedInWindow,
      totalSuppressedCount: ipcHistoryRateState.totalSuppressedCount,
      windowMs: IPC_HISTORY_WINDOW_MS,
      windowStartedAt: new Date(ipcHistoryRateState.windowStartedAtMs).toISOString()
    },
    invalidThreadStreamEventsLast5m: invalidThreadStreamEventTimestampsMs.length,
    suppressedClientErrorReportsLast5m: suppressedClientErrorReportTimestampsMs.length,
    invalidPushPayloadsLast5m: invalidPushPayloadTimestampsMs.length,
    eventsAuthRejectsLast5m: eventsAuthRejectedTimestampsMs.length,
    pushReceiptAuthRejectsLast5m: pushReceiptAuthRejectedTimestampsMs.length,
    latestPushSendNotificationId: latestPushSend?.notificationId ?? null
  };
}

function ensureTraceDirectory(): void {
  if (!fs.existsSync(TRACE_DIR)) {
    fs.mkdirSync(TRACE_DIR, { recursive: true });
  }
}

function recordTraceEvent(event: unknown): void {
  if (!activeTrace) {
    return;
  }

  activeTrace.summary.eventCount += 1;
  activeTrace.stream.write(`${JSON.stringify(event)}\n`);
}

function broadcastSse(payload: unknown): void {
  for (const client of sseClients) {
    eventResponse(client, payload);
  }
}

function scheduleHistorySseBroadcast(): void {
  if (historySseBroadcastTimer) {
    return;
  }

  historySseBroadcastTimer = setTimeout(() => {
    historySseBroadcastTimer = null;
    broadcastSse({ type: "history" });
  }, HISTORY_SSE_DEBOUNCE_MS);
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
  scheduleHistorySseBroadcast();
  return entry;
}

function pushSystem(message: string, details: Record<string, unknown> = {}): void {
  logger.info({ message, ...details }, "system-event");
  pushHistory("system", "system", { message, details });
}

type ActionStage = "attempt" | "success" | "error";

function summarizeActionDetails(details: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  const keys = ["threadId", "ownerClientId", "requestId", "textLength", "isSteering", "cwd", "model"];

  for (const key of keys) {
    const value = details[key];
    if (value !== undefined) {
      summary[key] = value;
    }
  }

  const modeValue = details["collaborationMode"];
  if (modeValue && typeof modeValue === "object") {
    const modeRecord = modeValue as Record<string, unknown>;
    const maybeMode = modeRecord["mode"];
    if (typeof maybeMode === "string") {
      summary["mode"] = maybeMode;
    }

    const settings = modeRecord["settings"];
    if (settings && typeof settings === "object") {
      const settingsRecord = settings as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(settingsRecord, "model")) {
        summary["model"] = settingsRecord["model"];
      }
      if (Object.prototype.hasOwnProperty.call(settingsRecord, "reasoning_effort")) {
        summary["reasoningEffort"] = settingsRecord["reasoning_effort"];
      }
    }
  }

  return summary;
}

function pushActionEvent(
  action: string,
  stage: ActionStage,
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
  });
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
  clientErrorStore.recordServerError({
    source: "monitor-server",
    operation: `action:${action}`,
    message,
    name: error instanceof Error ? error.name : null,
    stack: error instanceof Error ? (error.stack ?? null) : null,
    requestId: typeof details["requestId"] === "string" ? details["requestId"] : null,
    threadId: typeof details["threadId"] === "string" ? details["threadId"] : null,
    url: null,
    details: {
      action
    },
    occurredAt: new Date().toISOString()
  });
  return message;
}

function broadcastRuntimeState(): void {
  broadcastSse({
    type: "state",
    state: getRuntimeStateSnapshot()
  });
}

function setRuntimeError(error: unknown): string {
  const message = toErrorMessage(error);
  runtimeState.lastError = message;
  clientErrorStore.recordServerError({
    source: "monitor-server",
    operation: "runtime:set-error",
    message,
    name: error instanceof Error ? error.name : null,
    stack: error instanceof Error ? (error.stack ?? null) : null,
    requestId: null,
    threadId: null,
    url: null,
    details: {},
    occurredAt: new Date().toISOString()
  });
  return message;
}

function setAppReady(next: boolean): void {
  if (runtimeState.appReady === next) {
    return;
  }
  runtimeState.appReady = next;
  broadcastRuntimeState();
}

function maybeLogInvalidThreadStreamEvent(
  phase: "on-frame" | "live-state",
  threadId: string | null,
  payload: IpcFrame,
  error: unknown
): void {
  const now = Date.now();
  recordInvalidThreadStreamEvent(now);
  const message = toErrorMessage(error);
  const signature = `${phase}|${threadId ?? "unknown"}|${message}`;
  const lastLoggedAt = invalidThreadStreamLastLoggedAtBySignature.get(signature) ?? 0;
  if (now - lastLoggedAt < INVALID_THREAD_STREAM_LOG_INTERVAL_MS) {
    return;
  }
  invalidThreadStreamLastLoggedAtBySignature.set(signature, now);

  const payloadMeta =
    payload.type === "broadcast" || payload.type === "request"
      ? {
          payloadType: payload.type,
          payloadMethod: payload.method
        }
      : {
          payloadType: payload.type
        };

  logger.warn(
    {
      phase,
      threadId,
      error: message,
      ...payloadMeta
    },
    "invalid-thread-stream-event"
  );
}

function isThreadNotLoadedError(error: unknown): boolean {
  if (!(error instanceof AppServerRpcError)) {
    return false;
  }

  if (error.code !== -32600) {
    return false;
  }

  return error.message.includes("thread not loaded");
}

async function runAppServerCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    const result = await operation();
    setAppReady(true);
    return result;
  } catch (error) {
    if (error instanceof AppServerTransportError) {
      setAppReady(false);
    } else {
      setAppReady(true);
    }
    throw error;
  }
}

async function runTrackedAppServerCall<T>(
  operationName: AppServerOperationName,
  operation: () => Promise<T>
): Promise<T> {
  const stats = appServerOperationStats[operationName];
  const startedAtMs = Date.now();
  stats.totalCount += 1;
  stats.inFlightCount += 1;
  stats.lastStartedAt = new Date(startedAtMs).toISOString();

  try {
    const result = await runAppServerCall(operation);
    const completedAtMs = Date.now();
    stats.successCount += 1;
    stats.lastCompletedAt = new Date(completedAtMs).toISOString();
    stats.lastDurationMs = completedAtMs - startedAtMs;
    stats.lastStatus = "ok";
    stats.lastError = null;
    return result;
  } catch (error) {
    const completedAtMs = Date.now();
    stats.errorCount += 1;
    if (isAppServerTimeoutError(error)) {
      stats.timeoutCount += 1;
    }
    stats.lastCompletedAt = new Date(completedAtMs).toISOString();
    stats.lastDurationMs = completedAtMs - startedAtMs;
    stats.lastStatus = "error";
    stats.lastError = toErrorMessage(error);
    throw error;
  } finally {
    stats.inFlightCount = Math.max(0, stats.inFlightCount - 1);
  }
}

function requireIpcReady(res: ServerResponse): boolean {
  if (runtimeState.ipcConnected && runtimeState.ipcInitialized) {
    return true;
  }

  jsonResponse(res, 503, {
    ok: false,
    error: runtimeState.lastError ?? "Desktop IPC is not connected"
  });
  return false;
}

function scheduleIpcReconnect(): void {
  if (reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void bootstrapConnections();
  }, IPC_RECONNECT_DELAY_MS);
}

const appClient = new AppServerClient({
  executablePath: runtimeState.appExecutable,
  userAgent: USER_AGENT,
  cwd: DEFAULT_WORKSPACE,
  requestTimeoutMs: APP_SERVER_REQUEST_TIMEOUT_MS,
  onStderr: (line) => {
    const normalized = normalizeStderrLine(line);
    if (normalized.length === 0) {
      return;
    }
    const lineSummary = summarizeStderrLine(normalized);

    if (isKnownBenignAppServerStderr(normalized)) {
      appServerStderrState.benignSuppressedCount += 1;
      if (
        appServerStderrState.benignSuppressedCount === 1 ||
        appServerStderrState.benignSuppressedCount % APP_SERVER_STDERR_BENIGN_SUMMARY_INTERVAL === 0
      ) {
        logger.info(
          {
            line: lineSummary.line,
            originalLength: lineSummary.originalLength,
            suppressedCount: appServerStderrState.benignSuppressedCount,
            truncated: lineSummary.truncated
          },
          "app-server-stderr-ignored-summary"
        );
      }
      return;
    }

    const nowMs = Date.now();
    if (!shouldEmitAppServerStderr(nowMs)) {
      if (!appServerStderrState.rateLimitNoticeEmitted) {
        appServerStderrState.rateLimitNoticeEmitted = true;
        logger.warn(
          {
            maxEventsPerWindow: APP_SERVER_STDERR_MAX_EVENTS_PER_WINDOW,
            suppressedInWindow: appServerStderrState.rateLimitedSuppressedInWindow,
            windowMs: APP_SERVER_STDERR_WINDOW_MS
          },
          "app-server-stderr-rate-limited"
        );
        pushHistory("app", "system", {
          maxEventsPerWindow: APP_SERVER_STDERR_MAX_EVENTS_PER_WINDOW,
          suppressedInWindow: appServerStderrState.rateLimitedSuppressedInWindow,
          type: "stderr-rate-limited",
          windowMs: APP_SERVER_STDERR_WINDOW_MS
        });
      }
      return;
    }

    logger.error(
      {
        line: lineSummary.line,
        originalLength: lineSummary.originalLength,
        truncated: lineSummary.truncated
      },
      "app-server-stderr"
    );
    pushHistory("app", "system", {
      type: "stderr",
      line: lineSummary.line,
      originalLength: lineSummary.originalLength,
      truncated: lineSummary.truncated
    });
  }
});

const ipcClient = new DesktopIpcClient({
  socketPath: runtimeState.socketPath
});

const service = new CodexMonitorService(ipcClient);
const pushStore = new PushStore(PUSH_STATE_PATH);
const pushReceiptStore = new PushReceiptStore(
  PUSH_RECEIPTS_PATH,
  MAX_PUSH_RECEIPTS,
  PUSH_RECEIPTS_MAX_AGE_MS
);
const pushSendStore = new PushSendStore(PUSH_SENDS_PATH);
const clientErrorStore = new ClientErrorStore(
  CLIENT_ERROR_SESSION_LOG_PATH,
  CLIENT_ERROR_SESSION_ID,
  CLIENT_ERROR_MAX_ENTRIES
);
const pushService = new PushService({
  enabled:
    PUSH_ENABLED &&
    PUSH_VAPID_PUBLIC_KEY.length > 0 &&
    PUSH_VAPID_PRIVATE_KEY.length > 0 &&
    PUSH_VAPID_SUBJECT.length > 0,
  vapidPublicKey: PUSH_VAPID_PUBLIC_KEY,
  vapidPrivateKey: PUSH_VAPID_PRIVATE_KEY,
  vapidSubject: PUSH_VAPID_SUBJECT
});
let completionDetector = new CompletionDetector(new Map<string, string>());
const inFlightCompletionMarkers = new Set<string>();
const completionStateBackfillInFlight = new Set<string>();
const completionStateBackfillLastAt = new Map<string, number>();

function parseInteger(value: string | null, defaultValue: number): number {
  if (!value) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return parsed;
}

function parseBoolean(value: string | null, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  if (value === "1" || value === "true") {
    return true;
  }

  if (value === "0" || value === "false") {
    return false;
  }

  return defaultValue;
}

function endpointHash(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 12);
}

function recordPushReceipt(receipt: PushReceipt): void {
  pushReceiptStore.add(receipt);
}

function recordLatestPushSend(summary: PushSendSummary): void {
  pushSendStore.setLatest(summary);
}

function getLocalCaStatus(): {
  available: boolean;
  downloadPath: string | null;
  sourcePath: string | null;
} {
  const exists = fs.existsSync(LOCAL_CADDY_ROOT_CA_PATH);
  if (!exists) {
    return {
      available: false,
      downloadPath: null,
      sourcePath: null
    };
  }
  return {
    available: true,
    downloadPath: LOCAL_CA_DOWNLOAD_PATH,
    sourcePath: LOCAL_CADDY_ROOT_CA_PATH
  };
}

function requirePushConfiguration(): void {
  if (!PUSH_ENABLED) {
    runtimeState.pushConfigured = false;
    return;
  }

  const missing: string[] = [];
  if (PUSH_VAPID_PUBLIC_KEY.length === 0) {
    missing.push("PUSH_VAPID_PUBLIC_KEY");
  }
  if (PUSH_VAPID_PRIVATE_KEY.length === 0) {
    missing.push("PUSH_VAPID_PRIVATE_KEY");
  }
  if (PUSH_VAPID_SUBJECT.length === 0) {
    missing.push("PUSH_VAPID_SUBJECT");
  }

  if (missing.length > 0) {
    throw new Error(`Push notifications enabled but missing env vars: ${missing.join(", ")}`);
  }
  runtimeState.pushConfigured = true;
}

function isApiAuthRequired(): boolean {
  return API_AUTH_TOKEN.length > 0;
}

function readApiAuthToken(req: IncomingMessage): string {
  const rawToken = req.headers["x-farfield-token"];
  if (typeof rawToken === "string") {
    return rawToken;
  }
  return rawToken?.[0] ?? "";
}

type ApiAuthRouteType = "api" | "events" | "push-receipts";

function recordApiAuthRejected(routeType: ApiAuthRouteType, nowMs: number): void {
  if (routeType === "events") {
    recordEventsAuthRejected(nowMs);
    return;
  }
  if (routeType === "push-receipts") {
    recordPushReceiptAuthRejected(nowMs);
  }
}

function readOriginHeader(req: IncomingMessage): string | null {
  const rawOrigin = req.headers.origin;
  if (typeof rawOrigin !== "string") {
    return null;
  }
  const trimmed = rawOrigin.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRequestHost(req: IncomingMessage): string | null {
  const rawHost = req.headers.host;
  if (typeof rawHost !== "string") {
    return null;
  }
  const trimmed = rawHost.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
}

function hasAuthorizedBrowserOrigin(req: IncomingMessage): boolean {
  const origin = readOriginHeader(req);
  if (!origin) {
    return true;
  }
  if (origin.toLowerCase() === "null") {
    return false;
  }
  const requestHost = readRequestHost(req);
  if (!requestHost) {
    return false;
  }

  try {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.protocol !== "http:" && parsedOrigin.protocol !== "https:") {
      return false;
    }
    return parsedOrigin.host.toLowerCase() === requestHost;
  } catch {
    return false;
  }
}

function requireApiAuth(
  req: IncomingMessage,
  res: ServerResponse,
  routeType: ApiAuthRouteType
): boolean {
  if (!isApiAuthRequired()) {
    return true;
  }

  const token = readApiAuthToken(req);
  if (token !== API_AUTH_TOKEN) {
    const nowMs = Date.now();
    recordApiAuthRejected(routeType, nowMs);
    logger.warn(
      {
        route: req.url ?? "unknown",
        remoteAddress: req.socket.remoteAddress ?? null,
        routeType,
        reason: "token"
      },
      "api-auth-rejected"
    );
    jsonResponse(res, 401, {
      ok: false,
      error: "Unauthorized"
    });
    return false;
  }

  if (!hasAuthorizedBrowserOrigin(req)) {
    const nowMs = Date.now();
    recordApiAuthRejected(routeType, nowMs);
    logger.warn(
      {
        route: req.url ?? "unknown",
        remoteAddress: req.socket.remoteAddress ?? null,
        routeType,
        origin: readOriginHeader(req),
        host: readRequestHost(req),
        reason: "origin"
      },
      "api-auth-origin-rejected"
    );
    jsonResponse(res, 403, {
      ok: false,
      error: "Forbidden origin"
    });
    return false;
  }

  return true;
}

function isInvalidPushPayloadReceipt(receipt: PushReceipt): boolean {
  if (receipt.event !== "error") {
    return false;
  }
  return typeof receipt.message === "string" && receipt.message.startsWith("Push payload validation failed:");
}

function summarizeAgentText(agentText: string): string {
  const normalized = agentText.replace(/\s+/g, " ").trim();
  if (normalized.length <= 120) {
    return normalized;
  }
  return `${normalized.slice(0, 117)}...`;
}

function buildCompletionPayload(
  candidate: CompletionCandidate,
  privateMode: boolean,
  notificationId: string
): PushNotificationPayload {
  const body = privateMode ? "A response is ready in Farfield." : summarizeAgentText(candidate.agentText);
  const url = `/threads/${encodeURIComponent(candidate.threadId)}`;

  return {
    notificationId,
    title: "Codex response ready",
    body,
    threadId: candidate.threadId,
    turnId: candidate.turnId,
    url,
    createdAt: new Date().toISOString(),
    web_push: {
      notification: {
        title: "Codex response ready",
        body,
        navigate: url,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: `thread:${candidate.threadId}`
      }
    }
  };
}

function buildNotificationId(candidate: CompletionCandidate): string {
  return `notif_${createHash("sha256")
    .update(`${candidate.threadId}:${candidate.turnId}:${candidate.marker}`)
    .digest("hex")
    .slice(0, 24)}`;
}

async function notifyCompletion(candidate: CompletionCandidate): Promise<{
  notificationId: string | null;
  attempted: number;
  delivered: number;
  failures: number;
  canCommitWatermark: boolean;
}> {
  if (!pushService.isEnabled()) {
    return {
      notificationId: null,
      attempted: 0,
      delivered: 0,
      failures: 0,
      canCommitWatermark: true
    };
  }

  const subscriptions = pushStore.listSubscriptions();
  if (subscriptions.length === 0) {
    return {
      notificationId: null,
      attempted: 0,
      delivered: 0,
      failures: 0,
      canCommitWatermark: true
    };
  }

  const privateSubscriptions = subscriptions.filter((subscription) => subscription.settings.privateMode);
  const detailedSubscriptions = subscriptions.filter((subscription) => !subscription.settings.privateMode);
  const batches: Array<{ privateMode: boolean; subscriptions: typeof subscriptions }> = [];

  if (privateSubscriptions.length > 0) {
    batches.push({
      privateMode: true,
      subscriptions: privateSubscriptions
    });
  }

  if (detailedSubscriptions.length > 0) {
    batches.push({
      privateMode: false,
      subscriptions: detailedSubscriptions
    });
  }

  let attempted = 0;
  let delivered = 0;
  let failures = 0;
  const sentAt = new Date().toISOString();
  const notificationId = buildNotificationId(candidate);

  for (const batch of batches) {
    const payload = buildCompletionPayload(candidate, batch.privateMode, notificationId);
    const result = await pushService.sendToSubscriptions(batch.subscriptions, payload);
    attempted += result.attempted;
    delivered += result.delivered;
    failures += result.failures.length;

    for (const endpoint of result.prunedEndpoints) {
      const removed = pushStore.removeSubscriptionByEndpoint(endpoint);
      if (removed) {
        pushSystem("Push subscription removed after invalid endpoint", {
          endpointHash: endpointHash(endpoint),
          subscriptionCount: pushStore.getSubscriptionCount()
        });
      }
    }

    pushSystem("Push notification send result", {
      notificationId,
      threadId: candidate.threadId,
      turnId: candidate.turnId,
      privateMode: batch.privateMode,
      attempted: result.attempted,
      delivered: result.delivered,
      failures: result.failures.length
    });
  }

  recordLatestPushSend({
    notificationId,
    threadId: candidate.threadId,
    turnId: candidate.turnId,
    sentAt,
    attempted,
    delivered,
    failures
  });

  return {
    notificationId,
    attempted,
    delivered,
    failures,
    canCommitWatermark: delivered > 0
  };
}

function getPushReadiness(): {
  ready: boolean;
  reason: string;
  subscriptionCount: number;
} {
  const subscriptionCount = pushStore.getSubscriptionCount();
  if (!pushService.isEnabled()) {
    return {
      ready: false,
      reason: "Push notifications are disabled on the server",
      subscriptionCount
    };
  }
  if (subscriptionCount === 0) {
    return {
      ready: false,
      reason: "No active push subscriptions",
      subscriptionCount
    };
  }
  return {
    ready: true,
    reason: "Ready to send push notifications",
    subscriptionCount
  };
}

function shouldBackfillConversationState(threadId: string): boolean {
  if (completionStateBackfillInFlight.has(threadId)) {
    return false;
  }

  const now = Date.now();
  const previous = completionStateBackfillLastAt.get(threadId) ?? 0;
  if (now - previous < COMPLETION_STATE_BACKFILL_INTERVAL_MS) {
    return false;
  }

  completionStateBackfillLastAt.set(threadId, now);
  return true;
}

async function readThreadConversationStateForCompletion(
  threadId: string
): Promise<ThreadConversationState | null> {
  if (!shouldBackfillConversationState(threadId)) {
    return null;
  }

  completionStateBackfillInFlight.add(threadId);
  try {
    const result = await appClient.readThread(threadId, true);
    return result.thread;
  } catch (error) {
    logger.debug(
      {
        threadId,
        error: toErrorMessage(error)
      },
      "completion-state-backfill-failed"
    );
    return null;
  } finally {
    completionStateBackfillInFlight.delete(threadId);
  }
}

async function processCompletionCandidate(candidate: CompletionCandidate): Promise<void> {
  if (inFlightCompletionMarkers.has(candidate.marker)) {
    return;
  }
  inFlightCompletionMarkers.add(candidate.marker);

  try {
    const result = await notifyCompletion(candidate);
    if (!result.canCommitWatermark) {
      pushSystem("Push delivery failed for all subscriptions; completion watermark not updated", {
        threadId: candidate.threadId,
        turnId: candidate.turnId,
        attempted: result.attempted,
        failures: result.failures
      });
      return;
    }

    completionDetector.commit(candidate.threadId, candidate.marker);
    pushStore.setCompletionWatermark(candidate.threadId, candidate.marker);
  } catch (error) {
    logger.error(
      {
        threadId: candidate.threadId,
        turnId: candidate.turnId,
        error: toErrorMessage(error)
      },
      "push-notify-failed"
    );
  } finally {
    inFlightCompletionMarkers.delete(candidate.marker);
  }
}

function queueCompletionBackfillCheck(threadId: string): void {
  void (async () => {
    const backfilledState = await readThreadConversationStateForCompletion(threadId);
    if (!backfilledState) {
      return;
    }

    const candidateFromBackfill = completionDetector.detect(threadId, backfilledState);
    if (!candidateFromBackfill) {
      return;
    }

    await processCompletionCandidate(candidateFromBackfill);
  })();
}

function getThreadLiveState(threadId: string): {
  ownerClientId: string | null;
  conversationState: ThreadConversationState | null;
} {
  const rawEvents = streamEventsByThreadId.get(threadId) ?? [];
  if (rawEvents.length === 0) {
    return {
      ownerClientId: threadOwnerById.get(threadId) ?? null,
      conversationState: null
    };
  }

  const events = rawEvents.flatMap((event) => {
    try {
      return [parseThreadStreamStateChangedBroadcast(event)];
    } catch (error) {
      maybeLogInvalidThreadStreamEvent("live-state", threadId, event, error);
      return [];
    }
  });

  if (events.length === 0) {
    return {
      ownerClientId: threadOwnerById.get(threadId) ?? null,
      conversationState: null
    };
  }

  let state;
  try {
    const reduced = reduceThreadStreamEvents(events);
    state = reduced.get(threadId);
  } catch (error) {
    const reductionContext =
      error instanceof ThreadStreamReductionError
        ? {
            threadId: error.details.threadId,
            eventIndex: error.details.eventIndex,
            patchIndex: error.details.patchIndex,
            rawEvent: error.details.event,
            rawPatch: error.details.patch
          }
        : null;
    logger.error(
      {
        threadId,
        eventCount: events.length,
        error: toErrorMessage(error),
        reductionContext
      },
      "thread-stream-reduction-failed"
    );
    pushSystem("Thread stream reduction failed", {
      threadId,
      eventCount: events.length,
      error: toErrorMessage(error),
      reductionContext
    });
    return {
      ownerClientId: threadOwnerById.get(threadId) ?? null,
      conversationState: null
    };
  }

  return {
    ownerClientId: state?.ownerClientId ?? threadOwnerById.get(threadId) ?? null,
    conversationState: state?.conversationState ?? null
  };
}

function extractThreadId(frame: IpcFrame): string | null {
  if (frame.type === "broadcast" && frame.method === "thread-stream-state-changed") {
    const params = frame.params;
    if (!params || typeof params !== "object") {
      return null;
    }

    const conversationId = (params as Record<string, unknown>)["conversationId"];
    if (typeof conversationId === "string" && conversationId.trim()) {
      return conversationId.trim();
    }

    return null;
  }

  if (frame.type !== "request") {
    return null;
  }

  const params = frame.params;
  if (!params || typeof params !== "object") {
    return null;
  }

  const asRecord = params as Record<string, unknown>;
  const candidates = [
    asRecord["conversationId"],
    asRecord["threadId"],
    asRecord["turnId"]
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

async function sendIpcRequest(
  method: string,
  params: unknown,
  options: SendRequestOptions = {}
): Promise<unknown> {
  const payload = {
    type: "request",
    method,
    params,
    targetClientId: options.targetClientId ?? null,
    version: options.version ?? null
  };

  pushHistory("ipc", "out", payload, {
    method,
    threadId: extractThreadId({
      type: "request",
      requestId: "monitor-preview-request-id",
      method,
      params,
      targetClientId: options.targetClientId,
      version: options.version
    })
  });

  const response = await ipcClient.sendRequestAndWait(method, params, options);
  return response;
}

function sendIpcBroadcast(method: string, params: unknown, options: SendRequestOptions = {}): void {
  const payload = {
    type: "broadcast",
    method,
    params,
    targetClientId: options.targetClientId ?? null,
    version: options.version ?? null
  };

  pushHistory("ipc", "out", payload, {
    method,
    threadId: extractThreadId({
      type: "request",
      requestId: "monitor-preview-request-id",
      method,
      params,
      targetClientId: options.targetClientId,
      version: options.version
    })
  });

  ipcClient.sendBroadcast(method, params, options);
}

ipcClient.onConnectionState((state) => {
  runtimeState.ipcConnected = state.connected;
  if (!state.connected) {
    runtimeState.ipcInitialized = false;
    scheduleIpcReconnect();
  } else if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (state.reason) {
    runtimeState.lastError = state.reason;
    pushSystem("IPC connection state changed", {
      connected: state.connected,
      reason: state.reason
    });
  }

  broadcastRuntimeState();
});

ipcClient.onFrame((frame) => {
  const threadId = extractThreadId(frame);
  const isHighVolumeThreadStreamBroadcast =
    frame.type === "broadcast" && frame.method === "thread-stream-state-changed";
  const historyPayload = isHighVolumeThreadStreamBroadcast
    ? {
        type: frame.type,
        method: frame.method,
        sourceClientId: frame.sourceClientId ?? null,
        targetClientId: frame.targetClientId ?? null,
        version: frame.version ?? null,
        omittedParams: true
      }
    : frame;
  logger.debug(
    {
      frameType: frame.type,
      method: frame.type === "request" || frame.type === "broadcast" ? frame.method : "response",
      threadId
    },
    "ipc-frame"
  );

  const nowMs = Date.now();
  if (shouldRecordIpcHistory(nowMs)) {
    pushHistory("ipc", "in", historyPayload, {
      method: frame.type === "request" || frame.type === "broadcast" ? frame.method : "response",
      threadId
    });
  } else if (!ipcHistoryRateState.windowNoticeEmitted) {
    ipcHistoryRateState.windowNoticeEmitted = true;
    logger.warn(
      {
        maxEventsPerWindow: IPC_HISTORY_MAX_EVENTS_PER_WINDOW,
        suppressedInWindow: ipcHistoryRateState.suppressedInWindow,
        windowMs: IPC_HISTORY_WINDOW_MS
      },
      "ipc-history-rate-limited"
    );
  }

  if (frame.type === "broadcast" && frame.method === "thread-stream-state-changed") {
    if (!threadId) {
      return;
    }

    if (frame.sourceClientId && frame.sourceClientId.trim()) {
      const ownerClientId = frame.sourceClientId.trim();
      threadOwnerById.set(threadId, ownerClientId);
    }

    if (!shouldCaptureThreadStreamEvent(threadId, nowMs)) {
      recordUntrackedThreadEvent(threadId, frame);
      queueCompletionBackfillCheck(threadId);
      return;
    }

    let parsedBroadcast;
    try {
      parsedBroadcast = parseThreadStreamStateChangedBroadcast(frame);
    } catch (error) {
      maybeLogInvalidThreadStreamEvent("on-frame", threadId, frame, error);
      return;
    }

    const conversationId = parsedBroadcast.params.conversationId;

    const current = streamEventsByThreadId.get(conversationId) ?? [];
    current.push(frame);
    if (current.length > 400) {
      current.splice(0, current.length - 400);
    }
    streamEventsByThreadId.set(conversationId, current);

    const liveState = getThreadLiveState(conversationId);
    const candidateFromLiveState = completionDetector.detect(conversationId, liveState.conversationState);
    if (candidateFromLiveState) {
      void processCompletionCandidate(candidateFromLiveState);
      return;
    }

    if (liveState.conversationState !== null) {
      return;
    }

    queueCompletionBackfillCheck(conversationId);
  }
});

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

    if (req.method === "GET" && pathname === "/events") {
      if (!requireApiAuth(req, res, "events")) {
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });

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

    if (pathname.startsWith("/api/")) {
      const routeType: ApiAuthRouteType =
        pathname === "/api/push/receipts" ? "push-receipts" : "api";
      if (!requireApiAuth(req, res, routeType)) {
        return;
      }
    }

    if (req.method === "GET" && pathname === "/api/health") {
      jsonResponse(res, 200, {
        ok: true,
        state: getRuntimeStateSnapshot()
      });
      return;
    }

    if (req.method === "GET" && pathname === "/healthz") {
      jsonResponse(res, 200, {
        ok: true,
        service: "farfield-web-shell",
        buildId: resolveWebShellBuildId(runtimeState.gitCommit),
        gitCommit: runtimeState.gitCommit,
        serviceWorkerVersion: WEB_SHELL_SERVICE_WORKER_VERSION,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (pathname.startsWith("/api/push")) {
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

      if (req.method === "GET" && pathname === "/api/push/local-ca") {
        const status = getLocalCaStatus();
        jsonResponse(res, 200, {
          ok: true,
          available: status.available,
          downloadPath: status.downloadPath,
          sourcePath: status.sourcePath
        });
        return;
      }

      if (req.method === "GET" && pathname === LOCAL_CA_DOWNLOAD_PATH) {
        const status = getLocalCaStatus();
        if (!status.available || !status.sourcePath) {
          jsonResponse(res, 404, {
            ok: false,
            error: "Local Caddy root certificate not found"
          });
          return;
        }

        const data = fs.readFileSync(status.sourcePath);
        res.writeHead(200, {
          "Content-Type": "application/x-x509-ca-cert",
          "Content-Length": data.length,
          "Content-Disposition": "attachment; filename=\"farfield-local-root.crt\"",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*"
        });
        res.end(data);
        return;
      }

      if (req.method === "GET" && pathname === "/api/push/receipts/latest") {
        const latest = pushReceiptStore.getLatest();
        jsonResponse(res, 200, {
          ok: true,
          latest,
          count: pushReceiptStore.getCount()
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

      if (req.method === "POST" && pathname === "/api/push/receipts") {
        const body = parseBody(CreatePushReceiptBodySchema, await readJsonBody(req));
        const receipt: PushReceipt = {
          notificationId: body.notificationId,
          event: body.event,
          url: body.url,
          threadId: body.threadId ?? null,
          turnId: body.turnId ?? null,
          message: body.message ?? null,
          createdAt: body.createdAt
        };
        recordPushReceipt(receipt);
        if (isInvalidPushPayloadReceipt(receipt)) {
          recordInvalidPushPayload(Date.now());
        }
        pushSystem("Push receipt recorded", {
          notificationId: receipt.notificationId,
          event: receipt.event,
          threadId: receipt.threadId,
          turnId: receipt.turnId,
          receiptCount: pushReceiptStore.getCount()
        });
        jsonResponse(res, 200, {
          ok: true,
          recorded: true
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/push/vapid-public-key") {
        if (!pushService.isEnabled()) {
          jsonResponse(res, 409, {
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

      if (req.method === "POST" && pathname === "/api/push/subscriptions") {
        if (!pushService.isEnabled()) {
          jsonResponse(res, 409, {
            ok: false,
            error: "Push notifications are disabled"
          });
          return;
        }

        const body = parseBody(CreatePushSubscriptionBodySchema, await readJsonBody(req));
        const settings = body.settings ?? {
          privateMode: PUSH_PRIVATE_MODE_DEFAULT
        };
        const stored = pushStore.upsertSubscription(body.subscription, settings);
        pushSystem("Push subscription saved", {
          endpointHash: endpointHash(body.subscription.endpoint),
          subscriptionId: stored.id,
          privateMode: stored.settings.privateMode,
          subscriptionCount: pushStore.getSubscriptionCount()
        });

        jsonResponse(res, 200, {
          ok: true,
          subscriptionId: stored.id
        });
        return;
      }

      if (req.method === "DELETE" && pathname === "/api/push/subscriptions") {
        const body = parseBody(DeletePushSubscriptionBodySchema, await readJsonBody(req));
        const deleted = pushStore.removeSubscriptionByEndpoint(body.endpoint);
        pushSystem("Push subscription removed", {
          endpointHash: endpointHash(body.endpoint),
          deleted,
          subscriptionCount: pushStore.getSubscriptionCount()
        });

        jsonResponse(res, 200, {
          ok: true,
          deleted
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/push/test") {
        if (!pushService.isEnabled()) {
          jsonResponse(res, 409, {
            ok: false,
            error: "Push notifications are disabled"
          });
          return;
        }

        const body = parseBody(PushTestBodySchema, await readJsonBody(req));
        const readiness = getPushReadiness();
        if (body.dryRun === true) {
          jsonResponse(res, 200, {
            ok: true,
            dryRun: true,
            notificationId: null,
            ready: readiness.ready,
            reason: readiness.reason,
            attempted: readiness.subscriptionCount,
            delivered: 0,
            failures: 0
          });
          return;
        }
        const candidate: CompletionCandidate = {
          threadId: body.threadId,
          turnId: body.turnId,
          marker: `test:${body.threadId}:${body.turnId}:${Date.now()}`,
          agentMessageId: `test_${Date.now()}`,
          agentText: body.body ?? "A response is ready in Farfield."
        };

        const result = await notifyCompletion(candidate);
        jsonResponse(res, 200, {
          ok: true,
          dryRun: false,
          notificationId: result.notificationId,
          ready: readiness.ready,
          reason: readiness.reason,
          attempted: result.attempted,
          delivered: result.delivered,
          failures: result.failures
        });
        return;
      }
    }

    if (req.method === "POST" && pathname === "/api/threads") {
      const body = parseBody(StartThreadBodySchema, await readJsonBody(req));

      pushActionEvent("thread-create", "attempt", {
        cwd: body.cwd ?? DEFAULT_WORKSPACE,
        model: body.model ?? null,
        modelProvider: body.modelProvider ?? null
      });

      let result;
      try {
        result = await runAppServerCall(() =>
          appClient.startThread({
            cwd: body.cwd ?? DEFAULT_WORKSPACE,
            ...(body.model ? { model: body.model } : {}),
            ...(body.modelProvider ? { modelProvider: body.modelProvider } : {}),
            ...(body.personality ? { personality: body.personality } : {}),
            ...(body.sandbox ? { sandbox: body.sandbox } : {}),
            ...(body.approvalPolicy ? { approvalPolicy: body.approvalPolicy } : {}),
            ...(typeof body.ephemeral === "boolean" ? { ephemeral: body.ephemeral } : {})
          })
        );
      } catch (error) {
        const message = pushActionError("thread-create", error, {
          cwd: body.cwd ?? DEFAULT_WORKSPACE
        });
        jsonResponse(res, 500, { ok: false, error: message });
        return;
      }

      pushActionEvent("thread-create", "success", {
        threadId: result.thread.id,
        cwd: result.cwd ?? result.thread.cwd ?? null,
        model: result.model ?? null
      });

      jsonResponse(res, 200, {
        ok: true,
        ...result,
        threadId: result.thread.id
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/threads") {
      const limit = parseInteger(url.searchParams.get("limit"), 80);
      const archived = parseBoolean(url.searchParams.get("archived"), false);
      const all = parseBoolean(url.searchParams.get("all"), false);
      const maxPages = parseInteger(url.searchParams.get("maxPages"), 20);
      const cursor = url.searchParams.get("cursor") ?? null;

      const result = await runTrackedAppServerCall("thread/list", () =>
        all
          ? appClient.listThreadsAll(
              cursor
                ? {
                    limit,
                    archived,
                    cursor,
                    maxPages
                  }
                : {
                    limit,
                    archived,
                    maxPages
                  }
            )
          : appClient.listThreads(
            cursor
              ? {
                  limit,
                  archived,
                  cursor
                }
              : {
                  limit,
                  archived
                }
          )
      );

      jsonResponse(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === "GET" && pathname === "/api/models") {
      const limit = parseInteger(url.searchParams.get("limit"), 100);
      const result = await runTrackedAppServerCall("model/list", () => appClient.listModels(limit));
      jsonResponse(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === "GET" && pathname === "/api/collaboration-modes") {
      const result = await runTrackedAppServerCall("collaborationMode/list", () =>
        appClient.listCollaborationModes()
      );
      jsonResponse(res, 200, { ok: true, ...result });
      return;
    }

    if (segments[0] === "api" && segments[1] === "threads" && segments[2]) {
      const threadId = decodeURIComponent(segments[2]);

      if (req.method === "GET" && segments.length === 3) {
        markThreadEventsTracked(threadId);
        const includeTurns = parseBoolean(url.searchParams.get("includeTurns"), true);
        let result;
        try {
          result = await runAppServerCall(() => appClient.readThread(threadId, includeTurns));
        } catch (error) {
          if (isThreadNotLoadedError(error)) {
            jsonResponse(res, 404, {
              ok: false,
              error: `Thread not loaded in app-server: ${threadId}`,
              threadId
            });
            return;
          }
          throw error;
        }
        jsonResponse(res, 200, { ok: true, ...result });
        return;
      }

      if (req.method === "GET" && segments[3] === "live-state") {
        markThreadEventsTracked(threadId);
        const live = getThreadLiveState(threadId);
        jsonResponse(res, 200, {
          ok: true,
          threadId,
          ownerClientId: live.ownerClientId,
          conversationState: live.conversationState
        });
        return;
      }

      if (req.method === "GET" && segments[3] === "stream-events") {
        markThreadEventsTracked(threadId);
        const limit = parseInteger(url.searchParams.get("limit"), 60);
        const events = (streamEventsByThreadId.get(threadId) ?? []).slice(-limit);
        jsonResponse(res, 200, {
          ok: true,
          threadId,
          ownerClientId: threadOwnerById.get(threadId) ?? null,
          events
        });
        return;
      }

      if (req.method === "POST" && segments[3] === "messages") {
        const body = parseBody(SendMessageBodySchema, await readJsonBody(req));

        if (body.isSteering === true) {
          jsonResponse(res, 400, {
            ok: false,
            error: "Steering messages are not supported on this endpoint."
          });
          return;
        }

        pushActionEvent("messages", "attempt", {
          threadId,
          textLength: body.text.length
        });

        try {
          await runAppServerCall(() => appClient.sendUserMessage(threadId, body.text));
        } catch (error) {
          const message = pushActionError("messages", error, { threadId });
          jsonResponse(res, 500, { ok: false, error: message, threadId });
          return;
        }

        pushActionEvent("messages", "success", {
          threadId
        });

        jsonResponse(res, 200, {
          ok: true,
          threadId
        });
        return;
      }

      if (req.method === "POST" && segments[3] === "collaboration-mode") {
        if (!requireIpcReady(res)) {
          return;
        }

        const body = parseBody(SetModeBodySchema, await readJsonBody(req));
        let ownerClientId: string;
        try {
          ownerClientId = resolveOwnerClientId(threadOwnerById, threadId, body.ownerClientId);
        } catch (error) {
          const message = pushActionError("collaboration-mode", error, { threadId });
          jsonResponse(res, 409, { ok: false, error: message, threadId });
          return;
        }

        pushActionEvent("collaboration-mode", "attempt", {
          threadId,
          ownerClientId,
          collaborationMode: body.collaborationMode
        });

        try {
          await service.setCollaborationMode({
            threadId,
            ownerClientId,
            collaborationMode: body.collaborationMode as CollaborationMode
          });
        } catch (error) {
          const message = pushActionError("collaboration-mode", error, {
            threadId,
            ownerClientId,
            collaborationMode: body.collaborationMode
          });
          jsonResponse(res, 500, { ok: false, error: message, threadId, ownerClientId });
          return;
        }

        pushActionEvent("collaboration-mode", "success", {
          threadId,
          ownerClientId,
          collaborationMode: body.collaborationMode
        });

        jsonResponse(res, 200, {
          ok: true,
          threadId,
          ownerClientId
        });
        return;
      }

      if (req.method === "POST" && segments[3] === "user-input") {
        if (!requireIpcReady(res)) {
          return;
        }

        const body = parseBody(SubmitUserInputBodySchema, await readJsonBody(req));
        let ownerClientId: string;
        try {
          ownerClientId = resolveOwnerClientId(threadOwnerById, threadId, body.ownerClientId);
        } catch (error) {
          const message = pushActionError("user-input", error, { threadId, requestId: body.requestId });
          jsonResponse(res, 409, { ok: false, error: message, threadId, requestId: body.requestId });
          return;
        }

        pushActionEvent("user-input", "attempt", {
          threadId,
          ownerClientId,
          requestId: body.requestId
        });

        try {
          await service.submitUserInput({
            threadId,
            ownerClientId,
            requestId: body.requestId,
            response: parseUserInputResponsePayload(body.response)
          });
        } catch (error) {
          const message = pushActionError("user-input", error, {
            threadId,
            ownerClientId,
            requestId: body.requestId
          });
          jsonResponse(res, 500, {
            ok: false,
            error: message,
            threadId,
            ownerClientId,
            requestId: body.requestId
          });
          return;
        }

        pushActionEvent("user-input", "success", {
          threadId,
          ownerClientId,
          requestId: body.requestId
        });

        jsonResponse(res, 200, {
          ok: true,
          threadId,
          ownerClientId,
          requestId: body.requestId
        });
        return;
      }

      if (req.method === "POST" && segments[3] === "interrupt") {
        if (!requireIpcReady(res)) {
          return;
        }

        const body = parseBody(InterruptBodySchema, await readJsonBody(req));
        let ownerClientId: string;
        try {
          ownerClientId = resolveOwnerClientId(threadOwnerById, threadId, body.ownerClientId);
        } catch (error) {
          const message = pushActionError("interrupt", error, { threadId });
          jsonResponse(res, 409, { ok: false, error: message, threadId });
          return;
        }

        pushActionEvent("interrupt", "attempt", {
          threadId,
          ownerClientId
        });

        try {
          await service.interrupt({
            threadId,
            ownerClientId
          });
        } catch (error) {
          const message = pushActionError("interrupt", error, {
            threadId,
            ownerClientId
          });
          jsonResponse(res, 500, { ok: false, error: message, threadId, ownerClientId });
          return;
        }

        pushActionEvent("interrupt", "success", {
          threadId,
          ownerClientId
        });

        jsonResponse(res, 200, {
          ok: true,
          threadId,
          ownerClientId
        });
        return;
      }
    }

    if (segments[0] === "api" && segments[1] === "debug") {
      if (req.method === "POST" && pathname === "/api/debug/client-errors") {
        const body = parseBody(CreateDebugClientErrorBodySchema, await readJsonBody(req));
        const nowMs = Date.now();
        pruneRecentClientErrorFingerprints(nowMs);
        const dedupFingerprint = buildClientErrorFingerprint(body);
        const previous = recentClientErrorByFingerprint.get(dedupFingerprint) ?? null;
        if (previous && nowMs - previous.timestampMs < SERVER_CLIENT_ERROR_DEDUP_WINDOW_MS) {
          recordSuppressedClientErrorReport(nowMs);
          logger.info(
            {
              errorId: previous.errorId,
              source: body.source,
              operation: body.operation,
              requestId: body.requestId,
              threadId: body.threadId
            },
            "client-error-report-suppressed"
          );
          jsonResponse(res, 200, {
            ok: true,
            errorId: previous.errorId,
            sessionId: clientErrorStore.getSessionId(),
            recordedAt: previous.recordedAt
          });
          return;
        }

        const event = clientErrorStore.recordClientError(body);
        recentClientErrorByFingerprint.set(dedupFingerprint, {
          timestampMs: nowMs,
          errorId: event.errorId,
          recordedAt: event.recordedAt
        });
        const transientThreadNotLoaded =
          event.operation.startsWith("thread:load-") &&
          event.message.includes("Thread not loaded in app-server:");
        const logPayload = {
          errorId: event.errorId,
          origin: event.origin,
          source: event.source,
          operation: event.operation,
          requestId: event.requestId,
          threadId: event.threadId,
          message: event.message
        };
        if (transientThreadNotLoaded) {
          logger.warn(logPayload, "client-error-recorded-transient");
        } else {
          logger.error(logPayload, "client-error-recorded");
        }

        jsonResponse(res, 200, {
          ok: true,
          errorId: event.errorId,
          sessionId: clientErrorStore.getSessionId(),
          recordedAt: event.recordedAt
        });
        return;
      }

      if (
        req.method === "GET" &&
        segments[2] === "client-errors" &&
        segments[3] === "session-log"
      ) {
        const logPath = clientErrorStore.getSessionLogPath();
        if (!fs.existsSync(logPath)) {
          jsonResponse(res, 404, { ok: false, error: "Error session log not found" });
          return;
        }

        const data = fs.readFileSync(logPath);
        res.writeHead(200, {
          "Content-Type": "application/x-ndjson",
          "Content-Length": data.length,
          "Content-Disposition": `attachment; filename=\"${path.basename(logPath)}\"`,
          "Access-Control-Allow-Origin": "*"
        });
        res.end(data);
        return;
      }

      if (req.method === "GET" && segments[2] === "client-errors" && segments.length === 3) {
        const limit = parseInteger(url.searchParams.get("limit"), 120);
        jsonResponse(res, 200, {
          ok: true,
          data: clientErrorStore.list(limit),
          sessionId: clientErrorStore.getSessionId(),
          sessionLogPath: clientErrorStore.getSessionLogPath()
        });
        return;
      }

      if (req.method === "GET" && segments[2] === "client-errors" && segments[3]) {
        const errorId = decodeURIComponent(segments[3]);
        const event = clientErrorStore.getById(errorId);
        if (!event) {
          jsonResponse(res, 404, { ok: false, error: "Client error not found" });
          return;
        }

        jsonResponse(res, 200, {
          ok: true,
          error: event,
          sessionId: clientErrorStore.getSessionId(),
          sessionLogPath: clientErrorStore.getSessionLogPath()
        });
        return;
      }

      if (req.method === "GET" && segments[2] === "history") {
        const limit = parseInteger(url.searchParams.get("limit"), 120);
        const data = history.slice(-limit);
        jsonResponse(res, 200, { ok: true, history: data });
        return;
      }

      if (req.method === "GET" && segments[2] === "history" && segments[3]) {
        const entryId = decodeURIComponent(segments[3]);
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

      if (req.method === "POST" && pathname === "/api/debug/replay") {
        if (!requireIpcReady(res)) {
          return;
        }

        const body = parseBody(ReplayBodySchema, await readJsonBody(req));
        const entry = history.find((item) => item.id === body.entryId);
        if (!entry) {
          jsonResponse(res, 404, { ok: false, error: "History entry not found" });
          return;
        }

        const payload = historyById.get(entry.id);
        if (!payload || typeof payload !== "object") {
          jsonResponse(res, 409, { ok: false, error: "Entry payload is unavailable" });
          return;
        }

        const record = payload as Record<string, unknown>;
        const type = record["type"];

        if (type === "request") {
          const method = record["method"];
          if (typeof method !== "string") {
            jsonResponse(res, 409, { ok: false, error: "Captured request has invalid method" });
            return;
          }

          const options: SendRequestOptions = {};
          if (typeof record["targetClientId"] === "string") {
            options.targetClientId = record["targetClientId"];
          }
          if (typeof record["version"] === "number") {
            options.version = record["version"];
          }

          const sendPromise = sendIpcRequest(method, record["params"], options);

          if (body.waitForResponse) {
            const response = await sendPromise;
            jsonResponse(res, 200, { ok: true, replayed: true, response });
            return;
          }

          void sendPromise.catch((error) => {
            pushSystem("Replay request failed", { error: toErrorMessage(error), entryId: entry.id });
          });

          jsonResponse(res, 200, {
            ok: true,
            replayed: true,
            queued: true
          });
          return;
        }

        if (type === "broadcast") {
          const method = record["method"];
          if (typeof method !== "string") {
            jsonResponse(res, 409, { ok: false, error: "Captured broadcast has invalid method" });
            return;
          }

          const options: SendRequestOptions = {};
          if (typeof record["targetClientId"] === "string") {
            options.targetClientId = record["targetClientId"];
          }
          if (typeof record["version"] === "number") {
            options.version = record["version"];
          }

          sendIpcBroadcast(method, record["params"], options);

          jsonResponse(res, 200, { ok: true, replayed: true });
          return;
        }

        jsonResponse(res, 409, {
          ok: false,
          error: "Only captured request and broadcast entries can be replayed"
        });
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
    runtimeState.lastError = toErrorMessage(error);
    const requestFailedEvent = clientErrorStore.recordServerError({
      source: "monitor-server",
      operation: "request-failed",
      message: runtimeState.lastError,
      name: error instanceof Error ? error.name : null,
      stack: error instanceof Error ? (error.stack ?? null) : null,
      requestId: null,
      threadId: null,
      url: req.url ?? null,
      details: {
        method: req.method ?? "unknown"
      },
      occurredAt: new Date().toISOString()
    });
    logger.error(
      {
        method: req.method ?? "unknown",
        url: req.url ?? "unknown",
        error: runtimeState.lastError,
        errorId: requestFailedEvent.errorId
      },
      "request-failed"
    );
    pushSystem("Request failed", {
      error: runtimeState.lastError,
      method: req.method ?? "unknown",
      url: req.url ?? "unknown"
    });
    broadcastRuntimeState();
    jsonResponse(res, 500, {
      ok: false,
      error: runtimeState.lastError
    });
  }
});

async function bootstrapConnections(): Promise<void> {
  if (bootstrapInFlight) {
    return bootstrapInFlight;
  }

  bootstrapInFlight = (async () => {
    try {
      await runAppServerCall(() => appClient.listThreads({ limit: 1, archived: false }));
    } catch (error) {
      const errorMessage = setRuntimeError(error);
      pushSystem("App-server bootstrap failed", { error: errorMessage });
    }

    try {
      if (!ipcClient.isConnected()) {
        await ipcClient.connect();
      }
      runtimeState.ipcConnected = true;

      const initializeResponse = await ipcClient.initialize(USER_AGENT);
      runtimeState.ipcInitialized = true;

      const initializeResult = initializeResponse.result;
      if (initializeResult && typeof initializeResult === "object") {
        const candidate = (initializeResult as Record<string, unknown>)["clientId"];
        if (typeof candidate === "string" && candidate.trim()) {
          pushSystem("IPC initialized", { clientId: candidate });
        }
      }

    } catch (error) {
      runtimeState.ipcInitialized = false;
      if (!ipcClient.isConnected()) {
        runtimeState.ipcConnected = false;
      }

      const errorMessage = setRuntimeError(error);
      pushSystem("IPC bootstrap failed", { error: errorMessage });
    } finally {
      broadcastRuntimeState();
      bootstrapInFlight = null;
    }
  })();

  return bootstrapInFlight;
}

async function start(): Promise<void> {
  ensureTraceDirectory();
  requirePushConfiguration();
  const migrationResult = migratePushStateFile(PUSH_STATE_RESOLUTION);
  if (migrationResult.migrated && migrationResult.fromPath) {
    pushSystem("Push state file migrated", {
      fromPath: migrationResult.fromPath,
      toPath: migrationResult.toPath
    });
  }
  pushStore.load();
  pushReceiptStore.load();
  pushSendStore.load();
  completionDetector = new CompletionDetector(
    new Map(pushStore.listCompletionWatermarks().map((entry) => [entry.threadId, entry.marker]))
  );

  pushSystem("Starting Codex monitor server", {
    appExecutable: runtimeState.appExecutable,
    socketPath: runtimeState.socketPath
  });

  pushSystem("Push subsystem ready", {
    enabled: pushService.isEnabled(),
    configured: runtimeState.pushConfigured,
    requiresAuth: isApiAuthRequired(),
    authConfigured: API_AUTH_TOKEN.length > 0,
    statePath: PUSH_STATE_PATH,
    statePathSource: PUSH_STATE_RESOLUTION.source,
    receiptsPath: PUSH_RECEIPTS_PATH,
    sendsPath: PUSH_SENDS_PATH,
    receiptsMaxCount: MAX_PUSH_RECEIPTS,
    receiptsMaxAgeDays: PUSH_RECEIPTS_MAX_AGE_DAYS,
    subscriptionCount: pushStore.getSubscriptionCount(),
    watermarkCount: pushStore.listCompletionWatermarks().length,
    receiptCount: pushReceiptStore.getCount()
  });
  if (!LOOPBACK_HOSTS.has(HOST) && API_AUTH_TOKEN.length === 0) {
    pushSystem("API auth is disabled on a non-loopback host", {
      host: HOST,
      recommendation: "Set API_TOKEN to require X-Farfield-Token for /api routes."
    });
    logger.warn(
      {
        host: HOST
      },
      "api-auth-disabled-non-loopback"
    );
  }

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
    appExecutable: runtimeState.appExecutable,
    socketPath: runtimeState.socketPath
  });
  broadcastRuntimeState();
  logger.info({ url: `http://${HOST}:${PORT}` }, "monitor-server-ready");

  void bootstrapConnections();
}

async function shutdown(): Promise<void> {
  if (activeTrace) {
    activeTrace.stream.end();
    activeTrace = null;
  }

  await ipcClient.disconnect();
  await appClient.close();

  await new Promise<void>((resolve) => server.close(() => resolve()));
}

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

void start().catch((error) => {
  const errorMessage = setRuntimeError(error);
  pushSystem("Monitor server failed to start", { error: errorMessage });
  logger.fatal({ error: errorMessage }, "monitor-server-failed-to-start");
  process.exit(1);
});
