import { z } from "zod";

export const PushNotificationPreferenceInputSchema = z
  .object({
    privateMode: z.boolean()
  })
  .strict();

export type PushNotificationPreferenceInput = z.infer<typeof PushNotificationPreferenceInputSchema>;

export const PushSubscriptionReconcileInputSchema = z
  .object({
    privateMode: z.boolean().optional()
  })
  .strict();

export type PushSubscriptionReconcileInput = z.infer<typeof PushSubscriptionReconcileInputSchema>;

export interface PushClientState {
  supported: boolean;
  serviceWorkerRegistered: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
}

export interface PushNotificationEnableResult {
  permission: NotificationPermission;
  subscribed: boolean;
  subscriptionId: string;
}

export interface PushNotificationSettingsUpdateResult {
  updated: boolean;
}

export interface PushNotificationDisableResult {
  unsubscribed: boolean;
}

export const PushSubscriptionReconcileReasonSchema = z.enum([
  "unsupported",
  "not-enabled",
  "permission-not-granted",
  "server-disabled",
  "subscription-restored",
  "subscription-confirmed"
]);

export type PushSubscriptionReconcileReason = z.infer<typeof PushSubscriptionReconcileReasonSchema>;

export interface PushSubscriptionReconcileResult {
  attempted: boolean;
  subscribed: boolean;
  repaired: boolean;
  reason: PushSubscriptionReconcileReason;
}

export interface PushRecoveryResult {
  updatedServiceWorker: boolean;
  subscribed: boolean;
  subscriptionId: string;
}
