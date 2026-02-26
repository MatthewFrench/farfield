import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
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
import type { RequestObservabilityOwner } from "./RequestObservabilityOwner.js";
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
import type { PushMutationConcurrencyCoordinator } from "./PushMutationConcurrencyCoordinator.js";
import {
  normalizeRequestMethodForRequestMetrics,
  parseRequestUrlPathname,
  RequestMethodByName,
  RequestPathnameByName,
  RequestUrlPathnameParseStatusByName,
  readPathnameForRequestMetricsFromRequestUrl
} from "./RequestPathContracts.js";

const CLIENT_ERROR_RECORDED_LOG_EVENT = "client-error-recorded";
const COOKIE_HEADER_NAME = "cookie";
const REQUEST_IDENTIFIER_PREFIX = "request_";
const STATUS_CODE_BY_NAME = {
  successOk: 200,
  successNoContent: 204,
  clientErrorBadRequest: 400,
  clientErrorUnauthorized: 401,
  clientErrorNotFound: 404,
  serverErrorServiceUnavailable: 503
} as const;
const MISSING_REQUEST_URL_ERROR_MESSAGE = "Missing request URL";
const MALFORMED_REQUEST_URL_ERROR_MESSAGE = "Malformed request URL";
const SERVER_SHUTTING_DOWN_ERROR_MESSAGE = "Server is shutting down";
const NOT_FOUND_ERROR_MESSAGE = "Not found";

