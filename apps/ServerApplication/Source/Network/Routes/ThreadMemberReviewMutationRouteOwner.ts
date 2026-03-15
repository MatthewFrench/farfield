import { parseStartThreadReviewBody } from "../RequestSchemas/HttpSchemas.js";
import {
  isThreadMemberSubresourceRoute,
  ThreadMemberMutationActionByName,
  type ThreadMemberResolvedRouteContext,
  type ThreadMemberRouteDependencies,
  ThreadMemberRouteMethodByName,
  ThreadMemberRouteSegmentByName,
} from "./ThreadMemberRouteContracts.js";

export interface ThreadMemberReviewMutationRouteOwnerOptions {
  dependencies: ThreadMemberRouteDependencies;
  context: ThreadMemberResolvedRouteContext;
}

const DEFAULT_THREAD_REVIEW_TARGET = {
  type: "uncommittedChanges",
} as const;

/**
 * Owns thread-review mutation routing for canonical `/api/threads/:threadId/review`.
 */
export class ThreadMemberReviewMutationRouteOwner {
  private readonly dependencies: ThreadMemberRouteDependencies;
  private readonly context: ThreadMemberResolvedRouteContext;

  public constructor(options: ThreadMemberReviewMutationRouteOwnerOptions) {
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
          ThreadMemberRouteSegmentByName.review,
        )
      )
    ) {
      return false;
    }

    const startThreadReview = adapter.startThreadReview;
    if (!startThreadReview) {
      jsonResponse(this.dependencies.res, 400, {
        ok: false,
        error: `Agent ${agentId} does not support thread review`,
        threadId,
      });
      return true;
    }

    const body = parseStartThreadReviewBody(await readJsonBody(req));
    const target = body.target ?? DEFAULT_THREAD_REVIEW_TARGET;

    pushActionEventWithRequestContext(
      ThreadMemberMutationActionByName.threadReviewStart,
      "attempt",
      {
        agentId,
        threadId,
        targetType: target.type,
        ...(body.delivery !== undefined ? { delivery: body.delivery } : {}),
      },
    );

    try {
      const reviewResult = await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        return startThreadReview({
          threadId,
          target,
          ...(body.delivery !== undefined ? { delivery: body.delivery } : {}),
        });
      });
      pushActionEventWithRequestContext(
        ThreadMemberMutationActionByName.threadReviewStart,
        "success",
        {
          agentId,
          threadId,
          reviewThreadId: reviewResult.reviewThreadId,
          reviewTurnId: reviewResult.turnId,
          targetType: target.type,
        },
      );
      invalidateThreadListAggregationCache("thread-review-started", {
        agentId,
        threadId,
        reviewThreadId: reviewResult.reviewThreadId,
      });
      jsonResponse(this.dependencies.res, 200, {
        ok: true,
        threadId,
        reviewThreadId: reviewResult.reviewThreadId,
        reviewTurnId: reviewResult.turnId,
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext(
        ThreadMemberMutationActionByName.threadReviewStart,
        error,
        {
          agentId,
          threadId,
          targetType: target.type,
          ...(body.delivery !== undefined ? { delivery: body.delivery } : {}),
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
