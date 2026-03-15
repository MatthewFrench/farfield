import { CreateDebugClientErrorBodySchema } from "@farfield/protocol";
import { parseBody } from "../RequestSchemas/HttpSchemas.js";
import {
  DebugFileDownloadError,
  DebugFileDownloadErrorCodeByName,
  streamDebugFileDownload,
} from "./DebugFileDownload.js";
import {
  type DebugRouteDependencies,
  DebugRouteMethodByName,
  DebugRoutePathnameByName,
  DebugRouteSegmentByName,
  readFileNameFromPath,
} from "./DebugRouteContracts.js";

const DebugClientErrorRouteStatusCodeByName = {
  successOk: 200,
  clientErrorBadRequest: 400,
  clientErrorNotFound: 404,
  serverErrorInternal: 500,
} as const;

const DebugClientErrorRouteErrorMessageByName = {
  invalidClientErrorIdentifier: "Invalid client error identifier",
  clientErrorNotFound: "Client error not found",
  clientErrorSessionLogNotFound: "Client error session log not found",
} as const;

const DebugClientErrorRouteSegmentIndexByName = {
  clientErrorCollection: 2,
  clientErrorIdentifier: 3,
} as const;

const DebugClientErrorRouteSegmentCountByName = {
  readByIdentifier: 4,
} as const;

const RoutePathSegmentSeparator = "/";
const ClientErrorIdentifierRoutePathPrefix = `${DebugRoutePathnameByName.clientErrors}${RoutePathSegmentSeparator}`;

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
      res,
    } = this.dependencies;

    if (
      !(
        req.method === DebugRouteMethodByName.post &&
        pathname === DebugRoutePathnameByName.clientErrors
      )
    ) {
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
      message: event.message,
    });
    jsonResponse(res, DebugClientErrorRouteStatusCodeByName.successOk, {
      ok: true,
      errorId: event.errorId,
      sessionId: event.sessionId,
      recordedAt: event.recordedAt,
    });
    return true;
  }

  private async handleClearClientErrorsRoute(): Promise<boolean> {
    const { req, pathname, clientErrorStore, jsonResponse, res } = this.dependencies;

    if (
      !(
        req.method === DebugRouteMethodByName.delete &&
        pathname === DebugRoutePathnameByName.clientErrors
      )
    ) {
      return false;
    }

    const clearedCount = clientErrorStore.clear();
    jsonResponse(res, DebugClientErrorRouteStatusCodeByName.successOk, {
      ok: true,
      clearedCount,
      sessionId: clientErrorStore.getSessionId(),
      sessionLogPath: clientErrorStore.getSessionLogPath(),
    });
    return true;
  }

  private async handleListClientErrorsRoute(): Promise<boolean> {
    const { req, pathname, parseInteger, url, clientErrorStore, jsonResponse, res } =
      this.dependencies;

    if (
      !(
        req.method === DebugRouteMethodByName.get &&
        pathname === DebugRoutePathnameByName.clientErrors
      )
    ) {
      return false;
    }

    const limit = parseInteger(url.searchParams.get("limit"), 120);
    const data = clientErrorStore.list(limit);
    jsonResponse(res, DebugClientErrorRouteStatusCodeByName.successOk, {
      ok: true,
      data,
      sessionId: clientErrorStore.getSessionId(),
      sessionLogPath: clientErrorStore.getSessionLogPath(),
    });
    return true;
  }

  private async handleSessionLogDownloadRoute(): Promise<boolean> {
    const { req, pathname, clientErrorStore, jsonResponse, res, toErrorMessage } =
      this.dependencies;

    if (
      !(
        req.method === DebugRouteMethodByName.get &&
        pathname === DebugRoutePathnameByName.clientErrorSessionLog
      )
    ) {
      return false;
    }

    const filePath = clientErrorStore.getSessionLogPath();
    const fileName = readFileNameFromPath(filePath);
    try {
      await streamDebugFileDownload(res, filePath, fileName);
      return true;
    } catch (error) {
      if (
        error instanceof DebugFileDownloadError &&
        (error.code === DebugFileDownloadErrorCodeByName.notFound ||
          error.code === DebugFileDownloadErrorCodeByName.notFile)
      ) {
        jsonResponse(res, DebugClientErrorRouteStatusCodeByName.clientErrorNotFound, {
          ok: false,
          error: DebugClientErrorRouteErrorMessageByName.clientErrorSessionLogNotFound,
        });
        return true;
      }

      jsonResponse(res, DebugClientErrorRouteStatusCodeByName.serverErrorInternal, {
        ok: false,
        error: toErrorMessage(error),
      });
      return true;
    }
  }

  private handleReadClientErrorByIdentifierRoute(): boolean {
    const { segments, clientErrorStore, jsonResponse, res } = this.dependencies;

    const clientErrorIdentifierSegment =
      segments[DebugClientErrorRouteSegmentIndexByName.clientErrorIdentifier];
    if (
      typeof clientErrorIdentifierSegment !== "string" ||
      !this.isReadClientErrorByIdentifierRequest(clientErrorIdentifierSegment)
    ) {
      return false;
    }

    const errorId = this.tryDecodeClientErrorIdentifier(clientErrorIdentifierSegment);
    if (errorId === null) {
      jsonResponse(res, DebugClientErrorRouteStatusCodeByName.clientErrorBadRequest, {
        ok: false,
        error: DebugClientErrorRouteErrorMessageByName.invalidClientErrorIdentifier,
      });
      return true;
    }

    const errorEvent = clientErrorStore.getById(errorId);
    if (!errorEvent) {
      jsonResponse(res, DebugClientErrorRouteStatusCodeByName.clientErrorNotFound, {
        ok: false,
        error: DebugClientErrorRouteErrorMessageByName.clientErrorNotFound,
      });
      return true;
    }

    jsonResponse(res, DebugClientErrorRouteStatusCodeByName.successOk, {
      ok: true,
      error: errorEvent,
      sessionId: clientErrorStore.getSessionId(),
      sessionLogPath: clientErrorStore.getSessionLogPath(),
    });
    return true;
  }

  /**
   * Keep identifier route ownership strict so near-match path shapes return the global not-found contract.
   */
  private isReadClientErrorByIdentifierRequest(clientErrorIdentifierSegment: string): boolean {
    const { req, pathname, segments } = this.dependencies;

    if (
      req.method !== DebugRouteMethodByName.get ||
      segments.length !== DebugClientErrorRouteSegmentCountByName.readByIdentifier ||
      segments[DebugClientErrorRouteSegmentIndexByName.clientErrorCollection] !==
        DebugRouteSegmentByName.clientErrors ||
      pathname.endsWith(RoutePathSegmentSeparator)
    ) {
      return false;
    }

    return pathname === `${ClientErrorIdentifierRoutePathPrefix}${clientErrorIdentifierSegment}`;
  }

  private tryDecodeClientErrorIdentifier(clientErrorIdentifierSegment: string): string | null {
    try {
      const decodedClientErrorIdentifier = decodeURIComponent(clientErrorIdentifierSegment);
      if (decodedClientErrorIdentifier.includes(RoutePathSegmentSeparator)) {
        return null;
      }
      return decodedClientErrorIdentifier;
    } catch {
      return null;
    }
  }
}
