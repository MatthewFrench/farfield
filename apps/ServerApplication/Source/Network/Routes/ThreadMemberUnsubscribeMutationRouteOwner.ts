import {
  isThreadMemberSubresourceRoute,
  ThreadMemberMutationActionByName,
  type ThreadMemberResolvedRouteContext,
  type ThreadMemberRouteDependencies,
  ThreadMemberRouteMethodByName,
  ThreadMemberRouteSegmentByName,
} from "./ThreadMemberRouteContracts.js";

export interface ThreadMemberUnsubscribeMutationRouteOwnerOptions {
  dependencies: ThreadMemberRouteDependencies;
  context: ThreadMemberResolvedRouteContext;
}

/**
 * Owns thread-unsubscribe mutation routing for canonical `/api/threads/:threadId/unsubscribe`.
 */
export class ThreadMemberUnsubscribeMutationRouteOwner {
  private readonly dependencies: ThreadMemberRouteDependencies;
  private readonly context: ThreadMemberResolvedRouteContext;

  public constructor(options: ThreadMemberUnsubscribeMutationRouteOwnerOptions) {
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
          ThreadMemberRouteSegmentByName.unsubscribe,
        )
      )
    ) {
      return false;
    }

    const unsubscribeThread = adapter.unsubscribeThread;
    if (!unsubscribeThread) {
      jsonResponse(this.dependencies.res, 400, {
        ok: false,
        error: `Agent ${agentId} does not support thread unsubscribe`,
        threadId,
      });
      return true;
    }

    pushActionEventWithRequestContext(
      ThreadMemberMutationActionByName.threadUnsubscribe,
      "attempt",
      {
        agentId,
        threadId,
      },
    );

    try {
      const status = await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        return unsubscribeThread({ threadId });
      });
      pushActionEventWithRequestContext(
        ThreadMemberMutationActionByName.threadUnsubscribe,
        "success",
        {
          agentId,
          threadId,
          status,
        },
      );
      invalidateThreadListAggregationCache("thread-unsubscribed", {
        agentId,
        threadId,
        status,
      });
      jsonResponse(this.dependencies.res, 200, {
        ok: true,
        threadId,
        status,
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext(
        ThreadMemberMutationActionByName.threadUnsubscribe,
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
