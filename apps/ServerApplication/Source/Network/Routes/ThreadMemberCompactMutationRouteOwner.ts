import {
  isThreadMemberSubresourceRoute,
  ThreadMemberMutationActionByName,
  type ThreadMemberResolvedRouteContext,
  type ThreadMemberRouteDependencies,
  ThreadMemberRouteMethodByName,
  ThreadMemberRouteSegmentByName,
} from "./ThreadMemberRouteContracts.js";

export interface ThreadMemberCompactMutationRouteOwnerOptions {
  dependencies: ThreadMemberRouteDependencies;
  context: ThreadMemberResolvedRouteContext;
}

/**
 * Owns thread-compaction mutation routing for canonical `/api/threads/:threadId/compact`.
 */
export class ThreadMemberCompactMutationRouteOwner {
  private readonly dependencies: ThreadMemberRouteDependencies;
  private readonly context: ThreadMemberResolvedRouteContext;

  public constructor(options: ThreadMemberCompactMutationRouteOwnerOptions) {
    this.dependencies = options.dependencies;
    this.context = options.context;
  }

  public async handle(): Promise<boolean> {
    const {
      req,
      threadConcurrencyCoordinator,
      pushActionEventWithRequestContext,
      pushActionErrorWithRequestContext,
      invalidateThreadListAggregationCache,
      jsonResponse,
    } = this.dependencies;
    const { adapter, agentId, threadId } = this.context;

    if (
      !(
        req.method === ThreadMemberRouteMethodByName.post &&
        isThreadMemberSubresourceRoute(
          this.dependencies.segments,
          ThreadMemberRouteSegmentByName.compact,
        )
      )
    ) {
      return false;
    }

    const compactThread = adapter.compactThread;
    if (!compactThread) {
      jsonResponse(this.dependencies.res, 400, {
        ok: false,
        error: `Agent ${agentId} does not support thread compaction`,
        threadId,
      });
      return true;
    }

    pushActionEventWithRequestContext(
      ThreadMemberMutationActionByName.threadCompactStart,
      "attempt",
      {
        agentId,
        threadId,
      },
    );

    try {
      await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        await compactThread({
          threadId,
        });
      });
      pushActionEventWithRequestContext(
        ThreadMemberMutationActionByName.threadCompactStart,
        "success",
        {
          agentId,
          threadId,
        },
      );
      invalidateThreadListAggregationCache("thread-compaction-started", {
        agentId,
        threadId,
      });
      jsonResponse(this.dependencies.res, 200, {
        ok: true,
        threadId,
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext(
        ThreadMemberMutationActionByName.threadCompactStart,
        error,
        {
          agentId,
          threadId,
        },
      );
      jsonResponse(this.dependencies.res, 500, {
        ok: false,
        error: message,
        threadId,
      });
    }

    return true;
  }
}
