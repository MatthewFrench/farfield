import {
  CreatePushReceiptBodySchema,
  CreatePushSubscriptionBodySchema
} from "@farfield/protocol";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it
} from "vitest";
import {
  CreatePushSubscriptionEnvelopeSchema,
  HttpRoutesIntegrationEnvironment,
  PushLocalCaStatusEnvelopeSchema,
  PushReceiptCreateEnvelopeSchema,
  PushReceiptLatestEnvelopeSchema,
  PushStatusEnvelopeSchema,
  PushTestEnvelopeSchema,
  VapidPublicKeyEnvelopeSchema
} from "./HttpRoutesIntegrationEnvironment";

describe("server route integration push routes", () => {
  const integrationEnvironment = new HttpRoutesIntegrationEnvironment();

  beforeAll(async () => {
    await integrationEnvironment.start();
  }, 30_000);

  afterAll(async () => {
    await integrationEnvironment.stop();
  });

  it("supports push route contracts", async () => {
    const baseUrl = integrationEnvironment.readBaseUrl();
    const apiToken = integrationEnvironment.readApiToken();
    const authHeaders = integrationEnvironment.readAuthHeaders();

    const statusResponse = await fetch(`${baseUrl}/api/push/status`, {
      headers: authHeaders
    });
    expect(statusResponse.status).toBe(200);
    const status = PushStatusEnvelopeSchema.parse(await statusResponse.json());
    expect(status.subscriptionCount).toBe(0);

    const vapidResponse = await fetch(`${baseUrl}/api/push/vapid-public-key`, {
      headers: authHeaders
    });
    expect(vapidResponse.status).toBe(200);
    const vapid = VapidPublicKeyEnvelopeSchema.parse(await vapidResponse.json());
    expect(vapid.publicKey).toBe(integrationEnvironment.readVapidPublicKey());

    const subscriptionBody = CreatePushSubscriptionBodySchema.parse({
      subscription: {
        endpoint: "https://push.example.test/subscriptions/sub_1",
        keys: {
          p256dh: "BElidedKeyMaterial_123",
          auth: "CAuthValue_456"
        }
      },
      settings: {
        privateMode: true
      }
    });

    const createSubscriptionResponse = await fetch(`${baseUrl}/api/push/subscriptions`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(subscriptionBody)
    });
    expect(createSubscriptionResponse.status).toBe(200);
    CreatePushSubscriptionEnvelopeSchema.parse(await createSubscriptionResponse.json());

    const statusAfterSubscriptionResponse = await fetch(`${baseUrl}/api/push/status`, {
      headers: authHeaders
    });
    const statusAfterSubscription = PushStatusEnvelopeSchema.parse(
      await statusAfterSubscriptionResponse.json()
    );
    expect(statusAfterSubscription.subscriptionCount).toBe(1);

    const pushTestResponse = await fetch(`${baseUrl}/api/push/test`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        threadId: "thread_integration",
        turnId: "turn_integration",
        dryRun: true
      })
    });
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
      createdAt: new Date().toISOString()
    });

    const receiptResponse = await fetch(`${baseUrl}/api/push/receipts`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(receiptBody)
    });
    expect(receiptResponse.status).toBe(200);
    PushReceiptCreateEnvelopeSchema.parse(await receiptResponse.json());

    const latestReceiptResponse = await fetch(`${baseUrl}/api/push/receipts/latest`, {
      headers: authHeaders
    });
    expect(latestReceiptResponse.status).toBe(200);
    const latestReceipt = PushReceiptLatestEnvelopeSchema.parse(await latestReceiptResponse.json());
    expect(latestReceipt.count).toBeGreaterThanOrEqual(1);
    expect(latestReceipt.latest?.notificationId).toBe("notif_integration");

    const localCaStatusResponse = await fetch(`${baseUrl}/api/push/local-ca`, {
      headers: authHeaders
    });
    expect(localCaStatusResponse.status).toBe(200);
    const localCaStatus = PushLocalCaStatusEnvelopeSchema.parse(await localCaStatusResponse.json());
    expect(localCaStatus.available).toBe(true);
    expect(localCaStatus.downloadPath).toBe("/api/push/local-ca/download");

    const localCaDownloadResponse = await fetch(`${baseUrl}/api/push/local-ca/download`, {
      headers: {
        "X-Farfield-Token": apiToken
      }
    });
    expect(localCaDownloadResponse.status).toBe(200);
    const localCaBody = await localCaDownloadResponse.text();
    expect(localCaBody.includes("BEGIN CERTIFICATE")).toBe(true);
  });
});
