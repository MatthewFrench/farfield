import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugAppServerCoverageServerRequestResolvedEventsSection } from "@/Features/Debugging/UserInterface/DebugAppServerCoverageServerRequestResolvedEventsSection";

afterEach(() => {
  cleanup();
});

describe("DebugAppServerCoverageServerRequestResolvedEventsSection", () => {
  it("reads resolved events when the action button is clicked", () => {
    const readServerRequestResolvedEventsSpy = vi.fn((_sinceSequence?: number | null) => {});

    render(
      <DebugAppServerCoverageServerRequestResolvedEventsSection
        isRunningCoverageAction={false}
        lastServerRequestResolvedEventsResult={null}
        onReadServerRequestResolvedEvents={readServerRequestResolvedEventsSpy}
        onReadPendingServerRequests={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-server-request-resolved-events-read"));

    expect(readServerRequestResolvedEventsSpy).toHaveBeenCalledWith(null);
  });

  it("refreshes pending requests when refresh button is clicked", () => {
    const readPendingServerRequestsSpy = vi.fn(() => {});

    render(
      <DebugAppServerCoverageServerRequestResolvedEventsSection
        isRunningCoverageAction={false}
        lastServerRequestResolvedEventsResult={null}
        onReadServerRequestResolvedEvents={() => {}}
        onReadPendingServerRequests={readPendingServerRequestsSpy}
      />,
    );

    fireEvent.click(
      screen.getByTestId("debug-coverage-server-request-resolved-events-refresh-pending"),
    );

    expect(readPendingServerRequestsSpy).toHaveBeenCalledTimes(1);
  });

  it("filters resolved events by thread id", () => {
    render(
      <DebugAppServerCoverageServerRequestResolvedEventsSection
        isRunningCoverageAction={false}
        lastServerRequestResolvedEventsResult={{
          sinceSequence: 12,
          eventCount: 2,
          nextSequence: 20,
          firstAvailableSequence: 5,
          resetRequired: false,
          events: [
            {
              sequence: 13,
              requestId: 91,
              threadId: "thread-alpha",
              receivedAtMilliseconds: 17_100,
            },
            {
              sequence: 14,
              requestId: 92,
              threadId: "thread-beta",
              receivedAtMilliseconds: 17_200,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadServerRequestResolvedEvents={() => {}}
        onReadPendingServerRequests={() => {}}
      />,
    );

    fireEvent.change(
      screen.getByTestId("debug-coverage-server-request-resolved-events-thread-filter"),
      {
        target: { value: "beta" },
      },
    );

    expect(
      screen.getByTestId("debug-coverage-server-request-resolved-events-filter-summary")
        .textContent,
    ).toContain("Showing 1 of 2 resolved events");
    expect(screen.queryByTestId("debug-coverage-server-request-resolved-event-13")).toBeNull();
  });
});
