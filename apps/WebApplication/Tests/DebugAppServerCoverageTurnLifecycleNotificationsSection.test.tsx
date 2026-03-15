import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugAppServerCoverageTurnLifecycleNotificationsSection } from "@/Features/Debugging/UserInterface/DebugAppServerCoverageTurnLifecycleNotificationsSection";

afterEach(() => {
  cleanup();
});

describe("DebugAppServerCoverageTurnLifecycleNotificationsSection", () => {
  it("reads turn lifecycle notifications when the action button is clicked", () => {
    const readTurnLifecycleNotificationsSpy = vi.fn((_sinceSequence?: number | null) => {});

    render(
      <DebugAppServerCoverageTurnLifecycleNotificationsSection
        isRunningCoverageAction={false}
        lastTurnLifecycleNotificationsResult={null}
        onReadTurnLifecycleNotifications={readTurnLifecycleNotificationsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-turn-lifecycle-notifications-read"));

    expect(readTurnLifecycleNotificationsSpy).toHaveBeenCalledWith(null);
  });

  it("filters turn lifecycle notifications by method", () => {
    render(
      <DebugAppServerCoverageTurnLifecycleNotificationsSection
        isRunningCoverageAction={false}
        lastTurnLifecycleNotificationsResult={{
          sinceSequence: 25,
          eventCount: 2,
          nextSequence: 29,
          firstAvailableSequence: 1,
          resetRequired: false,
          events: [
            {
              method: "turn/started",
              sequence: 26,
              threadId: "thread-alpha",
              turnId: "turn-1",
              turnStatus: "inProgress",
              errorMessage: null,
              planStepCount: null,
              diffLineCount: null,
              explanation: null,
              receivedAtMilliseconds: 17_200,
            },
            {
              method: "turn/plan/updated",
              sequence: 27,
              threadId: "thread-alpha",
              turnId: "turn-1",
              turnStatus: null,
              errorMessage: null,
              planStepCount: 2,
              diffLineCount: null,
              explanation: "Implement diagnostics",
              receivedAtMilliseconds: 17_210,
            },
          ],
          methodCounts: [
            {
              method: "turn/plan/updated",
              count: 1,
            },
            {
              method: "turn/started",
              count: 1,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadTurnLifecycleNotifications={() => {}}
      />,
    );

    fireEvent.change(
      screen.getByTestId("debug-coverage-turn-lifecycle-notifications-method-filter"),
      {
        target: { value: "turn/plan" },
      },
    );

    expect(
      screen.getByTestId("debug-coverage-turn-lifecycle-notifications-filter-summary").textContent,
    ).toContain("Showing 1 of 2 turn-lifecycle notifications");
    expect(screen.queryByTestId("debug-coverage-turn-lifecycle-notification-26")).toBeNull();
  });
});
