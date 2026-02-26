import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ServerRequestErrorResponder,
  type ServerRequestErrorResponderDependencies
} from "../Source/Network/ServerRequestErrorResponder.js";
import type { ServerErrorEventRecordInput } from "../Source/Network/ServerErrorEventRecorder.js";

interface JsonResponseCall {
  statusCode: number;
  body: Record<string, string | boolean | null>;
}

interface PushedSystemEvent {
  message: string;
  details: Record<string, string | null | undefined>;
}

interface TestHarness {
  responder: ServerRequestErrorResponder;
  jsonResponseCalls: JsonResponseCall[];
  runtimeLastErrors: string[];
  pushedSystemEvents: PushedSystemEvent[];
  recordedServerErrors: ServerErrorEventRecordInput[];
  broadcastCount: number;
}

function createHttpPair(method: string, url: string): { req: IncomingMessage; res: ServerResponse } {
  const request = new IncomingMessage(new Socket());
  request.method = method;
  request.url = url;
  const response = new ServerResponse(request);
  return { req: request, res: response };
}

function createValidationError(): z.ZodError {
  try {
    z.object({ message: z.string() }).parse({ message: 7 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error;
    }
    throw error;
  }

  throw new Error("Expected validation error");
}

function createHarness(
  isExpectedShutdownTransportError: (error: Error) => boolean
): TestHarness {
  const jsonResponseCalls: JsonResponseCall[] = [];
  const runtimeLastErrors: string[] = [];
  const pushedSystemEvents: PushedSystemEvent[] = [];
  const recordedServerErrors: ServerErrorEventRecordInput[] = [];
  let broadcastCount = 0;

  const dependencies: ServerRequestErrorResponderDependencies = {
    jsonResponse: (res, statusCode, body) => {
      res.statusCode = statusCode;
      const parsedBody = z.record(z.union([z.string(), z.boolean(), z.null()])).parse(body);
      jsonResponseCalls.push({
        statusCode,
        body: parsedBody
      });
    },
    toErrorMessage: <ValueType,>(value: ValueType): string => {
      if (value instanceof Error) {
        return value.message;
      }
      if (typeof value === "string") {
        return value;
      }
      return String(value);
    },
    isExpectedShutdownTransportError,
    recordServerErrorEvent: (input) => {
      recordedServerErrors.push(input);
    },
    setRuntimeLastError: (message) => {
      runtimeLastErrors.push(message);
    },
    pushSystem: (message, details) => {
      pushedSystemEvents.push({
        message,
        details: {
          requestId: typeof details?.requestId === "string" ? details.requestId : null,
          actionId: typeof details?.actionId === "string" ? details.actionId : null,
          actionName: typeof details?.actionName === "string" ? details.actionName : null,
          errorCategory: typeof details?.errorCategory === "string" ? details.errorCategory : null,
          error: typeof details?.error === "string" ? details.error : null
        }
      });
    },
    broadcastRuntimeState: () => {
      broadcastCount += 1;
    }
  };

  return {
    responder: new ServerRequestErrorResponder(dependencies),
    jsonResponseCalls,
    runtimeLastErrors,
    pushedSystemEvents,
    recordedServerErrors,
    get broadcastCount() {
      return broadcastCount;
    }
  };
}

describe("ServerRequestErrorResponder", () => {
  it("returns validation mapping without server error recording", () => {
    const harness = createHarness(() => false);
    const { req, res } = createHttpPair("POST", "/api/threads");

    harness.responder.respond({
      req,
      res,
      error: createValidationError(),
      context: {
        requestId: "request_1",
        actionId: "action_1",
        actionName: "load-threads"
      }
    });

    expect(harness.jsonResponseCalls).toHaveLength(1);
    expect(harness.jsonResponseCalls[0]?.statusCode).toBe(400);
    expect(harness.jsonResponseCalls[0]?.body).toMatchObject({
      ok: false,
      requestId: "request_1",
      actionId: "action_1",
      actionName: "load-threads"
    });
    expect(harness.jsonResponseCalls[0]?.body.error.includes("Expected string, received number")).toBe(true);
    expect(harness.runtimeLastErrors).toEqual([]);
    expect(harness.recordedServerErrors).toHaveLength(1);
    expect(harness.recordedServerErrors[0]?.severity).toBe("warning");
    expect(harness.recordedServerErrors[0]?.details?.errorCategory).toBe("request_validation");
    expect(harness.pushedSystemEvents).toEqual([]);
    expect(harness.broadcastCount).toBe(0);
  });

  it("records and reports internal runtime errors", () => {
    const harness = createHarness(() => false);
    const { req, res } = createHttpPair("PATCH", "/api/threads/thread_123");

    harness.responder.respond({
      req,
      res,
      error: new Error("request handler crashed"),
      context: {
        requestId: "request_2",
        actionId: "action_2",
        actionName: "archive-thread"
      }
    });

    expect(harness.runtimeLastErrors).toEqual(["request handler crashed"]);
    expect(harness.recordedServerErrors).toHaveLength(1);
    expect(harness.recordedServerErrors[0]?.severity).toBe("error");
    expect(harness.recordedServerErrors[0]?.details?.errorCategory).toBe("internal");
    expect(harness.pushedSystemEvents).toEqual([
      {
        message: "Request failed",
        details: {
          requestId: "request_2",
          actionId: "action_2",
          actionName: "archive-thread",
          errorCategory: "internal",
          error: "request handler crashed"
        }
      }
    ]);
    expect(harness.broadcastCount).toBe(1);
    expect(harness.jsonResponseCalls).toEqual([
      {
        statusCode: 500,
        body: {
          ok: false,
          error: "request handler crashed",
          requestId: "request_2",
          actionId: "action_2",
          actionName: "archive-thread"
        }
      }
    ]);
  });

  it("returns shutdown mapping without server error recording", () => {
    const harness = createHarness((error) => error.message.includes("transport closed"));
    const { req, res } = createHttpPair("GET", "/api/threads");

    harness.responder.respond({
      req,
      res,
      error: new Error("transport closed by server shutdown"),
      context: {
        requestId: "request_3",
        actionId: null,
        actionName: null
      }
    });

    expect(harness.runtimeLastErrors).toEqual(["Server is shutting down"]);
    expect(harness.recordedServerErrors).toEqual([]);
    expect(harness.pushedSystemEvents).toEqual([]);
    expect(harness.broadcastCount).toBe(0);
    expect(harness.jsonResponseCalls).toEqual([
      {
        statusCode: 503,
        body: {
          ok: false,
          error: "Server is shutting down",
          requestId: "request_3",
          actionId: null,
          actionName: null
        }
      }
    ]);
  });

  it("does not write a second error payload when response headers were already sent", () => {
    const harness = createHarness(() => false);
    const { req, res } = createHttpPair("GET", "/api/threads");
    res.writeHead(202);

    harness.responder.respond({
      req,
      res,
      error: new Error("request handler crashed"),
      context: {
        requestId: "request_4",
        actionId: "action_4",
        actionName: "stream-events"
      }
    });

    expect(harness.jsonResponseCalls).toHaveLength(0);
    expect(harness.runtimeLastErrors).toEqual(["request handler crashed"]);
    expect(harness.broadcastCount).toBe(1);
  });
});
