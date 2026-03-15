import {
  isThreadMemberSubresourceRoute,
  ThreadMemberMutationActionByName,
  type ThreadMemberResolvedRouteContext,
  type ThreadMemberRouteDependencies,
  ThreadMemberRouteMethodByName,
  ThreadMemberRouteSegmentByName,
} from "./ThreadMemberRouteContracts.js";

export interface ThreadMemberBackgroundTerminalsCleanMutationRouteOwnerOptions {
  dependencies: ThreadMemberRouteDependencies;
  context: ThreadMemberResolvedRouteContext;
}

/**
 * Owns background-terminal cleanup mutation routing for
 * canonical `/api/threads/:threadId/background-terminals-clean`.
 */
export class ThreadMemberBackgroundTerminalsCleanMutationRouteOwner {
  private readonly dependencies: ThreadMemberRouteDependencies;
  private readonly context: ThreadMemberResolvedRouteContext;

  public constructor(options: ThreadMemberBackgroundTerminalsCleanMutationRouteOwnerOptions) {
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
          ThreadMemberRouteSegmentByName.backgroundTerminalsClean,
        )
      )
    ) {
      return false;
    }

    const cleanThreadBackgroundTerminals = adapter.cleanThreadBackgroundTerminals;
    if (!cleanThreadBackgroundTerminals) {
      jsonResponse(this.dependencies.res, 400, {
        ok: false,
        error: `Agent ${agentId} does not support background terminal cleanup`,
        threadId,
      });
      return true;
    }

    pushActionEventWithRequestContext(
      ThreadMemberMutationActionByName.threadBackgroundTerminalsClean,
      "attempt",
      {
        agentId,
        threadId,
      },
    );

    try {
      await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        await cleanThreadBackgroundTerminals({
          threadId,
        });
      });
      pushActionEventWithRequestContext(
        ThreadMemberMutationActionByName.threadBackgroundTerminalsClean,
        "success",
        {
          agentId,
          threadId,
        },
      );
      invalidateThreadListAggregationCache("thread-background-terminals-cleaned", {
        agentId,
        threadId,
      });
      jsonResponse(this.dependencies.res, 200, {
        ok: true,
        threadId,
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext(
        ThreadMemberMutationActionByName.threadBackgroundTerminalsClean,
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
