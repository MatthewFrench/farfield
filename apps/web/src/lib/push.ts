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

function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
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
  await navigator.serviceWorker.ready;
  return registration;
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

  await deletePushSubscription({
    endpoint: browserSubscription.endpoint
  });
  await browserSubscription.unsubscribe();

  return { unsubscribed: true };
}
