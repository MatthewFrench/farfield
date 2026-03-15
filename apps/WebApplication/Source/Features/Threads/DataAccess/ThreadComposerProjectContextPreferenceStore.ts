import { z } from "zod";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";

const ThreadComposerProjectContextSchema = z.string().trim().min(1);
export const DEFAULT_THREAD_COMPOSER_PROJECT_CONTEXT_STORAGE_KEY =
  "farfield.threads.composer-project-context.v1";
const READ_OPERATION = "thread-composer-project-context:read";
const WRITE_OPERATION = "thread-composer-project-context:write";
const CLEAR_OPERATION = "thread-composer-project-context:clear";

export type ThreadComposerProjectContext = z.infer<typeof ThreadComposerProjectContextSchema>;

function createThreadComposerProjectContextStorageError<ErrorType>(
  operation: string,
  error: ErrorType,
): Error {
  return new Error(`${operation}: ${toErrorMessage(error).trim()}`);
}

/**
 * Owns browser persistence for the current project context used by composer-driven thread creation.
 * The stored value is parsed at this boundary so state owners only consume a trusted project path.
 */
export class ThreadComposerProjectContextPreferenceStore {
  private readonly storageKey: string;

  public constructor(storageKey = DEFAULT_THREAD_COMPOSER_PROJECT_CONTEXT_STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  public readProjectContext(): ThreadComposerProjectContext | null {
    let rawProjectContext: string | null = null;
    try {
      rawProjectContext = window.localStorage.getItem(this.storageKey);
    } catch (error) {
      throw createThreadComposerProjectContextStorageError(READ_OPERATION, error);
    }
    if (rawProjectContext === null) {
      return null;
    }

    const parsedProjectContext = ThreadComposerProjectContextSchema.safeParse(rawProjectContext);
    if (!parsedProjectContext.success) {
      throw new Error(
        `Thread composer project context at key "${this.storageKey}" is invalid. Expected a non-empty string.`,
      );
    }
    return parsedProjectContext.data;
  }

  public writeProjectContext(projectContext: ThreadComposerProjectContext): void {
    try {
      const parsedProjectContext = ThreadComposerProjectContextSchema.parse(projectContext);
      window.localStorage.setItem(this.storageKey, parsedProjectContext);
    } catch (error) {
      throw createThreadComposerProjectContextStorageError(WRITE_OPERATION, error);
    }
  }

  public clearProjectContext(): void {
    try {
      window.localStorage.removeItem(this.storageKey);
    } catch (error) {
      throw createThreadComposerProjectContextStorageError(CLEAR_OPERATION, error);
    }
  }
}
