import http from "node:http";
import {
  FarfieldPushTestBodySchema,
  JsonValueSchema,
  type JsonValue
} from "@farfield/protocol";
import { configureLogger, logger } from "../Shared/Logging/Logger.js";
import {
  parseServerCliOptions,
  formatServerHelpText
} from "../Agents/CliOptions.js";
import { AgentRuntimeOwner } from "../Agents/AgentRuntimeOwner.js";
import { ThreadAdapterResolver } from "../Agents/ThreadAdapterResolver.js";
import { ThreadIndex } from "../Agents/ThreadIndex.js";
import { ActivityHistoryService } from "../Modules/Activity/ActivityHistoryService.js";
import { ClientErrorStore } from "../Modules/Debugging/ClientErrorStore.js";
import { NtfyNotifier } from "../Modules/PushNotifications/NtfyNotifier.js";
import { PushReceiptStore } from "../Modules/PushNotifications/PushReceiptStore.js";
import { PushSendStore } from "../Modules/PushNotifications/PushSendStore.js";
import { PushService } from "../Modules/PushNotifications/PushService.js";
import { PushStore } from "../Modules/PushNotifications/PushStore.js";
import { ThreadCompletionNotificationService } from "../Modules/Threads/ThreadCompletionNotificationService.js";
import { readServerRuntimeConfiguration } from "./Configuration/ServerRuntimeConfiguration.js";
import { ServerLifecycleCoordinator } from "./Bootstrap/ServerLifecycleCoordinator.js";
import type { HistoryEntry } from "../Network/Routes/DebugTypes.js";
import { EventStreamClientRegistry } from "../Network/EventStreamClientRegistry.js";
import { PushDispatchConcurrencyCoordinator } from "../Network/PushDispatchConcurrencyCoordinator.js";
import { ServerErrorEventRecorder } from "../Network/ServerErrorEventRecorder.js";
import { ServerObservabilitySnapshotOwner } from "../Network/ServerObservabilitySnapshotOwner.js";
import { PushTestPayloadOwner } from "../Network/PushTestPayloadOwner.js";
import { ServerRequestUtilityOwner } from "../Network/ServerRequestUtilityOwner.js";
import { ServerRequestHandler } from "../Network/ServerRequestHandler.js";
import { BrowserSessionAuthOwner } from "../Network/BrowserSessionAuthOwner.js";
import { ThreadListAggregationCache } from "../Network/ThreadListAggregationCache.js";
import { ThreadConcurrencyCoordinator } from "../Network/ThreadConcurrencyCoordinator.js";
import { RuntimeStateOwner } from "./StateManagement/RuntimeStateOwner.js";
import { ServerBootstrapUtilityOwner } from "./Bootstrap/ServerBootstrapUtilityOwner.js";
import { PushMutationConcurrencyCoordinator } from "../Network/PushMutationConcurrencyCoordinator.js";
import { ThreadListCacheInvalidationOwner } from "./Bootstrap/ThreadListCacheInvalidationOwner.js";

const PushTestBodySchema = FarfieldPushTestBodySchema;
const runtimeConfiguration = readServerRuntimeConfiguration(process.env);
configureLogger(runtimeConfiguration.logLevel);
const serverBootstrapUtilityOwner = new ServerBootstrapUtilityOwner();

function ensureTraceDirectory(): void {
  serverBootstrapUtilityOwner.ensureDirectoryExists(runtimeConfiguration.traceDirectoryPath);
}

