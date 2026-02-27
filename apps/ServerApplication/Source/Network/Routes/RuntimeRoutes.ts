import type { IncomingMessage, ServerResponse } from "node:http";
import {
  FarfieldEventsSessionResponseSchema,
  FarfieldHealthStateSchema,
  type JsonValue,
} from "@farfield/protocol";
import { z } from "zod";
import type { BrowserSessionAuthOwner } from "../BrowserSessionAuthOwner.js";
import type { EventStreamClientRegistry } from "../EventStreamClientRegistry.js";
import { RequestMethodByName, RequestPathnameByName } from "../RequestPathContracts.js";

const RuntimeRouteStatusCodeByName = {
  successOk: 200,
  clientErrorBadRequest: 400,
} as const;

const RuntimeRouteErrorMessageByName = {
  invalidEventsSessionBootstrapPayload: "Invalid events session bootstrap payload",
} as const;

const RuntimeRouteHeaderNameByName = {
  cookie: "cookie",
  setCookie: "Set-Cookie",
} as const;

const RuntimeStateChangedEventType = "runtime-state-changed";
const EventsSessionBootstrapIssuePathPrefix = "body";
const RuntimeRouteHeaderLookupNameSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.toLowerCase());
const RuntimeRouteHeaderValueListSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value : [value]));
const EventsSessionBootstrapBodyIssueSchema = z
  .object({
    path: z.string(),
    message: z.string(),
  })
  .strict();
const InvalidEventsSessionBootstrapResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.literal(RuntimeRouteErrorMessageByName.invalidEventsSessionBootstrapPayload),
    issues: z.array(EventsSessionBootstrapBodyIssueSchema),
  })
  .strict();

const EventsSessionBootstrapBodySchema = z
  .object({
    apiToken: z.string().trim().min(1).optional(),
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

export interface RuntimeStateSnapshotReader {
  readSnapshot: () => object;
}

export interface RuntimeRouteDependencies {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  apiAuthRequired: boolean;
  apiToken: string;
  apiTokenHeaderName: string;
  browserSessionAuthOwner: BrowserSessionAuthOwner;
  eventStreamClientRegistry: EventStreamClientRegistry;
  runtimeStateOwner: RuntimeStateSnapshotReader;
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
    jsonResponse,
  } = deps;

  if (req.method === RequestMethodByName.get && pathname === RequestPathnameByName.events) {
    const runtimeStateSnapshot = FarfieldHealthStateSchema.parse(runtimeStateOwner.readSnapshot());
    eventStreamClientRegistry.addClient(req, res, {
      type: RuntimeStateChangedEventType,
      state: runtimeStateSnapshot,
    });
    return true;
  }

  if (req.method === RequestMethodByName.get && pathname === RequestPathnameByName.apiHealth) {
    const runtimeStateSnapshot = FarfieldHealthStateSchema.parse(runtimeStateOwner.readSnapshot());
    jsonResponse(res, RuntimeRouteStatusCodeByName.successOk, {
      ok: true,
      state: runtimeStateSnapshot,
    });
    return true;
  }

  if (
    req.method === RequestMethodByName.post &&
    pathname === RequestPathnameByName.apiEventsSession
  ) {
    const currentSession = browserSessionAuthOwner.readSession(
      readHeaderValue(req, RuntimeRouteHeaderNameByName.cookie),
    );
    let bootstrapped = !apiAuthRequired || currentSession.authenticated;
    let expiresAt = currentSession.expiresAt;
    let issuedSessionCookieHeaderValue: string | null = null;

    if (!bootstrapped && apiAuthRequired) {
      const parsedBody = parseEventsSessionBootstrapBody(await readJsonBody(req));
      if (!parsedBody.ok) {
        const invalidResponse = InvalidEventsSessionBootstrapResponseSchema.parse({
          ok: false,
          error: RuntimeRouteErrorMessageByName.invalidEventsSessionBootstrapPayload,
          issues: parsedBody.issues,
        });
        jsonResponse(res, RuntimeRouteStatusCodeByName.clientErrorBadRequest, {
          ...invalidResponse,
        });
        return true;
      }

      const providedToken = resolveEventsSessionBootstrapToken(
        req,
        apiTokenHeaderName,
        parsedBody.body.apiToken,
      );
      if (providedToken !== null && providedToken === apiToken) {
        const issuedSession = browserSessionAuthOwner.issueSessionCookie();
        issuedSessionCookieHeaderValue = issuedSession.setCookieHeaderValue;
        bootstrapped = true;
        expiresAt = issuedSession.expiresAt;
      }
    }

    if (apiAuthRequired && bootstrapped && issuedSessionCookieHeaderValue === null) {
      const refreshedSession = browserSessionAuthOwner.issueSessionCookie();
      issuedSessionCookieHeaderValue = refreshedSession.setCookieHeaderValue;
      expiresAt = refreshedSession.expiresAt;
    }

    if (issuedSessionCookieHeaderValue !== null) {
      res.setHeader(RuntimeRouteHeaderNameByName.setCookie, issuedSessionCookieHeaderValue);
    }

    const response = FarfieldEventsSessionResponseSchema.parse({
      ok: true,
      authRequired: apiAuthRequired,
      bootstrapped,
      expiresAt: bootstrapped ? expiresAt : null,
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
      body: parsedBody.data,
    };
  }

  return {
    ok: false,
    issues: parsedBody.error.issues.map((issue) => ({
      path: buildEventsSessionBootstrapIssuePath(issue.path),
      message: issue.message,
    })),
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
  bodyApiToken: string | undefined,
): string | null {
  // Header token stays authoritative so trusted proxy headers override request-body values.
  const providedHeaderToken = readHeaderValue(req, apiTokenHeaderName);
  const providedBodyToken = bodyApiToken ?? null;
  return providedHeaderToken ?? providedBodyToken;
}

function readHeaderValue(req: IncomingMessage, name: string): string | null {
  const parsedHeaderLookupName = RuntimeRouteHeaderLookupNameSchema.safeParse(name);
  if (!parsedHeaderLookupName.success) {
    return null;
  }

  const parsedHeaderValueList = RuntimeRouteHeaderValueListSchema.safeParse(
    req.headers[parsedHeaderLookupName.data],
  );
  if (!parsedHeaderValueList.success) {
    return null;
  }

  // Repeated headers may include blank artifacts; first non-empty value is authoritative.
  for (const rawHeaderValue of parsedHeaderValueList.data) {
    const normalizedHeaderValue = normalizeOptionalHeaderValue(rawHeaderValue);
    if (normalizedHeaderValue !== null) {
      return normalizedHeaderValue;
    }
  }

  return null;
}

function normalizeOptionalHeaderValue(value: string | null): string | null {
  if (value === null || value.length === 0) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
