import { mkdtempSync, rmSync } from "node:fs";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { FarfieldPushTestBodySchema, type PushNotificationPayload } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import { AgentRegistry } from "../Source/Agents/Registry.js";
import { ThreadAdapterResolver } from "../Source/Agents/ThreadAdapterResolver.js";
import { ThreadIndex } from "../Source/Agents/ThreadIndex.js";
import type { AgentAdapter, AgentDescriptor } from "../Source/Agents/Types.js";
import { RuntimeStateOwner } from "../Source/Application/StateManagement/RuntimeStateOwner.js";
import { ActivityHistoryService } from "../Source/Modules/Activity/ActivityHistoryService.js";
import { ClientErrorStore } from "../Source/Modules/Debugging/ClientErrorStore.js";
import { PushReceiptStore } from "../Source/Modules/PushNotifications/PushReceiptStore.js";
import { PushSendStore } from "../Source/Modules/PushNotifications/PushSendStore.js";
import { PushService } from "../Source/Modules/PushNotifications/PushService.js";
import { PushStore } from "../Source/Modules/PushNotifications/PushStore.js";
import { BrowserSessionAuthOwner } from "../Source/Network/BrowserSessionAuthOwner.js";
import { EventStreamClientRegistry } from "../Source/Network/EventStreamClientRegistry.js";
import { PushMutationConcurrencyCoordinator } from "../Source/Network/PushMutationConcurrencyCoordinator.js";
import { RequestObservabilityOwner } from "../Source/Network/RequestObservabilityOwner.js";
import { RequestPathnameByName } from "../Source/Network/RequestPathContracts.js";
import {
  ServerRequestHandler,
  type ServerRequestHandlerDependencies,
} from "../Source/Network/ServerRequestHandler.js";
import { ServerRequestUtilityOwner } from "../Source/Network/ServerRequestUtilityOwner.js";
import { ThreadConcurrencyCoordinator } from "../Source/Network/ThreadConcurrencyCoordinator.js";
import { ThreadListAggregationCache } from "../Source/Network/ThreadListAggregationCache.js";

interface JsonResponseCall {
  statusCode: number;
  body: object;
}

interface HandlerTestHarness {
  requestHandler: ServerRequestHandler;
  requestObservabilityOwner: RequestObservabilityOwner;
  jsonResponseCalls: JsonResponseCall[];
  cleanup: () => void;
}

interface HandlerHarnessOptions {
  clientRequestIdHeaderName?: string;
  readCurrentEventLoopLagMs?: () => number;
}

const BASE_TEST_REQUEST_HEADER_NAME = "x-farfield-request-id";
const BASE_TEST_RESPONSE_HEADER_NAME = "x-farfield-request-id";
const BASE_TEST_ACTION_ID_HEADER_NAME = "x-farfield-action-id";
const BASE_TEST_ACTION_NAME_HEADER_NAME = "x-farfield-action-name";

function createRuntimeStateOwner(): RuntimeStateOwner {
  return new RuntimeStateOwner({
    appExecutable: "bun",
    socketPath: "/tmp/socket",
    workspaceDir: "/tmp/workspace",
    gitCommit: null,
    readCodexRuntimeState: () => null,
    readHistoryCount: () => 0,
    readThreadOwnerCount: () => 0,
    readPushEnabled: () => false,
    readPushSubscriptionCount: () => 0,
    readPushReceiptCount: () => 0,
    readClientErrorCount: () => 0,
    readActiveTraceSummary: () => null,
  });
}

