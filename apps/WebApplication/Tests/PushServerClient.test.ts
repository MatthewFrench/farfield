import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../Source/Features/PushNotifications/DataAccess/PushApi", () => ({
  deletePushSubscription: vi.fn(),
  getLatestPushReceipt: vi.fn(),
  getLatestPushSend: vi.fn(),
  getPushLocalCaStatus: vi.fn(),
  getPushStatus: vi.fn(),
  getPushVapidPublicKey: vi.fn(),
  savePushSubscription: vi.fn(),
  sendPushTestNotification: vi.fn(),
}));

import {
  deletePushSubscription,
  getLatestPushReceipt,
  getLatestPushSend,
  getPushLocalCaStatus,
  getPushStatus,
  getPushVapidPublicKey,
  savePushSubscription,
  sendPushTestNotification,
} from "../Source/Features/PushNotifications/DataAccess/PushApi";
import { PushServerClient } from "../Source/Features/PushNotifications/DataAccess/PushServerClient";

const PUSH_STATUS_RESPONSE = {
  enabled: true,
  permissionRequired: true,
  subscriptionCount: 2,
  privateModeDefault: false,
};

const PUSH_VAPID_PUBLIC_KEY_RESPONSE = {
  publicKey:
    "BPItc9n5cEBFiYtrIgv4iMahikEkQeXwdD4Q9MTDmTrU4Ty-pj1_XqHdL0pF-RQVUKS_k7_C5P_rXX6crzWkL2U",
};

const PUSH_RECEIPT_LATEST_RESPONSE = {
  latest: null,
  count: 0,
};

const PUSH_SEND_LATEST_RESPONSE = {
  latest: null,
};

const PUSH_LOCAL_CERTIFICATE_AUTHORITY_STATUS_RESPONSE = {
  available: true,
  downloadPath: null,
};

const PUSH_CREATE_SUBSCRIPTION_RESPONSE = {
  subscriptionId: "subscription-1",
};

const PUSH_DELETE_SUBSCRIPTION_RESPONSE = {
  deleted: true,
};

const PUSH_TEST_RESPONSE = {
  dryRun: true,
  notificationId: null,
  ready: true,
  reason: "push test accepted",
  attempted: 1,
  delivered: 0,
  failures: 0,
};

describe("PushServerClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getPushStatus).mockResolvedValue(PUSH_STATUS_RESPONSE);
    vi.mocked(getPushVapidPublicKey).mockResolvedValue(PUSH_VAPID_PUBLIC_KEY_RESPONSE);
    vi.mocked(getLatestPushReceipt).mockResolvedValue(PUSH_RECEIPT_LATEST_RESPONSE);
    vi.mocked(getLatestPushSend).mockResolvedValue(PUSH_SEND_LATEST_RESPONSE);
    vi.mocked(getPushLocalCaStatus).mockResolvedValue(
      PUSH_LOCAL_CERTIFICATE_AUTHORITY_STATUS_RESPONSE,
    );
    vi.mocked(savePushSubscription).mockResolvedValue(PUSH_CREATE_SUBSCRIPTION_RESPONSE);
    vi.mocked(deletePushSubscription).mockResolvedValue(PUSH_DELETE_SUBSCRIPTION_RESPONSE);
    vi.mocked(sendPushTestNotification).mockResolvedValue(PUSH_TEST_RESPONSE);
  });

  it("delegates push reads and mutations to PushApi", async () => {
    const pushServerClient = new PushServerClient();
    const readOptions = {
      actionId: "action-push-read",
      actionName: "push-read",
    };
    const saveOptions = {
      actionId: "action-push-save",
      actionName: "push-save",
    };
    const deleteOptions = {
      actionId: "action-push-delete",
      actionName: "push-delete",
    };
    const testOptions = {
      actionId: "action-push-test",
      actionName: "push-test",
    };
    const createPushSubscriptionInput = {
      subscription: {
        endpoint: "https://example.com/push/subscription",
        keys: {
          p256dh: "abc123",
          auth: "def456",
        },
      },
      settings: {
        privateMode: true,
      },
    };
    const deletePushSubscriptionInput = {
      endpoint: "https://example.com/push/subscription",
    };
    const pushTestNotificationInput = {
      threadId: "thread-1",
      turnId: "turn-1",
      dryRun: true,
    };

    const pushStatusResponse = await pushServerClient.readPushStatus(readOptions);
    const vapidPublicKeyResponse = await pushServerClient.readPushVapidPublicKey(readOptions);
    const latestPushReceiptResponse = await pushServerClient.readLatestPushReceipt(readOptions);
    const latestPushSendResponse = await pushServerClient.readLatestPushSend(readOptions);
    const pushLocalCertificateAuthorityStatusResponse =
      await pushServerClient.readPushLocalCertificateAuthorityStatus(readOptions);
    const createPushSubscriptionResponse = await pushServerClient.savePushSubscription(
      createPushSubscriptionInput,
      saveOptions,
    );
    const deletePushSubscriptionResponse = await pushServerClient.deletePushSubscription(
      deletePushSubscriptionInput,
      deleteOptions,
    );
    const pushTestResponse = await pushServerClient.sendPushTestNotification(
      pushTestNotificationInput,
      testOptions,
    );

    expect(getPushStatus).toHaveBeenCalledWith(readOptions);
    expect(getPushVapidPublicKey).toHaveBeenCalledWith(readOptions);
    expect(getLatestPushReceipt).toHaveBeenCalledWith(readOptions);
    expect(getLatestPushSend).toHaveBeenCalledWith(readOptions);
    expect(getPushLocalCaStatus).toHaveBeenCalledWith(readOptions);
    expect(savePushSubscription).toHaveBeenCalledWith(createPushSubscriptionInput, saveOptions);
    expect(deletePushSubscription).toHaveBeenCalledWith(deletePushSubscriptionInput, deleteOptions);
    expect(sendPushTestNotification).toHaveBeenCalledWith(pushTestNotificationInput, testOptions);
    expect(pushStatusResponse).toEqual(PUSH_STATUS_RESPONSE);
    expect(vapidPublicKeyResponse).toEqual(PUSH_VAPID_PUBLIC_KEY_RESPONSE);
    expect(latestPushReceiptResponse).toEqual(PUSH_RECEIPT_LATEST_RESPONSE);
    expect(latestPushSendResponse).toEqual(PUSH_SEND_LATEST_RESPONSE);
    expect(pushLocalCertificateAuthorityStatusResponse).toEqual(
      PUSH_LOCAL_CERTIFICATE_AUTHORITY_STATUS_RESPONSE,
    );
    expect(createPushSubscriptionResponse).toEqual(PUSH_CREATE_SUBSCRIPTION_RESPONSE);
    expect(deletePushSubscriptionResponse).toEqual(PUSH_DELETE_SUBSCRIPTION_RESPONSE);
    expect(pushTestResponse).toEqual(PUSH_TEST_RESPONSE);
  });
});
