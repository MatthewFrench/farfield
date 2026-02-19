import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/api", () => ({
  deletePushSubscription: vi.fn(),
  getPushStatus: vi.fn(),
  getPushVapidPublicKey: vi.fn(),
  savePushSubscription: vi.fn()
}));

import {
  deletePushSubscription,
  getPushStatus,
  getPushVapidPublicKey,
  savePushSubscription
} from "../src/lib/api";
import { recoverPushNotifications } from "../src/lib/push";

interface PushRecoveryHarness {
  registerMock: ReturnType<typeof vi.fn>;
  getRegistrationsMock: ReturnType<typeof vi.fn>;
  getSubscriptionMock: ReturnType<typeof vi.fn>;
  subscribeMock: ReturnType<typeof vi.fn>;
  unregisterMock: ReturnType<typeof vi.fn>;
  existingSubscriptionUnsubscribeMock: ReturnType<typeof vi.fn>;
  cacheKeysMock: ReturnType<typeof vi.fn>;
  cacheDeleteMock: ReturnType<typeof vi.fn>;
}

function createMockCookieStoreManager(): CookieStoreManager {
  return {
    getSubscriptions: async () => [],
    subscribe: async () => undefined,
    unsubscribe: async () => undefined
  };
}

function createMockNavigationPreloadManager(): NavigationPreloadManager {
  return {
    disable: async () => undefined,
    enable: async () => undefined,
    getState: async () => ({
      enabled: false,
      headerValue: "true"
    }),
    setHeaderValue: async () => undefined
  };
}

function createMockPushSubscription(
  endpoint: string,
  unsubscribeMock: ReturnType<typeof vi.fn>
): PushSubscription {
  return {
    endpoint,
    expirationTime: null,
    options: {
      applicationServerKey: null,
      userVisibleOnly: true
    },
    getKey: () => null,
    toJSON: () => ({
      endpoint,
      expirationTime: null,
      keys: {
        p256dh: "BElidedKeyMaterial_123",
        auth: "CAuthValue_456"
      }
    }),
    unsubscribe: unsubscribeMock
  } as PushSubscription;
}

function installPushRecoveryHarness(options: { waitingWorker: boolean }): PushRecoveryHarness {
  const existingSubscriptionUnsubscribeMock = vi.fn(async () => true);
  const existingSubscription = createMockPushSubscription(
    "https://push.example.test/subscriptions/existing",
    existingSubscriptionUnsubscribeMock
  );
  const newSubscription = createMockPushSubscription(
    "https://push.example.test/subscriptions/new",
    vi.fn(async () => true)
  );

  const getSubscriptionMock = vi
    .fn<() => Promise<PushSubscription | null>>()
    .mockResolvedValueOnce(existingSubscription)
    .mockResolvedValueOnce(null)
    .mockResolvedValue(null);
  const subscribeMock = vi.fn(async () => newSubscription);
  const unregisterMock = vi.fn(async () => true);
  const cacheKeysMock = vi.fn(async () => ["farfield-v1", "runtime-v1"]);
  const cacheDeleteMock = vi.fn(async () => true);

  const serviceWorkerContainerEvents = new EventTarget();
  const registrationEvents = new EventTarget();
  const waitingWorker = options.waitingWorker
    ? ({
        postMessage: (
          message: { type?: string; token?: string | null },
          transfer?: Array<MessagePort>
        ) => {
          if (message.type === "SET_API_TOKEN") {
            const ackPort = transfer && transfer[0] ? transfer[0] : null;
            ackPort?.postMessage({ type: "SET_API_TOKEN_ACK" });
            return;
          }
          if (message.type === "SKIP_WAITING") {
            serviceWorkerContainerEvents.dispatchEvent(new Event("controllerchange"));
          }
        }
      } as ServiceWorker)
    : null;

  const pushManager: PushManager = {
    getSubscription: getSubscriptionMock,
    subscribe: subscribeMock,
    permissionState: async () => "granted"
  };

  let registration: ServiceWorkerRegistration;
  registration = {
    active: null,
    cookies: createMockCookieStoreManager(),
    installing: null,
    navigationPreload: createMockNavigationPreloadManager(),
    onupdatefound: null,
    pushManager,
    scope: "https://example.test/",
    updateViaCache: "none",
    waiting: waitingWorker,
    getNotifications: async () => [],
    showNotification: async () => undefined,
    unregister: unregisterMock,
    update: async () => registration,
    addEventListener: registrationEvents.addEventListener.bind(registrationEvents),
    removeEventListener: registrationEvents.removeEventListener.bind(registrationEvents),
    dispatchEvent: registrationEvents.dispatchEvent.bind(registrationEvents)
  };

  const registerMock = vi.fn(async () => registration);
  const getRegistrationsMock = vi.fn(async () => [registration]);
  const serviceWorkerContainer: ServiceWorkerContainer = {
    controller: null,
    oncontrollerchange: null,
    onmessage: null,
    onmessageerror: null,
    register: registerMock,
    ready: Promise.resolve(registration),
    getRegistration: async () => registration,
    getRegistrations: getRegistrationsMock,
    startMessages: () => undefined,
    addEventListener: serviceWorkerContainerEvents.addEventListener.bind(serviceWorkerContainerEvents),
    removeEventListener: serviceWorkerContainerEvents.removeEventListener.bind(serviceWorkerContainerEvents),
    dispatchEvent: serviceWorkerContainerEvents.dispatchEvent.bind(serviceWorkerContainerEvents)
  };

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorkerContainer
  });
  Object.defineProperty(window, "PushManager", {
    configurable: true,
    value: class {}
  });
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: {
      permission: "granted",
      requestPermission: async () => "granted"
    }
  });
  const cacheStorage: CacheStorage = {
    open: async () => {
      throw new Error("Not implemented in push recovery test harness");
    },
    has: async () => false,
    match: async () => undefined,
    delete: cacheDeleteMock,
    keys: cacheKeysMock
  };
  Object.defineProperty(window, "caches", {
    configurable: true,
    value: cacheStorage
  });

  return {
    registerMock,
    getRegistrationsMock,
    getSubscriptionMock,
    subscribeMock,
    unregisterMock,
    existingSubscriptionUnsubscribeMock,
    cacheKeysMock,
    cacheDeleteMock
  };
}

