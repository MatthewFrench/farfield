import http from "node:http";
import {
  FarfieldHealthStateSchema,
  FarfieldPushTestBodySchema,
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
import { readServerRuntimeConfigurationFromCurrentProcessEnvironment } from "./Configuration/ServerRuntimeConfiguration.js";
import { ServerLifecycleCoordinator } from "./Bootstrap/ServerLifecycleCoordinator.js";
import type { HistoryEntry } from "../Network/Routes/DebugTypes.js";
import { EventStreamClientRegistry } from "../Network/EventStreamClientRegistry.js";
import { EventLoopLagObservabilityOwner } from "../Network/EventLoopLagObservabilityOwner.js";
import { PushDispatchConcurrencyCoordinator } from "../Network/PushDispatchConcurrencyCoordinator.js";
import { RequestObservabilityOwner } from "../Network/RequestObservabilityOwner.js";
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
import { ThreadStreamDeltaEventPublisher } from "../Network/ThreadStreamDeltaEventPublisher.js";
import {
  THREAD_STREAM_STATE_CHANGED_BATCH_EVENT_TYPE,
  THREAD_STREAM_STATE_CHANGED_METHOD,
  type ThreadStreamStateChangedBatchSummary,
  ThreadStreamStateChangedHistoryBatchOwner
} from "./ThreadStreamStateChangedHistoryBatchOwner.js";

const PushTestBodySchema = FarfieldPushTestBodySchema;
const runtimeConfiguration = readServerRuntimeConfigurationFromCurrentProcessEnvironment();
configureLogger(runtimeConfiguration.logLevel);
const serverBootstrapUtilityOwner = new ServerBootstrapUtilityOwner();
const BootstrapCliMessages = Object.freeze({
  invalidArgumentsGuidance: "Run with --help to see valid arguments."
});
const BootstrapDurationMilliseconds = Object.freeze({
  day: 24 * 60 * 60 * 1000,
  // Keepalive cadence balances prompt stale-connection detection with low idle network overhead.
  eventStreamKeepaliveInterval: 15_000,
  // Summarize bursty stream-state events once per second to preserve readable activity history.
  threadStreamHistorySummaryFlushInterval: 1_000
});
const BootstrapHistoryEventContract = Object.freeze({
  runtimeStateChangedType: "runtime-state-changed",
  ipcTransport: "ipc",
  ipcInboundDirection: "in"
});
const BootstrapLifecycleMessages = Object.freeze({
  monitorServerFailedToStart: "Monitor server failed to start"
});

function ensureTraceDirectory(): void {
  serverBootstrapUtilityOwner.ensureDirectoryExists(runtimeConfiguration.traceDirectoryPath);
}

// Parse CLI options before creating stateful owners so help/error exits stay side-effect free.
const parsedCli = (() => {
  try {
    return parseServerCliOptions(process.argv.slice(2));
  } catch (error) {
    const message = serverBootstrapUtilityOwner.toErrorMessage(error);
    process.stderr.write(`${message}\n`);
    process.stderr.write(`${BootstrapCliMessages.invalidArgumentsGuidance}\n`);
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
  runtimeConfiguration.pushReceiptsMaxAgeDays * BootstrapDurationMilliseconds.day
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
function readCodexAdapter() {
  return agentRuntimeOwner?.readCodexAdapter() ?? null;
}

const eventStreamClientRegistry = new EventStreamClientRegistry(
  BootstrapDurationMilliseconds.eventStreamKeepaliveInterval
);
const eventLoopLagObservabilityOwner = new EventLoopLagObservabilityOwner();
eventLoopLagObservabilityOwner.start();
process.on("exit", () => {
  eventLoopLagObservabilityOwner.stop();
});
const requestObservabilityOwner = new RequestObservabilityOwner();
const activityHistoryService = new ActivityHistoryService(
  runtimeConfiguration.historyLimit,
  eventStreamClientRegistry,
  runtimeConfiguration.historyPayloadSummaryMaximumBytes
);

function emitThreadStreamStateChangedHistorySummary(
  summary: ThreadStreamStateChangedBatchSummary
): void {
  activityHistoryService.pushHistory(
    BootstrapHistoryEventContract.ipcTransport,
    BootstrapHistoryEventContract.ipcInboundDirection,
    {
      type: THREAD_STREAM_STATE_CHANGED_BATCH_EVENT_TYPE,
      count: summary.count,
      spanMs: summary.spanMs,
      latestThreadId: summary.latestThreadId
    },
    {
      method: THREAD_STREAM_STATE_CHANGED_METHOD,
      threadId: summary.latestThreadId,
      summarized: true,
      count: summary.count,
      spanMs: summary.spanMs
    }
  );
}

const threadStreamStateChangedHistoryBatchOwner = new ThreadStreamStateChangedHistoryBatchOwner({
  flushIntervalMs: BootstrapDurationMilliseconds.threadStreamHistorySummaryFlushInterval,
  emitSummary: emitThreadStreamStateChangedHistorySummary
});
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
  readCodexRuntimeState: () => readCodexAdapter()?.getRuntimeState() ?? null,
  readHistoryCount: () => activityHistoryService.readHistoryCount(),
  readThreadOwnerCount: () => readCodexAdapter()?.getThreadOwnerCount() ?? 0,
  readPushEnabled: () => pushService.isEnabled(),
  readPushSubscriptionCount: () => pushStore.getSubscriptionCount(),
  readPushReceiptCount: () => pushReceiptStore.getCount(),
  readClientErrorCount: () => clientErrorStore.getCount(),
  readActiveTraceSummary: () => activityHistoryService.readActiveTraceSummary()
}, runtimeConfiguration.runtimeStateSnapshotCacheTimeToLiveMs);
const ntfyNotifier = new NtfyNotifier(runtimeConfiguration.ntfyConfiguration);
const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();
const threadCompletionNotificationService = new ThreadCompletionNotificationService({
  readCodexAdapter,
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
const threadStreamDeltaEventPublisher = new ThreadStreamDeltaEventPublisher({
  eventStreamClientRegistry,
  readThreadLiveState: async (threadId) => {
    const codexAdapter = readCodexAdapter();
    if (!codexAdapter) {
      return {
        ownerClientId: null,
        conversationState: null,
        liveStateError: null
      };
    }
    return codexAdapter.readLiveState(threadId);
  },
  readThreadStreamEvents: async (threadId, sinceSequence, limit) => {
    const codexAdapter = readCodexAdapter();
    if (!codexAdapter) {
      return {
        ownerClientId: null,
        events: [],
        nextSequence: 0,
        firstAvailableSequence: 0,
        resetRequired: false
      };
    }
    return codexAdapter.readStreamEvents(threadId, {
      limit,
      sinceSequence
    });
  }
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

// Runtime owner must exist before request/lifecycle owners capture adapter readers.
agentRuntimeOwner = new AgentRuntimeOwner({
  configuredAgentIds,
  codexExecutablePath: codexExecutable,
  appServerBaseEnvironment: runtimeConfiguration.appServerBaseEnvironment,
  ipcSocketPath,
  invalidStreamEventsLogPath: runtimeConfiguration.invalidThreadStreamEventsLogPath,
  defaultWorkspacePath: runtimeConfiguration.defaultWorkspacePath,
  userAgent: runtimeConfiguration.userAgent,
  ipcReconnectDelayMs: runtimeConfiguration.ipcReconnectDelayMs,
  onCodexStateChange: () => {
    broadcastRuntimeState();
  },
  onCodexFrame: (event) => {
    const nowMs = Date.now();
    if (threadStreamStateChangedHistoryBatchOwner.handleFrame(event, nowMs)) {
      return;
    }

    // Emit any buffered stream-change summary before this raw frame so history ordering stays stable.
    threadStreamStateChangedHistoryBatchOwner.flushBufferedSummary(nowMs);
    activityHistoryService.pushHistory(
      BootstrapHistoryEventContract.ipcTransport,
      event.direction,
      event.frame as JsonValue,
      {
        method: event.method,
        threadId: event.threadId
      }
    );
  },
  onThreadStreamStateChanged: (threadId) => {
    invalidateThreadListAggregationCache(THREAD_STREAM_STATE_CHANGED_METHOD, {
      threadId
    });
    pushDispatchConcurrencyCoordinator.schedule(threadId);
    threadStreamDeltaEventPublisher.schedulePublish(threadId);
  }
});
const registry = agentRuntimeOwner.readRegistry();
const threadAdapterResolver = new ThreadAdapterResolver(registry, threadIndex);
const serverObservabilitySnapshotOwner = new ServerObservabilitySnapshotOwner({
  threadListAggregationCache,
  threadConcurrencyCoordinator,
  pushDispatchConcurrencyCoordinator,
  pushMutationConcurrencyCoordinator,
  eventStreamClientRegistry,
  threadAdapterResolver,
  requestObservabilityOwner,
  eventLoopLagObservabilityOwner
});

function broadcastRuntimeState(): void {
  const runtimeStateSnapshot = FarfieldHealthStateSchema.parse(runtimeStateOwner.readSnapshot());
  eventStreamClientRegistry.broadcast({
    type: BootstrapHistoryEventContract.runtimeStateChangedType,
    state: runtimeStateSnapshot
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
  threadListAdapterTimeoutMs: runtimeConfiguration.threadListAdapterTimeoutMs,
  pushTestSendTimeoutMs: runtimeConfiguration.pushTestSendTimeoutMs,
  pushPrivateModeDefault: runtimeConfiguration.pushPrivateModeDefault,
  pushLocalCaSourcePath,
  configuredAgentIds,
  registry,
  threadAdapterResolver,
  codexAdapter: readCodexAdapter(),
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
  requestObservabilityOwner,
  readCurrentEventLoopLagMs: () => eventLoopLagObservabilityOwner.readCurrentLagMs(),
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
  pushSystem(BootstrapLifecycleMessages.monitorServerFailedToStart, { error: runtimeErrorMessage });
  logger.fatal({ error: runtimeErrorMessage }, "monitor-server-failed-to-start");
  process.exit(1);
});
