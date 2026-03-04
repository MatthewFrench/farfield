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
  baselineLiveStateSnapshot?: SelectedThreadLiveStateSnapshot | null;
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
const SNAPSHOT_READ_RETRY_MAXIMUM_ATTEMPTS = 2;
const SNAPSHOT_READ_RETRY_BASE_DELAY_MILLISECONDS = 120;
const SNAPSHOT_READ_RETRY_MAXIMUM_DELAY_MILLISECONDS = 320;
const STREAM_EVENTS_EMPTY_SEQUENCE = 0;
const READ_THREAD_RETRY_BACKOFF_MULTIPLIER = 2;
const LIVE_STATE_ROUTE_SEGMENT = "/live-state";
const STREAM_EVENTS_ROUTE_SEGMENT = "/stream-events";
const FAILED_TO_FETCH_STATUS_NA_ERROR_PATTERN = "failed to fetch status=n/a";
const REQUEST_TIMED_OUT_ERROR_PATTERN = "request timed out for";
const INVALID_JSON_RESPONSE_ERROR_PATTERN = "invalid json response from";
const EMPTY_RESPONSE_STATUS_200_ERROR_PATTERN = "empty response status=200";
const STATUS_502_ERROR_PATTERN = "status=502";
const STATUS_503_ERROR_PATTERN = "status=503";
const STATUS_504_ERROR_PATTERN = "status=504";

async function waitForMilliseconds(durationMilliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMilliseconds);
  });
}

function isTransientSnapshotReadError(errorMessage: string): boolean {
  const normalizedErrorMessage = errorMessage.toLowerCase();
  const targetsLiveState =
    normalizedErrorMessage.includes(LIVE_STATE_ROUTE_SEGMENT) ||
    normalizedErrorMessage.includes(STREAM_EVENTS_ROUTE_SEGMENT);
  if (!targetsLiveState) {
    return false;
  }

  if (normalizedErrorMessage.includes(FAILED_TO_FETCH_STATUS_NA_ERROR_PATTERN)) {
    return true;
  }
  if (normalizedErrorMessage.includes(REQUEST_TIMED_OUT_ERROR_PATTERN)) {
    return true;
  }
  if (!normalizedErrorMessage.includes(INVALID_JSON_RESPONSE_ERROR_PATTERN)) {
    return false;
  }
  if (normalizedErrorMessage.includes(EMPTY_RESPONSE_STATUS_200_ERROR_PATTERN)) {
    return true;
  }

  return (
    normalizedErrorMessage.includes(STATUS_502_ERROR_PATTERN) ||
    normalizedErrorMessage.includes(STATUS_503_ERROR_PATTERN) ||
    normalizedErrorMessage.includes(STATUS_504_ERROR_PATTERN)
  );
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

    if (this.shouldReadStreamEventsBeforeLiveState(input)) {
      const streamEventsSnapshot = await this.readStreamEventsSnapshot(input);
      const [liveStateSnapshot, readThreadSnapshotResult] = await Promise.all([
        this.readLiveStateSnapshotAfterStreamRead(input, streamEventsSnapshot),
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

  private shouldReadStreamEventsBeforeLiveState(input: SelectedThreadDataRefreshInput): boolean {
    return (
      input.canReadLiveState &&
      input.canReadStreamEvents &&
      !input.includeReadThread &&
      input.streamEventsSinceSequence !== null &&
      input.baselineLiveStateSnapshot !== null &&
      input.baselineLiveStateSnapshot !== undefined
    );
  }

  private async readLiveStateSnapshotAfterStreamRead(
    input: SelectedThreadDataRefreshInput,
    streamEventsSnapshot: SelectedThreadStreamEventsSnapshot,
  ): Promise<SelectedThreadLiveStateSnapshot> {
    if (
      input.baselineLiveStateSnapshot !== null &&
      input.baselineLiveStateSnapshot !== undefined &&
      !streamEventsSnapshot.resetRequired &&
      streamEventsSnapshot.events.length === 0
    ) {
      return input.baselineLiveStateSnapshot;
    }
    return this.readLiveStateSnapshot(input);
  }

  private async readLiveStateSnapshot(
    input: SelectedThreadDataRefreshInput,
  ): Promise<SelectedThreadLiveStateSnapshot> {
    if (!input.canReadLiveState) {
      return buildUnreadableLiveStateSnapshot(input.threadId);
    }
    return this.readSnapshotReadWithRetry({
      readSnapshot: () => {
        if (!input.signal) {
          return input.chatClient.readLiveState(input.threadId);
        }
        return input.chatClient.readLiveState(input.threadId, {
          signal: input.signal,
        });
      },
    });
  }

  private async readStreamEventsSnapshot(
    input: SelectedThreadDataRefreshInput,
  ): Promise<SelectedThreadStreamEventsSnapshot> {
    if (!input.canReadStreamEvents) {
      return buildUnreadableStreamEventsSnapshot(input.threadId);
    }
    return this.readSnapshotReadWithRetry({
      readSnapshot: () =>
        input.chatClient.readStreamEvents(
          input.threadId,
          this.buildStreamEventsRequestOptions(input.streamEventsSinceSequence, input.signal),
        ),
    });
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

  private async readSnapshotReadWithRetry<SnapshotType>(input: {
    readSnapshot: () => Promise<SnapshotType>;
  }): Promise<SnapshotType> {
    let nextRetryDelayMilliseconds = SNAPSHOT_READ_RETRY_BASE_DELAY_MILLISECONDS;
    for (
      let attemptIndex = 0;
      attemptIndex < SNAPSHOT_READ_RETRY_MAXIMUM_ATTEMPTS;
      attemptIndex += 1
    ) {
      try {
        return await input.readSnapshot();
      } catch (error) {
        if (!this.canRetrySnapshotRead(error, attemptIndex)) {
          throw error;
        }
        await this.waitForMilliseconds(nextRetryDelayMilliseconds);
        nextRetryDelayMilliseconds = this.computeNextSnapshotReadRetryDelayMilliseconds(
          nextRetryDelayMilliseconds,
        );
      }
    }

    throw new Error(
      `Failed to read selected thread snapshot after ${String(SNAPSHOT_READ_RETRY_MAXIMUM_ATTEMPTS)} attempts`,
    );
  }

  private canRetrySnapshotRead<ErrorType>(error: ErrorType, attemptIndex: number): boolean {
    if (attemptIndex >= SNAPSHOT_READ_RETRY_MAXIMUM_ATTEMPTS - 1) {
      return false;
    }
    return isTransientSnapshotReadError(toErrorMessage(error));
  }

  private computeNextSnapshotReadRetryDelayMilliseconds(currentDelayMilliseconds: number): number {
    return Math.min(
      currentDelayMilliseconds * READ_THREAD_RETRY_BACKOFF_MULTIPLIER,
      SNAPSHOT_READ_RETRY_MAXIMUM_DELAY_MILLISECONDS,
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
