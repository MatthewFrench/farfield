import type { ThreadMemberRouteDependencies, ThreadMemberResolvedRouteContext } from "./ThreadMemberRouteContracts.js";

export interface ThreadMemberReadRouteOwnerOptions {
  dependencies: ThreadMemberRouteDependencies;
  context: ThreadMemberResolvedRouteContext;
}

export class ThreadMemberReadRouteOwner {
  private readonly dependencies: ThreadMemberRouteDependencies;
  private readonly context: ThreadMemberResolvedRouteContext;

  public constructor(options: ThreadMemberReadRouteOwnerOptions) {
    this.dependencies = options.dependencies;
    this.context = options.context;
  }

  public async handle(): Promise<boolean> {
    const { req, res, segments, url, codexAdapter, parseBoolean, parseInteger, jsonResponse } = this.dependencies;
    const { adapter, agentId, threadId } = this.context;

    if (req.method === "GET" && segments.length === 3) {
      const includeTurns = parseBoolean(url.searchParams.get("includeTurns"), true);

      try {
        const result = await adapter.readThread({ threadId, includeTurns });
        jsonResponse(res, 200, {
          ok: true,
          ...result,
          agentId
        });
        return true;
      } catch (error) {
        if (
          agentId === "codex"
          && codexAdapter
          && error instanceof Error
          && codexAdapter.isThreadNotLoadedError(error)
        ) {
          jsonResponse(res, 404, {
            ok: false,
            error: `Thread not loaded in app-server: ${threadId}`,
            threadId
          });
          return true;
        }
        throw error;
      }
    }

    if (req.method === "GET" && segments[3] === "live-state") {
      if (!adapter.capabilities.canReadLiveState || !adapter.readLiveState) {
        jsonResponse(res, 400, {
          ok: false,
          error: `Agent ${agentId} does not support live thread state`,
          threadId
        });
        return true;
      }

      const liveState = await adapter.readLiveState(threadId);
      jsonResponse(res, 200, {
        ok: true,
        threadId,
        ownerClientId: liveState.ownerClientId,
        conversationState: liveState.conversationState,
        liveStateError: liveState.liveStateError
      });
      return true;
    }

    if (req.method === "GET" && segments[3] === "stream-events") {
      if (!adapter.capabilities.canReadStreamEvents || !adapter.readStreamEvents) {
        jsonResponse(res, 400, {
          ok: false,
          error: `Agent ${agentId} does not support stream events`,
          threadId
        });
        return true;
      }

      const limit = parseInteger(url.searchParams.get("limit"), 60);
      const streamEvents = await adapter.readStreamEvents(threadId, limit);
      jsonResponse(res, 200, {
        ok: true,
        threadId,
        ownerClientId: streamEvents.ownerClientId,
        events: streamEvents.events
      });
      return true;
    }

    return false;
  }
}
