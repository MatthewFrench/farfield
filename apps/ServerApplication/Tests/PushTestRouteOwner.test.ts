import fs from "node:fs";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import os from "node:os";
import path from "node:path";
import {
  FarfieldPushTestBodySchema,
  FarfieldPushTestEnvelopeSchema,
  type JsonValue,
  type PushNotificationPayload,
} from "@farfield/protocol";
import { describe, expect, it, vi } from "vitest";
import { PushSendStore } from "../Source/Modules/PushNotifications/PushSendStore.js";
import {
  type PushSendResult,
  PushService,
} from "../Source/Modules/PushNotifications/PushService.js";
import { PushStore } from "../Source/Modules/PushNotifications/PushStore.js";
import { PushMutationConcurrencyCoordinator } from "../Source/Network/PushMutationConcurrencyCoordinator.js";
import { PushTestRouteOwner } from "../Source/Network/Routes/PushTestRouteOwner.js";

interface Deferred<ValueType> {
  promise: Promise<ValueType>;
  resolve: (value: ValueType) => void;
  reject: (error: Error) => void;
}

function createDeferred<ValueType>(): Deferred<ValueType> {
  let resolvePromise: ((value: ValueType) => void) | null = null;
  let rejectPromise: ((error: Error) => void) | null = null;
  const promise = new Promise<ValueType>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = (error: Error) => {
      reject(error);
    };
  });
  if (!resolvePromise || !rejectPromise) {
    throw new Error("Deferred promise callbacks were not initialized");
  }
  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
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
  const createdAt = new Date().toISOString();
  return {
    notificationId: `notif_${privateMode ? "private" : "detailed"}`,
    title: privateMode ? "Private title" : "Detailed title",
    body: "Push body",
    threadId,
    turnId,
    url: `/threads/${threadId}`,
    createdAt,
  };
}

