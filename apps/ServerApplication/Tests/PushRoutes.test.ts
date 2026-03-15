import fs from "node:fs";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import os from "node:os";
import path from "node:path";
import {
  FarfieldApiErrorResponseSchema,
  FarfieldCreatePushSubscriptionEnvelopeSchema,
  FarfieldDeletePushSubscriptionEnvelopeSchema,
  FarfieldPushLocalCaStatusEnvelopeSchema,
  FarfieldPushReceiptCreateEnvelopeSchema,
  FarfieldPushReceiptLatestEnvelopeSchema,
  FarfieldPushStatusEnvelopeSchema,
  FarfieldPushTestBodySchema,
  FarfieldPushVapidPublicKeyEnvelopeSchema,
  type JsonValue,
  type PushNotificationPayload,
} from "@farfield/protocol";
import { describe, expect, it, vi } from "vitest";
import { PushReceiptStore } from "../Source/Modules/PushNotifications/PushReceiptStore.js";
import { PushSendStore } from "../Source/Modules/PushNotifications/PushSendStore.js";
import { PushService } from "../Source/Modules/PushNotifications/PushService.js";
import { PushStore } from "../Source/Modules/PushNotifications/PushStore.js";
import { PushMutationConcurrencyCoordinator } from "../Source/Network/PushMutationConcurrencyCoordinator.js";
import {
  PushRouteMethodByName,
  PushRoutePathnameByName,
} from "../Source/Network/Routes/PushRouteContracts.js";
import {
  handlePushRoutes,
  type PushRouteDependencies,
} from "../Source/Network/Routes/PushRoutes.js";

interface RouteExecutionResult {
  handled: boolean;
  statusCode: number | null;
  body: object | null;
}

function readRouteBody(result: RouteExecutionResult): object {
  if (!result.body) {
    throw new Error("Expected route handler to produce a response body");
  }
  return result.body;
}

function createRequestResponsePair(): {
  request: IncomingMessage;
  response: ServerResponse;
} {
  const socket = new Socket();
  const request = new IncomingMessage(socket);
  const response = new ServerResponse(request);
  return {
    request,
    response,
  };
}

function createPushPayload(
  threadId: string,
  turnId: string,
  privateMode: boolean,
): PushNotificationPayload {
  return {
    notificationId: `push_${privateMode ? "private" : "detailed"}`,
    title: privateMode ? "Private" : "Detailed",
    body: "Push body",
    threadId,
    turnId,
    url: `/threads/${threadId}`,
    createdAt: new Date().toISOString(),
  };
}

function buildDependencies(input: {
  method: "GET" | "POST" | "DELETE";
  pathname: string;
  pushService: PushService;
  pushStore: PushStore;
  pushReceiptStore: PushReceiptStore;
  pushSendStore: PushSendStore;
  pushMutationConcurrencyCoordinator: PushMutationConcurrencyCoordinator;
  pushLocalCaSourcePath: string;
  readJsonBody: () => Promise<JsonValue>;
  onJsonResponse: (statusCode: number, body: object) => void;
}): PushRouteDependencies {
  const { request, response } = createRequestResponsePair();
  request.method = input.method;

  return {
    req: request,
    res: response,
    pathname: input.pathname,
    segments: input.pathname.split("/").filter(Boolean),
    pushPrivateModeDefault: true,
    pushLocalCaSourcePath: input.pushLocalCaSourcePath,
    pushService: input.pushService,
    pushStore: input.pushStore,
    pushReceiptStore: input.pushReceiptStore,
    pushSendStore: input.pushSendStore,
    pushMutationConcurrencyCoordinator: input.pushMutationConcurrencyCoordinator,
    pushTestSendTimeoutMs: 5_000,
    pushTestBodySchema: FarfieldPushTestBodySchema,
    readJsonBody: async () => input.readJsonBody(),
    jsonResponse: (_response, statusCode, body) => {
      input.onJsonResponse(statusCode, body);
    },
    buildPushTestPayload: (payload, privateMode) => {
      return createPushPayload(payload.threadId, payload.turnId, privateMode);
    },
    withTimeout: async (promise) => promise,
  };
}

