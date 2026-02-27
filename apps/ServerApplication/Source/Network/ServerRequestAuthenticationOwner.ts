import type { IncomingMessage, ServerResponse } from "node:http";
import type { BrowserSessionAuthOwner } from "./BrowserSessionAuthOwner.js";
import { RequestPathnameByName } from "./RequestPathContracts.js";
import type { ThreadRouteDependencies } from "./Routes/ThreadRoutes.js";

const COOKIE_HEADER_NAME = "cookie";
const STATUS_CODE_UNAUTHORIZED = 401;

export interface ServerRequestAuthenticationOwnerDependencies {
  apiAuthRequired: boolean;
  apiToken: string;
  apiTokenHeaderName: string;
  apiTokenResponseHeader: string;
  browserSessionAuthOwner: BrowserSessionAuthOwner;
  jsonResponse: ThreadRouteDependencies["jsonResponse"];
  readHeader: (req: IncomingMessage, name: string) => string | null;
}

/**
 * Owns API authentication checks for request routing.
 * Route handlers rely on this owner so auth behavior remains consistent across all endpoints.
 */
export class ServerRequestAuthenticationOwner {
  private readonly deps: ServerRequestAuthenticationOwnerDependencies;

  public constructor(dependencies: ServerRequestAuthenticationOwnerDependencies) {
    this.deps = dependencies;
  }

  public requireApiAuth(req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
    if (pathname === RequestPathnameByName.apiEventsSession) {
      return true;
    }
    if (
      !pathname.startsWith(RequestPathnameByName.apiPrefix) &&
      pathname !== RequestPathnameByName.events
    ) {
      return true;
    }

    if (!this.isAuthenticatedRequest(req)) {
      this.deps.jsonResponse(res, STATUS_CODE_UNAUTHORIZED, {
        ok: false,
        error: `Unauthorized: missing or invalid ${this.deps.apiTokenResponseHeader}`,
      });
      return false;
    }

    return true;
  }

  private isAuthenticatedRequest(req: IncomingMessage): boolean {
    if (!this.deps.apiAuthRequired) {
      return true;
    }
    const session = this.deps.browserSessionAuthOwner.readSession(
      this.deps.readHeader(req, COOKIE_HEADER_NAME),
    );
    if (session.authenticated) {
      return true;
    }
    const providedToken = this.deps.readHeader(req, this.deps.apiTokenHeaderName);
    if (providedToken === null || providedToken.length === 0) {
      return false;
    }
    return providedToken === this.deps.apiToken;
  }
}
