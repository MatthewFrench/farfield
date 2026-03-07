import type { IncomingMessage, ServerResponse } from "node:http";
import { FarfieldPushTestBodySchema, type PushNotificationPayload } from "@farfield/protocol";
import { z } from "zod";
import type { AgentRegistry } from "../Agents/Registry.js";
import type { ThreadAdapterResolver } from "../Agents/ThreadAdapterResolver.js";
import type { AgentAdapter, AgentDescriptor, AgentId } from "../Agents/Types.js";
import type { ActivityHistoryService } from "../Modules/Activity/ActivityHistoryService.js";
import type { ClientErrorStore } from "../Modules/Debugging/ClientErrorStore.js";
import type { PushReceiptStore } from "../Modules/PushNotifications/PushReceiptStore.js";
import type { PushSendStore } from "../Modules/PushNotifications/PushSendStore.js";
import type { PushService } from "../Modules/PushNotifications/PushService.js";
import type { PushStore } from "../Modules/PushNotifications/PushStore.js";
import { logger } from "../Shared/Logging/Logger.js";
import type { BrowserSessionAuthOwner } from "./BrowserSessionAuthOwner.js";
import type { HistoryEntry } from "./DebugContracts.js";
import type { EventStreamClientRegistry } from "./EventStreamClientRegistry.js";
import type { PushMutationConcurrencyCoordinator } from "./PushMutationConcurrencyCoordinator.js";
import { handleAgentRoutes } from "./Routes/AgentRoutes.js";
import { handleCapabilityRoutes } from "./Routes/CapabilityRoutes.js";
import type { DebugRouteDependencies } from "./Routes/DebugRoutes.js";
import { handleDebugRoutes } from "./Routes/DebugRoutes.js";
import { handleLocalImageRoutes } from "./Routes/LocalImageRoutes.js";
import { handlePushRoutes } from "./Routes/PushRoutes.js";
import { handleRuntimeRoutes, type RuntimeStateSnapshotReader } from "./Routes/RuntimeRoutes.js";
import { handleSidebarThreadSyncRoutes } from "./Routes/SidebarThreadSyncRoutes.js";
import type { ThreadRouteDependencies } from "./Routes/ThreadRoutes.js";
import { handleThreadRoutes } from "./Routes/ThreadRoutes.js";
import type { ServerObservabilitySnapshot } from "./ServerObservabilitySnapshotOwner.js";
import type { SidebarThreadSyncSnapshotCache } from "./SidebarThreadSyncSnapshotCache.js";
import type { ThreadConcurrencyCoordinator } from "./ThreadConcurrencyCoordinator.js";
import type { ThreadListAggregationCache } from "./ThreadListAggregationCache.js";
import type { ThreadSendProgressObservabilityOwner } from "./ThreadSendProgressObservabilityOwner.js";
import type { ThreadStreamDeltaEventPublisher } from "./ThreadStreamDeltaEventPublisher.js";
import type { ThreadUnreadableStateOwner } from "./ThreadUnreadableStateOwner.js";

const CLIENT_ERROR_RECORDED_LOG_EVENT = "client-error-recorded";

export interface ServerRequestRouteDispatchOwnerDependencies {
  defaultWorkspace: string;
  traceDirectoryPath: string;
  capabilityListTimeoutMs: number;
  threadListAdapterTimeoutMs: number;
  pushTestSendTimeoutMs: number;
  pushPrivateModeDefault: boolean;
  pushLocalCaSourcePath: string;
  apiAuthRequired: boolean;
  apiToken: string;
  apiTokenHeaderName: string;
  browserSessionAuthOwner: BrowserSessionAuthOwner;
  configuredAgentIds: AgentId[];
  registry: AgentRegistry;
  threadAdapterResolver: ThreadAdapterResolver;
  replayAdapter: DebugRouteDependencies["replayAdapter"];
  threadListAggregationCache: ThreadListAggregationCache;
  sidebarThreadSyncSnapshotCache: SidebarThreadSyncSnapshotCache;
  threadUnreadableStateOwner: ThreadUnreadableStateOwner;
  threadConcurrencyCoordinator: ThreadConcurrencyCoordinator;
  threadSendProgressObservabilityOwner: ThreadSendProgressObservabilityOwner;
  threadStreamDeltaEventPublisher: ThreadStreamDeltaEventPublisher;
  eventStreamClientRegistry: EventStreamClientRegistry;
  runtimeStateOwner: RuntimeStateSnapshotReader;
  activityHistoryService: ActivityHistoryService;
  clientErrorStore: ClientErrorStore;
  pushService: PushService;
  pushStore: PushStore;
  pushReceiptStore: PushReceiptStore;
  pushSendStore: PushSendStore;
  pushMutationConcurrencyCoordinator: PushMutationConcurrencyCoordinator;
  readObservabilitySnapshot: () => ServerObservabilitySnapshot;
  pushTestBodySchema: typeof FarfieldPushTestBodySchema;
  buildPushTestPayload: (
    input: z.infer<typeof FarfieldPushTestBodySchema>,
    privateMode: boolean,
  ) => PushNotificationPayload;
  parseInteger: (value: string | null, defaultValue: number) => number;
  parseBoolean: (value: string | null, defaultValue: boolean) => boolean;
  parseAgentId: (value: string | null) => AgentId | null;
  normalizeOptionalString: (value: string | null) => string | null;
  withTimeout: <ValueType>(
    promise: Promise<ValueType>,
    timeoutMs: number,
    label: string,
  ) => Promise<ValueType>;
  readJsonBody: ThreadRouteDependencies["readJsonBody"];
  jsonResponse: ThreadRouteDependencies["jsonResponse"];
  toErrorMessage: DebugRouteDependencies["toErrorMessage"];
  ensureTraceDirectory: () => void;
  pushSystem: (message: string, details?: HistoryEntry["meta"]) => void;
  invalidateThreadListAggregationCache: (reason: string, details?: HistoryEntry["meta"]) => void;
  buildAgentDescriptor: (adapter: AgentAdapter, projectDirectories: string[]) => AgentDescriptor;
}

