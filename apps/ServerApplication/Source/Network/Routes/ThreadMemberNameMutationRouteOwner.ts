import { parseSetThreadNameBody } from "../RequestSchemas/HttpSchemas.js";
import {
  isThreadMemberSubresourceRoute,
  ThreadMemberMutationActionByName,
  type ThreadMemberResolvedRouteContext,
  type ThreadMemberRouteDependencies,
  ThreadMemberRouteMethodByName,
  ThreadMemberRouteSegmentByName,
} from "./ThreadMemberRouteContracts.js";

export interface ThreadMemberNameMutationRouteOwnerOptions {
  dependencies: ThreadMemberRouteDependencies;
  context: ThreadMemberResolvedRouteContext;
}

/**
 * Owns thread-name mutation routing for canonical `/api/threads/:threadId/name`.
 */
export class ThreadMemberNameMutationRouteOwner {
  private readonly dependencies: ThreadMemberRouteDependencies;
  private readonly context: ThreadMemberResolvedRouteContext;

  public constructor(options: ThreadMemberNameMutationRouteOwnerOptions) {
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
          ThreadMemberRouteSegmentByName.name,
        )
      )
    ) {
      return false;
    }

    const body = parseSetThreadNameBody(await readJsonBody(req));

    const setThreadName = adapter.setThreadName;
    if (!setThreadName) {
      jsonResponse(this.dependencies.res, 400, {
        ok: false,
        error: `Agent ${agentId} does not support thread naming`,
        threadId,
      });
      return true;
    }

    pushActionEventWithRequestContext(ThreadMemberMutationActionByName.threadSetName, "attempt", {
      agentId,
      threadId,
      nameLength: body.name.length,
    });

    try {
      await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        await setThreadName.call(adapter, {
          threadId,
          name: body.name,
        });
      });
      pushActionEventWithRequestContext(ThreadMemberMutationActionByName.threadSetName, "success", {
        agentId,
        threadId,
        nameLength: body.name.length,
      });
      invalidateThreadListAggregationCache("thread-name-set", {
        agentId,
        threadId,
      });
      jsonResponse(this.dependencies.res, 200, {
        ok: true,
        threadId,
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext(
        ThreadMemberMutationActionByName.threadSetName,
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
