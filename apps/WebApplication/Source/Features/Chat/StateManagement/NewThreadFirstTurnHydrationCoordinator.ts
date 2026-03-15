import {
  isThreadStillMaterializingReadError,
  isTransientReadThreadError,
} from "@/Features/Chat/DomainModel/ReadThreadErrorClassifier";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import { isRequestCanceledError } from "@/Shared/Errors/RequestCanceledError";
import { type LoadSelectedThreadOptions } from "./UseSelectedThreadLoaders";

const DEFAULT_INITIAL_RETRY_DELAY_MILLISECONDS = 400;
const DEFAULT_MAXIMUM_RETRY_DELAY_MILLISECONDS = 4_000;
const DEFAULT_MAXIMUM_ATTEMPTS = 10;
const FULL_THREAD_READ_STATUS_500_PATTERN =
  /^Request failed for \/api\/threads\/[^?\s]+\?includeTurns=true status=500\b/i;

export interface NewThreadFirstTurnHydrationCoordinatorDependencies {
  reloadSelectedThread: (threadId: string, options?: LoadSelectedThreadOptions) => Promise<void>;
  readThreadWithoutTurns: (threadId: string) => Promise<{
    thread: {
      preview: string | undefined;
      status:
        | {
            type: string;
          }
        | undefined;
    };
  }>;
  waitForMilliseconds?: (durationMilliseconds: number) => Promise<void>;
}

async function waitForMilliseconds(durationMilliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMilliseconds);
  });
}

function isRetryableHydrationError(errorMessage: string): boolean {
  return (
    isTransientReadThreadError(errorMessage) ||
    isThreadStillMaterializingReadError(errorMessage) ||
    FULL_THREAD_READ_STATUS_500_PATTERN.test(errorMessage)
  );
}

function isThreadPreviewReady(preview: string | undefined): boolean {
  if (preview === undefined) {
    return false;
  }
  return preview.trim().length > 0;
}

function isThreadIdle(statusType: string | undefined): boolean {
  return statusType === "idle";
}

/**
 * Owns delayed full-turn hydration retries for browser-created threads after the first send.
 * The interactive send path only performs the safe no-turn reload; this owner retries full reads
 * in the background until the first turn becomes readable or the retry budget is exhausted.
 */
export class NewThreadFirstTurnHydrationCoordinator {
  private deps: NewThreadFirstTurnHydrationCoordinatorDependencies;
  private readonly activeRunTokenByThreadId = new Map<string, number>();
  private nextRunToken = 1;

  public constructor(dependencies: NewThreadFirstTurnHydrationCoordinatorDependencies) {
    this.deps = dependencies;
  }

  public updateDependencies(
    dependencies: NewThreadFirstTurnHydrationCoordinatorDependencies,
  ): void {
    this.deps = dependencies;
  }

  public scheduleHydration(threadId: string): void {
    const runToken = this.nextRunToken;
    this.nextRunToken += 1;
    this.activeRunTokenByThreadId.set(threadId, runToken);
    void this.runHydration(threadId, runToken);
  }

  public cancelThread(threadId: string): void {
    this.activeRunTokenByThreadId.delete(threadId);
  }

  private async runHydration(threadId: string, runToken: number): Promise<void> {
    let retryDelayMilliseconds = DEFAULT_INITIAL_RETRY_DELAY_MILLISECONDS;

    for (let attemptIndex = 0; attemptIndex < DEFAULT_MAXIMUM_ATTEMPTS; attemptIndex += 1) {
      await (this.deps.waitForMilliseconds ?? waitForMilliseconds)(retryDelayMilliseconds);
      if (!this.isActiveRun(threadId, runToken)) {
        return;
      }

      try {
        const previewRead = await this.deps.readThreadWithoutTurns(threadId);
        if (
          !isThreadPreviewReady(previewRead.thread.preview) ||
          !isThreadIdle(previewRead.thread.status?.type)
        ) {
          retryDelayMilliseconds = Math.min(
            retryDelayMilliseconds * 2,
            DEFAULT_MAXIMUM_RETRY_DELAY_MILLISECONDS,
          );
          continue;
        }
        await this.deps.reloadSelectedThread(threadId, { includeTurns: true });
        this.clearActiveRun(threadId, runToken);
        return;
      } catch (error) {
        if (error instanceof Error && isRequestCanceledError(error)) {
          this.clearActiveRun(threadId, runToken);
          return;
        }
        const errorMessage = toErrorMessage(error);
        if (
          attemptIndex >= DEFAULT_MAXIMUM_ATTEMPTS - 1 ||
          !isRetryableHydrationError(errorMessage)
        ) {
          this.clearActiveRun(threadId, runToken);
          return;
        }
      }

      retryDelayMilliseconds = Math.min(
        retryDelayMilliseconds * 2,
        DEFAULT_MAXIMUM_RETRY_DELAY_MILLISECONDS,
      );
    }

    this.clearActiveRun(threadId, runToken);
  }

  private isActiveRun(threadId: string, runToken: number): boolean {
    return this.activeRunTokenByThreadId.get(threadId) === runToken;
  }

  private clearActiveRun(threadId: string, runToken: number): void {
    if (!this.isActiveRun(threadId, runToken)) {
      return;
    }
    this.activeRunTokenByThreadId.delete(threadId);
  }
}
