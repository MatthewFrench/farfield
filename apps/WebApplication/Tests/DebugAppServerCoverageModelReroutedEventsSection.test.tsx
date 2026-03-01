import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugAppServerCoverageModelReroutedEventsSection } from "@/Features/Debugging/UserInterface/DebugAppServerCoverageModelReroutedEventsSection";

afterEach(() => {
  cleanup();
});

describe("DebugAppServerCoverageModelReroutedEventsSection", () => {
  it("reads model-rerouted events when the action button is clicked", () => {
    const readModelReroutedEventsSpy = vi.fn((_sinceSequence?: number | null) => {});

    render(
      <DebugAppServerCoverageModelReroutedEventsSection
        isRunningCoverageAction={false}
        lastModelReroutedEventsResult={null}
        onReadModelReroutedEvents={readModelReroutedEventsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-model-rerouted-events-read"));

    expect(readModelReroutedEventsSpy).toHaveBeenCalledWith(null);
  });

  it("filters model-rerouted events by thread id", () => {
    render(
      <DebugAppServerCoverageModelReroutedEventsSection
        isRunningCoverageAction={false}
        lastModelReroutedEventsResult={{
          sinceSequence: 12,
          eventCount: 2,
          nextSequence: 30,
          firstAvailableSequence: 2,
          resetRequired: false,
          events: [
            {
              sequence: 13,
              threadId: "thread-alpha",
              turnId: "turn-1",
              fromModel: "gpt-5",
              toModel: "gpt-5-mini",
              reason: "highRiskCyberActivity",
              receivedAtMilliseconds: 17_100,
            },
            {
              sequence: 14,
              threadId: "thread-beta",
              turnId: "turn-2",
              fromModel: "gpt-5",
              toModel: "gpt-5-mini",
              reason: "highRiskCyberActivity",
              receivedAtMilliseconds: 17_200,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadModelReroutedEvents={() => {}}
      />,
    );

    fireEvent.change(screen.getByTestId("debug-coverage-model-rerouted-events-thread-filter"), {
      target: { value: "beta" },
    });

    expect(
      screen.getByTestId("debug-coverage-model-rerouted-events-filter-summary").textContent,
    ).toContain("Showing 1 of 2 model reroute events");
    expect(screen.queryByTestId("debug-coverage-model-rerouted-event-13")).toBeNull();
  });
});
