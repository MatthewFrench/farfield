import { PushSubscriptionSchema } from "@farfield/protocol";
import { z } from "zod";
import {
  type PushClientState,
  type PushRecoveryResult,
  type PushSubscriptionReconcileResult
} from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import { PushPreferenceStore } from "@/Features/PushNotifications/DataAccess/PushPreferenceStore";
import { PushServerClient } from "@/Features/PushNotifications/DataAccess/PushServerClient";

interface WindowWithSwReloadSuppression extends Window {
  __farfieldSuppressSwReload?: boolean;
}

interface PushClientStateManagerDependencies {
  pushPreferenceStore: PushPreferenceStore;
  pushServerClient: PushServerClient;
}

/**
 * Owns browser push-subscription lifecycle (permission, service worker registration, subscription reconcile/recovery).
 * Server-side subscription persistence is delegated to `PushServerClient`.
 */
export class PushClientStateManager {
  private readonly pushPreferenceStore: PushPreferenceStore;
  private readonly pushServerClient: PushServerClient;

  public constructor(dependencies?: PushClientStateManagerDependencies) {
    this.pushPreferenceStore = dependencies?.pushPreferenceStore ?? new PushPreferenceStore();
    this.pushServerClient = dependencies?.pushServerClient ?? new PushServerClient();
  }

  public async readPushClientState(): Promise<PushClientState> {
    if (!this.isPushSupported()) {
      return {
        supported: false,
        serviceWorkerRegistered: false,
        permission: "unsupported",
        subscribed: false
      };
    }

    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = registration ? await registration.pushManager.getSubscription() : null;
    return {
      supported: true,
      serviceWorkerRegistered: registration !== undefined,
      permission: Notification.permission,
      subscribed: subscription !== null
    };
  }

  public async enablePrivateModePushNotifications(): Promise<void> {
    await this.enablePushNotifications({
      privateMode: true
    });
  }

  public async enablePushNotifications(input: {
    privateMode: boolean;
  }): Promise<{ permission: NotificationPermission; subscribed: boolean; subscriptionId: string }> {
    if (!this.isPushSupported()) {
      throw new Error("Push notifications are not supported in this browser");
    }

    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      throw new Error("Notification permission was not granted");
    }

    const status = await this.pushServerClient.readPushStatus();
    if (!status.enabled) {
      throw new Error("Push notifications are disabled on the server");
    }

