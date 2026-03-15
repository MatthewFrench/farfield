import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugAppServerCoverageItemDeltaNotificationsSection } from "@/Features/Debugging/UserInterface/DebugAppServerCoverageItemDeltaNotificationsSection";

afterEach(() => {
  cleanup();
});

describe("DebugAppServerCoverageItemDeltaNotificationsSection", () => {
  it("reads item delta notifications when the action button is clicked", () => {
    const readItemDeltaNotificationsSpy = vi.fn((_sinceSequence?: number | null) => {});

    render(
      <DebugAppServerCoverageItemDeltaNotificationsSection
        isRunningCoverageAction={false}
        lastItemDeltaNotificationsResult={null}
        onReadItemDeltaNotifications={readItemDeltaNotificationsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-item-delta-notifications-read"));

    expect(readItemDeltaNotificationsSpy).toHaveBeenCalledWith(null);
  });

  it("filters item delta notifications by item id", () => {
    render(
      <DebugAppServerCoverageItemDeltaNotificationsSection
        isRunningCoverageAction={false}
        lastItemDeltaNotificationsResult={{
          sinceSequence: 29,
          eventCount: 2,
          totalDetailCharacterCount: 18,
          nextSequence: 33,
          firstAvailableSequence: 1,
          resetRequired: false,
          events: [
            {
              method: "item/agentMessage/delta",
              sequence: 30,
              threadId: "thread-alpha",
              turnId: "turn-1",
              itemId: "item-agent",
              detailText: "hello",
              detailIndex: null,
              processId: null,
              receivedAtMilliseconds: 17_200,
            },
            {
              method: "item/commandExecution/outputDelta",
              sequence: 31,
              threadId: "thread-alpha",
              turnId: "turn-1",
              itemId: "item-command",
              detailText: "build complete",
              detailIndex: null,
              processId: null,
              receivedAtMilliseconds: 17_210,
            },
          ],
          methodCounts: [
            {
              method: "item/agentMessage/delta",
              count: 1,
            },
            {
              method: "item/commandExecution/outputDelta",
              count: 1,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadItemDeltaNotifications={() => {}}
      />,
    );

    fireEvent.change(screen.getByTestId("debug-coverage-item-delta-notifications-item-filter"), {
      target: { value: "command" },
    });

    expect(
      screen.getByTestId("debug-coverage-item-delta-notifications-filter-summary").textContent,
    ).toContain("Showing 1 of 2 item-delta notifications");
    expect(screen.queryByTestId("debug-coverage-item-delta-notification-30")).toBeNull();
  });
});
