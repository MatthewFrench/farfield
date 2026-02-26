import { logger } from "../Shared/Logging/Logger.js";
import { AppServerRpcError } from "@farfield/api";
import type { AgentRegistry } from "./Registry.js";
import type { ThreadIndex } from "./ThreadIndex.js";
import type { AgentAdapter, AgentId } from "./Types.js";

export type ResolvedThreadAdapterResult =
  | { ok: true; adapter: AgentAdapter; agentId: AgentId }
  | { ok: false; status: number; error: string };

export interface ThreadAdapterResolverStatistics {
  registeredLookupCount: number;
  unregisteredDiscoveryAttemptCount: number;
  unregisteredDiscoverySuccessCount: number;
  unregisteredDiscoveryMissCount: number;
  unregisteredDiscoveryMissCacheHitCount: number;
  unregisteredDiscoveryProbeFailureCount: number;
  unregisteredDiscoveryAmbiguousCount: number;
  unregisteredDiscoveryAlertCount: number;
}

const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;
const HTTP_STATUS_CONFLICT = 409;
// Alert every third consecutive miss so operators get periodic signal without per-request noise.
const UNREGISTERED_DISCOVERY_MISS_ALERT_THRESHOLD = 3;
// Keep this short to avoid redundant probes during quick repeated retries.
const DEFAULT_UNREGISTERED_THREAD_MISS_TIME_TO_LIVE_MILLISECONDS = 2_000;
const THREAD_MISSING_MESSAGE_PATTERN = /\b(conversation|thread)\s+not\s+found\b/i;

type UnregisteredDiscoveryMissReason = "no-connected-adapters" | "no-match";

export interface ThreadAdapterResolverOptions {
  unregisteredThreadMissTimeToLiveMs?: number;
  now?: () => number;
}

/**
 * Owns thread-to-adapter resolution. When ownership is missing, it performs a
 * deterministic read probe across connected enabled adapters and persists the discovered owner.
 */
export class ThreadAdapterResolver {
  private readonly registry: AgentRegistry;
  private readonly threadIndex: ThreadIndex;
  private readonly unregisteredThreadMissTimeToLiveMs: number;
  private readonly now: () => number;
  private registeredLookupCount: number;
  private unregisteredDiscoveryAttemptCount: number;
  private unregisteredDiscoverySuccessCount: number;
  private unregisteredDiscoveryMissCount: number;
  private unregisteredDiscoveryMissCacheHitCount: number;
  private unregisteredDiscoveryProbeFailureCount: number;
  private unregisteredDiscoveryAmbiguousCount: number;
  private unregisteredDiscoveryAlertCount: number;
  private readonly consecutiveUnregisteredDiscoveryMissCountByThreadId: Map<string, number>;
  private readonly unregisteredDiscoveryMissExpiresAtEpochMsByThreadId: Map<string, number>;

  public constructor(registry: AgentRegistry, threadIndex: ThreadIndex, options: ThreadAdapterResolverOptions = {}) {
    this.registry = registry;
    this.threadIndex = threadIndex;
    this.unregisteredThreadMissTimeToLiveMs = resolveUnregisteredThreadMissTimeToLiveMilliseconds(
      options.unregisteredThreadMissTimeToLiveMs
    );
    this.now = options.now ?? (() => Date.now());
    this.registeredLookupCount = 0;
    this.unregisteredDiscoveryAttemptCount = 0;
    this.unregisteredDiscoverySuccessCount = 0;
    this.unregisteredDiscoveryMissCount = 0;
    this.unregisteredDiscoveryMissCacheHitCount = 0;
    this.unregisteredDiscoveryProbeFailureCount = 0;
    this.unregisteredDiscoveryAmbiguousCount = 0;
    this.unregisteredDiscoveryAlertCount = 0;
    this.consecutiveUnregisteredDiscoveryMissCountByThreadId = new Map<string, number>();
    this.unregisteredDiscoveryMissExpiresAtEpochMsByThreadId = new Map<string, number>();
  }

  public registerThreadOwner(threadId: string, agentId: AgentId): void {
    this.threadIndex.register(threadId, agentId);
    this.consecutiveUnregisteredDiscoveryMissCountByThreadId.delete(threadId);
    this.unregisteredDiscoveryMissExpiresAtEpochMsByThreadId.delete(threadId);
  }

