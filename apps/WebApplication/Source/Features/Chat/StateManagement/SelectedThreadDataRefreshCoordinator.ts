import { isTransientReadThreadError } from "@/Features/Chat/DomainModel/ReadThreadErrorClassifier";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import type {
  ChatLiveStateResponse,
  ChatReadStreamEventsOptions,
  ChatReadThreadOptions,
  ChatReadThreadResponse,
  ChatStreamEventsResponse,
} from "../DataAccess/ChatServerClient";

export type SelectedThreadLiveStateSnapshot = ChatLiveStateResponse;
export type SelectedThreadStreamEventsSnapshot = ChatStreamEventsResponse;
export type SelectedThreadReadThreadSnapshot = ChatReadThreadResponse;

export interface SelectedThreadDataRefreshChatClient {
  readThread(
    threadId: string,
    options?: ChatReadThreadOptions,
  ): Promise<SelectedThreadReadThreadSnapshot>;
  readLiveState(
    threadId: string,
    options?: ApiRequestOptions,
  ): Promise<SelectedThreadLiveStateSnapshot>;
  readStreamEvents(
    threadId: string,
    options?: ChatReadStreamEventsOptions,
  ): Promise<SelectedThreadStreamEventsSnapshot>;
}

export interface SelectedThreadDataRefreshRetryConfiguration {
  maximumAttempts: number;
  baseDelayMilliseconds: number;
  maximumDelayMilliseconds: number;
}

export interface SelectedThreadDataRefreshInput {
  threadId: string;
  includeTurns: boolean;
  includeReadThread: boolean;
  canReadLiveState: boolean;
  canReadStreamEvents: boolean;
  streamEventsSinceSequence: number | null;
  chatClient: SelectedThreadDataRefreshChatClient;
  signal?: AbortSignal;
}

export interface SelectedThreadDataRefreshResult {
  liveStateSnapshot: SelectedThreadLiveStateSnapshot;
  streamEventsSnapshot: SelectedThreadStreamEventsSnapshot;
  streamEventsSinceSequenceUsed: number | null;
  readThreadSnapshot: SelectedThreadReadThreadSnapshot | null;
  includeTurnsUsedForRead: boolean;
  containsAnyTurns: boolean;
}

interface SelectedThreadDataRefreshCoordinatorDependencies {
  retryConfiguration?: SelectedThreadDataRefreshRetryConfiguration;
  waitForMilliseconds?: (durationMilliseconds: number) => Promise<void>;
  isTransientReadError?: (errorMessage: string) => boolean;
}

interface SelectedThreadReadThreadSnapshotResult {
  readThreadSnapshot: SelectedThreadReadThreadSnapshot | null;
  includeTurnsUsedForRead: boolean;
}

interface SelectedThreadReadThreadRetryState {
  includeTurnsForRead: boolean;
  nextRetryDelayMilliseconds: number;
}

const DEFAULT_RETRY_CONFIGURATION: SelectedThreadDataRefreshRetryConfiguration = {
  maximumAttempts: 6,
  baseDelayMilliseconds: 140,
  maximumDelayMilliseconds: 1_000,
};
const STREAM_EVENTS_EMPTY_SEQUENCE = 0;
const READ_THREAD_RETRY_BACKOFF_MULTIPLIER = 2;

async function waitForMilliseconds(durationMilliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMilliseconds);
  });
}

function buildUnreadableLiveStateSnapshot(threadId: string): SelectedThreadLiveStateSnapshot {
  return {
    ok: true,
    threadId,
    ownerClientId: null,
    conversationState: null,
    liveStateError: null,
  };
}

function buildUnreadableStreamEventsSnapshot(threadId: string): SelectedThreadStreamEventsSnapshot {
  return {
    ok: true,
    threadId,
    ownerClientId: null,
    events: [],
    nextSequence: STREAM_EVENTS_EMPTY_SEQUENCE,
    firstAvailableSequence: STREAM_EVENTS_EMPTY_SEQUENCE,
    resetRequired: false,
  };
}

/**
 * Owns selected-thread refresh reads and deterministic retry behavior for read-thread snapshots.
 * The coordinator returns explicit default snapshots when a capability is unavailable.
 */
export class SelectedThreadDataRefreshCoordinator {
  private readonly retryConfiguration: SelectedThreadDataRefreshRetryConfiguration;
  private readonly waitForMilliseconds: (durationMilliseconds: number) => Promise<void>;
  private readonly isTransientReadError: (errorMessage: string) => boolean;

  public constructor(dependencies?: SelectedThreadDataRefreshCoordinatorDependencies) {
    this.retryConfiguration = dependencies?.retryConfiguration ?? DEFAULT_RETRY_CONFIGURATION;
    this.waitForMilliseconds = dependencies?.waitForMilliseconds ?? waitForMilliseconds;
    this.isTransientReadError = dependencies?.isTransientReadError ?? isTransientReadThreadError;
  }

