import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugAppServerCoverageAccountAndAppNotificationsSection } from "@/Features/Debugging/UserInterface/DebugAppServerCoverageAccountAndAppNotificationsSection";

afterEach(() => {
  cleanup();
});

describe("DebugAppServerCoverageAccountAndAppNotificationsSection", () => {
  it("reads account/app notifications when the action button is clicked", () => {
    const readAccountAndAppNotificationsSpy = vi.fn((_sinceSequence?: number | null) => {});

    render(
      <DebugAppServerCoverageAccountAndAppNotificationsSection
        isRunningCoverageAction={false}
        lastAccountAndAppNotificationsResult={null}
        onReadAccountAndAppNotifications={readAccountAndAppNotificationsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-account-app-notifications-read"));

    expect(readAccountAndAppNotificationsSpy).toHaveBeenCalledWith(null);
  });

  it("filters account/app notifications by method", () => {
    render(
      <DebugAppServerCoverageAccountAndAppNotificationsSection
        isRunningCoverageAction={false}
        lastAccountAndAppNotificationsResult={{
          sinceSequence: 43,
          eventCount: 2,
          nextSequence: 45,
          firstAvailableSequence: 1,
          resetRequired: false,
          events: [
            {
              method: "account/updated",
              sequence: 43,
              authMode: "chatgpt",
              rateLimitName: null,
              rateLimitPlanType: null,
              appCount: null,
              windowsSandboxMode: null,
              windowsSandboxSuccess: null,
              windowsSandboxError: null,
              receivedAtMilliseconds: 18_000,
            },
            {
              method: "windowsSandbox/setupCompleted",
              sequence: 44,
              authMode: null,
              rateLimitName: null,
              rateLimitPlanType: null,
              appCount: null,
              windowsSandboxMode: "unelevated",
              windowsSandboxSuccess: true,
              windowsSandboxError: null,
              receivedAtMilliseconds: 18_005,
            },
          ],
          methodCounts: [
            {
              method: "account/updated",
              count: 1,
            },
            {
              method: "windowsSandbox/setupCompleted",
              count: 1,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadAccountAndAppNotifications={() => {}}
      />,
    );

    fireEvent.change(screen.getByTestId("debug-coverage-account-app-notifications-method-filter"), {
      target: { value: "windowsSandbox/setupCompleted" },
    });

    expect(
      screen.getByTestId("debug-coverage-account-app-notifications-filter-summary").textContent,
    ).toContain("Showing 1 of 2 account/app/sandbox notifications");
    expect(screen.queryByTestId("debug-coverage-account-app-notification-43")).toBeNull();
  });
});