function createHandlerTestHarness(options: HandlerHarnessOptions = {}): HandlerTestHarness {
  const tempDirectoryPath = mkdtempSync(path.join(tmpdir(), "server-request-handler-test-"));
  const eventStreamClientRegistry = new EventStreamClientRegistry(1_000);
  const requestObservabilityOwner = new RequestObservabilityOwner(8, 8, 32, 32);
  const utilityOwner = new ServerRequestUtilityOwner();
  const agentRegistry = new AgentRegistry([]);
  const threadAdapterResolver = new ThreadAdapterResolver(agentRegistry, new ThreadIndex());
  const jsonResponseCalls: JsonResponseCall[] = [];

  const dependencies: ServerRequestHandlerDependencies = {
    host: "localhost",
    port: 4311,
    apiToken: "test-token",
    apiAuthRequired: false,
    apiTokenHeaderName: "x-farfield-token",
    apiTokenResponseHeader: "x-farfield-token",
    browserSessionAuthOwner: new BrowserSessionAuthOwner({
      cookieName: "farfield-session",
      sessionTimeToLiveMs: 60_000,
      signingSecret: "test-secret",
      secureCookie: false,
    }),
    clientRequestIdHeaderName: options.clientRequestIdHeaderName ?? BASE_TEST_REQUEST_HEADER_NAME,
    clientRequestIdResponseHeader: BASE_TEST_RESPONSE_HEADER_NAME,
    clientActionIdHeaderName: BASE_TEST_ACTION_ID_HEADER_NAME,
    clientActionIdResponseHeader: BASE_TEST_ACTION_ID_HEADER_NAME,
    clientActionNameHeaderName: BASE_TEST_ACTION_NAME_HEADER_NAME,
    clientActionNameResponseHeader: BASE_TEST_ACTION_NAME_HEADER_NAME,
    webHealthBuildId: "test-build",
    webHealthServiceWorkerVersion: null,
    gitCommit: null,
    defaultWorkspace: tempDirectoryPath,
    traceDirectoryPath: tempDirectoryPath,
    capabilityListTimeoutMs: 1_000,
    threadListAdapterTimeoutMs: 1_000,
    pushTestSendTimeoutMs: 1_000,
    pushPrivateModeDefault: true,
    pushLocalCaSourcePath: path.join(tempDirectoryPath, "ca.pem"),
    configuredAgentIds: [],
    registry: agentRegistry,
    threadAdapterResolver,
    codexAdapter: null,
    threadListAggregationCache: new ThreadListAggregationCache(1_000, 8),
    threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
    eventStreamClientRegistry,
    runtimeStateOwner: createRuntimeStateOwner(),
    activityHistoryService: new ActivityHistoryService(32, eventStreamClientRegistry),
    clientErrorStore: new ClientErrorStore(
      path.join(tempDirectoryPath, "client-errors.ndjson"),
      "session_test",
      64,
    ),
    pushService: new PushService({
      enabled: false,
      vapidPublicKey: "",
      vapidPrivateKey: "",
      vapidSubject: "mailto:test@example.com",
    }),
    pushStore: new PushStore(path.join(tempDirectoryPath, "push-state.json")),
    pushReceiptStore: new PushReceiptStore(
      path.join(tempDirectoryPath, "push-receipts.json"),
      64,
      60_000,
    ),
    pushSendStore: new PushSendStore(path.join(tempDirectoryPath, "push-send.json")),
    pushMutationConcurrencyCoordinator: new PushMutationConcurrencyCoordinator(),
    requestObservabilityOwner,
    readCurrentEventLoopLagMs: options.readCurrentEventLoopLagMs ?? (() => 0),
    readObservabilitySnapshot: () => {
      throw new Error(
        "readObservabilitySnapshot should not run in ServerRequestHandler unit tests",
      );
    },
    pushTestBodySchema: FarfieldPushTestBodySchema,
    buildPushTestPayload: () => {
      const payload: PushNotificationPayload = {
        notificationId: "notif_1",
        title: "Farfield notification",
        body: "A response is ready in Farfield.",
        threadId: "thread_1",
        turnId: "turn_1",
        url: "/threads/thread_1",
        createdAt: "2026-02-25T00:00:00.000Z",
        web_push: {
          notification: {
            title: "Farfield notification",
            body: "A response is ready in Farfield.",
            navigate: "/threads/thread_1",
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            tag: "thread:thread_1",
          },
        },
      };
      return payload;
    },
    parseInteger: (value, defaultValue) => utilityOwner.parseInteger(value, defaultValue),
    parseBoolean: (value, defaultValue) => utilityOwner.parseBoolean(value, defaultValue),
    parseAgentId: (value) => utilityOwner.parseAgentId(value),
    normalizeOptionalString: (value) => utilityOwner.normalizeOptionalString(value),
    withTimeout: (promise, timeoutMs, label) => utilityOwner.withTimeout(promise, timeoutMs, label),
    readJsonBody: async () => ({}),
    jsonResponse: (response, statusCode, body) => {
      response.statusCode = statusCode;
      jsonResponseCalls.push({
        statusCode,
        body,
      });
    },
    toErrorMessage: <ValueType>(value: ValueType): string => {
      if (value instanceof Error) {
        return value.message;
      }
      return String(value);
    },
    ensureTraceDirectory: () => {},
    pushSystem: () => {},
    invalidateThreadListAggregationCache: () => {},
    buildAgentDescriptor: (
      _adapter: AgentAdapter,
      projectDirectories: string[],
    ): AgentDescriptor => ({
      id: "codex",
      label: "Codex",
      enabled: true,
      connected: true,
      capabilities: {
        canListModels: false,
        canListCollaborationModes: false,
        canSetCollaborationMode: false,
        canSubmitUserInput: false,
        canReadLiveState: false,
        canReadStreamEvents: false,
      },
      projectDirectories,
    }),
    setRuntimeLastError: () => {},
    broadcastRuntimeState: () => {},
    isShuttingDown: () => false,
    isExpectedShutdownTransportError: () => false,
    recordServerErrorEvent: () => {},
  };

  return {
    requestHandler: new ServerRequestHandler(dependencies),
    requestObservabilityOwner,
    jsonResponseCalls,
    cleanup: () => {
      eventStreamClientRegistry.stopKeepalive();
      rmSync(tempDirectoryPath, { recursive: true, force: true });
    },
  };
}

