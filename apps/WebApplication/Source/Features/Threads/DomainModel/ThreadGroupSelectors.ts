import { z } from "zod";
import type { ThreadListItem, ThreadProjectGroup } from "./ThreadGroupTypes";

interface ComputeUnreadThreadIdentifiersInput {
  previousUnreadThreadIdentifiers: Record<string, true>;
  previousThreadUpdatedAtByIdentifier: Record<string, number>;
  nextThreads: ThreadListItem[];
  selectedThreadIdentifier: string | null;
}

const ThreadUnreadStateSchema = z
  .object({
    hasUnreadTurn: z.boolean().optional()
  })
  .passthrough();

const OptionalProjectPathSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => value ?? "");

export class ThreadGroupSelectors {
  public static threadLabel(thread: Pick<ThreadListItem, "id" | "preview">): string {
    const text = thread.preview.trim();
    if (!text) {
      return `thread ${thread.id.slice(0, 8)}`;
    }
    return text;
  }

  public static signaturesMatch(previousSignature: string[], nextSignature: string[]): boolean {
    if (previousSignature.length !== nextSignature.length) {
      return false;
    }
    return previousSignature.every((value, index) => value === nextSignature[index]);
  }

  public static mapThreadUpdatedAtByIdentifier(threads: ThreadListItem[]): Record<string, number> {
    const mapped: Record<string, number> = {};
    for (const thread of threads) {
      mapped[thread.id] = ThreadGroupSelectors.readThreadUpdatedAtTimestamp(thread);
    }
    return mapped;
  }

  public static computeUnreadThreadIdentifiers(input: ComputeUnreadThreadIdentifiersInput): Record<string, true> {
    const nextUnreadThreadIdentifiers: Record<string, true> = {};
    for (const thread of input.nextThreads) {
      if (thread.id === input.selectedThreadIdentifier) {
        continue;
      }

      const parsedUnreadState = ThreadUnreadStateSchema.parse(thread);
      if (parsedUnreadState.hasUnreadTurn === true) {
        nextUnreadThreadIdentifiers[thread.id] = true;
        continue;
      }
      if (parsedUnreadState.hasUnreadTurn === false) {
        continue;
      }

      const wasUnread = input.previousUnreadThreadIdentifiers[thread.id] === true;
      const previousUpdatedAt = input.previousThreadUpdatedAtByIdentifier[thread.id];
      const hasNewUpdate = previousUpdatedAt !== undefined
        && ThreadGroupSelectors.readThreadUpdatedAtTimestamp(thread) > previousUpdatedAt;
      if (wasUnread || hasNewUpdate) {
        nextUnreadThreadIdentifiers[thread.id] = true;
      }
    }
    return nextUnreadThreadIdentifiers;
  }

  public static unreadThreadIdentifierMapsMatch(
    previousUnreadThreadIdentifiers: Record<string, true>,
    nextUnreadThreadIdentifiers: Record<string, true>
  ): boolean {
    const previousKeys = Object.keys(previousUnreadThreadIdentifiers);
    const nextKeys = Object.keys(nextUnreadThreadIdentifiers);
    if (previousKeys.length !== nextKeys.length) {
      return false;
    }
    for (const previousKey of previousKeys) {
      if (nextUnreadThreadIdentifiers[previousKey] !== true) {
        return false;
      }
    }
    return true;
  }

  public static groupThreadsByProject(threads: ThreadListItem[]): ThreadProjectGroup[] {
    const groupByKey = new Map<string, ThreadProjectGroup>();
    for (const thread of threads) {
      const projectPath = ThreadGroupSelectors.normalizeProjectPathFromThread(thread);
      const groupKey = projectPath ? `project:${projectPath}` : "project:unknown";
      const groupLabel = projectPath
        ? ThreadGroupSelectors.projectLabelFromPath(projectPath)
        : "No project";
      const threadCreatedAt = thread.createdAt ?? 0;
      const threadUpdatedAt = ThreadGroupSelectors.readThreadUpdatedAtTimestamp(thread);
      const projectMarkedRemoved = ThreadGroupSelectors.threadProjectIsMarkedRemoved(thread);

      const existingGroup = groupByKey.get(groupKey);
      if (existingGroup) {
        existingGroup.threads.push(thread);
        if (threadCreatedAt > existingGroup.projectCreatedAt) {
          existingGroup.projectCreatedAt = threadCreatedAt;
        }
        if (threadUpdatedAt > existingGroup.latestUpdatedAt) {
          existingGroup.latestUpdatedAt = threadUpdatedAt;
        }
        if (projectMarkedRemoved) {
          existingGroup.isRemoved = true;
        }
        continue;
      }

      groupByKey.set(groupKey, {
        key: groupKey,
        label: groupLabel,
        projectPath,
        projectCreatedAt: threadCreatedAt,
        latestUpdatedAt: threadUpdatedAt,
        threads: [thread],
        isRemoved: projectMarkedRemoved
      });
    }

    for (const group of groupByKey.values()) {
      group.threads.sort((leftThread, rightThread) =>
        ThreadGroupSelectors.sortThreadsByUpdatedAt(leftThread, rightThread)
      );
    }

    return Array.from(groupByKey.values()).sort((leftGroup, rightGroup) =>
      ThreadGroupSelectors.sortProjectGroups(leftGroup, rightGroup)
    );
  }

