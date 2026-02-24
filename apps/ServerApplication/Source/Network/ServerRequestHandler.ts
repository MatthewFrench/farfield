import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { FarfieldPushTestBodySchema, type PushNotificationPayload } from "@farfield/protocol";
import { z } from "zod";
import { logger } from "../Shared/Logging/Logger.js";
import type { AgentRegistry } from "../Agents/Registry.js";
import type { ThreadAdapterResolver } from "../Agents/ThreadAdapterResolver.js";
import type { CodexAgentAdapter } from "../Agents/Adapters/CodexAgentAdapter.js";
import type { AgentAdapter, AgentDescriptor, AgentId } from "../Agents/Types.js";
import type { ActivityHistoryService } from "../Modules/Activity/ActivityHistoryService.js";
import type { ClientErrorStore } from "../Modules/Debugging/ClientErrorStore.js";
import type { PushReceiptStore } from "../Modules/PushNotifications/PushReceiptStore.js";
import type { PushSendStore } from "../Modules/PushNotifications/PushSendStore.js";
import type { PushService } from "../Modules/PushNotifications/PushService.js";
import type { PushStore } from "../Modules/PushNotifications/PushStore.js";
import type { RuntimeStateOwner } from "../Application/StateManagement/RuntimeStateOwner.js";
import type { ServerErrorEventRecordInput } from "./ServerErrorEventRecorder.js";
import type { ServerObservabilitySnapshot } from "./ServerObservabilitySnapshotOwner.js";
import {
  ServerRequestErrorResponder,
  type ServerRequestErrorContext
} from "./ServerRequestErrorResponder.js";
import type { BrowserSessionAuthOwner } from "./BrowserSessionAuthOwner.js";
import { handleAgentRoutes } from "./Routes/AgentRoutes.js";
import { handleCapabilityRoutes } from "./Routes/CapabilityRoutes.js";
import type { HistoryEntry } from "./Routes/DebugTypes.js";
import type { DebugRouteDependencies } from "./Routes/DebugRoutes.js";
import { handleDebugRoutes } from "./Routes/DebugRoutes.js";
import { handlePushRoutes } from "./Routes/PushRoutes.js";
import { handleRuntimeRoutes } from "./Routes/RuntimeRoutes.js";
import type { ThreadRouteDependencies } from "./Routes/ThreadRoutes.js";
import { handleThreadRoutes } from "./Routes/ThreadRoutes.js";
import type { EventStreamClientRegistry } from "./EventStreamClientRegistry.js";
import type { ThreadConcurrencyCoordinator } from "./ThreadConcurrencyCoordinator.js";
import type { ThreadListAggregationCache } from "./ThreadListAggregationCache.js";

export interface ServerRequestHandlerDependencies {
  host: string;
  port: number;
  apiToken: string;
  apiAuthRequired: boolean;
  apiTokenHeaderName: string;
  apiTokenResponseHeader: string;
  browserSessionAuthOwner: BrowserSessionAuthOwner;
  clientRequestIdHeaderName: string;
  clientRequestIdResponseHeader: string;
  clientActionIdHeaderName: string;
  clientActionIdResponseHeader: string;
  clientActionNameHeaderName: string;
  clientActionNameResponseHeader: string;
  webHealthBuildId: string;
  webHealthServiceWorkerVersion: string | null;
  gitCommit: string | null;
  defaultWorkspace: string;
  traceDirectoryPath: string;
  capabilityListTimeoutMs: number;
  pushPrivateModeDefault: boolean;
  pushLocalCaSourcePath: string;
  configuredAgentIds: AgentId[];
  registry: AgentRegistry;
  threadAdapterResolver: ThreadAdapterResolver;
  codexAdapter: CodexAgentAdapter | null;
  threadListAggregationCache: ThreadListAggregationCache;
  threadConcurrencyCoordinator: ThreadConcurrencyCoordinator;
  eventStreamClientRegistry: EventStreamClientRegistry;
  runtimeStateOwner: RuntimeStateOwner;
  activityHistoryService: ActivityHistoryService;
  clientErrorStore: ClientErrorStore;
  pushService: PushService;
  pushStore: PushStore;
  pushReceiptStore: PushReceiptStore;
  pushSendStore: PushSendStore;
  readObservabilitySnapshot: () => ServerObservabilitySnapshot;
  pushTestBodySchema: typeof FarfieldPushTestBodySchema;
  buildPushTestPayload: (
    input: z.infer<typeof FarfieldPushTestBodySchema>,
    privateMode: boolean
  ) => PushNotificationPayload;
  parseInteger: (value: string | null, defaultValue: number) => number;
  parseBoolean: (value: string | null, defaultValue: boolean) => boolean;
  parseAgentId: (value: string | null) => AgentId | null;
  normalizeOptionalString: (value: string | null) => string | null;
  withTimeout: <ValueType>(promise: Promise<ValueType>, timeoutMs: number, label: string) => Promise<ValueType>;
  readJsonBody: ThreadRouteDependencies["readJsonBody"];
  jsonResponse: ThreadRouteDependencies["jsonResponse"];
  toErrorMessage: DebugRouteDependencies["toErrorMessage"];
  ensureTraceDirectory: () => void;
  pushSystem: (message: string, details?: HistoryEntry["meta"]) => void;
  invalidateThreadListAggregationCache: (reason: string, details?: HistoryEntry["meta"]) => void;
  buildAgentDescriptor: (adapter: AgentAdapter, projectDirectories: string[]) => AgentDescriptor;
  setRuntimeLastError: (message: string) => void;
  broadcastRuntimeState: () => void;
  isShuttingDown: () => boolean;
  isExpectedShutdownTransportError: (error: Error) => boolean;
  recordServerErrorEvent: (input: ServerErrorEventRecordInput) => void;
}