async function executePushRoute(input: {
  method: "GET" | "POST" | "DELETE";
  pathname: string;
  pushService: PushService;
  pushStore: PushStore;
  pushReceiptStore: PushReceiptStore;
  pushSendStore: PushSendStore;
  pushMutationConcurrencyCoordinator: PushMutationConcurrencyCoordinator;
  pushLocalCaSourcePath: string;
  readJsonBody: () => Promise<JsonValue>;
}): Promise<RouteExecutionResult> {
  let statusCode: number | null = null;
  let body: object | null = null;

  const handled = await handlePushRoutes(
    buildDependencies({
      ...input,
      onJsonResponse: (nextStatusCode, nextBody) => {
        statusCode = nextStatusCode;
        body = nextBody;
      },
    }),
  );

  return {
    handled,
    statusCode,
    body,
  };
}

describe("handlePushRoutes", () => {
  it("returns status and public key responses with strict route contracts", async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "push-routes-status-"));
    try {
      const pushService = new PushService({
        enabled: false,
        vapidPublicKey: "",
        vapidPrivateKey: "",
        vapidSubject: "mailto:test@example.com",
      });
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      const pushReceiptStore = new PushReceiptStore(
        path.join(temporaryDirectory, "push-receipts.json"),
        100,
        86_400_000,
      );
      pushReceiptStore.load();
      const pushSendStore = new PushSendStore(path.join(temporaryDirectory, "push-send.json"));
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();

      const statusResult = await executePushRoute({
        method: PushRouteMethodByName.get,
        pathname: PushRoutePathnameByName.status,
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({}),
      });

      expect(statusResult.handled).toBe(true);
      expect(statusResult.statusCode).toBe(200);
      const parsedStatusResponse = FarfieldPushStatusEnvelopeSchema.parse(
        readRouteBody(statusResult),
      );
      expect(parsedStatusResponse).toEqual({
        ok: true,
        enabled: false,
        permissionRequired: true,
        subscriptionCount: 0,
        privateModeDefault: true,
      });

      const disabledKeyResult = await executePushRoute({
        method: PushRouteMethodByName.get,
        pathname: PushRoutePathnameByName.vapidPublicKey,
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({}),
      });

      expect(disabledKeyResult.handled).toBe(true);
      expect(disabledKeyResult.statusCode).toBe(503);
      const parsedDisabledPublicKeyResponse = FarfieldApiErrorResponseSchema.parse(
        readRouteBody(disabledKeyResult),
      );
      expect(parsedDisabledPublicKeyResponse).toEqual({
        ok: false,
        error: "Push notifications are disabled",
      });

      vi.spyOn(pushService, "isEnabled").mockReturnValue(true);
      vi.spyOn(pushService, "getPublicKey").mockReturnValue("PublicVapidKey");

      const enabledKeyResult = await executePushRoute({
        method: PushRouteMethodByName.get,
        pathname: PushRoutePathnameByName.vapidPublicKey,
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({}),
      });

      expect(enabledKeyResult.handled).toBe(true);
      expect(enabledKeyResult.statusCode).toBe(200);
      const parsedEnabledPublicKeyResponse = FarfieldPushVapidPublicKeyEnvelopeSchema.parse(
        readRouteBody(enabledKeyResult),
      );
      expect(parsedEnabledPublicKeyResponse).toEqual({
        ok: true,
        publicKey: "PublicVapidKey",
      });
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("records receipts and reads latest receipt state", async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "push-routes-receipts-"));
    try {
      const pushService = new PushService({
        enabled: false,
        vapidPublicKey: "",
        vapidPrivateKey: "",
        vapidSubject: "mailto:test@example.com",
      });
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      const pushReceiptStore = new PushReceiptStore(
        path.join(temporaryDirectory, "push-receipts.json"),
        100,
        86_400_000,
      );
      pushReceiptStore.load();
      const pushSendStore = new PushSendStore(path.join(temporaryDirectory, "push-send.json"));
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();
      const createdAt = new Date().toISOString();

      const recordResult = await executePushRoute({
        method: PushRouteMethodByName.post,
        pathname: PushRoutePathnameByName.receipts,
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({
          notificationId: "notification_1",
          event: "shown",
          url: "/threads/thread_1",
          threadId: "thread_1",
          turnId: "turn_1",
          message: "shown",
          createdAt,
        }),
      });

      expect(recordResult.handled).toBe(true);
      expect(recordResult.statusCode).toBe(200);
      const parsedReceiptCreateResponse = FarfieldPushReceiptCreateEnvelopeSchema.parse(
        readRouteBody(recordResult),
      );
      expect(parsedReceiptCreateResponse).toEqual({ ok: true, recorded: true });
      expect(pushReceiptStore.getCount()).toBe(1);

      const latestReceiptResult = await executePushRoute({
        method: PushRouteMethodByName.get,
        pathname: PushRoutePathnameByName.receiptsLatest,
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({}),
      });

      expect(latestReceiptResult.handled).toBe(true);
      expect(latestReceiptResult.statusCode).toBe(200);
      const parsedLatestReceiptResponse = FarfieldPushReceiptLatestEnvelopeSchema.parse(
        readRouteBody(latestReceiptResult),
      );
      expect(parsedLatestReceiptResponse).toEqual({
        ok: true,
        count: 1,
        latest: {
          notificationId: "notification_1",
          event: "shown",
          url: "/threads/thread_1",
          threadId: "thread_1",
          turnId: "turn_1",
          message: "shown",
          createdAt,
        },
      });
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("preserves explicitly empty receipt message values", async () => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "push-routes-receipts-empty-message-"),
    );
    try {
      const pushService = new PushService({
        enabled: false,
        vapidPublicKey: "",
        vapidPrivateKey: "",
        vapidSubject: "mailto:test@example.com",
      });
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      const pushReceiptStore = new PushReceiptStore(
        path.join(temporaryDirectory, "push-receipts.json"),
        100,
        86_400_000,
      );
      pushReceiptStore.load();
      const pushSendStore = new PushSendStore(path.join(temporaryDirectory, "push-send.json"));
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();
      const createdAt = new Date().toISOString();

      const recordResult = await executePushRoute({
        method: PushRouteMethodByName.post,
        pathname: PushRoutePathnameByName.receipts,
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({
          notificationId: "notification_empty_message",
          event: "shown",
          url: "/threads/thread_1",
          threadId: "thread_1",
          turnId: "turn_1",
          message: "",
          createdAt,
        }),
      });

      expect(recordResult.handled).toBe(true);
      expect(recordResult.statusCode).toBe(200);
      const parsedReceiptCreateResponse = FarfieldPushReceiptCreateEnvelopeSchema.parse(
        readRouteBody(recordResult),
      );
      expect(parsedReceiptCreateResponse).toEqual({ ok: true, recorded: true });

      const storedLatestReceipt = pushReceiptStore.getLatest();
      expect(storedLatestReceipt).not.toBeNull();
      if (!storedLatestReceipt) {
        throw new Error("Expected stored latest push receipt");
      }
      expect(storedLatestReceipt.message).toBe("");

      const latestReceiptResult = await executePushRoute({
        method: PushRouteMethodByName.get,
        pathname: PushRoutePathnameByName.receiptsLatest,
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({}),
      });

      expect(latestReceiptResult.handled).toBe(true);
      expect(latestReceiptResult.statusCode).toBe(200);
      const parsedLatestReceiptResponse = FarfieldPushReceiptLatestEnvelopeSchema.parse(
        readRouteBody(latestReceiptResult),
      );
      expect(parsedLatestReceiptResponse.count).toBe(1);
      expect(parsedLatestReceiptResponse.latest).not.toBeNull();
      if (!parsedLatestReceiptResponse.latest) {
        throw new Error("Expected latest receipt response payload");
      }
      expect(parsedLatestReceiptResponse.latest.message).toBe("");
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("supports local CA metadata and guarded download errors without exposing source path", async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "push-routes-local-ca-"));
    try {
      const pushService = new PushService({
        enabled: false,
        vapidPublicKey: "",
        vapidPrivateKey: "",
        vapidSubject: "mailto:test@example.com",
      });
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      const pushReceiptStore = new PushReceiptStore(
        path.join(temporaryDirectory, "push-receipts.json"),
        100,
        86_400_000,
      );
      pushReceiptStore.load();
      const pushSendStore = new PushSendStore(path.join(temporaryDirectory, "push-send.json"));
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();
      const pushLocalCaSourcePath = path.join(temporaryDirectory, "rootCA.pem");

      const localCaStatusResult = await executePushRoute({
        method: PushRouteMethodByName.get,
        pathname: PushRoutePathnameByName.localCa,
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath,
        readJsonBody: async () => ({}),
      });

      expect(localCaStatusResult.handled).toBe(true);
      expect(localCaStatusResult.statusCode).toBe(200);
      const parsedLocalCaStatusResponse = FarfieldPushLocalCaStatusEnvelopeSchema.parse(
        readRouteBody(localCaStatusResult),
      );
      expect(parsedLocalCaStatusResponse).toEqual({
        ok: true,
        available: false,
        downloadPath: null,
      });

      const missingDownloadResult = await executePushRoute({
        method: PushRouteMethodByName.get,
        pathname: PushRoutePathnameByName.localCaDownload,
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath,
        readJsonBody: async () => ({}),
      });

      expect(missingDownloadResult.handled).toBe(true);
      expect(missingDownloadResult.statusCode).toBe(404);
      const parsedMissingDownloadResponse = FarfieldApiErrorResponseSchema.parse(
        readRouteBody(missingDownloadResult),
      );
      expect(parsedMissingDownloadResponse).toEqual({
        ok: false,
        error: "Local Caddy root certificate not found",
      });
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("treats aborted local CA downloads as request-scoped disconnects", async () => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "push-routes-local-ca-abort-"),
    );
    try {
      const pushService = new PushService({
        enabled: false,
        vapidPublicKey: "",
        vapidPrivateKey: "",
        vapidSubject: "mailto:test@example.com",
      });
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      const pushReceiptStore = new PushReceiptStore(
        path.join(temporaryDirectory, "push-receipts.json"),
        100,
        86_400_000,
      );
      pushReceiptStore.load();
      const pushSendStore = new PushSendStore(path.join(temporaryDirectory, "push-send.json"));
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();
      const pushLocalCaSourcePath = path.join(temporaryDirectory, "rootCA.pem");
      fs.writeFileSync(
        pushLocalCaSourcePath,
        "-----BEGIN CERTIFICATE-----\nlocal\n-----END CERTIFICATE-----\n",
      );

      const { request, response } = createRequestResponsePair();
      request.method = PushRouteMethodByName.get;
      const jsonResponseSpy = vi.fn();
      const writeHeadSpy = vi.spyOn(response, "writeHead");
      writeHeadSpy.mockImplementation((statusCode, statusMessageOrHeaders, headers) => {
        const writeHeadResult = ServerResponse.prototype.writeHead.call(
          response,
          statusCode,
          statusMessageOrHeaders as string | number | readonly string[] | undefined,
          headers,
        );
        queueMicrotask(() => {
          response.destroy();
        });
        return writeHeadResult;
      });

      const handled = await handlePushRoutes({
        req: request,
        res: response,
        pathname: PushRoutePathnameByName.localCaDownload,
        segments: PushRoutePathnameByName.localCaDownload.split("/").filter(Boolean),
        pushPrivateModeDefault: true,
        pushLocalCaSourcePath,
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushTestSendTimeoutMs: 5_000,
        pushTestBodySchema: FarfieldPushTestBodySchema,
        readJsonBody: async () => ({}),
        jsonResponse: (_response, statusCode, body) => {
          jsonResponseSpy(statusCode, body);
        },
        buildPushTestPayload: (payload, privateMode) => {
          return createPushPayload(payload.threadId, payload.turnId, privateMode);
        },
        withTimeout: async (promise) => promise,
      });

      expect(handled).toBe(true);
      expect(jsonResponseSpy).not.toHaveBeenCalled();
      expect(response.destroyed).toBe(true);
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("creates and deletes subscriptions through the mutation coordinator", async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "push-routes-subscriptions-"));
    try {
      const pushService = new PushService({
        enabled: false,
        vapidPublicKey: "",
        vapidPrivateKey: "",
        vapidSubject: "mailto:test@example.com",
      });
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      const pushReceiptStore = new PushReceiptStore(
        path.join(temporaryDirectory, "push-receipts.json"),
        100,
        86_400_000,
      );
      pushReceiptStore.load();
      const pushSendStore = new PushSendStore(path.join(temporaryDirectory, "push-send.json"));
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();

      const createResult = await executePushRoute({
        method: PushRouteMethodByName.post,
        pathname: PushRoutePathnameByName.subscriptions,
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({
          subscription: {
            endpoint: "https://push.example.test/subscription_1",
            keys: {
              p256dh: "P256DhKey",
              auth: "AuthKey",
            },
          },
          settings: {
            privateMode: false,
          },
        }),
      });

      expect(createResult.handled).toBe(true);
      expect(createResult.statusCode).toBe(200);
      const parsedCreateSubscriptionResponse = FarfieldCreatePushSubscriptionEnvelopeSchema.parse(
        readRouteBody(createResult),
      );
      expect(parsedCreateSubscriptionResponse.ok).toBe(true);
      expect(parsedCreateSubscriptionResponse.subscriptionId.length).toBeGreaterThan(0);
      expect(pushStore.getSubscriptionCount()).toBe(1);

      const deleteResult = await executePushRoute({
        method: PushRouteMethodByName.delete,
        pathname: PushRoutePathnameByName.subscriptions,
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({
          endpoint: "https://push.example.test/subscription_1",
        }),
      });

      expect(deleteResult.handled).toBe(true);
      expect(deleteResult.statusCode).toBe(200);
      const parsedDeleteSubscriptionResponse = FarfieldDeletePushSubscriptionEnvelopeSchema.parse(
        readRouteBody(deleteResult),
      );
      expect(parsedDeleteSubscriptionResponse).toEqual({
        ok: true,
        deleted: true,
      });
      expect(pushStore.getSubscriptionCount()).toBe(0);
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("returns false for non-push paths", async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "push-routes-non-push-"));
    try {
      const pushService = new PushService({
        enabled: false,
        vapidPublicKey: "",
        vapidPrivateKey: "",
        vapidSubject: "mailto:test@example.com",
      });
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      const pushReceiptStore = new PushReceiptStore(
        path.join(temporaryDirectory, "push-receipts.json"),
        100,
        86_400_000,
      );
      pushReceiptStore.load();
      const pushSendStore = new PushSendStore(path.join(temporaryDirectory, "push-send.json"));
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();

      const result = await executePushRoute({
        method: PushRouteMethodByName.get,
        pathname: "/api/threads",
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({}),
      });

      expect(result.handled).toBe(false);
      expect(result.statusCode).toBeNull();
      expect(result.body).toBeNull();
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("returns false for unowned push route paths", async () => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "push-routes-unowned-push-path-"),
    );
    try {
      const pushService = new PushService({
        enabled: false,
        vapidPublicKey: "",
        vapidPrivateKey: "",
        vapidSubject: "mailto:test@example.com",
      });
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      const pushReceiptStore = new PushReceiptStore(
        path.join(temporaryDirectory, "push-receipts.json"),
        100,
        86_400_000,
      );
      pushReceiptStore.load();
      const pushSendStore = new PushSendStore(path.join(temporaryDirectory, "push-send.json"));
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();

      const result = await executePushRoute({
        method: PushRouteMethodByName.get,
        pathname: "/api/push/not-owned",
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({}),
      });

      expect(result.handled).toBe(false);
      expect(result.statusCode).toBeNull();
      expect(result.body).toBeNull();
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
