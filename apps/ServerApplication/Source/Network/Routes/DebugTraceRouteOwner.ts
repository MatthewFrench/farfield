import { parseTraceMarkBody, parseTraceStartBody } from "../RequestSchemas/HttpSchemas.js";
import {
  DebugRouteMethodByName,
  DebugRoutePathnameByName,
  DebugRouteSegmentByName,
  type DebugRouteDependencies
} from "./DebugRouteContracts.js";
import {
  DebugFileDownloadError,
  DebugFileDownloadErrorCodeByName,
  streamDebugFileDownload
} from "./DebugFileDownload.js";

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

    if (!(req.method === DebugRouteMethodByName.get && pathname === DebugRoutePathnameByName.traceStatus)) {
      return false;
    }

    jsonResponse(res, 200, {
      ok: true,
      active: activityHistoryService.readActiveTraceSummary(),
      recent: activityHistoryService.readRecentTraces()
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
      res
    } = this.dependencies;

    if (!(req.method === DebugRouteMethodByName.post && pathname === DebugRoutePathnameByName.traceStart)) {
      return false;
    }

    const body = parseTraceStartBody(await readJsonBody(req));
    const summary = activityHistoryService.startTrace(
      traceDirectoryPath,
      body.label,
      ensureTraceDirectory
    );
    if (!summary) {
      jsonResponse(res, 409, {
        ok: false,
        error: "A trace is already active"
      });
      return true;
    }

    pushSystem("Trace started", {
      traceId: summary.id,
      label: body.label
    });

    jsonResponse(res, 200, {
      ok: true,
      trace: summary
    });
    return true;
  }

  private async handleTraceMarkRoute(): Promise<boolean> {
    const { req, pathname, readJsonBody, activityHistoryService, jsonResponse, res } = this.dependencies;

    if (!(req.method === DebugRouteMethodByName.post && pathname === DebugRoutePathnameByName.traceMark)) {
      return false;
    }

    const body = parseTraceMarkBody(await readJsonBody(req));
    const marked = activityHistoryService.markTrace(body.note);
    if (!marked) {
      jsonResponse(res, 409, { ok: false, error: "No active trace" });
      return true;
    }

    jsonResponse(res, 200, { ok: true });
    return true;
  }

  private handleTraceStopRoute(): boolean {
    const { req, pathname, activityHistoryService, pushSystem, jsonResponse, res } = this.dependencies;

    if (!(req.method === DebugRouteMethodByName.post && pathname === DebugRoutePathnameByName.traceStop)) {
      return false;
    }

    const summary = activityHistoryService.stopTrace();
    if (!summary) {
      jsonResponse(res, 409, { ok: false, error: "No active trace" });
      return true;
    }

    pushSystem("Trace stopped", { traceId: summary.id });

    jsonResponse(res, 200, {
      ok: true,
      trace: summary
    });
    return true;
  }

  private async handleTraceDownloadRoute(): Promise<boolean> {
    const {
      req,
      segments,
      activityHistoryService,
      jsonResponse,
      res,
      toErrorMessage
    } = this.dependencies;

    const traceIdentifierSegment = segments[3];
    const isTraceDownloadRouteRequest =
      req.method === DebugRouteMethodByName.get
      && segments[2] === DebugRouteSegmentByName.trace
      && typeof traceIdentifierSegment === "string"
      && segments[4] === DebugRouteSegmentByName.download;
    if (!isTraceDownloadRouteRequest) {
      return false;
    }

    let traceId: string;
    try {
      traceId = decodeURIComponent(traceIdentifierSegment);
    } catch {
      jsonResponse(res, 400, { ok: false, error: "Invalid trace identifier" });
      return true;
    }

    const trace = activityHistoryService.readTraceById(traceId);

    if (!trace) {
      jsonResponse(res, 404, { ok: false, error: "Trace not found" });
      return true;
    }

    try {
      await streamDebugFileDownload(res, trace.path, `${trace.id}.ndjson`);
    } catch (error) {
      if (
        error instanceof DebugFileDownloadError
        && (
          error.code === DebugFileDownloadErrorCodeByName.notFound
          || error.code === DebugFileDownloadErrorCodeByName.notFile
        )
      ) {
        jsonResponse(res, 404, { ok: false, error: "Trace not found" });
        return true;
      }

      jsonResponse(res, 500, { ok: false, error: toErrorMessage(error) });
      return true;
    }
    return true;
  }
}
