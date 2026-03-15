import { z } from "zod";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";

const ThreadIdentifierSchema = z.string().trim().min(1);
const ThreadIdentifierCollectionSchema = z.array(ThreadIdentifierSchema);
const EncodedThreadIdentifierSchema = z.string().trim().min(1);
const EncodedThreadIdentifierCollectionSchema = z.array(EncodedThreadIdentifierSchema);
const ThreadDisplayNameSchema = z.string().trim().min(1);
const PositiveIntegerSchema = z.number().int().positive();
export const DEFAULT_THREAD_DISPLAY_NAME_STORAGE_KEY_PREFIX = "farfield.threads.display-name.v1";
export const DEFAULT_THREAD_DISPLAY_NAME_MAXIMUM_ENTRIES = 250;
const THREAD_DISPLAY_NAME_INDEX_STORAGE_KEY_SUFFIX = "index";
const THREAD_DISPLAY_NAME_INDEX_ENTRY_SEPARATOR = "\n";
const THREAD_DISPLAY_NAME_READ_OPERATION = "thread-display-name:read";
const THREAD_DISPLAY_NAME_WRITE_OPERATION = "thread-display-name:write";
const THREAD_DISPLAY_NAME_CLEAR_OPERATION = "thread-display-name:clear";
const THREAD_DISPLAY_NAME_PRUNE_OPERATION = "thread-display-name:prune";

export type ThreadIdentifier = z.infer<typeof ThreadIdentifierSchema>;
export type ThreadDisplayName = z.infer<typeof ThreadDisplayNameSchema>;

interface BoundedEncodedIdentifierCollection {
  boundedEncodedThreadIdentifiers: string[];
  evictedEncodedThreadIdentifiers: string[];
}

function createThreadDisplayNameStorageError<ErrorType>(
  operation: string,
  error: ErrorType,
): Error {
  return new Error(`${operation}: ${toErrorMessage(error).trim()}`);
}

function encodeThreadIdentifier(threadIdentifier: ThreadIdentifier): string {
  return encodeURIComponent(threadIdentifier);
}

function buildDeduplicatedEncodedIdentifierCollection(
  encodedThreadIdentifiers: string[],
): string[] {
  const uniqueEncodedThreadIdentifierSet = new Set<string>();
  const deduplicatedEncodedThreadIdentifiers: string[] = [];

  for (const encodedThreadIdentifier of encodedThreadIdentifiers) {
    if (uniqueEncodedThreadIdentifierSet.has(encodedThreadIdentifier)) {
      continue;
    }
    uniqueEncodedThreadIdentifierSet.add(encodedThreadIdentifier);
    deduplicatedEncodedThreadIdentifiers.push(encodedThreadIdentifier);
  }

  return deduplicatedEncodedThreadIdentifiers;
}

/**
 * Owns browser storage for persisted thread display names keyed by thread identifier.
 * Storage values are strict non-empty strings, parsed at this boundary before callers consume them.
 * The owner also tracks a bounded index so old thread-name entries are removed deterministically.
 */
export class ThreadDisplayNamePreferenceStore {
  private readonly storageKeyPrefix: string;
  private readonly maximumEntries: number;

  public constructor(
    storageKeyPrefix = DEFAULT_THREAD_DISPLAY_NAME_STORAGE_KEY_PREFIX,
    maximumEntries = DEFAULT_THREAD_DISPLAY_NAME_MAXIMUM_ENTRIES,
  ) {
    this.storageKeyPrefix = storageKeyPrefix;
    this.maximumEntries = PositiveIntegerSchema.parse(maximumEntries);
  }

  public readThreadDisplayName(threadIdentifier: ThreadIdentifier): ThreadDisplayName | null {
    const parsedThreadIdentifier = ThreadIdentifierSchema.parse(threadIdentifier);
    const storageKey = this.buildStorageKey(parsedThreadIdentifier);

    let rawThreadDisplayName: string | null = null;
    try {
      rawThreadDisplayName = window.localStorage.getItem(storageKey);
    } catch (error) {
      throw createThreadDisplayNameStorageError(THREAD_DISPLAY_NAME_READ_OPERATION, error);
    }
    if (rawThreadDisplayName === null) {
      return null;
    }

    const parsedThreadDisplayName = ThreadDisplayNameSchema.safeParse(rawThreadDisplayName);
    if (!parsedThreadDisplayName.success) {
      throw new Error(
        `Thread display name at key "${storageKey}" is invalid. Expected a non-empty string.`,
      );
    }
    return parsedThreadDisplayName.data;
  }

