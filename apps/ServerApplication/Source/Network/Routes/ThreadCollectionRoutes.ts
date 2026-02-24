import type { IncomingMessage, ServerResponse } from "node:http";
import type { JsonValue } from "@farfield/protocol";
import { z } from "zod";
import { logger } from "../../Logger.js";
import { parseBody, StartThreadBodySchema } from "../../HttpSchemas.js";
import type { AgentAdapter, AgentId } from "../../Agents/Types.js";
import type {
  ThreadListAggregationCache,
  ThreadListItemWithAgentId,
  ThreadListSortKey
} from "../ThreadListAggregationCache.js";

const ThreadSortKeyParamSchema = z.enum(["created_at", "updated_at"]);
const ThreadListCursorSchema = z
  .object({
    version: z.literal(1),
    offset: z.number().int().nonnegative()
  })
  .strict();

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

function parseThreadSortKey(value: string | null): ThreadListSortKey | null {
  if (!value) {
    return null;
  }
  const parsed = ThreadSortKeyParamSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function encodeThreadListCursor(offset: number): string {
  return Buffer.from(
    JSON.stringify({
      version: 1,
      offset
    }),
    "utf8"
  ).toString("base64url");
}

function decodeThreadListCursor(cursor: string | null): number {
  if (!cursor) {
    return 0;
  }

  const decodedCursorPayload = Buffer.from(cursor, "base64url").toString("utf8");
  const parsedCursor = ThreadListCursorSchema.parse(JSON.parse(decodedCursorPayload));
  return parsedCursor.offset;
}

function compareThreadListItems(
  left: ThreadListItemWithAgentId,
  right: ThreadListItemWithAgentId,
  sortKey: ThreadListSortKey
): number {
  const leftSortValue = sortKey === "created_at" ? left.createdAt : left.updatedAt;
  const rightSortValue = sortKey === "created_at" ? right.createdAt : right.updatedAt;

  if (leftSortValue !== rightSortValue) {
    return rightSortValue - leftSortValue;
  }

  if (left.updatedAt !== right.updatedAt) {
    return right.updatedAt - left.updatedAt;
  }

  if (left.createdAt !== right.createdAt) {
    return right.createdAt - left.createdAt;
  }

  const previewCompare = left.preview.localeCompare(right.preview);
  if (previewCompare !== 0) {
    return previewCompare;
  }

  return left.id.localeCompare(right.id);
}

export interface ThreadCollectionRouteDependencies {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  url: URL;
  defaultWorkspace: string;
  threadListAggregationCache: ThreadListAggregationCache;
  listEnabledAdapters: () => AgentAdapter[];
  registerThreadAdapterOwnership: (threadId: string, agentId: AgentId) => void;
  parseInteger: (value: string | null, defaultValue: number) => number;
  parseBoolean: (value: string | null, defaultValue: boolean) => boolean;
  normalizeOptionalString: (value: string | null) => string | null;
  resolveCreateThreadAdapter: (requestedAgentId: AgentId | undefined) => AgentAdapter | null;
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

export async function handleThreadCollectionRoutes(
  deps: ThreadCollectionRouteDependencies
): Promise<boolean> {
  const {
    req,
    res,
    pathname,
    url,
    defaultWorkspace,
    threadListAggregationCache,
    listEnabledAdapters,
    registerThreadAdapterOwnership,
    parseInteger,
    parseBoolean,
    normalizeOptionalString,
    resolveCreateThreadAdapter,
    readJsonBody,
    jsonResponse,
    invalidateThreadListAggregationCache,
    pushActionEventWithRequestContext,
    pushActionErrorWithRequestContext
  } = deps;

  if (req.method === "POST" && pathname === "/api/threads") {
    const body = parseBody(StartThreadBodySchema, await readJsonBody(req));
    const adapter = resolveCreateThreadAdapter(body.agentId);

    if (!adapter) {
      jsonResponse(res, 503, {
        ok: false,
        error: body.agentId
          ? `Requested agent ${body.agentId} is not enabled.`
          : "No enabled agent is available."
      });
      return true;
    }

    pushActionEventWithRequestContext("thread-create", "attempt", {
      agentId: adapter.id,
      cwd: body.cwd ?? null,
      model: body.model ?? null
    });

    try {
      const createInput = {
        ...(body.cwd
          ? { cwd: body.cwd }
          : adapter.id === "codex"
            ? { cwd: defaultWorkspace }
            : {}),
        ...(body.model ? { model: body.model } : {}),
        ...(body.modelProvider ? { modelProvider: body.modelProvider } : {}),
        ...(body.personality ? { personality: body.personality } : {}),
        ...(body.sandbox ? { sandbox: body.sandbox } : {}),
        ...(body.approvalPolicy ? { approvalPolicy: body.approvalPolicy } : {}),
        ...(typeof body.ephemeral === "boolean" ? { ephemeral: body.ephemeral } : {})
      };
      const result = await adapter.createThread(createInput);
      registerThreadAdapterOwnership(result.threadId, adapter.id);

      invalidateThreadListAggregationCache("thread-created", {
        threadId: result.threadId,
        agentId: adapter.id
      });

      pushActionEventWithRequestContext("thread-create", "success", {
        agentId: adapter.id,
        threadId: result.threadId,
        cwd: result.cwd ?? result.thread.cwd ?? null
      });

      jsonResponse(res, 200, {
        ok: true,
        ...result,
        threadId: result.threadId,
        agentId: adapter.id
      });
    } catch (error) {
      const message = pushActionErrorWithRequestContext("thread-create", error, {
        agentId: adapter.id,
        cwd: body.cwd ?? null
      });
      jsonResponse(res, 500, { ok: false, error: message });
    }
    return true;
  }

  if (req.method === "GET" && pathname === "/api/threads") {
    const limit = parseInteger(url.searchParams.get("limit"), 80);
    const archived = parseBoolean(url.searchParams.get("archived"), false);
    const all = parseBoolean(url.searchParams.get("all"), false);
    const maxPages = parseInteger(url.searchParams.get("maxPages"), 20);
    const cursor = url.searchParams.get("cursor") ?? null;
    let cursorOffset = 0;
    try {
      cursorOffset = decodeThreadListCursor(cursor);
    } catch {
      jsonResponse(res, 400, {
        ok: false,
        error: "Invalid cursor"
      });
      return true;
    }

    const requestedSortKey = url.searchParams.get("sortKey");
    const parsedSortKey = parseThreadSortKey(requestedSortKey);
    if (requestedSortKey && !parsedSortKey) {
      jsonResponse(res, 400, {
        ok: false,
        error: `Invalid sortKey: ${requestedSortKey}`
      });
      return true;
    }
    const sortKey: ThreadListSortKey = parsedSortKey ?? "updated_at";
    const cwd = normalizeOptionalString(url.searchParams.get("cwd"));

    const enabledAdapterList = listEnabledAdapters();

    const cacheReadResult = await threadListAggregationCache.readFreshOrLoad(
      {
        enabledAgentIds: enabledAdapterList.map((adapter) => adapter.id),
        limit,
        archived,
        all,
        maxPages,
        sortKey,
        cwd
      },
      async () => {
        const mergedData: ThreadListItemWithAgentId[] = [];
        let combinedTruncated = false;

        const adapterResults = await Promise.all(
          enabledAdapterList.map(async (adapter) => {
            try {
              const result = await adapter.listThreads({
                limit,
                archived,
                all: true,
                maxPages,
                cursor: null,
                sortKey,
                cwd
              });

              return {
                ok: true as const,
                adapter,
                result
              };
            } catch (error) {
              logger.warn(
                {
                  agentId: adapter.id,
                  error: toErrorMessage(error)
                },
                "agent-list-threads-failed"
              );
              return {
                ok: false as const,
                adapter
              };
            }
          })
        );

        for (const adapterResult of adapterResults) {
          if (!adapterResult.ok) {
            continue;
          }

          if (typeof adapterResult.result.truncated === "boolean") {
            combinedTruncated = combinedTruncated || adapterResult.result.truncated;
          }

          for (const thread of adapterResult.result.data) {
            registerThreadAdapterOwnership(thread.id, adapterResult.adapter.id);
            mergedData.push({
              ...thread,
              agentId: adapterResult.adapter.id
            });
          }
        }

        mergedData.sort((left, right) => compareThreadListItems(left, right, sortKey));
        return {
          mergedData,
          combinedTruncated
        };
      }
    );

    const mergedData = cacheReadResult.snapshot.mergedData;
    for (const thread of mergedData) {
      registerThreadAdapterOwnership(thread.id, thread.agentId);
    }
    const combinedTruncated = cacheReadResult.snapshot.combinedTruncated;
    const cacheStatistics = threadListAggregationCache.readStatistics();
    logger.debug(
      {
        readState: cacheReadResult.readState,
        entryCount: cacheStatistics.entryCount,
        inFlightCount: cacheStatistics.inFlightCount
      },
      "thread-list-aggregation-cache-read"
    );

    const pageSize = all ? limit * maxPages : limit;
    const pageData = mergedData.slice(cursorOffset, cursorOffset + pageSize);
    const nextOffset = cursorOffset + pageData.length;
    const hasMoreData = nextOffset < mergedData.length;
    const nextCursor = hasMoreData ? encodeThreadListCursor(nextOffset) : null;
    const pages = pageData.length === 0 ? 0 : Math.ceil(pageData.length / limit);

    jsonResponse(res, 200, {
      ok: true,
      data: pageData,
      nextCursor,
      pages,
      truncated: combinedTruncated || hasMoreData
    });
    return true;
  }

  return false;
}
