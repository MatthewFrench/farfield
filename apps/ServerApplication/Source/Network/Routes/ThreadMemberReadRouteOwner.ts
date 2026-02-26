import { z } from "zod";
import {
  isThreadMemberSubresourceRoute,
  ThreadMemberRouteSegmentCountByName,
  ThreadMemberRouteMethodByName,
  ThreadMemberRouteSegmentByName,
  type ThreadMemberRouteDependencies,
  type ThreadMemberResolvedRouteContext
} from "./ThreadMemberRouteContracts.js";

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
    const { req, res, segments, url, codexAdapter, parseBoolean, jsonResponse } = this.dependencies;
    const { adapter, agentId, threadId } = this.context;

    if (
      req.method === ThreadMemberRouteMethodByName.get
      && segments.length === ThreadMemberRouteSegmentCountByName.threadRead
    ) {
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

    if (
      req.method === ThreadMemberRouteMethodByName.get
      && isThreadMemberSubresourceRoute(segments, ThreadMemberRouteSegmentByName.liveState)
    ) {
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

    if (
      req.method === ThreadMemberRouteMethodByName.get
      && isThreadMemberSubresourceRoute(segments, ThreadMemberRouteSegmentByName.streamEvents)
    ) {
      if (!adapter.capabilities.canReadStreamEvents || !adapter.readStreamEvents) {
        jsonResponse(res, 400, {
          ok: false,
          error: `Agent ${agentId} does not support stream events`,
          threadId
        });
        return true;
      }

      const parsedStreamEventsQuery = StreamEventsQuerySchema.safeParse({
        limit: url.searchParams.get("limit") ?? undefined,
        sinceSequence: url.searchParams.get("sinceSequence") ?? undefined
      });
      if (!parsedStreamEventsQuery.success) {
        jsonResponse(res, 400, {
          ok: false,
          error: "Invalid stream event query parameters",
          details: parsedStreamEventsQuery.error.issues
        });
        return true;
      }

      const streamEvents = await adapter.readStreamEvents(threadId, parsedStreamEventsQuery.data);
      jsonResponse(res, 200, {
        ok: true,
        threadId,
        ownerClientId: streamEvents.ownerClientId,
        events: streamEvents.events,
        nextSequence: streamEvents.nextSequence,
        firstAvailableSequence: streamEvents.firstAvailableSequence,
        resetRequired: streamEvents.resetRequired
      });
      return true;
    }

    return false;
  }
}

const STREAM_EVENT_QUERY_LIMIT_MAXIMUM = 400;

// Cursor query parsing is schema-owned so stream synchronization cannot drift between routes and clients.
const StreamEventsQuerySchema = z
  .object({
    limit: z.preprocess(
      (value) => value === undefined ? 60 : value,
      z.coerce.number().int().positive().max(STREAM_EVENT_QUERY_LIMIT_MAXIMUM)
    ),
    sinceSequence: z.preprocess(
      (value) => value === undefined ? null : value,
      z.union([z.null(), z.coerce.number().int().nonnegative()])
    )
  })
  .strict();
