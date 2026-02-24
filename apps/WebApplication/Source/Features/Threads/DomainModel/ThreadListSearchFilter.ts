import { ThreadGroupSelectors } from "@/Features/Threads/DomainModel/ThreadGroupSelectors";
import type { ThreadListItem, ThreadProjectGroup } from "@/Features/Threads/DomainModel/ThreadGroupTypes";

interface FilterProjectGroupsInput {
  projectGroups: ThreadProjectGroup[];
  query: string;
  readAgentLabel: (thread: ThreadListItem) => string;
}

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
    const normalizedLabel = ThreadListSearchFilter.normalizeSearchText(projectGroup.label);
    if (normalizedLabel.includes(query)) {
      return true;
    }
    const normalizedProjectPath = ThreadListSearchFilter.normalizeSearchText(projectGroup.projectPath);
    return normalizedProjectPath.includes(query);
  }

  private static threadMatchesQuery(
    thread: ThreadListItem,
    query: string,
    agentLabel: string
  ): boolean {
    const normalizedThreadLabel = ThreadListSearchFilter.normalizeSearchText(
      ThreadGroupSelectors.threadLabel(thread)
    );
    if (normalizedThreadLabel.includes(query)) {
      return true;
    }

    const normalizedThreadIdentifier = ThreadListSearchFilter.normalizeSearchText(thread.id);
    if (normalizedThreadIdentifier.includes(query)) {
      return true;
    }

    const normalizedWorkingDirectory = ThreadListSearchFilter.normalizeSearchText(thread.cwd);
    if (normalizedWorkingDirectory.includes(query)) {
      return true;
    }

    const normalizedThreadPath = ThreadListSearchFilter.normalizeSearchText(thread.path);
    if (normalizedThreadPath.includes(query)) {
      return true;
    }

    const normalizedAgentLabel = ThreadListSearchFilter.normalizeSearchText(agentLabel);
    return normalizedAgentLabel.includes(query);
  }

  private static normalizeSearchText(value: string | null | undefined): string {
    return (value ?? "").trim().toLowerCase();
  }
}
