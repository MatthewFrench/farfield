import { type JsonValue } from "@farfield/protocol";
import type { CapabilityPendingServerRequestsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoveragePendingServerRequestMethodCount,
  DebugAppServerCoveragePendingServerRequestSummary,
  DebugAppServerCoveragePendingServerRequestsResult,
} from "../DomainModel/DebugAppServerCoverageContracts";

const PREVIEW_TEXT_MAXIMUM_LENGTH = 480;

function stringifyPreview(value: JsonValue | object | undefined): string {
  if (value === undefined) {
    return "(none)";
  }

  const serializedValue = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (serializedValue.length <= PREVIEW_TEXT_MAXIMUM_LENGTH) {
    return serializedValue;
  }

  return `${serializedValue.slice(0, PREVIEW_TEXT_MAXIMUM_LENGTH)}…`;
}

function mapPendingServerRequestSummary(
  request: CapabilityPendingServerRequestsResponse["requests"][number],
): DebugAppServerCoveragePendingServerRequestSummary {
  return {
    requestId: request.requestId,
    method: request.method,
    receivedAtMilliseconds: request.receivedAtMilliseconds,
    preview: stringifyPreview(request.params),
  };
}

function mapMethodCounts(
  requestSummaries: DebugAppServerCoveragePendingServerRequestSummary[],
): DebugAppServerCoveragePendingServerRequestMethodCount[] {
  const countsByMethod = new Map<string, number>();
  for (const requestSummary of requestSummaries) {
    const existingCount = countsByMethod.get(requestSummary.method) ?? 0;
    countsByMethod.set(requestSummary.method, existingCount + 1);
  }

  return [...countsByMethod.entries()]
    .map(([method, count]) => ({
      method,
      count,
    }))
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }
      return left.method.localeCompare(right.method);
    });
}

export function mapPendingServerRequestsResult(
  response: CapabilityPendingServerRequestsResponse,
): DebugAppServerCoveragePendingServerRequestsResult {
  const requestSummaries = response.requests.map((request) =>
    mapPendingServerRequestSummary(request),
  );
  const methodCounts = mapMethodCounts(requestSummaries);

  return {
    requestCount: requestSummaries.length,
    requests: requestSummaries,
    methodCounts,
    readAtIso8601: new Date().toISOString(),
  };
}
