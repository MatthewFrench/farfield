import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { HistoryEntry } from "./DebugContracts.js";
import type { RequestObservabilityOwner } from "./RequestObservabilityOwner.js";
import { normalizeRequestMethodForRequestMetrics } from "./RequestPathContracts.js";
import type { ServerRequestErrorContext } from "./ServerRequestErrorResponder.js";

const REQUEST_IDENTIFIER_PREFIX = "request_";

export interface RequestLifecycleContext {
  requestStartedAtHighResolutionMilliseconds: number;
  requestStartedAt: string;
  requestQueueDelayMilliseconds: number;
  requestMethod: string;
  requestId: string;
  requestActionId: string | null;
  requestActionName: string | null;
}

export interface ServerRequestLifecycleOwnerDependencies {
  clientRequestIdHeaderName: string;
  clientRequestIdResponseHeader: string;
  clientActionIdHeaderName: string;
  clientActionIdResponseHeader: string;
  clientActionNameHeaderName: string;
  clientActionNameResponseHeader: string;
  normalizeOptionalString: (value: string | null) => string | null;
  requestObservabilityOwner: RequestObservabilityOwner;
  readCurrentEventLoopLagMs: () => number;
}

/**
 * Owns request-lifecycle metadata and observability pairing for inbound HTTP requests.
 * This owner guarantees one started/completed telemetry pair per request and stable context propagation.
 */
export class ServerRequestLifecycleOwner {
  private readonly deps: ServerRequestLifecycleOwnerDependencies;

  public constructor(dependencies: ServerRequestLifecycleOwnerDependencies) {
    this.deps = dependencies;
  }

  public createRequestLifecycleContext(req: IncomingMessage): RequestLifecycleContext {
    const requestStartedAtHighResolutionMilliseconds = performance.now();
    const requestStartedAt = new Date().toISOString();
    // Record queue delay exactly once so started/completed telemetry stays directly comparable.
    const requestQueueDelayMilliseconds = this.deps.readCurrentEventLoopLagMs();
    const requestMethod = normalizeRequestMethodForRequestMetrics(req.method);
    const requestId = this.deps.normalizeOptionalString(
      this.readHeader(req, this.deps.clientRequestIdHeaderName)
    ) ?? `${REQUEST_IDENTIFIER_PREFIX}${randomUUID()}`;
    const requestActionId = this.deps.normalizeOptionalString(
      this.readHeader(req, this.deps.clientActionIdHeaderName)
    );
    const requestActionName = this.deps.normalizeOptionalString(
      this.readHeader(req, this.deps.clientActionNameHeaderName)
    );

    return {
      requestStartedAtHighResolutionMilliseconds,
      requestStartedAt,
      requestQueueDelayMilliseconds,
      requestMethod,
      requestId,
      requestActionId,
      requestActionName
    };
  }

  public writeRequestContextResponseHeaders(
    res: ServerResponse,
    requestLifecycleContext: RequestLifecycleContext
  ): void {
    res.setHeader(this.deps.clientRequestIdResponseHeader, requestLifecycleContext.requestId);
    if (requestLifecycleContext.requestActionId !== null) {
      res.setHeader(
        this.deps.clientActionIdResponseHeader,
        requestLifecycleContext.requestActionId
      );
    }
    if (requestLifecycleContext.requestActionName !== null) {
      res.setHeader(
        this.deps.clientActionNameResponseHeader,
        requestLifecycleContext.requestActionName
      );
    }
  }

  public createRequestErrorContext(
    requestLifecycleContext: RequestLifecycleContext
  ): ServerRequestErrorContext {
    return {
      requestId: requestLifecycleContext.requestId,
      actionId: requestLifecycleContext.requestActionId,
      actionName: requestLifecycleContext.requestActionName
    };
  }

  public createRequestContextDetails(
    requestLifecycleContext: RequestLifecycleContext
  ): HistoryEntry["meta"] {
    return {
      requestId: requestLifecycleContext.requestId,
      ...(requestLifecycleContext.requestActionId !== null
        ? { actionId: requestLifecycleContext.requestActionId }
        : {}),
      ...(requestLifecycleContext.requestActionName !== null
        ? { actionName: requestLifecycleContext.requestActionName }
        : {})
    };
  }

  public recordRequestStartedForObservability(
    requestLifecycleContext: RequestLifecycleContext,
    pathnameForMetrics: string
  ): void {
    this.deps.requestObservabilityOwner.recordRequestStarted({
      requestId: requestLifecycleContext.requestId,
      actionId: requestLifecycleContext.requestActionId,
      actionName: requestLifecycleContext.requestActionName,
      method: requestLifecycleContext.requestMethod,
      pathname: pathnameForMetrics,
      startedAt: requestLifecycleContext.requestStartedAt,
      queueDelayMs: requestLifecycleContext.requestQueueDelayMilliseconds
    });
  }

  public recordRequestCompletedForObservability(input: {
    requestLifecycleContext: RequestLifecycleContext;
    pathnameForMetrics: string;
    statusCode: number;
  }): void {
    const durationMilliseconds = Math.max(
      0,
      performance.now() - input.requestLifecycleContext.requestStartedAtHighResolutionMilliseconds
    );
    // Keep identity and timing fields aligned with `recordRequestStarted` for deterministic pairing.
    this.deps.requestObservabilityOwner.recordRequestCompleted({
      requestId: input.requestLifecycleContext.requestId,
      actionId: input.requestLifecycleContext.requestActionId,
      actionName: input.requestLifecycleContext.requestActionName,
      method: input.requestLifecycleContext.requestMethod,
      pathname: input.pathnameForMetrics,
      startedAt: input.requestLifecycleContext.requestStartedAt,
      statusCode: input.statusCode,
      durationMs: durationMilliseconds,
      queueDelayMs: input.requestLifecycleContext.requestQueueDelayMilliseconds,
      completedAt: new Date().toISOString()
    });
  }

  public readHeader(req: IncomingMessage, name: string): string | null {
    // Node request-header maps are normalized to lowercase keys at ingress.
    const normalizedHeaderName = name.toLowerCase();
    const raw = req.headers[normalizedHeaderName];
    if (typeof raw === "string") {
      return raw;
    }
    if (Array.isArray(raw)) {
      const value = raw[0];
      return typeof value === "string" ? value : null;
    }
    return null;
  }
}
