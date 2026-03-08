import { FarfieldDebugObservabilityEnvelopeSchema } from "@farfield/protocol";
import {
  type DebugRouteDependencies,
  DebugRouteMethodByName,
  DebugRoutePathnameByName,
  DebugRouteSegmentByName,
} from "./DebugRouteContracts.js";

const DebugHistoryRouteStatusCodeByName = {
  successOk: 200,
  clientErrorBadRequest: 400,
  clientErrorNotFound: 404,
} as const;

const DebugHistoryRouteErrorMessageByName = {
  invalidHistoryEntryIdentifier: "Invalid history entry identifier",
  historyEntryNotFound: "History entry not found",
} as const;

const DebugHistoryRouteSegmentIndexByName = {
  historyCollection: 2,
  historyEntryIdentifier: 3,
} as const;

const DebugHistoryRouteSegmentCountByName = {
  readByIdentifier: 4,
} as const;

const DebugHistoryRouteDefaultHistoryListLimit = 120;
const RoutePathSegmentSeparator = "/";
const HistoryEntryIdentifierRoutePathPrefix = `${DebugRoutePathnameByName.history}${RoutePathSegmentSeparator}`;

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
    const { segments, activityHistoryService, jsonResponse, res } = this.dependencies;

    const historyEntryIdentifierSegment =
      segments[DebugHistoryRouteSegmentIndexByName.historyEntryIdentifier];
    if (
      typeof historyEntryIdentifierSegment !== "string" ||
      !this.isReadHistoryEntryRouteRequest(historyEntryIdentifierSegment)
    ) {
      return false;
    }

    const historyEntryIdentifier = this.tryDecodeHistoryEntryIdentifier(
      historyEntryIdentifierSegment,
    );
    if (historyEntryIdentifier === null) {
      jsonResponse(res, DebugHistoryRouteStatusCodeByName.clientErrorBadRequest, {
        ok: false,
        error: DebugHistoryRouteErrorMessageByName.invalidHistoryEntryIdentifier,
      });
      return true;
    }

    const historyEntry =
      activityHistoryService
        .readHistoryEntries()
        .find((entry) => entry.id === historyEntryIdentifier) ?? null;
    if (!historyEntry) {
      jsonResponse(res, DebugHistoryRouteStatusCodeByName.clientErrorNotFound, {
        ok: false,
        error: DebugHistoryRouteErrorMessageByName.historyEntryNotFound,
      });
      return true;
    }

    jsonResponse(res, DebugHistoryRouteStatusCodeByName.successOk, {
      ok: true,
      entry: historyEntry,
      fullPayload: activityHistoryService.readHistoryDetailPayload(historyEntryIdentifier),
    });
    return true;
  }

  private handleListHistoryRoute(): boolean {
    const { req, pathname, parseInteger, url, activityHistoryService, jsonResponse, res } =
      this.dependencies;

    if (
      !(req.method === DebugRouteMethodByName.get && pathname === DebugRoutePathnameByName.history)
    ) {
      return false;
    }

    const limit = parseInteger(
      url.searchParams.get("limit"),
      DebugHistoryRouteDefaultHistoryListLimit,
    );
    const data = activityHistoryService.readHistoryEntries().slice(-limit);
    jsonResponse(res, DebugHistoryRouteStatusCodeByName.successOk, {
      ok: true,
      history: data,
    });
    return true;
  }

  private handleObservabilitySnapshotRoute(): boolean {
    const { req, pathname, jsonResponse, readObservabilitySnapshot, res } = this.dependencies;

    if (
      !(
        req.method === DebugRouteMethodByName.get &&
        pathname === DebugRoutePathnameByName.observability
      )
    ) {
      return false;
    }

    jsonResponse(
      res,
      DebugHistoryRouteStatusCodeByName.successOk,
      FarfieldDebugObservabilityEnvelopeSchema.parse({
        ok: true,
        snapshot: readObservabilitySnapshot(),
      }),
    );
    return true;
  }

  /**
   * Exact pathname ownership keeps near-match debug paths on the shared top-level not-found contract.
   */
  private isReadHistoryEntryRouteRequest(historyEntryIdentifierSegment: string): boolean {
    const { req, pathname, segments } = this.dependencies;

    if (
      req.method !== DebugRouteMethodByName.get ||
      segments.length !== DebugHistoryRouteSegmentCountByName.readByIdentifier ||
      segments[DebugHistoryRouteSegmentIndexByName.historyCollection] !==
        DebugRouteSegmentByName.history ||
      pathname.endsWith(RoutePathSegmentSeparator)
    ) {
      return false;
    }

    return pathname === `${HistoryEntryIdentifierRoutePathPrefix}${historyEntryIdentifierSegment}`;
  }

  private tryDecodeHistoryEntryIdentifier(historyEntryIdentifierSegment: string): string | null {
    try {
      const decodedHistoryEntryIdentifier = decodeURIComponent(historyEntryIdentifierSegment);
      if (decodedHistoryEntryIdentifier.includes(RoutePathSegmentSeparator)) {
        return null;
      }

      return decodedHistoryEntryIdentifier;
    } catch {
      return null;
    }
  }
}
