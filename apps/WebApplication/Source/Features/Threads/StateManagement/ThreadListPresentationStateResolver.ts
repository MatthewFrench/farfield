import { ThreadGroupSelectors } from "../DomainModel/ThreadGroupSelectors";
import type { ThreadListItem, ThreadProjectGroup } from "../DomainModel/ThreadGroupTypes";

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

export class ThreadListPresentationStateResolver {
  public readState(input: ThreadListPresentationStateInput): ThreadListPresentationStateResult {
    const selectedThread = input.threads.find((thread) => thread.id === input.selectedThreadIdentifier) ?? null;
    const groupedThreadsByProject = ThreadGroupSelectors.groupThreadsByProject(input.threads);
    const groupedArchivedThreadsByProject = ThreadGroupSelectors.groupThreadsByProject(input.archivedThreads);
    const activeProjectGroups = groupedThreadsByProject.filter((group) => !group.isRemoved);
    const removedProjectGroups = groupedThreadsByProject.filter((group) => group.isRemoved);
    const archivedProjectGroups = ThreadGroupSelectors.mergeProjectGroups(
      groupedArchivedThreadsByProject,
      removedProjectGroups
    );

    const archivedThreadIdentifiers = new Set<string>();
    for (const thread of input.archivedThreads) {
      archivedThreadIdentifiers.add(thread.id);
    }

    const archivedSectionThreadIdentifiers = new Set<string>();
    for (const group of archivedProjectGroups) {
      for (const thread of group.threads) {
        archivedSectionThreadIdentifiers.add(thread.id);
      }
    }

    return {
      selectedThread,
      activeProjectGroups,
      archivedProjectGroups,
      archivedThreadIdentifiers,
      archivedSectionThreadCount: archivedSectionThreadIdentifiers.size
    };
  }
}
