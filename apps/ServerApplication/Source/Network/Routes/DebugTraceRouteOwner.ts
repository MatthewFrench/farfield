import { parseBody, TraceMarkBodySchema, TraceStartBodySchema } from "../../HttpSchemas.js";
import { type DebugRouteDependencies } from "./DebugRouteContracts.js";
import { streamDebugFileDownload } from "./DebugFileDownload.js";

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

    if (!(req.method === "GET" && pathname === "/api/debug/trace/status")) {
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

    if (!(req.method === "POST" && pathname === "/api/debug/trace/start")) {
      return false;
    }

    const body = parseBody(TraceStartBodySchema, await readJsonBody(req));
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

    if (!(req.method === "POST" && pathname === "/api/debug/trace/mark")) {
      return false;
    }

    const body = parseBody(TraceMarkBodySchema, await readJsonBody(req));
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

    if (!(req.method === "POST" && pathname === "/api/debug/trace/stop")) {
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

    if (
      !(req.method === "GET"
      && segments[2] === "trace"
      && segments[3]
      && segments[4] === "download")
    ) {
      return false;
    }

    const traceId = decodeURIComponent(segments[3]);
    const trace = activityHistoryService.readTraceById(traceId);

    if (!trace) {
      jsonResponse(res, 404, { ok: false, error: "Trace not found" });
      return true;
    }

    try {
      await streamDebugFileDownload(res, trace.path, `${trace.id}.ndjson`);
    } catch (error) {
      if (toErrorMessage(error).includes("ENOENT")) {
        jsonResponse(res, 404, { ok: false, error: "Trace not found" });
        return true;
      }
      jsonResponse(res, 500, { ok: false, error: toErrorMessage(error) });
      return true;
    }
    return true;
  }
}
