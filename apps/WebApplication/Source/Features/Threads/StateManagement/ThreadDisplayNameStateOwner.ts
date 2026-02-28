import type { ThreadListItem } from "../DomainModel/ThreadGroupTypes";

interface ResolveThreadDisplayNameInput {
  threadIdentifier: ThreadListItem["id"];
  serverDisplayName: ThreadListItem["displayName"];
}

export interface ThreadDisplayNameStateOwnerDependencies {
  threadDisplayNamePreferenceStore: ThreadDisplayNamePersistenceStore;
}

type ThreadDisplayNameCache = Map<string, string | null>;

export interface ThreadDisplayNamePersistenceStore {
  readThreadDisplayName(threadIdentifier: string): string | null;
  writeThreadDisplayName(threadIdentifier: string, threadDisplayName: string): void;
  clearThreadDisplayName(threadIdentifier: string): void;
  pruneThreadDisplayNames(retainedThreadIdentifiers: string[]): void;
}

function normalizeOptionalThreadDisplayName(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return undefined;
  }
  return trimmedValue;
}

/**
 * Owns thread display-name persistence and in-memory cache reads.
 * Server-provided names are written as canonical values when present; otherwise persisted values
 * are reused so list labels stay stable across app reloads.
 */
export class ThreadDisplayNameStateOwner {
  private readonly threadDisplayNamePreferenceStore: ThreadDisplayNamePersistenceStore;
  private readonly displayNameByThreadIdentifier: ThreadDisplayNameCache;

  public constructor(dependencies: ThreadDisplayNameStateOwnerDependencies) {
    this.threadDisplayNamePreferenceStore = dependencies.threadDisplayNamePreferenceStore;
    this.displayNameByThreadIdentifier = new Map();
  }

  public applyDisplayNamesToThreadList(threads: ThreadListItem[]): ThreadListItem[] {
    let didChangeThreadCollection = false;
    const nextThreads = threads.map((thread) => {
      const nextDisplayName = this.resolveThreadDisplayName({
        threadIdentifier: thread.id,
        serverDisplayName: thread.displayName,
      });
      if (nextDisplayName === thread.displayName) {
        return thread;
      }
      didChangeThreadCollection = true;
      return {
        ...thread,
        displayName: nextDisplayName,
      };
    });

    return didChangeThreadCollection ? nextThreads : threads;
  }

  public writeThreadDisplayName(
    threadIdentifier: ThreadListItem["id"],
    threadDisplayName: string,
  ): void {
    const normalizedThreadDisplayName = normalizeOptionalThreadDisplayName(threadDisplayName);
    if (normalizedThreadDisplayName === undefined) {
      throw new Error("Thread display name must contain at least one non-whitespace character.");
    }
    this.threadDisplayNamePreferenceStore.writeThreadDisplayName(
      threadIdentifier,
      normalizedThreadDisplayName,
    );
    this.displayNameByThreadIdentifier.set(threadIdentifier, normalizedThreadDisplayName);
  }

  public writeThreadDisplayNameIfPresent(
    threadIdentifier: ThreadListItem["id"],
    threadDisplayName: string | null | undefined,
  ): void {
    const normalizedThreadDisplayName = normalizeOptionalThreadDisplayName(
      threadDisplayName ?? undefined,
    );
    if (normalizedThreadDisplayName === undefined) {
      return;
    }
    this.writeThreadDisplayName(threadIdentifier, normalizedThreadDisplayName);
  }

  public pruneThreadDisplayNames(retainedThreadIdentifiers: ThreadListItem["id"][]): void {
    const retainedThreadIdentifierSet = new Set<string>(retainedThreadIdentifiers);
    this.threadDisplayNamePreferenceStore.pruneThreadDisplayNames(retainedThreadIdentifiers);
    for (const threadIdentifier of this.displayNameByThreadIdentifier.keys()) {
      if (retainedThreadIdentifierSet.has(threadIdentifier)) {
        continue;
      }
      this.displayNameByThreadIdentifier.delete(threadIdentifier);
    }
  }

  private resolveThreadDisplayName(input: ResolveThreadDisplayNameInput): string | undefined {
    const normalizedServerDisplayName = normalizeOptionalThreadDisplayName(input.serverDisplayName);
    if (normalizedServerDisplayName !== undefined) {
      const cachedThreadDisplayName = this.displayNameByThreadIdentifier.get(
        input.threadIdentifier,
      );
      if (cachedThreadDisplayName === normalizedServerDisplayName) {
        return normalizedServerDisplayName;
      }
      this.threadDisplayNamePreferenceStore.writeThreadDisplayName(
        input.threadIdentifier,
        normalizedServerDisplayName,
      );
      this.displayNameByThreadIdentifier.set(input.threadIdentifier, normalizedServerDisplayName);
      return normalizedServerDisplayName;
    }
    return this.readCachedOrPersistedThreadDisplayName(input.threadIdentifier);
  }

  private readCachedOrPersistedThreadDisplayName(threadIdentifier: string): string | undefined {
    const cachedThreadDisplayName = this.displayNameByThreadIdentifier.get(threadIdentifier);
    if (cachedThreadDisplayName !== undefined) {
      return cachedThreadDisplayName ?? undefined;
    }

    const persistedThreadDisplayName =
      this.threadDisplayNamePreferenceStore.readThreadDisplayName(threadIdentifier);
    this.displayNameByThreadIdentifier.set(threadIdentifier, persistedThreadDisplayName);
    return persistedThreadDisplayName ?? undefined;
  }
}
