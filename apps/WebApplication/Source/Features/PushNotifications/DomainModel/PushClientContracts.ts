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
