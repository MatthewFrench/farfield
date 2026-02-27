import {
  REQUEST_PATH_SEGMENT_SEPARATOR,
  RequestPathnameByName,
  RequestPathSegmentByName,
  readPathSegmentsFromPathname,
} from "./RequestPathContracts.js";

const LONG_IDENTIFIER_SEGMENT_THRESHOLD = 28;
const HEXADECIMAL_IDENTIFIER_SEGMENT_PATTERN = /^[0-9a-f]{16,}$/i;

const PATH_SEGMENT_INDEX_BY_NAME = {
  third: 2,
  fourth: 3,
  fifth: 4,
} as const;

const PATH_SEGMENT_COUNT_BY_NAME = {
  threadMemberMinimum: 3,
  debugHistoryEntry: 4,
  debugClientErrorEntry: 4,
  debugTraceDownload: 5,
} as const;

const METRICS_ROUTE_PLACEHOLDER_BY_NAME = {
  threadIdentifier: ":threadId",
  historyEntryIdentifier: ":historyEntryId",
  clientErrorIdentifier: ":clientErrorId",
  traceIdentifier: ":traceId",
  genericIdentifier: ":id",
} as const;

interface MetricsRouteClassification {
  replacementBySegmentIndex: Readonly<Record<number, string>>;
}

interface PathSegmentMatchConstraint {
  pathSegmentIndex: number;
  expectedPathSegment: string;
}

interface MetricsRoutePathDefinition {
  leadingPathSegments: readonly string[];
  minimumSegmentCount: number | null;
  exactSegmentCount: number | null;
  requiredPathSegmentMatches: readonly PathSegmentMatchConstraint[];
  excludedPathSegmentMatches: readonly PathSegmentMatchConstraint[];
  classification: MetricsRouteClassification;
}

const THREAD_MEMBER_ROUTE_PREFIX_SEGMENTS = [
  RequestPathSegmentByName.api,
  RequestPathSegmentByName.threads,
] as const;

const DEBUG_HISTORY_ENTRY_ROUTE_PREFIX_SEGMENTS = [
  RequestPathSegmentByName.api,
  RequestPathSegmentByName.debug,
  RequestPathSegmentByName.history,
] as const;

const DEBUG_CLIENT_ERROR_ENTRY_ROUTE_PREFIX_SEGMENTS = [
  RequestPathSegmentByName.api,
  RequestPathSegmentByName.debug,
  RequestPathSegmentByName.clientErrors,
] as const;

const DEBUG_TRACE_DOWNLOAD_ROUTE_PREFIX_SEGMENTS = [
  RequestPathSegmentByName.api,
  RequestPathSegmentByName.debug,
  RequestPathSegmentByName.trace,
] as const;

const NO_PATH_SEGMENT_MATCH_CONSTRAINTS: readonly PathSegmentMatchConstraint[] = [];

const THREAD_MEMBER_ROUTE_CLASSIFICATION: MetricsRouteClassification = {
  replacementBySegmentIndex: {
    [PATH_SEGMENT_INDEX_BY_NAME.third]: METRICS_ROUTE_PLACEHOLDER_BY_NAME.threadIdentifier,
  },
};

const DEBUG_HISTORY_ENTRY_ROUTE_CLASSIFICATION: MetricsRouteClassification = {
  replacementBySegmentIndex: {
    [PATH_SEGMENT_INDEX_BY_NAME.fourth]: METRICS_ROUTE_PLACEHOLDER_BY_NAME.historyEntryIdentifier,
  },
};

const DEBUG_CLIENT_ERROR_ENTRY_ROUTE_CLASSIFICATION: MetricsRouteClassification = {
  replacementBySegmentIndex: {
    [PATH_SEGMENT_INDEX_BY_NAME.fourth]: METRICS_ROUTE_PLACEHOLDER_BY_NAME.clientErrorIdentifier,
  },
};

