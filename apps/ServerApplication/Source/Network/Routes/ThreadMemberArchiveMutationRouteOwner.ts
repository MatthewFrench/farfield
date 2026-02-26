import {
  ThreadMemberMutationActionByName,
  ThreadMemberRouteMethodByName,
  ThreadMemberRouteSegmentByName,
  type ThreadMemberRouteDependencies,
  type ThreadMemberResolvedRouteContext
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

    if (!(req.method === ThreadMemberRouteMethodByName.post && this.dependencies.segments[3] === ThreadMemberRouteSegmentByName.archive)) {
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

    pushActionEventWithRequestContext(ThreadMemberMutationActionByName.threadArchive, "attempt", {
      agentId,
      threadId
    });

    try {
      await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        await archiveThread({ threadId });
      });
      pushActionEventWithRequestContext(ThreadMemberMutationActionByName.threadArchive, "success", {
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
      const message = pushActionErrorWithRequestContext(ThreadMemberMutationActionByName.threadArchive, error, {
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

    if (!(req.method === ThreadMemberRouteMethodByName.post && this.dependencies.segments[3] === ThreadMemberRouteSegmentByName.unarchive)) {
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

    pushActionEventWithRequestContext(ThreadMemberMutationActionByName.threadUnarchive, "attempt", {
      agentId,
      threadId
    });

    try {
      await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        await unarchiveThread({ threadId });
      });
      pushActionEventWithRequestContext(ThreadMemberMutationActionByName.threadUnarchive, "success", {
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
      const message = pushActionErrorWithRequestContext(ThreadMemberMutationActionByName.threadUnarchive, error, {
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
