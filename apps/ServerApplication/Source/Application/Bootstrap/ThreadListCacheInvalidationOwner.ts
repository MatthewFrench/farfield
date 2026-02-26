import { JsonValueSchema, type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import { logger } from "../../Shared/Logging/Logger.js";
import type {
  ThreadListAggregationCache,
  ThreadListAggregationQuery
} from "../../Network/ThreadListAggregationCache.js";
import { THREAD_STREAM_STATE_CHANGED_METHOD } from "../ThreadStreamStateChangedHistoryBatchOwner.js";

type ThreadListInvalidationScope = "all" | "active";
interface ThreadListCacheInvalidationOwnerDependencies {
  now?: () => number;
}

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
const ThreadListInvalidationScopeByReason: Readonly<Record<ThreadListInvalidationReason, ThreadListInvalidationScope>> = {
  [THREAD_STREAM_STATE_CHANGED_METHOD]: "active",
  "thread-created": "active",
  "thread-message-sent": "active",
  "thread-user-input-submitted": "active",
  "thread-interrupted": "active",
  "thread-archived": "all",
  "thread-unarchived": "all"
};
const ThreadListInvalidationPredicateByScope: Readonly<
  Record<ThreadListInvalidationScope, (query: ThreadListAggregationQuery) => boolean>
> = {
  all: () => true,
  active: (query) => !query.archived
};
const ThreadListInvalidationDetailsSchema = z
  .object({
    threadId: z.string().trim().min(1).optional()
  })
  .catchall(JsonValueSchema);
type ThreadListInvalidationDetails = z.infer<typeof ThreadListInvalidationDetailsSchema>;

const ThreadStreamCacheInvalidationMinimumIntervalMilliseconds = 2_000;

/**
 * Owns thread-list cache invalidation policy, including mutation-scope filtering
 * and stream-event debounce behavior for high-frequency updates.
 */
export class ThreadListCacheInvalidationOwner {
  private readonly threadListAggregationCache: ThreadListAggregationCache;
  private readonly now: () => number;
  private readonly lastThreadStreamCacheInvalidationByThreadId = new Map<string, number>();

  public constructor(
    threadListAggregationCache: ThreadListAggregationCache,
    dependencies?: ThreadListCacheInvalidationOwnerDependencies
  ) {
    this.threadListAggregationCache = threadListAggregationCache;
    this.now = dependencies?.now ?? (() => Date.now());
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
    return ThreadListInvalidationScopeByReason[reason];
  }

  private shouldInvalidateForThreadStreamStateChange(details: ThreadListInvalidationDetails): boolean {
    const threadId = details.threadId;
    if (threadId === undefined) {
      return true;
    }

    const now = this.now();
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
    return ThreadListInvalidationPredicateByScope[scope];
  }
}
