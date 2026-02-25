import { CreateDebugClientErrorBodySchema } from "@farfield/protocol";
import { parseBody } from "../RequestSchemas/HttpSchemas.js";
import {
  readFileNameFromPath,
  type DebugRouteDependencies
} from "./DebugRouteContracts.js";
import { streamDebugFileDownload } from "./DebugFileDownload.js";

export class DebugClientErrorRouteOwner {
  private readonly dependencies: DebugRouteDependencies;

  public constructor(dependencies: DebugRouteDependencies) {
    this.dependencies = dependencies;
  }

  public async handle(): Promise<boolean> {
    if (await this.handleCreateClientErrorRoute()) {
      return true;
    }

    if (await this.handleClearClientErrorsRoute()) {
      return true;
    }

    if (await this.handleListClientErrorsRoute()) {
      return true;
    }

    if (await this.handleSessionLogDownloadRoute()) {
      return true;
    }

    return this.handleReadClientErrorByIdentifierRoute();
  }

  private async handleCreateClientErrorRoute(): Promise<boolean> {
    const {
      req,
      pathname,
      readJsonBody,
      clientErrorStore,
      onClientErrorRecorded,
      jsonResponse,
      res
    } = this.dependencies;

    if (!(req.method === "POST" && pathname === "/api/debug/client-errors")) {
      return false;
    }

    const body = parseBody(CreateDebugClientErrorBodySchema, await readJsonBody(req));
    const event = clientErrorStore.recordClientError(body);
    onClientErrorRecorded({
      errorId: event.errorId,
      origin: event.origin,
      severity: event.severity,
      source: event.source,
      operation: event.operation,
      requestId: event.requestId,
      threadId: event.threadId,
      message: event.message
    });
    jsonResponse(res, 200, {
      ok: true,
      errorId: event.errorId,
      sessionId: event.sessionId,
      recordedAt: event.recordedAt
    });
    return true;
  }

  private async handleClearClientErrorsRoute(): Promise<boolean> {
    const { req, pathname, clientErrorStore, jsonResponse, res } = this.dependencies;

    if (!(req.method === "DELETE" && pathname === "/api/debug/client-errors")) {
      return false;
    }

    const clearedCount = clientErrorStore.clear();
    jsonResponse(res, 200, {
      ok: true,
      clearedCount,
      sessionId: clientErrorStore.getSessionId(),
      sessionLogPath: clientErrorStore.getSessionLogPath()
    });
    return true;
  }

  private async handleListClientErrorsRoute(): Promise<boolean> {
    const { req, pathname, parseInteger, url, clientErrorStore, jsonResponse, res } = this.dependencies;

    if (!(req.method === "GET" && pathname === "/api/debug/client-errors")) {
      return false;
    }

    const limit = parseInteger(url.searchParams.get("limit"), 120);
    const data = clientErrorStore.list(limit);
    jsonResponse(res, 200, {
      ok: true,
      data,
      sessionId: clientErrorStore.getSessionId(),
      sessionLogPath: clientErrorStore.getSessionLogPath()
    });
    return true;
  }

  private async handleSessionLogDownloadRoute(): Promise<boolean> {
    const { req, pathname, clientErrorStore, jsonResponse, res, toErrorMessage } = this.dependencies;

    if (!(req.method === "GET" && pathname === "/api/debug/client-errors/session-log")) {
      return false;
    }

    const filePath = clientErrorStore.getSessionLogPath();
    const fileName = readFileNameFromPath(filePath);
    try {
      await streamDebugFileDownload(res, filePath, fileName);
      return true;
    } catch (error) {
      if (toErrorMessage(error).includes("ENOENT")) {
        jsonResponse(res, 404, {
          ok: false,
          error: "Client error session log not found"
        });
        return true;
      }
      jsonResponse(res, 500, {
        ok: false,
        error: toErrorMessage(error)
      });
      return true;
    }
  }

  private handleReadClientErrorByIdentifierRoute(): boolean {
    const { req, segments, clientErrorStore, jsonResponse, res } = this.dependencies;

    const clientErrorIdSegment = segments[3];
    if (
      !(req.method === "GET"
      && segments[2] === "client-errors"
      && segments.length === 4
      && typeof clientErrorIdSegment === "string")
    ) {
      return false;
    }

    let errorId: string;
    try {
      errorId = decodeURIComponent(clientErrorIdSegment);
    } catch {
      jsonResponse(res, 400, {
        ok: false,
        error: "Invalid client error identifier"
      });
      return true;
    }

    const errorEvent = clientErrorStore.getById(errorId);
    if (!errorEvent) {
      jsonResponse(res, 404, {
        ok: false,
        error: "Client error not found"
      });
      return true;
    }

    jsonResponse(res, 200, {
      ok: true,
      error: errorEvent,
      sessionId: clientErrorStore.getSessionId(),
      sessionLogPath: clientErrorStore.getSessionLogPath()
    });
    return true;
  }
}
