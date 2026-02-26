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

// Owner note: this module is the single startup boundary for server environment
// parsing, including key ownership, defaults, and precedence decisions.
const OptionalPathEnvSchema = z.string().trim().min(1).optional();
const ServerRuntimeEnvironmentVariableNames = Object.freeze({
  appDataPath: "APPDATA",
  apiSessionSecret: "API_SESSION_SECRET",
  apiSessionSecureCookie: "API_SESSION_SECURE_COOKIE",
  apiSessionTimeToLiveMilliseconds: "API_SESSION_TIME_TO_LIVE_MS",
  apiToken: "API_TOKEN",
  codexCliPath: "CODEX_CLI_PATH",
  codexIpcSocketPath: "CODEX_IPC_SOCKET",
  debugClientErrorLogPath: "DEBUG_CLIENT_ERROR_LOG_PATH",
  debugClientErrorMaximumEntries: "DEBUG_CLIENT_ERROR_MAX_ENTRIES",
  historyPayloadSummaryMaximumBytes: "HISTORY_PAYLOAD_SUMMARY_MAXIMUM_BYTES",
  host: "HOST",
  invalidThreadStreamEventsLogPath: "FARFIELD_INVALID_STREAM_LOG_PATH",
  logLevel: "LOG_LEVEL",
  port: "PORT",
  pushApiToken: "PUSH_API_TOKEN",
  pushEnabled: "PUSH_ENABLED",
  pushLocalCaPath: "PUSH_LOCAL_CA_PATH",
  pushPrivateModeDefault: "PUSH_PRIVATE_MODE_DEFAULT",
  pushReceiptsMaxAgeDays: "PUSH_RECEIPTS_MAX_AGE_DAYS",
  pushReceiptsMaxCount: "PUSH_RECEIPTS_MAX_COUNT",
  pushReceiptsPath: "PUSH_RECEIPTS_PATH",
  pushSendsPath: "PUSH_SENDS_PATH",
  pushStatePath: "PUSH_STATE_PATH",
  pushTestSendTimeoutMilliseconds: "PUSH_TEST_SEND_TIMEOUT_MS",
  pushVapidPrivateKey: "PUSH_VAPID_PRIVATE_KEY",
  pushVapidPublicKey: "PUSH_VAPID_PUBLIC_KEY",
  pushVapidSubject: "PUSH_VAPID_SUBJECT",
  runtimeStateSnapshotCacheTimeToLiveMilliseconds: "RUNTIME_STATE_SNAPSHOT_CACHE_TIME_TO_LIVE_MS",
  threadListAdapterTimeoutMilliseconds: "THREAD_LIST_ADAPTER_TIMEOUT_MS",
  threadListAggregationCacheMaximumEntries: "THREAD_LIST_AGGREGATION_CACHE_MAXIMUM_ENTRIES",
  threadListAggregationCacheTimeToLiveMilliseconds: "THREAD_LIST_AGGREGATION_CACHE_TIME_TO_LIVE_MS",
  webApplicationBuildId: "VITE_APP_BUILD_ID",
  webBuildId: "WEB_BUILD_ID",
  webServiceWorkerVersion: "WEB_SERVICE_WORKER_VERSION",
  xdgDataHome: "XDG_DATA_HOME",
  xdgStateHome: "XDG_STATE_HOME"
});
const ServerRuntimeDefaultValues = Object.freeze({
  apiSessionSecureCookie: false,
  apiSessionSigningSecret: "farfield_session_secret",
  apiSessionTimeToLiveMilliseconds: 28_800_000,
  capabilityListTimeoutMilliseconds: 8_000,
  clientErrorMaximumEntries: 2_000,
  historyLimit: 2_000,
  historyPayloadSummaryMaximumBytes: 131_072,
  host: "127.0.0.1",
  ipcReconnectDelayMilliseconds: 1_000,
  logLevel: "info",
  notificationCompletionDebounceMilliseconds: 250,
  port: 4_311,
  pushEnabled: false,
  pushPrivateModeDefault: true,
  pushReceiptsMaxAgeDays: 7,
  pushReceiptsMaxCount: 100,
  pushTestSendTimeoutMilliseconds: 7_500,
  runtimeStateSnapshotCacheTimeToLiveMilliseconds: 250,
  threadListAdapterTimeoutMilliseconds: 7_500,
  threadListAggregationCacheMaximumEntries: 48,
  threadListAggregationCacheTimeToLiveMilliseconds: 2_000,
  webHealthBuildId: "dev"
});
const ServerRuntimeStaticConfiguration = Object.freeze({
  apiSessionCookieName: "farfield_session",
  apiTokenHeaderName: "x-farfield-token",
  apiTokenResponseHeader: "X-Farfield-Token",
  clientActionIdentifierHeaderName: "x-farfield-action-id",
  clientActionIdentifierResponseHeader: "X-Farfield-Action-Id",
  clientActionNameHeaderName: "x-farfield-action-name",
  clientActionNameResponseHeader: "X-Farfield-Action-Name",
  clientErrorLogFileName: "client-errors.ndjson",
  clientRequestIdentifierHeaderName: "x-farfield-request-id",
  clientRequestIdentifierResponseHeader: "X-Farfield-Request-Id",
  codexDesktopExecutablePath: "/Applications/Codex.app/Contents/Resources/codex",
  codexExecutablePath: "codex",
  codexIpcDirectoryName: "codex-ipc",
  errorsLogDirectoryName: "errors",
  invalidThreadStreamEventsLogFileName: "invalid-thread-stream-events.ndjson",
  logsDirectoryName: "logs",
  pushReceiptsFileName: "push-receipts.json",
  pushSendsFileName: "push-sends.json",
  runtimeDirectoryName: ".runtime",
  sessionIdentifierPrefix: "session-",
  threadLogsDirectoryName: "threads",
  traceDirectoryName: "traces",
  userAgent: "farfield/0.2.0",
  windowsCodexIpcSocketPath: "\\\\.\\pipe\\codex-ipc"
});

