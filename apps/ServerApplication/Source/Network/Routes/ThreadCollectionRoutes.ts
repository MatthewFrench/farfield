import type { AgentCreateThreadInput, AgentId } from "../../Agents/Types.js";
import { logger } from "../../Shared/Logging/Logger.js";
import { parseStartThreadBody, type StartThreadBody } from "../RequestSchemas/HttpSchemas.js";
import type { ThreadListSortKey } from "../ThreadListAggregationCache.js";
import { ThreadCollectionListQueryOwner } from "./ThreadCollectionListQueryOwner.js";
import {
  type ThreadCollectionRouteDependencies,
  ThreadCollectionRouteMethodByName,
  ThreadCollectionRoutePathnameByName,
} from "./ThreadCollectionRouteContracts.js";
import {
  buildAggregationAdapterListThreadsInput,
  loadThreadListAggregationSnapshot,
} from "./ThreadListAggregationSnapshotLoader.js";
import {
  buildThreadListPageProjection,
  readThreadListDeltaPageData,
  readThreadListSnapshotUpdatedAt,
  readThreadListSnapshotVersion,
} from "./ThreadListPageProjection.js";

/**
 * Owns list/create route orchestration for `/api/threads`, including adapter fan-out,
 * cross-adapter merge/paging policy, and action/cache side effects.
 */
const ThreadCollectionRouteStatusCodeByName = {
  ok: 200,
  badRequest: 400,
  serverError: 500,
  serviceUnavailable: 503,
} as const;

const ThreadCollectionRouteActionByName = {
  threadCreate: "thread-create",
} as const;

const ThreadCollectionRouteErrorByName = {
  invalidThreadListQuery: "Invalid thread list query parameters",
  invalidCursor: "Invalid cursor",
  noEnabledAgent: "No enabled agent is available.",
} as const;

const ThreadCollectionRouteCacheInvalidationReasonByName = {
  threadCreated: "thread-created",
} as const;

const ThreadCollectionRouteLogEventByName = {
  threadListAggregationCacheRead: "thread-list-aggregation-cache-read",
} as const;

const ThreadCollectionRouteDefaultSortKey: ThreadListSortKey = "updated_at";
const ThreadListResponseSyncModeByName = {
  full: "full",
  delta: "delta",
} as const;
const threadCollectionListQueryOwner = new ThreadCollectionListQueryOwner();

export type { ThreadCollectionRouteDependencies } from "./ThreadCollectionRouteContracts.js";

export async function handleThreadCollectionRoutes(
  deps: ThreadCollectionRouteDependencies,
): Promise<boolean> {
  if (
    isThreadCollectionRouteRequest(
      deps.req.method,
      deps.pathname,
      ThreadCollectionRouteMethodByName.post,
    )
  ) {
    await handleThreadCollectionCreateRoute(deps);
    return true;
  }

  if (
    isThreadCollectionRouteRequest(
      deps.req.method,
      deps.pathname,
      ThreadCollectionRouteMethodByName.get,
    )
  ) {
    await handleThreadCollectionListRoute(deps);
    return true;
  }

  return false;
}

function isThreadCollectionRouteRequest(
  method: string | undefined,
  pathname: string,
  expectedMethod: string,
): boolean {
  return method === expectedMethod && pathname === ThreadCollectionRoutePathnameByName.threads;
}

