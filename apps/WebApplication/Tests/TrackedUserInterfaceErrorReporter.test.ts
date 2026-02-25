import { describe, expect, it, vi } from "vitest";
import { TrackedUserInterfaceErrorReporter } from "../Source/Features/Debugging/StateManagement/TrackedUserInterfaceErrorReporter";

class StructuredRequestFailureError extends Error {
  public readonly requestFailureDetails: {
    path: string;
    status: number | null;
    statusText: string | null;
    requestId: string | null;
    responseText: string | null;
    responseTextLength: number | null;
    responseTextTruncated: boolean;
  };

  public constructor(input: {
    message: string;
    path: string;
    status: number | null;
    statusText: string | null;
    requestId: string | null;
    responseText: string | null;
    responseTextLength: number | null;
    responseTextTruncated: boolean;
  }) {
    super(input.message);
    this.requestFailureDetails = {
      path: input.path,
      status: input.status,
      statusText: input.statusText,
      requestId: input.requestId,
      responseText: input.responseText,
      responseTextLength: input.responseTextLength,
      responseTextTruncated: input.responseTextTruncated
    };
  }
}

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
      reportClientErrorFn,
      readPathnameAndSearch: () => "/"
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
      reportClientErrorFn,
      readPathnameAndSearch: () => "/"
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

  it("suppresses duplicate reports within the deduplication window", async () => {
    const setErrorMessage = vi.fn();
    const reportClientErrorFn = vi.fn(async () => ({
      ok: true as const,
      errorId: "error-777",
      sessionId: "session-1",
      recordedAt: "2026-01-01T00:00:00.000Z"
    }));
    let now = 10_000;
    const reporter = new TrackedUserInterfaceErrorReporter({
      setErrorMessage,
      reportClientErrorFn,
      readPathnameAndSearch: () => "/",
      readNow: () => now,
      reportDeduplicationWindowMs: 30_000
    });

    await reporter.report({
      operation: "core.load",
      actionId: "action-1",
      threadId: null,
      error: new Error("Request timed out for /api/health requestId req-1")
    });

    now += 500;
    await reporter.report({
      operation: "core.load",
      actionId: "action-2",
      threadId: null,
      error: new Error("Request timed out for /api/health requestId req-1")
    });

    expect(reportClientErrorFn).toHaveBeenCalledTimes(1);
    expect(setErrorMessage).toHaveBeenCalledTimes(1);
  });

  it("reports again after the deduplication window expires", async () => {
    const setErrorMessage = vi.fn();
    const reportClientErrorFn = vi.fn(async () => ({
      ok: true as const,
      errorId: "error-778",
      sessionId: "session-1",
      recordedAt: "2026-01-01T00:00:00.000Z"
    }));
    let now = 20_000;
    const reporter = new TrackedUserInterfaceErrorReporter({
      setErrorMessage,
      reportClientErrorFn,
      readPathnameAndSearch: () => "/",
      readNow: () => now,
      reportDeduplicationWindowMs: 3_000
    });

    await reporter.report({
      operation: "core.load",
      actionId: "action-1",
      threadId: null,
      error: new Error("Request timed out for /api/health requestId req-1")
    });

    now += 3_500;
    await reporter.report({
      operation: "core.load",
      actionId: "action-2",
      threadId: null,
      error: new Error("Request timed out for /api/health requestId req-1")
    });

    expect(reportClientErrorFn).toHaveBeenCalledTimes(2);
    expect(setErrorMessage).toHaveBeenCalledTimes(2);
  });

  it("records structured request failure fields in client error details", async () => {
    const setErrorMessage = vi.fn();
    const reportClientErrorFn = vi.fn(async () => ({
      ok: true as const,
      errorId: "error-555",
      sessionId: "session-1",
      recordedAt: "2026-01-01T00:00:00.000Z"
    }));
    const reporter = new TrackedUserInterfaceErrorReporter({
      setErrorMessage,
      reportClientErrorFn,
      readPathnameAndSearch: () => "/"
    });

    await reporter.report({
      operation: "set-collaboration-mode",
      actionId: "action-55",
      threadId: "thread-1",
      error: new StructuredRequestFailureError({
        message: "Request failed for /api/threads/thread-1/collaboration-mode status=500 requestId req-22",
        path: "/api/threads/thread-1/collaboration-mode",
        status: 500,
        statusText: "Internal Server Error",
        requestId: "req-22",
        responseText: "{\"ok\":false,\"error\":\"boom\"}",
        responseTextLength: 27,
        responseTextTruncated: false
      })
    });

    expect(reportClientErrorFn).toHaveBeenCalledTimes(1);
    expect(reportClientErrorFn).toHaveBeenCalledWith({
      source: "farfield-web",
      operation: "set-collaboration-mode",
      message: "Request failed for /api/threads/thread-1/collaboration-mode status=500 requestId req-22",
      severity: "error",
      name: null,
      stack: null,
      requestId: "req-22",
      threadId: "thread-1",
      url: "/",
      details: {
        actionId: "action-55",
        actionName: "set-collaboration-mode",
        path: "/api/threads/thread-1/collaboration-mode",
        requestStatus: 500,
        requestStatusText: "Internal Server Error",
        responseText: "{\"ok\":false,\"error\":\"boom\"}",
        responseTextLength: 27,
        responseTextTruncated: false
      }
    });
  });

  it("does not parse requestId from generic request failed text", async () => {
    const setErrorMessage = vi.fn();
    const reportClientErrorFn = vi.fn(async () => ({
      ok: true as const,
      errorId: "error-888",
      sessionId: "session-1",
      recordedAt: "2026-01-01T00:00:00.000Z"
    }));
    const reporter = new TrackedUserInterfaceErrorReporter({
      setErrorMessage,
      reportClientErrorFn,
      readPathnameAndSearch: () => "/"
    });

    await reporter.report({
      operation: "set-collaboration-mode",
      actionId: "action-88",
      threadId: "thread-1",
      error: "Request failed for /api/threads/thread-1/collaboration-mode status=500"
    });

    expect(reportClientErrorFn).toHaveBeenCalledTimes(1);
    expect(reportClientErrorFn).toHaveBeenCalledWith({
      source: "farfield-web",
      operation: "set-collaboration-mode",
      message: "Request failed for /api/threads/thread-1/collaboration-mode status=500",
      severity: "error",
      name: null,
      stack: null,
      requestId: null,
      threadId: "thread-1",
      url: "/",
      details: {
        actionId: "action-88",
        actionName: "set-collaboration-mode"
      }
    });
  });
});
