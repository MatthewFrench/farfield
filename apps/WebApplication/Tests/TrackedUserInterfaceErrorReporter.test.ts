import { describe, expect, it, vi } from "vitest";
import { TrackedUserInterfaceErrorReporter } from "../Source/Features/Debugging/StateManagement/TrackedUserInterfaceErrorReporter";

describe("TrackedUserInterfaceErrorReporter", () => {
  it("reports client errors and writes a tagged error banner message", async () => {
    const setErrorMessage = vi.fn();
    const reportClientErrorFn = vi.fn(async () => ({
      ok: true as const,
      errorId: "error-123",
      sessionId: "session-1",
      recordedAt: "2026-01-01T00:00:00.000Z"
    }));
    const reporter = new TrackedUserInterfaceErrorReporter({
      setErrorMessage,
      reportClientErrorFn,
      readPathnameAndSearch: () => "/threads/thread-1?tab=chat"
    });

    await reporter.report({
      operation: "send-message",
      actionId: "action-1",
      threadId: "thread-1",
      error: new Error("failure requestId=req-7")
    });

    expect(reportClientErrorFn).toHaveBeenCalledTimes(1);
    expect(setErrorMessage).toHaveBeenCalledWith(
      "send-message: failure requestId=req-7 actionId=action-1 requestId=req-7 errorId=error-123"
    );
  });

  it("skips reporting ignored cancellation errors", async () => {
    const setErrorMessage = vi.fn();
    const reportClientErrorFn = vi.fn(async () => ({
      ok: true as const,
      errorId: "error-123",
      sessionId: "session-1",
      recordedAt: "2026-01-01T00:00:00.000Z"
    }));
    const reporter = new TrackedUserInterfaceErrorReporter({
      setErrorMessage,
      reportClientErrorFn
    });

    await reporter.report({
      operation: "send-message",
      actionId: "action-1",
      threadId: "thread-1",
      error: new Error("Request canceled for thread thread-1")
    });

    expect(reportClientErrorFn).not.toHaveBeenCalled();
    expect(setErrorMessage).not.toHaveBeenCalled();
  });

  it("still writes a tracked error message when remote error reporting fails", async () => {
    const setErrorMessage = vi.fn();
    const reportClientErrorFn = vi.fn(async () => {
      throw new Error("report-failed");
    });
    const reporter = new TrackedUserInterfaceErrorReporter({
      setErrorMessage,
      reportClientErrorFn
    });

    await reporter.report({
      operation: "archive-thread",
      actionId: "action-9",
      threadId: "thread-2",
      error: new Error("archive failed")
    });

    expect(setErrorMessage).toHaveBeenCalledWith(
      "archive-thread: archive failed actionId=action-9"
    );
  });
});