async function handleThreadCollectionCreateRoute(
  deps: ThreadCollectionRouteDependencies,
): Promise<void> {
  const {
    req,
    res,
    defaultWorkspace,
    resolveCreateThreadAdapter,
    readJsonBody,
    jsonResponse,
    registerThreadAdapterOwnership,
    invalidateThreadListAggregationCache,
    pushActionEventWithRequestContext,
    pushActionErrorWithRequestContext,
  } = deps;

  const body = parseStartThreadBody(await readJsonBody(req));
  const adapter = resolveCreateThreadAdapter(body.agentId);
  if (!adapter) {
    jsonResponse(res, ThreadCollectionRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: buildUnavailableAgentMessage(body.agentId),
    });
    return;
  }

  pushActionEventWithRequestContext(ThreadCollectionRouteActionByName.threadCreate, "attempt", {
    agentId: adapter.id,
    cwd: body.cwd ?? null,
    model: body.model ?? null,
  });

  try {
    const createThreadInput = buildCreateThreadInput(body, adapter.id, defaultWorkspace);
    const result = await adapter.createThread(createThreadInput);
    registerThreadAdapterOwnership(result.threadId, adapter.id);

    invalidateThreadListAggregationCache(
      ThreadCollectionRouteCacheInvalidationReasonByName.threadCreated,
      {
        threadId: result.threadId,
        agentId: adapter.id,
      },
    );

    pushActionEventWithRequestContext(ThreadCollectionRouteActionByName.threadCreate, "success", {
      agentId: adapter.id,
      threadId: result.threadId,
      cwd: result.cwd ?? result.thread.cwd ?? null,
    });

    jsonResponse(res, ThreadCollectionRouteStatusCodeByName.ok, {
      ok: true,
      ...result,
      threadId: result.threadId,
      agentId: adapter.id,
    });
  } catch (error) {
    const message = pushActionErrorWithRequestContext(
      ThreadCollectionRouteActionByName.threadCreate,
      error,
      {
        agentId: adapter.id,
        cwd: body.cwd ?? null,
      },
    );
    jsonResponse(res, ThreadCollectionRouteStatusCodeByName.serverError, {
      ok: false,
      error: message,
    });
  }
}

function buildUnavailableAgentMessage(requestedAgentId: AgentId | undefined): string {
  if (requestedAgentId !== undefined) {
    return `Requested agent ${requestedAgentId} is not enabled.`;
  }
  return ThreadCollectionRouteErrorByName.noEnabledAgent;
}

function buildCreateThreadInput(
  body: StartThreadBody,
  adapterId: AgentId,
  defaultWorkspace: string,
): AgentCreateThreadInput {
  // Codex thread creation requires a working directory; when callers omit cwd,
  // the route injects the default workspace so adapter ownership stays deterministic.
  const requestedCwd = body.cwd;
  return {
    ...(requestedCwd !== undefined
      ? { cwd: requestedCwd }
      : adapterId === "codex"
        ? { cwd: defaultWorkspace }
        : {}),
    ...(body.model !== undefined ? { model: body.model } : {}),
    ...(body.modelProvider !== undefined ? { modelProvider: body.modelProvider } : {}),
    ...(body.personality !== undefined ? { personality: body.personality } : {}),
    ...(body.sandbox !== undefined ? { sandbox: body.sandbox } : {}),
    ...(body.approvalPolicy !== undefined ? { approvalPolicy: body.approvalPolicy } : {}),
    ...(typeof body.ephemeral === "boolean" ? { ephemeral: body.ephemeral } : {}),
  };
}

