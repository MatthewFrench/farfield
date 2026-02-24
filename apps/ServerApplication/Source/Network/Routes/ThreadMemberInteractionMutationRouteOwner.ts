import { JsonValueSchema } from "@farfield/protocol";
import {
  InterruptBodySchema,
  parseBody,
  SetModeBodySchema,
  SubmitUserInputBodySchema
} from "../RequestSchemas/HttpSchemas.js";
import type {
  ThreadMemberRouteDependencies,
  ThreadMemberResolvedRouteContext
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
      jsonResponse
    } = this.dependencies;
    const { adapter, agentId, threadId } = this.context;

    if (!(req.method === "POST" && this.dependencies.segments[3] === "collaboration-mode")) {
      return false;
    }

    const setCollaborationMode = adapter.setCollaborationMode;
    if (!adapter.capabilities.canSetCollaborationMode || !setCollaborationMode) {
      jsonResponse(this.dependencies.res, 400, {
        ok: false,
        error: `Agent ${agentId} does not support collaboration modes`,
        threadId
      });
      return true;
    }

    const body = parseBody(SetModeBodySchema, await readJsonBody(req));

    pushActionEventWithRequestContext("collaboration-mode", "attempt", {
      agentId,
      threadId,
      collaborationMode: JsonValueSchema.parse(body.collaborationMode)
    });

    try {
      const result = await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        return setCollaborationMode({
          threadId,
          ...(body.ownerClientId ? { ownerClientId: body.ownerClientId } : {}),
          collaborationMode: body.collaborationMode
        });
      });

      pushActionEventWithRequestContext("collaboration-mode", "success", {
        agentId,
        threadId,
        ownerClientId: result.ownerClientId
      });

      jsonResponse(this.dependencies.res, 200, {
        ok: true,
        threadId,
        ownerClientId: result.ownerClientId
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext("collaboration-mode", error, {
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

  private async handleSubmitUserInputRoute(): Promise<boolean> {
    const {
      req,
      readJsonBody,
      threadConcurrencyCoordinator,
      pushActionEventWithRequestContext,
      pushActionErrorWithRequestContext,
      invalidateThreadListAggregationCache,
      jsonResponse
    } = this.dependencies;
    const { adapter, agentId, threadId } = this.context;

    if (!(req.method === "POST" && this.dependencies.segments[3] === "user-input")) {
      return false;
    }

    const submitUserInput = adapter.submitUserInput;
    if (!adapter.capabilities.canSubmitUserInput || !submitUserInput) {
      jsonResponse(this.dependencies.res, 400, {
        ok: false,
        error: `Agent ${agentId} does not support user input submission`,
        threadId
      });
      return true;
    }

    const body = parseBody(SubmitUserInputBodySchema, await readJsonBody(req));

    pushActionEventWithRequestContext("user-input", "attempt", {
      agentId,
      threadId,
      requestId: body.requestId
    });

    try {
      const result = await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        return submitUserInput({
          threadId,
          ...(body.ownerClientId ? { ownerClientId: body.ownerClientId } : {}),
          requestId: body.requestId,
          response: body.response
        });
      });

      pushActionEventWithRequestContext("user-input", "success", {
        agentId,
        threadId,
        ownerClientId: result.ownerClientId,
        requestId: result.requestId
      });
      invalidateThreadListAggregationCache("thread-user-input-submitted", {
        threadId,
        agentId,
        requestId: result.requestId
      });

      jsonResponse(this.dependencies.res, 200, {
        ok: true,
        threadId,
        ownerClientId: result.ownerClientId,
        requestId: result.requestId
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext("user-input", error, {
        agentId,
        threadId,
        requestId: body.requestId
      });
      jsonResponse(this.dependencies.res, 500, {
        ok: false,
        error: message,
        threadId,
        requestId: body.requestId
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
      jsonResponse
    } = this.dependencies;
    const { adapter, agentId, threadId } = this.context;

    if (!(req.method === "POST" && this.dependencies.segments[3] === "interrupt")) {
      return false;
    }

    const body = parseBody(InterruptBodySchema, await readJsonBody(req));

    pushActionEventWithRequestContext("interrupt", "attempt", {
      agentId,
      threadId
    });

    try {
      await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        await adapter.interrupt({
          threadId,
          ...(body.ownerClientId ? { ownerClientId: body.ownerClientId } : {})
        });
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext("interrupt", error, {
        agentId,
        threadId
      });
      jsonResponse(this.dependencies.res, 500, { ok: false, error: message, threadId });
      return true;
    }

    pushActionEventWithRequestContext("interrupt", "success", {
      agentId,
      threadId
    });
    invalidateThreadListAggregationCache("thread-interrupted", {
      threadId,
      agentId
    });

    jsonResponse(this.dependencies.res, 200, {
      ok: true,
      threadId
    });
    return true;
  }
}
