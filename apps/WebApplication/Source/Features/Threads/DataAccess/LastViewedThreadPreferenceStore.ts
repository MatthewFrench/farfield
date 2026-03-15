import { z } from "zod";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";

const LastViewedThreadIdentifierSchema = z.string().trim().min(1);
export const DEFAULT_LAST_VIEWED_THREAD_STORAGE_KEY = "farfield.threads.last-viewed.v1";
const LAST_VIEWED_THREAD_READ_OPERATION = "last-viewed-thread:read";
const LAST_VIEWED_THREAD_WRITE_OPERATION = "last-viewed-thread:write";
const LAST_VIEWED_THREAD_CLEAR_OPERATION = "last-viewed-thread:clear";

export type LastViewedThreadIdentifier = z.infer<typeof LastViewedThreadIdentifierSchema>;

function createLastViewedThreadStorageError<ErrorType>(operation: string, error: ErrorType): Error {
  return new Error(`${operation}: ${toErrorMessage(error).trim()}`);
}

/**
 * Owns browser storage for the most recently selected thread identifier.
 * Route composition can read this owner only when no thread is explicitly present in the URL.
 */
export class LastViewedThreadPreferenceStore {
  private readonly storageKey: string;

  public constructor(storageKey = DEFAULT_LAST_VIEWED_THREAD_STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  public readLastViewedThreadIdentifier(): LastViewedThreadIdentifier | null {
    let rawThreadIdentifier: string | null = null;
    try {
      rawThreadIdentifier = window.localStorage.getItem(this.storageKey);
    } catch (error) {
      throw createLastViewedThreadStorageError(LAST_VIEWED_THREAD_READ_OPERATION, error);
    }
    if (rawThreadIdentifier === null) {
      return null;
    }
    const parsedThreadIdentifier = LastViewedThreadIdentifierSchema.safeParse(rawThreadIdentifier);
    if (!parsedThreadIdentifier.success) {
      throw new Error(
        `Last viewed thread identifier at key "${this.storageKey}" is invalid. Expected a non-empty string.`,
      );
    }
    return parsedThreadIdentifier.data;
  }

  public writeLastViewedThreadIdentifier(threadIdentifier: LastViewedThreadIdentifier): void {
    let parsedThreadIdentifier: LastViewedThreadIdentifier;
    try {
      parsedThreadIdentifier = LastViewedThreadIdentifierSchema.parse(threadIdentifier);
      window.localStorage.setItem(this.storageKey, parsedThreadIdentifier);
    } catch (error) {
      throw createLastViewedThreadStorageError(LAST_VIEWED_THREAD_WRITE_OPERATION, error);
    }
  }

  public clearLastViewedThreadIdentifier(): void {
    try {
      window.localStorage.removeItem(this.storageKey);
    } catch (error) {
      throw createLastViewedThreadStorageError(LAST_VIEWED_THREAD_CLEAR_OPERATION, error);
    }
  }
}
