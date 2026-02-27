import os from "node:os";
import path from "node:path";
import { parseNtfyConfigFromEnv } from "../../Modules/PushNotifications/NtfyNotifier.js";
import { resolvePushStatePath } from "../../Modules/PushNotifications/PushStatePath.js";
import { LoggerLevelSchema } from "../../Shared/Logging/Logger.js";
import {
  MissingPushVapidConfigurationErrorMessage,
  ServerRuntimeDefaultValues,
  ServerRuntimeEnvironmentVariableNames,
  ServerRuntimeStaticConfiguration,
} from "./ServerRuntimeConfigurationConstants.js";
import type { ServerRuntimeConfiguration } from "./ServerRuntimeConfigurationContracts.js";
import {
  resolveApiSessionSigningSecret,
  resolveApiTokenFromEnvironment,
  resolveClientErrorSessionMetadata,
  resolveCodexExecutablePathFromEnvironment,
  resolveGitCommitHash,
  resolveIpcSocketPathFromEnvironment,
  resolvePushLocalCaSourcePath,
  resolveWebHealthBuildIdentifierFromEnvironment,
} from "./ServerRuntimeDerivedValueResolvers.js";
import {
  readBooleanEnvironmentValue,
  readEnvironmentValue,
  readOptionalPathEnvironmentValue,
  readPositiveIntegerEnvironmentValue,
  readTrimmedEnvironmentValue,
} from "./ServerRuntimeEnvironmentValueReaders.js";

// Owner note: this module composes configuration owners to produce the single
// startup runtime configuration contract for the server process.
export type { ServerRuntimeConfiguration } from "./ServerRuntimeConfigurationContracts.js";

export function readServerRuntimeConfigurationFromCurrentProcessEnvironment(): ServerRuntimeConfiguration {
  return readServerRuntimeConfiguration(process.env);
}

