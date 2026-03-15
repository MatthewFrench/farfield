import { PushClientStateManager } from "@/Features/PushNotifications/DataAccess/PushClientStateManager";
import type {
  PushClientState,
  PushNotificationDisableResult,
  PushNotificationEnableResult,
  PushNotificationPreferenceInput,
  PushNotificationSettingsUpdateResult,
  PushRecoveryResult,
  PushSubscriptionReconcileInput,
  PushSubscriptionReconcileResult,
} from "@/Features/PushNotifications/DomainModel/PushClientContracts";

const defaultPushClientStateManager = new PushClientStateManager();

export async function getPushClientState(): Promise<PushClientState> {
  return defaultPushClientStateManager.readPushClientState();
}

export async function enablePushNotifications(
  input: PushNotificationPreferenceInput,
): Promise<PushNotificationEnableResult> {
  return defaultPushClientStateManager.enablePushNotifications(input);
}

export async function updatePushSettings(
  input: PushNotificationPreferenceInput,
): Promise<PushNotificationSettingsUpdateResult> {
  return defaultPushClientStateManager.updatePushSettings(input);
}

export async function disablePushNotifications(): Promise<PushNotificationDisableResult> {
  return defaultPushClientStateManager.disablePushNotifications();
}

export async function reconcilePushSubscription(
  input?: PushSubscriptionReconcileInput,
): Promise<PushSubscriptionReconcileResult> {
  return defaultPushClientStateManager.reconcilePushSubscription(input);
}

export async function recoverPushNotifications(
  input: PushNotificationPreferenceInput,
): Promise<PushRecoveryResult> {
  return defaultPushClientStateManager.recoverPushNotifications(input);
}
