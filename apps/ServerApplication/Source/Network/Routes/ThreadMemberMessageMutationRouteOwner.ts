import { parseSendMessageBody } from "../RequestSchemas/HttpSchemas.js";
import {
  ThreadMemberMutationActionByName,
  type ThreadMemberResolvedRouteContext,
  type ThreadMemberRouteDependencies,
  ThreadMemberRouteMethodByName,
  ThreadMemberRouteSegmentByName,
} from "./ThreadMemberRouteContracts.js";

export interface ThreadMemberMessageMutationRouteOwnerOptions {
  dependencies: ThreadMemberRouteDependencies;
  context: ThreadMemberResolvedRouteContext;
}

export class ThreadMemberMessageMutationRouteOwner {
  private readonly dependencies: ThreadMemberRouteDependencies;
  private readonly context: ThreadMemberResolvedRouteContext;

  public constructor(options: ThreadMemberMessageMutationRouteOwnerOptions) {
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
      recordThreadSendAccepted,
      scheduleThreadStreamDeltaPublish,
      jsonResponse,
    } = this.dependencies;
    const { adapter, agentId, threadId } = this.context;

    if (
      !(
        req.method === ThreadMemberRouteMethodByName.post &&
        this.dependencies.segments.length === 4 &&
        this.dependencies.segments[3] === ThreadMemberRouteSegmentByName.messages
      )
    ) {
      return false;
    }

    const body = parseSendMessageBody(await readJsonBody(req));

    pushActionEventWithRequestContext(ThreadMemberMutationActionByName.messages, "attempt", {
      agentId,
      threadId,
      textLength: body.text.length,
    });

    try {
      await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        await adapter.sendMessage({
          threadId,
          text: body.text,
          ...(body.ownerClientId !== undefined ? { ownerClientId: body.ownerClientId } : {}),
          ...(body.cwd !== undefined ? { cwd: body.cwd } : {}),
          ...(typeof body.isSteering === "boolean" ? { isSteering: body.isSteering } : {}),
        });
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext(
        ThreadMemberMutationActionByName.messages,
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
      return true;
    }

    pushActionEventWithRequestContext(ThreadMemberMutationActionByName.messages, "success", {
      agentId,
      threadId,
    });
    recordThreadSendAccepted(threadId);
    invalidateThreadListAggregationCache("thread-message-sent", {
      threadId,
      agentId,
    });
    scheduleThreadStreamDeltaPublish(threadId);

    jsonResponse(this.dependencies.res, 200, {
      ok: true,
      threadId,
    });
    return true;
  }
}
