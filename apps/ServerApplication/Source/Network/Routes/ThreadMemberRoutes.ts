import type { IncomingMessage, ServerResponse } from "node:http";
import { JsonValueSchema, type JsonValue } from "@farfield/protocol";
import {
  InterruptBodySchema,
  parseBody,
  SendMessageBodySchema,
  SetModeBodySchema,
  SubmitUserInputBodySchema
} from "../../HttpSchemas.js";
import type { CodexAgentAdapter } from "../../Agents/Adapters/CodexAgent.js";
import type { AgentAdapter, AgentId } from "../../Agents/Types.js";
import type { ThreadConcurrencyCoordinator } from "../ThreadConcurrencyCoordinator.js";

type ResolvedThreadAdapterResult =
  | { ok: true; adapter: AgentAdapter; agentId: AgentId }
  | { ok: false; status: number; error: string };

export interface ThreadMemberRouteDependencies {
  req: IncomingMessage;
  res: ServerResponse;
  segments: string[];
  url: URL;
  codexAdapter: CodexAgentAdapter | null;
  parseInteger: (value: string | null, defaultValue: number) => number;
  parseBoolean: (value: string | null, defaultValue: boolean) => boolean;
  threadConcurrencyCoordinator: ThreadConcurrencyCoordinator;
  resolveAdapterForThread: (threadId: string) => ResolvedThreadAdapterResult;
  readJsonBody: (req: IncomingMessage) => Promise<JsonValue>;
  jsonResponse: (res: ServerResponse, statusCode: number, body: object) => void;
  invalidateThreadListAggregationCache: (reason: string, details?: Record<string, JsonValue>) => void;
  pushActionEventWithRequestContext: (
    action: string,
    stage: "attempt" | "success" | "error",
    details: Record<string, JsonValue>
  ) => void;
  pushActionErrorWithRequestContext: <ErrorType>(
    action: string,
    error: ErrorType,
    details: Record<string, JsonValue>
  ) => string;
}