describe("PushTestRouteOwner", () => {
  it("dispatches private and detailed payloads in parallel and aggregates results", async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "push-test-route-owner-"));
    try {
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      await pushStore.upsertSubscription(
        {
          endpoint: "https://push.example.test/private",
          keys: {
            p256dh: "PrivateP256DhKey",
            auth: "PrivateAuthKey",
          },
        },
        {
          privateMode: true,
        },
      );
      await pushStore.upsertSubscription(
        {
          endpoint: "https://push.example.test/detailed",
          keys: {
            p256dh: "DetailedP256DhKey",
            auth: "DetailedAuthKey",
          },
        },
        {
          privateMode: false,
        },
      );

      const pushSendStore = new PushSendStore(
        path.join(temporaryDirectory, "push-send-state.json"),
      );
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();
      const pushService = new PushService({
        enabled: false,
        vapidPublicKey: "",
        vapidPrivateKey: "",
        vapidSubject: "mailto:test@example.com",
      });
      vi.spyOn(pushService, "isEnabled").mockReturnValue(true);

      const privateDeferred = createDeferred<PushSendResult>();
      const detailedDeferred = createDeferred<PushSendResult>();
      const privateDispatchStarted = createDeferred<void>();
      const detailedDispatchStarted = createDeferred<void>();
      let privateDispatchObserved = false;
      let detailedDispatchObserved = false;
      const sendToSubscriptionsSpy = vi
        .spyOn(pushService, "sendToSubscriptions")
        .mockImplementation(async (subscriptions): Promise<PushSendResult> => {
          const firstSubscription = subscriptions[0];
          if (!firstSubscription) {
            throw new Error("Expected at least one subscription for push send");
          }
          if (firstSubscription.settings.privateMode) {
            if (!privateDispatchObserved) {
              privateDispatchObserved = true;
              privateDispatchStarted.resolve();
            }
            return privateDeferred.promise;
          }
          if (!detailedDispatchObserved) {
            detailedDispatchObserved = true;
            detailedDispatchStarted.resolve();
          }
          return detailedDeferred.promise;
        });

      const jsonResponse =
        vi.fn<(response: ServerResponse, statusCode: number, body: object) => void>();
      const timeoutLabels: string[] = [];

      const owner = new PushTestRouteOwner({
        pushService,
        pushStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushTestBodySchema: FarfieldPushTestBodySchema,
        readJsonBody: async (): Promise<JsonValue> => ({
          threadId: "thread_parallel",
          turnId: "turn_parallel",
          dryRun: false,
        }),
        jsonResponse,
        buildPushTestPayload: (input, privateMode) => {
          return createPushPayload(input.threadId, input.turnId, privateMode);
        },
        pushTestSendTimeoutMs: 250,
        withTimeout: async (promise, _timeoutMs, label) => {
          timeoutLabels.push(label);
          return promise;
        },
      });

      const { request, response } = createRequestResponsePair();
      request.method = "POST";
      const handlePromise = owner.handle({
        req: request,
        res: response,
        pathname: "/api/push/test",
      });

      await Promise.all([privateDispatchStarted.promise, detailedDispatchStarted.promise]);
      expect(timeoutLabels).toEqual(["push-test-send:private", "push-test-send:detailed"]);

      const privateDispatchPayload = sendToSubscriptionsSpy.mock.calls[0]?.[1];
      const detailedDispatchPayload = sendToSubscriptionsSpy.mock.calls[1]?.[1];
      if (!privateDispatchPayload || !detailedDispatchPayload) {
        throw new Error("Expected both private and detailed payload dispatch calls");
      }
      expect(privateDispatchPayload.notificationId).toBe(detailedDispatchPayload.notificationId);
      expect(privateDispatchPayload.createdAt).toBe(detailedDispatchPayload.createdAt);

      privateDeferred.resolve({
        attempted: 1,
        delivered: 1,
        failures: [],
        prunedEndpoints: [],
      });
      detailedDeferred.resolve({
        attempted: 1,
        delivered: 1,
        failures: [],
        prunedEndpoints: [],
      });

      await expect(handlePromise).resolves.toBe(true);
      expect(jsonResponse).toHaveBeenCalledTimes(1);
      const responseCall = jsonResponse.mock.calls[0];
      if (!responseCall) {
        throw new Error("Expected push test route to emit a json response call");
      }
      expect(responseCall[0]).toBe(response);
      expect(responseCall[1]).toBe(200);
      const parsedResponse = FarfieldPushTestEnvelopeSchema.parse(responseCall[2]);
      expect(parsedResponse).toEqual({
        ok: true,
        dryRun: false,
        notificationId: privateDispatchPayload.notificationId,
        ready: true,
        reason: "Push notification attempted",
        attempted: 2,
        delivered: 2,
        failures: 0,
      });
    } finally {
      fs.rmSync(temporaryDirectory, {
        recursive: true,
        force: true,
      });
    }
  });

  it("returns a strict readiness response when push notifications are disabled", async () => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "push-test-route-owner-disabled-"),
    );
    try {
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      const pushSendStore = new PushSendStore(
        path.join(temporaryDirectory, "push-send-state.json"),
      );
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();
      const pushService = new PushService({
        enabled: false,
        vapidPublicKey: "",
        vapidPrivateKey: "",
        vapidSubject: "mailto:test@example.com",
      });
      const jsonResponse =
        vi.fn<(response: ServerResponse, statusCode: number, body: object) => void>();

      const owner = new PushTestRouteOwner({
        pushService,
        pushStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushTestBodySchema: FarfieldPushTestBodySchema,
        readJsonBody: async (): Promise<JsonValue> => ({
          threadId: "thread_disabled",
          turnId: "turn_disabled",
          dryRun: true,
        }),
        jsonResponse,
        buildPushTestPayload: (input, privateMode) => {
          return createPushPayload(input.threadId, input.turnId, privateMode);
        },
        pushTestSendTimeoutMs: 250,
        withTimeout: async <ValueType>(
          _promise: Promise<ValueType>,
          _timeoutMs: number,
          _label: string,
        ): Promise<ValueType> => {
          throw new Error("withTimeout should not be called for disabled push responses");
        },
      });

      const { request, response } = createRequestResponsePair();
      request.method = "POST";
      await expect(
        owner.handle({
          req: request,
          res: response,
          pathname: "/api/push/test",
        }),
      ).resolves.toBe(true);

      expect(jsonResponse).toHaveBeenCalledTimes(1);
      const responseCall = jsonResponse.mock.calls[0];
      if (!responseCall) {
        throw new Error("Expected disabled push response call");
      }
      expect(responseCall[0]).toBe(response);
      expect(responseCall[1]).toBe(200);
      const parsedResponse = FarfieldPushTestEnvelopeSchema.parse(responseCall[2]);
      expect(parsedResponse).toEqual({
        ok: true,
        dryRun: true,
        notificationId: null,
        ready: false,
        reason: "Push notifications are disabled",
        attempted: 0,
        delivered: 0,
        failures: 0,
      });
    } finally {
      fs.rmSync(temporaryDirectory, {
        recursive: true,
        force: true,
      });
    }
  });

  it("returns a strict dry-run readiness response when subscriptions exist", async () => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "push-test-route-owner-dry-run-"),
    );
    try {
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      await pushStore.upsertSubscription(
        {
          endpoint: "https://push.example.test/dry-run",
          keys: {
            p256dh: "DryRunP256DhKey",
            auth: "DryRunAuthKey",
          },
        },
        {
          privateMode: true,
        },
      );
      const pushSendStore = new PushSendStore(
        path.join(temporaryDirectory, "push-send-state.json"),
      );
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();
      const pushService = new PushService({
        enabled: false,
        vapidPublicKey: "",
        vapidPrivateKey: "",
        vapidSubject: "mailto:test@example.com",
      });
      vi.spyOn(pushService, "isEnabled").mockReturnValue(true);
      const sendToSubscriptionsSpy = vi.spyOn(pushService, "sendToSubscriptions");
      const jsonResponse =
        vi.fn<(response: ServerResponse, statusCode: number, body: object) => void>();

      const owner = new PushTestRouteOwner({
        pushService,
        pushStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushTestBodySchema: FarfieldPushTestBodySchema,
        readJsonBody: async (): Promise<JsonValue> => ({
          threadId: "thread_dry_run",
          turnId: "turn_dry_run",
          dryRun: true,
        }),
        jsonResponse,
        buildPushTestPayload: (input, privateMode) => {
          return createPushPayload(input.threadId, input.turnId, privateMode);
        },
        pushTestSendTimeoutMs: 250,
        withTimeout: async <ValueType>(
          _promise: Promise<ValueType>,
          _timeoutMs: number,
          _label: string,
        ): Promise<ValueType> => {
          throw new Error("withTimeout should not be called for dry-run push responses");
        },
      });

      const { request, response } = createRequestResponsePair();
      request.method = "POST";
      await expect(
        owner.handle({
          req: request,
          res: response,
          pathname: "/api/push/test",
        }),
      ).resolves.toBe(true);

      expect(sendToSubscriptionsSpy).not.toHaveBeenCalled();
      expect(jsonResponse).toHaveBeenCalledTimes(1);
      const responseCall = jsonResponse.mock.calls[0];
      if (!responseCall) {
        throw new Error("Expected dry-run push response call");
      }
      expect(responseCall[0]).toBe(response);
      expect(responseCall[1]).toBe(200);
      const parsedResponse = FarfieldPushTestEnvelopeSchema.parse(responseCall[2]);
      expect(parsedResponse).toEqual({
        ok: true,
        dryRun: true,
        notificationId: null,
        ready: true,
        reason: "Push notifications are configured and subscriptions are present",
        attempted: 1,
        delivered: 0,
        failures: 0,
      });
    } finally {
      fs.rmSync(temporaryDirectory, {
        recursive: true,
        force: true,
      });
    }
  });

  it("propagates timeout errors from timed push dispatches", async () => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "push-test-route-owner-timeout-"),
    );
    try {
      const pushStore = new PushStore(path.join(temporaryDirectory, "push-state.json"));
      pushStore.load();
      await pushStore.upsertSubscription(
        {
          endpoint: "https://push.example.test/private-only",
          keys: {
            p256dh: "PrivateOnlyP256DhKey",
            auth: "PrivateOnlyAuthKey",
          },
        },
        {
          privateMode: true,
        },
      );
      const pushSendStore = new PushSendStore(
        path.join(temporaryDirectory, "push-send-state.json"),
      );
      pushSendStore.load();
      const pushMutationConcurrencyCoordinator = new PushMutationConcurrencyCoordinator();
      const pushService = new PushService({
        enabled: false,
        vapidPublicKey: "",
        vapidPrivateKey: "",
        vapidSubject: "mailto:test@example.com",
      });
      vi.spyOn(pushService, "isEnabled").mockReturnValue(true);
      vi.spyOn(pushService, "sendToSubscriptions").mockImplementation(
        async (): Promise<PushSendResult> => {
          return new Promise<PushSendResult>(() => {
            // Intentionally unresolved to verify timeout propagation.
          });
        },
      );

      const owner = new PushTestRouteOwner({
        pushService,
        pushStore,
        pushSendStore,
        pushMutationConcurrencyCoordinator,
        pushTestBodySchema: FarfieldPushTestBodySchema,
        readJsonBody: async (): Promise<JsonValue> => ({
          threadId: "thread_timeout",
          turnId: "turn_timeout",
          dryRun: false,
        }),
        jsonResponse: () => {},
        buildPushTestPayload: (input, privateMode) => {
          return createPushPayload(input.threadId, input.turnId, privateMode);
        },
        pushTestSendTimeoutMs: 250,
        withTimeout: async (_promise, timeoutMs, label) => {
          throw new Error(`${label} timed out after ${String(timeoutMs)}ms`);
        },
      });

      const { request, response } = createRequestResponsePair();
      request.method = "POST";
      await expect(
        owner.handle({
          req: request,
          res: response,
          pathname: "/api/push/test",
        }),
      ).rejects.toThrow("push-test-send:private timed out");
    } finally {
      fs.rmSync(temporaryDirectory, {
        recursive: true,
        force: true,
      });
    }
  });
});
