import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PushNotificationsSettingsPane } from "@/Features/PushNotifications/UserInterface/PushNotificationsSettingsPane";

describe("PushNotificationsSettingsPane", () => {
  afterEach(() => {
    cleanup();
  });

  it("requests diagnostics refresh from settings actions", () => {
    const onRefreshPushSettings = vi.fn();

    render(
      <PushNotificationsSettingsPane
        pushClientState={{
          supported: true,
          serviceWorkerRegistered: true,
          permission: "default",
          subscribed: false,
        }}
        pushStatus={null}
        latestPushReceipt={null}
        latestPushSend={null}
        pushLocalCertificateAuthorityStatus={null}
        pushSettingsErrorMessage=""
        pushTestResult={null}
        isRefreshingPushSettings={false}
        isEnablingPushNotifications={false}
        isSendingPushTestNotification={false}
        canSendPushTestNotification={false}
        selectedThreadId={null}
        latestTurnId={null}
        onRefreshPushSettings={onRefreshPushSettings}
        onEnablePushNotifications={() => {}}
        onSendPushTestNotification={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId("settings-refresh-notifications-button"));
    expect(onRefreshPushSettings).toHaveBeenCalledTimes(1);
  });

  it("disables test notification action when no selected-thread turn is available", () => {
    render(
      <PushNotificationsSettingsPane
        pushClientState={{
          supported: true,
          serviceWorkerRegistered: true,
          permission: "granted",
          subscribed: true,
        }}
        pushStatus={null}
        latestPushReceipt={null}
        latestPushSend={null}
        pushLocalCertificateAuthorityStatus={null}
        pushSettingsErrorMessage=""
        pushTestResult={null}
        isRefreshingPushSettings={false}
        isEnablingPushNotifications={false}
        isSendingPushTestNotification={false}
        canSendPushTestNotification={false}
        selectedThreadId={null}
        latestTurnId={null}
        onRefreshPushSettings={() => {}}
        onEnablePushNotifications={() => {}}
        onSendPushTestNotification={() => {}}
      />,
    );

    expect(
      screen.getByTestId("settings-send-test-notification-button").hasAttribute("disabled"),
    ).toBe(true);
  });
});
