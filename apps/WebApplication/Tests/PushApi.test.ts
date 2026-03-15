import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deletePushSubscription,
  getLatestPushReceipt,
  getLatestPushSend,
  getPushLocalCaStatus,
  getPushStatus,
  getPushVapidPublicKey,
  savePushSubscription,
  sendPushTestNotification,
} from "@/Features/PushNotifications/DataAccess/PushApi";
import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";

function createJsonResponse(body: StructuredDataValue): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PushApi", () => {
  it("normalizes push status responses by removing transport envelope fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        enabled: true,
        permissionRequired: true,
        subscriptionCount: 3,
        privateModeDefault: false,
      }),
    );

    const pushStatusResponse = await getPushStatus();

    expect(pushStatusResponse).toEqual({
      enabled: true,
      permissionRequired: true,
      subscriptionCount: 3,
      privateModeDefault: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes push VAPID public key responses by removing transport envelope fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        publicKey:
          "BPItc9n5cEBFiYtrIgv4iMahikEkQeXwdD4Q9MTDmTrU4Ty-pj1_XqHdL0pF-RQVUKS_k7_C5P_rXX6crzWkL2U",
      }),
    );

    const pushVapidPublicKeyResponse = await getPushVapidPublicKey();

    expect(pushVapidPublicKeyResponse).toEqual({
      publicKey:
        "BPItc9n5cEBFiYtrIgv4iMahikEkQeXwdD4Q9MTDmTrU4Ty-pj1_XqHdL0pF-RQVUKS_k7_C5P_rXX6crzWkL2U",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects push status responses when envelope fields fail schema validation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        enabled: true,
        permissionRequired: true,
        subscriptionCount: -1,
        privateModeDefault: false,
      }),
    );

    await expect(getPushStatus()).rejects.toThrowError();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("requests latest push receipt, send, and local certificate authority status from push routes", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        createJsonResponse({
          ok: true,
          latest: null,
          count: 0,
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          ok: true,
          latest: null,
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          ok: true,
          available: true,
          downloadPath: null,
        }),
      );

    const latestPushReceipt = await getLatestPushReceipt();
    const latestPushSend = await getLatestPushSend();
    const pushLocalCertificateAuthorityStatus = await getPushLocalCaStatus();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toBe("/api/push/receipts/latest");
    expect(String(fetchMock.mock.calls[1]?.[0] ?? "")).toBe("/api/push/sends/latest");
    expect(String(fetchMock.mock.calls[2]?.[0] ?? "")).toBe("/api/push/local-ca");
    expect(latestPushReceipt).toEqual({
      latest: null,
      count: 0,
    });
    expect(latestPushSend).toEqual({
      latest: null,
    });
    expect(pushLocalCertificateAuthorityStatus).toEqual({
      available: true,
      downloadPath: null,
    });
  });

  it("posts push-subscription creation requests with JSON payloads to the subscriptions route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        subscriptionId: "subscription_1",
      }),
    );

    const response = await savePushSubscription({
      subscription: {
        endpoint: "https://push.example.test/subscriptions/current",
        keys: {
          p256dh: "P256DH_123",
          auth: "AUTH_123",
        },
      },
      settings: {
        privateMode: true,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toBe("/api/push/subscriptions");
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestInit?.method).toBe("POST");
    expect(new Headers(requestInit?.headers).get("Content-Type")).toBe("application/json");
    expect(String(requestInit?.body)).toBe(
      JSON.stringify({
        subscription: {
          endpoint: "https://push.example.test/subscriptions/current",
          keys: {
            p256dh: "P256DH_123",
            auth: "AUTH_123",
          },
        },
        settings: {
          privateMode: true,
        },
      }),
    );
    expect(response).toEqual({
      subscriptionId: "subscription_1",
    });
  });

  it("posts push-subscription deletion requests with JSON payloads to the subscriptions route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        deleted: true,
      }),
    );

    const response = await deletePushSubscription({
      endpoint: "https://push.example.test/subscriptions/current",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toBe("/api/push/subscriptions");
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestInit?.method).toBe("DELETE");
    expect(new Headers(requestInit?.headers).get("Content-Type")).toBe("application/json");
    expect(String(requestInit?.body)).toBe(
      JSON.stringify({
        endpoint: "https://push.example.test/subscriptions/current",
      }),
    );
    expect(response).toEqual({
      deleted: true,
    });
  });

  it("posts push-test notification requests with JSON payloads to the push-test route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        dryRun: true,
        notificationId: null,
        ready: true,
        reason: "push test accepted",
        attempted: 1,
        delivered: 1,
        failures: 0,
      }),
    );

    const response = await sendPushTestNotification({
      threadId: "thread-1",
      turnId: "turn-1",
      title: "",
      body: "hello from test",
      dryRun: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toBe("/api/push/test");
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestInit?.method).toBe("POST");
    expect(new Headers(requestInit?.headers).get("Content-Type")).toBe("application/json");
    expect(String(requestInit?.body)).toBe(
      JSON.stringify({
        threadId: "thread-1",
        turnId: "turn-1",
        title: "",
        body: "hello from test",
        dryRun: true,
      }),
    );
    expect(response).toEqual({
      dryRun: true,
      notificationId: null,
      ready: true,
      reason: "push test accepted",
      attempted: 1,
      delivered: 1,
      failures: 0,
    });
  });

  it("rejects push-test payloads with blank thread identifiers before issuing a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      sendPushTestNotification({
        threadId: "   ",
        turnId: "turn-1",
      }),
    ).rejects.toThrowError();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects push-test payloads with blank turn identifiers before issuing a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      sendPushTestNotification({
        threadId: "thread-1",
        turnId: "   ",
      }),
    ).rejects.toThrowError();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
