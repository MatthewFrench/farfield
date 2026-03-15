import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugAppServerCoverageThreadLifecycleNotificationsSection } from "@/Features/Debugging/UserInterface/DebugAppServerCoverageThreadLifecycleNotificationsSection";

afterEach(() => {
  cleanup();
});

describe("DebugAppServerCoverageThreadLifecycleNotificationsSection", () => {
  it("reads thread lifecycle notifications when the action button is clicked", () => {
    const readThreadLifecycleNotificationsSpy = vi.fn((_sinceSequence?: number | null) => {});

    render(
      <DebugAppServerCoverageThreadLifecycleNotificationsSection
        isRunningCoverageAction={false}
        lastThreadLifecycleNotificationsResult={null}
        onReadThreadLifecycleNotifications={readThreadLifecycleNotificationsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-thread-lifecycle-notifications-read"));

    expect(readThreadLifecycleNotificationsSpy).toHaveBeenCalledWith(null);
  });

  it("filters thread lifecycle notifications by thread id", () => {
    render(
      <DebugAppServerCoverageThreadLifecycleNotificationsSection
        isRunningCoverageAction={false}
        lastThreadLifecycleNotificationsResult={{
          sinceSequence: 5,
          eventCount: 2,
          nextSequence: 9,
          firstAvailableSequence: 1,
          resetRequired: false,
          events: [
            {
              method: "thread/name/updated",
              sequence: 6,
              threadId: "thread-alpha",
              threadName: "Alpha",
              threadStatusType: null,
              threadActiveFlags: [],
              receivedAtMilliseconds: 17_200,
            },
            {
              method: "thread/archived",
              sequence: 7,
              threadId: "thread-beta",
              threadName: null,
              threadStatusType: null,
              threadActiveFlags: [],
              receivedAtMilliseconds: 17_210,
            },
          ],
          methodCounts: [
            {
              method: "thread/archived",
              count: 1,
            },
            {
              method: "thread/name/updated",
              count: 1,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadThreadLifecycleNotifications={() => {}}
      />,
    );

    fireEvent.change(
      screen.getByTestId("debug-coverage-thread-lifecycle-notifications-thread-filter"),
      {
        target: { value: "beta" },
      },
    );

    expect(
      screen.getByTestId("debug-coverage-thread-lifecycle-notifications-filter-summary")
        .textContent,
    ).toContain("Showing 1 of 2 thread-lifecycle notifications");
    expect(screen.queryByTestId("debug-coverage-thread-lifecycle-notification-6")).toBeNull();
  });
});
