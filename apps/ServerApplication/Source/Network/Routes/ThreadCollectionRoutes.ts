import { z } from "zod";
import type {
  AgentAdapter,
  AgentCreateThreadInput,
  AgentId,
  AgentListLoadedThreadsResult,
  AgentListThreadsInput,
} from "../../Agents/Types.js";
import { logger } from "../../Shared/Logging/Logger.js";
import { parseStartThreadBody, type StartThreadBody } from "../RequestSchemas/HttpSchemas.js";
import type {
  ThreadListItemWithAgentId,
  ThreadListSortKey,
} from "../ThreadListAggregationCache.js";
import { ThreadCollectionListQueryOwner } from "./ThreadCollectionListQueryOwner.js";
import {
  type ThreadCollectionRouteDependencies,
  ThreadCollectionRouteMethodByName,
  ThreadCollectionRoutePathnameByName,
} from "./ThreadCollectionRouteContracts.js";

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
  agentListThreadsFailed: "agent-list-threads-failed",
  agentListLoadedThreadsFailed: "agent-list-loaded-threads-failed",
  threadListAggregationCacheRead: "thread-list-aggregation-cache-read",
} as const;
const OptionalThreadNameSourceSchema = z.union([z.string(), z.null(), z.undefined()]);
const ThreadNamePayloadSchema = z
  .object({
    preview: z.string(),
    threadName: OptionalThreadNameSourceSchema,
    title: OptionalThreadNameSourceSchema,
    name: OptionalThreadNameSourceSchema,
  })
  .passthrough();

const ThreadCollectionRouteDefaultSortKey: ThreadListSortKey = "updated_at";
const ThreadCollectionRouteListThreadsTimeoutLabelPrefix = "list-threads:";
const ThreadCollectionRouteListLoadedThreadsTimeoutLabelPrefix = "list-loaded-threads:";
const ThreadListResponseSyncModeByName = {
  full: "full",
  delta: "delta",
} as const;
const THREAD_LIST_RESPONSE_SNAPSHOT_UPDATED_AT_EMPTY_VALUE = 0;

const threadCollectionListQueryOwner = new ThreadCollectionListQueryOwner();

type ThreadCollectionRouteWithTimeout = <ValueType>(
  promise: Promise<ValueType>,
  timeoutMs: number,
  label: string,
) => Promise<ValueType>;

