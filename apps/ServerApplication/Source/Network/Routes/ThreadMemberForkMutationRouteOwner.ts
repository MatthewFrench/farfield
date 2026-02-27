import { parseForkThreadBody } from "../RequestSchemas/HttpSchemas.js";
import {
  isThreadMemberSubresourceRoute,
  ThreadMemberMutationActionByName,
  type ThreadMemberResolvedRouteContext,
  type ThreadMemberRouteDependencies,
  ThreadMemberRouteMethodByName,
  ThreadMemberRouteSegmentByName,
} from "./ThreadMemberRouteContracts.js";

export interface ThreadMemberForkMutationRouteOwnerOptions {
  dependencies: ThreadMemberRouteDependencies;
  context: ThreadMemberResolvedRouteContext;
}

/**
 * Owns thread-fork mutation routing and response mapping for canonical `/api/threads/:threadId/fork`.
 */
export class ThreadMemberForkMutationRouteOwner {
  private readonly dependencies: ThreadMemberRouteDependencies;
  private readonly context: ThreadMemberResolvedRouteContext;

  public constructor(options: ThreadMemberForkMutationRouteOwnerOptions) {
    this.dependencies = options.dependencies;
    this.context = options.context;
  }

  public async handle(): Promise<boolean> {
    const {
      req,
      readJsonBody,
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
          ThreadMemberRouteSegmentByName.fork,
        )
      )
    ) {
      return false;
    }

    parseForkThreadBody(await readJsonBody(req));

    const forkThread = adapter.forkThread;
    if (!forkThread) {
      jsonResponse(this.dependencies.res, 400, {
        ok: false,
        error: `Agent ${agentId} does not support thread fork`,
        threadId,
      });
      return true;
    }

    pushActionEventWithRequestContext(ThreadMemberMutationActionByName.threadFork, "attempt", {
      agentId,
      threadId,
    });

    try {
      const forkResult = await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        return forkThread({
          threadId,
        });
      });
      pushActionEventWithRequestContext(ThreadMemberMutationActionByName.threadFork, "success", {
        agentId,
        threadId,
        forkedThreadId: forkResult.threadId,
      });
      invalidateThreadListAggregationCache("thread-forked", {
        agentId,
        threadId,
        forkedThreadId: forkResult.threadId,
      });
      jsonResponse(this.dependencies.res, 200, {
        ok: true,
        threadId: forkResult.threadId,
        sourceThreadId: threadId,
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext(
        ThreadMemberMutationActionByName.threadFork,
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
