import { ThreadGroupSelectors } from "../DomainModel/ThreadGroupSelectors";
import type { ThreadListItem, ThreadProjectGroup } from "../DomainModel/ThreadGroupTypes";
import {
  type ThreadProjectGroupingComputationStats,
  ThreadProjectGroupingStateOwner,
} from "./ThreadProjectGroupingStateOwner";

export interface ThreadListPresentationStateInput {
  threads: ThreadListItem[];
  archivedThreads: ThreadListItem[];
  selectedThreadIdentifier: string | null;
}

export interface ThreadListPresentationStateResult {
  selectedThread: ThreadListItem | null;
  activeProjectGroups: ThreadProjectGroup[];
  archivedProjectGroups: ThreadProjectGroup[];
  archivedThreadIdentifiers: Set<string>;
  archivedSectionThreadCount: number;
}

export interface ThreadListPresentationComputationStatsSnapshot {
  active: ThreadProjectGroupingComputationStats;
  archived: ThreadProjectGroupingComputationStats;
}

interface ProjectOrderEntry {
  projectGroup: ThreadProjectGroup;
  originalIndex: number;
}

/**
 * Owns presentational projections for active and archived thread list sections.
 * Grouping and merged archived counts are computed once here so UI owners consume a strict shape.
 */
export class ThreadListPresentationStateResolver {
  private readonly activeThreadProjectGroupingStateOwner: ThreadProjectGroupingStateOwner;
  private readonly archivedThreadProjectGroupingStateOwner: ThreadProjectGroupingStateOwner;

  public constructor() {
    this.activeThreadProjectGroupingStateOwner = new ThreadProjectGroupingStateOwner();
    this.archivedThreadProjectGroupingStateOwner = new ThreadProjectGroupingStateOwner();
  }

  public readState(input: ThreadListPresentationStateInput): ThreadListPresentationStateResult {
    const selectedThread =
      input.threads.find((thread) => thread.id === input.selectedThreadIdentifier) ?? null;
    const groupedThreadsByProject = this.activeThreadProjectGroupingStateOwner.readProjectGroups(
      input.threads,
    );
    const groupedArchivedThreadsByProject =
      this.archivedThreadProjectGroupingStateOwner.readProjectGroups(input.archivedThreads);
    const projectOrderIndexByKey = this.readProjectOrderIndexByKey(
      groupedThreadsByProject,
      groupedArchivedThreadsByProject,
    );
    const activeProjectGroups = this.sortProjectGroupsByCombinedOrder(
      groupedThreadsByProject.filter((group) => !group.isRemoved),
      projectOrderIndexByKey,
    );
    const removedProjectGroups = groupedThreadsByProject.filter((group) => group.isRemoved);
    const archivedProjectGroups = ThreadGroupSelectors.mergeProjectGroups(
      groupedArchivedThreadsByProject,
      removedProjectGroups,
    );

    const archivedThreadIdentifiers = this.buildThreadIdentifierSet(input.archivedThreads);
    const archivedSectionThreadIdentifiers =
      this.buildGroupThreadIdentifierSet(archivedProjectGroups);

    return {
      selectedThread,
      activeProjectGroups,
      archivedProjectGroups,
      archivedThreadIdentifiers,
      archivedSectionThreadCount: archivedSectionThreadIdentifiers.size,
    };
  }

  public readComputationStatsSnapshot(): ThreadListPresentationComputationStatsSnapshot {
    return {
      active: this.activeThreadProjectGroupingStateOwner.readLastComputationStats(),
      archived: this.archivedThreadProjectGroupingStateOwner.readLastComputationStats(),
    };
  }

  private buildThreadIdentifierSet(threads: ThreadListItem[]): Set<string> {
    const threadIdentifiers = new Set<string>();
    for (const thread of threads) {
      threadIdentifiers.add(thread.id);
    }
    return threadIdentifiers;
  }

  private buildGroupThreadIdentifierSet(projectGroups: ThreadProjectGroup[]): Set<string> {
    const threadIdentifiers = new Set<string>();
    for (const projectGroup of projectGroups) {
      for (const thread of projectGroup.threads) {
        threadIdentifiers.add(thread.id);
      }
    }
    return threadIdentifiers;
  }

  private readProjectOrderIndexByKey(
    activeProjectGroups: ThreadProjectGroup[],
    archivedProjectGroups: ThreadProjectGroup[],
  ): Map<string, number> {
    const projectOrderIndexByKey = new Map<string, number>();
    const mergedProjectGroups = ThreadGroupSelectors.mergeProjectGroups(
      activeProjectGroups,
      archivedProjectGroups,
    );
    for (const mergedProjectGroup of mergedProjectGroups) {
      projectOrderIndexByKey.set(mergedProjectGroup.key, projectOrderIndexByKey.size);
    }
    return projectOrderIndexByKey;
  }

  private sortProjectGroupsByCombinedOrder(
    projectGroups: ThreadProjectGroup[],
    projectOrderIndexByKey: Map<string, number>,
  ): ThreadProjectGroup[] {
    const entries: ProjectOrderEntry[] = projectGroups.map((projectGroup, index) => ({
      projectGroup,
      originalIndex: index,
    }));
    entries.sort((leftEntry, rightEntry) => {
      const leftOrderIndex = projectOrderIndexByKey.get(leftEntry.projectGroup.key);
      const rightOrderIndex = projectOrderIndexByKey.get(rightEntry.projectGroup.key);
      if (leftOrderIndex !== undefined && rightOrderIndex !== undefined) {
        return leftOrderIndex - rightOrderIndex;
      }
      if (leftOrderIndex !== undefined) {
        return -1;
      }
      if (rightOrderIndex !== undefined) {
        return 1;
      }
      return leftEntry.originalIndex - rightEntry.originalIndex;
    });
    return entries.map((entry) => entry.projectGroup);
  }
}
