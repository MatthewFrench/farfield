import { beforeEach, describe, expect, it, vi } from "vitest";
import webPush from "web-push";
import { type StoredPushSubscription } from "@farfield/protocol";
import { PushService } from "../Source/PushService.js";

vi.mock("web-push", () => {
  return {
    default: {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn()
    }
  };
});

function buildStoredSubscription(endpoint: string): StoredPushSubscription {
  return {
    id: "sub_1",
    subscription: {
      endpoint,
      keys: {
        p256dh: "BElidedKeyMaterial_123",
        auth: "CAuthValue_456"
      }
    },
    settings: {
      privateMode: false
    },
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z"
  };
}

describe("PushService", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(webPush.setVapidDetails).mockReset();
    vi.mocked(webPush.sendNotification).mockReset();
  });

  it("sends declarative web push payload with high-urgency request options", async () => {
    vi.mocked(webPush.sendNotification).mockResolvedValue({
      statusCode: 201,
      body: "",
      headers: {}
    });

    const service = new PushService({
      enabled: true,
      vapidPublicKey:
        "BPItc9n5cEBFiYtrIgv4iMahikEkQeXwdD4Q9MTDmTrU4Ty-pj1_XqHdL0pF-RQVUKS_k7_C5P_rXX6crzWkL2U",
      vapidPrivateKey: "tfyAO9n9LMLXTy7ZaZwfDafDifFhnKz0MLC8nOxDmds",
      vapidSubject: "mailto:test@example.com"
    });

    const result = await service.sendToSubscriptions(
      [buildStoredSubscription("https://push.example.test/subscriptions/sub_123")],
      {
        notificationId: "notif_1",
        title: "Codex response ready",
        body: "A response is ready in Farfield.",
        threadId: "thread_1",
        turnId: "turn_1",
        url: "/threads/thread_1",
        createdAt: "2026-02-18T00:00:00.000Z",
        web_push: {
          notification: {
            title: "Codex response ready",
            body: "A response is ready in Farfield.",
            navigate: "/threads/thread_1",
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            tag: "thread:thread_1"
          }
        }
      }
    );

    expect(result.attempted).toBe(1);
    expect(result.delivered).toBe(1);
    expect(vi.mocked(webPush.sendNotification)).toHaveBeenCalledTimes(1);

    const firstCall = vi.mocked(webPush.sendNotification).mock.calls[0];
    expect(firstCall?.[1]).toContain("\"web_push\"");
    expect(firstCall?.[1]).toContain("\"notificationId\":\"notif_1\"");
    expect(firstCall?.[1]).toContain("\"navigate\":\"/threads/thread_1\"");
    expect(firstCall?.[2]).toEqual({
      TTL: 300,
      urgency: "high"
    });
  });

  it("marks gone subscriptions for pruning", async () => {
    vi.mocked(webPush.sendNotification).mockRejectedValue({
      statusCode: 410,
      message: "Gone"
    });

    const endpoint = "https://push.example.test/subscriptions/sub_410";
    const service = new PushService({
      enabled: true,
      vapidPublicKey:
        "BPItc9n5cEBFiYtrIgv4iMahikEkQeXwdD4Q9MTDmTrU4Ty-pj1_XqHdL0pF-RQVUKS_k7_C5P_rXX6crzWkL2U",
      vapidPrivateKey: "tfyAO9n9LMLXTy7ZaZwfDafDifFhnKz0MLC8nOxDmds",
      vapidSubject: "mailto:test@example.com"
    });

    const result = await service.sendToSubscriptions(
      [buildStoredSubscription(endpoint)],
      {
        notificationId: "notif_2",
        title: "Codex response ready",
        body: "A response is ready in Farfield.",
        threadId: "thread_1",
        turnId: "turn_1",
        url: "/threads/thread_1",
        createdAt: "2026-02-18T00:00:00.000Z"
      }
    );

    expect(result.attempted).toBe(1);
    expect(result.delivered).toBe(0);
    expect(result.failures.length).toBe(1);
    expect(result.prunedEndpoints).toEqual([endpoint]);
    expect(vi.mocked(webPush.sendNotification)).toHaveBeenCalledTimes(1);
  });

  it("retries transient push failures and succeeds", async () => {
    vi.useFakeTimers();
    vi.mocked(webPush.sendNotification)
      .mockRejectedValueOnce({
        statusCode: 503,
        message: "Service unavailable"
      })
      .mockRejectedValueOnce({
        statusCode: 503,
        message: "Service unavailable"
      })
      .mockResolvedValueOnce({
        statusCode: 201,
        body: "",
        headers: {}
      });

    const service = new PushService({
      enabled: true,
      vapidPublicKey:
        "BPItc9n5cEBFiYtrIgv4iMahikEkQeXwdD4Q9MTDmTrU4Ty-pj1_XqHdL0pF-RQVUKS_k7_C5P_rXX6crzWkL2U",
      vapidPrivateKey: "tfyAO9n9LMLXTy7ZaZwfDafDifFhnKz0MLC8nOxDmds",
      vapidSubject: "mailto:test@example.com"
    });

    const resultPromise = service.sendToSubscriptions(
      [buildStoredSubscription("https://push.example.test/subscriptions/sub_retry")],
      {
        notificationId: "notif_3",
        title: "Codex response ready",
        body: "A response is ready in Farfield.",
        threadId: "thread_1",
        turnId: "turn_1",
        url: "/threads/thread_1",
        createdAt: "2026-02-18T00:00:00.000Z"
      }
    );

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.attempted).toBe(1);
    expect(result.delivered).toBe(1);
    expect(result.failures).toEqual([]);
    expect(vi.mocked(webPush.sendNotification)).toHaveBeenCalledTimes(3);
  });

  it("retries transient failures then reports failure when retries are exhausted", async () => {
    vi.useFakeTimers();
    vi.mocked(webPush.sendNotification)
      .mockRejectedValueOnce({
        statusCode: 503,
        message: "Service unavailable"
      })
      .mockRejectedValueOnce({
        statusCode: 503,
        message: "Service unavailable"
      })
      .mockRejectedValueOnce({
        statusCode: 503,
        message: "Service unavailable"
      });

    const endpoint = "https://push.example.test/subscriptions/sub_retry_fail";
    const service = new PushService({
      enabled: true,
      vapidPublicKey:
        "BPItc9n5cEBFiYtrIgv4iMahikEkQeXwdD4Q9MTDmTrU4Ty-pj1_XqHdL0pF-RQVUKS_k7_C5P_rXX6crzWkL2U",
      vapidPrivateKey: "tfyAO9n9LMLXTy7ZaZwfDafDifFhnKz0MLC8nOxDmds",
      vapidSubject: "mailto:test@example.com"
    });

    const resultPromise = service.sendToSubscriptions(
      [buildStoredSubscription(endpoint)],
      {
        notificationId: "notif_4",
        title: "Codex response ready",
        body: "A response is ready in Farfield.",
        threadId: "thread_1",
        turnId: "turn_1",
        url: "/threads/thread_1",
        createdAt: "2026-02-18T00:00:00.000Z"
      }
    );

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.attempted).toBe(1);
    expect(result.delivered).toBe(0);
    expect(result.failures.length).toBe(1);
    expect(result.failures[0]?.statusCode).toBe(503);
    expect(result.prunedEndpoints).toEqual([]);
    expect(vi.mocked(webPush.sendNotification)).toHaveBeenCalledTimes(3);
  });
});