describe("recoverPushNotifications", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getPushStatus).mockResolvedValue({
      ok: true,
      enabled: true,
      permissionRequired: true,
      subscriptionCount: 0,
      privateModeDefault: true
    });
    vi.mocked(getPushVapidPublicKey).mockResolvedValue({
      ok: true,
      publicKey:
        "BPItc9n5cEBFiYtrIgv4iMahikEkQeXwdD4Q9MTDmTrU4Ty-pj1_XqHdL0pF-RQVUKS_k7_C5P_rXX6crzWkL2U"
    });
    vi.mocked(savePushSubscription).mockResolvedValue({
      subscriptionId: "sub_new"
    });
    vi.mocked(deletePushSubscription).mockResolvedValue({
      deleted: true
    });
  });

  it("refreshes waiting worker and re-subscribes in one flow", async () => {
    const harness = installPushRecoveryHarness({ waitingWorker: true });

    const result = await recoverPushNotifications({
      privateMode: false
    });

    expect(result.updatedServiceWorker).toBe(true);
    expect(result.subscribed).toBe(true);
    expect(vi.mocked(deletePushSubscription)).toHaveBeenCalledTimes(1);
    expect(harness.existingSubscriptionUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(harness.getRegistrationsMock).toHaveBeenCalledTimes(1);
    expect(harness.unregisterMock).toHaveBeenCalledTimes(1);
    expect(harness.cacheKeysMock).toHaveBeenCalledTimes(1);
    expect(harness.cacheDeleteMock).toHaveBeenCalledTimes(2);
    expect(harness.cacheDeleteMock).toHaveBeenNthCalledWith(1, "farfield-v1");
    expect(harness.cacheDeleteMock).toHaveBeenNthCalledWith(2, "runtime-v1");
    expect(harness.subscribeMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(savePushSubscription)).toHaveBeenCalledTimes(1);
    const firstSaveCall = vi.mocked(savePushSubscription).mock.calls[0];
    if (!firstSaveCall) {
      throw new Error("Expected savePushSubscription to be called at least once");
    }
    const firstSaveRequest = firstSaveCall[0];
    if (!firstSaveRequest) {
      throw new Error("Expected savePushSubscription to receive a payload");
    }
    const firstSaveSettings = firstSaveRequest.settings;
    if (!firstSaveSettings) {
      throw new Error("Expected savePushSubscription payload to include settings");
    }
    expect(firstSaveSettings.privateMode).toBe(false);
    expect(harness.registerMock).toHaveBeenCalledTimes(3);
    expect((window as { __farfieldSuppressSwReload?: boolean }).__farfieldSuppressSwReload).toBeUndefined();
  });

  it("recovers when no waiting worker is present", async () => {
    const harness = installPushRecoveryHarness({ waitingWorker: false });

    const result = await recoverPushNotifications({
      privateMode: true
    });

    expect(result.updatedServiceWorker).toBe(false);
    expect(result.subscribed).toBe(true);
    expect(harness.subscribeMock).toHaveBeenCalledTimes(1);
    const firstSaveCall = vi.mocked(savePushSubscription).mock.calls[0];
    if (!firstSaveCall) {
      throw new Error("Expected savePushSubscription to be called at least once");
    }
    const firstSaveRequest = firstSaveCall[0];
    if (!firstSaveRequest) {
      throw new Error("Expected savePushSubscription to receive a payload");
    }
    const firstSaveSettings = firstSaveRequest.settings;
    if (!firstSaveSettings) {
      throw new Error("Expected savePushSubscription payload to include settings");
    }
    expect(firstSaveSettings.privateMode).toBe(true);
  });
});
