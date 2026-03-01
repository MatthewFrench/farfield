import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugAppServerCoverageWarningNotificationsSection } from "@/Features/Debugging/UserInterface/DebugAppServerCoverageWarningNotificationsSection";

afterEach(() => {
  cleanup();
});

describe("DebugAppServerCoverageWarningNotificationsSection", () => {
  it("reads warning notifications when the action button is clicked", () => {
    const readWarningNotificationsSpy = vi.fn((_sinceSequence?: number | null) => {});

    render(
      <DebugAppServerCoverageWarningNotificationsSection
        isRunningCoverageAction={false}
        lastWarningNotificationsResult={null}
        onReadWarningNotifications={readWarningNotificationsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-warning-notifications-read"));

    expect(readWarningNotificationsSpy).toHaveBeenCalledWith(null);
  });

  it("filters warning notifications by method input", () => {
    render(
      <DebugAppServerCoverageWarningNotificationsSection
        isRunningCoverageAction={false}
        lastWarningNotificationsResult={{
          sinceSequence: 8,
          eventCount: 2,
          nextSequence: 12,
          firstAvailableSequence: 1,
          resetRequired: false,
          events: [
            {
              method: "configWarning",
              sequence: 9,
              summary: "Config contains deprecated setting",
              details: "Use model.default instead.",
              path: "/tmp/project/.codex/config.toml",
              range: {
                start: {
                  line: 4,
                  column: 5,
                },
                end: {
                  line: 4,
                  column: 22,
                },
              },
              receivedAtMilliseconds: 17_100,
            },
            {
              method: "windows/worldWritableWarning",
              sequence: 10,
              samplePaths: ["/tmp/project"],
              extraCount: 2,
              failedScan: false,
              receivedAtMilliseconds: 17_120,
            },
          ],
          methodCounts: [
            {
              method: "configWarning",
              count: 1,
            },
            {
              method: "windows/worldWritableWarning",
              count: 1,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadWarningNotifications={() => {}}
      />,
    );

    fireEvent.change(screen.getByTestId("debug-coverage-warning-notifications-method-filter"), {
      target: { value: "worldWritableWarning" },
    });

    expect(
      screen.getByTestId("debug-coverage-warning-notifications-filter-summary").textContent,
    ).toContain("Showing 1 of 2 warning notifications");
    expect(screen.queryByTestId("debug-coverage-warning-notification-9")).toBeNull();
  });
});