interface RequestLifecycleContext {
  requestStartedAtHighResolutionMilliseconds: number;
  requestStartedAt: string;
  requestQueueDelayMilliseconds: number;
  requestMethod: string;
  requestId: string;
  requestActionId: string | null;
  requestActionName: string | null;
}

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
  threadListAdapterTimeoutMs: number;
  pushTestSendTimeoutMs: number;
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
  pushMutationConcurrencyCoordinator: PushMutationConcurrencyCoordinator;
  requestObservabilityOwner: RequestObservabilityOwner;
  readCurrentEventLoopLagMs: () => number;
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
    const requestLifecycleContext = this.createRequestLifecycleContext(req);
    // Initialize from raw request URL so even missing/invalid URLs map to deterministic metrics routes.
    let pathnameForMetrics = readPathnameForRequestMetricsFromRequestUrl(req.url);
    this.writeRequestContextResponseHeaders(res, requestLifecycleContext);

    const requestContext = this.createRequestErrorContext(requestLifecycleContext);
    const requestContextDetails = this.createRequestContextDetails(requestLifecycleContext);
    // Record request start before any early-return path so lifecycle timelines stay balanced.
    this.recordRequestStartedForObservability(requestLifecycleContext, pathnameForMetrics);

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
        this.deps.jsonResponse(res, STATUS_CODE_BY_NAME.clientErrorBadRequest, {
          ok: false,
          error: MISSING_REQUEST_URL_ERROR_MESSAGE
        });
        return;
      }

      if (requestLifecycleContext.requestMethod === RequestMethodByName.options) {
        this.deps.jsonResponse(res, STATUS_CODE_BY_NAME.successNoContent, {});
        return;
      }

      const requestUrlPathnameParseResult = parseRequestUrlPathname({
        requestUrl: req.url,
        host: this.deps.host,
        port: this.deps.port
      });
      if (
        requestUrlPathnameParseResult.status
        === RequestUrlPathnameParseStatusByName.malformedRequestUrl
      ) {
        // Malformed URL observations must aggregate under one deterministic metrics pathname.
        pathnameForMetrics = RequestPathnameByName.malformedRequestUrl;
        this.deps.jsonResponse(res, STATUS_CODE_BY_NAME.clientErrorBadRequest, {
          ok: false,
          error: MALFORMED_REQUEST_URL_ERROR_MESSAGE
        });
        return;
      }

      const pathname = requestUrlPathnameParseResult.pathname;
      // Metrics and route dispatch intentionally share one normalized pathname contract.
      pathnameForMetrics = pathname;
      const segments = requestUrlPathnameParseResult.pathSegments;
      const url = requestUrlPathnameParseResult.url;

      if (this.deps.isShuttingDown() && pathname !== RequestPathnameByName.healthCheck) {
        this.deps.jsonResponse(res, STATUS_CODE_BY_NAME.serverErrorServiceUnavailable, {
          ok: false,
          error: SERVER_SHUTTING_DOWN_ERROR_MESSAGE,
          requestId: requestLifecycleContext.requestId,
          actionId: requestLifecycleContext.requestActionId,
          actionName: requestLifecycleContext.requestActionName
        });
        return;
      }

      if (
        requestLifecycleContext.requestMethod === RequestMethodByName.get
        && pathname === RequestPathnameByName.healthCheck
      ) {
        this.deps.jsonResponse(res, STATUS_CODE_BY_NAME.successOk, {
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
        listThreadsTimeoutMs: this.deps.threadListAdapterTimeoutMs,
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
        pushActionErrorWithRequestContext,
        withTimeout: this.deps.withTimeout
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
        pushMutationConcurrencyCoordinator: this.deps.pushMutationConcurrencyCoordinator,
        pushTestSendTimeoutMs: this.deps.pushTestSendTimeoutMs,
        pushTestBodySchema: this.deps.pushTestBodySchema,
        readJsonBody: this.deps.readJsonBody,
        jsonResponse: this.deps.jsonResponse,
        buildPushTestPayload: this.deps.buildPushTestPayload,
        withTimeout: this.deps.withTimeout
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
          if (input.severity === "warning") {
            logger.warn(input, CLIENT_ERROR_RECORDED_LOG_EVENT);
            return;
          }
          logger.error(input, CLIENT_ERROR_RECORDED_LOG_EVENT);
        }
      })) {
        return;
      }

      this.deps.jsonResponse(res, STATUS_CODE_BY_NAME.clientErrorNotFound, {
        ok: false,
        error: NOT_FOUND_ERROR_MESSAGE
      });
    } catch (error) {
      this.requestErrorResponder.respond({
        req,
        res,
        error,
        context: requestContext
      });
    } finally {
      this.recordRequestCompletedForObservability({
        requestLifecycleContext,
        pathnameForMetrics,
        statusCode: res.statusCode
      });
    }
  }

  private createRequestLifecycleContext(req: IncomingMessage): RequestLifecycleContext {
    const requestStartedAtHighResolutionMilliseconds = performance.now();
    const requestStartedAt = new Date().toISOString();
    // Record queue delay exactly once so started/completed telemetry stays directly comparable.
    const requestQueueDelayMilliseconds = this.deps.readCurrentEventLoopLagMs();
    const requestMethod = normalizeRequestMethodForRequestMetrics(req.method);
    const requestId = this.deps.normalizeOptionalString(
      this.readHeader(req, this.deps.clientRequestIdHeaderName)
    ) ?? `${REQUEST_IDENTIFIER_PREFIX}${randomUUID()}`;
    const requestActionId = this.deps.normalizeOptionalString(
      this.readHeader(req, this.deps.clientActionIdHeaderName)
    );
    const requestActionName = this.deps.normalizeOptionalString(
      this.readHeader(req, this.deps.clientActionNameHeaderName)
    );

    return {
      requestStartedAtHighResolutionMilliseconds,
      requestStartedAt,
      requestQueueDelayMilliseconds,
      requestMethod,
      requestId,
      requestActionId,
      requestActionName
    };
  }

  private writeRequestContextResponseHeaders(
    res: ServerResponse,
    requestLifecycleContext: RequestLifecycleContext
  ): void {
    res.setHeader(this.deps.clientRequestIdResponseHeader, requestLifecycleContext.requestId);
    if (requestLifecycleContext.requestActionId) {
      res.setHeader(
        this.deps.clientActionIdResponseHeader,
        requestLifecycleContext.requestActionId
      );
    }
    if (requestLifecycleContext.requestActionName) {
      res.setHeader(
        this.deps.clientActionNameResponseHeader,
        requestLifecycleContext.requestActionName
      );
    }
  }

  private createRequestErrorContext(
    requestLifecycleContext: RequestLifecycleContext
  ): ServerRequestErrorContext {
    return {
      requestId: requestLifecycleContext.requestId,
      actionId: requestLifecycleContext.requestActionId,
      actionName: requestLifecycleContext.requestActionName
    };
  }

  private createRequestContextDetails(
    requestLifecycleContext: RequestLifecycleContext
  ): HistoryEntry["meta"] {
    return {
      requestId: requestLifecycleContext.requestId,
      ...(requestLifecycleContext.requestActionId
        ? { actionId: requestLifecycleContext.requestActionId }
        : {}),
      ...(requestLifecycleContext.requestActionName
        ? { actionName: requestLifecycleContext.requestActionName }
        : {})
    };
  }

  private recordRequestStartedForObservability(
    requestLifecycleContext: RequestLifecycleContext,
    pathnameForMetrics: string
  ): void {
    this.deps.requestObservabilityOwner.recordRequestStarted({
      requestId: requestLifecycleContext.requestId,
      actionId: requestLifecycleContext.requestActionId,
      actionName: requestLifecycleContext.requestActionName,
      method: requestLifecycleContext.requestMethod,
      pathname: pathnameForMetrics,
      startedAt: requestLifecycleContext.requestStartedAt,
      queueDelayMs: requestLifecycleContext.requestQueueDelayMilliseconds
    });
  }

  private recordRequestCompletedForObservability(input: {
    requestLifecycleContext: RequestLifecycleContext;
    pathnameForMetrics: string;
    statusCode: number;
  }): void {
    const durationMilliseconds = Math.max(
      0,
      performance.now() - input.requestLifecycleContext.requestStartedAtHighResolutionMilliseconds
    );
    // Keep identity and timing fields aligned with `recordRequestStarted` for deterministic pairing.
    this.deps.requestObservabilityOwner.recordRequestCompleted({
      requestId: input.requestLifecycleContext.requestId,
      actionId: input.requestLifecycleContext.requestActionId,
      actionName: input.requestLifecycleContext.requestActionName,
      method: input.requestLifecycleContext.requestMethod,
      pathname: input.pathnameForMetrics,
      startedAt: input.requestLifecycleContext.requestStartedAt,
      statusCode: input.statusCode,
      durationMs: durationMilliseconds,
      queueDelayMs: input.requestLifecycleContext.requestQueueDelayMilliseconds,
      completedAt: new Date().toISOString()
    });
  }

  private readHeader(req: IncomingMessage, name: string): string | null {
    // Node request-header maps are normalized to lowercase keys at ingress.
    const normalizedHeaderName = name.toLowerCase();
    const raw = req.headers[normalizedHeaderName];
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
    const session = this.deps.browserSessionAuthOwner.readSession(
      this.readHeader(req, COOKIE_HEADER_NAME)
    );
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
    if (pathname === RequestPathnameByName.apiEventsSession) {
      return true;
    }
    if (!pathname.startsWith(RequestPathnameByName.apiPrefix) && pathname !== RequestPathnameByName.events) {
      return true;
    }

    if (!this.isAuthenticatedRequest(req)) {
      this.deps.jsonResponse(res, STATUS_CODE_BY_NAME.clientErrorUnauthorized, {
        ok: false,
        error: `Unauthorized: missing or invalid ${this.deps.apiTokenResponseHeader}`
      });
      return false;
    }

    return true;
  }
}
