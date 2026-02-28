import type { IpcFrame } from "@farfield/protocol";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useStreamEventCards } from "@/Application/StateManagement/UseApplicationPresentationHelpers";

interface StreamEventCardsHarnessProps {
  streamEvents: IpcFrame[];
  streamEventCardsEnabled: boolean;
}

function buildEvent(method: string): IpcFrame {
  return {
    type: "broadcast",
    method,
    params: {},
  };
}

function StreamEventCardsHarness({
  streamEvents,
  streamEventCardsEnabled,
}: StreamEventCardsHarnessProps): React.JSX.Element {
  const streamEventCards = useStreamEventCards({
    streamEvents,
    streamEventCardsEnabled,
  });
  return <div data-testid="stream-event-cards-harness">{streamEventCards}</div>;
}

describe("UseApplicationPresentationHelpers", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps retained stream-event card nodes stable when retention windows shift", () => {
    const initialEvents = Array.from({ length: 400 }, (_, index) =>
      buildEvent(`event-${String(index)}`),
    );

    const { rerender } = render(
      <StreamEventCardsHarness streamEvents={initialEvents} streamEventCardsEnabled />,
    );

    const retainedCardBefore = screen
      .getByText("event-1")
      .closest('[data-testid="stream-event-card"]');
    expect(retainedCardBefore).not.toBeNull();

    const shiftedEvents = initialEvents.slice(1).concat(buildEvent("event-400"));
    rerender(<StreamEventCardsHarness streamEvents={shiftedEvents} streamEventCardsEnabled />);

    const retainedCardAfter = screen
      .getByText("event-1")
      .closest('[data-testid="stream-event-card"]');
    expect(retainedCardAfter).toBe(retainedCardBefore);
    expect(screen.queryByText("event-0")).toBeNull();
    expect(screen.getByText("event-400")).toBeDefined();
  });

  it("returns no stream-event cards while the stream debug section is hidden", () => {
    const streamEvents = [buildEvent("event-1"), buildEvent("event-2")];

    const { rerender } = render(
      <StreamEventCardsHarness streamEvents={streamEvents} streamEventCardsEnabled={false} />,
    );

    expect(screen.queryAllByTestId("stream-event-card")).toHaveLength(0);

    rerender(<StreamEventCardsHarness streamEvents={streamEvents} streamEventCardsEnabled />);
    expect(screen.getAllByTestId("stream-event-card")).toHaveLength(2);
  });
});