  public static mergeProjectGroups(
    primaryGroups: ThreadProjectGroup[],
    secondaryGroups: ThreadProjectGroup[]
  ): ThreadProjectGroup[] {
    const mergedGroupByKey = new Map<string, ThreadProjectGroup>();

    for (const sourceGroup of [...primaryGroups, ...secondaryGroups]) {
      const existingGroup = mergedGroupByKey.get(sourceGroup.key);
      if (!existingGroup) {
        mergedGroupByKey.set(sourceGroup.key, {
          key: sourceGroup.key,
          label: sourceGroup.label,
          projectPath: sourceGroup.projectPath,
          projectCreatedAt: sourceGroup.projectCreatedAt,
          latestUpdatedAt: sourceGroup.latestUpdatedAt,
          threads: [...sourceGroup.threads],
          isRemoved: sourceGroup.isRemoved
        });
        continue;
      }

      existingGroup.threads.push(...sourceGroup.threads);
      if (sourceGroup.projectCreatedAt > existingGroup.projectCreatedAt) {
        existingGroup.projectCreatedAt = sourceGroup.projectCreatedAt;
      }
      if (sourceGroup.latestUpdatedAt > existingGroup.latestUpdatedAt) {
        existingGroup.latestUpdatedAt = sourceGroup.latestUpdatedAt;
      }
      if (sourceGroup.isRemoved) {
        existingGroup.isRemoved = true;
      }
    }

    for (const group of mergedGroupByKey.values()) {
      group.threads.sort((leftThread, rightThread) =>
        ThreadGroupSelectors.sortThreadsByUpdatedAt(leftThread, rightThread)
      );
    }

    return Array.from(mergedGroupByKey.values()).sort((leftGroup, rightGroup) =>
      ThreadGroupSelectors.sortProjectGroups(leftGroup, rightGroup)
    );
  }

  private static readThreadUpdatedAtTimestamp(thread: Pick<ThreadListItem, "updatedAt">): number {
    return thread.updatedAt ?? 0;
  }

  private static normalizeProjectPath(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return "";
    }
    const normalized = trimmed.replaceAll("\\", "/").replace(/\/+$/, "");
    return normalized.length > 0 ? normalized : trimmed.replaceAll("\\", "/");
  }

  private static normalizeProjectPathFromThread(thread: ThreadListItem): string | null {
    const currentWorkingDirectory = OptionalProjectPathSchema.parse(thread.cwd).trim();
    if (currentWorkingDirectory.length > 0) {
      const normalizedCurrentWorkingDirectory = ThreadGroupSelectors.normalizeProjectPath(currentWorkingDirectory);
      return normalizedCurrentWorkingDirectory.length > 0
        ? normalizedCurrentWorkingDirectory
        : currentWorkingDirectory;
    }

    const threadPath = OptionalProjectPathSchema.parse(thread.path).trim();
    if (threadPath.length > 0) {
      const normalizedThreadPath = ThreadGroupSelectors.normalizeProjectPath(threadPath);
      return normalizedThreadPath.length > 0 ? normalizedThreadPath : threadPath;
    }

    return null;
  }

  private static projectLabelFromPath(projectPath: string): string {
    const normalized = ThreadGroupSelectors.normalizeProjectPath(projectPath);
    if (!normalized) {
      return projectPath;
    }

    const pathParts = normalized.split("/").filter((part) => part.length > 0);
    return pathParts[pathParts.length - 1] ?? normalized;
  }

  private static threadProjectIsMarkedRemoved(thread: ThreadListItem): boolean {
    return thread.projectRemoved === true || thread.removed === true || thread.projectState === "removed";
  }

  private static sortThreadsByUpdatedAt(leftThread: ThreadListItem, rightThread: ThreadListItem): number {
    const leftUpdatedAt = ThreadGroupSelectors.readThreadUpdatedAtTimestamp(leftThread);
    const rightUpdatedAt = ThreadGroupSelectors.readThreadUpdatedAtTimestamp(rightThread);
    if (leftUpdatedAt !== rightUpdatedAt) {
      return rightUpdatedAt - leftUpdatedAt;
    }
    return leftThread.id.localeCompare(rightThread.id);
  }

  private static sortProjectGroups(leftGroup: ThreadProjectGroup, rightGroup: ThreadProjectGroup): number {
    const leftIsNoProjectGroup = leftGroup.projectPath === null;
    const rightIsNoProjectGroup = rightGroup.projectPath === null;
    if (leftIsNoProjectGroup !== rightIsNoProjectGroup) {
      return leftIsNoProjectGroup ? 1 : -1;
    }
    if (leftGroup.projectCreatedAt !== rightGroup.projectCreatedAt) {
      return rightGroup.projectCreatedAt - leftGroup.projectCreatedAt;
    }
    if (leftGroup.latestUpdatedAt !== rightGroup.latestUpdatedAt) {
      return rightGroup.latestUpdatedAt - leftGroup.latestUpdatedAt;
    }
    return leftGroup.label.localeCompare(rightGroup.label);
  }
}
