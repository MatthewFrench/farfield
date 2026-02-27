import { parseTraceMarkBody, parseTraceStartBody } from "../RequestSchemas/HttpSchemas.js";
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
} from "./DebugRouteContracts.js";

const DebugTraceRouteStatusCodeByName = {
  successOk: 200,
  clientErrorBadRequest: 400,
  clientErrorConflict: 409,
  clientErrorNotFound: 404,
  serverErrorInternal: 500,
} as const;

const DebugTraceRouteErrorMessageByName = {
  traceAlreadyActive: "A trace is already active",
  noActiveTrace: "No active trace",
  invalidTraceIdentifier: "Invalid trace identifier",
  traceNotFound: "Trace not found",
} as const;

const DebugTraceRouteSegmentIndexByName = {
  traceCollection: 2,
  traceIdentifier: 3,
  traceDownloadOperation: 4,
} as const;

const DebugTraceRouteSegmentCountByName = {
  downloadByIdentifier: 5,
} as const;

const RoutePathSegmentSeparator = "/";
const TraceIdentifierDownloadRoutePathPrefix = "/api/debug/trace/";
const TraceDownloadRoutePathSuffix = "/download";

export class DebugTraceRouteOwner {
  private readonly dependencies: DebugRouteDependencies;

  public constructor(dependencies: DebugRouteDependencies) {
    this.dependencies = dependencies;
  }

  public async handle(): Promise<boolean> {
    if (this.handleTraceStatusRoute()) {
      return true;
    }

    if (await this.handleTraceStartRoute()) {
      return true;
    }

    if (await this.handleTraceMarkRoute()) {
      return true;
    }

    if (this.handleTraceStopRoute()) {
      return true;
    }

    return this.handleTraceDownloadRoute();
  }

  private handleTraceStatusRoute(): boolean {
    const { req, pathname, activityHistoryService, jsonResponse, res } = this.dependencies;

    if (
      !(
        req.method === DebugRouteMethodByName.get &&
        pathname === DebugRoutePathnameByName.traceStatus
      )
    ) {
      return false;
    }

    jsonResponse(res, DebugTraceRouteStatusCodeByName.successOk, {
      ok: true,
      active: activityHistoryService.readActiveTraceSummary(),
      recent: activityHistoryService.readRecentTraces(),
    });
    return true;
  }

  private async handleTraceStartRoute(): Promise<boolean> {
    const {
      req,
      pathname,
      readJsonBody,
      activityHistoryService,
      traceDirectoryPath,
      ensureTraceDirectory,
      pushSystem,
      jsonResponse,
      res,
    } = this.dependencies;

    if (
      !(
        req.method === DebugRouteMethodByName.post &&
        pathname === DebugRoutePathnameByName.traceStart
      )
    ) {
      return false;
    }

    const body = parseTraceStartBody(await readJsonBody(req));
    const summary = activityHistoryService.startTrace(
      traceDirectoryPath,
      body.label,
      ensureTraceDirectory,
    );
    if (!summary) {
      jsonResponse(res, DebugTraceRouteStatusCodeByName.clientErrorConflict, {
        ok: false,
        error: DebugTraceRouteErrorMessageByName.traceAlreadyActive,
      });
      return true;
    }

    pushSystem("Trace started", {
      traceId: summary.id,
      label: body.label,
    });

    jsonResponse(res, DebugTraceRouteStatusCodeByName.successOk, {
      ok: true,
      trace: summary,
    });
    return true;
  }

  private async handleTraceMarkRoute(): Promise<boolean> {
    const { req, pathname, readJsonBody, activityHistoryService, jsonResponse, res } =
      this.dependencies;

    if (
      !(
        req.method === DebugRouteMethodByName.post &&
        pathname === DebugRoutePathnameByName.traceMark
      )
    ) {
      return false;
    }

    const body = parseTraceMarkBody(await readJsonBody(req));
    const marked = activityHistoryService.markTrace(body.note);
    if (!marked) {
      jsonResponse(res, DebugTraceRouteStatusCodeByName.clientErrorConflict, {
        ok: false,
        error: DebugTraceRouteErrorMessageByName.noActiveTrace,
      });
      return true;
    }

    jsonResponse(res, DebugTraceRouteStatusCodeByName.successOk, { ok: true });
    return true;
  }