export function readServerRuntimeConfiguration(env: NodeJS.ProcessEnv): ServerRuntimeConfiguration {
  const defaultWorkspacePath = path.resolve(process.cwd());
  const logLevel = LoggerLevelSchema.parse(
    (
      readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.logLevel) ??
      ServerRuntimeDefaultValues.logLevel
    )
      .trim()
      .toLowerCase(),
  );
  const host =
    readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.host) ??
    ServerRuntimeDefaultValues.host;
  const port = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.port,
    ServerRuntimeDefaultValues.port,
  );
  const historyLimit = ServerRuntimeDefaultValues.historyLimit;
  const historyPayloadSummaryMaximumBytes = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.historyPayloadSummaryMaximumBytes,
    ServerRuntimeDefaultValues.historyPayloadSummaryMaximumBytes,
  );
  const userAgent = ServerRuntimeStaticConfiguration.userAgent;
  const runtimeStateSnapshotCacheTimeToLiveMs = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.runtimeStateSnapshotCacheTimeToLiveMilliseconds,
    ServerRuntimeDefaultValues.runtimeStateSnapshotCacheTimeToLiveMilliseconds,
  );
  const ipcReconnectDelayMs = ServerRuntimeDefaultValues.ipcReconnectDelayMilliseconds;
  const ntfyCompletionDebounceMs =
    ServerRuntimeDefaultValues.notificationCompletionDebounceMilliseconds;
  const capabilityListTimeoutMs = ServerRuntimeDefaultValues.capabilityListTimeoutMilliseconds;
  const threadListAdapterTimeoutMs = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.threadListAdapterTimeoutMilliseconds,
    ServerRuntimeDefaultValues.threadListAdapterTimeoutMilliseconds,
  );
  const pushTestSendTimeoutMs = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.pushTestSendTimeoutMilliseconds,
    ServerRuntimeDefaultValues.pushTestSendTimeoutMilliseconds,
  );

  const traceDirectoryPath = path.resolve(
    defaultWorkspacePath,
    ServerRuntimeStaticConfiguration.traceDirectoryName,
  );

  const apiTokenHeaderName = ServerRuntimeStaticConfiguration.apiTokenHeaderName;
  const apiTokenResponseHeader = ServerRuntimeStaticConfiguration.apiTokenResponseHeader;
  const apiSessionCookieName = ServerRuntimeStaticConfiguration.apiSessionCookieName;
  const apiSessionTimeToLiveMs = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.apiSessionTimeToLiveMilliseconds,
    ServerRuntimeDefaultValues.apiSessionTimeToLiveMilliseconds,
  );
  const clientRequestIdHeaderName =
    ServerRuntimeStaticConfiguration.clientRequestIdentifierHeaderName;
  const clientRequestIdResponseHeader =
    ServerRuntimeStaticConfiguration.clientRequestIdentifierResponseHeader;
  const clientActionIdHeaderName =
    ServerRuntimeStaticConfiguration.clientActionIdentifierHeaderName;
  const clientActionIdResponseHeader =
    ServerRuntimeStaticConfiguration.clientActionIdentifierResponseHeader;
  const clientActionNameHeaderName = ServerRuntimeStaticConfiguration.clientActionNameHeaderName;
  const clientActionNameResponseHeader =
    ServerRuntimeStaticConfiguration.clientActionNameResponseHeader;
  const apiToken = resolveApiTokenFromEnvironment(env);
  const apiAuthRequired = apiToken.length > 0;
  const apiSessionSigningSecret = resolveApiSessionSigningSecret(env, apiToken);
  const apiSessionSecureCookie = readBooleanEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.apiSessionSecureCookie,
    ServerRuntimeDefaultValues.apiSessionSecureCookie,
  );

  const pushEnabled = readBooleanEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.pushEnabled,
    ServerRuntimeDefaultValues.pushEnabled,
  );
  const pushPrivateModeDefault = readBooleanEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.pushPrivateModeDefault,
    ServerRuntimeDefaultValues.pushPrivateModeDefault,
  );
  const pushReceiptsMaxCount = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.pushReceiptsMaxCount,
    ServerRuntimeDefaultValues.pushReceiptsMaxCount,
  );
  const pushReceiptsMaxAgeDays = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.pushReceiptsMaxAgeDays,
    ServerRuntimeDefaultValues.pushReceiptsMaxAgeDays,
  );
  const threadListAggregationCacheTimeToLiveMs = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.threadListAggregationCacheTimeToLiveMilliseconds,
    ServerRuntimeDefaultValues.threadListAggregationCacheTimeToLiveMilliseconds,
  );
  const threadListAggregationCacheMaximumEntries = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.threadListAggregationCacheMaximumEntries,
    ServerRuntimeDefaultValues.threadListAggregationCacheMaximumEntries,
  );

  const webHealthBuildId = resolveWebHealthBuildIdentifierFromEnvironment(env);
  const webHealthServiceWorkerVersionValue = readTrimmedEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.webServiceWorkerVersion,
  );
  const webHealthServiceWorkerVersion =
    webHealthServiceWorkerVersionValue.length > 0 ? webHealthServiceWorkerVersionValue : null;

  const codexExecutablePath = resolveCodexExecutablePathFromEnvironment(env);
  const ipcSocketPath = resolveIpcSocketPathFromEnvironment(env);
  const gitCommit = resolveGitCommitHash(defaultWorkspacePath);

  const pushStatePathResolution = resolvePushStatePath({
    envPath:
      readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.pushStatePath) ?? undefined,
    appDataPath:
      readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.appDataPath) ?? undefined,
    xdgStateHome:
      readEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.xdgStateHome) ?? undefined,
    homeDirectory: os.homedir(),
    platform: process.platform,
  });

  const pushReceiptsPath =
    readOptionalPathEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.pushReceiptsPath) ??
    path.join(
      path.dirname(pushStatePathResolution.filePath),
      ServerRuntimeStaticConfiguration.pushReceiptsFileName,
    );
  const pushSendsPath =
    readOptionalPathEnvironmentValue(env, ServerRuntimeEnvironmentVariableNames.pushSendsPath) ??
    path.join(
      path.dirname(pushStatePathResolution.filePath),
      ServerRuntimeStaticConfiguration.pushSendsFileName,
    );

  const pushLocalCaSourcePath = resolvePushLocalCaSourcePath(env);
  const pushVapidPublicKey = readTrimmedEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.pushVapidPublicKey,
  );
  const pushVapidPrivateKey = readTrimmedEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.pushVapidPrivateKey,
  );
  const pushVapidSubject = readTrimmedEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.pushVapidSubject,
  );

  if (
    pushEnabled &&
    (pushVapidPublicKey.length === 0 ||
      pushVapidPrivateKey.length === 0 ||
      pushVapidSubject.length === 0)
  ) {
    throw new Error(MissingPushVapidConfigurationErrorMessage);
  }

  const { clientErrorSessionId, clientErrorSessionStartedAt, clientErrorSessionTimestamp } =
    resolveClientErrorSessionMetadata();
  const clientErrorLogPath =
    readOptionalPathEnvironmentValue(
      env,
      ServerRuntimeEnvironmentVariableNames.debugClientErrorLogPath,
    ) ??
    path.join(
      defaultWorkspacePath,
      ServerRuntimeStaticConfiguration.runtimeDirectoryName,
      ServerRuntimeStaticConfiguration.logsDirectoryName,
      ServerRuntimeStaticConfiguration.errorsLogDirectoryName,
      ServerRuntimeStaticConfiguration.clientErrorLogFileName,
    );
  const clientErrorMaxEntries = readPositiveIntegerEnvironmentValue(
    env,
    ServerRuntimeEnvironmentVariableNames.debugClientErrorMaximumEntries,
    ServerRuntimeDefaultValues.clientErrorMaximumEntries,
  );
  const invalidThreadStreamEventsLogPath =
    readOptionalPathEnvironmentValue(
      env,
      ServerRuntimeEnvironmentVariableNames.invalidThreadStreamEventsLogPath,
    ) ??
    path.resolve(
      defaultWorkspacePath,
      ServerRuntimeStaticConfiguration.runtimeDirectoryName,
      ServerRuntimeStaticConfiguration.logsDirectoryName,
      ServerRuntimeStaticConfiguration.threadLogsDirectoryName,
      ServerRuntimeStaticConfiguration.invalidThreadStreamEventsLogFileName,
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
    ntfyConfiguration,
  };
}