  public writeThreadDisplayName(
    threadIdentifier: ThreadIdentifier,
    threadDisplayName: ThreadDisplayName,
  ): void {
    let parsedThreadIdentifier: ThreadIdentifier;
    let parsedThreadDisplayName: ThreadDisplayName;
    try {
      parsedThreadIdentifier = ThreadIdentifierSchema.parse(threadIdentifier);
      parsedThreadDisplayName = ThreadDisplayNameSchema.parse(threadDisplayName);
      const encodedThreadIdentifier = encodeThreadIdentifier(parsedThreadIdentifier);
      window.localStorage.setItem(
        this.buildStorageKey(parsedThreadIdentifier),
        parsedThreadDisplayName,
      );
      this.writeBoundedIndexFromMostRecentlyUpdatedIdentifier(encodedThreadIdentifier);
    } catch (error) {
      throw createThreadDisplayNameStorageError(THREAD_DISPLAY_NAME_WRITE_OPERATION, error);
    }
  }

  public clearThreadDisplayName(threadIdentifier: ThreadIdentifier): void {
    let parsedThreadIdentifier: ThreadIdentifier;
    try {
      parsedThreadIdentifier = ThreadIdentifierSchema.parse(threadIdentifier);
      const encodedThreadIdentifier = encodeThreadIdentifier(parsedThreadIdentifier);
      window.localStorage.removeItem(this.buildStorageKey(parsedThreadIdentifier));
      this.writeIndexWithoutEncodedThreadIdentifier(encodedThreadIdentifier);
    } catch (error) {
      throw createThreadDisplayNameStorageError(THREAD_DISPLAY_NAME_CLEAR_OPERATION, error);
    }
  }

  public pruneThreadDisplayNames(retainedThreadIdentifiers: ThreadIdentifier[]): void {
    let parsedRetainedThreadIdentifiers: ThreadIdentifier[];
    try {
      parsedRetainedThreadIdentifiers =
        ThreadIdentifierCollectionSchema.parse(retainedThreadIdentifiers);
      const retainedEncodedThreadIdentifierSet = new Set<string>(
        parsedRetainedThreadIdentifiers.map((threadIdentifier) =>
          encodeThreadIdentifier(threadIdentifier),
        ),
      );
      const encodedThreadIdentifiers = this.readEncodedThreadIdentifierIndex();
      const nextEncodedThreadIdentifiers = encodedThreadIdentifiers.filter(
        (encodedThreadIdentifier) =>
          retainedEncodedThreadIdentifierSet.has(encodedThreadIdentifier),
      );
      const removedEncodedThreadIdentifiers = encodedThreadIdentifiers.filter(
        (encodedThreadIdentifier) =>
          !retainedEncodedThreadIdentifierSet.has(encodedThreadIdentifier),
      );
      this.removeDisplayNamesByEncodedThreadIdentifier(removedEncodedThreadIdentifiers);
      this.writeEncodedThreadIdentifierIndex(nextEncodedThreadIdentifiers);
    } catch (error) {
      throw createThreadDisplayNameStorageError(THREAD_DISPLAY_NAME_PRUNE_OPERATION, error);
    }
  }

  private writeBoundedIndexFromMostRecentlyUpdatedIdentifier(
    encodedThreadIdentifier: string,
  ): void {
    const existingEncodedThreadIdentifiers = this.readEncodedThreadIdentifierIndex();
    const reorderedEncodedThreadIdentifiers = [
      encodedThreadIdentifier,
      ...existingEncodedThreadIdentifiers.filter(
        (existingEncodedThreadIdentifier) =>
          existingEncodedThreadIdentifier !== encodedThreadIdentifier,
      ),
    ];
    const boundedEncodedIdentifierCollection = this.buildBoundedEncodedIdentifierCollection(
      reorderedEncodedThreadIdentifiers,
    );
    this.removeDisplayNamesByEncodedThreadIdentifier(
      boundedEncodedIdentifierCollection.evictedEncodedThreadIdentifiers,
    );
    this.writeEncodedThreadIdentifierIndex(
      boundedEncodedIdentifierCollection.boundedEncodedThreadIdentifiers,
    );
  }

