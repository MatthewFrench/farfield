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

const ThreadMemberUnsubscribeRouteStatusCodeByName = {
  success: 200,
  badRequest: 400,
} as const;

const ThreadMemberUnsubscribeStatusByName = {
  notLoaded: "notLoaded",
} as const;

const ThreadMemberUnsubscribeNotLoadedErrorPatterns = [
  /thread not loaded/i,
  /conversation not found/i,
] as const;

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

    const unsubscribeThread = adapter.unsubscribeThread?.bind(adapter);
    if (!unsubscribeThread) {
      jsonResponse(this.dependencies.res, ThreadMemberUnsubscribeRouteStatusCodeByName.badRequest, {
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
      jsonResponse(this.dependencies.res, ThreadMemberUnsubscribeRouteStatusCodeByName.success, {
        ok: true,
        threadId,
        status,
      });
    } catch (error) {
      const shouldTreatAsNotLoaded = this.shouldTreatAsNotLoaded(error);
      if (!shouldTreatAsNotLoaded) {
        pushActionErrorWithRequestContext(
          ThreadMemberMutationActionByName.threadUnsubscribe,
          error,
          {
            agentId,
            threadId,
          },
        );
      }
      this.writeNotLoadedResponse();
    }

    return true;
  }

  private writeNotLoadedResponse(): void {
    const {
      pushActionEventWithRequestContext,
      invalidateThreadListAggregationCache,
      jsonResponse,
      res,
    } = this.dependencies;
    const { agentId, threadId } = this.context;
    const status = ThreadMemberUnsubscribeStatusByName.notLoaded;

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
    jsonResponse(res, ThreadMemberUnsubscribeRouteStatusCodeByName.success, {
      ok: true,
      threadId,
      status,
    });
  }

  private shouldTreatAsNotLoaded<ErrorType>(error: ErrorType): boolean {
    const errorMessage = this.readErrorMessage(error);
    if (this.isKnownNotLoadedMessage(errorMessage)) {
      return true;
    }
    if (error instanceof Error) {
      return this.isNotLoadedCondition(error);
    }
    return false;
  }

  private isNotLoadedCondition(error: Error): boolean {
    return this.isThreadNotLoadedError(error) || this.isConversationNotFoundError(error);
  }

  private isThreadNotLoadedError(error: Error): boolean {
    const classifyThreadNotLoadedError = this.context.adapter.isThreadNotLoadedError?.bind(
      this.context.adapter,
    );
    if (!classifyThreadNotLoadedError) {
      return false;
    }
    return classifyThreadNotLoadedError(error);
  }

  private isConversationNotFoundError(error: Error): boolean {
    const classifyConversationNotFoundError =
      this.context.adapter.isConversationNotFoundError?.bind(this.context.adapter);
    if (!classifyConversationNotFoundError) {
      return false;
    }
    return classifyConversationNotFoundError(error);
  }

  private isKnownNotLoadedMessage(errorMessage: string): boolean {
    return ThreadMemberUnsubscribeNotLoadedErrorPatterns.some((pattern) =>
      pattern.test(errorMessage),
    );
  }

  private readErrorMessage<ErrorType>(error: ErrorType): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    return String(error);
  }
}
