import type { ThreadListItem, ThreadProjectGroup } from "./ThreadGroupTypes";

type UnreadThreadIdentifierMap = Record<string, true>;
type ThreadUpdatedAtByIdentifier = Record<string, number>;

interface ComputeUnreadThreadIdentifiersInput {
  previousUnreadThreadIdentifiers: UnreadThreadIdentifierMap;
  previousThreadUpdatedAtByIdentifier: ThreadUpdatedAtByIdentifier;
  nextThreads: ThreadListItem[];
  selectedThreadIdentifier: string | null;
}

interface ComputeUnreadThreadFromHistoryInput {
  previousUnreadThreadIdentifiers: UnreadThreadIdentifierMap;
  previousThreadUpdatedAtByIdentifier: ThreadUpdatedAtByIdentifier;
  thread: ThreadListItem;
}

const EMPTY_TEXT = "";
const THREAD_LABEL_IDENTIFIER_LENGTH = 8;
const THREAD_LABEL_PREFIX = "thread ";
const PROJECT_KEY_PREFIX = "project:";
const UNKNOWN_PROJECT_KEY = `${PROJECT_KEY_PREFIX}unknown`;
const UNKNOWN_PROJECT_LABEL = "No project";
const UNKNOWN_UNREAD_SIGNAL = null;
const CODEX_AGENT_IDENTIFIER = "codex";
const WINDOWS_PATH_SEPARATOR = "\\";
const PROJECT_PATH_SEPARATOR = "/";
const TRAILING_PROJECT_PATH_SEPARATOR_PATTERN = /\/+$/;

/**
 * Derives thread-list labels, unread maps, and project groupings from trusted thread models.
 * Shared literals and helper contracts remain centralized here so state owners and UI renderers
 * stay deterministic across active and archived thread surfaces.
 */
export class ThreadGroupSelectors {
  public static threadLabel(
    thread: Pick<ThreadListItem, "id" | "preview" | "displayName" | "lastUserMessage">,
  ): string {
    const text = (thread.lastUserMessage ?? thread.displayName ?? thread.preview).trim();
    if (text.length === 0) {
      return `${THREAD_LABEL_PREFIX}${thread.id.slice(0, THREAD_LABEL_IDENTIFIER_LENGTH)}`;
    }
    return text;
  }

  public static signaturesMatch(previousSignature: string[], nextSignature: string[]): boolean {
    if (previousSignature.length !== nextSignature.length) {
      return false;
    }
    return previousSignature.every((value, index) => value === nextSignature[index]);
  }

  public static mapThreadUpdatedAtByIdentifier(
    threads: ThreadListItem[],
  ): ThreadUpdatedAtByIdentifier {
    const threadUpdatedAtEntries: Array<readonly [string, number]> = [];
    for (const thread of threads) {
      threadUpdatedAtEntries.push([
        thread.id,
        ThreadGroupSelectors.readThreadUpdatedAtTimestamp(thread),
      ]);
    }
    return Object.fromEntries(threadUpdatedAtEntries);
  }

  public static computeUnreadThreadIdentifiers(
    input: ComputeUnreadThreadIdentifiersInput,
  ): UnreadThreadIdentifierMap {
    const unreadThreadIdentifierEntries: Array<readonly [string, true]> = [];
    for (const thread of input.nextThreads) {
      if (thread.id === input.selectedThreadIdentifier) {
        continue;
      }

      // A thread where the latest activity is a user-authored message is considered read.
      if (ThreadGroupSelectors.readThreadLatestActivityIsUserMessage(thread)) {
        continue;
      }

      // Explicit unread signals from the boundary contract take precedence over timestamp heuristics.
      const unreadSignal = ThreadGroupSelectors.readThreadHasUnreadTurnSignal(thread);
      if (unreadSignal === true) {
        unreadThreadIdentifierEntries.push([thread.id, true]);
        continue;
      }
      if (unreadSignal === false) {
        continue;
      }

      if (
        ThreadGroupSelectors.shouldMarkThreadUnreadFromHistory({
          previousUnreadThreadIdentifiers: input.previousUnreadThreadIdentifiers,
          previousThreadUpdatedAtByIdentifier: input.previousThreadUpdatedAtByIdentifier,
          thread,
        })
      ) {
        unreadThreadIdentifierEntries.push([thread.id, true]);
      }
    }
    return Object.fromEntries(unreadThreadIdentifierEntries);
  }

