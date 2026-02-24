import type {
  ThreadMemberRouteDependencies,
  ThreadMemberResolvedRouteContext
} from "./ThreadMemberRouteContracts.js";

export interface ThreadMemberArchiveMutationRouteOwnerOptions {
  dependencies: ThreadMemberRouteDependencies;
  context: ThreadMemberResolvedRouteContext;
}

export class ThreadMemberArchiveMutationRouteOwner {
  private readonly dependencies: ThreadMemberRouteDependencies;
  private readonly context: ThreadMemberResolvedRouteContext;

  public constructor(options: ThreadMemberArchiveMutationRouteOwnerOptions) {
    this.dependencies = options.dependencies;
    this.context = options.context;
  }

  public async handle(): Promise<boolean> {
    if (await this.handleArchiveRoute()) {
      return true;
    }

    return this.handleUnarchiveRoute();
  }

  private async handleArchiveRoute(): Promise<boolean> {
    const {
      req,
      threadConcurrencyCoordinator,
      pushActionEventWithRequestContext,
      pushActionErrorWithRequestContext,
      invalidateThreadListAggregationCache,
      jsonResponse
    } = this.dependencies;
    const { adapter, agentId, threadId } = this.context;

    if (!(req.method === "POST" && this.dependencies.segments[3] === "archive")) {
      return false;
    }

    const archiveThread = adapter.archiveThread;
    if (!archiveThread) {
      jsonResponse(this.dependencies.res, 400, {
        ok: false,
        error: `Agent ${agentId} does not support thread archive`,
        threadId
      });
      return true;
    }

    pushActionEventWithRequestContext("thread-archive", "attempt", {
      agentId,
      threadId
    });

    try {
      await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        await archiveThread({ threadId });
      });
      pushActionEventWithRequestContext("thread-archive", "success", {
        agentId,
        threadId
      });
      invalidateThreadListAggregationCache("thread-archived", {
        threadId,
        agentId
      });
      jsonResponse(this.dependencies.res, 200, {
        ok: true,
        threadId
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext("thread-archive", error, {
        agentId,
        threadId
      });
      jsonResponse(this.dependencies.res, 500, {
        ok: false,
        error: message,
        threadId
      });
    }
    return true;
  }

  private async handleUnarchiveRoute(): Promise<boolean> {
    const {
      req,
      threadConcurrencyCoordinator,
      pushActionEventWithRequestContext,
      pushActionErrorWithRequestContext,
      invalidateThreadListAggregationCache,
      jsonResponse
    } = this.dependencies;
    const { adapter, agentId, threadId } = this.context;

    if (!(req.method === "POST" && this.dependencies.segments[3] === "unarchive")) {
      return false;
    }

    const unarchiveThread = adapter.unarchiveThread;
    if (!unarchiveThread) {
      jsonResponse(this.dependencies.res, 400, {
        ok: false,
        error: `Agent ${agentId} does not support thread unarchive`,
        threadId
      });
      return true;
    }

    pushActionEventWithRequestContext("thread-unarchive", "attempt", {
      agentId,
      threadId
    });

    try {
      await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        await unarchiveThread({ threadId });
      });
      pushActionEventWithRequestContext("thread-unarchive", "success", {
        agentId,
        threadId
      });
      invalidateThreadListAggregationCache("thread-unarchived", {
        threadId,
        agentId
      });
      jsonResponse(this.dependencies.res, 200, {
        ok: true,
        threadId
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext("thread-unarchive", error, {
        agentId,
        threadId
      });
      jsonResponse(this.dependencies.res, 500, {
        ok: false,
        error: message,
        threadId
      });
    }
    return true;
  }
}
