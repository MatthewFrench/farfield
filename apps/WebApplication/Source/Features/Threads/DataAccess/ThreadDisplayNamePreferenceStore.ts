import { z } from "zod";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";

const ThreadIdentifierSchema = z.string().trim().min(1);
const ThreadDisplayNameSchema = z.string().trim().min(1);
export const DEFAULT_THREAD_DISPLAY_NAME_STORAGE_KEY_PREFIX = "farfield.threads.display-name.v1";
const THREAD_DISPLAY_NAME_READ_OPERATION = "thread-display-name:read";
const THREAD_DISPLAY_NAME_WRITE_OPERATION = "thread-display-name:write";
const THREAD_DISPLAY_NAME_CLEAR_OPERATION = "thread-display-name:clear";

export type ThreadIdentifier = z.infer<typeof ThreadIdentifierSchema>;
export type ThreadDisplayName = z.infer<typeof ThreadDisplayNameSchema>;

function createThreadDisplayNameStorageError<ErrorType>(
  operation: string,
  error: ErrorType,
): Error {
  return new Error(`${operation}: ${toErrorMessage(error).trim()}`);
}

function encodeThreadIdentifier(threadIdentifier: ThreadIdentifier): string {
  return encodeURIComponent(threadIdentifier);
}

/**
 * Owns browser storage for persisted thread display names keyed by thread identifier.
 * Storage values are strict non-empty strings, parsed at this boundary before callers consume them.
 */
export class ThreadDisplayNamePreferenceStore {
  private readonly storageKeyPrefix: string;

  public constructor(storageKeyPrefix = DEFAULT_THREAD_DISPLAY_NAME_STORAGE_KEY_PREFIX) {
    this.storageKeyPrefix = storageKeyPrefix;
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
      window.localStorage.setItem(
        this.buildStorageKey(parsedThreadIdentifier),
        parsedThreadDisplayName,
      );
    } catch (error) {
      throw createThreadDisplayNameStorageError(THREAD_DISPLAY_NAME_WRITE_OPERATION, error);
    }
  }

  public clearThreadDisplayName(threadIdentifier: ThreadIdentifier): void {
    let parsedThreadIdentifier: ThreadIdentifier;
    try {
      parsedThreadIdentifier = ThreadIdentifierSchema.parse(threadIdentifier);
      window.localStorage.removeItem(this.buildStorageKey(parsedThreadIdentifier));
    } catch (error) {
      throw createThreadDisplayNameStorageError(THREAD_DISPLAY_NAME_CLEAR_OPERATION, error);
    }
  }

  private buildStorageKey(threadIdentifier: ThreadIdentifier): string {
    return `${this.storageKeyPrefix}.${encodeThreadIdentifier(threadIdentifier)}`;
  }
}