export class ServerRequestHandler {
  private readonly deps: ServerRequestHandlerDependencies;
  private readonly requestErrorResponder: ServerRequestErrorResponder;

  public constructor(dependencies: ServerRequestHandlerDependencies) {
    this.deps = dependencies;
    this.requestErrorResponder = new ServerRequestErrorResponder({
      jsonResponse: this.deps.jsonResponse,
      toErrorMessage: this.deps.toErrorMessage,
      isExpectedShutdownTransportError: this.deps.isExpectedShutdownTransportError,
      recordServerErrorEvent: this.deps.recordServerErrorEvent,
      setRuntimeLastError: this.deps.setRuntimeLastError,
      pushSystem: this.deps.pushSystem,
      broadcastRuntimeState: this.deps.broadcastRuntimeState
    });
  }

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestId = this.deps.normalizeOptionalString(
      this.readHeader(req, this.deps.clientRequestIdHeaderName)
    ) ?? `request_${randomUUID()}`;
    const requestActionId = this.deps.normalizeOptionalString(
      this.readHeader(req, this.deps.clientActionIdHeaderName)
    );
    const requestActionName = this.deps.normalizeOptionalString(
      this.readHeader(req, this.deps.clientActionNameHeaderName)
    );

    res.setHeader(this.deps.clientRequestIdResponseHeader, requestId);
    if (requestActionId) {
      res.setHeader(this.deps.clientActionIdResponseHeader, requestActionId);
    }
    if (requestActionName) {
      res.setHeader(this.deps.clientActionNameResponseHeader, requestActionName);
    }

    const requestContext: ServerRequestErrorContext = {
      requestId,
      actionId: requestActionId,
      actionName: requestActionName
    };

    const requestContextDetails: HistoryEntry["meta"] = {
      requestId,
      ...(requestContext.actionId ? { actionId: requestContext.actionId } : {}),
      ...(requestContext.actionName ? { actionName: requestContext.actionName } : {})
    };

    const pushActionEventWithRequestContext: ThreadRouteDependencies["pushActionEventWithRequestContext"] = (
      action,
      stage,
      details
    ) => {
      this.deps.activityHistoryService.pushActionEvent(action, stage, {
        ...requestContextDetails,
        ...details
      });
    };

    const pushActionErrorWithRequestContext: ThreadRouteDependencies["pushActionErrorWithRequestContext"] = (
      action,
      error,
      details
    ) => {
      const errorMessage = this.deps.toErrorMessage(error);
      return this.deps.activityHistoryService.pushActionFailure(action, errorMessage, {
        ...requestContextDetails,
        ...details
      });
    };

