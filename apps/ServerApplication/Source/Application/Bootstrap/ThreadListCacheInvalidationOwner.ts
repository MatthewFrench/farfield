import type { JsonValue } from "@farfield/protocol";
import { logger } from "../../Shared/Logging/Logger.js";
import type {
  ThreadListAggregationCache,
  ThreadListAggregationQuery
} from "../../Network/ThreadListAggregationCache.js";

type ThreadListInvalidationScope = "all" | "active" | "archived";

const ThreadStreamCacheInvalidationMinimumIntervalMilliseconds = 2_000;

/**
 * Owns thread-list cache invalidation policy, including mutation-scope filtering
 * and stream-event debounce behavior for high-frequency updates.
 */
export class ThreadListCacheInvalidationOwner {
  private readonly threadListAggregationCache: ThreadListAggregationCache;
  private readonly lastThreadStreamCacheInvalidationByThreadId = new Map<string, number>();

  public constructor(threadListAggregationCache: ThreadListAggregationCache) {
    this.threadListAggregationCache = threadListAggregationCache;
  }

  public invalidate(reason: string, details: Record<string, JsonValue> = {}): void {
    if (
      reason === "thread-stream-state-changed"
      && !this.shouldInvalidateForThreadStreamStateChange(details)
    ) {
      logger.debug(
        {
          reason,
          ...details
        },
        "thread-list-aggregation-cache-invalidation-skipped"
      );
      return;
    }

    const invalidationScope = this.readThreadListInvalidationScope(reason);
    this.threadListAggregationCache.invalidateWhere(this.buildThreadListInvalidationPredicate(invalidationScope));
    const statistics = this.threadListAggregationCache.readStatistics();
    logger.debug(
      {
        reason,
        invalidationScope,
        ...details,
        statistics
      },
      "thread-list-aggregation-cache-invalidated"
    );
  }

  private readThreadListInvalidationScope(reason: string): ThreadListInvalidationScope {
    if (reason === "thread-archived" || reason === "thread-unarchived") {
      return "all";
    }
    return "active";
  }

  private shouldInvalidateForThreadStreamStateChange(details: Record<string, JsonValue>): boolean {
    const threadIdValue = details["threadId"];
    if (typeof threadIdValue !== "string") {
      return true;
    }

    const threadId = threadIdValue.trim();
    if (threadId.length === 0) {
      return true;
    }

    const now = Date.now();
    const lastInvalidationAt = this.lastThreadStreamCacheInvalidationByThreadId.get(threadId);
    // Stream state events can arrive in tight bursts; debounce invalidation per
    // thread to avoid repeatedly blowing hot cache entries during active generation.
    if (
      typeof lastInvalidationAt === "number"
      && now - lastInvalidationAt < ThreadStreamCacheInvalidationMinimumIntervalMilliseconds
    ) {
      return false;
    }

    this.lastThreadStreamCacheInvalidationByThreadId.set(threadId, now);
    return true;
  }

  private buildThreadListInvalidationPredicate(
    scope: ThreadListInvalidationScope
  ): (query: ThreadListAggregationQuery) => boolean {
    if (scope === "all") {
      return () => true;
    }
    if (scope === "archived") {
      return (query) => query.archived;
    }
    return (query) => !query.archived;
  }
}
