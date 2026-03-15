import { CreatePushReceiptBodySchema, CreatePushSubscriptionBodySchema } from "@farfield/protocol";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CreatePushSubscriptionEnvelopeSchema,
  HttpRoutesIntegrationEnvironment,
  PushLocalCaStatusEnvelopeSchema,
  PushReceiptCreateEnvelopeSchema,
  PushReceiptLatestEnvelopeSchema,
  PushStatusEnvelopeSchema,
  PushTestEnvelopeSchema,
  VapidPublicKeyEnvelopeSchema,
} from "./HttpRoutesIntegrationEnvironment";

const PushStatusRoutePath = "/api/push/status";
const PushVapidPublicKeyRoutePath = "/api/push/vapid-public-key";
const PushSubscriptionsRoutePath = "/api/push/subscriptions";
const PushTestRoutePath = "/api/push/test";
const PushReceiptsRoutePath = "/api/push/receipts";
const PushLatestReceiptRoutePath = "/api/push/receipts/latest";
const PushLocalCaStatusRoutePath = "/api/push/local-ca";
const PushLocalCaDownloadRoutePath = "/api/push/local-ca/download";
const JsonContentTypeHeaderName = "Content-Type";
const JsonContentTypeHeaderValue = "application/json";
const ReceiptCreatedAtTimestamp = "2026-01-01T00:00:00.000Z";

describe("server route integration push routes", () => {
  const integrationEnvironment = new HttpRoutesIntegrationEnvironment();

  beforeAll(async () => {
    await integrationEnvironment.start();
  }, 30_000);

  afterAll(async () => {
    await integrationEnvironment.stop();
  });

  it("supports push route contracts", async () => {
    const authHeaders = integrationEnvironment.readAuthHeaders();

    const statusResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(PushStatusRoutePath),
      {
        headers: authHeaders,
      },
    );
    expect(statusResponse.status).toBe(200);
    const status = PushStatusEnvelopeSchema.parse(await statusResponse.json());
    expect(status.subscriptionCount).toBe(0);

    const vapidResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(PushVapidPublicKeyRoutePath),
      {
        headers: authHeaders,
      },
    );
    expect(vapidResponse.status).toBe(200);
    const vapid = VapidPublicKeyEnvelopeSchema.parse(await vapidResponse.json());
    expect(vapid.publicKey).toBe(integrationEnvironment.readVapidPublicKey());

    const subscriptionBody = CreatePushSubscriptionBodySchema.parse({
      subscription: {
        endpoint: "https://push.example.test/subscriptions/sub_1",
        keys: {
          p256dh: "BElidedKeyMaterial_123",
          auth: "CAuthValue_456",
        },
      },
      settings: {
        privateMode: true,
      },
    });

    const createSubscriptionResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(PushSubscriptionsRoutePath),
      {
        method: "POST",
        headers: {
          ...authHeaders,
          [JsonContentTypeHeaderName]: JsonContentTypeHeaderValue,
        },
        body: JSON.stringify(subscriptionBody),
      },
    );
    expect(createSubscriptionResponse.status).toBe(200);
    CreatePushSubscriptionEnvelopeSchema.parse(await createSubscriptionResponse.json());

    const statusAfterSubscriptionResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(PushStatusRoutePath),
      {
        headers: authHeaders,
      },
    );
    const statusAfterSubscription = PushStatusEnvelopeSchema.parse(
      await statusAfterSubscriptionResponse.json(),
    );
    expect(statusAfterSubscription.subscriptionCount).toBe(1);

    const pushTestResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(PushTestRoutePath),
      {
        method: "POST",
        headers: {
          ...authHeaders,
          [JsonContentTypeHeaderName]: JsonContentTypeHeaderValue,
        },
        body: JSON.stringify({
          threadId: "thread_integration",
          turnId: "turn_integration",
          dryRun: true,
        }),
      },
    );
    expect(pushTestResponse.status).toBe(200);
    const pushTestPayload = PushTestEnvelopeSchema.parse(await pushTestResponse.json());
    expect(pushTestPayload.ready).toBe(true);
    expect(pushTestPayload.attempted).toBe(1);

    const receiptBody = CreatePushReceiptBodySchema.parse({
      notificationId: "notif_integration",
      event: "shown",
      url: "/threads/thread_integration",
      threadId: "thread_integration",
      turnId: "turn_integration",
      message: "shown",
      createdAt: ReceiptCreatedAtTimestamp,
    });

    const receiptResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(PushReceiptsRoutePath),
      {
        method: "POST",
        headers: {
          ...authHeaders,
          [JsonContentTypeHeaderName]: JsonContentTypeHeaderValue,
        },
        body: JSON.stringify(receiptBody),
      },
    );
    expect(receiptResponse.status).toBe(200);
    PushReceiptCreateEnvelopeSchema.parse(await receiptResponse.json());

    const latestReceiptResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(PushLatestReceiptRoutePath),
      {
        headers: authHeaders,
      },
    );
    expect(latestReceiptResponse.status).toBe(200);
    const latestReceipt = PushReceiptLatestEnvelopeSchema.parse(await latestReceiptResponse.json());
    expect(latestReceipt.count).toBeGreaterThanOrEqual(1);
    expect(latestReceipt.latest?.notificationId).toBe("notif_integration");

    const localCaStatusResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(PushLocalCaStatusRoutePath),
      {
        headers: authHeaders,
      },
    );
    expect(localCaStatusResponse.status).toBe(200);
    const localCaStatus = PushLocalCaStatusEnvelopeSchema.parse(await localCaStatusResponse.json());
    expect(localCaStatus.available).toBe(true);
    expect(localCaStatus.downloadPath).toBe(PushLocalCaDownloadRoutePath);

    const localCaDownloadResponse = await fetch(
      integrationEnvironment.buildApiRouteUrl(PushLocalCaDownloadRoutePath),
      {
        headers: authHeaders,
      },
    );
    expect(localCaDownloadResponse.status).toBe(200);
    const localCaBody = await localCaDownloadResponse.text();
    expect(localCaBody.includes("BEGIN CERTIFICATE")).toBe(true);
  });
});