  private handleTraceStopRoute(): boolean {
    const { req, pathname, activityHistoryService, pushSystem, jsonResponse, res } =
      this.dependencies;

    if (
      !(
        req.method === DebugRouteMethodByName.post &&
        pathname === DebugRoutePathnameByName.traceStop
      )
    ) {
      return false;
    }

    const summary = activityHistoryService.stopTrace();
    if (!summary) {
      jsonResponse(res, DebugTraceRouteStatusCodeByName.clientErrorConflict, {
        ok: false,
        error: DebugTraceRouteErrorMessageByName.noActiveTrace,
      });
      return true;
    }

    pushSystem("Trace stopped", { traceId: summary.id });

    jsonResponse(res, DebugTraceRouteStatusCodeByName.successOk, {
      ok: true,
      trace: summary,
    });
    return true;
  }

  private async handleTraceDownloadRoute(): Promise<boolean> {
    const { segments, activityHistoryService, jsonResponse, res, toErrorMessage } =
      this.dependencies;

    const traceIdentifierSegment = segments[DebugTraceRouteSegmentIndexByName.traceIdentifier];
    if (
      typeof traceIdentifierSegment !== "string" ||
      !this.isTraceDownloadRouteRequest(traceIdentifierSegment)
    ) {
      return false;
    }

    const traceId = this.tryDecodeTraceIdentifier(traceIdentifierSegment);
    if (traceId === null) {
      jsonResponse(res, DebugTraceRouteStatusCodeByName.clientErrorBadRequest, {
        ok: false,
        error: DebugTraceRouteErrorMessageByName.invalidTraceIdentifier,
      });
      return true;
    }

    const trace = activityHistoryService.readTraceById(traceId);

    if (!trace) {
      jsonResponse(res, DebugTraceRouteStatusCodeByName.clientErrorNotFound, {
        ok: false,
        error: DebugTraceRouteErrorMessageByName.traceNotFound,
      });
      return true;
    }

    try {
      await streamDebugFileDownload(res, trace.path, `${trace.id}.ndjson`);
    } catch (error) {
      if (
        error instanceof DebugFileDownloadError &&
        (error.code === DebugFileDownloadErrorCodeByName.notFound ||
          error.code === DebugFileDownloadErrorCodeByName.notFile)
      ) {
        jsonResponse(res, DebugTraceRouteStatusCodeByName.clientErrorNotFound, {
          ok: false,
          error: DebugTraceRouteErrorMessageByName.traceNotFound,
        });
        return true;
      }

      jsonResponse(res, DebugTraceRouteStatusCodeByName.serverErrorInternal, {
        ok: false,
        error: toErrorMessage(error),
      });
      return true;
    }
    return true;
  }

  /**
   * Exact pathname ownership keeps near-match trace download paths on the shared top-level not-found contract.
   */
  private isTraceDownloadRouteRequest(traceIdentifierSegment: string): boolean {
    const { req, pathname, segments } = this.dependencies;

    if (
      req.method !== DebugRouteMethodByName.get ||
      segments.length !== DebugTraceRouteSegmentCountByName.downloadByIdentifier ||
      segments[DebugTraceRouteSegmentIndexByName.traceCollection] !==
        DebugRouteSegmentByName.trace ||
      segments[DebugTraceRouteSegmentIndexByName.traceDownloadOperation] !==
        DebugRouteSegmentByName.download ||
      pathname.endsWith(RoutePathSegmentSeparator)
    ) {
      return false;
    }

    return (
      pathname ===
      `${TraceIdentifierDownloadRoutePathPrefix}${traceIdentifierSegment}${TraceDownloadRoutePathSuffix}`
    );
  }

  private tryDecodeTraceIdentifier(traceIdentifierSegment: string): string | null {
    try {
      const decodedTraceIdentifier = decodeURIComponent(traceIdentifierSegment);
      if (decodedTraceIdentifier.includes(RoutePathSegmentSeparator)) {
        return null;
      }

      return decodedTraceIdentifier;
    } catch {
      return null;
    }
  }
}
