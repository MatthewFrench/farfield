// Owner note: this module owns immutable runtime configuration contract constants,
// including environment keys, defaults, static metadata, and shared error text.
export const ServerRuntimeEnvironmentVariableNames = Object.freeze({
  appDataPath: "APPDATA",
  apiSessionSecret: "API_SESSION_SECRET",
  apiSessionSecureCookie: "API_SESSION_SECURE_COOKIE",
  apiSessionTimeToLiveMilliseconds: "API_SESSION_TIME_TO_LIVE_MS",
  apiToken: "API_TOKEN",
  codexCliPath: "CODEX_CLI_PATH",
  codexIpcSocketPath: "CODEX_IPC_SOCKET",
  debugClientErrorLogPath: "DEBUG_CLIENT_ERROR_LOG_PATH",
  debugClientErrorMaximumEntries: "DEBUG_CLIENT_ERROR_MAX_ENTRIES",
  historyDetailRetentionMaximumBytes: "HISTORY_DETAIL_RETENTION_MAX_BYTES",
  runtimeProfile: "FARFIELD_RUNTIME_PROFILE",
  historyPayloadSummaryMaximumBytes: "HISTORY_PAYLOAD_SUMMARY_MAXIMUM_BYTES",
  historyReplayRetentionMaximumBytes: "HISTORY_REPLAY_RETENTION_MAX_BYTES",
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
  xdgStateHome: "XDG_STATE_HOME",
});

export const ServerRuntimeDefaultValues = Object.freeze({
  apiSessionSecureCookie: false,
  apiSessionSigningSecret: "farfield_session_secret",
  apiSessionTimeToLiveMilliseconds: 28_800_000,
  capabilityListTimeoutMilliseconds: 8_000,
  clientErrorMaximumEntries: 2_000,
  historyLimit: 2_000,
  // Keep payload summaries bounded at 128 KiB to cap log/memory overhead in debug flows.
  historyPayloadSummaryMaximumBytes: 131_072,
  // Keep retained history-detail payload storage bounded independently from the visible entry count.
  historyDetailRetentionMaximumBytes: 4_194_304,
  // Replay payload retention is a separate, much smaller budget because only replayable entries need raw bodies.
  historyReplayRetentionMaximumBytes: 1_048_576,
  host: "127.0.0.1",
  ipcReconnectDelayMilliseconds: 1_000,
  logLevel: "info",
  // Debounce completion events to coalesce brief bursts into one push dispatch pass.
  notificationCompletionDebounceMilliseconds: 250,
  port: 4_311,
  pushEnabled: false,
  pushPrivateModeDefault: true,
  pushReceiptsMaxAgeDays: 7,
  pushReceiptsMaxCount: 100,
  pushTestSendTimeoutMilliseconds: 7_500,
  runtimeStateSnapshotCacheTimeToLiveMilliseconds: 250,
  threadListAdapterTimeoutMilliseconds: 7_500,
  // Bound thread-list aggregation cache cardinality to keep memory growth predictable.
  threadListAggregationCacheMaximumEntries: 48,
  // Thread-list mutations explicitly invalidate this cache, so a longer TTL primarily reduces
  // repeated merge/sort work during passive refresh cycles.
  threadListAggregationCacheTimeToLiveMilliseconds: 15_000,
  webHealthBuildId: "dev",
});

export const ServerRuntimeStaticConfiguration = Object.freeze({
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
  windowsCodexIpcSocketPath: "\\\\.\\pipe\\codex-ipc",
});

export const ServerRuntimeParsingConstants = Object.freeze({
  falseText: "false",
  falseNumeric: "0",
  minimumPositiveInteger: 1,
  trueText: "true",
  trueNumeric: "1",
});

export const ServerRuntimeGitCommandConfiguration = Object.freeze({
  command: "git",
  outputEncoding: "utf8",
  shortHeadArguments: Object.freeze(["rev-parse", "--short", "HEAD"]),
});

export const ServerRuntimeFormattingConstants = Object.freeze({
  clientErrorSessionTimestampUnsafeCharactersPattern: /[:.]/g,
  clientErrorSessionTimestampSeparator: "-",
});

export const MissingPushVapidConfigurationErrorMessage =
  `${ServerRuntimeEnvironmentVariableNames.pushEnabled}=true requires ` +
  `${ServerRuntimeEnvironmentVariableNames.pushVapidPublicKey}, ` +
  `${ServerRuntimeEnvironmentVariableNames.pushVapidPrivateKey}, and ` +
  ServerRuntimeEnvironmentVariableNames.pushVapidSubject;
