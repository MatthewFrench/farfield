import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugAppServerCoverageNotificationEventsSection } from "@/Features/Debugging/UserInterface/DebugAppServerCoverageNotificationEventsSection";

afterEach(() => {
  cleanup();
});

describe("DebugAppServerCoverageNotificationEventsSection", () => {
  it("reads notification events with no since-sequence when input is blank", () => {
    const readNotificationEventsSpy = vi.fn((_sinceSequence?: number | null) => {});

    render(
      <DebugAppServerCoverageNotificationEventsSection
        isRunningCoverageAction={false}
        lastNotificationEventsResult={null}
        onReadNotificationEvents={readNotificationEventsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-notification-events-read"));

    expect(readNotificationEventsSpy).toHaveBeenCalledTimes(1);
    expect(readNotificationEventsSpy).toHaveBeenCalledWith(null);
  });

  it("rejects invalid since-sequence input", () => {
    const readNotificationEventsSpy = vi.fn((_sinceSequence?: number | null) => {});

    render(
      <DebugAppServerCoverageNotificationEventsSection
        isRunningCoverageAction={false}
        lastNotificationEventsResult={null}
        onReadNotificationEvents={readNotificationEventsSpy}
      />,
    );

    fireEvent.change(screen.getByTestId("debug-coverage-notification-events-since-sequence"), {
      target: { value: "-3" },
    });
    fireEvent.click(screen.getByTestId("debug-coverage-notification-events-read"));

    expect(readNotificationEventsSpy).not.toHaveBeenCalled();
  });

  it("reads from next cursor and reset-required controls", () => {
    const readNotificationEventsSpy = vi.fn((_sinceSequence?: number | null) => {});

    render(
      <DebugAppServerCoverageNotificationEventsSection
        isRunningCoverageAction={false}
        lastNotificationEventsResult={{
          sinceSequence: 10,
          eventCount: 1,
          nextSequence: 22,
          firstAvailableSequence: 11,
          resetRequired: true,
          methodCounts: [
            {
              method: "turn/completed",
              count: 1,
            },
          ],
          events: [
            {
              method: "turn/completed",
              sequence: 21,
              receivedAtMilliseconds: 17_500,
              preview: '{"status":"done"}',
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadNotificationEvents={readNotificationEventsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-notification-events-read-next-cursor"));
    fireEvent.click(screen.getByTestId("debug-coverage-notification-events-read-reset"));

    expect(readNotificationEventsSpy).toHaveBeenNthCalledWith(1, 22);
    expect(readNotificationEventsSpy).toHaveBeenNthCalledWith(2, null);
  });

  it("filters notification events by method input", () => {
    render(
      <DebugAppServerCoverageNotificationEventsSection
        isRunningCoverageAction={false}
        lastNotificationEventsResult={{
          sinceSequence: null,
          eventCount: 2,
          nextSequence: 8,
          firstAvailableSequence: 1,
          resetRequired: false,
          methodCounts: [
            {
              method: "turn/started",
              count: 1,
            },
            {
              method: "thread/started",
              count: 1,
            },
          ],
          events: [
            {
              method: "turn/started",
              sequence: 6,
              receivedAtMilliseconds: 17_000,
              preview: '{"threadId":"thread-1"}',
            },
            {
              method: "thread/started",
              sequence: 7,
              receivedAtMilliseconds: 17_100,
              preview: '{"threadId":"thread-1"}',
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadNotificationEvents={() => {}}
      />,
    );

    fireEvent.change(screen.getByTestId("debug-coverage-notification-events-method-filter"), {
      target: { value: "turn/" },
    });

    expect(
      screen.getByTestId("debug-coverage-notification-events-filter-summary").textContent,
    ).toBe("Filtered events: 1 of 2");
    expect(screen.queryByTestId("debug-coverage-notification-events-event-1")).toBeNull();
  });
});