type ThreadCollectionRouteThreadOwnershipRegistrar = (threadId: string, agentId: AgentId) => void;

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
  const adapterListThreadsInput = buildAdapterListThreadsInput({
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
      await loadThreadListSnapshot({
        enabledAdapterList,
        adapterListThreadsInput,
        listThreadsTimeoutMs,
        withTimeout,
        registerThreadAdapterOwnership,
        sortKey,
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

  const threadListPage = buildThreadListPage({
    mergedData: cacheReadResult.snapshot.mergedData,
    cursorOffset: decodedCursor.offset,
    limit,
    maxPages,
    all,
  });
  const snapshotUpdatedAt = readThreadListSnapshotUpdatedAt(threadListPage.pageData);
  const responseData =
    sinceUpdatedAt === null
      ? threadListPage.pageData
      : readThreadListDeltaPageData(threadListPage.pageData, sinceUpdatedAt);

  jsonResponse(res, ThreadCollectionRouteStatusCodeByName.ok, {
    ok: true,
    data: responseData,
    nextCursor: threadListPage.nextCursor,
    pages: threadListPage.pages,
    truncated: cacheReadResult.snapshot.combinedTruncated || threadListPage.hasMoreData,
    orderedThreadIds:
      sinceUpdatedAt === null ? undefined : threadListPage.pageData.map((thread) => thread.id),
    sync: {
      mode:
        sinceUpdatedAt === null
          ? ThreadListResponseSyncModeByName.full
          : ThreadListResponseSyncModeByName.delta,
      sinceUpdatedAt,
      snapshotUpdatedAt,
    },
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
    cwd: input.cwd,
  };
}

async function loadThreadListSnapshot(input: {
  enabledAdapterList: AgentAdapter[];
  adapterListThreadsInput: AgentListThreadsInput;
  listThreadsTimeoutMs: number;
  withTimeout: ThreadCollectionRouteWithTimeout;
  registerThreadAdapterOwnership: ThreadCollectionRouteThreadOwnershipRegistrar;
  sortKey: ThreadListSortKey;
}): Promise<{
  mergedData: ThreadListItemWithAgentId[];
  combinedTruncated: boolean;
}> {
  const mergedData: ThreadListItemWithAgentId[] = [];
  let combinedTruncated = false;

  const adapterResults = await Promise.all(
    input.enabledAdapterList.map(async (adapter) => {
      try {
        const loadedThreadIdentifierSet = await loadAdapterLoadedThreadIdentifierSet({
          adapter,
          listThreadsTimeoutMs: input.listThreadsTimeoutMs,
          withTimeout: input.withTimeout,
        });
        const boundedResult = await input.withTimeout(
          adapter.listThreads(input.adapterListThreadsInput),
          input.listThreadsTimeoutMs,
          buildListThreadsTimeoutLabel(adapter.id),
        );

        return {
          ok: true as const,
          adapter,
          result: boundedResult,
          loadedThreadIdentifierSet,
        };
      } catch (error) {
        logger.warn(
          {
            agentId: adapter.id,
            error: toErrorMessage(error),
          },
          ThreadCollectionRouteLogEventByName.agentListThreadsFailed,
        );

        return {
          ok: false as const,
          adapter,
        };
      }
    }),
  );

  for (const adapterResult of adapterResults) {
    if (!adapterResult.ok) {
      continue;
    }

    combinedTruncated = combinedTruncated || (adapterResult.result.truncated ?? false);
    for (const thread of adapterResult.result.data) {
      input.registerThreadAdapterOwnership(thread.id, adapterResult.adapter.id);
      const isLoadedInMemory =
        adapterResult.loadedThreadIdentifierSet !== null
          ? adapterResult.loadedThreadIdentifierSet.has(thread.id)
          : undefined;
      const threadWithAgentId: ThreadListItemWithAgentId = {
        ...thread,
        agentId: adapterResult.adapter.id,
        ...(isLoadedInMemory !== undefined ? { isLoadedInMemory } : {}),
      };
      mergedData.push({
        ...threadWithAgentId,
        threadName: readCanonicalThreadName(threadWithAgentId),
      });
    }
  }

  mergedData.sort((left, right) =>
    threadCollectionListQueryOwner.compareThreadListItems(left, right, input.sortKey),
  );

  return {
    mergedData,
    combinedTruncated,
  };
}

function buildListThreadsTimeoutLabel(agentId: AgentId): string {
  return `${ThreadCollectionRouteListThreadsTimeoutLabelPrefix}${agentId}`;
}

function buildListLoadedThreadsTimeoutLabel(agentId: AgentId): string {
  return `${ThreadCollectionRouteListLoadedThreadsTimeoutLabelPrefix}${agentId}`;
}

async function loadAdapterLoadedThreadIdentifierSet(input: {
  adapter: AgentAdapter;
  listThreadsTimeoutMs: number;
  withTimeout: ThreadCollectionRouteWithTimeout;
}): Promise<Set<string> | null> {
  if (input.adapter.listLoadedThreads === undefined) {
    return null;
  }

  try {
    const loadedThreads = await input.withTimeout(
      input.adapter.listLoadedThreads(),
      input.listThreadsTimeoutMs,
      buildListLoadedThreadsTimeoutLabel(input.adapter.id),
    );
    return mapLoadedThreadIdentifierSet(loadedThreads);
  } catch (error) {
    logger.warn(
      {
        agentId: input.adapter.id,
        error: toErrorMessage(error),
      },
      ThreadCollectionRouteLogEventByName.agentListLoadedThreadsFailed,
    );
    return null;
  }
}

function mapLoadedThreadIdentifierSet(loadedThreads: AgentListLoadedThreadsResult): Set<string> {
  return new Set(loadedThreads.data);
}

function normalizeOptionalThreadName(value: string | null | undefined): string | undefined {
  const parsedThreadName = OptionalThreadNameSourceSchema.parse(value);
  if (parsedThreadName === null || parsedThreadName === undefined) {
    return undefined;
  }
  const trimmedThreadName = parsedThreadName.trim();
  if (trimmedThreadName.length === 0) {
    return undefined;
  }
  return trimmedThreadName;
}

function readCanonicalThreadName(thread: ThreadListItemWithAgentId): string {
  const parsedThreadNamePayload = ThreadNamePayloadSchema.parse(thread);
  return (
    normalizeOptionalThreadName(parsedThreadNamePayload.threadName) ??
    normalizeOptionalThreadName(parsedThreadNamePayload.title) ??
    normalizeOptionalThreadName(parsedThreadNamePayload.name) ??
    parsedThreadNamePayload.preview
  );
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
  const nextCursor = hasMoreData ? threadCollectionListQueryOwner.encodeCursor(nextOffset) : null;
  const pages = pageData.length === 0 ? 0 : Math.ceil(pageData.length / input.limit);

  return {
    pageData,
    nextCursor,
    pages,
    hasMoreData,
  };
}

function readThreadListDeltaPageData(
  pageData: ThreadListItemWithAgentId[],
  sinceUpdatedAt: number,
): ThreadListItemWithAgentId[] {
  return pageData.filter((thread) => thread.updatedAt >= sinceUpdatedAt);
}

function readThreadListSnapshotUpdatedAt(pageData: ThreadListItemWithAgentId[]): number {
  if (pageData.length === 0) {
    return THREAD_LIST_RESPONSE_SNAPSHOT_UPDATED_AT_EMPTY_VALUE;
  }
  let snapshotUpdatedAt = THREAD_LIST_RESPONSE_SNAPSHOT_UPDATED_AT_EMPTY_VALUE;
  for (const thread of pageData) {
    snapshotUpdatedAt = Math.max(snapshotUpdatedAt, thread.updatedAt);
  }
  return snapshotUpdatedAt;
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
