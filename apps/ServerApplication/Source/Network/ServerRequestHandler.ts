import type { IncomingMessage, ServerResponse } from "node:http";
import { FarfieldPushTestBodySchema, type PushNotificationPayload } from "@farfield/protocol";
import { z } from "zod";
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
import type { ServerErrorEventRecordInput } from "./ServerErrorEventRecorder.js";
import type { ServerObservabilitySnapshot } from "./ServerObservabilitySnapshotOwner.js";
import type { HistoryEntry } from "./DebugContracts.js";
import {
  ServerRequestErrorResponder,
  type ServerRequestErrorContext
} from "./ServerRequestErrorResponder.js";
import type { BrowserSessionAuthOwner } from "./BrowserSessionAuthOwner.js";
import type { RequestObservabilityOwner } from "./RequestObservabilityOwner.js";
import type { DebugRouteDependencies } from "./Routes/DebugRoutes.js";
import {
  type RuntimeStateSnapshotReader
} from "./Routes/RuntimeRoutes.js";
import type { ThreadRouteDependencies } from "./Routes/ThreadRoutes.js";
import type { EventStreamClientRegistry } from "./EventStreamClientRegistry.js";
import type { ThreadConcurrencyCoordinator } from "./ThreadConcurrencyCoordinator.js";
import type { ThreadListAggregationCache } from "./ThreadListAggregationCache.js";
import type { PushMutationConcurrencyCoordinator } from "./PushMutationConcurrencyCoordinator.js";
import {
  parseRequestUrlPathname,
  RequestMethodByName,
  RequestPathnameByName,
  RequestUrlPathnameParseStatusByName,
  readPathnameForRequestMetricsFromRequestUrl
} from "./RequestPathContracts.js";
import {
  ServerRequestLifecycleOwner
} from "./ServerRequestLifecycleOwner.js";
import { ServerRequestAuthenticationOwner } from "./ServerRequestAuthenticationOwner.js";
import { ServerRequestRouteDispatchOwner } from "./ServerRequestRouteDispatchOwner.js";

const STATUS_CODE_BY_NAME = {
  successOk: 200,
  successNoContent: 204,
  clientErrorBadRequest: 400,
  clientErrorNotFound: 404,
  serverErrorServiceUnavailable: 503
} as const;
const MISSING_REQUEST_URL_ERROR_MESSAGE = "Missing request URL";
const MALFORMED_REQUEST_URL_ERROR_MESSAGE = "Malformed request URL";
const SERVER_SHUTTING_DOWN_ERROR_MESSAGE = "Server is shutting down";
const NOT_FOUND_ERROR_MESSAGE = "Not found";

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
  runtimeStateOwner: RuntimeStateSnapshotReader;
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

/**
 * Composition owner for HTTP request handling.
 * Lifecycle, authentication, and route dispatch are delegated to explicit network owner modules.
 */