  public resolveCreateThreadAdapter(requestedAgentId: AgentId | undefined): AgentAdapter | null {
    if (requestedAgentId) {
      const requestedAdapter = this.registry.getAdapter(requestedAgentId);
      if (!requestedAdapter || !requestedAdapter.isEnabled() || !requestedAdapter.isConnected()) {
        return null;
      }

      return requestedAdapter;
    }

    const defaultAgentId = this.registry.resolveDefaultAgentId();
    if (defaultAgentId) {
      const defaultAdapter = this.registry.getAdapter(defaultAgentId);
      if (defaultAdapter && defaultAdapter.isEnabled() && defaultAdapter.isConnected()) {
        return defaultAdapter;
      }
    }

    for (const enabledAdapter of this.registry.listEnabled()) {
      if (enabledAdapter.isConnected()) {
        return enabledAdapter;
      }
    }

    return null;
  }

  public async resolveAdapterForThread(threadId: string): Promise<ResolvedThreadAdapterResult> {
    const registeredAgentId = this.threadIndex.resolve(threadId);
    if (registeredAgentId) {
      this.registeredLookupCount += 1;
      return this.resolveRegisteredAdapter(threadId, registeredAgentId);
    }

    if (this.hasFreshUnregisteredDiscoveryMiss(threadId)) {
      this.unregisteredDiscoveryMissCacheHitCount += 1;
      return {
        ok: false,
        status: HTTP_STATUS_NOT_FOUND,
        error: buildUnregisteredThreadMissingError(threadId)
      };
    }

    this.unregisteredDiscoveryAttemptCount += 1;
    const discoveredAdapter = await this.discoverAdapterForUnregisteredThread(threadId);
    if (discoveredAdapter) {
      return discoveredAdapter;
    }

    this.recordUnregisteredDiscoveryMiss(threadId, "no-match");
    return {
      ok: false,
      status: HTTP_STATUS_NOT_FOUND,
      error: buildUnregisteredThreadMissingError(threadId)
    };
  }

  public readStatistics(): ThreadAdapterResolverStatistics {
    return {
      registeredLookupCount: this.registeredLookupCount,
      unregisteredDiscoveryAttemptCount: this.unregisteredDiscoveryAttemptCount,
      unregisteredDiscoverySuccessCount: this.unregisteredDiscoverySuccessCount,
      unregisteredDiscoveryMissCount: this.unregisteredDiscoveryMissCount,
      unregisteredDiscoveryMissCacheHitCount: this.unregisteredDiscoveryMissCacheHitCount,
      unregisteredDiscoveryProbeFailureCount: this.unregisteredDiscoveryProbeFailureCount,
      unregisteredDiscoveryAmbiguousCount: this.unregisteredDiscoveryAmbiguousCount,
      unregisteredDiscoveryAlertCount: this.unregisteredDiscoveryAlertCount
    };
  }

  private resolveRegisteredAdapter(
    threadId: string,
    registeredAgentId: AgentId
  ): ResolvedThreadAdapterResult {
    const adapter = this.registry.getAdapter(registeredAgentId);
    if (!adapter || !adapter.isEnabled()) {
      return {
        ok: false,
        status: HTTP_STATUS_SERVICE_UNAVAILABLE,
        error: `Agent ${registeredAgentId} is not enabled for thread ${threadId}.`
      };
    }

    if (!adapter.isConnected()) {
      return {
        ok: false,
        status: HTTP_STATUS_SERVICE_UNAVAILABLE,
        error: `Agent ${registeredAgentId} is not connected for thread ${threadId}.`
      };
    }

    return {
      ok: true,
      adapter,
      agentId: registeredAgentId
    };
  }

  private async discoverAdapterForUnregisteredThread(
    threadId: string
  ): Promise<ResolvedThreadAdapterResult | null> {
    const connectedEnabledAdapters = this.registry
      .listEnabled()
      .filter((adapter) => adapter.isConnected());

    if (connectedEnabledAdapters.length === 0) {
      this.recordUnregisteredDiscoveryMiss(threadId, "no-connected-adapters");
      return {
        ok: false,
        status: HTTP_STATUS_SERVICE_UNAVAILABLE,
        error: `No connected enabled agents are available to resolve thread ${threadId}.`
      };
    }

    let discoveredAdapter: AgentAdapter | null = null;
    let hasProbeFailures = false;
    for (const adapter of connectedEnabledAdapters) {
      const probeOutcome = await this.probeAdapterThreadOwnership(adapter, threadId);
      if (probeOutcome === "thread-missing") {
        continue;
      }
      if (probeOutcome === "probe-failed") {
        hasProbeFailures = true;
        continue;
      }

      if (discoveredAdapter) {
        this.unregisteredDiscoveryAmbiguousCount += 1;
        logger.warn(
          {
            threadId,
            firstAgentId: discoveredAdapter.id,
            secondAgentId: adapter.id
          },
          "thread-adapter-resolution-ambiguous-discovery"
        );
        return {
          ok: false,
          status: HTTP_STATUS_CONFLICT,
          error: (
            `Thread ${threadId} matched multiple connected enabled agents `
            + `(${discoveredAdapter.id}, ${adapter.id}). Refresh thread list and retry.`
          )
        };
      }

      discoveredAdapter = adapter;
    }

    if (!discoveredAdapter) {
      if (hasProbeFailures) {
        return {
          ok: false,
          status: HTTP_STATUS_SERVICE_UNAVAILABLE,
          error: `Thread ${threadId} ownership probe failed for one or more agents. Retry the request.`
        };
      }
      return null;
    }

    this.unregisteredDiscoverySuccessCount += 1;
    this.consecutiveUnregisteredDiscoveryMissCountByThreadId.delete(threadId);
    this.unregisteredDiscoveryMissExpiresAtEpochMsByThreadId.delete(threadId);
    this.threadIndex.register(threadId, discoveredAdapter.id);
    return {
      ok: true,
      adapter: discoveredAdapter,
      agentId: discoveredAdapter.id
    };
  }