const DEBUG_TRACE_DOWNLOAD_ROUTE_CLASSIFICATION: MetricsRouteClassification = {
  replacementBySegmentIndex: {
    [PATH_SEGMENT_INDEX_BY_NAME.fourth]: METRICS_ROUTE_PLACEHOLDER_BY_NAME.traceIdentifier,
  },
};

const DEBUG_TRACE_DOWNLOAD_REQUIRED_PATH_SEGMENT_MATCH: PathSegmentMatchConstraint = {
  pathSegmentIndex: PATH_SEGMENT_INDEX_BY_NAME.fifth,
  expectedPathSegment: RequestPathSegmentByName.download,
};

const DEBUG_CLIENT_ERROR_SESSION_LOG_EXCLUDED_PATH_SEGMENT_MATCH: PathSegmentMatchConstraint = {
  pathSegmentIndex: PATH_SEGMENT_INDEX_BY_NAME.fourth,
  expectedPathSegment: RequestPathSegmentByName.sessionLog,
};

/**
 * Route classification mirrors dynamic segments owned by Network route owners so
 * static paths (for example `session-log`) cannot collapse into identifier aggregates.
 */
const METRICS_ROUTE_PATH_DEFINITIONS: readonly MetricsRoutePathDefinition[] = [
  {
    leadingPathSegments: THREAD_MEMBER_ROUTE_PREFIX_SEGMENTS,
    minimumSegmentCount: PATH_SEGMENT_COUNT_BY_NAME.threadMemberMinimum,
    exactSegmentCount: null,
    requiredPathSegmentMatches: NO_PATH_SEGMENT_MATCH_CONSTRAINTS,
    excludedPathSegmentMatches: NO_PATH_SEGMENT_MATCH_CONSTRAINTS,
    classification: THREAD_MEMBER_ROUTE_CLASSIFICATION,
  },
  {
    leadingPathSegments: DEBUG_HISTORY_ENTRY_ROUTE_PREFIX_SEGMENTS,
    minimumSegmentCount: null,
    exactSegmentCount: PATH_SEGMENT_COUNT_BY_NAME.debugHistoryEntry,
    requiredPathSegmentMatches: NO_PATH_SEGMENT_MATCH_CONSTRAINTS,
    excludedPathSegmentMatches: NO_PATH_SEGMENT_MATCH_CONSTRAINTS,
    classification: DEBUG_HISTORY_ENTRY_ROUTE_CLASSIFICATION,
  },
  {
    leadingPathSegments: DEBUG_CLIENT_ERROR_ENTRY_ROUTE_PREFIX_SEGMENTS,
    minimumSegmentCount: null,
    exactSegmentCount: PATH_SEGMENT_COUNT_BY_NAME.debugClientErrorEntry,
    requiredPathSegmentMatches: NO_PATH_SEGMENT_MATCH_CONSTRAINTS,
    excludedPathSegmentMatches: [DEBUG_CLIENT_ERROR_SESSION_LOG_EXCLUDED_PATH_SEGMENT_MATCH],
    classification: DEBUG_CLIENT_ERROR_ENTRY_ROUTE_CLASSIFICATION,
  },
  {
    leadingPathSegments: DEBUG_TRACE_DOWNLOAD_ROUTE_PREFIX_SEGMENTS,
    minimumSegmentCount: null,
    exactSegmentCount: PATH_SEGMENT_COUNT_BY_NAME.debugTraceDownload,
    requiredPathSegmentMatches: [DEBUG_TRACE_DOWNLOAD_REQUIRED_PATH_SEGMENT_MATCH],
    excludedPathSegmentMatches: NO_PATH_SEGMENT_MATCH_CONSTRAINTS,
    classification: DEBUG_TRACE_DOWNLOAD_ROUTE_CLASSIFICATION,
  },
] as const;

/**
 * Owns route-pathname normalization for request-metrics aggregation so thread/debug dynamic
 * path segments collapse to stable placeholders and high-cardinality route keys stay bounded.
 */
