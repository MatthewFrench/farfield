import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { describe, expect, it, vi } from "vitest";
import { ThreadConcurrencyCoordinator } from "../Source/Network/ThreadConcurrencyCoordinator.js";
import { ThreadListAggregationCache } from "../Source/Network/ThreadListAggregationCache.js";
import {
  handleThreadRoutes,
  type ThreadRouteDependencies
} from "../Source/Network/Routes/ThreadRoutes.js";

function createMockRequestResponsePair(): { request: IncomingMessage; response: ServerResponse } {
  const socket = new Socket();
  const request = new IncomingMessage(socket);
  const response = new ServerResponse(request);
  return {
    request,
    response
  };
}

function createThreadRouteDependencies(input: {
  request: IncomingMessage;
  response: ServerResponse;
  pathname: string;
  segments: string[];
  url: URL;
  onJsonResponse: (statusCode: number, body: object) => void;
  resolveAdapterForThread: ThreadRouteDependencies["resolveAdapterForThread"];
}): ThreadRouteDependencies {
  return {
    req: input.request,
    res: input.response,
    pathname: input.pathname,
    segments: input.segments,
    url: input.url,
    defaultWorkspace: "/tmp/workspace",
    codexAdapter: null,
    threadListAggregationCache: new ThreadListAggregationCache(1_000, 4),
    listEnabledAdapters: () => [],
    registerThreadAdapterOwnership: () => {},
    parseInteger: (value, defaultValue) => {
      if (!value) {
        return defaultValue;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : defaultValue;
    },
    parseBoolean: (value, defaultValue) => {
      if (!value) {
        return defaultValue;
      }
      return value === "true";
    },
    normalizeOptionalString: (value) => {
      if (!value) {
        return null;
      }
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : null;
    },
    listThreadsTimeoutMs: 5_000,
    resolveCreateThreadAdapter: () => null,
    resolveAdapterForThread: input.resolveAdapterForThread,
    readJsonBody: async () => ({}),
    jsonResponse: (_res, statusCode, body) => {
      input.onJsonResponse(statusCode, body);
    },
    invalidateThreadListAggregationCache: () => {},
    pushActionEventWithRequestContext: () => {},
    pushActionErrorWithRequestContext: () => "action-error-id",
    withTimeout: async (promise) => promise,
    threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator()
  };
}

describe("handleThreadRoutes", () => {
  it("gives precedence to collection routes before member routing", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "GET";

    const resolveAdapterForThread = vi.fn<
      ThreadRouteDependencies["resolveAdapterForThread"]
    >(async () => ({
      ok: false,
      status: 404,
      error: "thread not found"
    }));

    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;

    const handled = await handleThreadRoutes(
      createThreadRouteDependencies({
        request,
        response,
        pathname: "/api/threads",
        segments: ["api", "threads"],
        url: new URL("http://localhost/api/threads?limit=10"),
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
        resolveAdapterForThread
      })
    );

    expect(handled).toBe(true);
    expect(resolveAdapterForThread).not.toHaveBeenCalled();
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toEqual({
      ok: true,
      data: [],
      nextCursor: null,
      pages: 0,
      truncated: false
    });
  });

  it("routes member-thread paths through member owner mapping when collection route does not match", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "GET";

    const resolveAdapterForThread = vi.fn<
      ThreadRouteDependencies["resolveAdapterForThread"]
    >(async () => ({
      ok: false,
      status: 404,
      error: "Thread not found"
    }));

    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;

    const handled = await handleThreadRoutes(
      createThreadRouteDependencies({
        request,
        response,
        pathname: "/api/threads/thread_missing",
        segments: ["api", "threads", "thread_missing"],
        url: new URL("http://localhost/api/threads/thread_missing"),
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
        resolveAdapterForThread
      })
    );

    expect(handled).toBe(true);
    expect(resolveAdapterForThread).toHaveBeenCalledWith("thread_missing");
    expect(capturedStatusCode).toBe(404);
    expect(capturedBody).toEqual({
      ok: false,
      error: "Thread not found",
      threadId: "thread_missing"
    });
  });
});