function readEnvironmentValue(env: NodeJS.ProcessEnv, variableName: string): string | null {
  return env[variableName] ?? null;
}

function readTrimmedEnvironmentValue(env: NodeJS.ProcessEnv, variableName: string): string {
  return (readEnvironmentValue(env, variableName) ?? "").trim();
}

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

function readPositiveIntegerEnvironmentValue(
  env: NodeJS.ProcessEnv,
  variableName: string,
  defaultValue: number
): number {
  return parsePositiveInteger(readEnvironmentValue(env, variableName), defaultValue);
}

function readBooleanEnvironmentValue(
  env: NodeJS.ProcessEnv,
  variableName: string,
  defaultValue: boolean
): boolean {
  return parseBooleanEnvironmentValue(readEnvironmentValue(env, variableName), defaultValue);
}

function readOptionalPathEnvironmentValue(env: NodeJS.ProcessEnv, variableName: string): string | null {
  return parseOptionalPathEnvironmentValue(variableName, env[variableName]);
}

function resolveApiTokenFromEnvironment(env: NodeJS.ProcessEnv): string {
  const apiTokenValue = readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.apiToken);
  if (apiTokenValue !== null) {
    return apiTokenValue.trim();
  }

  return readTrimmedEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.pushApiToken);
}

function resolveWebHealthBuildIdentifierFromEnvironment(env: NodeJS.ProcessEnv): string {
  const buildIdentifierCandidate =
    readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.webBuildId)
    ?? readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.webApplicationBuildId)
    ?? ServerRuntimeDefaultValues.webHealthBuildId;
  const normalizedBuildIdentifier = buildIdentifierCandidate.trim();
  return normalizedBuildIdentifier.length > 0
    ? normalizedBuildIdentifier
    : ServerRuntimeDefaultValues.webHealthBuildId;
}

function resolveApiSessionSigningSecret(env: NodeJS.ProcessEnv, apiToken: string): string {
  const sessionSecretCandidate =
    readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.apiSessionSecret)
    ?? apiToken;
  const normalizedSessionSecret = sessionSecretCandidate.trim();
  return normalizedSessionSecret.length > 0
    ? normalizedSessionSecret
    : ServerRuntimeDefaultValues.apiSessionSigningSecret;
}

function resolveCodexExecutablePathFromEnvironment(env: NodeJS.ProcessEnv): string {
  const configuredPath = readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.codexCliPath);
  if (configuredPath) {
    return configuredPath;
  }

  const desktopPath = ServerRuntimeStaticConfiguration.codexDesktopExecutablePath;
  if (fs.existsSync(desktopPath)) {
    return desktopPath;
  }

  return ServerRuntimeStaticConfiguration.codexExecutablePath;
}

