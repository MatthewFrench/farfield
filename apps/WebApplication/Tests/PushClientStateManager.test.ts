import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { PushClientStateManager } from "@/Features/PushNotifications/DataAccess/PushClientStateManager";
import { PushPreferenceStore } from "@/Features/PushNotifications/DataAccess/PushPreferenceStore";
import {
  type PushCreateSubscriptionInput,
  type PushCreateSubscriptionResponse,
  type PushStatusResponse,
  type PushVapidPublicKeyResponse,
  PushServerClient
} from "@/Features/PushNotifications/DataAccess/PushServerClient";

const PUSH_SERVICE_WORKER_PATH = "/sw.js";
const PUSH_SUBSCRIPTION_ENDPOINT = "https://push.example.test/subscriptions/current";
const PUSH_SUBSCRIPTION_KEY_P256DH = "BElidedKeyMaterial_123";
const PUSH_SUBSCRIPTION_KEY_AUTH = "CAuthValue_456";
const PUSH_VAPID_PUBLIC_KEY =
  "BPItc9n5cEBFiYtrIgv4iMahikEkQeXwdD4Q9MTDmTrU4Ty-pj1_XqHdL0pF-RQVUKS_k7_C5P_rXX6crzWkL2U";

const originalServiceWorkerPropertyDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "serviceWorker"
);
const originalPushManagerPropertyDescriptor = Object.getOwnPropertyDescriptor(window, "PushManager");
const originalNotificationPropertyDescriptor = Object.getOwnPropertyDescriptor(window, "Notification");

interface BrowserPushEnvironmentInput {
  permission: NotificationPermission;
  browserSubscription: PushSubscription | null;
}

interface BrowserPushEnvironmentHarness {
  registerMock: Mock<() => Promise<ServiceWorkerRegistration>>;
}

interface TestPushServerClientInput {
  pushStatus: PushStatusResponse;
}

class InMemoryPushPreferenceStore extends PushPreferenceStore {
  private isAutoHealPreferenceEnabled = false;

  public override readAutoHealPreferenceEnabled(): boolean {
    return this.isAutoHealPreferenceEnabled;
  }

  public override writeAutoHealPreferenceEnabled(enabled: boolean): void {
    this.isAutoHealPreferenceEnabled = enabled;
  }
}

class TestPushServerClient extends PushServerClient {
  private readonly pushStatus: PushStatusResponse;
  private readonly pushVapidPublicKey: PushVapidPublicKeyResponse;
  private readonly saveResponse: PushCreateSubscriptionResponse;
  public readonly saveRequests: PushCreateSubscriptionInput[] = [];

  public constructor(input: TestPushServerClientInput) {
    super();
    this.pushStatus = input.pushStatus;
    this.pushVapidPublicKey = {
      publicKey: PUSH_VAPID_PUBLIC_KEY
    };
    this.saveResponse = {
      subscriptionId: "sub_test"
    };
  }

  public override async readPushStatus(): Promise<PushStatusResponse> {
    return this.pushStatus;
  }

  public override async readPushVapidPublicKey(): Promise<PushVapidPublicKeyResponse> {
    return this.pushVapidPublicKey;
  }

  public override async savePushSubscription(
    input: PushCreateSubscriptionInput
  ): Promise<PushCreateSubscriptionResponse> {
    this.saveRequests.push(input);
    return this.saveResponse;
  }
}

function restoreGlobalProperty(
  target: Navigator | Window,
  propertyName: string,
  descriptor: PropertyDescriptor | undefined
): void {
  if (descriptor) {
    Object.defineProperty(target, propertyName, descriptor);
    return;
  }
  Reflect.deleteProperty(target, propertyName);
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

function createPushSubscription(endpoint: string): PushSubscription {
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
        p256dh: PUSH_SUBSCRIPTION_KEY_P256DH,
        auth: PUSH_SUBSCRIPTION_KEY_AUTH
      }
    }),
    unsubscribe: async () => true
  } as PushSubscription;
}

function installBrowserPushEnvironment(input: BrowserPushEnvironmentInput): BrowserPushEnvironmentHarness {
  const pushManager: PushManager = {
    getSubscription: async () => input.browserSubscription,
    subscribe: async () => createPushSubscription(PUSH_SUBSCRIPTION_ENDPOINT),
    permissionState: async () => "granted"
  };
  const serviceWorkerRegistrationEvents = new EventTarget();
  const registration: ServiceWorkerRegistration = {
    active: null,
    cookies: createMockCookieStoreManager(),
    installing: null,
    navigationPreload: createMockNavigationPreloadManager(),
    onupdatefound: null,
    pushManager,
    scope: "https://push.example.test/",
    updateViaCache: "none",
    waiting: null,
    getNotifications: async () => [],
    showNotification: async () => undefined,
    unregister: async () => true,
    update: async () => registration,
    addEventListener: serviceWorkerRegistrationEvents.addEventListener.bind(
      serviceWorkerRegistrationEvents
    ),
    removeEventListener: serviceWorkerRegistrationEvents.removeEventListener.bind(
      serviceWorkerRegistrationEvents
    ),
    dispatchEvent: serviceWorkerRegistrationEvents.dispatchEvent.bind(serviceWorkerRegistrationEvents)
  };
  const registerMock = vi.fn(async () => registration);
  const serviceWorkerContainerEvents = new EventTarget();
  const serviceWorkerContainer: ServiceWorkerContainer = {
    controller: null,
    oncontrollerchange: null,
    onmessage: null,
    onmessageerror: null,
    register: registerMock,
    ready: Promise.resolve(registration),
    getRegistration: async () => registration,
    getRegistrations: async () => [registration],
    startMessages: () => undefined,
    addEventListener: serviceWorkerContainerEvents.addEventListener.bind(serviceWorkerContainerEvents),
    removeEventListener: serviceWorkerContainerEvents.removeEventListener.bind(
      serviceWorkerContainerEvents
    ),
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
      permission: input.permission,
      requestPermission: async () => input.permission
    }
  });
  return {
    registerMock
  };
}

