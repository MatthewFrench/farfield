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

const STARTUP_ACTION_DESCRIPTION_BY_NAME: Record<string, string> = {
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
  private readonly routeTimingAccumulatorsByKey: Map<string, RouteTimingAccumulator>;
  private readonly startupRequestObservations: StartupRequestTimingSummary[];
  private readonly requestLifecycleEvents: RequestLifecycleEvent[];
  private totalRequestCount: number;
  private totalErrorCount: number;
  private inFlightRequestCount: number;

  public constructor(
    maxSamplesPerRoute = 240,
    maxStartupRequestEntries = 200,
    maxRequestLifecycleEntries = 2_000
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

    this.maxSamplesPerRoute = maxSamplesPerRoute;
    this.maxStartupRequestEntries = maxStartupRequestEntries;
    this.maxRequestLifecycleEntries = maxRequestLifecycleEntries;
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
    this.pushRequestLifecycleEvent({
      phase: "started",
      requestId: observation.requestId,
      actionId: observation.actionId,
      actionName: observation.actionName,
      method: observation.method.toUpperCase(),
      pathname: observation.pathname,
      startedAt: observation.startedAt,
      queueDelayMs: observation.queueDelayMs
    });
  }

  public recordRequestCompleted(observation: RouteTimingObservation): void {
    this.inFlightRequestCount = Math.max(0, this.inFlightRequestCount - 1);

    const normalizedRoute = this.normalizeRoutePathname(observation.pathname);
    const routeKey = `${observation.method.toUpperCase()} ${normalizedRoute}`;
    const routeAccumulator = this.routeTimingAccumulatorsByKey.get(routeKey) ?? {
      method: observation.method.toUpperCase(),
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

    if (observation.statusCode >= 400) {
      routeAccumulator.errorCount += 1;
      this.totalErrorCount += 1;
    }

    this.routeTimingAccumulatorsByKey.set(routeKey, routeAccumulator);
    this.pushRequestLifecycleEvent({
      phase: "completed",
      requestId: observation.requestId,
      actionId: observation.actionId,
      actionName: observation.actionName,
      method: observation.method.toUpperCase(),
      pathname: observation.pathname,
      startedAt: observation.startedAt,
      statusCode: observation.statusCode,
      durationMs: observation.durationMs,
      queueDelayMs: observation.queueDelayMs,
      completedAt: observation.completedAt,
      outcome: observation.statusCode >= 400 ? "error" : "success"
    });

    if (!observation.actionName || !observation.actionName.startsWith("startup-")) {
      return;
    }

    const startupRequestObservation: StartupRequestTimingSummary = {
      requestId: observation.requestId,
      actionId: observation.actionId,
      actionName: observation.actionName,
      description: STARTUP_ACTION_DESCRIPTION_BY_NAME[observation.actionName]
        ?? observation.actionName,
      method: observation.method.toUpperCase(),
      pathname: observation.pathname,
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

  private normalizeRoutePathname(pathname: string): string {
    const trimmed = pathname.trim();
    if (trimmed.length === 0 || trimmed === "/") {
      return "/";
    }

    const segments = trimmed.split("/").filter((segment) => segment.length > 0);
    const normalizedSegments = segments.map((segment, index) => {
      const previousSegment = segments[index - 1] ?? "";
      if (previousSegment === "threads") {
        return ":threadId";
      }
      if (previousSegment === "history") {
        return ":historyEntryId";
      }
      if (previousSegment === "client-errors") {
        return ":clientErrorId";
      }
      if (/^[0-9a-f]{16,}$/i.test(segment)) {
        return ":id";
      }
      if (segment.length >= 28) {
        return ":id";
      }
      return segment;
    });

    return `/${normalizedSegments.join("/")}`;
  }
}
