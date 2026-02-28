import { ThreadGroupSelectors } from "../DomainModel/ThreadGroupSelectors";
import type { ThreadListItem, ThreadProjectGroup } from "../DomainModel/ThreadGroupTypes";

interface ThreadRecordState {
  id: string;
  signature: string;
  thread: ThreadListItem;
  groupKey: string;
  groupLabel: string;
  projectPath: string | null;
  createdAt: number;
  updatedAt: number;
  isRemoved: boolean;
}

interface ThreadProjectGroupState {
  key: string;
  label: string;
  projectPath: string | null;
  threadIdentifiers: string[];
  projectCreatedAt: number;
  latestUpdatedAt: number;
  isRemoved: boolean;
}

export interface ThreadProjectGroupingComputationStats {
  totalThreadCount: number;
  addedThreadCount: number;
  changedThreadCount: number;
  removedThreadCount: number;
  rebuiltGroupCount: number;
  reusedGroupCount: number;
  usedIncrementalUpdate: boolean;
}

const PROJECT_KEY_PREFIX = "project:";
const UNKNOWN_PROJECT_KEY = `${PROJECT_KEY_PREFIX}unknown`;
const UNKNOWN_PROJECT_LABEL = "No project";
const REMOVED_PROJECT_STATE = "removed";
const WINDOWS_PATH_SEPARATOR = "\\";
const PROJECT_PATH_SEPARATOR = "/";
const TRAILING_PROJECT_PATH_SEPARATOR_PATTERN = /\/+$/;
const EMPTY_TEXT = "";
const THREAD_SIGNATURE_SEGMENT_DELIMITER = "|";
const THREAD_SIGNATURE_EMPTY_PATH_SEGMENT = "";
const FULL_REBUILD_DELTA_THRESHOLD_RATIO = 0.35;
const FULL_REBUILD_MINIMUM_DELTA_THRESHOLD = 32;

const INITIAL_COMPUTATION_STATS: ThreadProjectGroupingComputationStats = {
  totalThreadCount: 0,
  addedThreadCount: 0,
  changedThreadCount: 0,
  removedThreadCount: 0,
  rebuiltGroupCount: 0,
  reusedGroupCount: 0,
  usedIncrementalUpdate: false,
};

function normalizeProjectPath(value: string): string {
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
  return normalized.length > 0 ? normalized : normalizedPathSeparators;
}

function normalizeOptionalProjectPath(value: string | null | undefined): string {
  if (value === null || value === undefined || value.length === 0) {
    return EMPTY_TEXT;
  }
  return normalizeProjectPath(value);
}

function normalizeProjectPathFromThread(thread: ThreadListItem): string | null {
  const currentWorkingDirectory = normalizeOptionalProjectPath(thread.cwd);
  if (currentWorkingDirectory.length > 0) {
    return currentWorkingDirectory;
  }

  const threadPath = normalizeOptionalProjectPath(thread.path);
  if (threadPath.length > 0) {
    return threadPath;
  }

  return null;
}

function projectLabelFromPath(projectPath: string): string {
  const normalized = normalizeProjectPath(projectPath);
  if (normalized.length === 0) {
    return projectPath;
  }
  const pathParts = normalized.split(PROJECT_PATH_SEPARATOR).filter((part) => part.length > 0);
  return pathParts[pathParts.length - 1] ?? normalized;
}

function buildProjectGroupKey(projectPath: string | null): string {
  if (projectPath === null || projectPath.length === 0) {
    return UNKNOWN_PROJECT_KEY;
  }
  return `${PROJECT_KEY_PREFIX}${projectPath}`;
}

function buildProjectGroupLabel(projectPath: string | null): string {
  if (projectPath === null || projectPath.length === 0) {
    return UNKNOWN_PROJECT_LABEL;
  }
  return projectLabelFromPath(projectPath);
}

function readThreadProjectRemovedState(thread: ThreadListItem): boolean {
  if (thread.isProjectRemoved !== undefined) {
    return thread.isProjectRemoved;
  }
  return (
    thread.projectRemoved === true ||
    thread.removed === true ||
    thread.projectState === REMOVED_PROJECT_STATE
  );
}

function compareThreadRecordsByUpdatedAt(
  leftRecord: ThreadRecordState,
  rightRecord: ThreadRecordState,
): number {
  if (leftRecord.updatedAt !== rightRecord.updatedAt) {
    return rightRecord.updatedAt - leftRecord.updatedAt;
  }
  return leftRecord.id.localeCompare(rightRecord.id);
}

