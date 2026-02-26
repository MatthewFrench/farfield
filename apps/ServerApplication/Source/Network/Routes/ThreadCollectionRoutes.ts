import type {
  AgentAdapter,
  AgentCreateThreadInput,
  AgentId,
  AgentListThreadsInput
} from "../../Agents/Types.js";
import { logger } from "../../Shared/Logging/Logger.js";
import {
  parseStartThreadBody,
  type StartThreadBody
} from "../RequestSchemas/HttpSchemas.js";
import type {
  ThreadListItemWithAgentId,
  ThreadListSortKey
} from "../ThreadListAggregationCache.js";
import {
  ThreadCollectionRouteMethodByName,
  ThreadCollectionRoutePathnameByName,
  type ThreadCollectionRouteDependencies
} from "./ThreadCollectionRouteContracts.js";
import { ThreadCollectionListQueryOwner } from "./ThreadCollectionListQueryOwner.js";

/**
 * Owns list/create route orchestration for `/api/threads`, including adapter fan-out,
 * cross-adapter merge/paging policy, and action/cache side effects.
 */
const ThreadCollectionRouteStatusCodeByName = {
  ok: 200,
  badRequest: 400,
  serverError: 500,
  serviceUnavailable: 503
} as const;

const ThreadCollectionRouteActionByName = {
  threadCreate: "thread-create"
} as const;

const ThreadCollectionRouteErrorByName = {
  invalidThreadListQuery: "Invalid thread list query parameters",
  invalidCursor: "Invalid cursor",
  noEnabledAgent: "No enabled agent is available."
} as const;

const ThreadCollectionRouteCacheInvalidationReasonByName = {
  threadCreated: "thread-created"
} as const;

const ThreadCollectionRouteLogEventByName = {
  agentListThreadsFailed: "agent-list-threads-failed",
  threadListAggregationCacheRead: "thread-list-aggregation-cache-read"
} as const;

const ThreadCollectionRouteDefaultSortKey: ThreadListSortKey = "updated_at";
const ThreadCollectionRouteListThreadsTimeoutLabelPrefix = "list-threads:";

const threadCollectionListQueryOwner = new ThreadCollectionListQueryOwner();

type ThreadCollectionRouteWithTimeout = <ValueType>(
  promise: Promise<ValueType>,
  timeoutMs: number,
  label: string
) => Promise<ValueType>;

type ThreadCollectionRouteThreadOwnershipRegistrar = (
  threadId: string,
  agentId: AgentId
) => void;

export type { ThreadCollectionRouteDependencies } from "./ThreadCollectionRouteContracts.js";

