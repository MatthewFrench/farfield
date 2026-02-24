import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import {
  FarfieldPushTestBodySchema,
  type JsonValue,
  type PushNotificationPayload
} from "@farfield/protocol";
import { describe, expect, it, vi } from "vitest";
import { PushService } from "../Source/Modules/PushNotifications/PushService.js";
import { PushStore } from "../Source/Modules/PushNotifications/PushStore.js";
import { PushReceiptStore } from "../Source/Modules/PushNotifications/PushReceiptStore.js";
import { PushSendStore } from "../Source/Modules/PushNotifications/PushSendStore.js";
import { PushMutationConcurrencyCoordinator } from "../Source/Network/PushMutationConcurrencyCoordinator.js";
import {
  handlePushRoutes,
  type PushRouteDependencies
} from "../Source/Network/Routes/PushRoutes.js";

interface RouteExecutionResult {
  handled: boolean;
  statusCode: number | null;
  body: object | null;
}

function createRequestResponsePair(): { request: IncomingMessage; response: ServerResponse } {
  const socket = new Socket();
  const request = new IncomingMessage(socket);
  const response = new ServerResponse(request);
  return {
    request,
    response
  };
}

function createPushPayload(
  threadId: string,
  turnId: string,
  privateMode: boolean
): PushNotificationPayload {
  return {
    notificationId: `push_${privateMode ? "private" : "detailed"}`,
    title: privateMode ? "Private" : "Detailed",
    body: "Push body",
    threadId,
    turnId,
    url: `/threads/${threadId}`,
    createdAt: new Date().toISOString()
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
    withTimeout: async (promise) => promise
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
      }
    })
  );

  return {
    handled,
    statusCode,
    body
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
        vapidSubject: "mailto:test@example.com"
      });
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      const pushReceiptStore = new PushReceiptStore(
        path.join(temporaryDirectory, "push-receipts.json"),
        100,
        86_400_000
      );
      pushReceiptStore.load();
      const pushSendStore = new PushSendStore(path.join(temporaryDirectory, "push-send.json"));
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();

      const statusResult = await executePushRoute({
        method: "GET",
        pathname: "/api/push/status",
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({})
      });

      expect(statusResult.handled).toBe(true);
      expect(statusResult.statusCode).toBe(200);
      expect(statusResult.body).toMatchObject({
        ok: true,
        enabled: false,
        permissionRequired: true,
        subscriptionCount: 0,
        privateModeDefault: true
      });

      const disabledKeyResult = await executePushRoute({
        method: "GET",
        pathname: "/api/push/vapid-public-key",
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({})
      });

      expect(disabledKeyResult.handled).toBe(true);
      expect(disabledKeyResult.statusCode).toBe(503);
      expect(disabledKeyResult.body).toMatchObject({
        ok: false,
        error: "Push notifications are disabled"
      });

      vi.spyOn(pushService, "isEnabled").mockReturnValue(true);
      vi.spyOn(pushService, "getPublicKey").mockReturnValue("PublicVapidKey");

      const enabledKeyResult = await executePushRoute({
        method: "GET",
        pathname: "/api/push/vapid-public-key",
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({})
      });

      expect(enabledKeyResult.handled).toBe(true);
      expect(enabledKeyResult.statusCode).toBe(200);
      expect(enabledKeyResult.body).toMatchObject({
        ok: true,
        publicKey: "PublicVapidKey"
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
        vapidSubject: "mailto:test@example.com"
      });
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      const pushReceiptStore = new PushReceiptStore(
        path.join(temporaryDirectory, "push-receipts.json"),
        100,
        86_400_000
      );
      pushReceiptStore.load();
      const pushSendStore = new PushSendStore(path.join(temporaryDirectory, "push-send.json"));
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();
      const createdAt = new Date().toISOString();

      const recordResult = await executePushRoute({
        method: "POST",
        pathname: "/api/push/receipts",
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
          createdAt
        })
      });

      expect(recordResult.handled).toBe(true);
      expect(recordResult.statusCode).toBe(200);
      expect(recordResult.body).toMatchObject({ ok: true, recorded: true });
      expect(pushReceiptStore.getCount()).toBe(1);

      const latestReceiptResult = await executePushRoute({
        method: "GET",
        pathname: "/api/push/receipts/latest",
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({})
      });

      expect(latestReceiptResult.handled).toBe(true);
      expect(latestReceiptResult.statusCode).toBe(200);
      expect(latestReceiptResult.body).toMatchObject({
        ok: true,
        count: 1,
        latest: {
          notificationId: "notification_1",
          event: "shown",
          url: "/threads/thread_1",
          threadId: "thread_1",
          turnId: "turn_1",
          message: "shown",
          createdAt
        }
      });
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
        vapidSubject: "mailto:test@example.com"
      });
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      const pushReceiptStore = new PushReceiptStore(
        path.join(temporaryDirectory, "push-receipts.json"),
        100,
        86_400_000
      );
      pushReceiptStore.load();
      const pushSendStore = new PushSendStore(path.join(temporaryDirectory, "push-send.json"));
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();
      const pushLocalCaSourcePath = path.join(temporaryDirectory, "rootCA.pem");

      const localCaStatusResult = await executePushRoute({
        method: "GET",
        pathname: "/api/push/local-ca",
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath,
        readJsonBody: async () => ({})
      });

      expect(localCaStatusResult.handled).toBe(true);
      expect(localCaStatusResult.statusCode).toBe(200);
      expect(localCaStatusResult.body).toMatchObject({
        ok: true,
        available: false,
        downloadPath: null
      });
      expect(localCaStatusResult.body).not.toHaveProperty("sourcePath");

      const missingDownloadResult = await executePushRoute({
        method: "GET",
        pathname: "/api/push/local-ca/download",
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath,
        readJsonBody: async () => ({})
      });

      expect(missingDownloadResult.handled).toBe(true);
      expect(missingDownloadResult.statusCode).toBe(404);
      expect(missingDownloadResult.body).toMatchObject({
        ok: false,
        error: "Local Caddy root certificate not found"
      });
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
        vapidSubject: "mailto:test@example.com"
      });
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      const pushReceiptStore = new PushReceiptStore(
        path.join(temporaryDirectory, "push-receipts.json"),
        100,
        86_400_000
      );
      pushReceiptStore.load();
      const pushSendStore = new PushSendStore(path.join(temporaryDirectory, "push-send.json"));
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();

      const createResult = await executePushRoute({
        method: "POST",
        pathname: "/api/push/subscriptions",
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
              auth: "AuthKey"
            }
          },
          settings: {
            privateMode: false
          }
        })
      });

      expect(createResult.handled).toBe(true);
      expect(createResult.statusCode).toBe(200);
      expect(createResult.body).toMatchObject({ ok: true });
      expect(pushStore.getSubscriptionCount()).toBe(1);

      const deleteResult = await executePushRoute({
        method: "DELETE",
        pathname: "/api/push/subscriptions",
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({
          endpoint: "https://push.example.test/subscription_1"
        })
      });

      expect(deleteResult.handled).toBe(true);
      expect(deleteResult.statusCode).toBe(200);
      expect(deleteResult.body).toMatchObject({ ok: true, deleted: true });
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
        vapidSubject: "mailto:test@example.com"
      });
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      const pushReceiptStore = new PushReceiptStore(
        path.join(temporaryDirectory, "push-receipts.json"),
        100,
        86_400_000
      );
      pushReceiptStore.load();
      const pushSendStore = new PushSendStore(path.join(temporaryDirectory, "push-send.json"));
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();

      const result = await executePushRoute({
        method: "GET",
        pathname: "/api/threads",
        pushService,
        pushStore,
        pushReceiptStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushLocalCaSourcePath: path.join(temporaryDirectory, "rootCA.pem"),
        readJsonBody: async () => ({})
      });

      expect(result.handled).toBe(false);
      expect(result.statusCode).toBeNull();
      expect(result.body).toBeNull();
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