function compareProjectGroups(
  leftGroup: ThreadProjectGroupState,
  rightGroup: ThreadProjectGroupState,
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

function readThreadSignatureValue(thread: ThreadListItem): string {
  return [
    thread.id,
    String(thread.updatedAt),
    String(thread.createdAt),
    thread.displayName ?? THREAD_SIGNATURE_EMPTY_PATH_SEGMENT,
    thread.preview,
    thread.agentId,
    thread.source ?? THREAD_SIGNATURE_EMPTY_PATH_SEGMENT,
    thread.cwd ?? THREAD_SIGNATURE_EMPTY_PATH_SEGMENT,
    thread.path ?? THREAD_SIGNATURE_EMPTY_PATH_SEGMENT,
    String(thread.isProjectRemoved ?? false),
    String(thread.projectRemoved ?? false),
    String(thread.removed ?? false),
    thread.projectState ?? THREAD_SIGNATURE_EMPTY_PATH_SEGMENT,
    String(thread.hasUnreadTurn ?? false),
  ].join(THREAD_SIGNATURE_SEGMENT_DELIMITER);
}

function buildThreadRecordState(thread: ThreadListItem): ThreadRecordState {
  const projectPath = normalizeProjectPathFromThread(thread);
  return {
    id: thread.id,
    signature: readThreadSignatureValue(thread),
    thread,
    groupKey: buildProjectGroupKey(projectPath),
    groupLabel: buildProjectGroupLabel(projectPath),
    projectPath,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    isRemoved: readThreadProjectRemovedState(thread),
  };
}

/**
 * Owns mutable thread-project grouping state keyed by stable thread identifiers.
 * Small deltas patch only affected groups; large deltas intentionally rebuild in one pass.
 */
export class ThreadProjectGroupingStateOwner {
  private readonly threadRecordByIdentifier = new Map<string, ThreadRecordState>();
  private readonly groupStateByKey = new Map<string, ThreadProjectGroupState>();
  private readonly groupOutputByKey = new Map<string, ThreadProjectGroup>();
  private orderedGroupKeys: string[] = [];
  private lastComputationStats: ThreadProjectGroupingComputationStats = INITIAL_COMPUTATION_STATS;

  public readProjectGroups(threads: ThreadListItem[]): ThreadProjectGroup[] {
    if (this.threadRecordByIdentifier.size === 0 && this.groupStateByKey.size === 0) {
      this.rebuildFromFullCollection(threads, false);
      return this.readOrderedGroupOutputs();
    }

    const nextRecordByIdentifier = new Map<string, ThreadRecordState>();
    const addedThreadIdentifiers: string[] = [];
    const changedThreadIdentifiers: string[] = [];
    const removedThreadIdentifiers: string[] = [];

    for (const thread of threads) {
      const nextRecord = buildThreadRecordState(thread);
      nextRecordByIdentifier.set(nextRecord.id, nextRecord);
      const currentRecord = this.threadRecordByIdentifier.get(nextRecord.id);
      if (!currentRecord) {
        addedThreadIdentifiers.push(nextRecord.id);
      } else if (currentRecord.signature !== nextRecord.signature) {
        changedThreadIdentifiers.push(nextRecord.id);
      }
    }

    for (const currentThreadIdentifier of this.threadRecordByIdentifier.keys()) {
      if (!nextRecordByIdentifier.has(currentThreadIdentifier)) {
        removedThreadIdentifiers.push(currentThreadIdentifier);
      }
    }

    if (
      addedThreadIdentifiers.length === 0 &&
      changedThreadIdentifiers.length === 0 &&
      removedThreadIdentifiers.length === 0
    ) {
      this.lastComputationStats = {
        totalThreadCount: threads.length,
        addedThreadCount: 0,
        changedThreadCount: 0,
        removedThreadCount: 0,
        rebuiltGroupCount: 0,
        reusedGroupCount: this.orderedGroupKeys.length,
        usedIncrementalUpdate: true,
      };
      return this.readOrderedGroupOutputs();
    }

    const totalDeltaCount =
      addedThreadIdentifiers.length +
      changedThreadIdentifiers.length +
      removedThreadIdentifiers.length;
    const fullRebuildDeltaThreshold = Math.max(
      FULL_REBUILD_MINIMUM_DELTA_THRESHOLD,
      Math.floor(threads.length * FULL_REBUILD_DELTA_THRESHOLD_RATIO),
    );
    if (totalDeltaCount > fullRebuildDeltaThreshold) {
      this.rebuildFromFullCollection(threads, true);
      return this.readOrderedGroupOutputs();
    }

    const affectedGroupKeys = new Set<string>();
    for (const removedThreadIdentifier of removedThreadIdentifiers) {
      this.removeThreadRecord(removedThreadIdentifier, affectedGroupKeys);
    }

    for (const addedThreadIdentifier of addedThreadIdentifiers) {
      const nextRecord = nextRecordByIdentifier.get(addedThreadIdentifier);
      if (!nextRecord) {
        continue;
      }
      this.insertOrUpdateThreadRecord(nextRecord, affectedGroupKeys);
    }
    for (const changedThreadIdentifier of changedThreadIdentifiers) {
      const nextRecord = nextRecordByIdentifier.get(changedThreadIdentifier);
      if (!nextRecord) {
        continue;
      }
      this.insertOrUpdateThreadRecord(nextRecord, affectedGroupKeys);
    }

    let rebuiltGroupCount = 0;
    for (const affectedGroupKey of affectedGroupKeys) {
      const rebuiltGroup = this.rebuildAffectedGroup(affectedGroupKey);
      if (rebuiltGroup) {
        rebuiltGroupCount += 1;
      }
    }

    const nextOrderedGroupKeys = this.readSortedGroupKeys();
    this.orderedGroupKeys = nextOrderedGroupKeys;
    const reusedGroupCount = Math.max(0, this.orderedGroupKeys.length - rebuiltGroupCount);
    this.lastComputationStats = {
      totalThreadCount: threads.length,
      addedThreadCount: addedThreadIdentifiers.length,
      changedThreadCount: changedThreadIdentifiers.length,
      removedThreadCount: removedThreadIdentifiers.length,
      rebuiltGroupCount,
      reusedGroupCount,
      usedIncrementalUpdate: true,
    };
    return this.readOrderedGroupOutputs();
  }

  public readLastComputationStats(): ThreadProjectGroupingComputationStats {
    return this.lastComputationStats;
  }

  private readOrderedGroupOutputs(): ThreadProjectGroup[] {
    const projectGroups: ThreadProjectGroup[] = [];
    for (const orderedGroupKey of this.orderedGroupKeys) {
      const groupOutput = this.groupOutputByKey.get(orderedGroupKey);
      if (!groupOutput) {
        continue;
      }
      projectGroups.push(groupOutput);
    }
    return projectGroups;
  }

  private rebuildFromFullCollection(
    threads: ThreadListItem[],
    wasTriggeredByDeltaThreshold: boolean,
  ): void {
    this.threadRecordByIdentifier.clear();
    this.groupStateByKey.clear();
    this.groupOutputByKey.clear();

    const projectGroups = ThreadGroupSelectors.groupThreadsByProject(threads);
    for (const projectGroup of projectGroups) {
      const threadIdentifiers: string[] = [];
      for (const thread of projectGroup.threads) {
        const threadRecord = buildThreadRecordState(thread);
        this.threadRecordByIdentifier.set(thread.id, threadRecord);
        threadIdentifiers.push(thread.id);
      }
      this.groupStateByKey.set(projectGroup.key, {
        key: projectGroup.key,
        label: projectGroup.label,
        projectPath: projectGroup.projectPath,
        threadIdentifiers,
        projectCreatedAt: projectGroup.projectCreatedAt,
        latestUpdatedAt: projectGroup.latestUpdatedAt,
        isRemoved: projectGroup.isRemoved,
      });
      this.groupOutputByKey.set(projectGroup.key, projectGroup);
    }
    this.orderedGroupKeys = projectGroups.map((projectGroup) => projectGroup.key);
    this.lastComputationStats = {
      totalThreadCount: threads.length,
      addedThreadCount: wasTriggeredByDeltaThreshold ? 0 : threads.length,
      changedThreadCount: 0,
      removedThreadCount: 0,
      rebuiltGroupCount: projectGroups.length,
      reusedGroupCount: 0,
      usedIncrementalUpdate: false,
    };
  }

  private removeThreadRecord(threadIdentifier: string, affectedGroupKeys: Set<string>): void {
    const currentRecord = this.threadRecordByIdentifier.get(threadIdentifier);
    if (!currentRecord) {
      return;
    }

    const groupState = this.groupStateByKey.get(currentRecord.groupKey);
    if (groupState) {
      const threadIdentifierIndex = groupState.threadIdentifiers.indexOf(threadIdentifier);
      if (threadIdentifierIndex >= 0) {
        groupState.threadIdentifiers.splice(threadIdentifierIndex, 1);
      }
      affectedGroupKeys.add(groupState.key);
    }
    this.threadRecordByIdentifier.delete(threadIdentifier);
  }

  private insertOrUpdateThreadRecord(
    nextRecord: ThreadRecordState,
    affectedGroupKeys: Set<string>,
  ): void {
    const currentRecord = this.threadRecordByIdentifier.get(nextRecord.id);
    if (currentRecord) {
      const currentGroupState = this.groupStateByKey.get(currentRecord.groupKey);
      if (currentGroupState) {
        const threadIdentifierIndex = currentGroupState.threadIdentifiers.indexOf(nextRecord.id);
        if (threadIdentifierIndex >= 0) {
          currentGroupState.threadIdentifiers.splice(threadIdentifierIndex, 1);
        }
        affectedGroupKeys.add(currentGroupState.key);
      }
    }

    this.threadRecordByIdentifier.set(nextRecord.id, nextRecord);
    let nextGroupState = this.groupStateByKey.get(nextRecord.groupKey);
    if (!nextGroupState) {
      nextGroupState = {
        key: nextRecord.groupKey,
        label: nextRecord.groupLabel,
        projectPath: nextRecord.projectPath,
        threadIdentifiers: [],
        projectCreatedAt: nextRecord.createdAt,
        latestUpdatedAt: nextRecord.updatedAt,
        isRemoved: nextRecord.isRemoved,
      };
      this.groupStateByKey.set(nextGroupState.key, nextGroupState);
    }
    nextGroupState.threadIdentifiers.push(nextRecord.id);
    affectedGroupKeys.add(nextGroupState.key);
  }

  private rebuildAffectedGroup(groupKey: string): boolean {
    const groupState = this.groupStateByKey.get(groupKey);
    if (!groupState) {
      return false;
    }
    if (groupState.threadIdentifiers.length === 0) {
      this.groupStateByKey.delete(groupKey);
      this.groupOutputByKey.delete(groupKey);
      return false;
    }

    groupState.threadIdentifiers.sort((leftThreadIdentifier, rightThreadIdentifier) => {
      const leftThreadRecord = this.threadRecordByIdentifier.get(leftThreadIdentifier);
      const rightThreadRecord = this.threadRecordByIdentifier.get(rightThreadIdentifier);
      if (!leftThreadRecord || !rightThreadRecord) {
        return leftThreadIdentifier.localeCompare(rightThreadIdentifier);
      }
      return compareThreadRecordsByUpdatedAt(leftThreadRecord, rightThreadRecord);
    });

    let nextProjectCreatedAt = Number.POSITIVE_INFINITY;
    let nextLatestUpdatedAt = Number.NEGATIVE_INFINITY;
    let nextIsRemoved = false;
    const nextThreads: ThreadListItem[] = [];
    for (const threadIdentifier of groupState.threadIdentifiers) {
      const threadRecord = this.threadRecordByIdentifier.get(threadIdentifier);
      if (!threadRecord) {
        continue;
      }
      nextProjectCreatedAt = Math.min(nextProjectCreatedAt, threadRecord.createdAt);
      nextLatestUpdatedAt = Math.max(nextLatestUpdatedAt, threadRecord.updatedAt);
      nextIsRemoved = nextIsRemoved || threadRecord.isRemoved;
      nextThreads.push(threadRecord.thread);
      groupState.label = threadRecord.groupLabel;
      groupState.projectPath = threadRecord.projectPath;
    }

    groupState.projectCreatedAt = Number.isFinite(nextProjectCreatedAt) ? nextProjectCreatedAt : 0;
    groupState.latestUpdatedAt = Number.isFinite(nextLatestUpdatedAt) ? nextLatestUpdatedAt : 0;
    groupState.isRemoved = nextIsRemoved;
    this.groupOutputByKey.set(groupKey, {
      key: groupState.key,
      label: groupState.label,
      projectPath: groupState.projectPath,
      projectCreatedAt: groupState.projectCreatedAt,
      latestUpdatedAt: groupState.latestUpdatedAt,
      threads: nextThreads,
      isRemoved: groupState.isRemoved,
    });
    return true;
  }

  private readSortedGroupKeys(): string[] {
    return Array.from(this.groupStateByKey.values())
      .sort((leftGroup, rightGroup) => compareProjectGroups(leftGroup, rightGroup))
      .map((group) => group.key);
  }
}
