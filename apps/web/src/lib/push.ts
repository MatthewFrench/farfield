import { PushSubscriptionSchema } from "@farfield/protocol";
import { z } from "zod";
import {
  deletePushSubscription,
  getPushStatus,
  getPushVapidPublicKey,
  savePushSubscription
} from "./api";

export interface PushClientState {
  supported: boolean;
  serviceWorkerRegistered: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
}

export interface PushSubscriptionReconcileResult {
  attempted: boolean;
  subscribed: boolean;
  repaired: boolean;
  reason: string;
}

export interface PushRecoveryResult {
  updatedServiceWorker: boolean;
  subscribed: boolean;
  subscriptionId: string;
}

interface WindowWithSwReloadSuppression extends Window {
  __farfieldSuppressSwReload?: boolean;
}

const PUSH_AUTO_HEAL_STORAGE_KEY = "farfield.push.auto-heal-enabled.v1";
const SW_SET_API_TOKEN_ACK_TIMEOUT_MS = 5_000;

interface ServiceWorkerSetApiTokenMessage {
  type: "SET_API_TOKEN";
  token: string | null;
}

interface ServiceWorkerSetApiTokenAckMessage {
  type: "SET_API_TOKEN_ACK";
}

function readServiceWorkerApiToken(): string | null {
  const token = import.meta.env["VITE_API_TOKEN"] ?? import.meta.env["VITE_PUSH_API_TOKEN"];
  if (typeof token !== "string") {
    return null;
  }
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

function collectRegistrationWorkers(registration: ServiceWorkerRegistration): ServiceWorker[] {
  const workers: ServiceWorker[] = [];
  const seen = new Set<ServiceWorker>();
  for (const candidate of [registration.active, registration.waiting, registration.installing]) {
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    workers.push(candidate);
    seen.add(candidate);
  }
  return workers;
}

async function postApiTokenToServiceWorker(
  worker: ServiceWorker,
  token: string | null
): Promise<void> {
  const message: ServiceWorkerSetApiTokenMessage = {
    type: "SET_API_TOKEN",
    token
  };

  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    let settled = false;
    const timeoutHandle = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error("Timed out waiting for service worker token sync acknowledgement"));
    }, SW_SET_API_TOKEN_ACK_TIMEOUT_MS);

    channel.port1.onmessage = (event) => {
      if (settled) {
        return;
      }

      const data = event.data as ServiceWorkerSetApiTokenAckMessage | null;
      if (!data || data.type !== "SET_API_TOKEN_ACK") {
        settled = true;
        window.clearTimeout(timeoutHandle);
        reject(new Error("Service worker returned an invalid token sync acknowledgement"));
        return;
      }

      settled = true;
      window.clearTimeout(timeoutHandle);
      resolve();
    };

    try {
      worker.postMessage(message, [channel.port2]);
    } catch (error) {
      settled = true;
      window.clearTimeout(timeoutHandle);
      reject(error);
    }
  });
}

async function synchronizeApiTokenForRegistration(
  registration: ServiceWorkerRegistration
): Promise<boolean> {
  const token = readServiceWorkerApiToken();
  const workers = collectRegistrationWorkers(registration);
  if (workers.length === 0) {
    return true;
  }

  let syncedCount = 0;
  await Promise.all(
    workers.map(async (worker) => {
      try {
        await postApiTokenToServiceWorker(worker, token);
        syncedCount += 1;
      } catch {
        // Ignore worker token sync errors; workers can update independently.
      }
    })
  );
  return syncedCount > 0;
}

export async function synchronizePushServiceWorkerApiToken(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    return;
  }
  await synchronizeApiTokenForRegistration(registration);
}

