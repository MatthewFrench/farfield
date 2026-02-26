import { ThreadGroupSelectors } from "@/Features/Threads/DomainModel/ThreadGroupSelectors";
import type { ThreadListItem, ThreadProjectGroup } from "@/Features/Threads/DomainModel/ThreadGroupTypes";

interface FilterProjectGroupsInput {
  projectGroups: ThreadProjectGroup[];
  query: string;
  readAgentLabel: (thread: ThreadListItem) => string;
}

const EMPTY_SEARCH_TEXT = "";

export class ThreadListSearchFilter {
  public static normalizeQuery(rawQuery: string): string {
    return rawQuery.trim().toLowerCase();
  }

  public static countThreads(projectGroups: ThreadProjectGroup[]): number {
    let totalCount = 0;
    for (const group of projectGroups) {
      totalCount += group.threads.length;
    }
    return totalCount;
  }

  public static filterProjectGroups(input: FilterProjectGroupsInput): ThreadProjectGroup[] {
    const normalizedQuery = ThreadListSearchFilter.normalizeQuery(input.query);
    if (normalizedQuery.length === 0) {
      return input.projectGroups;
    }

    const filteredProjectGroups: ThreadProjectGroup[] = [];
    for (const projectGroup of input.projectGroups) {
      const projectMatches = ThreadListSearchFilter.projectGroupMatchesQuery(projectGroup, normalizedQuery);
      if (projectMatches) {
        filteredProjectGroups.push(projectGroup);
        continue;
      }

      const matchingThreads = projectGroup.threads.filter((thread) =>
        ThreadListSearchFilter.threadMatchesQuery(thread, normalizedQuery, input.readAgentLabel(thread))
      );
      if (matchingThreads.length === 0) {
        continue;
      }

      filteredProjectGroups.push({
        ...projectGroup,
        threads: matchingThreads
      });
    }

    return filteredProjectGroups;
  }

  private static projectGroupMatchesQuery(projectGroup: ThreadProjectGroup, query: string): boolean {
    return (
      ThreadListSearchFilter.searchTextMatchesQuery(projectGroup.label, query)
      || ThreadListSearchFilter.searchTextMatchesQuery(projectGroup.projectPath, query)
    );
  }

  private static threadMatchesQuery(
    thread: ThreadListItem,
    query: string,
    agentLabel: string
  ): boolean {
    return (
      ThreadListSearchFilter.searchTextMatchesQuery(ThreadGroupSelectors.threadLabel(thread), query)
      || ThreadListSearchFilter.searchTextMatchesQuery(thread.id, query)
      || ThreadListSearchFilter.searchTextMatchesQuery(thread.cwd, query)
      || ThreadListSearchFilter.searchTextMatchesQuery(thread.path, query)
      || ThreadListSearchFilter.searchTextMatchesQuery(agentLabel, query)
    );
  }

  private static normalizeSearchText(value: string | null | undefined): string {
    return (value ?? EMPTY_SEARCH_TEXT).trim().toLowerCase();
  }

  private static searchTextMatchesQuery(value: string | null | undefined, query: string): boolean {
    return ThreadListSearchFilter.normalizeSearchText(value).includes(query);
  }
}
