import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { z } from "zod";
import {
  resolvePushStatePath,
  type PushStatePathResolution
} from "../../Modules/PushNotifications/PushStatePath.js";
import {
  parseNtfyConfigFromEnv,
  type NtfyConfig
} from "../../Modules/PushNotifications/NtfyNotifier.js";
import {
  LoggerLevelSchema,
  type LoggerLevel
} from "../../Shared/Logging/Logger.js";

const OptionalPathEnvSchema = z.string().trim().min(1).optional();

function parsePositiveInteger(value: string | null, defaultValue: number): number {
  if (!value) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return parsed;
}

function parseBooleanEnvironmentValue(value: string | null, defaultValue: boolean): boolean {
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

function parseOptionalPathEnvironmentValue(label: string, value: string | undefined): string | null {
  const parsed = OptionalPathEnvSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`${label} must be a non-empty path when set`);
  }

  if (!parsed.data) {
    return null;
  }

  return path.resolve(parsed.data);
}

function resolveCodexExecutablePathFromEnvironment(env: NodeJS.ProcessEnv): string {
  if (env["CODEX_CLI_PATH"]) {
    return env["CODEX_CLI_PATH"];
  }

  const desktopPath = "/Applications/Codex.app/Contents/Resources/codex";
  if (fs.existsSync(desktopPath)) {
    return desktopPath;
  }

  return "codex";
}

function resolveIpcSocketPathFromEnvironment(env: NodeJS.ProcessEnv): string {
  if (env["CODEX_IPC_SOCKET"]) {
    return env["CODEX_IPC_SOCKET"];
  }

  if (process.platform === "win32") {
    return "\\\\.\\pipe\\codex-ipc";
  }

  const userIdentifier = process.getuid?.() ?? 0;
  return path.join(os.tmpdir(), "codex-ipc", `ipc-${String(userIdentifier)}.sock`);
}

function resolveGitCommitHash(defaultWorkspacePath: string): string | null {
  try {
    const hash = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: defaultWorkspacePath,
      encoding: "utf8"
    }).trim();
    return hash.length > 0 ? hash : null;
  } catch {
    return null;
  }
}

function resolvePushLocalCaSourcePath(env: NodeJS.ProcessEnv): string {
  const configuredPath = parseOptionalPathEnvironmentValue("PUSH_LOCAL_CA_PATH", env["PUSH_LOCAL_CA_PATH"]);
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
      parseOptionalPathEnvironmentValue("APPDATA", env["APPDATA"])
      ?? path.join(homeDirectory, "AppData", "Roaming");
    return path.join(appDataDirectory, "Caddy", "pki", "authorities", "local", "root.crt");
  }

  const xdgDataHome =
    parseOptionalPathEnvironmentValue("XDG_DATA_HOME", env["XDG_DATA_HOME"])
    ?? path.join(homeDirectory, ".local", "share");
  return path.join(xdgDataHome, "caddy", "pki", "authorities", "local", "root.crt");
}

export interface ServerRuntimeConfiguration {
  logLevel: LoggerLevel;
  host: string;
  port: number;
  historyLimit: number;
  historyPayloadSummaryMaximumBytes: number;
  userAgent: string;
  runtimeStateSnapshotCacheTimeToLiveMs: number;
  ipcReconnectDelayMs: number;
  ntfyCompletionDebounceMs: number;
  capabilityListTimeoutMs: number;
  threadListAdapterTimeoutMs: number;
  pushTestSendTimeoutMs: number;
  traceDirectoryPath: string;
  defaultWorkspacePath: string;
  apiTokenHeaderName: string;
  apiTokenResponseHeader: string;
  apiSessionCookieName: string;
  apiSessionTimeToLiveMs: number;
  apiSessionSigningSecret: string;
  apiSessionSecureCookie: boolean;
  clientRequestIdHeaderName: string;
  clientRequestIdResponseHeader: string;
  clientActionIdHeaderName: string;
  clientActionIdResponseHeader: string;
  clientActionNameHeaderName: string;
  clientActionNameResponseHeader: string;
  apiToken: string;
  apiAuthRequired: boolean;
  pushEnabled: boolean;
  pushPrivateModeDefault: boolean;
  pushReceiptsMaxCount: number;
  pushReceiptsMaxAgeDays: number;
  threadListAggregationCacheTimeToLiveMs: number;
  threadListAggregationCacheMaximumEntries: number;
  webHealthBuildId: string;
  webHealthServiceWorkerVersion: string | null;
  appServerBaseEnvironment: NodeJS.ProcessEnv;
  codexExecutablePath: string;
  ipcSocketPath: string;
  gitCommit: string | null;
  pushStatePathResolution: PushStatePathResolution;
  pushReceiptsPath: string;
  pushSendsPath: string;
  pushLocalCaSourcePath: string;
  pushVapidPublicKey: string;
  pushVapidPrivateKey: string;
  pushVapidSubject: string;
  clientErrorSessionStartedAt: string;
  clientErrorSessionTimestamp: string;
  clientErrorSessionId: string;
  clientErrorLogPath: string;
  clientErrorMaxEntries: number;
  invalidThreadStreamEventsLogPath: string;
  ntfyConfiguration: NtfyConfig;
}

