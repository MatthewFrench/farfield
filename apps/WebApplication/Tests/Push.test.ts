import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("../Source/Features/PushNotifications/DataAccess/PushApi", () => ({
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
} from "../Source/Features/PushNotifications/DataAccess/PushApi";
import { PushPreferenceStore } from "../Source/Features/PushNotifications/DataAccess/PushPreferenceStore";
import { disablePushNotifications, recoverPushNotifications } from "../Source/Features/PushNotifications/DataAccess/PushClientApi";

const SERVICE_WORKER_SKIP_WAITING_MESSAGE_TYPE = "SKIP_WAITING";
const SERVICE_WORKER_CONTROLLER_CHANGE_EVENT_NAME = "controllerchange";
const CONTROLLER_CHANGE_WAIT_TIMEOUT_MILLISECONDS = 2_000;

interface PushRecoveryHarness {
  registerMock: Mock<() => Promise<ServiceWorkerRegistration>>;
  getRegistrationsMock: Mock<() => Promise<Array<ServiceWorkerRegistration>>>;
  getSubscriptionMock: Mock<() => Promise<PushSubscription | null>>;
  subscribeMock: Mock<() => Promise<PushSubscription>>;
  unregisterMock: Mock<() => Promise<boolean>>;
  existingSubscriptionUnsubscribeMock: Mock<() => Promise<boolean>>;
  cacheKeysMock: Mock<() => Promise<Array<string>>>;
  cacheDeleteMock: Mock<(cacheName: string) => Promise<boolean>>;
}

interface InstallPushRecoveryHarnessInput {
  waitingWorker: boolean;
  emitControllerChangeOnSkipWaiting?: boolean;
}

function installLocalStorageMock(): void {
  const storageEntries = new Map<string, string>();
  const localStorageMock: Storage = {
    get length() {
      return storageEntries.size;
    },
    clear(): void {
      storageEntries.clear();
    },
    getItem(key: string): string | null {
      const value = storageEntries.get(key);
      return value === undefined ? null : value;
    },
    key(index: number): string | null {
      return Array.from(storageEntries.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      storageEntries.delete(key);
    },
    setItem(key: string, value: string): void {
      storageEntries.set(key, value);
    }
  };

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: localStorageMock
  });
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
  unsubscribeMock: Mock<() => Promise<boolean>>
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

function installPushRecoveryHarness(options: InstallPushRecoveryHarnessInput): PushRecoveryHarness {
  const emitControllerChangeOnSkipWaiting = options.emitControllerChangeOnSkipWaiting ?? true;
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
        postMessage: (message: { type?: string }) => {
          if (
            message.type === SERVICE_WORKER_SKIP_WAITING_MESSAGE_TYPE &&
            emitControllerChangeOnSkipWaiting
          ) {
            serviceWorkerContainerEvents.dispatchEvent(
              new Event(SERVICE_WORKER_CONTROLLER_CHANGE_EVENT_NAME)
            );
          }
        }
      } as ServiceWorker)
    : null;

  const pushManager: PushManager = {
    getSubscription: getSubscriptionMock,
    subscribe: subscribeMock,
    permissionState: async () => "granted"
  };

  const registration: ServiceWorkerRegistration = {
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
    installLocalStorageMock();
    vi.mocked(getPushStatus).mockResolvedValue({
      enabled: true,
      permissionRequired: true,
      subscriptionCount: 0,
      privateModeDefault: true
    });
    vi.mocked(getPushVapidPublicKey).mockResolvedValue({
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

  it("completes recovery if controllerchange is never emitted", async () => {
    vi.useFakeTimers();
    try {
      const harness = installPushRecoveryHarness({
        waitingWorker: true,
        emitControllerChangeOnSkipWaiting: false
      });

      const recoveryPromise = recoverPushNotifications({
        privateMode: true
      });
      await vi.advanceTimersByTimeAsync(CONTROLLER_CHANGE_WAIT_TIMEOUT_MILLISECONDS);
      const result = await recoveryPromise;

      expect(result.updatedServiceWorker).toBe(true);
      expect(result.subscribed).toBe(true);
      expect(harness.subscribeMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
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

describe("disablePushNotifications", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installLocalStorageMock();
    vi.mocked(deletePushSubscription).mockResolvedValue({
      deleted: true
    });
  });

  it("unsubscribes browser even when server deletion fails", async () => {
    const harness = installPushRecoveryHarness({ waitingWorker: false });
    const pushPreferenceStore = new PushPreferenceStore();
    pushPreferenceStore.writeAutoHealPreferenceEnabled(true);
    vi.mocked(deletePushSubscription).mockRejectedValue(new Error("server request failed"));

    const result = await disablePushNotifications();

    expect(result.unsubscribed).toBe(true);
    expect(pushPreferenceStore.readAutoHealPreferenceEnabled()).toBe(false);
    expect(harness.existingSubscriptionUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deletePushSubscription)).toHaveBeenCalledTimes(1);
  });

  it("disables auto-heal preference even when browser unsubscribe and server deletion both fail", async () => {
    const harness = installPushRecoveryHarness({ waitingWorker: false });
    const pushPreferenceStore = new PushPreferenceStore();
    pushPreferenceStore.writeAutoHealPreferenceEnabled(true);
    harness.existingSubscriptionUnsubscribeMock.mockRejectedValue(new Error("unsubscribe failed"));
    vi.mocked(deletePushSubscription).mockRejectedValue(new Error("server request failed"));

    await expect(disablePushNotifications()).rejects.toThrowError(
      "Failed to disable push notifications"
    );
    expect(pushPreferenceStore.readAutoHealPreferenceEnabled()).toBe(false);
    expect(harness.existingSubscriptionUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deletePushSubscription)).toHaveBeenCalledTimes(1);
  });
});
