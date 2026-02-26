import {
  REQUEST_PATH_SEGMENT_SEPARATOR,
  RequestPathSegmentByName,
  RequestPathnameByName,
  normalizePathnameForRequestMetrics,
  readPathSegmentsFromPathname
} from "./RequestPathContracts.js";

interface PercentileSample {
  values: number[];
  percentile: number;
}

function readPercentile(sample: PercentileSample): number {
  if (sample.values.length === 0) {
    return 0;
  }
  const sortedValues = [...sample.values].sort((left, right) => left - right);
  const percentileIndex = Math.max(
    0,
    Math.min(
      sortedValues.length - 1,
      Math.ceil((sample.percentile / 100) * sortedValues.length) - 1
    )
  );
  return sortedValues[percentileIndex] ?? 0;
}

const STARTUP_ACTION_NAME_PREFIX = "startup-";
const LONG_IDENTIFIER_SEGMENT_THRESHOLD = 28;
const HEXADECIMAL_IDENTIFIER_SEGMENT_PATTERN = /^[0-9a-f]{16,}$/i;
const ERROR_STATUS_CODE_MINIMUM = 400;
const ROUTE_KEY_SEPARATOR = " ";
const PATH_SEGMENT_INDEX_BY_NAME = {
  third: 2,
  fourth: 3,
  fifth: 4
} as const;
const PATH_SEGMENT_COUNT_BY_NAME = {
  threadMemberMinimum: 3,
  debugHistoryEntry: 4,
  debugClientErrorEntry: 4,
  debugTraceDownload: 5
} as const;

const METRICS_ROUTE_PLACEHOLDER_BY_NAME = {
  threadIdentifier: ":threadId",
  historyEntryIdentifier: ":historyEntryId",
  clientErrorIdentifier: ":clientErrorId",
  traceIdentifier: ":traceId",
  genericIdentifier: ":id"
} as const;

const STARTUP_ACTION_DESCRIPTION_BY_NAME: Readonly<Record<string, string>> = {
  "startup-critical.events-session": "Bootstrap API session/auth gate",
  "startup-critical.threads.active": "Load active thread list for sidebar",
  "startup-deferred.health": "Load runtime health snapshot",
  "startup-deferred.agents": "Load available agent descriptors",
  "startup-deferred.trace-status": "Load trace status for debug workspace",
  "startup-deferred.capabilities.modes": "Load collaboration mode options",
  "startup-deferred.capabilities.models": "Load model catalog options",
  "startup-deferred.capabilities.defaults": "Load default model/reasoning values",
  "startup-deferred.debug.history": "Load debug history list",
  "startup-deferred.debug.client-errors": "Load debug client error list",
  "startup-deferred.threads.active.revalidate": "Revalidate active thread list from network"
};

const THREAD_MEMBER_ROUTE_PREFIX_SEGMENTS = [
  RequestPathSegmentByName.api,
  RequestPathSegmentByName.threads
] as const;

const DEBUG_HISTORY_ENTRY_ROUTE_PREFIX_SEGMENTS = [
  RequestPathSegmentByName.api,
  RequestPathSegmentByName.debug,
  RequestPathSegmentByName.history
] as const;

const DEBUG_CLIENT_ERROR_ENTRY_ROUTE_PREFIX_SEGMENTS = [
  RequestPathSegmentByName.api,
  RequestPathSegmentByName.debug,
  RequestPathSegmentByName.clientErrors
] as const;

const DEBUG_TRACE_DOWNLOAD_ROUTE_PREFIX_SEGMENTS = [
  RequestPathSegmentByName.api,
  RequestPathSegmentByName.debug,
  RequestPathSegmentByName.trace
] as const;

/**
 * Route classification mirrors dynamic segments owned by Network route owners so
 * static paths (for example `session-log`) cannot collapse into identifier aggregates.
 */
interface MetricsRouteClassification {
  replacementBySegmentIndex: Readonly<Record<number, string>>;
}

