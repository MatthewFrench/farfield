import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugAppServerCoverageThreadStreamEventsSection } from "@/Features/Debugging/UserInterface/DebugAppServerCoverageThreadStreamEventsSection";

afterEach(() => {
  cleanup();
});

describe("DebugAppServerCoverageThreadStreamEventsSection", () => {
  it("reads stream events with a trimmed thread id and no since-sequence when blank", () => {
    const readThreadStreamEventsSpy = vi.fn(
      (_threadId: string, _sinceSequence?: number | null) => {},
    );

    render(
      <DebugAppServerCoverageThreadStreamEventsSection
        isRunningCoverageAction={false}
        lastThreadStreamEventsResult={null}
        onReadThreadStreamEvents={readThreadStreamEventsSpy}
      />,
    );

    fireEvent.change(screen.getByTestId("debug-coverage-thread-stream-thread-id"), {
      target: { value: "  thread-42  " },
    });
    fireEvent.click(screen.getByTestId("debug-coverage-thread-stream-read"));

    expect(readThreadStreamEventsSpy).toHaveBeenCalledTimes(1);
    expect(readThreadStreamEventsSpy).toHaveBeenCalledWith("thread-42", null);
  });

  it("rejects invalid since-sequence input", () => {
    const readThreadStreamEventsSpy = vi.fn(
      (_threadId: string, _sinceSequence?: number | null) => {},
    );

    render(
      <DebugAppServerCoverageThreadStreamEventsSection
        isRunningCoverageAction={false}
        lastThreadStreamEventsResult={null}
        onReadThreadStreamEvents={readThreadStreamEventsSpy}
      />,
    );

    fireEvent.change(screen.getByTestId("debug-coverage-thread-stream-thread-id"), {
      target: { value: "thread-99" },
    });
    fireEvent.change(screen.getByTestId("debug-coverage-thread-stream-since-sequence"), {
      target: { value: "-1" },
    });
    fireEvent.click(screen.getByTestId("debug-coverage-thread-stream-read"));

    expect(readThreadStreamEventsSpy).not.toHaveBeenCalled();
  });

  it("reads from the next cursor when result state exists", () => {
    const readThreadStreamEventsSpy = vi.fn(
      (_threadId: string, _sinceSequence?: number | null) => {},
    );

    render(
      <DebugAppServerCoverageThreadStreamEventsSection
        isRunningCoverageAction={false}
        lastThreadStreamEventsResult={{
          threadId: "thread-stream-1",
          sinceSequence: null,
          ownerClientId: "client-owner",
          eventCount: 1,
          nextSequence: 22,
          firstAvailableSequence: 4,
          resetRequired: false,
          methodCounts: [
            {
              method: "turn/completed",
              count: 1,
            },
          ],
          events: [
            {
              frameType: "broadcast",
              method: "turn/completed",
              requestId: null,
              sourceClientId: "client-codex",
              sequence: 21,
              receivedAtMilliseconds: 14_500,
              preview: '{"sequence":21}',
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadThreadStreamEvents={readThreadStreamEventsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-thread-stream-read-next-cursor"));

    expect(readThreadStreamEventsSpy).toHaveBeenCalledTimes(1);
    expect(readThreadStreamEventsSpy).toHaveBeenCalledWith("thread-stream-1", 22);
    expect(
      screen.getByTestId("debug-coverage-thread-stream-method-count-turn/completed"),
    ).toBeDefined();
  });

  it("renders reset-required controls and triggers a cursor-reset read", () => {
    const readThreadStreamEventsSpy = vi.fn(
      (_threadId: string, _sinceSequence?: number | null) => {},
    );

    render(
      <DebugAppServerCoverageThreadStreamEventsSection
        isRunningCoverageAction={false}
        lastThreadStreamEventsResult={{
          threadId: "thread-stream-reset",
          sinceSequence: 100,
          ownerClientId: "client-owner",
          eventCount: 0,
          nextSequence: 130,
          firstAvailableSequence: 120,
          resetRequired: true,
          methodCounts: [],
          events: [],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadThreadStreamEvents={readThreadStreamEventsSpy}
      />,
    );

    expect(screen.getByTestId("debug-coverage-thread-stream-reset-required")).toBeDefined();
    fireEvent.click(screen.getByTestId("debug-coverage-thread-stream-read-reset"));

    expect(readThreadStreamEventsSpy).toHaveBeenCalledTimes(1);
    expect(readThreadStreamEventsSpy).toHaveBeenCalledWith("thread-stream-reset", null);
  });
});
