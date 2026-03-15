import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/Components/UserInterface/Tooltip";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import { PushStatusButton } from "@/Features/PushNotifications/UserInterface/PushStatusButton";

function renderPushStatusButton(input: {
  pushClientState: PushClientState;
  isEnablingPushNotifications?: boolean;
  onEnablePushNotifications?: () => void;
}): void {
  cleanup();
  render(
    <TooltipProvider>
      <PushStatusButton
        pushClientState={input.pushClientState}
        isEnablingPushNotifications={input.isEnablingPushNotifications ?? false}
        onEnablePushNotifications={input.onEnablePushNotifications ?? (() => {})}
      />
    </TooltipProvider>,
  );
}

describe("PushStatusButton", () => {
  it("does not render when push is unsupported", () => {
    renderPushStatusButton({
      pushClientState: {
        supported: false,
        serviceWorkerRegistered: false,
        permission: "unsupported",
        subscribed: false,
      },
    });

    expect(screen.queryByTestId("enable-notifications-button")).toBeNull();
  });

  it("disables button when notifications are already enabled", () => {
    renderPushStatusButton({
      pushClientState: {
        supported: true,
        serviceWorkerRegistered: true,
        permission: "granted",
        subscribed: true,
      },
    });

    const button = screen.getByTestId("enable-notifications-button");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("data-push-status")).toBe("enabled");
  });

  it("disables button when browser notification permission is denied", () => {
    renderPushStatusButton({
      pushClientState: {
        supported: true,
        serviceWorkerRegistered: true,
        permission: "denied",
        subscribed: false,
      },
    });

    const button = screen.getByTestId("enable-notifications-button");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("data-push-status")).toBe("blocked");
    expect(button.getAttribute("aria-label")).toBe("Notifications blocked by browser settings");
  });

  it("treats denied permission as blocked even when a stale subscription exists", () => {
    const onEnablePushNotifications = vi.fn();
    renderPushStatusButton({
      pushClientState: {
        supported: true,
        serviceWorkerRegistered: true,
        permission: "denied",
        subscribed: true,
      },
      onEnablePushNotifications,
    });

    const button = screen.getByTestId("enable-notifications-button");
    fireEvent.click(button);

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("data-push-status")).toBe("blocked");
    expect(onEnablePushNotifications).not.toHaveBeenCalled();
  });

  it("shows enabling state while push enable request is in progress", () => {
    renderPushStatusButton({
      pushClientState: {
        supported: true,
        serviceWorkerRegistered: true,
        permission: "default",
        subscribed: false,
      },
      isEnablingPushNotifications: true,
    });

    const button = screen.getByTestId("enable-notifications-button");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("data-push-status")).toBe("enabling");
    expect(button.getAttribute("aria-label")).toBe("Enabling notifications");
  });

  it("invokes enable handler when button is enabled and clicked", () => {
    const onEnablePushNotifications = vi.fn();
    renderPushStatusButton({
      pushClientState: {
        supported: true,
        serviceWorkerRegistered: true,
        permission: "default",
        subscribed: false,
      },
      onEnablePushNotifications,
    });

    fireEvent.click(screen.getByTestId("enable-notifications-button"));
    expect(onEnablePushNotifications).toHaveBeenCalledTimes(1);
  });
});
