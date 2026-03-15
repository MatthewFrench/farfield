import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugAppServerCoverageThreadProgressNotificationsSection } from "@/Features/Debugging/UserInterface/DebugAppServerCoverageThreadProgressNotificationsSection";

afterEach(() => {
  cleanup();
});

describe("DebugAppServerCoverageThreadProgressNotificationsSection", () => {
  it("reads thread progress notifications when the action button is clicked", () => {
    const readThreadProgressNotificationsSpy = vi.fn((_sinceSequence?: number | null) => {});

    render(
      <DebugAppServerCoverageThreadProgressNotificationsSection
        isRunningCoverageAction={false}
        lastThreadProgressNotificationsResult={null}
        onReadThreadProgressNotifications={readThreadProgressNotificationsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-thread-progress-notifications-read"));

    expect(readThreadProgressNotificationsSpy).toHaveBeenCalledWith(null);
  });

  it("filters thread progress notifications by method", () => {
    render(
      <DebugAppServerCoverageThreadProgressNotificationsSection
        isRunningCoverageAction={false}
        lastThreadProgressNotificationsResult={{
          sinceSequence: 35,
          eventCount: 2,
          nextSequence: 38,
          firstAvailableSequence: 1,
          resetRequired: false,
          events: [
            {
              method: "thread/started",
              sequence: 36,
              threadId: "thread-alpha",
              turnId: null,
              modelProvider: "openai",
              preview: "Plan migration work",
              totalTokens: null,
              lastTotalTokens: null,
              modelContextWindow: null,
              receivedAtMilliseconds: 17_200,
            },
            {
              method: "thread/tokenUsage/updated",
              sequence: 37,
              threadId: "thread-alpha",
              turnId: "turn-2",
              modelProvider: null,
              preview: null,
              totalTokens: 2_048,
              lastTotalTokens: 128,
              modelContextWindow: 8_192,
              receivedAtMilliseconds: 17_210,
            },
          ],
          methodCounts: [
            {
              method: "thread/started",
              count: 1,
            },
            {
              method: "thread/tokenUsage/updated",
              count: 1,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadThreadProgressNotifications={() => {}}
      />,
    );

    fireEvent.change(
      screen.getByTestId("debug-coverage-thread-progress-notifications-method-filter"),
      {
        target: { value: "tokenUsage" },
      },
    );

    expect(
      screen.getByTestId("debug-coverage-thread-progress-notifications-filter-summary").textContent,
    ).toContain("Showing 1 of 2 thread-progress notifications");
    expect(screen.queryByTestId("debug-coverage-thread-progress-notification-36")).toBeNull();
  });
});
