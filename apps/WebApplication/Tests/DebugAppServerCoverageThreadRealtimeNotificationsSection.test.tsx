import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugAppServerCoverageThreadRealtimeNotificationsSection } from "@/Features/Debugging/UserInterface/DebugAppServerCoverageThreadRealtimeNotificationsSection";

afterEach(() => {
  cleanup();
});

describe("DebugAppServerCoverageThreadRealtimeNotificationsSection", () => {
  it("reads thread realtime notifications when the action button is clicked", () => {
    const readThreadRealtimeNotificationsSpy = vi.fn((_sinceSequence?: number | null) => {});

    render(
      <DebugAppServerCoverageThreadRealtimeNotificationsSection
        isRunningCoverageAction={false}
        lastThreadRealtimeNotificationsResult={null}
        onReadThreadRealtimeNotifications={readThreadRealtimeNotificationsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-thread-realtime-notifications-read"));

    expect(readThreadRealtimeNotificationsSpy).toHaveBeenCalledWith(null);
  });

  it("filters thread realtime notifications by method", () => {
    render(
      <DebugAppServerCoverageThreadRealtimeNotificationsSection
        isRunningCoverageAction={false}
        lastThreadRealtimeNotificationsResult={{
          sinceSequence: 70,
          eventCount: 2,
          nextSequence: 73,
          firstAvailableSequence: 10,
          resetRequired: false,
          events: [
            {
              method: "thread/realtime/started",
              sequence: 71,
              threadId: "thread-live-1",
              sessionId: "session-22",
              itemPreview: null,
              audioDataLength: null,
              audioSampleRate: null,
              audioNumChannels: null,
              audioSamplesPerChannel: null,
              errorMessage: null,
              closeReason: null,
              receivedAtMilliseconds: 18_100,
            },
            {
              method: "thread/realtime/error",
              sequence: 72,
              threadId: "thread-live-1",
              sessionId: null,
              itemPreview: null,
              audioDataLength: null,
              audioSampleRate: null,
              audioNumChannels: null,
              audioSamplesPerChannel: null,
              errorMessage: "audio transport interrupted",
              closeReason: null,
              receivedAtMilliseconds: 18_110,
            },
          ],
          methodCounts: [
            {
              method: "thread/realtime/error",
              count: 1,
            },
            {
              method: "thread/realtime/started",
              count: 1,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadThreadRealtimeNotifications={() => {}}
      />,
    );

    fireEvent.change(
      screen.getByTestId("debug-coverage-thread-realtime-notifications-method-filter"),
      {
        target: { value: "error" },
      },
    );

    expect(
      screen.getByTestId("debug-coverage-thread-realtime-notifications-filter-summary").textContent,
    ).toContain("Showing 1 of 2 thread-realtime notifications");
    expect(screen.queryByTestId("debug-coverage-thread-realtime-notification-71")).toBeNull();
  });
});
