import { parseRollbackThreadBody } from "../RequestSchemas/HttpSchemas.js";
import {
  isThreadMemberSubresourceRoute,
  ThreadMemberMutationActionByName,
  type ThreadMemberResolvedRouteContext,
  type ThreadMemberRouteDependencies,
  ThreadMemberRouteMethodByName,
  ThreadMemberRouteSegmentByName,
} from "./ThreadMemberRouteContracts.js";

export interface ThreadMemberRollbackMutationRouteOwnerOptions {
  dependencies: ThreadMemberRouteDependencies;
  context: ThreadMemberResolvedRouteContext;
}

/**
 * Owns thread-rollback mutation routing for canonical `/api/threads/:threadId/rollback`.
 */
export class ThreadMemberRollbackMutationRouteOwner {
  private readonly dependencies: ThreadMemberRouteDependencies;
  private readonly context: ThreadMemberResolvedRouteContext;

  public constructor(options: ThreadMemberRollbackMutationRouteOwnerOptions) {
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
          ThreadMemberRouteSegmentByName.rollback,
        )
      )
    ) {
      return false;
    }

    const rollbackThread = adapter.rollbackThread;
    if (!rollbackThread) {
      jsonResponse(this.dependencies.res, 400, {
        ok: false,
        error: `Agent ${agentId} does not support thread rollback`,
        threadId,
      });
      return true;
    }

    const body = parseRollbackThreadBody(await readJsonBody(req));

    pushActionEventWithRequestContext(ThreadMemberMutationActionByName.threadRollback, "attempt", {
      agentId,
      threadId,
      numTurns: body.numTurns,
    });

    try {
      await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        await rollbackThread({
          threadId,
          numTurns: body.numTurns,
        });
      });
      pushActionEventWithRequestContext(
        ThreadMemberMutationActionByName.threadRollback,
        "success",
        {
          agentId,
          threadId,
          numTurns: body.numTurns,
        },
      );
      invalidateThreadListAggregationCache("thread-rolled-back", {
        agentId,
        threadId,
        numTurns: body.numTurns,
      });
      jsonResponse(this.dependencies.res, 200, {
        ok: true,
        threadId,
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext(
        ThreadMemberMutationActionByName.threadRollback,
        error,
        {
          agentId,
          threadId,
          numTurns: body.numTurns,
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