  private async probeAdapterThreadOwnership(
    adapter: AgentAdapter,
    threadId: string
  ): Promise<"thread-owned" | "thread-missing" | "probe-failed"> {
    return adapter.readThread({
      threadId,
      includeTurns: false
    }).then(
      () => "thread-owned",
      (error: Error) => {
        if (this.isExplicitThreadMissingError(error)) {
          return "thread-missing";
        }

        this.unregisteredDiscoveryProbeFailureCount += 1;
        logger.warn(
          {
            threadId,
            agentId: adapter.id,
            error: error.message
          },
          "thread-adapter-resolution-probe-failed"
        );
        return "probe-failed";
      }
    );
  }

  private isExplicitThreadMissingError(error: Error): boolean {
    if (error instanceof AppServerRpcError) {
      return error.code === -32600 && THREAD_MISSING_MESSAGE_PATTERN.test(error.message);
    }

    return THREAD_MISSING_MESSAGE_PATTERN.test(error.message);
  }

  private recordUnregisteredDiscoveryMiss(
    threadId: string,
    reason: UnregisteredDiscoveryMissReason
  ): void {
    this.unregisteredDiscoveryMissCount += 1;
    if (reason === "no-connected-adapters") {
      return;
    }

    const nextMissCount = (this.consecutiveUnregisteredDiscoveryMissCountByThreadId.get(threadId) ?? 0) + 1;
    this.consecutiveUnregisteredDiscoveryMissCountByThreadId.set(threadId, nextMissCount);
    this.unregisteredDiscoveryMissExpiresAtEpochMsByThreadId.set(
      threadId,
      this.now() + this.unregisteredThreadMissTimeToLiveMs
    );

    if (nextMissCount % UNREGISTERED_DISCOVERY_MISS_ALERT_THRESHOLD !== 0) {
      return;
    }

    this.unregisteredDiscoveryAlertCount += 1;
    logger.warn(
      {
        threadId,
        reason,
        consecutiveMissCount: nextMissCount
      },
      "thread-adapter-resolution-discovery-miss-threshold-reached"
    );
  }

  private hasFreshUnregisteredDiscoveryMiss(threadId: string): boolean {
    const expiresAtEpochMs = this.unregisteredDiscoveryMissExpiresAtEpochMsByThreadId.get(threadId);
    if (expiresAtEpochMs === undefined) {
      return false;
    }
    if (this.now() >= expiresAtEpochMs) {
      this.unregisteredDiscoveryMissExpiresAtEpochMsByThreadId.delete(threadId);
      return false;
    }
    return true;
  }
}

function resolveUnregisteredThreadMissTimeToLiveMilliseconds(
  configuredUnregisteredThreadMissTimeToLiveMs: number | undefined
): number {
  const unregisteredThreadMissTimeToLiveMilliseconds = (
    configuredUnregisteredThreadMissTimeToLiveMs
    ?? DEFAULT_UNREGISTERED_THREAD_MISS_TIME_TO_LIVE_MILLISECONDS
  );
  if (
    !Number.isInteger(unregisteredThreadMissTimeToLiveMilliseconds)
    || unregisteredThreadMissTimeToLiveMilliseconds <= 0
  ) {
    throw new Error("ThreadAdapterResolver requires positive integer unregisteredThreadMissTimeToLiveMs");
  }
  return unregisteredThreadMissTimeToLiveMilliseconds;
}

function buildUnregisteredThreadMissingError(threadId: string): string {
  return `Thread ${threadId} is not registered and could not be discovered. Refresh thread list and try again.`;
}
