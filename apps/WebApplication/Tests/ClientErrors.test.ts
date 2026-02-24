import { CreateDebugClientErrorBodySchema } from "@farfield/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installGlobalClientCrashReporter } from "../Source/Application/Boot/InstallClientErrorReporter";

function buildCreateErrorSuccessResponse(): Response {
  return {
    ok: true,
    headers: new Headers({ "X-Farfield-Request-Id": "req_server_1" }),
    json: async () => ({
      ok: true,
      errorId: "error_1",
      sessionId: "session_1",
      recordedAt: "2026-02-21T00:00:01.000Z"
    })
  } as Response;
}

function buildUnhandledRejectionEvent(reason: PromiseRejectionEvent["reason"]): PromiseRejectionEvent {
  const event = new Event("unhandledrejection");
  Object.defineProperty(event, "reason", {
    value: reason,
    enumerable: true
  });
  return event as PromiseRejectionEvent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("installGlobalClientCrashReporter", () => {
  it("reports uncaught window errors to the debug client-error endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(buildCreateErrorSuccessResponse());
    const handle = installGlobalClientCrashReporter({
      source: "farfield-web",
      readThreadId: () => "thread-abc",
      readUrl: () => "/threads/thread-abc?view=chat"
    });

    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "Boom happened",
        error: new Error("Boom happened"),
        filename: "/Source/Main.tsx",
        lineno: 42,
        colno: 7
      })
    );

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const parsedBody = CreateDebugClientErrorBodySchema.parse(JSON.parse(String(requestInit?.body ?? "")));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/debug/client-errors");
    expect(parsedBody.operation).toBe("window-error");
    expect(parsedBody.message).toBe("Boom happened");
    expect(parsedBody.threadId).toBe("thread-abc");
    expect(parsedBody.url).toBe("/threads/thread-abc?view=chat");
    expect(parsedBody.details["eventType"]).toBe("window-error");
    expect(parsedBody.details["line"]).toBe(42);
    expect(parsedBody.details["column"]).toBe(7);

    handle.remove();
  });

  it("reports unhandled promise rejections", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(buildCreateErrorSuccessResponse());
    const handle = installGlobalClientCrashReporter({
      source: "farfield-web"
    });

    window.dispatchEvent(buildUnhandledRejectionEvent("Task failed"));

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const parsedBody = CreateDebugClientErrorBodySchema.parse(JSON.parse(String(requestInit?.body ?? "")));
    expect(parsedBody.operation).toBe("window-unhandledrejection");
    expect(parsedBody.message).toBe("Task failed");
    expect(parsedBody.details["eventType"]).toBe("window-unhandledrejection");

    handle.remove();
  });

  it("removes listeners when disposed", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(buildCreateErrorSuccessResponse());
    const handle = installGlobalClientCrashReporter({
      source: "farfield-web"
    });

    handle.remove();
    window.dispatchEvent(new ErrorEvent("error", { message: "No report expected" }));

    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});