export async function handleThreadMemberRoutes(
  deps: ThreadMemberRouteDependencies
): Promise<boolean> {
  const {
    req,
    res,
    segments,
    url,
    codexAdapter,
    parseInteger,
    parseBoolean,
    threadConcurrencyCoordinator,
    resolveAdapterForThread,
    readJsonBody,
    jsonResponse,
    invalidateThreadListAggregationCache,
    pushActionEventWithRequestContext,
    pushActionErrorWithRequestContext
  } = deps;

  if (!(segments[0] === "api" && segments[1] === "threads" && segments[2])) {
    return false;
  }

  const threadId = decodeURIComponent(segments[2]);
  const resolved = resolveAdapterForThread(threadId);
  if (!resolved.ok) {
    jsonResponse(res, resolved.status, {
      ok: false,
      error: resolved.error,
      threadId
    });
    return true;
  }

  const adapter = resolved.adapter;

  if (req.method === "GET" && segments.length === 3) {
    const includeTurns = parseBoolean(url.searchParams.get("includeTurns"), true);

    try {
      const result = await adapter.readThread({ threadId, includeTurns });
      jsonResponse(res, 200, {
        ok: true,
        ...result,
        agentId: resolved.agentId
      });
      return true;
    } catch (error) {
      if (
        resolved.agentId === "codex" &&
        codexAdapter &&
        error instanceof Error &&
        codexAdapter.isThreadNotLoadedError(error)
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
        error: `Agent ${resolved.agentId} does not support live thread state`,
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
        error: `Agent ${resolved.agentId} does not support stream events`,
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

  if (req.method === "POST" && segments[3] === "messages") {
    const body = parseBody(SendMessageBodySchema, await readJsonBody(req));

    pushActionEventWithRequestContext("messages", "attempt", {
      agentId: resolved.agentId,
      threadId,
      textLength: body.text.length
    });

    try {
      await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        await adapter.sendMessage({
          threadId,
          text: body.text,
          ...(body.ownerClientId ? { ownerClientId: body.ownerClientId } : {}),
          ...(body.cwd ? { cwd: body.cwd } : {}),
          ...(typeof body.isSteering === "boolean" ? { isSteering: body.isSteering } : {})
        });
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext("messages", error, {
        agentId: resolved.agentId,
        threadId
      });
      jsonResponse(res, 500, { ok: false, error: message, threadId });
      return true;
    }

    pushActionEventWithRequestContext("messages", "success", {
      agentId: resolved.agentId,
      threadId
    });
    invalidateThreadListAggregationCache("thread-message-sent", {
      threadId,
      agentId: resolved.agentId
    });

    jsonResponse(res, 200, {
      ok: true,
      threadId
    });
    return true;
  }

  if (req.method === "POST" && segments[3] === "archive") {
    const archiveThread = adapter.archiveThread;
    if (!archiveThread) {
      jsonResponse(res, 400, {
        ok: false,
        error: `Agent ${resolved.agentId} does not support thread archive`,
        threadId
      });
      return true;
    }

    pushActionEventWithRequestContext("thread-archive", "attempt", {
      agentId: resolved.agentId,
      threadId
    });

    try {
      await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        await archiveThread({ threadId });
      });
      pushActionEventWithRequestContext("thread-archive", "success", {
        agentId: resolved.agentId,
        threadId
      });
      invalidateThreadListAggregationCache("thread-archived", {
        threadId,
        agentId: resolved.agentId
      });
      jsonResponse(res, 200, {
        ok: true,
        threadId
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext("thread-archive", error, {
        agentId: resolved.agentId,
        threadId
      });
      jsonResponse(res, 500, {
        ok: false,
        error: message,
        threadId
      });
    }
    return true;
  }

  if (req.method === "POST" && segments[3] === "unarchive") {
    const unarchiveThread = adapter.unarchiveThread;
    if (!unarchiveThread) {
      jsonResponse(res, 400, {
        ok: false,
        error: `Agent ${resolved.agentId} does not support thread unarchive`,
        threadId
      });
      return true;
    }

    pushActionEventWithRequestContext("thread-unarchive", "attempt", {
      agentId: resolved.agentId,
      threadId
    });

    try {
      await threadConcurrencyCoordinator.runExclusive(threadId, async () => {
        await unarchiveThread({ threadId });
      });
      pushActionEventWithRequestContext("thread-unarchive", "success", {
        agentId: resolved.agentId,
        threadId
      });
      invalidateThreadListAggregationCache("thread-unarchived", {
        threadId,
        agentId: resolved.agentId
      });
      jsonResponse(res, 200, {
        ok: true,
        threadId
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext("thread-unarchive", error, {
        agentId: resolved.agentId,
        threadId
      });
      jsonResponse(res, 500, {
        ok: false,
        error: message,
        threadId
      });
    }
    return true;
  }

  if (req.method === "POST" && segments[3] === "collaboration-mode") {
    const setCollaborationMode = adapter.setCollaborationMode;
    if (!adapter.capabilities.canSetCollaborationMode || !setCollaborationMode) {
      jsonResponse(res, 400, {
        ok: false,
        error: `Agent ${resolved.agentId} does not support collaboration modes`,
        threadId
      });
      return true;
    }

    const body = parseBody(SetModeBodySchema, await readJsonBody(req));

    pushActionEventWithRequestContext("collaboration-mode", "attempt", {
      agentId: resolved.agentId,
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
        agentId: resolved.agentId,
        threadId,
        ownerClientId: result.ownerClientId
      });

      jsonResponse(res, 200, {
        ok: true,
        threadId,
        ownerClientId: result.ownerClientId
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext("collaboration-mode", error, {
        agentId: resolved.agentId,
        threadId
      });
      jsonResponse(res, 500, {
        ok: false,
        error: message,
        threadId
      });
    }
    return true;
  }

  if (req.method === "POST" && segments[3] === "user-input") {
    const submitUserInput = adapter.submitUserInput;
    if (!adapter.capabilities.canSubmitUserInput || !submitUserInput) {
      jsonResponse(res, 400, {
        ok: false,
        error: `Agent ${resolved.agentId} does not support user input submission`,
        threadId
      });
      return true;
    }

    const body = parseBody(SubmitUserInputBodySchema, await readJsonBody(req));

    pushActionEventWithRequestContext("user-input", "attempt", {
      agentId: resolved.agentId,
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
        agentId: resolved.agentId,
        threadId,
        ownerClientId: result.ownerClientId,
        requestId: result.requestId
      });
      invalidateThreadListAggregationCache("thread-user-input-submitted", {
        threadId,
        agentId: resolved.agentId,
        requestId: result.requestId
      });

      jsonResponse(res, 200, {
        ok: true,
        threadId,
        ownerClientId: result.ownerClientId,
        requestId: result.requestId
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext("user-input", error, {
        agentId: resolved.agentId,
        threadId,
        requestId: body.requestId
      });
      jsonResponse(res, 500, {
        ok: false,
        error: message,
        threadId,
        requestId: body.requestId
      });
    }
    return true;
  }

  if (req.method === "POST" && segments[3] === "interrupt") {
    const body = parseBody(InterruptBodySchema, await readJsonBody(req));

    pushActionEventWithRequestContext("interrupt", "attempt", {
      agentId: resolved.agentId,
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
        agentId: resolved.agentId,
        threadId
      });
      jsonResponse(res, 500, { ok: false, error: message, threadId });
      return true;
    }

    pushActionEventWithRequestContext("interrupt", "success", {
      agentId: resolved.agentId,
      threadId
    });
    invalidateThreadListAggregationCache("thread-interrupted", {
      threadId,
      agentId: resolved.agentId
    });

    jsonResponse(res, 200, {
      ok: true,
      threadId
    });
    return true;
  }

  return false;
}