function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function readPushAutoHealPreference(): boolean {
  try {
    return localStorage.getItem(PUSH_AUTO_HEAL_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writePushAutoHealPreference(enabled: boolean): void {
  try {
    localStorage.setItem(PUSH_AUTO_HEAL_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore storage write failures.
  }
}

function decodeBase64Url(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register("/sw.js");
  const readyRegistration = await navigator.serviceWorker.ready;
  await synchronizeApiTokenForRegistration(registration);
  if (readyRegistration !== registration) {
    await synchronizeApiTokenForRegistration(readyRegistration);
  }
  return readyRegistration;
}

function strictSubscriptionPayload(
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

function setServiceWorkerReloadSuppressed(suppressed: boolean): void {
  const windowWithSuppression = window as WindowWithSwReloadSuppression;
  if (suppressed) {
    windowWithSuppression.__farfieldSuppressSwReload = true;
    return;
  }
  delete windowWithSuppression.__farfieldSuppressSwReload;
}

async function waitForControllerChange(timeoutMs: number): Promise<void> {
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

async function activateWaitingServiceWorker(
  registration: ServiceWorkerRegistration
): Promise<boolean> {
  const waitingWorker = registration.waiting;
  if (!waitingWorker) {
    return false;
  }
  const controllerChangePromise = waitForControllerChange(2_000);
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
  await controllerChangePromise;
  return true;
}

async function unregisterServiceWorkers(): Promise<void> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map(async (registration) => {
      await registration.unregister();
    })
  );
}

async function clearServiceWorkerCaches(): Promise<void> {
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

export async function getPushClientState(): Promise<PushClientState> {
  if (!isPushSupported()) {
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

export async function enablePushNotifications(input: {
  privateMode: boolean;
}): Promise<{ permission: NotificationPermission; subscribed: boolean; subscriptionId: string }> {
  if (!isPushSupported()) {
    throw new Error("Push notifications are not supported in this browser");
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted");
  }

  const status = await getPushStatus();
  if (!status.enabled) {
    throw new Error("Push notifications are disabled on the server");
  }

  const registration = await registerPushServiceWorker();
  let browserSubscription = await registration.pushManager.getSubscription();
  if (!browserSubscription) {
    const vapid = await getPushVapidPublicKey();
    browserSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(vapid.publicKey)
    });
  }

  const payload = strictSubscriptionPayload(browserSubscription);
  const saved = await savePushSubscription({
    subscription: payload,
    settings: {
      privateMode: input.privateMode
    }
  });
  writePushAutoHealPreference(true);

  return {
    permission,
    subscribed: true,
    subscriptionId: saved.subscriptionId
  };
}

export async function updatePushSettings(input: { privateMode: boolean }): Promise<{ updated: boolean }> {
  if (!isPushSupported()) {
    throw new Error("Push notifications are not supported in this browser");
  }

  const registration = await registerPushServiceWorker();
  const browserSubscription = await registration.pushManager.getSubscription();
  if (!browserSubscription) {
    throw new Error("No active push subscription to update");
  }

  const payload = strictSubscriptionPayload(browserSubscription);
  await savePushSubscription({
    subscription: payload,
    settings: {
      privateMode: input.privateMode
    }
  });

  return { updated: true };
}

export async function disablePushNotifications(): Promise<{ unsubscribed: boolean }> {
  writePushAutoHealPreference(false);
  if (!isPushSupported()) {
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
    const deleteResponse = await deletePushSubscription({
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

export async function reconcilePushSubscription(input?: {
  privateMode?: boolean;
}): Promise<PushSubscriptionReconcileResult> {
  if (!isPushSupported()) {
    return {
      attempted: false,
      subscribed: false,
      repaired: false,
      reason: "unsupported"
    };
  }

  if (!readPushAutoHealPreference()) {
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

  const status = await getPushStatus();
  if (!status.enabled) {
    return {
      attempted: false,
      subscribed: false,
      repaired: false,
      reason: "server-disabled"
    };
  }
  const registration = await registerPushServiceWorker();
  let browserSubscription = await registration.pushManager.getSubscription();
  let repaired = false;

  if (!browserSubscription) {
    const vapid = await getPushVapidPublicKey();
    browserSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(vapid.publicKey)
    });
    repaired = true;
  }

  const payload = strictSubscriptionPayload(browserSubscription);
  const privateMode = input?.privateMode ?? status.privateModeDefault;
  await savePushSubscription({
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

export async function recoverPushNotifications(input: {
  privateMode: boolean;
}): Promise<PushRecoveryResult> {
  if (!isPushSupported()) {
    throw new Error("Push notifications are not supported in this browser");
  }

  const registration = await registerPushServiceWorker();
  const existingSubscription = await registration.pushManager.getSubscription();
  if (existingSubscription) {
    await deletePushSubscription({
      endpoint: existingSubscription.endpoint
    });
    await existingSubscription.unsubscribe();
  }

  setServiceWorkerReloadSuppressed(true);
  try {
    const updatedServiceWorker = await activateWaitingServiceWorker(registration);
    await unregisterServiceWorkers();
    await clearServiceWorkerCaches();
    await registerPushServiceWorker();
    const enabled = await enablePushNotifications({
      privateMode: input.privateMode
    });
    return {
      updatedServiceWorker,
      subscribed: enabled.subscribed,
      subscriptionId: enabled.subscriptionId
    };
  } finally {
    setServiceWorkerReloadSuppressed(false);
  }
}