export async function handleThreadCollectionRoutes(
  deps: ThreadCollectionRouteDependencies
): Promise<boolean> {
  if (
    isThreadCollectionRouteRequest(
      deps.req.method,
      deps.pathname,
      ThreadCollectionRouteMethodByName.post
    )
  ) {
    await handleThreadCollectionCreateRoute(deps);
    return true;
  }

  if (
    isThreadCollectionRouteRequest(
      deps.req.method,
      deps.pathname,
      ThreadCollectionRouteMethodByName.get
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
  expectedMethod: string
): boolean {
  return (
    method === expectedMethod &&
    pathname === ThreadCollectionRoutePathnameByName.threads
  );
}

async function handleThreadCollectionCreateRoute(
  deps: ThreadCollectionRouteDependencies
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
    pushActionErrorWithRequestContext
  } = deps;

  const body = parseStartThreadBody(await readJsonBody(req));
  const adapter = resolveCreateThreadAdapter(body.agentId);
  if (!adapter) {
    jsonResponse(res, ThreadCollectionRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: buildUnavailableAgentMessage(body.agentId)
    });
    return;
  }

  pushActionEventWithRequestContext(
    ThreadCollectionRouteActionByName.threadCreate,
    "attempt",
    {
      agentId: adapter.id,
      cwd: body.cwd ?? null,
      model: body.model ?? null
    }
  );

  try {
    const createThreadInput = buildCreateThreadInput(
      body,
      adapter.id,
      defaultWorkspace
    );
    const result = await adapter.createThread(createThreadInput);
    registerThreadAdapterOwnership(result.threadId, adapter.id);

    invalidateThreadListAggregationCache(
      ThreadCollectionRouteCacheInvalidationReasonByName.threadCreated,
      {
        threadId: result.threadId,
        agentId: adapter.id
      }
    );

    pushActionEventWithRequestContext(
      ThreadCollectionRouteActionByName.threadCreate,
      "success",
      {
        agentId: adapter.id,
        threadId: result.threadId,
        cwd: result.cwd ?? result.thread.cwd ?? null
      }
    );

    jsonResponse(res, ThreadCollectionRouteStatusCodeByName.ok, {
      ok: true,
      ...result,
      threadId: result.threadId,
      agentId: adapter.id
    });
  } catch (error) {
    const message = pushActionErrorWithRequestContext(
      ThreadCollectionRouteActionByName.threadCreate,
      error,
      {
        agentId: adapter.id,
        cwd: body.cwd ?? null
      }
    );
    jsonResponse(res, ThreadCollectionRouteStatusCodeByName.serverError, {
      ok: false,
      error: message
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
  defaultWorkspace: string
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
    ...(typeof body.ephemeral === "boolean" ? { ephemeral: body.ephemeral } : {})
  };
}

async function handleThreadCollectionListRoute(
  deps: ThreadCollectionRouteDependencies
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
    withTimeout
  } = deps;

  const parsedThreadListQuery = threadCollectionListQueryOwner.parse(url);
  if (!parsedThreadListQuery.ok) {
    jsonResponse(res, ThreadCollectionRouteStatusCodeByName.badRequest, {
      ok: false,
      error: ThreadCollectionRouteErrorByName.invalidThreadListQuery,
      issues: parsedThreadListQuery.issues
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
    cwd: rawCwd
  } = parsedThreadListQuery.query;

  const decodedCursor = threadCollectionListQueryOwner.decodeCursor(cursor);
  if (!decodedCursor.ok) {
    jsonResponse(res, ThreadCollectionRouteStatusCodeByName.badRequest, {
      ok: false,
      error: ThreadCollectionRouteErrorByName.invalidCursor,
      issues: decodedCursor.issues
    });
    return;
  }

  const sortKey = requestedSortKey ?? ThreadCollectionRouteDefaultSortKey;
  const cwd = normalizeOptionalString(rawCwd);
  const enabledAdapterList = listEnabledAdapters();
  const adapterListThreadsInput = buildAdapterListThreadsInput({
    limit,
    archived,
    maxPages,
    sortKey,
    cwd
  });

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
    async () =>
      await loadThreadListSnapshot({
        enabledAdapterList,
        adapterListThreadsInput,
        listThreadsTimeoutMs,
        withTimeout,
        registerThreadAdapterOwnership,
        sortKey
      })
  );

  for (const thread of cacheReadResult.snapshot.mergedData) {
    registerThreadAdapterOwnership(thread.id, thread.agentId);
  }

  const cacheStatistics = threadListAggregationCache.readStatistics();
  logger.debug(
    {
      readState: cacheReadResult.readState,
      entryCount: cacheStatistics.entryCount,
      inFlightCount: cacheStatistics.inFlightCount
    },
    ThreadCollectionRouteLogEventByName.threadListAggregationCacheRead
  );

  const threadListPage = buildThreadListPage({
    mergedData: cacheReadResult.snapshot.mergedData,
    cursorOffset: decodedCursor.offset,
    limit,
    maxPages,
    all
  });

  jsonResponse(res, ThreadCollectionRouteStatusCodeByName.ok, {
    ok: true,
    data: threadListPage.pageData,
    nextCursor: threadListPage.nextCursor,
    pages: threadListPage.pages,
    truncated: cacheReadResult.snapshot.combinedTruncated || threadListPage.hasMoreData
  });
}

function buildAdapterListThreadsInput(input: {
  limit: number;
  archived: boolean;
  maxPages: number;
  sortKey: ThreadListSortKey;
  cwd: string | null;
}): AgentListThreadsInput {
  // The collection owner requests each adapter's full uncursored window and applies
  // cross-adapter paging after merge so ordering and cursors stay deterministic.
  return {
    limit: input.limit,
    archived: input.archived,
    all: true,
    maxPages: input.maxPages,
    cursor: null,
    sortKey: input.sortKey,
    cwd: input.cwd
  };
}

async function loadThreadListSnapshot(input: {
  enabledAdapterList: AgentAdapter[];
  adapterListThreadsInput: AgentListThreadsInput;
  listThreadsTimeoutMs: number;
  withTimeout: ThreadCollectionRouteWithTimeout;
  registerThreadAdapterOwnership: ThreadCollectionRouteThreadOwnershipRegistrar;
  sortKey: ThreadListSortKey;
}): Promise<{ mergedData: ThreadListItemWithAgentId[]; combinedTruncated: boolean }> {
  const mergedData: ThreadListItemWithAgentId[] = [];
  let combinedTruncated = false;

  const adapterResults = await Promise.all(
    input.enabledAdapterList.map(async (adapter) => {
      try {
        const boundedResult = await input.withTimeout(
          adapter.listThreads(input.adapterListThreadsInput),
          input.listThreadsTimeoutMs,
          buildListThreadsTimeoutLabel(adapter.id)
        );

        return {
          ok: true as const,
          adapter,
          result: boundedResult
        };
      } catch (error) {
        logger.warn(
          {
            agentId: adapter.id,
            error: toErrorMessage(error)
          },
          ThreadCollectionRouteLogEventByName.agentListThreadsFailed
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

    combinedTruncated = combinedTruncated || (adapterResult.result.truncated ?? false);
    for (const thread of adapterResult.result.data) {
      input.registerThreadAdapterOwnership(thread.id, adapterResult.adapter.id);
      mergedData.push({
        ...thread,
        agentId: adapterResult.adapter.id
      });
    }
  }

  mergedData.sort((left, right) =>
    threadCollectionListQueryOwner.compareThreadListItems(left, right, input.sortKey)
  );

  return {
    mergedData,
    combinedTruncated
  };
}

function buildListThreadsTimeoutLabel(agentId: AgentId): string {
  return `${ThreadCollectionRouteListThreadsTimeoutLabelPrefix}${agentId}`;
}

function buildThreadListPage(input: {
  mergedData: ThreadListItemWithAgentId[];
  cursorOffset: number;
  limit: number;
  maxPages: number;
  all: boolean;
}): {
  pageData: ThreadListItemWithAgentId[];
  nextCursor: string | null;
  pages: number;
  hasMoreData: boolean;
} {
  const pageSize = input.all ? input.limit * input.maxPages : input.limit;
  const pageData = input.mergedData.slice(input.cursorOffset, input.cursorOffset + pageSize);
  const nextOffset = input.cursorOffset + pageData.length;
  const hasMoreData = nextOffset < input.mergedData.length;
  const nextCursor = hasMoreData
    ? threadCollectionListQueryOwner.encodeCursor(nextOffset)
    : null;
  const pages = pageData.length === 0 ? 0 : Math.ceil(pageData.length / input.limit);

  return {
    pageData,
    nextCursor,
    pages,
    hasMoreData
  };
}

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}