const THREAD_MEMBER_ROUTE_CLASSIFICATION: MetricsRouteClassification = {
  replacementBySegmentIndex: {
    [PATH_SEGMENT_INDEX_BY_NAME.third]: METRICS_ROUTE_PLACEHOLDER_BY_NAME.threadIdentifier
  }
};

const DEBUG_HISTORY_ENTRY_ROUTE_CLASSIFICATION: MetricsRouteClassification = {
  replacementBySegmentIndex: {
    [PATH_SEGMENT_INDEX_BY_NAME.fourth]: METRICS_ROUTE_PLACEHOLDER_BY_NAME.historyEntryIdentifier
  }
};

const DEBUG_CLIENT_ERROR_ENTRY_ROUTE_CLASSIFICATION: MetricsRouteClassification = {
  replacementBySegmentIndex: {
    [PATH_SEGMENT_INDEX_BY_NAME.fourth]: METRICS_ROUTE_PLACEHOLDER_BY_NAME.clientErrorIdentifier
  }
};

const DEBUG_TRACE_DOWNLOAD_ROUTE_CLASSIFICATION: MetricsRouteClassification = {
  replacementBySegmentIndex: {
    [PATH_SEGMENT_INDEX_BY_NAME.fourth]: METRICS_ROUTE_PLACEHOLDER_BY_NAME.traceIdentifier
  }
};

function classifyMetricsRoutePathname(pathSegments: readonly string[]): MetricsRouteClassification | null {
  if (isThreadMemberRoutePath(pathSegments)) {
    return THREAD_MEMBER_ROUTE_CLASSIFICATION;
  }

  if (isDebugHistoryEntryRoutePath(pathSegments)) {
    return DEBUG_HISTORY_ENTRY_ROUTE_CLASSIFICATION;
  }

  if (isDebugClientErrorEntryRoutePath(pathSegments)) {
    return DEBUG_CLIENT_ERROR_ENTRY_ROUTE_CLASSIFICATION;
  }

  if (isDebugTraceDownloadRoutePath(pathSegments)) {
    return DEBUG_TRACE_DOWNLOAD_ROUTE_CLASSIFICATION;
  }

  return null;
}

function isThreadMemberRoutePath(pathSegments: readonly string[]): boolean {
  return (
    pathSegments.length >= PATH_SEGMENT_COUNT_BY_NAME.threadMemberMinimum
    && hasLeadingPathSegments(pathSegments, THREAD_MEMBER_ROUTE_PREFIX_SEGMENTS)
  );
}

function isDebugHistoryEntryRoutePath(pathSegments: readonly string[]): boolean {
  return (
    pathSegments.length === PATH_SEGMENT_COUNT_BY_NAME.debugHistoryEntry
    && hasLeadingPathSegments(pathSegments, DEBUG_HISTORY_ENTRY_ROUTE_PREFIX_SEGMENTS)
  );
}

function isDebugClientErrorEntryRoutePath(pathSegments: readonly string[]): boolean {
  return (
    pathSegments.length === PATH_SEGMENT_COUNT_BY_NAME.debugClientErrorEntry
    && hasLeadingPathSegments(pathSegments, DEBUG_CLIENT_ERROR_ENTRY_ROUTE_PREFIX_SEGMENTS)
    // `session-log` is a static diagnostics endpoint, not a dynamic client-error identifier.
    && pathSegments[PATH_SEGMENT_INDEX_BY_NAME.fourth] !== RequestPathSegmentByName.sessionLog
  );
}

function isDebugTraceDownloadRoutePath(pathSegments: readonly string[]): boolean {
  return (
    pathSegments.length === PATH_SEGMENT_COUNT_BY_NAME.debugTraceDownload
    && hasLeadingPathSegments(pathSegments, DEBUG_TRACE_DOWNLOAD_ROUTE_PREFIX_SEGMENTS)
    && pathSegments[PATH_SEGMENT_INDEX_BY_NAME.fifth] === RequestPathSegmentByName.download
  );
}

