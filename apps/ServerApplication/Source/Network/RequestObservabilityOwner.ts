import { normalizeMetricsRoutePathname } from "./RequestMetricsRouteClassificationContracts.js";
import { normalizePathnameForRequestMetrics } from "./RequestPathContracts.js";
import {
  appendSampleWindowValue,
  readNearestRankPercentile,
  readSampleWindowMaximum,
} from "./RequestTimingSampleWindow.js";
import {
  isStartupActionName,
  readStartupActionDescription,
} from "./StartupRequestActionContracts.js";

const ERROR_STATUS_CODE_MINIMUM = 400;
const ROUTE_KEY_SEPARATOR = " ";

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
    maxRouteTimingEntries = 400,
  ) {
    if (!Number.isInteger(maxSamplesPerRoute) || maxSamplesPerRoute <= 0) {
      throw new Error("RequestObservabilityOwner requires positive integer maxSamplesPerRoute");
    }
    if (!Number.isInteger(maxStartupRequestEntries) || maxStartupRequestEntries <= 0) {
      throw new Error(
        "RequestObservabilityOwner requires positive integer maxStartupRequestEntries",
      );
    }
    if (!Number.isInteger(maxRequestLifecycleEntries) || maxRequestLifecycleEntries <= 0) {
      throw new Error(
        "RequestObservabilityOwner requires positive integer maxRequestLifecycleEntries",
      );
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
      queueDelayMs: observation.queueDelayMs,
    });
  }

  public recordRequestCompleted(observation: RouteTimingObservation): void {
    this.inFlightRequestCount = Math.max(0, this.inFlightRequestCount - 1);

    const normalizedMethod = observation.method.toUpperCase();
    const normalizedPathname = normalizePathnameForRequestMetrics(observation.pathname);
    const normalizedRoute = normalizeMetricsRoutePathname(normalizedPathname);
    const routeKey = `${normalizedMethod}${ROUTE_KEY_SEPARATOR}${normalizedRoute}`;
    const routeAccumulator = this.routeTimingAccumulatorsByKey.get(routeKey) ?? {
      method: normalizedMethod,
      route: normalizedRoute,
      durationSamplesMs: [],
      queueDelaySamplesMs: [],
      requestCount: 0,
      errorCount: 0,
      lastDurationMs: 0,
      lastQueueDelayMs: 0,
    };

    routeAccumulator.requestCount += 1;
    routeAccumulator.lastDurationMs = observation.durationMs;
    routeAccumulator.lastQueueDelayMs = observation.queueDelayMs;
    // Keep rolling windows bounded so percentile work stays proportional to configured sample limits.
    appendSampleWindowValue(
      routeAccumulator.durationSamplesMs,
      observation.durationMs,
      this.maxSamplesPerRoute,
    );
    appendSampleWindowValue(
      routeAccumulator.queueDelaySamplesMs,
      observation.queueDelayMs,
      this.maxSamplesPerRoute,
    );

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
      outcome: observation.statusCode >= ERROR_STATUS_CODE_MINIMUM ? "error" : "success",
    });

    if (!isStartupActionName(observation.actionName)) {
      return;
    }

    const startupRequestObservation: StartupRequestTimingSummary = {
      requestId: observation.requestId,
      actionId: observation.actionId,
      actionName: observation.actionName,
      description: readStartupActionDescription(observation.actionName),
      method: normalizedMethod,
      pathname: normalizedPathname,
      statusCode: observation.statusCode,
      durationMs: observation.durationMs,
      queueDelayMs: observation.queueDelayMs,
      completedAt: observation.completedAt,
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
        p50DurationMs: readNearestRankPercentile({
          values: routeAccumulator.durationSamplesMs,
          percentile: 50,
        }),
        p95DurationMs: readNearestRankPercentile({
          values: routeAccumulator.durationSamplesMs,
          percentile: 95,
        }),
        p99DurationMs: readNearestRankPercentile({
          values: routeAccumulator.durationSamplesMs,
          percentile: 99,
        }),
        lastQueueDelayMs: routeAccumulator.lastQueueDelayMs,
        p95QueueDelayMs: readNearestRankPercentile({
          values: routeAccumulator.queueDelaySamplesMs,
          percentile: 95,
        }),
        // Preserve one worst-case queueing signal alongside percentile smoothing.
        maxQueueDelayMs: readSampleWindowMaximum(routeAccumulator.queueDelaySamplesMs),
      }))
      .sort((left, right) => {
        // Surface slower routes first; request volume breaks p95 ties deterministically.
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
      requestLifecycleEvents: this.requestLifecycleEvents.map((event) => ({
        ...event,
      })),
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
  private writeRouteTimingAccumulator(
    routeKey: string,
    routeAccumulator: RouteTimingAccumulator,
  ): void {
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
}
