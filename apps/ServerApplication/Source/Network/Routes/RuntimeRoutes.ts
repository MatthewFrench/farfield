import type { IncomingMessage, ServerResponse } from "node:http";
import {
  FarfieldHealthStateSchema,
  FarfieldEventsSessionResponseSchema,
  type JsonValue
} from "@farfield/protocol";
import { z } from "zod";
import type { EventStreamClientRegistry } from "../EventStreamClientRegistry.js";
import type { RuntimeStateOwner } from "../../Application/StateManagement/RuntimeStateOwner.js";
import type { BrowserSessionAuthOwner } from "../BrowserSessionAuthOwner.js";
import {
  RequestMethodByName,
  RequestPathnameByName
} from "../RequestPathContracts.js";

const RuntimeRouteStatusCodeByName = {
  successOk: 200,
  clientErrorBadRequest: 400
} as const;

const RuntimeRouteErrorMessageByName = {
  invalidEventsSessionBootstrapPayload: "Invalid events session bootstrap payload"
} as const;

const RuntimeRouteHeaderNameByName = {
  cookie: "cookie",
  setCookie: "Set-Cookie"
} as const;

const RuntimeStateChangedEventType = "runtime-state-changed";
const EventsSessionBootstrapIssuePathPrefix = "body";

const EventsSessionBootstrapBodySchema = z
  .object({
    apiToken: z.string().trim().min(1).optional()
  })
  .strict();

interface EventsSessionBootstrapBody {
  apiToken?: string | undefined;
}

interface EventsSessionBootstrapBodyIssue {
  path: string;
  message: string;
}

type EventsSessionBootstrapBodyParseResult =
  | {
    ok: true;
    body: EventsSessionBootstrapBody;
  }
  | {
    ok: false;
    issues: EventsSessionBootstrapBodyIssue[];
  };

export interface RuntimeRouteDependencies {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  apiAuthRequired: boolean;
  apiToken: string;
  apiTokenHeaderName: string;
  browserSessionAuthOwner: BrowserSessionAuthOwner;
  eventStreamClientRegistry: EventStreamClientRegistry;
  runtimeStateOwner: RuntimeStateOwner;
  readJsonBody: (req: IncomingMessage) => Promise<JsonValue>;
  jsonResponse: (res: ServerResponse, statusCode: number, body: object) => void;
}

/**
 * Owns server runtime-network route dispatch for runtime health/event-stream/session bootstrap.
 * This owner keeps events-session bootstrap parsing and token resolution deterministic so auth
 * behavior remains explicit across cookie/session and header/body token inputs.
 */
export async function handleRuntimeRoutes(deps: RuntimeRouteDependencies): Promise<boolean> {
  const {
    req,
    res,
    pathname,
    apiAuthRequired,
    apiToken,
    apiTokenHeaderName,
    browserSessionAuthOwner,
    eventStreamClientRegistry,
    runtimeStateOwner,
    readJsonBody,
    jsonResponse
  } = deps;

  if (req.method === RequestMethodByName.get && pathname === RequestPathnameByName.events) {
    const runtimeStateSnapshot = FarfieldHealthStateSchema.parse(runtimeStateOwner.readSnapshot());
    eventStreamClientRegistry.addClient(req, res, {
      type: RuntimeStateChangedEventType,
      state: runtimeStateSnapshot
    });
    return true;
  }

  if (req.method === RequestMethodByName.get && pathname === RequestPathnameByName.apiHealth) {
    const runtimeStateSnapshot = FarfieldHealthStateSchema.parse(runtimeStateOwner.readSnapshot());
    jsonResponse(res, RuntimeRouteStatusCodeByName.successOk, {
      ok: true,
      state: runtimeStateSnapshot
    });
    return true;
  }

  if (req.method === RequestMethodByName.post && pathname === RequestPathnameByName.apiEventsSession) {
    const currentSession = browserSessionAuthOwner.readSession(
      readHeaderValue(req, RuntimeRouteHeaderNameByName.cookie)
    );
    let bootstrapped = !apiAuthRequired || currentSession.authenticated;
    let expiresAt = currentSession.expiresAt;

    if (!bootstrapped && apiAuthRequired) {
      const parsedBody = parseEventsSessionBootstrapBody(await readJsonBody(req));
      if (!parsedBody.ok) {
        jsonResponse(res, RuntimeRouteStatusCodeByName.clientErrorBadRequest, {
          ok: false,
          error: RuntimeRouteErrorMessageByName.invalidEventsSessionBootstrapPayload,
          issues: parsedBody.issues
        });
        return true;
      }

      const providedToken = resolveEventsSessionBootstrapToken(
        req,
        apiTokenHeaderName,
        parsedBody.body.apiToken
      );
      if (providedToken && providedToken === apiToken) {
        const issuedSession = browserSessionAuthOwner.issueSessionCookie();
        res.setHeader(RuntimeRouteHeaderNameByName.setCookie, issuedSession.setCookieHeaderValue);
        bootstrapped = true;
        expiresAt = issuedSession.expiresAt;
      }
    }

    const response = FarfieldEventsSessionResponseSchema.parse({
      ok: true,
      authRequired: apiAuthRequired,
      bootstrapped,
      expiresAt: bootstrapped ? expiresAt : null
    });
    jsonResponse(res, RuntimeRouteStatusCodeByName.successOk, response);
    return true;
  }

  return false;
}

function parseEventsSessionBootstrapBody(value: JsonValue): EventsSessionBootstrapBodyParseResult {
  const parsedBody = EventsSessionBootstrapBodySchema.safeParse(value);
  if (parsedBody.success) {
    return {
      ok: true,
      body: parsedBody.data
    };
  }

  return {
    ok: false,
    issues: parsedBody.error.issues.map((issue) => ({
      path: buildEventsSessionBootstrapIssuePath(issue.path),
      message: issue.message
    }))
  };
}

function buildEventsSessionBootstrapIssuePath(pathSegments: readonly (string | number)[]): string {
  if (pathSegments.length === 0) {
    return EventsSessionBootstrapIssuePathPrefix;
  }
  return `${EventsSessionBootstrapIssuePathPrefix}.${pathSegments.map((segment) => String(segment)).join(".")}`;
}

function resolveEventsSessionBootstrapToken(
  req: IncomingMessage,
  apiTokenHeaderName: string,
  bodyApiToken: string | undefined
): string | null {
  // Header token stays authoritative so trusted proxy headers override request-body values.
  const providedHeaderToken = normalizeOptionalHeaderValue(readHeaderValue(req, apiTokenHeaderName));
  const providedBodyToken = bodyApiToken ?? null;
  return providedHeaderToken ?? providedBodyToken;
}

function readHeaderValue(req: IncomingMessage, name: string): string | null {
  const raw = req.headers[name.toLowerCase()];
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    const first = raw[0];
    return typeof first === "string" ? first : null;
  }
  return null;
}

function normalizeOptionalHeaderValue(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
