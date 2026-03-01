import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("filters rendered events by selected method count chip", () => {
    const readThreadStreamEventsSpy = vi.fn(
      (_threadId: string, _sinceSequence?: number | null) => {},
    );

    render(
      <DebugAppServerCoverageThreadStreamEventsSection
        isRunningCoverageAction={false}
        lastThreadStreamEventsResult={{
          threadId: "thread-stream-filter",
          sinceSequence: null,
          ownerClientId: "client-owner",
          eventCount: 2,
          nextSequence: 50,
          firstAvailableSequence: 10,
          resetRequired: false,
          methodCounts: [
            {
              method: "turn/completed",
              count: 1,
            },
            {
              method: "thread/started",
              count: 1,
            },
          ],
          events: [
            {
              frameType: "broadcast",
              method: "turn/completed",
              requestId: null,
              sourceClientId: "client-codex",
              sequence: 49,
              receivedAtMilliseconds: 17_500,
              preview: '{"event":"turn-done"}',
            },
            {
              frameType: "broadcast",
              method: "thread/started",
              requestId: null,
              sourceClientId: "client-codex",
              sequence: 50,
              receivedAtMilliseconds: 17_600,
              preview: '{"event":"thread-started"}',
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadThreadStreamEvents={readThreadStreamEventsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-thread-stream-method-count-turn/completed"));

    expect(
      (screen.getByTestId("debug-coverage-thread-stream-method-filter") as HTMLInputElement).value,
    ).toBe("turn/completed");
    expect(screen.getByText("Filtered events: 1 of 2")).toBeDefined();
    expect(screen.getByText("broadcast • turn/completed")).toBeDefined();
    expect(screen.queryByText("broadcast • thread/started")).toBeNull();

    fireEvent.click(screen.getByTestId("debug-coverage-thread-stream-method-count-all"));
    expect(
      (screen.getByTestId("debug-coverage-thread-stream-method-filter") as HTMLInputElement).value,
    ).toBe("");
    expect(screen.queryByTestId("debug-coverage-thread-stream-filter-summary")).toBeNull();
    expect(screen.getByText("broadcast • thread/started")).toBeDefined();
  });

  it("shows explicit empty-filter feedback when no events match", () => {
    const readThreadStreamEventsSpy = vi.fn(
      (_threadId: string, _sinceSequence?: number | null) => {},
    );

    render(
      <DebugAppServerCoverageThreadStreamEventsSection
        isRunningCoverageAction={false}
        lastThreadStreamEventsResult={{
          threadId: "thread-stream-filter-empty",
          sinceSequence: null,
          ownerClientId: "client-owner",
          eventCount: 1,
          nextSequence: 75,
          firstAvailableSequence: 70,
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
              sequence: 74,
              receivedAtMilliseconds: 20_100,
              preview: '{"event":"turn-done"}',
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadThreadStreamEvents={readThreadStreamEventsSpy}
      />,
    );

    fireEvent.change(screen.getByTestId("debug-coverage-thread-stream-method-filter"), {
      target: { value: "item/commandExecution/outputDelta" },
    });

    expect(screen.getByText("Filtered events: 0 of 1")).toBeDefined();
    expect(screen.getByText("No frames match the current method filter.")).toBeDefined();
    expect(screen.queryByText("broadcast • turn/completed")).toBeNull();
  });

  it("filters rendered events by frame type and clears both filters", () => {
    const readThreadStreamEventsSpy = vi.fn(
      (_threadId: string, _sinceSequence?: number | null) => {},
    );

    render(
      <DebugAppServerCoverageThreadStreamEventsSection
        isRunningCoverageAction={false}
        lastThreadStreamEventsResult={{
          threadId: "thread-stream-frame-filter",
          sinceSequence: null,
          ownerClientId: "client-owner",
          eventCount: 2,
          nextSequence: 80,
          firstAvailableSequence: 60,
          resetRequired: false,
          methodCounts: [
            {
              method: "item/tool/call",
              count: 1,
            },
            {
              method: "turn/completed",
              count: 1,
            },
          ],
          events: [
            {
              frameType: "request",
              method: "item/tool/call",
              requestId: "request-1",
              sourceClientId: "client-router",
              sequence: null,
              receivedAtMilliseconds: null,
              preview: '{"tool":"list_files"}',
            },
            {
              frameType: "broadcast",
              method: "turn/completed",
              requestId: null,
              sourceClientId: "client-codex",
              sequence: 79,
              receivedAtMilliseconds: 22_000,
              preview: '{"turn":"completed"}',
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadThreadStreamEvents={readThreadStreamEventsSpy}
      />,
    );

    fireEvent.change(screen.getByTestId("debug-coverage-thread-stream-frame-type-filter"), {
      target: { value: "request" },
    });

    expect(screen.getByText("Filtered events: 1 of 2")).toBeDefined();
    expect(screen.getByText("request • item/tool/call")).toBeDefined();
    expect(screen.queryByText("broadcast • turn/completed")).toBeNull();

    fireEvent.click(screen.getByTestId("debug-coverage-thread-stream-method-filter-clear"));
    expect(
      (screen.getByTestId("debug-coverage-thread-stream-method-filter") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (screen.getByTestId("debug-coverage-thread-stream-frame-type-filter") as HTMLSelectElement)
        .value,
    ).toBe("all");
    expect(screen.queryByTestId("debug-coverage-thread-stream-filter-summary")).toBeNull();
    expect(screen.getByText("broadcast • turn/completed")).toBeDefined();
  });

  it("copies the filtered event payload to clipboard as json", async () => {
    const readThreadStreamEventsSpy = vi.fn(
      (_threadId: string, _sinceSequence?: number | null) => {},
    );
    const writeTextSpy = vi.fn(async (_text: string): Promise<void> => {});
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextSpy,
      },
      configurable: true,
    });

    try {
      render(
        <DebugAppServerCoverageThreadStreamEventsSection
          isRunningCoverageAction={false}
          lastThreadStreamEventsResult={{
            threadId: "thread-stream-copy",
            sinceSequence: 10,
            ownerClientId: "client-owner",
            eventCount: 1,
            nextSequence: 11,
            firstAvailableSequence: 1,
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
                sequence: 10,
                receivedAtMilliseconds: 20_000,
                preview: '{"event":"turn-done"}',
              },
            ],
            readAtIso8601: "2026-03-01T00:00:00.000Z",
          }}
          onReadThreadStreamEvents={readThreadStreamEventsSpy}
        />,
      );

      fireEvent.click(screen.getByTestId("debug-coverage-thread-stream-copy-filtered-json"));

      await waitFor(() => {
        expect(writeTextSpy).toHaveBeenCalledTimes(1);
      });
      expect(writeTextSpy.mock.calls[0]?.[0]).toContain('"threadId": "thread-stream-copy"');
      expect(writeTextSpy.mock.calls[0]?.[0]).toContain('"filteredEventCount": 1');
      expect(screen.getByTestId("debug-coverage-thread-stream-copy-status").textContent).toBe(
        "Copied 1 filtered event.",
      );
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        configurable: true,
      });
    }
  });
});
