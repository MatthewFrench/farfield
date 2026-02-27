import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { ServerErrorEventRecordInput } from "../Source/Network/ServerErrorEventRecorder.js";
import {
  ServerRequestErrorResponder,
  type ServerRequestErrorResponderDependencies,
} from "../Source/Network/ServerRequestErrorResponder.js";
import { RequestValidationError } from "../Source/Shared/Errors/RequestValidationError.js";

const JsonResponseBodySchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  requestId: z.string(),
  actionId: z.string().nullable(),
  actionName: z.string().nullable(),
});

const PushedSystemEventDetailsSchema = z.object({
  requestId: z.string(),
  actionId: z.string().nullable(),
  actionName: z.string().nullable(),
  errorCategory: z.enum(["request_validation", "shutdown_transport", "internal"]),
  error: z.string(),
  method: z.string(),
  url: z.string(),
});

type JsonResponseBody = z.infer<typeof JsonResponseBodySchema>;
type PushedSystemEventDetails = z.infer<typeof PushedSystemEventDetailsSchema>;

interface JsonResponseCall {
  statusCode: number;
  body: JsonResponseBody;
}

interface PushedSystemEvent {
  message: string;
  details: PushedSystemEventDetails;
}

interface TestHarness {
  responder: ServerRequestErrorResponder;
  jsonResponseCalls: JsonResponseCall[];
  runtimeLastErrors: string[];
  pushedSystemEvents: PushedSystemEvent[];
  recordedServerErrors: ServerErrorEventRecordInput[];
  broadcastCount: number;
}

interface HttpPairInput {
  method?: string;
  url?: string;
}

