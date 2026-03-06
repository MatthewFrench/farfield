import { createHash } from "node:crypto";
import type { ThreadListItemWithAgentId } from "../ThreadListAggregationCache.js";

const THREAD_LIST_RESPONSE_SNAPSHOT_UPDATED_AT_EMPTY_VALUE = 0;

export interface ThreadListPageProjection {
  pageData: ThreadListItemWithAgentId[];
  nextCursor: string | null;
  pages: number;
  hasMoreData: boolean;
}

/**
 * Owns page slicing and snapshot metadata derivation for projected thread-list responses.
 * Both `/api/threads` and `/api/sidebar/threads/sync` must derive identical page and version
 * semantics so the client can compare snapshots deterministically across refresh paths.
 */
export function buildThreadListPageProjection(input: {
  mergedData: ThreadListItemWithAgentId[];
  cursorOffset: number;
  limit: number;
  maxPages: number;
  all: boolean;
  encodeCursor: (offset: number) => string;
}): ThreadListPageProjection {
  const pageSize = input.all ? input.limit * input.maxPages : input.limit;
  const pageData = input.mergedData.slice(input.cursorOffset, input.cursorOffset + pageSize);
  const nextOffset = input.cursorOffset + pageData.length;
  const hasMoreData = nextOffset < input.mergedData.length;
  const nextCursor = hasMoreData ? input.encodeCursor(nextOffset) : null;
  const pages = pageData.length === 0 ? 0 : Math.ceil(pageData.length / input.limit);

  return {
    pageData,
    nextCursor,
    pages,
    hasMoreData,
  };
}

export function readThreadListDeltaPageData(
  pageData: ThreadListItemWithAgentId[],
  sinceUpdatedAt: number,
): ThreadListItemWithAgentId[] {
  return pageData.filter((thread) => thread.updatedAt >= sinceUpdatedAt);
}

export function readThreadListSnapshotUpdatedAt(pageData: ThreadListItemWithAgentId[]): number {
  if (pageData.length === 0) {
    return THREAD_LIST_RESPONSE_SNAPSHOT_UPDATED_AT_EMPTY_VALUE;
  }

  let snapshotUpdatedAt = THREAD_LIST_RESPONSE_SNAPSHOT_UPDATED_AT_EMPTY_VALUE;
  for (const thread of pageData) {
    snapshotUpdatedAt = Math.max(snapshotUpdatedAt, thread.updatedAt);
  }
  return snapshotUpdatedAt;
}

export function readThreadListSnapshotVersion(input: {
  pageData: ThreadListItemWithAgentId[];
  nextCursor: string | null;
  pages: number;
  truncated: boolean;
}): string {
  const hash = createHash("sha256");
  hash.update(
    JSON.stringify({
      data: input.pageData,
      nextCursor: input.nextCursor,
      pages: input.pages,
      truncated: input.truncated,
    }),
  );
  return hash.digest("hex");
}
