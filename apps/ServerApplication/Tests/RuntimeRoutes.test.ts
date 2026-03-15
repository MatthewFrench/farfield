import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import {
  FarfieldEventsSessionResponseSchema,
  FarfieldHealthStateSchema,
  type JsonValue,
} from "@farfield/protocol";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { RuntimeStateOwner } from "../Source/Application/StateManagement/RuntimeStateOwner.js";
import { BrowserSessionAuthOwner } from "../Source/Network/BrowserSessionAuthOwner.js";
import { EventStreamClientRegistry } from "../Source/Network/EventStreamClientRegistry.js";
import {
  RequestMethodByName,
  RequestPathnameByName,
} from "../Source/Network/RequestPathContracts.js";
import {
  handleRuntimeRoutes,
  type RuntimeRouteDependencies,
} from "../Source/Network/Routes/RuntimeRoutes.js";

const TestApiTokenHeaderName = "x-farfield-token";
const TestApiToken = "api-token";
const CookieDirectiveSeparator = ";";

const HealthRouteEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    state: FarfieldHealthStateSchema,
  })
  .strict();

const InvalidEventsSessionBootstrapEnvelopeSchema = z
  .object({
    ok: z.literal(false),
    error: z.literal("Invalid events session bootstrap payload"),
    issues: z.array(
      z.object({
        path: z.string(),
        message: z.string(),
      }),
    ),
  })
  .strict();

interface JsonResponseCall {
  statusCode: number;
  body: object;
}

interface RuntimeRouteHarness {
  dependencies: RuntimeRouteDependencies;
  req: IncomingMessage;
  res: ServerResponse;
  browserSessionAuthOwner: BrowserSessionAuthOwner;
  eventStreamClientRegistry: EventStreamClientRegistry;
  jsonResponseCalls: JsonResponseCall[];
  setReadJsonBodyValue: (value: JsonValue) => void;
  readJsonBodyCallCount: () => number;
}

interface RuntimeRouteHarnessOptions {
  method: string;
  pathname: string;
  apiAuthRequired?: boolean;
  apiToken?: string;
}

function createRuntimeStateOwner(): RuntimeStateOwner {
  return new RuntimeStateOwner({
    appExecutable: "bun",
    socketPath: "/tmp/socket",
    workspaceDir: "/tmp/workspace",
    gitCommit: null,
    readCodexRuntimeState: () => null,
    readHistoryCount: () => 0,
    readThreadOwnerCount: () => 0,
    readPushEnabled: () => false,
    readPushSubscriptionCount: () => 0,
    readPushReceiptCount: () => 0,
    readClientErrorCount: () => 0,
    readActiveTraceSummary: () => null,
  });
}

function createHttpPair(): { req: IncomingMessage; res: ServerResponse } {
  const req = new IncomingMessage(new Socket());
  req.method = RequestMethodByName.get;
  req.url = "/";
  const res = new ServerResponse(req);
  return { req, res };
}

function createRuntimeRouteHarness(options: RuntimeRouteHarnessOptions): RuntimeRouteHarness {
  const httpPair = createHttpPair();
  const browserSessionAuthOwner = new BrowserSessionAuthOwner({
    cookieName: "farfield-session",
    sessionTimeToLiveMs: 60_000,
    signingSecret: "runtime-route-test-signing-secret",
    secureCookie: false,
  });
  const eventStreamClientRegistry = new EventStreamClientRegistry(1_000);
  const runtimeStateOwner = createRuntimeStateOwner();
  const jsonResponseCalls: JsonResponseCall[] = [];
  let readJsonBodyValue: JsonValue = {};
  let readJsonBodyInvocationCount = 0;

  httpPair.req.method = options.method;
  httpPair.req.url = options.pathname;

  return {
    dependencies: {
      req: httpPair.req,
      res: httpPair.res,
      pathname: options.pathname,
      apiAuthRequired: options.apiAuthRequired ?? true,
      apiToken: options.apiToken ?? TestApiToken,
      apiTokenHeaderName: TestApiTokenHeaderName,
      browserSessionAuthOwner,
      eventStreamClientRegistry,
      runtimeStateOwner,
      readJsonBody: async () => {
        readJsonBodyInvocationCount += 1;
        return readJsonBodyValue;
      },
      jsonResponse: (res, statusCode, body) => {
        res.statusCode = statusCode;
        jsonResponseCalls.push({
          statusCode,
          body,
        });
      },
    },
    req: httpPair.req,
    res: httpPair.res,
    browserSessionAuthOwner,
    eventStreamClientRegistry,
    jsonResponseCalls,
    setReadJsonBodyValue: (value) => {
      readJsonBodyValue = value;
    },
    readJsonBodyCallCount: () => readJsonBodyInvocationCount,
  };
}