    try {
      if (!req.url) {
        this.deps.jsonResponse(res, 400, { ok: false, error: "Missing request URL" });
        return;
      }

      if (req.method === "OPTIONS") {
        this.deps.jsonResponse(res, 204, {});
        return;
      }

      const url = new URL(req.url, `http://${this.deps.host}:${String(this.deps.port)}`);
      const pathname = url.pathname;
      const segments = pathname.split("/").filter(Boolean);

      if (this.deps.isShuttingDown() && pathname !== "/healthz") {
        this.deps.jsonResponse(res, 503, {
          ok: false,
          error: "Server is shutting down",
          requestId,
          actionId: requestActionId,
          actionName: requestActionName
        });
        return;
      }

      if (req.method === "GET" && pathname === "/healthz") {
        this.deps.jsonResponse(res, 200, {
          ok: true,
          service: "farfield-web-shell",
          buildId: this.deps.webHealthBuildId,
          gitCommit: this.deps.gitCommit,
          serviceWorkerVersion: this.deps.webHealthServiceWorkerVersion,
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (!this.requireApiAuth(req, res, pathname)) {
        return;
      }

      if (await handleRuntimeRoutes({
        req,
        res,
        pathname,
        apiAuthRequired: this.deps.apiAuthRequired,
        apiToken: this.deps.apiToken,
        apiTokenHeaderName: this.deps.apiTokenHeaderName,
        browserSessionAuthOwner: this.deps.browserSessionAuthOwner,
        eventStreamClientRegistry: this.deps.eventStreamClientRegistry,
        runtimeStateOwner: this.deps.runtimeStateOwner,
        readJsonBody: this.deps.readJsonBody,
        jsonResponse: this.deps.jsonResponse
      })) {
        return;
      }

      if (await handleAgentRoutes({
        req,
        res,
        pathname,
        registry: this.deps.registry,
        configuredAgentIds: this.deps.configuredAgentIds,
        buildAgentDescriptor: this.deps.buildAgentDescriptor,
        jsonResponse: this.deps.jsonResponse
      })) {
        return;
      }

      if (await handleThreadRoutes({
        req,
        res,
        pathname,
        segments,
        url,
        defaultWorkspace: this.deps.defaultWorkspace,
        codexAdapter: this.deps.codexAdapter,
        threadListAggregationCache: this.deps.threadListAggregationCache,
        threadConcurrencyCoordinator: this.deps.threadConcurrencyCoordinator,
        listEnabledAdapters: () => this.deps.registry.listEnabled(),
        registerThreadAdapterOwnership: (threadId, agentId) => {
          this.deps.threadAdapterResolver.registerThreadOwner(threadId, agentId);
        },
        parseInteger: this.deps.parseInteger,
        parseBoolean: this.deps.parseBoolean,
        normalizeOptionalString: this.deps.normalizeOptionalString,
        resolveCreateThreadAdapter: (requestedAgentId) => {
          return this.deps.threadAdapterResolver.resolveCreateThreadAdapter(requestedAgentId);
        },
        resolveAdapterForThread: (threadId) => {
          return this.deps.threadAdapterResolver.resolveAdapterForThread(threadId);
        },
        readJsonBody: this.deps.readJsonBody,
        jsonResponse: this.deps.jsonResponse,
        invalidateThreadListAggregationCache: this.deps.invalidateThreadListAggregationCache,
        pushActionEventWithRequestContext,
        pushActionErrorWithRequestContext
      })) {
        return;
      }

      if (await handleCapabilityRoutes({
        req,
        res,
        pathname,
        url,
        capabilityListTimeoutMs: this.deps.capabilityListTimeoutMs,
        registry: this.deps.registry,
        parseInteger: this.deps.parseInteger,
        parseAgentId: this.deps.parseAgentId,
        withTimeout: this.deps.withTimeout,
        jsonResponse: this.deps.jsonResponse
      })) {
        return;
      }

      if (await handlePushRoutes({
        req,
        res,
        pathname,
        segments,
        pushPrivateModeDefault: this.deps.pushPrivateModeDefault,
        pushLocalCaSourcePath: this.deps.pushLocalCaSourcePath,
        pushService: this.deps.pushService,
        pushStore: this.deps.pushStore,
        pushReceiptStore: this.deps.pushReceiptStore,
        pushSendStore: this.deps.pushSendStore,
        pushTestBodySchema: this.deps.pushTestBodySchema,
        readJsonBody: this.deps.readJsonBody,
        jsonResponse: this.deps.jsonResponse,
        buildPushTestPayload: this.deps.buildPushTestPayload
      })) {
        return;
      }

      if (await handleDebugRoutes({
        req,
        res,
        pathname,
        segments,
        url,
        traceDirectoryPath: this.deps.traceDirectoryPath,
        activityHistoryService: this.deps.activityHistoryService,
        codexAdapter: this.deps.codexAdapter,
        clientErrorStore: this.deps.clientErrorStore,
        readObservabilitySnapshot: this.deps.readObservabilitySnapshot,
        parseInteger: this.deps.parseInteger,
        toErrorMessage: this.deps.toErrorMessage,
        pushSystem: this.deps.pushSystem,
        ensureTraceDirectory: this.deps.ensureTraceDirectory,
        jsonResponse: this.deps.jsonResponse,
        readJsonBody: this.deps.readJsonBody,
        onClientErrorRecorded: (input) => {
          logger.error(input, "client-error-recorded");
        }
      })) {
        return;
      }

      this.deps.jsonResponse(res, 404, { ok: false, error: "Not found" });
    } catch (error) {
      this.requestErrorResponder.respond({
        req,
        res,
        error,
        context: requestContext
      });
    }
  }

  private readHeader(req: IncomingMessage, name: string): string | null {
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

  private isAuthenticatedRequest(req: IncomingMessage): boolean {
    if (!this.deps.apiAuthRequired) {
      return true;
    }
    const session = this.deps.browserSessionAuthOwner.readSession(this.readHeader(req, "cookie"));
    if (session.authenticated) {
      return true;
    }
    const providedToken = this.readHeader(req, this.deps.apiTokenHeaderName);
    if (!providedToken) {
      return false;
    }
    return providedToken === this.deps.apiToken;
  }

  private requireApiAuth(req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
    if (pathname === "/api/events/session") {
      return true;
    }
    if (!pathname.startsWith("/api/") && pathname !== "/events") {
      return true;
    }

    if (!this.isAuthenticatedRequest(req)) {
      this.deps.jsonResponse(res, 401, {
        ok: false,
        error: `Unauthorized: missing or invalid ${this.deps.apiTokenResponseHeader}`
      });
      return false;
    }

    return true;
  }
}
