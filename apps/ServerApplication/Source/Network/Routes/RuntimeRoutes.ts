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

const EventsSessionBootstrapBodySchema = z
  .object({
    apiToken: z.string().trim().min(1).optional()
  })
  .strict();

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
      type: "runtime-state-changed",
      state: runtimeStateSnapshot
    });
    return true;
  }

  if (req.method === RequestMethodByName.get && pathname === RequestPathnameByName.apiHealth) {
    jsonResponse(res, 200, {
      ok: true,
      state: runtimeStateOwner.readSnapshot()
    });
    return true;
  }

  if (req.method === RequestMethodByName.post && pathname === RequestPathnameByName.apiEventsSession) {
    const currentSession = browserSessionAuthOwner.readSession(readHeaderValue(req, "cookie"));
    let bootstrapped = !apiAuthRequired || currentSession.authenticated;
    let expiresAt = currentSession.expiresAt;

    if (!bootstrapped && apiAuthRequired) {
      const parsedBody = EventsSessionBootstrapBodySchema.safeParse(await readJsonBody(req));
      if (!parsedBody.success) {
        jsonResponse(res, 400, {
          ok: false,
          error: "Invalid events session bootstrap payload"
        });
        return true;
      }

      const providedHeaderToken = normalizeOptionalHeaderValue(readHeaderValue(req, apiTokenHeaderName));
      const providedBodyToken = parsedBody.data.apiToken ?? null;
      const providedToken = providedHeaderToken ?? providedBodyToken;
      if (providedToken && providedToken === apiToken) {
        const issuedSession = browserSessionAuthOwner.issueSessionCookie();
        res.setHeader("Set-Cookie", issuedSession.setCookieHeaderValue);
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
    jsonResponse(res, 200, response);
    return true;
  }

  return false;
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