const parsedCli = (() => {
  try {
    return parseServerCliOptions(process.argv.slice(2));
  } catch (error) {
    const message = serverBootstrapUtilityOwner.toErrorMessage(error);
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
const serverRequestUtilityOwner = new ServerRequestUtilityOwner();
const pushTestPayloadOwner = new PushTestPayloadOwner();
const codexExecutable = runtimeConfiguration.codexExecutablePath;
const ipcSocketPath = runtimeConfiguration.ipcSocketPath;
const gitCommit = runtimeConfiguration.gitCommit;
const pushStatePathResolution = runtimeConfiguration.pushStatePathResolution;
const pushReceiptsPath = runtimeConfiguration.pushReceiptsPath;
const pushSendsPath = runtimeConfiguration.pushSendsPath;
const pushLocalCaSourcePath = runtimeConfiguration.pushLocalCaSourcePath;
const pushVapidPublicKey = runtimeConfiguration.pushVapidPublicKey;
const pushVapidPrivateKey = runtimeConfiguration.pushVapidPrivateKey;
const pushVapidSubject = runtimeConfiguration.pushVapidSubject;

const pushStore = new PushStore(pushStatePathResolution.filePath);
pushStore.load();
const pushReceiptStore = new PushReceiptStore(
  pushReceiptsPath,
  runtimeConfiguration.pushReceiptsMaxCount,
  runtimeConfiguration.pushReceiptsMaxAgeDays * 24 * 60 * 60 * 1000
);
pushReceiptStore.load();
const pushSendStore = new PushSendStore(pushSendsPath);
pushSendStore.load();
const pushService = new PushService({
  enabled: runtimeConfiguration.pushEnabled,
  vapidPublicKey: pushVapidPublicKey,
  vapidPrivateKey: pushVapidPrivateKey,
  vapidSubject: pushVapidSubject
});
const clientErrorSessionId = runtimeConfiguration.clientErrorSessionId;
const clientErrorLogPath = runtimeConfiguration.clientErrorLogPath;
const clientErrorMaxEntries = runtimeConfiguration.clientErrorMaxEntries;
const clientErrorStore = new ClientErrorStore(
  clientErrorLogPath,
  clientErrorSessionId,
  clientErrorMaxEntries
);
const serverErrorEventRecorder = new ServerErrorEventRecorder(clientErrorStore);
let agentRuntimeOwner: AgentRuntimeOwner | null = null;

const EVENT_STREAM_KEEPALIVE_INTERVAL_MS = 15_000;
const eventStreamClientRegistry = new EventStreamClientRegistry(
  EVENT_STREAM_KEEPALIVE_INTERVAL_MS
);
const activityHistoryService = new ActivityHistoryService(
  runtimeConfiguration.historyLimit,
  eventStreamClientRegistry
);
const threadIndex = new ThreadIndex();
const threadListAggregationCache = new ThreadListAggregationCache(
  runtimeConfiguration.threadListAggregationCacheTimeToLiveMs,
  runtimeConfiguration.threadListAggregationCacheMaximumEntries
);
const threadConcurrencyCoordinator = new ThreadConcurrencyCoordinator();
const browserSessionAuthOwner = new BrowserSessionAuthOwner({
  cookieName: runtimeConfiguration.apiSessionCookieName,
  sessionTimeToLiveMs: runtimeConfiguration.apiSessionTimeToLiveMs,
  signingSecret: runtimeConfiguration.apiSessionSigningSecret,
  secureCookie: runtimeConfiguration.apiSessionSecureCookie
});

const runtimeStateOwner = new RuntimeStateOwner({
  appExecutable: codexExecutable,
  socketPath: ipcSocketPath,
  workspaceDir: runtimeConfiguration.defaultWorkspacePath,
  gitCommit,
  readCodexRuntimeState: () => agentRuntimeOwner?.readCodexAdapter()?.getRuntimeState() ?? null,
  readHistoryCount: () => activityHistoryService.readHistoryCount(),
  readThreadOwnerCount: () => agentRuntimeOwner?.readCodexAdapter()?.getThreadOwnerCount() ?? 0,
  readPushEnabled: () => pushService.isEnabled(),
  readPushSubscriptionCount: () => pushStore.getSubscriptionCount(),
  readPushReceiptCount: () => pushReceiptStore.getCount(),
  readClientErrorCount: () => clientErrorStore.getCount(),
  readActiveTraceSummary: () => activityHistoryService.readActiveTraceSummary()
});
const ntfyNotifier = new NtfyNotifier(runtimeConfiguration.ntfyConfiguration);
const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();
const threadCompletionNotificationService = new ThreadCompletionNotificationService({
  readCodexAdapter: () => agentRuntimeOwner?.readCodexAdapter() ?? null,
  threadConcurrencyCoordinator,
  pushMutationConcurrencyCoordinator,
  ntfyNotifier,
  pushService,
  pushStore,
  pushSendStore,
  pushSystem: (message, details = {}) => {
    activityHistoryService.pushSystem(message, details);
  }
});
const pushDispatchConcurrencyCoordinator = new PushDispatchConcurrencyCoordinator(
  runtimeConfiguration.ntfyCompletionDebounceMs,
  () => {
    return threadCompletionNotificationService.shouldScheduleCompletionCheck();
  },
  async (threadId: string) => {
    await threadCompletionNotificationService.checkAndNotifyThreadCompletion(threadId);
  }
);
const serverObservabilitySnapshotOwner = new ServerObservabilitySnapshotOwner({
  threadListAggregationCache,
  threadConcurrencyCoordinator,
  pushDispatchConcurrencyCoordinator,
  pushMutationConcurrencyCoordinator,
  eventStreamClientRegistry
});

function pushSystem(message: string, details: HistoryEntry["meta"] = {}): void {
  activityHistoryService.pushSystem(message, details);
}

const threadListCacheInvalidationOwner = new ThreadListCacheInvalidationOwner(
  threadListAggregationCache
);

function invalidateThreadListAggregationCache(
  reason: string,
  details: Record<string, JsonValue> = {}
): void {
  threadListCacheInvalidationOwner.invalidate(reason, details);
}

agentRuntimeOwner = new AgentRuntimeOwner({
  configuredAgentIds,
  codexExecutablePath: codexExecutable,
  ipcSocketPath,
  invalidStreamEventsLogPath: runtimeConfiguration.invalidThreadStreamEventsLogPath,
  defaultWorkspacePath: runtimeConfiguration.defaultWorkspacePath,
  userAgent: runtimeConfiguration.userAgent,
  ipcReconnectDelayMs: runtimeConfiguration.ipcReconnectDelayMs,
  onCodexStateChange: () => {
    broadcastRuntimeState();
  },
  onCodexFrame: (event) => {
    activityHistoryService.pushHistory("ipc", event.direction, JsonValueSchema.parse(event.frame), {
      method: event.method,
      threadId: event.threadId
    });
  },
  onThreadStreamStateChanged: (threadId) => {
    invalidateThreadListAggregationCache("thread-stream-state-changed", {
      threadId
    });
    pushDispatchConcurrencyCoordinator.schedule(threadId);
  }
});
const registry = agentRuntimeOwner.readRegistry();
const threadAdapterResolver = new ThreadAdapterResolver(registry, threadIndex);

function broadcastRuntimeState(): void {
  eventStreamClientRegistry.broadcast({
    type: "state",
    state: runtimeStateOwner.readSnapshot()
  });
}

eventStreamClientRegistry.startKeepalive();
let serverLifecycleCoordinator: ServerLifecycleCoordinator | null = null;

const serverRequestHandler = new ServerRequestHandler({
  host: runtimeConfiguration.host,
  port: runtimeConfiguration.port,
  apiToken: runtimeConfiguration.apiToken,
  apiAuthRequired: runtimeConfiguration.apiAuthRequired,
  apiTokenHeaderName: runtimeConfiguration.apiTokenHeaderName,
  apiTokenResponseHeader: runtimeConfiguration.apiTokenResponseHeader,
  browserSessionAuthOwner,
  clientRequestIdHeaderName: runtimeConfiguration.clientRequestIdHeaderName,
  clientRequestIdResponseHeader: runtimeConfiguration.clientRequestIdResponseHeader,
  clientActionIdHeaderName: runtimeConfiguration.clientActionIdHeaderName,
  clientActionIdResponseHeader: runtimeConfiguration.clientActionIdResponseHeader,
  clientActionNameHeaderName: runtimeConfiguration.clientActionNameHeaderName,
  clientActionNameResponseHeader: runtimeConfiguration.clientActionNameResponseHeader,
  webHealthBuildId: runtimeConfiguration.webHealthBuildId,
  webHealthServiceWorkerVersion: runtimeConfiguration.webHealthServiceWorkerVersion,
  gitCommit,
  defaultWorkspace: runtimeConfiguration.defaultWorkspacePath,
  traceDirectoryPath: runtimeConfiguration.traceDirectoryPath,
  capabilityListTimeoutMs: runtimeConfiguration.capabilityListTimeoutMs,
  pushPrivateModeDefault: runtimeConfiguration.pushPrivateModeDefault,
  pushLocalCaSourcePath,
  configuredAgentIds,
  registry,
  threadAdapterResolver,
  codexAdapter: agentRuntimeOwner.readCodexAdapter(),
  threadListAggregationCache,
  threadConcurrencyCoordinator,
  eventStreamClientRegistry,
  runtimeStateOwner,
  activityHistoryService,
  clientErrorStore,
  pushService,
  pushStore,
  pushReceiptStore,
  pushSendStore,
  pushMutationConcurrencyCoordinator,
  readObservabilitySnapshot: () => {
    return serverObservabilitySnapshotOwner.readSnapshot();
  },
  pushTestBodySchema: PushTestBodySchema,
  buildPushTestPayload: (input, privateMode) => {
    return pushTestPayloadOwner.buildPayload(input, privateMode);
  },
  parseInteger: (value, defaultValue) => {
    return serverRequestUtilityOwner.parseInteger(value, defaultValue);
  },
  parseBoolean: (value, defaultValue) => {
    return serverRequestUtilityOwner.parseBoolean(value, defaultValue);
  },
  parseAgentId: (value) => {
    return serverRequestUtilityOwner.parseAgentId(value);
  },
  normalizeOptionalString: (value) => {
    return serverRequestUtilityOwner.normalizeOptionalString(value);
  },
  withTimeout: (promise, timeoutMs, label) => {
    return serverRequestUtilityOwner.withTimeout(promise, timeoutMs, label);
  },
  readJsonBody: async (request) => {
    return serverBootstrapUtilityOwner.readJsonBody(request);
  },
  jsonResponse: (response, statusCode, body) => {
    serverBootstrapUtilityOwner.jsonResponse(response, statusCode, body);
  },
  toErrorMessage: (error) => {
    return serverBootstrapUtilityOwner.toErrorMessage(error);
  },
  ensureTraceDirectory,
  pushSystem,
  invalidateThreadListAggregationCache,
  buildAgentDescriptor: (adapter, projectDirectories) => {
    return serverBootstrapUtilityOwner.buildAgentDescriptor(adapter, projectDirectories);
  },
  setRuntimeLastError: (message) => {
    runtimeStateOwner.setRuntimeLastError(message);
  },
  broadcastRuntimeState,
  isShuttingDown: () => serverLifecycleCoordinator?.isShuttingDown() ?? false,
  isExpectedShutdownTransportError: (error) => {
    if (!serverLifecycleCoordinator) {
      return false;
    }
    return serverLifecycleCoordinator.isExpectedShutdownTransportError(error);
  },
  recordServerErrorEvent: (input) => {
    serverErrorEventRecorder.record(input);
  }
});

const server = http.createServer((req, res) => {
  void serverRequestHandler.handle(req, res);
});

serverLifecycleCoordinator = new ServerLifecycleCoordinator({
  server,
  host: runtimeConfiguration.host,
  port: runtimeConfiguration.port,
  appExecutablePath: codexExecutable,
  socketPath: ipcSocketPath,
  configuredAgentIds,
  pushEnabledConfigured: runtimeConfiguration.pushEnabled,
  apiAuthRequired: runtimeConfiguration.apiAuthRequired,
  pushStatePath: pushStatePathResolution.filePath,
  pushStatePathSource: pushStatePathResolution.source,
  pushReceiptsPath,
  pushSendsPath,
  pushReceiptsMaxCount: runtimeConfiguration.pushReceiptsMaxCount,
  pushReceiptsMaxAgeDays: runtimeConfiguration.pushReceiptsMaxAgeDays,
  clientErrorMaxEntries,
  pushService,
  pushStore,
  pushReceiptStore,
  clientErrorStore,
  ntfyNotifier,
  registry,
  activityHistoryService,
  pushDispatchConcurrencyCoordinator,
  eventStreamClientRegistry,
  readOpenCodeAdapter: () => agentRuntimeOwner?.readOpenCodeAdapter() ?? null,
  ensureTraceDirectory,
  pushSystem: (message, details = {}) => {
    pushSystem(message, details);
  },
  broadcastRuntimeState
});

serverLifecycleCoordinator.installSignalHandlers();

void serverLifecycleCoordinator.start().catch((error) => {
  const runtimeErrorMessage = serverBootstrapUtilityOwner.toErrorMessage(error);
  runtimeStateOwner.setRuntimeLastError(runtimeErrorMessage);
  pushSystem("Monitor server failed to start", { error: runtimeErrorMessage });
  logger.fatal({ error: runtimeErrorMessage }, "monitor-server-failed-to-start");
  process.exit(1);
});