  public static unreadThreadIdentifierMapsMatch(
    previousUnreadThreadIdentifiers: UnreadThreadIdentifierMap,
    nextUnreadThreadIdentifiers: UnreadThreadIdentifierMap,
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
      const groupKey = ThreadGroupSelectors.buildProjectGroupKey(projectPath);
      const groupLabel = ThreadGroupSelectors.buildProjectGroupLabel(projectPath);
      const threadCreatedAt = thread.createdAt;
      const threadUpdatedAt = ThreadGroupSelectors.readThreadUpdatedAtTimestamp(thread);
      const projectMarkedRemoved = ThreadGroupSelectors.threadProjectIsMarkedRemoved(thread);

      const existingGroup = groupByKey.get(groupKey);
      if (existingGroup) {
        groupByKey.set(groupKey, {
          ...existingGroup,
          projectCreatedAt: Math.min(existingGroup.projectCreatedAt, threadCreatedAt),
          latestUpdatedAt: Math.max(existingGroup.latestUpdatedAt, threadUpdatedAt),
          threads: [...existingGroup.threads, thread],
          isRemoved: existingGroup.isRemoved || projectMarkedRemoved,
        });
        continue;
      }

      groupByKey.set(groupKey, {
        key: groupKey,
        label: groupLabel,
        projectPath,
        projectCreatedAt: threadCreatedAt,
        latestUpdatedAt: threadUpdatedAt,
        threads: [thread],
        isRemoved: projectMarkedRemoved,
      });
    }