export function readServerRuntimeConfigurationFromCurrentProcessEnvironment(): ServerRuntimeConfiguration {
  return readServerRuntimeConfiguration(process.env);
}

export function readServerRuntimeConfiguration(env: NodeJS.ProcessEnv): ServerRuntimeConfiguration {
  const defaultWorkspacePath = path.resolve(process.cwd());
  const logLevel = LoggerLevelSchema.parse((env["LOG_LEVEL"] ?? "info").trim().toLowerCase());
  const host = env["HOST"] ?? "127.0.0.1";
  const port = parsePositiveInteger(env["PORT"] ?? null, 4311);
  const historyLimit = 2_000;
  const historyPayloadSummaryMaximumBytes = parsePositiveInteger(
    env["HISTORY_PAYLOAD_SUMMARY_MAXIMUM_BYTES"] ?? null,
    131_072
  );
  const userAgent = "farfield/0.2.0";
  const runtimeStateSnapshotCacheTimeToLiveMs = parsePositiveInteger(
    env["RUNTIME_STATE_SNAPSHOT_CACHE_TIME_TO_LIVE_MS"] ?? null,
    250
  );
  const ipcReconnectDelayMs = 1_000;
  const ntfyCompletionDebounceMs = 250;
  const capabilityListTimeoutMs = 8_000;
  const threadListAdapterTimeoutMs = parsePositiveInteger(
    env["THREAD_LIST_ADAPTER_TIMEOUT_MS"] ?? null,
    7_500
  );
  const pushTestSendTimeoutMs = parsePositiveInteger(
    env["PUSH_TEST_SEND_TIMEOUT_MS"] ?? null,
    7_500
  );

  const traceDirectoryPath = path.resolve(process.cwd(), "traces");

  const apiTokenHeaderName = "x-farfield-token";
  const apiTokenResponseHeader = "X-Farfield-Token";
  const apiSessionCookieName = "farfield_session";
  const apiSessionTimeToLiveMs = parsePositiveInteger(env["API_SESSION_TIME_TO_LIVE_MS"] ?? null, 28_800_000);
  const clientRequestIdHeaderName = "x-farfield-request-id";
  const clientRequestIdResponseHeader = "X-Farfield-Request-Id";
  const clientActionIdHeaderName = "x-farfield-action-id";
  const clientActionIdResponseHeader = "X-Farfield-Action-Id";
  const clientActionNameHeaderName = "x-farfield-action-name";
  const clientActionNameResponseHeader = "X-Farfield-Action-Name";
  const apiToken = (env["API_TOKEN"] ?? env["PUSH_API_TOKEN"] ?? "").trim();
  const apiAuthRequired = apiToken.length > 0;
  const apiSessionSigningSecret = (env["API_SESSION_SECRET"] ?? apiToken ?? "").trim() || "farfield_session_secret";
  const apiSessionSecureCookie = parseBooleanEnvironmentValue(env["API_SESSION_SECURE_COOKIE"] ?? null, false);

  const pushEnabled = parseBooleanEnvironmentValue(env["PUSH_ENABLED"] ?? null, false);
  const pushPrivateModeDefault = parseBooleanEnvironmentValue(env["PUSH_PRIVATE_MODE_DEFAULT"] ?? null, true);
  const pushReceiptsMaxCount = parsePositiveInteger(env["PUSH_RECEIPTS_MAX_COUNT"] ?? null, 100);
  const pushReceiptsMaxAgeDays = parsePositiveInteger(env["PUSH_RECEIPTS_MAX_AGE_DAYS"] ?? null, 7);
  const threadListAggregationCacheTimeToLiveMs = parsePositiveInteger(
    env["THREAD_LIST_AGGREGATION_CACHE_TIME_TO_LIVE_MS"] ?? null,
    2_000
  );
  const threadListAggregationCacheMaximumEntries = parsePositiveInteger(
    env["THREAD_LIST_AGGREGATION_CACHE_MAXIMUM_ENTRIES"] ?? null,
    48
  );

  const webHealthBuildId = (env["WEB_BUILD_ID"] ?? env["VITE_APP_BUILD_ID"] ?? "dev").trim() || "dev";
  const webHealthServiceWorkerVersion = (env["WEB_SERVICE_WORKER_VERSION"] ?? "").trim() || null;

  const codexExecutablePath = resolveCodexExecutablePathFromEnvironment(env);
  const ipcSocketPath = resolveIpcSocketPathFromEnvironment(env);
  const gitCommit = resolveGitCommitHash(defaultWorkspacePath);

  const pushStatePathResolution = resolvePushStatePath({
    envPath: env["PUSH_STATE_PATH"],
    appDataPath: env["APPDATA"],
    xdgStateHome: env["XDG_STATE_HOME"],
    homeDirectory: os.homedir(),
    platform: process.platform
  });

  const pushReceiptsPath =
    parseOptionalPathEnvironmentValue("PUSH_RECEIPTS_PATH", env["PUSH_RECEIPTS_PATH"])
    ?? path.join(path.dirname(pushStatePathResolution.filePath), "push-receipts.json");
  const pushSendsPath =
    parseOptionalPathEnvironmentValue("PUSH_SENDS_PATH", env["PUSH_SENDS_PATH"])
    ?? path.join(path.dirname(pushStatePathResolution.filePath), "push-sends.json");

  const pushLocalCaSourcePath = resolvePushLocalCaSourcePath(env);
  const pushVapidPublicKey = (env["PUSH_VAPID_PUBLIC_KEY"] ?? "").trim();
  const pushVapidPrivateKey = (env["PUSH_VAPID_PRIVATE_KEY"] ?? "").trim();
  const pushVapidSubject = (env["PUSH_VAPID_SUBJECT"] ?? "").trim();

  if (
    pushEnabled
    && (pushVapidPublicKey.length === 0 || pushVapidPrivateKey.length === 0 || pushVapidSubject.length === 0)
  ) {
    throw new Error(
      "PUSH_ENABLED=true requires PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY, and PUSH_VAPID_SUBJECT"
    );
  }

  const clientErrorSessionStartedAt = new Date().toISOString();
  const clientErrorSessionTimestamp = clientErrorSessionStartedAt.replace(/[:.]/g, "-");
  const clientErrorSessionId = `session-${clientErrorSessionTimestamp}-${String(process.pid)}`;
  const clientErrorLogPath =
    parseOptionalPathEnvironmentValue("DEBUG_CLIENT_ERROR_LOG_PATH", env["DEBUG_CLIENT_ERROR_LOG_PATH"])
    ?? path.join(defaultWorkspacePath, ".runtime", "logs", "errors", "client-errors.ndjson");
  const clientErrorMaxEntries = parsePositiveInteger(env["DEBUG_CLIENT_ERROR_MAX_ENTRIES"] ?? null, 2000);
  const invalidThreadStreamEventsLogPath =
    parseOptionalPathEnvironmentValue("FARFIELD_INVALID_STREAM_LOG_PATH", env["FARFIELD_INVALID_STREAM_LOG_PATH"])
    ?? path.resolve(defaultWorkspacePath, ".runtime", "logs", "threads", "invalid-thread-stream-events.ndjson");
  const ntfyConfiguration = parseNtfyConfigFromEnv(env);

  return {
    logLevel,
    host,
    port,
    historyLimit,
    historyPayloadSummaryMaximumBytes,
    userAgent,
    runtimeStateSnapshotCacheTimeToLiveMs,
    ipcReconnectDelayMs,
    ntfyCompletionDebounceMs,
    capabilityListTimeoutMs,
    threadListAdapterTimeoutMs,
    pushTestSendTimeoutMs,
    traceDirectoryPath,
    defaultWorkspacePath,
    apiTokenHeaderName,
    apiTokenResponseHeader,
    apiSessionCookieName,
    apiSessionTimeToLiveMs,
    apiSessionSigningSecret,
    apiSessionSecureCookie,
    clientRequestIdHeaderName,
    clientRequestIdResponseHeader,
    clientActionIdHeaderName,
    clientActionIdResponseHeader,
    clientActionNameHeaderName,
    clientActionNameResponseHeader,
    apiToken,
    apiAuthRequired,
    pushEnabled,
    pushPrivateModeDefault,
    pushReceiptsMaxCount,
    pushReceiptsMaxAgeDays,
    threadListAggregationCacheTimeToLiveMs,
    threadListAggregationCacheMaximumEntries,
    webHealthBuildId,
    webHealthServiceWorkerVersion,
    appServerBaseEnvironment: env,
    codexExecutablePath,
    ipcSocketPath,
    gitCommit,
    pushStatePathResolution,
    pushReceiptsPath,
    pushSendsPath,
    pushLocalCaSourcePath,
    pushVapidPublicKey,
    pushVapidPrivateKey,
    pushVapidSubject,
    clientErrorSessionStartedAt,
    clientErrorSessionTimestamp,
    clientErrorSessionId,
    clientErrorLogPath,
    clientErrorMaxEntries,
    invalidThreadStreamEventsLogPath,
    ntfyConfiguration
  };
}
