import { z } from "zod";
import {
  isThreadMemberSubresourceRoute,
  type ThreadMemberResolvedRouteContext,
  type ThreadMemberRouteDependencies,
  ThreadMemberRouteMethodByName,
  ThreadMemberRouteSegmentByName,
  ThreadMemberRouteSegmentCountByName,
} from "./ThreadMemberRouteContracts.js";

export interface ThreadMemberReadRouteOwnerOptions {
  dependencies: ThreadMemberRouteDependencies;
  context: ThreadMemberResolvedRouteContext;
}

const ThreadMemberReadRouteStatusCodeByName = {
  success: 200,
  badRequest: 400,
  notFound: 404,
} as const;

const ThreadMemberReadRouteQueryParameterByName = {
  includeTurns: "includeTurns",
  limit: "limit",
  sinceSequence: "sinceSequence",
} as const;

const ThreadMemberReadRouteErrorByName = {
  invalidStreamEventQueryParameters: "Invalid stream event query parameters",
} as const;

const ThreadMemberReadRouteConversationNotFoundPattern = /conversation not found/i;

const ThreadMemberReadRouteUnsupportedCapabilityName = {
  liveThreadState: "live thread state",
  streamEvents: "stream events",
} as const;

export class ThreadMemberReadRouteOwner {
  private readonly dependencies: ThreadMemberRouteDependencies;
  private readonly context: ThreadMemberResolvedRouteContext;

  public constructor(options: ThreadMemberReadRouteOwnerOptions) {
    this.dependencies = options.dependencies;
    this.context = options.context;
  }

  public async handle(): Promise<boolean> {
    const { req, res, segments, url, parseBoolean, jsonResponse } = this.dependencies;
    const { adapter, agentId, threadId } = this.context;

    if (
      req.method === ThreadMemberRouteMethodByName.get &&
      segments.length === ThreadMemberRouteSegmentCountByName.threadRead
    ) {
      const includeTurns = parseBoolean(
        url.searchParams.get(ThreadMemberReadRouteQueryParameterByName.includeTurns),
        true,
      );

      try {
        const result = await adapter.readThread({ threadId, includeTurns });
        this.dependencies.clearThreadUnreadableForListFiltering(threadId);
        jsonResponse(res, ThreadMemberReadRouteStatusCodeByName.success, {
          ok: true,
          ...result,
          agentId,
        });
        return true;
      } catch (error) {
        if (error instanceof Error && this.tryWriteMissingThreadResponse(error)) {
          return true;
        }
        throw error;
      }
    }

    if (
      req.method === ThreadMemberRouteMethodByName.get &&
      isThreadMemberSubresourceRoute(segments, ThreadMemberRouteSegmentByName.liveState)
    ) {
      if (!adapter.capabilities.canReadLiveState || !adapter.readLiveState) {
        return this.writeUnsupportedCapabilityResponse(
          ThreadMemberReadRouteUnsupportedCapabilityName.liveThreadState,
        );
      }

      try {
        const liveState = await adapter.readLiveState(threadId);
        this.dependencies.clearThreadUnreadableForListFiltering(threadId);
        jsonResponse(res, ThreadMemberReadRouteStatusCodeByName.success, {
          ok: true,
          threadId,
          ownerClientId: liveState.ownerClientId,
          conversationState: liveState.conversationState,
          liveStateError: liveState.liveStateError,
        });
        return true;
      } catch (error) {
        if (error instanceof Error && this.tryWriteMissingThreadResponse(error)) {
          return true;
        }
        throw error;
      }
    }

    if (
      req.method === ThreadMemberRouteMethodByName.get &&
      isThreadMemberSubresourceRoute(segments, ThreadMemberRouteSegmentByName.streamEvents)
    ) {
      if (!adapter.capabilities.canReadStreamEvents || !adapter.readStreamEvents) {
        return this.writeUnsupportedCapabilityResponse(
          ThreadMemberReadRouteUnsupportedCapabilityName.streamEvents,
        );
      }

      const parsedStreamEventsQuery = parseStreamEventsQuery(url.searchParams);
      if (!parsedStreamEventsQuery.success) {
        jsonResponse(res, ThreadMemberReadRouteStatusCodeByName.badRequest, {
          ok: false,
          error: ThreadMemberReadRouteErrorByName.invalidStreamEventQueryParameters,
          details: parsedStreamEventsQuery.error.issues,
        });
        return true;
      }

      try {
        const streamEvents = await adapter.readStreamEvents(threadId, parsedStreamEventsQuery.data);
        this.dependencies.clearThreadUnreadableForListFiltering(threadId);
        jsonResponse(res, ThreadMemberReadRouteStatusCodeByName.success, {
          ok: true,
          threadId,
          ownerClientId: streamEvents.ownerClientId,
          events: streamEvents.events,
          nextSequence: streamEvents.nextSequence,
          firstAvailableSequence: streamEvents.firstAvailableSequence,
          resetRequired: streamEvents.resetRequired,
        });
        return true;
      } catch (error) {
        if (error instanceof Error && this.tryWriteMissingThreadResponse(error)) {
          return true;
        }
        throw error;
      }
    }

    return false;
  }

