import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugAppServerCoverageFuzzySessionNotificationsSection } from "@/Features/Debugging/UserInterface/DebugAppServerCoverageFuzzySessionNotificationsSection";

afterEach(() => {
  cleanup();
});

describe("DebugAppServerCoverageFuzzySessionNotificationsSection", () => {
  it("reads fuzzy session notifications when the action button is clicked", () => {
    const readFuzzySessionNotificationsSpy = vi.fn((_sinceSequence?: number | null) => {});

    render(
      <DebugAppServerCoverageFuzzySessionNotificationsSection
        isRunningCoverageAction={false}
        lastFuzzySessionNotificationsResult={null}
        onReadFuzzySessionNotifications={readFuzzySessionNotificationsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-fuzzy-session-notifications-read"));

    expect(readFuzzySessionNotificationsSpy).toHaveBeenCalledWith(null);
  });

  it("filters fuzzy session notifications by method input", () => {
    render(
      <DebugAppServerCoverageFuzzySessionNotificationsSection
        isRunningCoverageAction={false}
        lastFuzzySessionNotificationsResult={{
          sinceSequence: 10,
          eventCount: 2,
          nextSequence: 14,
          firstAvailableSequence: 3,
          resetRequired: false,
          events: [
            {
              method: "fuzzyFileSearch/sessionUpdated",
              sequence: 12,
              sessionId: "fuzzy-session-1",
              query: "main",
              fileCount: 2,
              receivedAtMilliseconds: 17_500,
            },
            {
              method: "fuzzyFileSearch/sessionCompleted",
              sequence: 13,
              sessionId: "fuzzy-session-1",
              query: null,
              fileCount: null,
              receivedAtMilliseconds: 17_600,
            },
          ],
          methodCounts: [
            {
              method: "fuzzyFileSearch/sessionUpdated",
              count: 1,
            },
            {
              method: "fuzzyFileSearch/sessionCompleted",
              count: 1,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadFuzzySessionNotifications={() => {}}
      />,
    );

    fireEvent.change(
      screen.getByTestId("debug-coverage-fuzzy-session-notifications-method-filter"),
      {
        target: { value: "sessionCompleted" },
      },
    );

    expect(
      screen.getByTestId("debug-coverage-fuzzy-session-notifications-filter-summary").textContent,
    ).toContain("Showing 1 of 2 session notifications");
    expect(screen.queryByTestId("debug-coverage-fuzzy-session-notification-12")).toBeNull();
  });

  it("sets method filter from method-count buttons", () => {
    render(
      <DebugAppServerCoverageFuzzySessionNotificationsSection
        isRunningCoverageAction={false}
        lastFuzzySessionNotificationsResult={{
          sinceSequence: null,
          eventCount: 1,
          nextSequence: 3,
          firstAvailableSequence: 1,
          resetRequired: false,
          events: [
            {
              method: "fuzzyFileSearch/sessionCompleted",
              sequence: 2,
              sessionId: "fuzzy-session-1",
              query: null,
              fileCount: null,
              receivedAtMilliseconds: 17_100,
            },
          ],
          methodCounts: [
            {
              method: "fuzzyFileSearch/sessionCompleted",
              count: 1,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadFuzzySessionNotifications={() => {}}
      />,
    );

    fireEvent.click(
      screen.getByTestId(
        "debug-coverage-fuzzy-session-notifications-method-count-fuzzyFileSearch-sessionCompleted",
      ),
    );

    expect(
      (
        screen.getByTestId(
          "debug-coverage-fuzzy-session-notifications-method-filter",
        ) as HTMLInputElement
      ).value,
    ).toBe("fuzzyFileSearch/sessionCompleted");
  });
});
