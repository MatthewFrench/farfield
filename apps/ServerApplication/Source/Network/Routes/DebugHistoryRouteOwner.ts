import { FarfieldDebugObservabilityEnvelopeSchema } from "@farfield/protocol";
import { type DebugRouteDependencies } from "./DebugRouteContracts.js";

export class DebugHistoryRouteOwner {
  private readonly dependencies: DebugRouteDependencies;

  public constructor(dependencies: DebugRouteDependencies) {
    this.dependencies = dependencies;
  }

  public async handle(): Promise<boolean> {
    if (this.handleReadHistoryEntryRoute()) {
      return true;
    }

    if (this.handleListHistoryRoute()) {
      return true;
    }

    return this.handleObservabilitySnapshotRoute();
  }

  private handleReadHistoryEntryRoute(): boolean {
    const { req, segments, activityHistoryService, jsonResponse, res } = this.dependencies;

    const historyEntrySegment = segments[3];
    if (
      !(req.method === "GET"
      && segments[2] === "history"
      && segments.length === 4
      && typeof historyEntrySegment === "string")
    ) {
      return false;
    }

    let entryId: string;
    try {
      entryId = decodeURIComponent(historyEntrySegment);
    } catch {
      jsonResponse(res, 400, { ok: false, error: "Invalid history entry identifier" });
      return true;
    }

    const entry = activityHistoryService.readHistoryEntries().find((item) => item.id === entryId) ?? null;
    if (!entry) {
      jsonResponse(res, 404, { ok: false, error: "History entry not found" });
      return true;
    }

    jsonResponse(res, 200, {
      ok: true,
      entry,
      fullPayload: activityHistoryService.readHistoryById().get(entryId) ?? null
    });
    return true;
  }

  private handleListHistoryRoute(): boolean {
    const { req, pathname, parseInteger, url, activityHistoryService, jsonResponse, res } = this.dependencies;

    if (!(req.method === "GET" && pathname === "/api/debug/history")) {
      return false;
    }

    const limit = parseInteger(url.searchParams.get("limit"), 120);
    const data = activityHistoryService.readHistoryEntries().slice(-limit);
    jsonResponse(res, 200, { ok: true, history: data });
    return true;
  }

  private handleObservabilitySnapshotRoute(): boolean {
    const { req, pathname, jsonResponse, readObservabilitySnapshot, res } = this.dependencies;

    if (!(req.method === "GET" && pathname === "/api/debug/observability")) {
      return false;
    }

    jsonResponse(res, 200, FarfieldDebugObservabilityEnvelopeSchema.parse({
      ok: true,
      snapshot: readObservabilitySnapshot()
    }));
    return true;
  }
}