export function normalizeMetricsRoutePathname(pathname: string): string {
  const pathSegments = readPathSegmentsFromPathname(pathname);
  if (pathSegments.length === 0) {
    return RequestPathnameByName.root;
  }

  const routeClassification = classifyMetricsRoutePathname(pathSegments);
  const normalizedSegments = pathSegments.map((pathSegment, pathSegmentIndex) => {
    const classifiedReplacement = readClassifiedPathSegmentReplacement(
      routeClassification,
      pathSegmentIndex,
    );
    if (classifiedReplacement !== null) {
      return classifiedReplacement;
    }
    if (isGenericIdentifierPathSegment(pathSegment)) {
      return METRICS_ROUTE_PLACEHOLDER_BY_NAME.genericIdentifier;
    }
    return pathSegment;
  });

  return `${RequestPathnameByName.root}${normalizedSegments.join(REQUEST_PATH_SEGMENT_SEPARATOR)}`;
}

function classifyMetricsRoutePathname(
  pathSegments: readonly string[],
): MetricsRouteClassification | null {
  for (const metricsRoutePathDefinition of METRICS_ROUTE_PATH_DEFINITIONS) {
    if (isMetricsRoutePathMatch(pathSegments, metricsRoutePathDefinition)) {
      return metricsRoutePathDefinition.classification;
    }
  }
  return null;
}

function isMetricsRoutePathMatch(
  pathSegments: readonly string[],
  metricsRoutePathDefinition: MetricsRoutePathDefinition,
): boolean {
  if (
    metricsRoutePathDefinition.minimumSegmentCount !== null &&
    pathSegments.length < metricsRoutePathDefinition.minimumSegmentCount
  ) {
    return false;
  }

  if (
    metricsRoutePathDefinition.exactSegmentCount !== null &&
    pathSegments.length !== metricsRoutePathDefinition.exactSegmentCount
  ) {
    return false;
  }

  if (!hasLeadingPathSegments(pathSegments, metricsRoutePathDefinition.leadingPathSegments)) {
    return false;
  }

  if (
    !hasMatchingPathSegments(pathSegments, metricsRoutePathDefinition.requiredPathSegmentMatches)
  ) {
    return false;
  }

  if (
    metricsRoutePathDefinition.excludedPathSegmentMatches.length > 0 &&
    hasMatchingPathSegments(pathSegments, metricsRoutePathDefinition.excludedPathSegmentMatches)
  ) {
    return false;
  }

  return true;
}

function hasLeadingPathSegments(
  pathSegments: readonly string[],
  leadingPathSegments: readonly string[],
): boolean {
  if (pathSegments.length < leadingPathSegments.length) {
    return false;
  }

  for (const [pathSegmentIndex, leadingPathSegment] of leadingPathSegments.entries()) {
    if (pathSegments[pathSegmentIndex] !== leadingPathSegment) {
      return false;
    }
  }

  return true;
}

function hasMatchingPathSegments(
  pathSegments: readonly string[],
  pathSegmentMatches: readonly PathSegmentMatchConstraint[],
): boolean {
  for (const pathSegmentMatch of pathSegmentMatches) {
    if (pathSegments[pathSegmentMatch.pathSegmentIndex] !== pathSegmentMatch.expectedPathSegment) {
      return false;
    }
  }

  return true;
}

function readClassifiedPathSegmentReplacement(
  routeClassification: MetricsRouteClassification | null,
  pathSegmentIndex: number,
): string | null {
  if (routeClassification === null) {
    return null;
  }
  return routeClassification.replacementBySegmentIndex[pathSegmentIndex] ?? null;
}

function isGenericIdentifierPathSegment(pathSegment: string): boolean {
  if (HEXADECIMAL_IDENTIFIER_SEGMENT_PATTERN.test(pathSegment)) {
    return true;
  }
  return pathSegment.length >= LONG_IDENTIFIER_SEGMENT_THRESHOLD;
}
