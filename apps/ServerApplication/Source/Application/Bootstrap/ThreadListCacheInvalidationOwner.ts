import { JsonValueSchema, type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import { logger } from "../../Shared/Logging/Logger.js";
import type {
  ThreadListAggregationCache,
  ThreadListAggregationQuery
} from "../../Network/ThreadListAggregationCache.js";
import { THREAD_STREAM_STATE_CHANGED_METHOD } from "../ThreadStreamStateChangedHistoryBatchOwner.js";

type ThreadListInvalidationScope = "all" | "active";

const ThreadListInvalidationReasonValues = [
  THREAD_STREAM_STATE_CHANGED_METHOD,
  "thread-created",
  "thread-message-sent",
  "thread-user-input-submitted",
  "thread-interrupted",
  "thread-archived",
  "thread-unarchived"
] as const;
const ThreadListInvalidationReasonSchema = z.enum(ThreadListInvalidationReasonValues);
type ThreadListInvalidationReason = z.infer<typeof ThreadListInvalidationReasonSchema>;
const ThreadListInvalidationDetailsSchema = z.record(JsonValueSchema);
const ThreadStreamStateChangeThreadIdentifierSchema = z.string().trim().min(1).optional();

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
    const parsedReason = ThreadListInvalidationReasonSchema.parse(reason);
    const parsedDetails = ThreadListInvalidationDetailsSchema.parse(details);
    if (
      parsedReason === THREAD_STREAM_STATE_CHANGED_METHOD
      && !this.shouldInvalidateForThreadStreamStateChange(parsedDetails)
    ) {
      logger.debug(
        {
          reason: parsedReason,
          ...parsedDetails
        },
        "thread-list-aggregation-cache-invalidation-skipped"
      );
      return;
    }

    const invalidationScope = this.readThreadListInvalidationScope(parsedReason);
    this.threadListAggregationCache.invalidateWhere(this.buildThreadListInvalidationPredicate(invalidationScope));
    const statistics = this.threadListAggregationCache.readStatistics();
    logger.debug(
      {
        reason: parsedReason,
        invalidationScope,
        ...parsedDetails,
        statistics
      },
      "thread-list-aggregation-cache-invalidated"
    );
  }

  private readThreadListInvalidationScope(reason: ThreadListInvalidationReason): ThreadListInvalidationScope {
    if (reason === "thread-archived" || reason === "thread-unarchived") {
      return "all";
    }
    return "active";
  }

  private shouldInvalidateForThreadStreamStateChange(details: Record<string, JsonValue>): boolean {
    const threadId = ThreadStreamStateChangeThreadIdentifierSchema.parse(details["threadId"]);
    if (threadId === undefined) {
      return true;
    }

    const now = Date.now();
    const lastInvalidationAt = this.lastThreadStreamCacheInvalidationByThreadId.get(threadId);
    // Stream state events can arrive in tight bursts; debounce invalidation per
    // thread to avoid repeatedly blowing hot cache entries during active generation.
    if (
      lastInvalidationAt !== undefined
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
    return (query) => !query.archived;
  }
}
