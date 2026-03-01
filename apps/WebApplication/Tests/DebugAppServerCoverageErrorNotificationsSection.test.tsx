import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugAppServerCoverageErrorNotificationsSection } from "@/Features/Debugging/UserInterface/DebugAppServerCoverageErrorNotificationsSection";

afterEach(() => {
  cleanup();
});

describe("DebugAppServerCoverageErrorNotificationsSection", () => {
  it("reads error notifications when the action button is clicked", () => {
    const readErrorNotificationsSpy = vi.fn((_sinceSequence?: number | null) => {});

    render(
      <DebugAppServerCoverageErrorNotificationsSection
        isRunningCoverageAction={false}
        lastErrorNotificationsResult={null}
        onReadErrorNotifications={readErrorNotificationsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-error-notifications-read"));

    expect(readErrorNotificationsSpy).toHaveBeenCalledWith(null);
  });

  it("filters error notifications by thread id", () => {
    render(
      <DebugAppServerCoverageErrorNotificationsSection
        isRunningCoverageAction={false}
        lastErrorNotificationsResult={{
          sinceSequence: 11,
          eventCount: 2,
          retryCount: 1,
          nextSequence: 14,
          firstAvailableSequence: 2,
          resetRequired: false,
          events: [
            {
              sequence: 12,
              threadId: "thread-alpha",
              turnId: "turn-1",
              message: "Rate limit exceeded",
              codexErrorInfoSummary: "usageLimitExceeded",
              additionalDetails: null,
              willRetry: true,
              receivedAtMilliseconds: 17_300,
            },
            {
              sequence: 13,
              threadId: "thread-beta",
              turnId: "turn-2",
              message: "Unauthorized request",
              codexErrorInfoSummary: "unauthorized",
              additionalDetails: "Token expired.",
              willRetry: false,
              receivedAtMilliseconds: 17_320,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadErrorNotifications={() => {}}
      />,
    );

    fireEvent.change(screen.getByTestId("debug-coverage-error-notifications-thread-filter"), {
      target: { value: "beta" },
    });

    expect(
      screen.getByTestId("debug-coverage-error-notifications-filter-summary").textContent,
    ).toContain("Showing 1 of 2 error notifications");
    expect(screen.queryByTestId("debug-coverage-error-notification-12")).toBeNull();
  });
});
