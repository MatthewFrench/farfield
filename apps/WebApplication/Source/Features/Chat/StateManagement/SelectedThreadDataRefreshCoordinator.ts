import { isTransientReadThreadError } from "@/Features/Chat/DomainModel/ReadThreadErrorClassifier";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import type {
  ChatLiveStateResponse,
  ChatReadStreamEventsOptions,
  ChatReadThreadOptions,
  ChatReadThreadResponse,
  ChatStreamEventsResponse
} from "../DataAccess/ChatServerClient";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";

type ErrorInput = Error | string | number | boolean | bigint | symbol | null | undefined | object;

export type SelectedThreadLiveStateSnapshot = ChatLiveStateResponse;
export type SelectedThreadStreamEventsSnapshot = ChatStreamEventsResponse;
export type SelectedThreadReadThreadSnapshot = ChatReadThreadResponse;

export interface SelectedThreadDataRefreshChatClient {
  readThread(
    threadId: string,
    options?: ChatReadThreadOptions
  ): Promise<SelectedThreadReadThreadSnapshot>;
  readLiveState(
    threadId: string,
    options?: ApiRequestOptions
  ): Promise<SelectedThreadLiveStateSnapshot>;
  readStreamEvents(
    threadId: string,
    options?: ChatReadStreamEventsOptions
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
  readErrorMessage?: (error: ErrorInput) => string;
  isTransientReadError?: (errorMessage: string) => boolean;
}

const DEFAULT_RETRY_CONFIGURATION: SelectedThreadDataRefreshRetryConfiguration = {
  maximumAttempts: 6,
  baseDelayMilliseconds: 140,
  maximumDelayMilliseconds: 1_000
};

async function waitForMilliseconds(durationMilliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMilliseconds);
  });
}

export class SelectedThreadDataRefreshCoordinator {
  private readonly retryConfiguration: SelectedThreadDataRefreshRetryConfiguration;
  private readonly waitForMilliseconds: (durationMilliseconds: number) => Promise<void>;
  private readonly readErrorMessage: (error: ErrorInput) => string;
  private readonly isTransientReadError: (errorMessage: string) => boolean;

  public constructor(dependencies?: SelectedThreadDataRefreshCoordinatorDependencies) {
    this.retryConfiguration = dependencies?.retryConfiguration ?? DEFAULT_RETRY_CONFIGURATION;
    this.waitForMilliseconds = dependencies?.waitForMilliseconds ?? waitForMilliseconds;
    this.readErrorMessage = dependencies?.readErrorMessage ?? toErrorMessage;
    this.isTransientReadError = dependencies?.isTransientReadError ?? isTransientReadThreadError;
  }

  public async readSnapshot(input: SelectedThreadDataRefreshInput): Promise<SelectedThreadDataRefreshResult> {
    let includeTurnsForRead = input.includeTurns;
    let nextRetryDelayMilliseconds = this.retryConfiguration.baseDelayMilliseconds;
    const readThreadWithRetry = async (): Promise<SelectedThreadReadThreadSnapshot> => {
      for (let attemptIndex = 0; attemptIndex < this.retryConfiguration.maximumAttempts; attemptIndex += 1) {
        try {
          const readOptions = input.signal
            ? {
              includeTurns: includeTurnsForRead,
              signal: input.signal
            }
            : {
              includeTurns: includeTurnsForRead
            };
          return await input.chatClient.readThread(input.threadId, readOptions);
        } catch (error) {
          const errorMessage = this.readErrorMessage(toErrorMessage(error));
          const canRetry = (
            this.isTransientReadError(errorMessage)
            && attemptIndex < this.retryConfiguration.maximumAttempts - 1
          );
          if (!canRetry) {
            throw error;
          }

          includeTurnsForRead = true;
          await this.waitForMilliseconds(nextRetryDelayMilliseconds);
          nextRetryDelayMilliseconds = Math.min(
            nextRetryDelayMilliseconds * 2,
            this.retryConfiguration.maximumDelayMilliseconds
          );
        }
      }

      throw new Error(
        `Failed to read thread after ${String(this.retryConfiguration.maximumAttempts)} attempts`
      );
    };

    const [liveStateSnapshot, streamEventsSnapshot, readThreadSnapshot] = await Promise.all([
      input.canReadLiveState
        ? (
          input.signal
            ? input.chatClient.readLiveState(input.threadId, { signal: input.signal })
            : input.chatClient.readLiveState(input.threadId)
        )
        : Promise.resolve({
          ok: true as const,
          threadId: input.threadId,
          ownerClientId: null,
          conversationState: null,
          liveStateError: null
        }),
      input.canReadStreamEvents
        ? input.chatClient.readStreamEvents(
          input.threadId,
          this.buildStreamEventsRequestOptions(input.streamEventsSinceSequence, input.signal)
        )
        : Promise.resolve({
          ok: true as const,
          threadId: input.threadId,
          ownerClientId: null,
          events: [],
          nextSequence: 0,
          firstAvailableSequence: 0,
          resetRequired: false
        }),
      input.includeReadThread ? readThreadWithRetry() : Promise.resolve(null)
    ]);

    const containsAnyTurns = (
      (liveStateSnapshot.conversationState?.turns.length ?? 0) > 0
      || (readThreadSnapshot?.thread.turns.length ?? 0) > 0
    );

    return {
      liveStateSnapshot,
      streamEventsSnapshot,
      streamEventsSinceSequenceUsed: input.streamEventsSinceSequence,
      readThreadSnapshot,
      includeTurnsUsedForRead: includeTurnsForRead,
      containsAnyTurns
    };
  }

  private buildStreamEventsRequestOptions(
    streamEventsSinceSequence: number | null,
    signal: AbortSignal | undefined
  ): ChatReadStreamEventsOptions {
    return {
      ...(streamEventsSinceSequence !== null ? { sinceSequence: streamEventsSinceSequence } : {}),
      ...(signal ? { signal } : {})
    };
  }
}
