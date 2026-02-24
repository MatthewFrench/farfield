import type {
  PushClientState,
  PushRecoveryResult,
  PushSubscriptionReconcileResult
} from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import { PushClientStateManager } from "@/Features/PushNotifications/DataAccess/PushClientStateManager";

const defaultPushClientStateManager = new PushClientStateManager();

export async function getPushClientState(): Promise<PushClientState> {
  return defaultPushClientStateManager.readPushClientState();
}

export async function enablePushNotifications(input: {
  privateMode: boolean;
}): Promise<{ permission: NotificationPermission; subscribed: boolean; subscriptionId: string }> {
  return defaultPushClientStateManager.enablePushNotifications(input);
}

export async function updatePushSettings(input: { privateMode: boolean }): Promise<{ updated: boolean }> {
  return defaultPushClientStateManager.updatePushSettings(input);
}

export async function disablePushNotifications(): Promise<{ unsubscribed: boolean }> {
  return defaultPushClientStateManager.disablePushNotifications();
}

export async function reconcilePushSubscription(input?: {
  privateMode?: boolean;
}): Promise<PushSubscriptionReconcileResult> {
  return defaultPushClientStateManager.reconcilePushSubscription(input);
}

export async function recoverPushNotifications(input: {
  privateMode: boolean;
}): Promise<PushRecoveryResult> {
  return defaultPushClientStateManager.recoverPushNotifications(input);
}