export interface ServerRequestRouteDispatchInput {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  segments: string[];
  url: URL;
  requestContextDetails: HistoryEntry["meta"];
}

/**
 * Owns route-dispatch ordering and dependency wiring for server request handling.
 * ServerRequestHandler delegates to this owner so route orchestration remains isolated and testable.
 */
export class ServerRequestRouteDispatchOwner {
  private readonly deps: ServerRequestRouteDispatchOwnerDependencies;

  public constructor(dependencies: ServerRequestRouteDispatchOwnerDependencies) {
    this.deps = dependencies;
  }

  public async dispatch(input: ServerRequestRouteDispatchInput): Promise<boolean> {
    const pushActionEventWithRequestContext: ThreadRouteDependencies["pushActionEventWithRequestContext"] =
      (action, stage, details) => {
        this.deps.activityHistoryService.pushActionEvent(action, stage, {
          ...input.requestContextDetails,
          ...details,
        });
      };

    const pushActionErrorWithRequestContext: ThreadRouteDependencies["pushActionErrorWithRequestContext"] =
      (action, error, details) => {
        const errorMessage = this.deps.toErrorMessage(error);
        return this.deps.activityHistoryService.pushActionFailure(action, errorMessage, {
          ...input.requestContextDetails,
          ...details,
        });
      };

    if (
      await handleRuntimeRoutes({
        req: input.req,
        res: input.res,
        pathname: input.pathname,
        apiAuthRequired: this.deps.apiAuthRequired,
        apiToken: this.deps.apiToken,
        apiTokenHeaderName: this.deps.apiTokenHeaderName,
        browserSessionAuthOwner: this.deps.browserSessionAuthOwner,
        eventStreamClientRegistry: this.deps.eventStreamClientRegistry,
        runtimeStateOwner: this.deps.runtimeStateOwner,
        readJsonBody: this.deps.readJsonBody,
        jsonResponse: this.deps.jsonResponse,
      })
    ) {
      return true;
    }

    if (
      await handleAgentRoutes({
        req: input.req,
        res: input.res,
        pathname: input.pathname,
        registry: this.deps.registry,
        configuredAgentIds: this.deps.configuredAgentIds,
        buildAgentDescriptor: this.deps.buildAgentDescriptor,
        jsonResponse: this.deps.jsonResponse,
      })
    ) {
      return true;
    }

    if (
      await handleLocalImageRoutes({
        req: input.req,
        res: input.res,
        pathname: input.pathname,
        url: input.url,
        jsonResponse: this.deps.jsonResponse,
      })
    ) {
      return true;
    }

    if (
      await handleSidebarThreadSyncRoutes({
        req: input.req,
        res: input.res,
        pathname: input.pathname,
        url: input.url,
        threadListAggregationCache: this.deps.threadListAggregationCache,
        sidebarThreadSyncSnapshotCache: this.deps.sidebarThreadSyncSnapshotCache,
        listEnabledAdapters: () => this.deps.registry.listEnabled(),
        registerThreadAdapterOwnership: (threadId, agentId) => {
          this.deps.threadAdapterResolver.registerThreadOwner(threadId, agentId);
        },
        shouldIncludeThreadInList: (threadId) =>
          this.deps.threadUnreadableStateOwner.shouldIncludeThread(threadId),
        listThreadsTimeoutMs: this.deps.threadListAdapterTimeoutMs,
        normalizeOptionalString: this.deps.normalizeOptionalString,
        readJsonBody: this.deps.readJsonBody,
        jsonResponse: this.deps.jsonResponse,
        withTimeout: this.deps.withTimeout,
      })
    ) {
      return true;
    }

    if (
      await handleThreadRoutes({
        req: input.req,
        res: input.res,
        pathname: input.pathname,
        segments: input.segments,
        url: input.url,
        defaultWorkspace: this.deps.defaultWorkspace,
        threadListAggregationCache: this.deps.threadListAggregationCache,
        threadConcurrencyCoordinator: this.deps.threadConcurrencyCoordinator,
        listEnabledAdapters: () => this.deps.registry.listEnabled(),
        registerThreadAdapterOwnership: (threadId, agentId) => {
          this.deps.threadAdapterResolver.registerThreadOwner(threadId, agentId);
        },
        shouldIncludeThreadInList: (threadId) =>
          this.deps.threadUnreadableStateOwner.shouldIncludeThread(threadId),
        parseInteger: this.deps.parseInteger,
        parseBoolean: this.deps.parseBoolean,
        normalizeOptionalString: this.deps.normalizeOptionalString,
        listThreadsTimeoutMs: this.deps.threadListAdapterTimeoutMs,
        resolveCreateThreadAdapter: (requestedAgentId) => {
          return this.deps.threadAdapterResolver.resolveCreateThreadAdapter(requestedAgentId);
        },
        resolveAdapterForThread: (threadId) => {
          return this.deps.threadAdapterResolver.resolveAdapterForThread(threadId);
        },
        readJsonBody: this.deps.readJsonBody,
        jsonResponse: this.deps.jsonResponse,
        markThreadUnreadableForListFiltering: (threadId) => {
          this.deps.threadUnreadableStateOwner.markThreadUnreadable(threadId);
        },
        clearThreadUnreadableForListFiltering: (threadId) => {
          this.deps.threadUnreadableStateOwner.clearThreadUnreadable(threadId);
        },
        invalidateThreadListAggregationCache: this.deps.invalidateThreadListAggregationCache,
        recordThreadSendAccepted: (threadId) => {
          this.deps.threadSendProgressObservabilityOwner.recordSendAccepted(threadId, Date.now());
        },
        scheduleThreadStreamDeltaPublish: (threadId) => {
          this.deps.threadStreamDeltaEventPublisher.schedulePublish(threadId);
        },
        pushActionEventWithRequestContext,
        pushActionErrorWithRequestContext,
        withTimeout: this.deps.withTimeout,
      })
    ) {
      return true;
    }

    if (
      await handleCapabilityRoutes({
        req: input.req,
        res: input.res,
        pathname: input.pathname,
        url: input.url,
        capabilityListTimeoutMs: this.deps.capabilityListTimeoutMs,
        registry: this.deps.registry,
        parseInteger: this.deps.parseInteger,
        parseAgentId: this.deps.parseAgentId,
        withTimeout: this.deps.withTimeout,
        jsonResponse: this.deps.jsonResponse,
      })
    ) {
      return true;
    }

    if (
      await handlePushRoutes({
        req: input.req,
        res: input.res,
        pathname: input.pathname,
        segments: input.segments,
        pushPrivateModeDefault: this.deps.pushPrivateModeDefault,
        pushLocalCaSourcePath: this.deps.pushLocalCaSourcePath,
        pushService: this.deps.pushService,
        pushStore: this.deps.pushStore,
        pushReceiptStore: this.deps.pushReceiptStore,
        pushSendStore: this.deps.pushSendStore,
        pushMutationConcurrencyCoordinator: this.deps.pushMutationConcurrencyCoordinator,
        pushTestSendTimeoutMs: this.deps.pushTestSendTimeoutMs,
        pushTestBodySchema: this.deps.pushTestBodySchema,
        readJsonBody: this.deps.readJsonBody,
        jsonResponse: this.deps.jsonResponse,
        buildPushTestPayload: this.deps.buildPushTestPayload,
        withTimeout: this.deps.withTimeout,
      })
    ) {
      return true;
    }

    if (
      await handleDebugRoutes({
        req: input.req,
        res: input.res,
        pathname: input.pathname,
        segments: input.segments,
        url: input.url,
        traceDirectoryPath: this.deps.traceDirectoryPath,
        activityHistoryService: this.deps.activityHistoryService,
        replayAdapter: this.deps.replayAdapter,
        clientErrorStore: this.deps.clientErrorStore,
        readObservabilitySnapshot: this.deps.readObservabilitySnapshot,
        parseInteger: this.deps.parseInteger,
        toErrorMessage: this.deps.toErrorMessage,
        pushSystem: this.deps.pushSystem,
        ensureTraceDirectory: this.deps.ensureTraceDirectory,
        jsonResponse: this.deps.jsonResponse,
        readJsonBody: this.deps.readJsonBody,
        onClientErrorRecorded: (clientErrorRecordInput) => {
          if (clientErrorRecordInput.severity === "warning") {
            logger.warn(clientErrorRecordInput, CLIENT_ERROR_RECORDED_LOG_EVENT);
            return;
          }
          logger.error(clientErrorRecordInput, CLIENT_ERROR_RECORDED_LOG_EVENT);
        },
      })
    ) {
      return true;
    }

    return false;
  }
}