function createHttpPair(input: HttpPairInput = {}): {
  req: IncomingMessage;
  res: ServerResponse;
} {
  const request = new IncomingMessage(new Socket());
  if (input.method !== undefined) {
    request.method = input.method;
  }
  if (input.url !== undefined) {
    request.url = input.url;
  }
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

function createHarness(isExpectedShutdownTransportError: (error: Error) => boolean): TestHarness {
  const jsonResponseCalls: JsonResponseCall[] = [];
  const runtimeLastErrors: string[] = [];
  const pushedSystemEvents: PushedSystemEvent[] = [];
  const recordedServerErrors: ServerErrorEventRecordInput[] = [];
  let broadcastCount = 0;

  const dependencies: ServerRequestErrorResponderDependencies = {
    jsonResponse: (res, statusCode, body) => {
      res.statusCode = statusCode;
      const parsedBody = JsonResponseBodySchema.parse(body);
      jsonResponseCalls.push({
        statusCode,
        body: parsedBody,
      });
    },
    toErrorMessage: <ValueType>(value: ValueType): string => {
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
      const parsedDetails = PushedSystemEventDetailsSchema.parse(details);
      pushedSystemEvents.push({
        message,
        details: parsedDetails,
      });
    },
    broadcastRuntimeState: () => {
      broadcastCount += 1;
    },
  };

  return {
    responder: new ServerRequestErrorResponder(dependencies),
    jsonResponseCalls,
    runtimeLastErrors,
    pushedSystemEvents,
    recordedServerErrors,
    get broadcastCount() {
      return broadcastCount;
    },
  };
}

describe("ServerRequestErrorResponder", () => {
  it("returns validation mapping with warning error recording", () => {
    const harness = createHarness(() => false);
    const { req, res } = createHttpPair({
      method: "POST",
      url: "/api/threads",
    });

    harness.responder.respond({
      req,
      res,
      error: createValidationError(),
      context: {
        requestId: "request_1",
        actionId: "action_1",
        actionName: "load-threads",
      },
    });

    expect(harness.jsonResponseCalls).toHaveLength(1);
    expect(harness.jsonResponseCalls[0]?.statusCode).toBe(400);
    expect(harness.jsonResponseCalls[0]?.body).toMatchObject({
      ok: false,
      requestId: "request_1",
      actionId: "action_1",
      actionName: "load-threads",
    });
    expect(
      harness.jsonResponseCalls[0]?.body.error.includes("Expected string, received number"),
    ).toBe(true);
    expect(harness.runtimeLastErrors).toEqual([]);
    expect(harness.recordedServerErrors).toHaveLength(1);
    expect(harness.recordedServerErrors[0]?.severity).toBe("warning");
    expect(harness.recordedServerErrors[0]?.details?.errorCategory).toBe("request_validation");
    expect(harness.pushedSystemEvents).toEqual([]);
    expect(harness.broadcastCount).toBe(0);
  });

  it("maps request-validation runtime errors to 400 responses", () => {
    const harness = createHarness(() => false);
    const { req, res } = createHttpPair({
      method: "POST",
      url: "/api/events/session",
    });

    harness.responder.respond({
      req,
      res,
      error: new RequestValidationError("Request body must be valid JSON."),
      context: {
        requestId: "request_1b",
        actionId: "action_1b",
        actionName: "events-session-bootstrap",
      },
    });

    expect(harness.jsonResponseCalls).toHaveLength(1);
    expect(harness.jsonResponseCalls[0]?.statusCode).toBe(400);
    expect(harness.jsonResponseCalls[0]?.body.error).toBe("Request body must be valid JSON.");
    expect(harness.runtimeLastErrors).toEqual([]);
    expect(harness.pushedSystemEvents).toEqual([]);
    expect(harness.broadcastCount).toBe(0);
  });

  it("records and reports internal runtime errors", () => {
    const harness = createHarness(() => false);
    const { req, res } = createHttpPair({
      method: "PATCH",
      url: "/api/threads/thread_123",
    });

    harness.responder.respond({
      req,
      res,
      error: new Error("request handler crashed"),
      context: {
        requestId: "request_2",
        actionId: "action_2",
        actionName: "archive-thread",
      },
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
          error: "request handler crashed",
          method: "PATCH",
          url: "/api/threads/thread_123",
        },
      },
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
          actionName: "archive-thread",
        },
      },
    ]);
  });

  it("returns shutdown mapping without server error recording", () => {
    const harness = createHarness((error) => error.message.includes("transport closed"));
    const { req, res } = createHttpPair({ method: "GET", url: "/api/threads" });

    harness.responder.respond({
      req,
      res,
      error: new Error("transport closed by server shutdown"),
      context: {
        requestId: "request_3",
        actionId: null,
        actionName: null,
      },
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
          actionName: null,
        },
      },
    ]);
  });

  it("does not write a second error payload when response headers were already sent", () => {
    const harness = createHarness(() => false);
    const { req, res } = createHttpPair({ method: "GET", url: "/api/threads" });
    res.writeHead(202);

    harness.responder.respond({
      req,
      res,
      error: new Error("request handler crashed"),
      context: {
        requestId: "request_4",
        actionId: "action_4",
        actionName: "stream-events",
      },
    });

    expect(harness.jsonResponseCalls).toHaveLength(0);
    expect(harness.runtimeLastErrors).toEqual(["request handler crashed"]);
    expect(harness.broadcastCount).toBe(1);
  });

  it("uses owned unknown literals when method and url are missing", () => {
    const harness = createHarness(() => false);
    const { req, res } = createHttpPair({
      method: "POST",
      url: "/api/threads",
    });
    req.method = undefined;
    req.url = undefined;

    harness.responder.respond({
      req,
      res,
      error: new Error("request handler crashed"),
      context: {
        requestId: "request_5",
        actionId: "action_5",
        actionName: "send-message",
      },
    });

    expect(harness.pushedSystemEvents).toEqual([
      {
        message: "Request failed",
        details: {
          requestId: "request_5",
          actionId: "action_5",
          actionName: "send-message",
          errorCategory: "internal",
          error: "request handler crashed",
          method: "unknown",
          url: "unknown",
        },
      },
    ]);
    expect(harness.recordedServerErrors).toHaveLength(1);
    expect(harness.recordedServerErrors[0]?.url).toBeNull();
    expect(harness.recordedServerErrors[0]?.details?.method).toBe("unknown");
  });
});