function hasLeadingPathSegments(
  pathSegments: readonly string[],
  leadingPathSegments: readonly string[]
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

function readClassifiedPathSegmentReplacement(
  routeClassification: MetricsRouteClassification | null,
  pathSegmentIndex: number
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

export interface RouteTimingObservation {
  requestId: string;
  actionId: string | null;
  actionName: string | null;
  method: string;
  pathname: string;
  startedAt: string;
  statusCode: number;
  durationMs: number;
  queueDelayMs: number;
  completedAt: string;
}

export interface RequestStartedLifecycleObservation {
  requestId: string;
  actionId: string | null;
  actionName: string | null;
  method: string;
  pathname: string;
  startedAt: string;
  queueDelayMs: number;
}

interface RequestLifecycleBaseEvent {
  requestId: string;
  actionId: string | null;
  actionName: string | null;
  method: string;
  pathname: string;
  startedAt: string;
}

export interface RequestStartedLifecycleEvent extends RequestLifecycleBaseEvent {
  phase: "started";
  queueDelayMs: number;
}

export interface RequestCompletedLifecycleEvent extends RequestLifecycleBaseEvent {
  phase: "completed";
  statusCode: number;
  durationMs: number;
  queueDelayMs: number;
  completedAt: string;
  outcome: "success" | "error";
}

export type RequestLifecycleEvent = RequestStartedLifecycleEvent | RequestCompletedLifecycleEvent;

export interface RouteTimingSummary {
  route: string;
  method: string;
  requestCount: number;
  errorCount: number;
  lastDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  lastQueueDelayMs: number;
  p95QueueDelayMs: number;
  maxQueueDelayMs: number;
}

export interface StartupRequestTimingSummary {
  requestId: string;
  actionId: string | null;
  actionName: string;
  description: string;
  method: string;
  pathname: string;
  statusCode: number;
  durationMs: number;
  queueDelayMs: number;
  completedAt: string;
}

export interface RequestObservabilitySnapshot {
  totalRequestCount: number;
  totalErrorCount: number;
  inFlightRequestCount: number;
  routeTimings: RouteTimingSummary[];
  startupRequestTimings: StartupRequestTimingSummary[];
  requestLifecycleEvents: RequestLifecycleEvent[];
}

interface RouteTimingAccumulator {
  method: string;
  route: string;
  durationSamplesMs: number[];
  queueDelaySamplesMs: number[];
  requestCount: number;
  errorCount: number;
  lastDurationMs: number;
  lastQueueDelayMs: number;
}

/**
 * Owns request-level timing telemetry with bounded route aggregates, startup-request readouts,
 * and a bounded lifecycle timeline of request start/completion events for diagnostics.
 */
export class RequestObservabilityOwner {
  private readonly maxSamplesPerRoute: number;
  private readonly maxStartupRequestEntries: number;
  private readonly maxRequestLifecycleEntries: number;
  private readonly maxRouteTimingEntries: number;
  private readonly routeTimingAccumulatorsByKey: Map<string, RouteTimingAccumulator>;
  private readonly startupRequestObservations: StartupRequestTimingSummary[];
  private readonly requestLifecycleEvents: RequestLifecycleEvent[];
  private totalRequestCount: number;
  private totalErrorCount: number;
  private inFlightRequestCount: number;

  public constructor(
    maxSamplesPerRoute = 240,
    maxStartupRequestEntries = 200,
    maxRequestLifecycleEntries = 2_000,
    maxRouteTimingEntries = 400
  ) {
    if (!Number.isInteger(maxSamplesPerRoute) || maxSamplesPerRoute <= 0) {
      throw new Error("RequestObservabilityOwner requires positive integer maxSamplesPerRoute");
    }
    if (!Number.isInteger(maxStartupRequestEntries) || maxStartupRequestEntries <= 0) {
      throw new Error("RequestObservabilityOwner requires positive integer maxStartupRequestEntries");
    }
    if (!Number.isInteger(maxRequestLifecycleEntries) || maxRequestLifecycleEntries <= 0) {
      throw new Error("RequestObservabilityOwner requires positive integer maxRequestLifecycleEntries");
    }
    if (!Number.isInteger(maxRouteTimingEntries) || maxRouteTimingEntries <= 0) {
      throw new Error("RequestObservabilityOwner requires positive integer maxRouteTimingEntries");
    }

    this.maxSamplesPerRoute = maxSamplesPerRoute;
    this.maxStartupRequestEntries = maxStartupRequestEntries;
    this.maxRequestLifecycleEntries = maxRequestLifecycleEntries;
    this.maxRouteTimingEntries = maxRouteTimingEntries;
    this.routeTimingAccumulatorsByKey = new Map<string, RouteTimingAccumulator>();
    this.startupRequestObservations = [];
    this.requestLifecycleEvents = [];
    this.totalRequestCount = 0;
    this.totalErrorCount = 0;
    this.inFlightRequestCount = 0;
  }

  public recordRequestStarted(observation: RequestStartedLifecycleObservation): void {
    this.totalRequestCount += 1;
    this.inFlightRequestCount += 1;
    const normalizedMethod = observation.method.toUpperCase();
    const normalizedPathname = normalizePathnameForRequestMetrics(observation.pathname);
    this.pushRequestLifecycleEvent({
      phase: "started",
      requestId: observation.requestId,
      actionId: observation.actionId,
      actionName: observation.actionName,
      method: normalizedMethod,
      pathname: normalizedPathname,
      startedAt: observation.startedAt,
      queueDelayMs: observation.queueDelayMs
    });
  }

  public recordRequestCompleted(observation: RouteTimingObservation): void {
    this.inFlightRequestCount = Math.max(0, this.inFlightRequestCount - 1);

    const normalizedMethod = observation.method.toUpperCase();
    const normalizedPathname = normalizePathnameForRequestMetrics(observation.pathname);
    const normalizedRoute = this.normalizeRoutePathname(normalizedPathname);
    const routeKey = `${normalizedMethod}${ROUTE_KEY_SEPARATOR}${normalizedRoute}`;
    const routeAccumulator = this.routeTimingAccumulatorsByKey.get(routeKey) ?? {
      method: normalizedMethod,
      route: normalizedRoute,
      durationSamplesMs: [],
      queueDelaySamplesMs: [],
      requestCount: 0,
      errorCount: 0,
      lastDurationMs: 0,
      lastQueueDelayMs: 0
    };

    routeAccumulator.requestCount += 1;
    routeAccumulator.lastDurationMs = observation.durationMs;
    routeAccumulator.lastQueueDelayMs = observation.queueDelayMs;
    routeAccumulator.durationSamplesMs.push(observation.durationMs);
    routeAccumulator.queueDelaySamplesMs.push(observation.queueDelayMs);
    if (routeAccumulator.durationSamplesMs.length > this.maxSamplesPerRoute) {
      routeAccumulator.durationSamplesMs.shift();
    }
    if (routeAccumulator.queueDelaySamplesMs.length > this.maxSamplesPerRoute) {
      routeAccumulator.queueDelaySamplesMs.shift();
    }

    if (observation.statusCode >= ERROR_STATUS_CODE_MINIMUM) {
      routeAccumulator.errorCount += 1;
      this.totalErrorCount += 1;
    }

    this.writeRouteTimingAccumulator(routeKey, routeAccumulator);
    this.pushRequestLifecycleEvent({
      phase: "completed",
      requestId: observation.requestId,
      actionId: observation.actionId,
      actionName: observation.actionName,
      method: normalizedMethod,
      pathname: normalizedPathname,
      startedAt: observation.startedAt,
      statusCode: observation.statusCode,
      durationMs: observation.durationMs,
      queueDelayMs: observation.queueDelayMs,
      completedAt: observation.completedAt,
      outcome: observation.statusCode >= ERROR_STATUS_CODE_MINIMUM ? "error" : "success"
    });

    if (!observation.actionName || !observation.actionName.startsWith(STARTUP_ACTION_NAME_PREFIX)) {
      return;
    }

    const startupRequestObservation: StartupRequestTimingSummary = {
      requestId: observation.requestId,
      actionId: observation.actionId,
      actionName: observation.actionName,
      description: STARTUP_ACTION_DESCRIPTION_BY_NAME[observation.actionName]
        ?? observation.actionName,
      method: normalizedMethod,
      pathname: normalizedPathname,
      statusCode: observation.statusCode,
      durationMs: observation.durationMs,
      queueDelayMs: observation.queueDelayMs,
      completedAt: observation.completedAt
    };

    this.startupRequestObservations.push(startupRequestObservation);
    if (this.startupRequestObservations.length > this.maxStartupRequestEntries) {
      this.startupRequestObservations.shift();
    }
  }

  public readSnapshot(): RequestObservabilitySnapshot {
    const routeTimings = Array.from(this.routeTimingAccumulatorsByKey.values())
      .map<RouteTimingSummary>((routeAccumulator) => ({
        route: routeAccumulator.route,
        method: routeAccumulator.method,
        requestCount: routeAccumulator.requestCount,
        errorCount: routeAccumulator.errorCount,
        lastDurationMs: routeAccumulator.lastDurationMs,
        p50DurationMs: readPercentile({ values: routeAccumulator.durationSamplesMs, percentile: 50 }),
        p95DurationMs: readPercentile({ values: routeAccumulator.durationSamplesMs, percentile: 95 }),
        p99DurationMs: readPercentile({ values: routeAccumulator.durationSamplesMs, percentile: 99 }),
        lastQueueDelayMs: routeAccumulator.lastQueueDelayMs,
        p95QueueDelayMs: readPercentile({ values: routeAccumulator.queueDelaySamplesMs, percentile: 95 }),
        maxQueueDelayMs: routeAccumulator.queueDelaySamplesMs.length > 0
          ? Math.max(...routeAccumulator.queueDelaySamplesMs)
          : 0
      }))
      .sort((left, right) => {
        if (left.p95DurationMs !== right.p95DurationMs) {
          return right.p95DurationMs - left.p95DurationMs;
        }
        return right.requestCount - left.requestCount;
      });

    return {
      totalRequestCount: this.totalRequestCount,
      totalErrorCount: this.totalErrorCount,
      inFlightRequestCount: this.inFlightRequestCount,
      routeTimings,
      startupRequestTimings: [...this.startupRequestObservations],
      requestLifecycleEvents: this.requestLifecycleEvents.map((event) => ({ ...event }))
    };
  }

  private pushRequestLifecycleEvent(event: RequestLifecycleEvent): void {
    this.requestLifecycleEvents.push(event);
    if (this.requestLifecycleEvents.length > this.maxRequestLifecycleEntries) {
      this.requestLifecycleEvents.shift();
    }
  }

  /**
   * Treats the map as an insertion-ordered least-recently-used queue so route aggregates stay bounded
   * even under high-cardinality traffic. Existing keys are refreshed to the end on every write.
   */
  private writeRouteTimingAccumulator(routeKey: string, routeAccumulator: RouteTimingAccumulator): void {
    if (this.routeTimingAccumulatorsByKey.has(routeKey)) {
      this.routeTimingAccumulatorsByKey.delete(routeKey);
    }
    this.routeTimingAccumulatorsByKey.set(routeKey, routeAccumulator);

    while (this.routeTimingAccumulatorsByKey.size > this.maxRouteTimingEntries) {
      const oldestRouteKey = this.routeTimingAccumulatorsByKey.keys().next().value;
      if (oldestRouteKey === undefined) {
        return;
      }
      this.routeTimingAccumulatorsByKey.delete(oldestRouteKey);
    }
  }

  private normalizeRoutePathname(pathname: string): string {
    const pathSegments = readPathSegmentsFromPathname(pathname);
    if (pathSegments.length === 0) {
      return RequestPathnameByName.root;
    }

    const routeClassification = classifyMetricsRoutePathname(pathSegments);
    const normalizedSegments = pathSegments.map((pathSegment, pathSegmentIndex) => {
      const classifiedReplacement = readClassifiedPathSegmentReplacement(
        routeClassification,
        pathSegmentIndex
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
}
