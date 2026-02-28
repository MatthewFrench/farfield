import { Bell, BellOff, BellRing, Loader2, RefreshCcw, Send } from "lucide-react";
import { Button } from "@/Components/UserInterface/Button";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import {
  type PushLocalCertificateAuthorityDiagnostics,
  type PushReceiptDiagnostics,
  type PushSendDiagnostics,
  type PushStatusDiagnostics,
  type PushTestDiagnostics,
} from "@/Features/PushNotifications/DomainModel/PushDiagnosticsContracts";

export interface PushNotificationsSettingsPaneProps {
  pushClientState: PushClientState;
  pushStatus: PushStatusDiagnostics | null;
  latestPushReceipt: PushReceiptDiagnostics | null;
  latestPushSend: PushSendDiagnostics | null;
  pushLocalCertificateAuthorityStatus: PushLocalCertificateAuthorityDiagnostics | null;
  pushSettingsErrorMessage: string;
  pushTestResult: PushTestDiagnostics | null;
  isRefreshingPushSettings: boolean;
  isEnablingPushNotifications: boolean;
  isSendingPushTestNotification: boolean;
  canSendPushTestNotification: boolean;
  selectedThreadId: string | null;
  latestTurnId: string | null;
  onRefreshPushSettings: () => void;
  onEnablePushNotifications: () => void;
  onSendPushTestNotification: () => void;
}

const PUSH_NOT_AVAILABLE_LABEL = "Not loaded";
const NOTIFICATION_PERMISSION_UNSUPPORTED = "unsupported";
const NOTIFICATION_PERMISSION_DENIED = "denied";
const NOTIFICATION_PERMISSION_GRANTED = "granted";

function readNotificationPermissionLabel(
  permission: NotificationPermission | "unsupported",
): string {
  if (permission === NOTIFICATION_PERMISSION_UNSUPPORTED) {
    return "Unsupported";
  }
  if (permission === NOTIFICATION_PERMISSION_DENIED) {
    return "Blocked";
  }
  if (permission === NOTIFICATION_PERMISSION_GRANTED) {
    return "Granted";
  }
  return "Prompt";
}

function readPushStatusIcon(input: {
  pushClientState: PushClientState;
  isEnablingPushNotifications: boolean;
}): React.JSX.Element {
  if (input.isEnablingPushNotifications) {
    return <Loader2 size={14} className="animate-spin" />;
  }
  if (input.pushClientState.permission === NOTIFICATION_PERMISSION_DENIED) {
    return <BellOff size={14} />;
  }
  if (input.pushClientState.subscribed) {
    return <BellRing size={14} />;
  }
  return <Bell size={14} />;
}

function readPushStatusActionLabel(input: {
  pushClientState: PushClientState;
  isEnablingPushNotifications: boolean;
}): string {
  if (input.isEnablingPushNotifications) {
    return "Enabling";
  }
  if (input.pushClientState.subscribed) {
    return "Enabled";
  }
  if (input.pushClientState.permission === NOTIFICATION_PERMISSION_DENIED) {
    return "Blocked";
  }
  return "Enable notifications";
}

function readCanEnablePushNotifications(input: {
  pushClientState: PushClientState;
  isEnablingPushNotifications: boolean;
}): boolean {
  if (input.isEnablingPushNotifications) {
    return false;
  }
  if (!input.pushClientState.supported) {
    return false;
  }
  if (input.pushClientState.subscribed) {
    return false;
  }
  return input.pushClientState.permission !== NOTIFICATION_PERMISSION_DENIED;
}

function readPushTestTargetDescription(input: {
  canSendPushTestNotification: boolean;
  selectedThreadId: string | null;
  latestTurnId: string | null;
}): string {
  if (!input.canSendPushTestNotification) {
    if (input.selectedThreadId === null || input.selectedThreadId.length === 0) {
      return "Select a thread to send a test notification.";
    }
    if (input.latestTurnId === null || input.latestTurnId.length === 0) {
      return "Selected thread has no turn available for notification testing.";
    }
  }

  return `Thread ${input.selectedThreadId} · Turn ${input.latestTurnId}`;
}