describe("PushClientStateManager", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    restoreGlobalProperty(
      navigator,
      "serviceWorker",
      originalServiceWorkerPropertyDescriptor
    );
    restoreGlobalProperty(window, "PushManager", originalPushManagerPropertyDescriptor);
    restoreGlobalProperty(window, "Notification", originalNotificationPropertyDescriptor);
  });

  it("saves subscription settings from enablePushNotifications", async () => {
    const pushPreferenceStore = new InMemoryPushPreferenceStore();
    const pushServerClient = new TestPushServerClient({
      pushStatus: {
        enabled: true,
        permissionRequired: true,
        subscriptionCount: 0,
        privateModeDefault: true
      }
    });
    const manager = new PushClientStateManager({
      pushPreferenceStore,
      pushServerClient
    });
    const browserSubscription = createPushSubscription(PUSH_SUBSCRIPTION_ENDPOINT);
    const harness = installBrowserPushEnvironment({
      permission: "granted",
      browserSubscription
    });

    const result = await manager.enablePushNotifications({
      privateMode: false
    });

    expect(result.subscribed).toBe(true);
    expect(result.subscriptionId).toBe("sub_test");
    expect(pushPreferenceStore.readAutoHealPreferenceEnabled()).toBe(true);
    expect(harness.registerMock).toHaveBeenCalledWith(PUSH_SERVICE_WORKER_PATH);
    expect(pushServerClient.saveRequests).toHaveLength(1);
    expect(pushServerClient.saveRequests[0]?.subscription.endpoint).toBe(PUSH_SUBSCRIPTION_ENDPOINT);
    expect(pushServerClient.saveRequests[0]?.subscription.keys.p256dh).toBe(
      PUSH_SUBSCRIPTION_KEY_P256DH
    );
    expect(pushServerClient.saveRequests[0]?.subscription.keys.auth).toBe(PUSH_SUBSCRIPTION_KEY_AUTH);
    expect(pushServerClient.saveRequests[0]?.settings?.privateMode).toBe(false);
  });

  it("uses server default privateMode during reconcile when input omits privateMode", async () => {
    const pushPreferenceStore = new InMemoryPushPreferenceStore();
    pushPreferenceStore.writeAutoHealPreferenceEnabled(true);
    const pushServerClient = new TestPushServerClient({
      pushStatus: {
        enabled: true,
        permissionRequired: true,
        subscriptionCount: 1,
        privateModeDefault: true
      }
    });
    const manager = new PushClientStateManager({
      pushPreferenceStore,
      pushServerClient
    });
    installBrowserPushEnvironment({
      permission: "granted",
      browserSubscription: createPushSubscription(PUSH_SUBSCRIPTION_ENDPOINT)
    });

    const result = await manager.reconcilePushSubscription();

    expect(result).toEqual({
      attempted: true,
      subscribed: true,
      repaired: false,
      reason: "subscription-confirmed"
    });
    expect(pushServerClient.saveRequests).toHaveLength(1);
    expect(pushServerClient.saveRequests[0]?.settings?.privateMode).toBe(true);
  });

  it("uses reconcile input privateMode when provided", async () => {
    const pushPreferenceStore = new InMemoryPushPreferenceStore();
    pushPreferenceStore.writeAutoHealPreferenceEnabled(true);
    const pushServerClient = new TestPushServerClient({
      pushStatus: {
        enabled: true,
        permissionRequired: true,
        subscriptionCount: 1,
        privateModeDefault: false
      }
    });
    const manager = new PushClientStateManager({
      pushPreferenceStore,
      pushServerClient
    });
    installBrowserPushEnvironment({
      permission: "granted",
      browserSubscription: createPushSubscription(PUSH_SUBSCRIPTION_ENDPOINT)
    });

    const result = await manager.reconcilePushSubscription({
      privateMode: true
    });

    expect(result.reason).toBe("subscription-confirmed");
    expect(pushServerClient.saveRequests).toHaveLength(1);
    expect(pushServerClient.saveRequests[0]?.settings?.privateMode).toBe(true);
  });

  it("returns not-enabled reconcile result when auto-heal preference is disabled", async () => {
    const pushPreferenceStore = new InMemoryPushPreferenceStore();
    const pushServerClient = new TestPushServerClient({
      pushStatus: {
        enabled: true,
        permissionRequired: true,
        subscriptionCount: 1,
        privateModeDefault: true
      }
    });
    const manager = new PushClientStateManager({
      pushPreferenceStore,
      pushServerClient
    });
    installBrowserPushEnvironment({
      permission: "granted",
      browserSubscription: createPushSubscription(PUSH_SUBSCRIPTION_ENDPOINT)
    });

    const result = await manager.reconcilePushSubscription();

    expect(result).toEqual({
      attempted: false,
      subscribed: false,
      repaired: false,
      reason: "not-enabled"
    });
    expect(pushServerClient.saveRequests).toHaveLength(0);
  });
});