function createRequestResponsePair(): { request: IncomingMessage; response: ServerResponse } {
  const socket = new Socket();
  const request = new IncomingMessage(socket);
  const response = new ServerResponse(request);
  return {
    request,
    response,
  };
}

describe("ServerRequestHandler", () => {
  it("returns 400 for malformed request urls with a deterministic metrics pathname", async () => {
    const harness = createHandlerTestHarness();
    const { request, response } = createRequestResponsePair();
    request.method = "GET";
    request.url = "http://[invalid";

    try {
      await harness.requestHandler.handle(request, response);

      expect(harness.jsonResponseCalls).toEqual([
        {
          statusCode: 400,
          body: {
            ok: false,
            error: "Malformed request URL",
          },
        },
      ]);

      const snapshot = harness.requestObservabilityOwner.readSnapshot();
      expect(snapshot.totalRequestCount).toBe(1);
      expect(snapshot.totalErrorCount).toBe(1);
      expect(snapshot.routeTimings[0]?.route).toBe(RequestPathnameByName.malformedRequestUrl);
    } finally {
      harness.cleanup();
    }
  });

  it("reads configured request-id headers through lowercase normalization", async () => {
    const harness = createHandlerTestHarness({
      clientRequestIdHeaderName: "X-Farfield-Request-Id",
    });
    const { request, response } = createRequestResponsePair();
    request.method = "GET";
    request.url = RequestPathnameByName.healthCheck;
    request.headers["x-farfield-request-id"] = "request_from_header";

    try {
      await harness.requestHandler.handle(request, response);

      expect(harness.jsonResponseCalls[0]?.statusCode).toBe(200);
      expect(response.getHeader(BASE_TEST_RESPONSE_HEADER_NAME)).toBe("request_from_header");
    } finally {
      harness.cleanup();
    }
  });

  it("records paired started and completed lifecycle events with matching request context", async () => {
    const harness = createHandlerTestHarness();
    const { request, response } = createRequestResponsePair();
    request.method = "GET";
    request.url = RequestPathnameByName.healthCheck;
    request.headers[BASE_TEST_REQUEST_HEADER_NAME] = "request_context_pair";
    request.headers[BASE_TEST_ACTION_ID_HEADER_NAME] = "action_context_pair";
    request.headers[BASE_TEST_ACTION_NAME_HEADER_NAME] = "startup-critical.threads.active";

    try {
      await harness.requestHandler.handle(request, response);

      const snapshot = harness.requestObservabilityOwner.readSnapshot();
      const requestLifecycleEvents = snapshot.requestLifecycleEvents;
      expect(requestLifecycleEvents).toHaveLength(2);
      const firstLifecycleEvent = requestLifecycleEvents[0];
      const secondLifecycleEvent = requestLifecycleEvents[1];
      if (!firstLifecycleEvent || !secondLifecycleEvent) {
        throw new Error("Expected paired request lifecycle events");
      }
      if (firstLifecycleEvent.phase !== "started") {
        throw new Error("Expected first request lifecycle event to be started");
      }
      if (secondLifecycleEvent.phase !== "completed") {
        throw new Error("Expected second request lifecycle event to be completed");
      }

      expect(firstLifecycleEvent.requestId).toBe("request_context_pair");
      expect(secondLifecycleEvent.requestId).toBe("request_context_pair");
      expect(firstLifecycleEvent.actionId).toBe("action_context_pair");
      expect(secondLifecycleEvent.actionId).toBe("action_context_pair");
      expect(firstLifecycleEvent.actionName).toBe("startup-critical.threads.active");
      expect(secondLifecycleEvent.actionName).toBe("startup-critical.threads.active");
      expect(secondLifecycleEvent.startedAt).toBe(firstLifecycleEvent.startedAt);
      expect(secondLifecycleEvent.queueDelayMs).toBe(firstLifecycleEvent.queueDelayMs);
      expect(secondLifecycleEvent.statusCode).toBe(200);
      expect(secondLifecycleEvent.outcome).toBe("success");
    } finally {
      harness.cleanup();
    }
  });

  it("samples event-loop queue delay once per request lifecycle", async () => {
    let readCurrentEventLoopLagInvocationCount = 0;
    const harness = createHandlerTestHarness({
      readCurrentEventLoopLagMs: () => {
        readCurrentEventLoopLagInvocationCount += 1;
        return readCurrentEventLoopLagInvocationCount === 1 ? 17 : 91;
      },
    });
    const { request, response } = createRequestResponsePair();
    request.method = "GET";
    request.url = RequestPathnameByName.healthCheck;

    try {
      await harness.requestHandler.handle(request, response);

      expect(readCurrentEventLoopLagInvocationCount).toBe(1);
      const snapshot = harness.requestObservabilityOwner.readSnapshot();
      const requestLifecycleEvents = snapshot.requestLifecycleEvents;
      expect(requestLifecycleEvents).toHaveLength(2);
      const firstLifecycleEvent = requestLifecycleEvents[0];
      const secondLifecycleEvent = requestLifecycleEvents[1];
      if (!firstLifecycleEvent || !secondLifecycleEvent) {
        throw new Error("Expected paired request lifecycle events");
      }
      if (firstLifecycleEvent.phase !== "started") {
        throw new Error("Expected first request lifecycle event to be started");
      }
      if (secondLifecycleEvent.phase !== "completed") {
        throw new Error("Expected second request lifecycle event to be completed");
      }

      expect(firstLifecycleEvent.queueDelayMs).toBe(17);
      expect(secondLifecycleEvent.queueDelayMs).toBe(17);
      const routeTiming = snapshot.routeTimings[0];
      if (!routeTiming) {
        throw new Error("Expected route timing telemetry for health-check request");
      }
      expect(routeTiming.lastQueueDelayMs).toBe(17);
    } finally {
      harness.cleanup();
    }
  });
});