    return Array.from(groupByKey.values())
      .map((group) => ({
        ...group,
        threads: [...group.threads].sort((leftThread, rightThread) =>
          ThreadGroupSelectors.sortThreadsByUpdatedAt(leftThread, rightThread),
        ),
      }))
      .sort((leftGroup, rightGroup) =>
        ThreadGroupSelectors.sortProjectGroups(leftGroup, rightGroup),
      );
  }

  public static mergeProjectGroups(
    primaryGroups: ThreadProjectGroup[],
    secondaryGroups: ThreadProjectGroup[],
  ): ThreadProjectGroup[] {
    const mergedGroupByKey = new Map<string, ThreadProjectGroup>();

    for (const sourceGroup of primaryGroups) {
      ThreadGroupSelectors.mergeProjectGroupIntoMap(mergedGroupByKey, sourceGroup);
    }
    for (const sourceGroup of secondaryGroups) {
      ThreadGroupSelectors.mergeProjectGroupIntoMap(mergedGroupByKey, sourceGroup);
    }

    return Array.from(mergedGroupByKey.values())
      .map((group) => ({
        ...group,
        threads: [...group.threads].sort((leftThread, rightThread) =>
          ThreadGroupSelectors.sortThreadsByUpdatedAt(leftThread, rightThread),
        ),
      }))
      .sort((leftGroup, rightGroup) =>
        ThreadGroupSelectors.sortProjectGroups(leftGroup, rightGroup),
      );
  }

  private static readThreadUpdatedAtTimestamp(thread: Pick<ThreadListItem, "updatedAt">): number {
    return thread.updatedAt;
  }

  private static shouldMarkThreadUnreadFromHistory(
    input: ComputeUnreadThreadFromHistoryInput,
  ): boolean {
    const wasUnread = input.previousUnreadThreadIdentifiers[input.thread.id] === true;
    const previousUpdatedAt = input.previousThreadUpdatedAtByIdentifier[input.thread.id];
    if (previousUpdatedAt === undefined) {
      return wasUnread;
    }

    if (input.thread.agentId === CODEX_AGENT_IDENTIFIER) {
      // Codex list payloads may omit explicit unread state. When that signal is missing,
      // avoid timestamp-only unread promotion so cross-surface replies do not get marked unread.
      return (
        wasUnread &&
        ThreadGroupSelectors.readThreadUpdatedAtTimestamp(input.thread) === previousUpdatedAt
      );
    }

    return (
      wasUnread ||
      ThreadGroupSelectors.readThreadUpdatedAtTimestamp(input.thread) > previousUpdatedAt
    );
  }

  private static normalizeProjectPath(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return EMPTY_TEXT;
    }

    const normalizedPathSeparators = trimmed.replaceAll(
      WINDOWS_PATH_SEPARATOR,
      PROJECT_PATH_SEPARATOR,
    );
    const normalized = normalizedPathSeparators.replace(
      TRAILING_PROJECT_PATH_SEPARATOR_PATTERN,
      EMPTY_TEXT,
    );
    // Preserve root-like paths such as "/" after trailing separator trimming.
    return normalized.length > 0 ? normalized : normalizedPathSeparators;
  }

  private static normalizeProjectPathFromThread(thread: ThreadListItem): string | null {
    const currentWorkingDirectory = ThreadGroupSelectors.normalizeOptionalProjectPath(thread.cwd);
    if (currentWorkingDirectory.length > 0) {
      return currentWorkingDirectory;
    }

    const threadPath = ThreadGroupSelectors.normalizeOptionalProjectPath(thread.path);
    if (threadPath.length > 0) {
      return threadPath;
    }

    return null;
  }

  private static projectLabelFromPath(projectPath: string): string {
    const normalized = ThreadGroupSelectors.normalizeProjectPath(projectPath);
    if (normalized.length === 0) {
      return projectPath;
    }

    const pathParts = normalized.split(PROJECT_PATH_SEPARATOR).filter((part) => part.length > 0);
    return pathParts[pathParts.length - 1] ?? normalized;
  }

  private static threadProjectIsMarkedRemoved(thread: ThreadListItem): boolean {
    return thread.isProjectRemoved === true;
  }

  private static readThreadHasUnreadTurnSignal(
    thread: Pick<ThreadListItem, "hasUnreadTurn">,
  ): boolean | null {
    return thread.hasUnreadTurn ?? UNKNOWN_UNREAD_SIGNAL;
  }

  private static readThreadLatestActivityIsUserMessage(
    thread: Pick<ThreadListItem, "latestActivityIsUserMessage">,
  ): boolean {
    return thread.latestActivityIsUserMessage === true;
  }

  private static normalizeOptionalProjectPath(value: string | null | undefined): string {
    if (value === null || value === undefined || value.length === 0) {
      return EMPTY_TEXT;
    }
    return ThreadGroupSelectors.normalizeProjectPath(value);
  }

  private static buildProjectGroupKey(projectPath: string | null): string {
    if (projectPath === null || projectPath.length === 0) {
      return UNKNOWN_PROJECT_KEY;
    }
    return `${PROJECT_KEY_PREFIX}${projectPath}`;
  }

  private static buildProjectGroupLabel(projectPath: string | null): string {
    if (projectPath === null || projectPath.length === 0) {
      return UNKNOWN_PROJECT_LABEL;
    }
    return ThreadGroupSelectors.projectLabelFromPath(projectPath);
  }

  private static sortThreadsByUpdatedAt(
    leftThread: ThreadListItem,
    rightThread: ThreadListItem,
  ): number {
    const leftUpdatedAt = ThreadGroupSelectors.readThreadUpdatedAtTimestamp(leftThread);
    const rightUpdatedAt = ThreadGroupSelectors.readThreadUpdatedAtTimestamp(rightThread);
    if (leftUpdatedAt !== rightUpdatedAt) {
      return rightUpdatedAt - leftUpdatedAt;
    }
    return leftThread.id.localeCompare(rightThread.id);
  }

  private static sortProjectGroups(
    leftGroup: ThreadProjectGroup,
    rightGroup: ThreadProjectGroup,
  ): number {
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

  private static mergeProjectGroupIntoMap(
    mergedGroupByKey: Map<string, ThreadProjectGroup>,
    sourceGroup: ThreadProjectGroup,
  ): void {
    const existingGroup = mergedGroupByKey.get(sourceGroup.key);
    if (!existingGroup) {
      mergedGroupByKey.set(sourceGroup.key, {
        key: sourceGroup.key,
        label: sourceGroup.label,
        projectPath: sourceGroup.projectPath,
        projectCreatedAt: sourceGroup.projectCreatedAt,
        latestUpdatedAt: sourceGroup.latestUpdatedAt,
        threads: [...sourceGroup.threads],
        isRemoved: sourceGroup.isRemoved,
      });
      return;
    }

    mergedGroupByKey.set(sourceGroup.key, {
      ...existingGroup,
      projectCreatedAt: Math.min(existingGroup.projectCreatedAt, sourceGroup.projectCreatedAt),
      latestUpdatedAt: Math.max(existingGroup.latestUpdatedAt, sourceGroup.latestUpdatedAt),
      threads: [...existingGroup.threads, ...sourceGroup.threads],
      isRemoved: existingGroup.isRemoved || sourceGroup.isRemoved,
    });
  }
}
