import { JsonValueSchema } from "@farfield/protocol";
import {
  parseInterruptBody,
  parseSetModeBody,
  parseSubmitUserInputBody,
} from "../RequestSchemas/HttpSchemas.js";
import {
  isThreadMemberSubresourceRoute,
  ThreadMemberMutationActionByName,
  type ThreadMemberResolvedRouteContext,
  type ThreadMemberRouteDependencies,
  ThreadMemberRouteMethodByName,
  ThreadMemberRouteSegmentByName,
} from "./ThreadMemberRouteContracts.js";

export interface ThreadMemberInteractionMutationRouteOwnerOptions {
  dependencies: ThreadMemberRouteDependencies;
  context: ThreadMemberResolvedRouteContext;
}

export class ThreadMemberInteractionMutationRouteOwner {
  private readonly dependencies: ThreadMemberRouteDependencies;
  private readonly context: ThreadMemberResolvedRouteContext;

  public constructor(options: ThreadMemberInteractionMutationRouteOwnerOptions) {
    this.dependencies = options.dependencies;
    this.context = options.context;
  }

  public async handle(): Promise<boolean> {
    if (await this.handleSetCollaborationModeRoute()) {
      return true;
    }

    if (await this.handleSubmitUserInputRoute()) {
      return true;
    }

    return this.handleInterruptRoute();
  }

  private async handleSetCollaborationModeRoute(): Promise<boolean> {
    const {
      req,
      readJsonBody,
      threadConcurrencyCoordinator,
      pushActionEventWithRequestContext,
      pushActionErrorWithRequestContext,
      jsonResponse,
    } = this.dependencies;
    const { adapter, agentId, threadId } = this.context;

    if (
      !(
        req.method === ThreadMemberRouteMethodByName.post &&
        isThreadMemberSubresourceRoute(
          this.dependencies.segments,
          ThreadMemberRouteSegmentByName.collaborationMode,
        )
      )
    ) {
      return false;
    }

    const setCollaborationMode = adapter.setCollaborationMode;
    if (!adapter.capabilities.canSetCollaborationMode || !setCollaborationMode) {
      jsonResponse(this.dependencies.res, 400, {
        ok: false,
        error: `Agent ${agentId} does not support collaboration modes`,
        threadId,
      });
      return true;
    }

    const body = parseSetModeBody(await readJsonBody(req));

    pushActionEventWithRequestContext(
      ThreadMemberMutationActionByName.collaborationMode,
      "attempt",
      {
        agentId,
        threadId,
        collaborationMode: JsonValueSchema.parse(body.collaborationMode),
      },
    );

    try {
      const result = await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        return setCollaborationMode({
          threadId,
          ...(body.ownerClientId !== undefined ? { ownerClientId: body.ownerClientId } : {}),
          collaborationMode: body.collaborationMode,
        });
      });

      pushActionEventWithRequestContext(
        ThreadMemberMutationActionByName.collaborationMode,
        "success",
        {
          agentId,
          threadId,
          ownerClientId: result.ownerClientId,
        },
      );

      jsonResponse(this.dependencies.res, 200, {
        ok: true,
        threadId,
        ownerClientId: result.ownerClientId,
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext(
        ThreadMemberMutationActionByName.collaborationMode,
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

  private async handleSubmitUserInputRoute(): Promise<boolean> {
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
          ThreadMemberRouteSegmentByName.userInput,
        )
      )
    ) {
      return false;
    }

    const submitUserInput = adapter.submitUserInput;
    if (!adapter.capabilities.canSubmitUserInput || !submitUserInput) {
      jsonResponse(this.dependencies.res, 400, {
        ok: false,
        error: `Agent ${agentId} does not support user input submission`,
        threadId,
      });
      return true;
    }

    const body = parseSubmitUserInputBody(await readJsonBody(req));

    pushActionEventWithRequestContext(ThreadMemberMutationActionByName.userInput, "attempt", {
      agentId,
      threadId,
      requestId: body.requestId,
    });

    try {
      const result = await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        return submitUserInput({
          threadId,
          ...(body.ownerClientId !== undefined ? { ownerClientId: body.ownerClientId } : {}),
          requestId: body.requestId,
          response: body.response,
        });
      });

      pushActionEventWithRequestContext(ThreadMemberMutationActionByName.userInput, "success", {
        agentId,
        threadId,
        ownerClientId: result.ownerClientId,
        requestId: result.requestId,
      });
      invalidateThreadListAggregationCache("thread-user-input-submitted", {
        threadId,
        agentId,
        requestId: result.requestId,
      });

      jsonResponse(this.dependencies.res, 200, {
        ok: true,
        threadId,
        ownerClientId: result.ownerClientId,
        requestId: result.requestId,
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext(
        ThreadMemberMutationActionByName.userInput,
        error,
        {
          agentId,
          threadId,
          requestId: body.requestId,
        },
      );
      jsonResponse(this.dependencies.res, 500, {
        ok: false,
        error: message,
        threadId,
        requestId: body.requestId,
      });
    }
    return true;
  }

  private async handleInterruptRoute(): Promise<boolean> {
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
          ThreadMemberRouteSegmentByName.interrupt,
        )
      )
    ) {
      return false;
    }

    const body = parseInterruptBody(await readJsonBody(req));

    pushActionEventWithRequestContext(ThreadMemberMutationActionByName.interrupt, "attempt", {
      agentId,
      threadId,
    });

    try {
      await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        await adapter.interrupt({
          threadId,
          ...(body.ownerClientId !== undefined ? { ownerClientId: body.ownerClientId } : {}),
        });
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext(
        ThreadMemberMutationActionByName.interrupt,
        error,
        {
          agentId,
          threadId,
        },
      );
      jsonResponse(this.dependencies.res, 500, { ok: false, error: message, threadId });
      return true;
    }

    pushActionEventWithRequestContext(ThreadMemberMutationActionByName.interrupt, "success", {
      agentId,
      threadId,
    });
    invalidateThreadListAggregationCache("thread-interrupted", {
      threadId,
      agentId,
    });

    jsonResponse(this.dependencies.res, 200, {
      ok: true,
      threadId,
    });
    return true;
  }
}