  private writeIndexWithoutEncodedThreadIdentifier(encodedThreadIdentifier: string): void {
    const existingEncodedThreadIdentifiers = this.readEncodedThreadIdentifierIndex();
    const nextEncodedThreadIdentifiers = existingEncodedThreadIdentifiers.filter(
      (existingEncodedThreadIdentifier) =>
        existingEncodedThreadIdentifier !== encodedThreadIdentifier,
    );
    this.writeEncodedThreadIdentifierIndex(nextEncodedThreadIdentifiers);
  }

  private buildBoundedEncodedIdentifierCollection(
    encodedThreadIdentifiers: string[],
  ): BoundedEncodedIdentifierCollection {
    const deduplicatedEncodedThreadIdentifiers =
      buildDeduplicatedEncodedIdentifierCollection(encodedThreadIdentifiers);
    if (deduplicatedEncodedThreadIdentifiers.length <= this.maximumEntries) {
      return {
        boundedEncodedThreadIdentifiers: deduplicatedEncodedThreadIdentifiers,
        evictedEncodedThreadIdentifiers: [],
      };
    }
    return {
      boundedEncodedThreadIdentifiers: deduplicatedEncodedThreadIdentifiers.slice(
        0,
        this.maximumEntries,
      ),
      evictedEncodedThreadIdentifiers: deduplicatedEncodedThreadIdentifiers.slice(
        this.maximumEntries,
      ),
    };
  }

  private removeDisplayNamesByEncodedThreadIdentifier(encodedThreadIdentifiers: string[]): void {
    for (const encodedThreadIdentifier of encodedThreadIdentifiers) {
      window.localStorage.removeItem(
        this.buildStorageKeyFromEncodedThreadIdentifier(encodedThreadIdentifier),
      );
    }
  }

  private readEncodedThreadIdentifierIndex(): string[] {
    const indexStorageKey = this.buildIndexStorageKey();
    const rawIndexValue = window.localStorage.getItem(indexStorageKey);
    if (rawIndexValue === null || rawIndexValue.trim().length === 0) {
      return [];
    }
    const parsedEncodedThreadIdentifiers = EncodedThreadIdentifierCollectionSchema.parse(
      rawIndexValue
        .split(THREAD_DISPLAY_NAME_INDEX_ENTRY_SEPARATOR)
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    );
    return buildDeduplicatedEncodedIdentifierCollection(parsedEncodedThreadIdentifiers);
  }

  private writeEncodedThreadIdentifierIndex(encodedThreadIdentifiers: string[]): void {
    const deduplicatedEncodedThreadIdentifiers = buildDeduplicatedEncodedIdentifierCollection(
      EncodedThreadIdentifierCollectionSchema.parse(encodedThreadIdentifiers),
    );
    const indexStorageKey = this.buildIndexStorageKey();
    if (deduplicatedEncodedThreadIdentifiers.length === 0) {
      window.localStorage.removeItem(indexStorageKey);
      return;
    }
    window.localStorage.setItem(
      indexStorageKey,
      deduplicatedEncodedThreadIdentifiers.join(THREAD_DISPLAY_NAME_INDEX_ENTRY_SEPARATOR),
    );
  }

  private buildStorageKey(threadIdentifier: ThreadIdentifier): string {
    return this.buildStorageKeyFromEncodedThreadIdentifier(
      encodeThreadIdentifier(threadIdentifier),
    );
  }

  private buildStorageKeyFromEncodedThreadIdentifier(encodedThreadIdentifier: string): string {
    return `${this.storageKeyPrefix}.${encodedThreadIdentifier}`;
  }

  private buildIndexStorageKey(): string {
    return `${this.storageKeyPrefix}.${THREAD_DISPLAY_NAME_INDEX_STORAGE_KEY_SUFFIX}`;
  }
}