async function handleThreadCollectionListRoute(
  deps: ThreadCollectionRouteDependencies,
): Promise<void> {
  const {
    res,
    url,
    normalizeOptionalString,
    threadListAggregationCache,
    listEnabledAdapters,
    listThreadsTimeoutMs,
    registerThreadAdapterOwnership,
    jsonResponse,
    withTimeout,
  } = deps;

  const parsedThreadListQuery = threadCollectionListQueryOwner.parse(url);
  if (!parsedThreadListQuery.ok) {
    jsonResponse(res, ThreadCollectionRouteStatusCodeByName.badRequest, {
      ok: false,
      error: ThreadCollectionRouteErrorByName.invalidThreadListQuery,
      issues: parsedThreadListQuery.issues,
    });
    return;
  }

  const {
    limit,
    archived,
    all,
    maxPages,
    cursor,
    sortKey: requestedSortKey,
    cwd: rawCwd,
    sinceUpdatedAt,
  } = parsedThreadListQuery.query;

  const decodedCursor = threadCollectionListQueryOwner.decodeCursor(cursor);
  if (!decodedCursor.ok) {
    jsonResponse(res, ThreadCollectionRouteStatusCodeByName.badRequest, {
      ok: false,
      error: ThreadCollectionRouteErrorByName.invalidCursor,
      issues: decodedCursor.issues,
    });
    return;
  }

  const sortKey = requestedSortKey ?? ThreadCollectionRouteDefaultSortKey;
  if (sinceUpdatedAt !== null && sortKey !== "updated_at") {
    jsonResponse(res, ThreadCollectionRouteStatusCodeByName.badRequest, {
      ok: false,
      error: ThreadCollectionRouteErrorByName.invalidThreadListQuery,
      issues: [
        {
          path: "sinceUpdatedAt",
          message: "sinceUpdatedAt requires sortKey=updated_at",
        },
      ],
    });
    return;
  }
  const cwd = normalizeOptionalString(rawCwd);
  const enabledAdapterList = listEnabledAdapters();
  const adapterListThreadsInput = buildAggregationAdapterListThreadsInput({
    limit,
    archived,
    maxPages,
    sortKey,
    cwd,
  });

  const cacheReadResult = await threadListAggregationCache.readFreshOrLoad(
    {
      enabledAgentIds: enabledAdapterList.map((adapter) => adapter.id),
      limit,
      archived,
      all,
      maxPages,
      sortKey,
      cwd,
    },
    async () =>
      await loadThreadListAggregationSnapshot({
        enabledAdapterList,
        adapterListThreadsInput,
        listThreadsTimeoutMs,
        withTimeout,
        registerThreadAdapterOwnership,
        shouldIncludeThreadInList: deps.shouldIncludeThreadInList,
        sortItems: (left, right) =>
          threadCollectionListQueryOwner.compareThreadListItems(left, right, sortKey),
      }),
  );

  for (const thread of cacheReadResult.snapshot.mergedData) {
    registerThreadAdapterOwnership(thread.id, thread.agentId);
  }

  const cacheStatistics = threadListAggregationCache.readStatistics();
  logger.debug(
    {
      readState: cacheReadResult.readState,
      entryCount: cacheStatistics.entryCount,
      inFlightCount: cacheStatistics.inFlightCount,
    },
    ThreadCollectionRouteLogEventByName.threadListAggregationCacheRead,
  );

  const threadListPage = buildThreadListPageProjection({
    mergedData: cacheReadResult.snapshot.mergedData,
    cursorOffset: decodedCursor.offset,
    limit,
    maxPages,
    all,
    encodeCursor: (offset) => threadCollectionListQueryOwner.encodeCursor(offset),
  });
  const snapshotUpdatedAt = readThreadListSnapshotUpdatedAt(threadListPage.pageData);
  const truncated = cacheReadResult.snapshot.combinedTruncated || threadListPage.hasMoreData;
  const snapshotVersion = readThreadListSnapshotVersion({
    pageData: threadListPage.pageData,
    nextCursor: threadListPage.nextCursor,
    pages: threadListPage.pages,
    truncated,
  });
  const responseData =
    sinceUpdatedAt === null
      ? threadListPage.pageData
      : readThreadListDeltaPageData(threadListPage.pageData, sinceUpdatedAt);

  jsonResponse(res, ThreadCollectionRouteStatusCodeByName.ok, {
    ok: true,
    data: responseData,
    nextCursor: threadListPage.nextCursor,
    pages: threadListPage.pages,
    truncated,
    orderedThreadIds:
      sinceUpdatedAt === null ? undefined : threadListPage.pageData.map((thread) => thread.id),
    sync: {
      mode:
        sinceUpdatedAt === null
          ? ThreadListResponseSyncModeByName.full
          : ThreadListResponseSyncModeByName.delta,
      sinceUpdatedAt,
      snapshotUpdatedAt,
      snapshotVersion,
    },
  });
}