  public async readSnapshot(
    input: SelectedThreadDataRefreshInput,
  ): Promise<SelectedThreadDataRefreshResult> {
    const readThreadSnapshotPromise: Promise<SelectedThreadReadThreadSnapshotResult> =
      input.includeReadThread
        ? this.readThreadSnapshotWithRetry(input)
        : Promise.resolve({
            readThreadSnapshot: null,
            includeTurnsUsedForRead: input.includeTurns,
          });

    const [liveStateSnapshot, streamEventsSnapshot, readThreadSnapshotResult] = await Promise.all([
      this.readLiveStateSnapshot(input),
      this.readStreamEventsSnapshot(input),
      readThreadSnapshotPromise,
    ]);

    return {
      liveStateSnapshot,
      streamEventsSnapshot,
      streamEventsSinceSequenceUsed: input.streamEventsSinceSequence,
      readThreadSnapshot: readThreadSnapshotResult.readThreadSnapshot,
      includeTurnsUsedForRead: readThreadSnapshotResult.includeTurnsUsedForRead,
      containsAnyTurns: this.hasAnyTurns(
        liveStateSnapshot,
        readThreadSnapshotResult.readThreadSnapshot,
      ),
    };
  }

  private async readLiveStateSnapshot(
    input: SelectedThreadDataRefreshInput,
  ): Promise<SelectedThreadLiveStateSnapshot> {
    if (!input.canReadLiveState) {
      return buildUnreadableLiveStateSnapshot(input.threadId);
    }
    if (!input.signal) {
      return input.chatClient.readLiveState(input.threadId);
    }
    return input.chatClient.readLiveState(input.threadId, { signal: input.signal });
  }

  private async readStreamEventsSnapshot(
    input: SelectedThreadDataRefreshInput,
  ): Promise<SelectedThreadStreamEventsSnapshot> {
    if (!input.canReadStreamEvents) {
      return buildUnreadableStreamEventsSnapshot(input.threadId);
    }
    return input.chatClient.readStreamEvents(
      input.threadId,
      this.buildStreamEventsRequestOptions(input.streamEventsSinceSequence, input.signal),
    );
  }

  private async readThreadSnapshotWithRetry(
    input: SelectedThreadDataRefreshInput,
  ): Promise<SelectedThreadReadThreadSnapshotResult> {
    const retryState: SelectedThreadReadThreadRetryState = {
      includeTurnsForRead: input.includeTurns,
      nextRetryDelayMilliseconds: this.retryConfiguration.baseDelayMilliseconds,
    };

    for (
      let attemptIndex = 0;
      attemptIndex < this.retryConfiguration.maximumAttempts;
      attemptIndex += 1
    ) {
      try {
        const readThreadSnapshot = await input.chatClient.readThread(
          input.threadId,
          this.buildReadThreadRequestOptions(retryState.includeTurnsForRead, input.signal),
        );
        return {
          readThreadSnapshot,
          includeTurnsUsedForRead: retryState.includeTurnsForRead,
        };
      } catch (error) {
        if (!this.canRetryReadThread(error, attemptIndex)) {
          throw error;
        }

        // Retrying read-thread with turns guarantees downstream snapshot consumers get full turn state.
        retryState.includeTurnsForRead = true;
        await this.waitForMilliseconds(retryState.nextRetryDelayMilliseconds);
        retryState.nextRetryDelayMilliseconds = this.computeNextRetryDelayMilliseconds(
          retryState.nextRetryDelayMilliseconds,
        );
      }
    }

    throw new Error(
      `Failed to read thread after ${String(this.retryConfiguration.maximumAttempts)} attempts`,
    );
  }

  private canRetryReadThread<ErrorType>(error: ErrorType, attemptIndex: number): boolean {
    if (attemptIndex >= this.retryConfiguration.maximumAttempts - 1) {
      return false;
    }
    return this.isTransientReadError(toErrorMessage(error));
  }

  private computeNextRetryDelayMilliseconds(currentDelayMilliseconds: number): number {
    return Math.min(
      currentDelayMilliseconds * READ_THREAD_RETRY_BACKOFF_MULTIPLIER,
      this.retryConfiguration.maximumDelayMilliseconds,
    );
  }

  private hasAnyTurns(
    liveStateSnapshot: SelectedThreadLiveStateSnapshot,
    readThreadSnapshot: SelectedThreadReadThreadSnapshot | null,
  ): boolean {
    return (
      (liveStateSnapshot.conversationState?.turns.length ?? 0) > 0 ||
      (readThreadSnapshot?.thread.turns.length ?? 0) > 0
    );
  }

  private buildReadThreadRequestOptions(
    includeTurns: boolean,
    signal: AbortSignal | undefined,
  ): ChatReadThreadOptions {
    if (!signal) {
      return { includeTurns };
    }
    return {
      includeTurns,
      signal,
    };
  }

  private buildStreamEventsRequestOptions(
    streamEventsSinceSequence: number | null,
    signal: AbortSignal | undefined,
  ): ChatReadStreamEventsOptions {
    const options: ChatReadStreamEventsOptions = {};
    if (streamEventsSinceSequence !== null) {
      options.sinceSequence = streamEventsSinceSequence;
    }
    if (signal) {
      options.signal = signal;
    }
    return options;
  }
}