function readLatestPushSendSummary(latestPushSend: PushSendDiagnostics | null): {
  sentAt: string;
  notificationId: string;
  threadId: string;
  turnId: string;
  attempted: string;
  delivered: string;
  failures: string;
} {
  const latestSend = latestPushSend?.latest ?? null;
  if (latestSend === null) {
    return {
      sentAt: PUSH_NOT_AVAILABLE_LABEL,
      notificationId: PUSH_NOT_AVAILABLE_LABEL,
      threadId: PUSH_NOT_AVAILABLE_LABEL,
      turnId: PUSH_NOT_AVAILABLE_LABEL,
      attempted: PUSH_NOT_AVAILABLE_LABEL,
      delivered: PUSH_NOT_AVAILABLE_LABEL,
      failures: PUSH_NOT_AVAILABLE_LABEL,
    };
  }

  return {
    sentAt: latestSend.sentAt,
    notificationId: latestSend.notificationId,
    threadId: latestSend.threadId,
    turnId: latestSend.turnId,
    attempted: String(latestSend.attempted),
    delivered: String(latestSend.delivered),
    failures: String(latestSend.failures),
  };
}

function readLatestPushReceiptSummary(latestPushReceipt: PushReceiptDiagnostics | null): {
  createdAt: string;
  notificationId: string;
  event: string;
  threadId: string;
  turnId: string;
  message: string;
  count: string;
} {
  const latestReceipt = latestPushReceipt?.latest ?? null;
  if (latestReceipt === null) {
    return {
      createdAt: PUSH_NOT_AVAILABLE_LABEL,
      notificationId: PUSH_NOT_AVAILABLE_LABEL,
      event: PUSH_NOT_AVAILABLE_LABEL,
      threadId: PUSH_NOT_AVAILABLE_LABEL,
      turnId: PUSH_NOT_AVAILABLE_LABEL,
      message: PUSH_NOT_AVAILABLE_LABEL,
      count: String(latestPushReceipt?.count ?? 0),
    };
  }

  return {
    createdAt: latestReceipt.createdAt,
    notificationId: latestReceipt.notificationId,
    event: latestReceipt.event,
    threadId: latestReceipt.threadId ?? PUSH_NOT_AVAILABLE_LABEL,
    turnId: latestReceipt.turnId ?? PUSH_NOT_AVAILABLE_LABEL,
    message: latestReceipt.message ?? PUSH_NOT_AVAILABLE_LABEL,
    count: String(latestPushReceipt?.count ?? 0),
  };
}

function readPushServerStatusSummary(pushStatus: PushStatusDiagnostics | null): {
  enabled: string;
  permissionRequired: string;
  subscriptionCount: string;
  privateModeDefault: string;
} {
  if (pushStatus === null) {
    return {
      enabled: PUSH_NOT_AVAILABLE_LABEL,
      permissionRequired: PUSH_NOT_AVAILABLE_LABEL,
      subscriptionCount: PUSH_NOT_AVAILABLE_LABEL,
      privateModeDefault: PUSH_NOT_AVAILABLE_LABEL,
    };
  }

  return {
    enabled: pushStatus.enabled ? "Enabled" : "Disabled",
    permissionRequired: pushStatus.permissionRequired ? "Yes" : "No",
    subscriptionCount: String(pushStatus.subscriptionCount),
    privateModeDefault: pushStatus.privateModeDefault ? "Private" : "Shared",
  };
}

function readPushLocalCertificateAuthoritySummary(
  pushLocalCertificateAuthorityStatus: PushLocalCertificateAuthorityDiagnostics | null,
): {
  available: string;
  downloadPath: string;
} {
  if (pushLocalCertificateAuthorityStatus === null) {
    return {
      available: PUSH_NOT_AVAILABLE_LABEL,
      downloadPath: PUSH_NOT_AVAILABLE_LABEL,
    };
  }

  return {
    available: pushLocalCertificateAuthorityStatus.available ? "Available" : "Unavailable",
    downloadPath: pushLocalCertificateAuthorityStatus.downloadPath ?? PUSH_NOT_AVAILABLE_LABEL,
  };
}