export class ServerRequestHandler {
  private readonly deps: ServerRequestHandlerDependencies;
  private readonly requestErrorResponder: ServerRequestErrorResponder;
  private readonly requestLifecycleOwner: ServerRequestLifecycleOwner;
  private readonly requestAuthenticationOwner: ServerRequestAuthenticationOwner;
  private readonly requestRouteDispatchOwner: ServerRequestRouteDispatchOwner;

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
    this.requestLifecycleOwner = new ServerRequestLifecycleOwner({
      clientRequestIdHeaderName: this.deps.clientRequestIdHeaderName,
      clientRequestIdResponseHeader: this.deps.clientRequestIdResponseHeader,
      clientActionIdHeaderName: this.deps.clientActionIdHeaderName,
      clientActionIdResponseHeader: this.deps.clientActionIdResponseHeader,
      clientActionNameHeaderName: this.deps.clientActionNameHeaderName,
      clientActionNameResponseHeader: this.deps.clientActionNameResponseHeader,
      normalizeOptionalString: this.deps.normalizeOptionalString,
      requestObservabilityOwner: this.deps.requestObservabilityOwner,
      readCurrentEventLoopLagMs: this.deps.readCurrentEventLoopLagMs
    });
    this.requestAuthenticationOwner = new ServerRequestAuthenticationOwner({
      apiAuthRequired: this.deps.apiAuthRequired,
      apiToken: this.deps.apiToken,
      apiTokenHeaderName: this.deps.apiTokenHeaderName,
      apiTokenResponseHeader: this.deps.apiTokenResponseHeader,
      browserSessionAuthOwner: this.deps.browserSessionAuthOwner,
      jsonResponse: this.deps.jsonResponse,
      readHeader: (req, name) => this.requestLifecycleOwner.readHeader(req, name)
    });
    this.requestRouteDispatchOwner = new ServerRequestRouteDispatchOwner({
      defaultWorkspace: this.deps.defaultWorkspace,
      traceDirectoryPath: this.deps.traceDirectoryPath,
      capabilityListTimeoutMs: this.deps.capabilityListTimeoutMs,
      threadListAdapterTimeoutMs: this.deps.threadListAdapterTimeoutMs,
      pushTestSendTimeoutMs: this.deps.pushTestSendTimeoutMs,
      pushPrivateModeDefault: this.deps.pushPrivateModeDefault,
      pushLocalCaSourcePath: this.deps.pushLocalCaSourcePath,
      apiAuthRequired: this.deps.apiAuthRequired,
      apiToken: this.deps.apiToken,
      apiTokenHeaderName: this.deps.apiTokenHeaderName,
      browserSessionAuthOwner: this.deps.browserSessionAuthOwner,
      configuredAgentIds: this.deps.configuredAgentIds,
      registry: this.deps.registry,
      threadAdapterResolver: this.deps.threadAdapterResolver,
      codexAdapter: this.deps.codexAdapter,
      threadListAggregationCache: this.deps.threadListAggregationCache,
      threadConcurrencyCoordinator: this.deps.threadConcurrencyCoordinator,
      eventStreamClientRegistry: this.deps.eventStreamClientRegistry,
      runtimeStateOwner: this.deps.runtimeStateOwner,
      activityHistoryService: this.deps.activityHistoryService,
      clientErrorStore: this.deps.clientErrorStore,
      pushService: this.deps.pushService,
      pushStore: this.deps.pushStore,
      pushReceiptStore: this.deps.pushReceiptStore,
      pushSendStore: this.deps.pushSendStore,
      pushMutationConcurrencyCoordinator: this.deps.pushMutationConcurrencyCoordinator,
      readObservabilitySnapshot: this.deps.readObservabilitySnapshot,
      pushTestBodySchema: this.deps.pushTestBodySchema,
      buildPushTestPayload: this.deps.buildPushTestPayload,
      parseInteger: this.deps.parseInteger,
      parseBoolean: this.deps.parseBoolean,
      parseAgentId: this.deps.parseAgentId,
      normalizeOptionalString: this.deps.normalizeOptionalString,
      withTimeout: this.deps.withTimeout,
      readJsonBody: this.deps.readJsonBody,
      jsonResponse: this.deps.jsonResponse,
      toErrorMessage: this.deps.toErrorMessage,
      ensureTraceDirectory: this.deps.ensureTraceDirectory,
      pushSystem: this.deps.pushSystem,
      invalidateThreadListAggregationCache: this.deps.invalidateThreadListAggregationCache,
      buildAgentDescriptor: this.deps.buildAgentDescriptor
    });
  }

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestLifecycleContext = this.requestLifecycleOwner.createRequestLifecycleContext(req);
    // Initialize from raw request URL so even missing/invalid URLs map to deterministic metrics routes.
    let pathnameForMetrics = readPathnameForRequestMetricsFromRequestUrl(req.url);
    this.requestLifecycleOwner.writeRequestContextResponseHeaders(res, requestLifecycleContext);

    const requestContext = this.requestLifecycleOwner.createRequestErrorContext(requestLifecycleContext);
    const requestContextDetails = this.requestLifecycleOwner.createRequestContextDetails(requestLifecycleContext);
    // Record request start before any early-return path so lifecycle timelines stay balanced.
    this.requestLifecycleOwner.recordRequestStartedForObservability(
      requestLifecycleContext,
      pathnameForMetrics
    );

    try {
      if (req.url === undefined || req.url.length === 0) {
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

      if (!this.requestAuthenticationOwner.requireApiAuth(req, res, pathname)) {
        return;
      }

      const handledRoute = await this.requestRouteDispatchOwner.dispatch({
        req,
        res,
        pathname,
        segments,
        url,
        requestContextDetails
      });
      if (handledRoute) {
        return;
      }

      this.deps.jsonResponse(res, STATUS_CODE_BY_NAME.clientErrorNotFound, {
        ok: false,
        error: NOT_FOUND_ERROR_MESSAGE
      });
    } catch (error) {
      this.respondWithHandledError(req, res, error, requestContext);
    } finally {
      this.requestLifecycleOwner.recordRequestCompletedForObservability({
        requestLifecycleContext,
        pathnameForMetrics,
        statusCode: res.statusCode
      });
    }
  }

  private respondWithHandledError<ErrorType>(
    req: IncomingMessage,
    res: ServerResponse,
    error: ErrorType,
    context: ServerRequestErrorContext
  ): void {
    this.requestErrorResponder.respond({
      req,
      res,
      error,
      context
    });
  }
}
