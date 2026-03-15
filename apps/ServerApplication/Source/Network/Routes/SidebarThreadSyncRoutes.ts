import {
  FarfieldSidebarThreadSyncRequestSchema,
  FarfieldSidebarThreadSyncResponseSchema,
  type FarfieldThreadListResponse,
} from "@farfield/protocol";
import type { SidebarThreadSyncRouteDependencies } from "./SidebarThreadSyncRouteContracts.js";
import {
  SidebarThreadSyncRouteMethodByName,
  SidebarThreadSyncRoutePathnameByName,
} from "./SidebarThreadSyncRouteContracts.js";
import { ThreadCollectionListQueryOwner } from "./ThreadCollectionListQueryOwner.js";
import {
  buildAggregationAdapterListThreadsInput,
  loadThreadListAggregationSnapshot,
} from "./ThreadListAggregationSnapshotLoader.js";
import {
  buildThreadListPageProjection,
  readThreadListSnapshotUpdatedAt,
  readThreadListSnapshotVersion,
} from "./ThreadListPageProjection.js";

const SidebarThreadSyncRouteStatusCodeByName = {
  ok: 200,
  badRequest: 400,
} as const;
const THREAD_LIST_RESPONSE_NOT_TRUNCATED = false;
const threadCollectionListQueryOwner = new ThreadCollectionListQueryOwner();

function isSidebarThreadSyncRouteRequest(method: string | undefined, pathname: string): boolean {
  return (
    method === SidebarThreadSyncRouteMethodByName.post &&
    pathname === SidebarThreadSyncRoutePathnameByName.threadsSync
  );
}

export async function handleSidebarThreadSyncRoutes(
  deps: SidebarThreadSyncRouteDependencies,
): Promise<boolean> {
  if (!isSidebarThreadSyncRouteRequest(deps.req.method, deps.pathname)) {
    return false;
  }

  const parsedRequest = FarfieldSidebarThreadSyncRequestSchema.safeParse(
    await deps.readJsonBody(deps.req),
  );
  if (!parsedRequest.success) {
    deps.jsonResponse(deps.res, SidebarThreadSyncRouteStatusCodeByName.badRequest, {
      ok: false,
      error: "Invalid sidebar thread sync request",
      issues: parsedRequest.error.issues,
    });
    return true;
  }

  const normalizedCurrentWorkingDirectory = deps.normalizeOptionalString(parsedRequest.data.cwd);
  const enabledAdapterList = deps.listEnabledAdapters();
  const aggregationQuery = {
    enabledAgentIds: enabledAdapterList.map((adapter) => adapter.id),
    limit: parsedRequest.data.limit,
    archived: parsedRequest.data.archived,
    all: true,
    maxPages: parsedRequest.data.maxPages,
    sortKey: parsedRequest.data.sortKey,
    cwd: normalizedCurrentWorkingDirectory,
  } as const;

  const cachedSidebarSnapshot = deps.sidebarThreadSyncSnapshotCache.readFresh(aggregationQuery);
  if (cachedSidebarSnapshot !== null) {
    const response =
      parsedRequest.data.knownSnapshotVersion === cachedSidebarSnapshot.snapshotVersion
        ? {
            ok: true,
            syncStatus: "notModified",
            snapshotUpdatedAt: cachedSidebarSnapshot.snapshotUpdatedAt,
            snapshotVersion: cachedSidebarSnapshot.snapshotVersion,
          }
        : {
            ok: true,
            syncStatus: "snapshot",
            snapshotUpdatedAt: cachedSidebarSnapshot.snapshotUpdatedAt,
            snapshotVersion: cachedSidebarSnapshot.snapshotVersion,
            threadList: cachedSidebarSnapshot.threadList,
          };
    deps.jsonResponse(
      deps.res,
      SidebarThreadSyncRouteStatusCodeByName.ok,
      FarfieldSidebarThreadSyncResponseSchema.parse(response),
    );
    return true;
  }

  const adapterListThreadsInput = buildAggregationAdapterListThreadsInput({
    limit: parsedRequest.data.limit,
    archived: parsedRequest.data.archived,
    maxPages: parsedRequest.data.maxPages,
    sortKey: parsedRequest.data.sortKey,
    cwd: normalizedCurrentWorkingDirectory,
  });
  const aggregationSnapshot = await deps.threadListAggregationCache.readFreshOrLoad(
    aggregationQuery,
    async () =>
      await loadThreadListAggregationSnapshot({
        enabledAdapterList,
        adapterListThreadsInput,
        listThreadsTimeoutMs: deps.listThreadsTimeoutMs,
        withTimeout: deps.withTimeout,
        registerThreadAdapterOwnership: deps.registerThreadAdapterOwnership,
        shouldIncludeThreadInList: deps.shouldIncludeThreadInList,
        createdThreadListProjectionOwner: deps.createdThreadListProjectionOwner,
        sortItems: (left, right) =>
          threadCollectionListQueryOwner.compareThreadListItems(
            left,
            right,
            parsedRequest.data.sortKey,
          ),
      }),
  );

  for (const thread of aggregationSnapshot.snapshot.mergedData) {
    deps.registerThreadAdapterOwnership(thread.id, thread.agentId);
  }

  const threadListPage = buildThreadListPageProjection({
    mergedData: aggregationSnapshot.snapshot.mergedData,
    cursorOffset: 0,
    limit: parsedRequest.data.limit,
    maxPages: parsedRequest.data.maxPages,
    all: true,
    encodeCursor: (offset) => threadCollectionListQueryOwner.encodeCursor(offset),
  });
  const snapshotUpdatedAt = readThreadListSnapshotUpdatedAt(threadListPage.pageData);
  const truncated =
    (aggregationSnapshot.snapshot.combinedTruncated ?? THREAD_LIST_RESPONSE_NOT_TRUNCATED) ||
    threadListPage.hasMoreData;
  const snapshotVersion = readThreadListSnapshotVersion({
    pageData: threadListPage.pageData,
    nextCursor: threadListPage.nextCursor,
    pages: threadListPage.pages,
    truncated,
  });
  const threadList: FarfieldThreadListResponse = {
    data: threadListPage.pageData,
    nextCursor: threadListPage.nextCursor,
    pages: threadListPage.pages,
    truncated,
    sync: {
      mode: "full",
      sinceUpdatedAt: null,
      snapshotUpdatedAt,
      snapshotVersion,
    },
  };

  deps.sidebarThreadSyncSnapshotCache.write(aggregationQuery, {
    threadList,
    snapshotUpdatedAt,
    snapshotVersion,
  });

  const response =
    parsedRequest.data.knownSnapshotVersion === snapshotVersion
      ? {
          ok: true,
          syncStatus: "notModified",
          snapshotUpdatedAt,
          snapshotVersion,
        }
      : {
          ok: true,
          syncStatus: "snapshot",
          snapshotUpdatedAt,
          snapshotVersion,
          threadList,
        };

  deps.jsonResponse(
    deps.res,
    SidebarThreadSyncRouteStatusCodeByName.ok,
    FarfieldSidebarThreadSyncResponseSchema.parse(response),
  );
  return true;
}
