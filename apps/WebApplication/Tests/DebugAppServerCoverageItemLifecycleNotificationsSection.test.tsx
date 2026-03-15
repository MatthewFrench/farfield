import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugAppServerCoverageItemLifecycleNotificationsSection } from "@/Features/Debugging/UserInterface/DebugAppServerCoverageItemLifecycleNotificationsSection";

afterEach(() => {
  cleanup();
});

describe("DebugAppServerCoverageItemLifecycleNotificationsSection", () => {
  it("reads item lifecycle notifications when the action button is clicked", () => {
    const readItemLifecycleNotificationsSpy = vi.fn((_sinceSequence?: number | null) => {});

    render(
      <DebugAppServerCoverageItemLifecycleNotificationsSection
        isRunningCoverageAction={false}
        lastItemLifecycleNotificationsResult={null}
        onReadItemLifecycleNotifications={readItemLifecycleNotificationsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-item-lifecycle-notifications-read"));

    expect(readItemLifecycleNotificationsSpy).toHaveBeenCalledWith(null);
  });

  it("filters item lifecycle notifications by thread id", () => {
    render(
      <DebugAppServerCoverageItemLifecycleNotificationsSection
        isRunningCoverageAction={false}
        lastItemLifecycleNotificationsResult={{
          sinceSequence: 33,
          eventCount: 2,
          nextSequence: 36,
          firstAvailableSequence: 1,
          resetRequired: false,
          events: [
            {
              method: "item/started",
              sequence: 34,
              threadId: "thread-alpha",
              turnId: "turn-1",
              itemId: "item-1",
              itemType: "agentMessage",
              receivedAtMilliseconds: 17_200,
            },
            {
              method: "item/completed",
              sequence: 35,
              threadId: "thread-beta",
              turnId: "turn-2",
              itemId: "item-2",
              itemType: "commandExecution",
              receivedAtMilliseconds: 17_210,
            },
          ],
          methodCounts: [
            {
              method: "item/completed",
              count: 1,
            },
            {
              method: "item/started",
              count: 1,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadItemLifecycleNotifications={() => {}}
      />,
    );

    fireEvent.change(
      screen.getByTestId("debug-coverage-item-lifecycle-notifications-thread-filter"),
      {
        target: { value: "beta" },
      },
    );

    expect(
      screen.getByTestId("debug-coverage-item-lifecycle-notifications-filter-summary").textContent,
    ).toContain("Showing 1 of 2 item-lifecycle notifications");
    expect(screen.queryByTestId("debug-coverage-item-lifecycle-notification-34")).toBeNull();
  });
});