function readCookieHeaderValue(setCookieHeaderValue: string): string {
  const firstDirectiveSeparatorIndex = setCookieHeaderValue.indexOf(CookieDirectiveSeparator);
  if (firstDirectiveSeparatorIndex < 0) {
    return setCookieHeaderValue;
  }
  return setCookieHeaderValue.slice(0, firstDirectiveSeparatorIndex);
}

describe("RuntimeRoutes", () => {
  it("returns false for non-runtime routes", async () => {
    const harness = createRuntimeRouteHarness({
      method: RequestMethodByName.get,
      pathname: "/api/not-runtime",
    });

    const handled = await handleRuntimeRoutes(harness.dependencies);

    expect(handled).toBe(false);
    expect(harness.jsonResponseCalls).toEqual([]);
    expect(harness.readJsonBodyCallCount()).toBe(0);
  });

  it("registers event-stream clients for /events", async () => {
    const harness = createRuntimeRouteHarness({
      method: RequestMethodByName.get,
      pathname: RequestPathnameByName.events,
    });
    const writeHeadSpy = vi.spyOn(harness.res, "writeHead").mockImplementation(() => harness.res);
    const writeSpy = vi.spyOn(harness.res, "write").mockImplementation(() => true);

    try {
      const handled = await handleRuntimeRoutes(harness.dependencies);

      expect(handled).toBe(true);
      expect(writeHeadSpy).toHaveBeenCalledWith(200, expect.any(Object));
      expect(writeSpy).toHaveBeenCalled();
      expect(harness.eventStreamClientRegistry.readStatistics()).toMatchObject({
        activeClientCount: 1,
        addedClientCount: 1,
      });
    } finally {
      harness.req.emit("close");
    }
  });

  it("returns schema-validated runtime health response", async () => {
    const harness = createRuntimeRouteHarness({
      method: RequestMethodByName.get,
      pathname: RequestPathnameByName.apiHealth,
    });

    const handled = await handleRuntimeRoutes(harness.dependencies);

    expect(handled).toBe(true);
    expect(harness.jsonResponseCalls).toHaveLength(1);
    expect(harness.jsonResponseCalls[0]?.statusCode).toBe(200);
    const responseBody = harness.jsonResponseCalls[0]?.body;
    if (!responseBody) {
      throw new Error("Expected runtime health response body");
    }
    const parsedEnvelope = HealthRouteEnvelopeSchema.parse(responseBody);
    expect(parsedEnvelope.state.historyCount).toBe(0);
    expect(parsedEnvelope.state.pushEnabled).toBe(false);
  });

  it("returns deterministic issue paths for invalid events-session bootstrap body", async () => {
    const harness = createRuntimeRouteHarness({
      method: RequestMethodByName.post,
      pathname: RequestPathnameByName.apiEventsSession,
    });
    harness.setReadJsonBodyValue({
      apiToken: 42,
    });

    const handled = await handleRuntimeRoutes(harness.dependencies);

    expect(handled).toBe(true);
    expect(harness.jsonResponseCalls).toHaveLength(1);
    expect(harness.jsonResponseCalls[0]?.statusCode).toBe(400);
    const responseBody = harness.jsonResponseCalls[0]?.body;
    if (!responseBody) {
      throw new Error("Expected events-session validation error response");
    }
    const parsedEnvelope = InvalidEventsSessionBootstrapEnvelopeSchema.parse(responseBody);
    expect(parsedEnvelope.issues.some((issue) => issue.path === "body.apiToken")).toBe(true);
  });

  it("returns root body issue path for non-object events-session bootstrap body", async () => {
    const harness = createRuntimeRouteHarness({
      method: RequestMethodByName.post,
      pathname: RequestPathnameByName.apiEventsSession,
    });
    harness.setReadJsonBodyValue([]);

    const handled = await handleRuntimeRoutes(harness.dependencies);

    expect(handled).toBe(true);
    expect(harness.jsonResponseCalls).toHaveLength(1);
    expect(harness.jsonResponseCalls[0]?.statusCode).toBe(400);
    const responseBody = harness.jsonResponseCalls[0]?.body;
    if (!responseBody) {
      throw new Error("Expected events-session validation error response");
    }
    const parsedEnvelope = InvalidEventsSessionBootstrapEnvelopeSchema.parse(responseBody);
    expect(parsedEnvelope.issues.some((issue) => issue.path === "body")).toBe(true);
  });

  it("prefers header api token over request body api token", async () => {
    const harness = createRuntimeRouteHarness({
      method: RequestMethodByName.post,
      pathname: RequestPathnameByName.apiEventsSession,
    });
    harness.setReadJsonBodyValue({
      apiToken: "incorrect-token",
    });
    harness.req.headers[TestApiTokenHeaderName] = TestApiToken;

    const handled = await handleRuntimeRoutes(harness.dependencies);

    expect(handled).toBe(true);
    expect(harness.jsonResponseCalls).toHaveLength(1);
    const responseBody = harness.jsonResponseCalls[0]?.body;
    if (!responseBody) {
      throw new Error("Expected events-session success response");
    }
    const parsedResponse = FarfieldEventsSessionResponseSchema.parse(responseBody);
    expect(parsedResponse.bootstrapped).toBe(true);
    expect(harness.res.getHeader("Set-Cookie")).toEqual(expect.any(String));
  });

  it("ignores empty repeated header token values and uses first non-empty header token", async () => {
    const harness = createRuntimeRouteHarness({
      method: RequestMethodByName.post,
      pathname: RequestPathnameByName.apiEventsSession,
    });
    harness.setReadJsonBodyValue({
      apiToken: "incorrect-token",
    });
    harness.req.headers[TestApiTokenHeaderName] = ["   ", TestApiToken];

    const handled = await handleRuntimeRoutes(harness.dependencies);

    expect(handled).toBe(true);
    expect(harness.jsonResponseCalls).toHaveLength(1);
    const responseBody = harness.jsonResponseCalls[0]?.body;
    if (!responseBody) {
      throw new Error("Expected events-session response");
    }
    const parsedResponse = FarfieldEventsSessionResponseSchema.parse(responseBody);
    expect(parsedResponse.bootstrapped).toBe(true);
    expect(harness.res.getHeader("Set-Cookie")).toEqual(expect.any(String));
  });

  it("keeps first non-empty repeated header token authoritative over request body token", async () => {
    const harness = createRuntimeRouteHarness({
      method: RequestMethodByName.post,
      pathname: RequestPathnameByName.apiEventsSession,
    });
    harness.setReadJsonBodyValue({
      apiToken: TestApiToken,
    });
    harness.req.headers[TestApiTokenHeaderName] = ["incorrect-token", TestApiToken];

    const handled = await handleRuntimeRoutes(harness.dependencies);

    expect(handled).toBe(true);
    expect(harness.jsonResponseCalls).toHaveLength(1);
    const responseBody = harness.jsonResponseCalls[0]?.body;
    if (!responseBody) {
      throw new Error("Expected events-session response");
    }
    const parsedResponse = FarfieldEventsSessionResponseSchema.parse(responseBody);
    expect(parsedResponse.bootstrapped).toBe(false);
    expect(parsedResponse.expiresAt).toBeNull();
    expect(harness.res.getHeader("Set-Cookie")).toBeUndefined();
  });

  it("reissues session cookies when an authenticated events-session bootstrap is refreshed", async () => {
    const harness = createRuntimeRouteHarness({
      method: RequestMethodByName.post,
      pathname: RequestPathnameByName.apiEventsSession,
    });
    const issuedSession = harness.browserSessionAuthOwner.issueSessionCookie();
    harness.req.headers.cookie = readCookieHeaderValue(issuedSession.setCookieHeaderValue);
    harness.setReadJsonBodyValue({
      apiToken: 42,
    });

    const handled = await handleRuntimeRoutes(harness.dependencies);

    expect(handled).toBe(true);
    expect(harness.readJsonBodyCallCount()).toBe(0);
    const responseBody = harness.jsonResponseCalls[0]?.body;
    if (!responseBody) {
      throw new Error("Expected events-session response");
    }
    const parsedResponse = FarfieldEventsSessionResponseSchema.parse(responseBody);
    expect(parsedResponse.bootstrapped).toBe(true);
    expect(parsedResponse.expiresAt).not.toBeNull();
    if (parsedResponse.expiresAt) {
      expect(parsedResponse.expiresAt >= issuedSession.expiresAt).toBe(true);
    }
    expect(harness.res.getHeader("Set-Cookie")).toEqual(expect.any(String));
  });
});
