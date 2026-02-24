import { logger } from "../../Shared/Logging/Logger.js";
import { parseBody, StartThreadBodySchema } from "../RequestSchemas/HttpSchemas.js";
import type {
  ThreadListItemWithAgentId
} from "../ThreadListAggregationCache.js";
import type { ThreadCollectionRouteDependencies } from "./ThreadCollectionRouteContracts.js";
import { ThreadCollectionListQueryOwner } from "./ThreadCollectionListQueryOwner.js";

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

const threadCollectionListQueryOwner = new ThreadCollectionListQueryOwner();

export type { ThreadCollectionRouteDependencies } from "./ThreadCollectionRouteContracts.js";

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
    const parsedThreadListQuery = threadCollectionListQueryOwner.parse(url);
    if (!parsedThreadListQuery.ok) {
      jsonResponse(res, 400, {
        ok: false,
        error: "Invalid thread list query parameters",
        issues: parsedThreadListQuery.issues
      });
      return true;
    }

    const {
      limit,
      archived,
      all,
      maxPages,
      cursor,
      sortKey: requestedSortKey,
      cwd: rawCwd
    } = parsedThreadListQuery.query;

    let cursorOffset = 0;
    try {
      cursorOffset = threadCollectionListQueryOwner.decodeCursor(cursor);
    } catch {
      jsonResponse(res, 400, {
        ok: false,
        error: "Invalid cursor"
      });
      return true;
    }
    const sortKey = requestedSortKey ?? "updated_at";
    const cwd = normalizeOptionalString(rawCwd);

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

        mergedData.sort((left, right) => threadCollectionListQueryOwner.compareThreadListItems(left, right, sortKey));
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
    const nextCursor = hasMoreData ? threadCollectionListQueryOwner.encodeCursor(nextOffset) : null;
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