function readPushTestResultSummary(pushTestResult: PushTestDiagnostics | null): {
  reason: string;
  notificationId: string;
  attempted: string;
  delivered: string;
  failures: string;
  ready: string;
} {
  if (pushTestResult === null) {
    return {
      reason: PUSH_NOT_AVAILABLE_LABEL,
      notificationId: PUSH_NOT_AVAILABLE_LABEL,
      attempted: PUSH_NOT_AVAILABLE_LABEL,
      delivered: PUSH_NOT_AVAILABLE_LABEL,
      failures: PUSH_NOT_AVAILABLE_LABEL,
      ready: PUSH_NOT_AVAILABLE_LABEL,
    };
  }

  return {
    reason: pushTestResult.reason,
    notificationId: pushTestResult.notificationId ?? PUSH_NOT_AVAILABLE_LABEL,
    attempted: String(pushTestResult.attempted),
    delivered: String(pushTestResult.delivered),
    failures: String(pushTestResult.failures),
    ready: pushTestResult.ready ? "Yes" : "No",
  };
}

function SummaryRow(input: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground">{input.label}</span>
      <span className="text-xs font-medium text-right break-all">{input.value}</span>
    </div>
  );
}

export function PushNotificationsSettingsPane({
  pushClientState,
  pushStatus,
  latestPushReceipt,
  latestPushSend,
  pushLocalCertificateAuthorityStatus,
  pushSettingsErrorMessage,
  pushTestResult,
  isRefreshingPushSettings,
  isEnablingPushNotifications,
  isSendingPushTestNotification,
  canSendPushTestNotification,
  selectedThreadId,
  latestTurnId,
  onRefreshPushSettings,
  onEnablePushNotifications,
  onSendPushTestNotification,
}: PushNotificationsSettingsPaneProps): React.JSX.Element {
  const canEnablePushNotifications = readCanEnablePushNotifications({
    pushClientState,
    isEnablingPushNotifications,
  });
  const pushStatusActionLabel = readPushStatusActionLabel({
    pushClientState,
    isEnablingPushNotifications,
  });
  const pushServerStatusSummary = readPushServerStatusSummary(pushStatus);
  const pushLocalCertificateAuthoritySummary = readPushLocalCertificateAuthoritySummary(
    pushLocalCertificateAuthorityStatus,
  );
  const pushSendSummary = readLatestPushSendSummary(latestPushSend);
  const pushReceiptSummary = readLatestPushReceiptSummary(latestPushReceipt);
  const pushTestResultSummary = readPushTestResultSummary(pushTestResult);
  const pushTestTargetDescription = readPushTestTargetDescription({
    canSendPushTestNotification,
    selectedThreadId,
    latestTurnId,
  });

  return (
    <div
      data-testid="push-notifications-settings-pane"
      className="flex-1 min-h-0 overflow-auto px-4 py-4"
    >
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Notifications</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Manage browser push registration and verify delivery diagnostics.
                </p>
              </div>
              <div className="shrink-0 text-muted-foreground">
                {readPushStatusIcon({
                  pushClientState,
                  isEnablingPushNotifications,
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canEnablePushNotifications}
                data-testid="settings-enable-notifications-button"
                onClick={onEnablePushNotifications}
                className="justify-start"
              >
                {isEnablingPushNotifications && <Loader2 size={14} className="animate-spin" />}
                <span>{pushStatusActionLabel}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRefreshingPushSettings}
                data-testid="settings-refresh-notifications-button"
                onClick={onRefreshPushSettings}
                className="justify-start"
              >
                {isRefreshingPushSettings ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCcw size={14} />
                )}
                <span>{isRefreshingPushSettings ? "Refreshing" : "Refresh diagnostics"}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canSendPushTestNotification || isSendingPushTestNotification}
                data-testid="settings-send-test-notification-button"
                onClick={onSendPushTestNotification}
                className="justify-start"
              >
                {isSendingPushTestNotification ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                <span>
                  {isSendingPushTestNotification ? "Sending test" : "Send test notification"}
                </span>
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground">{pushTestTargetDescription}</p>

            {pushSettingsErrorMessage.length > 0 && (
              <div
                data-testid="settings-notifications-error"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {pushSettingsErrorMessage}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Browser State</h3>
          <div className="mt-2 divide-y divide-border/70">
            <SummaryRow
              label="Support"
              value={pushClientState.supported ? "Supported" : "Unsupported"}
            />
            <SummaryRow
              label="Service worker"
              value={pushClientState.serviceWorkerRegistered ? "Registered" : "Not registered"}
            />
            <SummaryRow
              label="Permission"
              value={readNotificationPermissionLabel(pushClientState.permission)}
            />
            <SummaryRow
              label="Subscription"
              value={pushClientState.subscribed ? "Subscribed" : "Not subscribed"}
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Server State</h3>
          <div className="mt-2 divide-y divide-border/70">
            <SummaryRow label="Push enabled" value={pushServerStatusSummary.enabled} />
            <SummaryRow
              label="Permission required"
              value={pushServerStatusSummary.permissionRequired}
            />
            <SummaryRow
              label="Subscription count"
              value={pushServerStatusSummary.subscriptionCount}
            />
            <SummaryRow
              label="Default privacy mode"
              value={pushServerStatusSummary.privateModeDefault}
            />
            <SummaryRow label="Local CA" value={pushLocalCertificateAuthoritySummary.available} />
            <SummaryRow
              label="Local CA download path"
              value={pushLocalCertificateAuthoritySummary.downloadPath}
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Delivery Diagnostics</h3>
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border/80 px-3 py-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Latest send
              </h4>
              <div className="mt-2 divide-y divide-border/70">
                <SummaryRow label="Sent at" value={pushSendSummary.sentAt} />
                <SummaryRow label="Notification ID" value={pushSendSummary.notificationId} />
                <SummaryRow label="Thread ID" value={pushSendSummary.threadId} />
                <SummaryRow label="Turn ID" value={pushSendSummary.turnId} />
                <SummaryRow label="Attempted" value={pushSendSummary.attempted} />
                <SummaryRow label="Delivered" value={pushSendSummary.delivered} />
                <SummaryRow label="Failures" value={pushSendSummary.failures} />
              </div>
            </div>

            <div className="rounded-lg border border-border/80 px-3 py-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Latest receipt
              </h4>
              <div className="mt-2 divide-y divide-border/70">
                <SummaryRow label="Received at" value={pushReceiptSummary.createdAt} />
                <SummaryRow label="Notification ID" value={pushReceiptSummary.notificationId} />
                <SummaryRow label="Event" value={pushReceiptSummary.event} />
                <SummaryRow label="Thread ID" value={pushReceiptSummary.threadId} />
                <SummaryRow label="Turn ID" value={pushReceiptSummary.turnId} />
                <SummaryRow label="Message" value={pushReceiptSummary.message} />
                <SummaryRow label="Receipt count" value={pushReceiptSummary.count} />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Latest Test Result</h3>
          <div className="mt-2 divide-y divide-border/70">
            <SummaryRow label="Reason" value={pushTestResultSummary.reason} />
            <SummaryRow label="Notification ID" value={pushTestResultSummary.notificationId} />
            <SummaryRow label="Ready" value={pushTestResultSummary.ready} />
            <SummaryRow label="Attempted" value={pushTestResultSummary.attempted} />
            <SummaryRow label="Delivered" value={pushTestResultSummary.delivered} />
            <SummaryRow label="Failures" value={pushTestResultSummary.failures} />
          </div>
        </section>
      </div>
    </div>
  );
}
