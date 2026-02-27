/**
 * Owns canonical cache keys for thread list query state.
 * Active and archived lists are separate cache surfaces with independent invalidation.
 */
export const ThreadListCacheKeyByName = {
  activeThreads: "threads:active",
  archivedThreads: "threads:archived",
} as const;

export type ThreadListCacheKey =
  (typeof ThreadListCacheKeyByName)[keyof typeof ThreadListCacheKeyByName];

export function readThreadListCacheKeyForArchiveState(isArchived: boolean): ThreadListCacheKey {
  return isArchived
    ? ThreadListCacheKeyByName.archivedThreads
    : ThreadListCacheKeyByName.activeThreads;
}