  private tryWriteMissingThreadResponse(error: Error): boolean {
    if (!this.isMissingThreadError(error)) {
      return false;
    }
    const { res, jsonResponse, invalidateThreadListAggregationCache } = this.dependencies;
    const { threadId } = this.context;
    this.dependencies.markThreadUnreadableForListFiltering(threadId);
    invalidateThreadListAggregationCache("thread-missing-read", {
      threadId,
    });
    jsonResponse(res, ThreadMemberReadRouteStatusCodeByName.notFound, {
      ok: false,
      error: `Thread not loaded in app-server: ${threadId}`,
      threadId,
    });
    return true;
  }

  // Keep missing-thread normalization centralized so read/live/stream contracts stay aligned.
  private isMissingThreadError(error: Error): boolean {
    return this.isThreadNotLoadedError(error) || this.isConversationNotFoundError(error);
  }

  private isThreadNotLoadedError(error: Error): boolean {
    const classifyThreadNotLoadedError = this.context.adapter.isThreadNotLoadedError;
    if (!classifyThreadNotLoadedError) {
      return false;
    }
    return classifyThreadNotLoadedError(error);
  }

  private isConversationNotFoundError(error: Error): boolean {
    const classifyConversationNotFoundError = this.context.adapter.isConversationNotFoundError;
    if (classifyConversationNotFoundError) {
      return classifyConversationNotFoundError(error);
    }
    return ThreadMemberReadRouteConversationNotFoundPattern.test(error.message);
  }

  private writeUnsupportedCapabilityResponse(capability: string): boolean {
    const { res, jsonResponse } = this.dependencies;
    const { agentId, threadId } = this.context;
    jsonResponse(res, ThreadMemberReadRouteStatusCodeByName.badRequest, {
      ok: false,
      error: `Agent ${agentId} does not support ${capability}`,
      threadId,
    });
    return true;
  }
}

interface StreamEventsQueryInput {
  limit: string | undefined;
  sinceSequence: string | undefined;
}

const STREAM_EVENT_QUERY_LIMIT_MAXIMUM = 400;
const STREAM_EVENT_QUERY_LIMIT_DEFAULT = 60;

// Cursor query parsing is schema-owned so stream synchronization cannot drift between routes and clients.
const StreamEventsQuerySchema = z
  .object({
    limit: z.preprocess(
      (value) => (value === undefined ? STREAM_EVENT_QUERY_LIMIT_DEFAULT : value),
      z.coerce.number().int().positive().max(STREAM_EVENT_QUERY_LIMIT_MAXIMUM),
    ),
    sinceSequence: z.preprocess(
      (value) => (value === undefined ? null : value),
      z.union([z.null(), z.coerce.number().int().nonnegative()]),
    ),
  })
  .strict();

function parseStreamEventsQuery(searchParameters: URLSearchParams) {
  const query: StreamEventsQueryInput = {
    limit: searchParameters.get(ThreadMemberReadRouteQueryParameterByName.limit) ?? undefined,
    sinceSequence:
      searchParameters.get(ThreadMemberReadRouteQueryParameterByName.sinceSequence) ?? undefined,
  };
  return StreamEventsQuerySchema.safeParse(query);
}