    const registration = await this.registerPushServiceWorker();
    let browserSubscription = await registration.pushManager.getSubscription();
    if (!browserSubscription) {
      const vapid = await this.pushServerClient.readPushVapidPublicKey();
      browserSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.decodeBase64Url(vapid.publicKey)
      });
    }

    const payload = this.strictSubscriptionPayload(browserSubscription);
    const saved = await this.pushServerClient.savePushSubscription({
      subscription: payload,
      settings: {
        privateMode: input.privateMode
      }
    });
    this.pushPreferenceStore.writeAutoHealPreferenceEnabled(true);

    return {
      permission,
      subscribed: true,
      subscriptionId: saved.subscriptionId
    };
  }

  public async updatePushSettings(input: { privateMode: boolean }): Promise<{ updated: boolean }> {
    if (!this.isPushSupported()) {
      throw new Error("Push notifications are not supported in this browser");
    }

    const registration = await this.registerPushServiceWorker();
    const browserSubscription = await registration.pushManager.getSubscription();
    if (!browserSubscription) {
      throw new Error("No active push subscription to update");
    }

    const payload = this.strictSubscriptionPayload(browserSubscription);
    await this.pushServerClient.savePushSubscription({
      subscription: payload,
      settings: {
        privateMode: input.privateMode
      }
    });

    return { updated: true };
  }

  public async disablePushNotifications(): Promise<{ unsubscribed: boolean }> {
    this.pushPreferenceStore.writeAutoHealPreferenceEnabled(false);
    if (!this.isPushSupported()) {
      return { unsubscribed: false };
    }

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return { unsubscribed: false };
    }

    const browserSubscription = await registration.pushManager.getSubscription();
    if (!browserSubscription) {
      return { unsubscribed: false };
    }

    let browserUnsubscribed = false;
    try {
      browserUnsubscribed = await browserSubscription.unsubscribe();
    } catch {
      browserUnsubscribed = false;
    }

    let serverDeleted = false;
    try {
      const deleteResponse = await this.pushServerClient.deletePushSubscription({
        endpoint: browserSubscription.endpoint
      });
      serverDeleted = deleteResponse.deleted;
    } catch {
      serverDeleted = false;
    }

    if (!browserUnsubscribed && !serverDeleted) {
      throw new Error("Failed to disable push notifications");
    }

    return { unsubscribed: browserUnsubscribed || serverDeleted };
  }

  public async reconcilePushSubscription(input?: {
    privateMode?: boolean;
  }): Promise<PushSubscriptionReconcileResult> {
    if (!this.isPushSupported()) {
      return {
        attempted: false,
        subscribed: false,
        repaired: false,
        reason: "unsupported"
      };
    }

    if (!this.pushPreferenceStore.readAutoHealPreferenceEnabled()) {
      return {
        attempted: false,
        subscribed: false,
        repaired: false,
        reason: "not-enabled"
      };
    }

    if (Notification.permission !== "granted") {
      return {
        attempted: false,
        subscribed: false,
        repaired: false,
        reason: "permission-not-granted"
      };
    }

    const status = await this.pushServerClient.readPushStatus();
    if (!status.enabled) {
      return {
        attempted: false,
        subscribed: false,
        repaired: false,
        reason: "server-disabled"
      };
    }

    const registration = await this.registerPushServiceWorker();
    let browserSubscription = await registration.pushManager.getSubscription();
    let repaired = false;

    if (!browserSubscription) {
      const vapid = await this.pushServerClient.readPushVapidPublicKey();
      browserSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.decodeBase64Url(vapid.publicKey)
      });
      repaired = true;
    }

    const payload = this.strictSubscriptionPayload(browserSubscription);
    const privateMode = input?.privateMode ?? status.privateModeDefault;
    await this.pushServerClient.savePushSubscription({
      subscription: payload,
      settings: {
        privateMode
      }
    });

    return {
      attempted: true,
      subscribed: true,
      repaired,
      reason: repaired ? "subscription-restored" : "subscription-confirmed"
    };
  }

  public async recoverPushNotifications(input: {
    privateMode: boolean;
  }): Promise<PushRecoveryResult> {
    if (!this.isPushSupported()) {
      throw new Error("Push notifications are not supported in this browser");
    }

    const registration = await this.registerPushServiceWorker();
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      await this.pushServerClient.deletePushSubscription({
        endpoint: existingSubscription.endpoint
      });
      await existingSubscription.unsubscribe();
    }

    this.setServiceWorkerReloadSuppressed(true);
    try {
      const updatedServiceWorker = await this.activateWaitingServiceWorker(registration);
      await this.unregisterServiceWorkers();
      await this.clearServiceWorkerCaches();
      await this.registerPushServiceWorker();
      const enabled = await this.enablePushNotifications({
        privateMode: input.privateMode
      });
      return {
        updatedServiceWorker,
        subscribed: enabled.subscribed,
        subscriptionId: enabled.subscriptionId
      };
    } finally {
      this.setServiceWorkerReloadSuppressed(false);
    }
  }

  private isPushSupported(): boolean {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }

  private decodeBase64Url(value: string): ArrayBuffer {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes.buffer;
  }

  private async registerPushServiceWorker(): Promise<ServiceWorkerRegistration> {
    await navigator.serviceWorker.register("/sw.js");
    return await navigator.serviceWorker.ready;
  }

  private strictSubscriptionPayload(
    subscription: PushSubscription
  ): z.infer<typeof PushSubscriptionSchema> {
    const raw = subscription.toJSON();
    return PushSubscriptionSchema.parse({
      endpoint: raw.endpoint ?? subscription.endpoint,
      keys: {
        p256dh: raw.keys?.["p256dh"] ?? "",
        auth: raw.keys?.["auth"] ?? ""
      }
    });
  }

  private setServiceWorkerReloadSuppressed(suppressed: boolean): void {
    const windowWithSuppression = window as WindowWithSwReloadSuppression;
    if (suppressed) {
      windowWithSuppression.__farfieldSuppressSwReload = true;
      return;
    }
    delete windowWithSuppression.__farfieldSuppressSwReload;
  }

  private async waitForControllerChange(timeoutMs: number): Promise<void> {
    await new Promise<void>((resolve) => {
      let settled = false;
      const onControllerChange = () => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timer);
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        resolve();
      };
      const timer = window.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        resolve();
      }, timeoutMs);

      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    });
  }

  private async activateWaitingServiceWorker(
    registration: ServiceWorkerRegistration
  ): Promise<boolean> {
    const waitingWorker = registration.waiting;
    if (!waitingWorker) {
      return false;
    }
    const controllerChangePromise = this.waitForControllerChange(2_000);
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    await controllerChangePromise;
    return true;
  }

  private async unregisterServiceWorkers(): Promise<void> {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map(async (registration) => {
        await registration.unregister();
      })
    );
  }

  private async clearServiceWorkerCaches(): Promise<void> {
    if (!("caches" in window)) {
      return;
    }
    const cacheKeys = await window.caches.keys();
    await Promise.all(
      cacheKeys.map(async (cacheKey) => {
        await window.caches.delete(cacheKey);
      })
    );
  }
}