function resolveIpcSocketPathFromEnvironment(env: NodeJS.ProcessEnv): string {
  const configuredPath = readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.codexIpcSocketPath);
  if (configuredPath) {
    return configuredPath;
  }

  if (process.platform === "win32") {
    return ServerRuntimeStaticConfiguration.windowsCodexIpcSocketPath;
  }

  const userIdentifier = process.getuid?.() ?? 0;
  return path.join(
    os.tmpdir(),
    ServerRuntimeStaticConfiguration.codexIpcDirectoryName,
    `ipc-${String(userIdentifier)}.sock`
  );
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
  const configuredPath = readOptionalPathEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.pushLocalCaPath);
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
      readOptionalPathEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.appDataPath)
      ?? path.join(homeDirectory, "AppData", "Roaming");
    return path.join(appDataDirectory, "Caddy", "pki", "authorities", "local", "root.crt");
  }

  const xdgDataHome =
    readOptionalPathEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.xdgDataHome)
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
  const logLevel = LoggerLevelSchema.parse(
    (readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.logLevel) ?? ServerRuntimeDefaultValues.logLevel)
      .trim()
      .toLowerCase()
  );
  const host = readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.host) ?? ServerRuntimeDefaultValues.host;
  const port = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.port,
    ServerRuntimeDefaultValues.port
  );
  const historyLimit = ServerRuntimeDefaultValues.historyLimit;
  const historyPayloadSummaryMaximumBytes = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.historyPayloadSummaryMaximumBytes,
    ServerRuntimeDefaultValues.historyPayloadSummaryMaximumBytes
  );
  const userAgent = ServerRuntimeStaticConfiguration.userAgent;
  const runtimeStateSnapshotCacheTimeToLiveMs = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.runtimeStateSnapshotCacheTimeToLiveMilliseconds,
    ServerRuntimeDefaultValues.runtimeStateSnapshotCacheTimeToLiveMilliseconds
  );
  const ipcReconnectDelayMs = ServerRuntimeDefaultValues.ipcReconnectDelayMilliseconds;
  const ntfyCompletionDebounceMs = ServerRuntimeDefaultValues.notificationCompletionDebounceMilliseconds;
  const capabilityListTimeoutMs = ServerRuntimeDefaultValues.capabilityListTimeoutMilliseconds;
  const threadListAdapterTimeoutMs = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.threadListAdapterTimeoutMilliseconds,
    ServerRuntimeDefaultValues.threadListAdapterTimeoutMilliseconds
  );
  const pushTestSendTimeoutMs = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.pushTestSendTimeoutMilliseconds,
    ServerRuntimeDefaultValues.pushTestSendTimeoutMilliseconds
  );

  const traceDirectoryPath = path.resolve(defaultWorkspacePath, ServerRuntimeStaticConfiguration.traceDirectoryName);

  const apiTokenHeaderName = ServerRuntimeStaticConfiguration.apiTokenHeaderName;
  const apiTokenResponseHeader = ServerRuntimeStaticConfiguration.apiTokenResponseHeader;
  const apiSessionCookieName = ServerRuntimeStaticConfiguration.apiSessionCookieName;
  const apiSessionTimeToLiveMs = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.apiSessionTimeToLiveMilliseconds,
    ServerRuntimeDefaultValues.apiSessionTimeToLiveMilliseconds
  );
  const clientRequestIdHeaderName = ServerRuntimeStaticConfiguration.clientRequestIdentifierHeaderName;
  const clientRequestIdResponseHeader = ServerRuntimeStaticConfiguration.clientRequestIdentifierResponseHeader;
  const clientActionIdHeaderName = ServerRuntimeStaticConfiguration.clientActionIdentifierHeaderName;
  const clientActionIdResponseHeader = ServerRuntimeStaticConfiguration.clientActionIdentifierResponseHeader;
  const clientActionNameHeaderName = ServerRuntimeStaticConfiguration.clientActionNameHeaderName;
  const clientActionNameResponseHeader = ServerRuntimeStaticConfiguration.clientActionNameResponseHeader;
  const apiToken = resolveApiTokenFromEnvironment(env);
  const apiAuthRequired = apiToken.length > 0;
  const apiSessionSigningSecret = resolveApiSessionSigningSecret(env, apiToken);
  const apiSessionSecureCookie = readBooleanEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.apiSessionSecureCookie,
    ServerRuntimeDefaultValues.apiSessionSecureCookie
  );

  const pushEnabled = readBooleanEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.pushEnabled,
    ServerRuntimeDefaultValues.pushEnabled
  );
  const pushPrivateModeDefault = readBooleanEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.pushPrivateModeDefault,
    ServerRuntimeDefaultValues.pushPrivateModeDefault
  );
  const pushReceiptsMaxCount = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.pushReceiptsMaxCount,
    ServerRuntimeDefaultValues.pushReceiptsMaxCount
  );
  const pushReceiptsMaxAgeDays = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.pushReceiptsMaxAgeDays,
    ServerRuntimeDefaultValues.pushReceiptsMaxAgeDays
  );
  const threadListAggregationCacheTimeToLiveMs = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.threadListAggregationCacheTimeToLiveMilliseconds,
    ServerRuntimeDefaultValues.threadListAggregationCacheTimeToLiveMilliseconds
  );
  const threadListAggregationCacheMaximumEntries = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.threadListAggregationCacheMaximumEntries,
    ServerRuntimeDefaultValues.threadListAggregationCacheMaximumEntries
  );

  const webHealthBuildId = resolveWebHealthBuildIdentifierFromEnvironment(env);
  const webHealthServiceWorkerVersion =
    readTrimmedEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.webServiceWorkerVersion) || null;

  const codexExecutablePath = resolveCodexExecutablePathFromEnvironment(env);
  const ipcSocketPath = resolveIpcSocketPathFromEnvironment(env);
  const gitCommit = resolveGitCommitHash(defaultWorkspacePath);

  const pushStatePathResolution = resolvePushStatePath({
    envPath: readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.pushStatePath) ?? undefined,
    appDataPath: readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.appDataPath) ?? undefined,
    xdgStateHome: readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.xdgStateHome) ?? undefined,
    homeDirectory: os.homedir(),
    platform: process.platform
  });

  const pushReceiptsPath =
    readOptionalPathEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.pushReceiptsPath)
    ?? path.join(path.dirname(pushStatePathResolution.filePath), ServerRuntimeStaticConfiguration.pushReceiptsFileName);
  const pushSendsPath =
    readOptionalPathEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.pushSendsPath)
    ?? path.join(path.dirname(pushStatePathResolution.filePath), ServerRuntimeStaticConfiguration.pushSendsFileName);

  const pushLocalCaSourcePath = resolvePushLocalCaSourcePath(env);
  const pushVapidPublicKey = readTrimmedEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.pushVapidPublicKey);
  const pushVapidPrivateKey = readTrimmedEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.pushVapidPrivateKey
  );
  const pushVapidSubject = readTrimmedEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.pushVapidSubject);

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
  const clientErrorSessionId =
    `${ServerRuntimeStaticConfiguration.sessionIdentifierPrefix}${clientErrorSessionTimestamp}-${String(process.pid)}`;
  const clientErrorLogPath =
    readOptionalPathEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.debugClientErrorLogPath)
    ?? path.join(
      defaultWorkspacePath,
      ServerRuntimeStaticConfiguration.runtimeDirectoryName,
      ServerRuntimeStaticConfiguration.logsDirectoryName,
      ServerRuntimeStaticConfiguration.errorsLogDirectoryName,
      ServerRuntimeStaticConfiguration.clientErrorLogFileName
    );
  const clientErrorMaxEntries = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.debugClientErrorMaximumEntries,
    ServerRuntimeDefaultValues.clientErrorMaximumEntries
  );
  const invalidThreadStreamEventsLogPath =
    readOptionalPathEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.invalidThreadStreamEventsLogPath)
    ?? path.resolve(
      defaultWorkspacePath,
      ServerRuntimeStaticConfiguration.runtimeDirectoryName,
      ServerRuntimeStaticConfiguration.logsDirectoryName,
      ServerRuntimeStaticConfiguration.threadLogsDirectoryName,
      ServerRuntimeStaticConfiguration.invalidThreadStreamEventsLogFileName
    );
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
