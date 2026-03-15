import {
  AppServerClient,
  CodexMonitorService,
  DesktopIpcError,
  findLatestTurnParamsTemplate,
} from "@farfield/api";
import type { TurnStartParams } from "@farfield/protocol";
import { logger } from "../../Shared/Logging/Logger.js";
import type { AgentSendMessageInput, AgentThreadConversationState } from "../Types.js";
import type { CodexThreadStreamStateOwner } from "./CodexThreadStreamStateOwner.js";

const RESUME_WITH_EXTENDED_HISTORY = true;
const SEND_MESSAGE_RESUME_RETRY_MAXIMUM_ATTEMPTS = 8;
const SEND_MESSAGE_RESUME_RETRY_BASE_DELAY_MILLISECONDS = 250;
const SEND_MESSAGE_RESUME_RETRY_MAXIMUM_DELAY_MILLISECONDS = 4_000;
const IPC_SEND_MESSAGE_FAILURE_LOG_EVENT = "codex-ipc-send-message-failed";
const TURN_IN_PROGRESS_STATUS = "inProgress";
const TURN_IN_PROGRESS_UNDERSCORE_STATUS = "in_progress";
const STEER_TURN_IDENTIFIER_UNAVAILABLE_ERROR =
  "Cannot steer because there is no in-progress turn for this thread.";

export interface CodexMessageDispatchOwnerOptions {
  appClient: AppServerClient;
  service: CodexMonitorService;
  threadStreamStateOwner: CodexThreadStreamStateOwner;
  runAppServerCall: <ValueType>(operation: () => Promise<ValueType>) => Promise<ValueType>;
  isConversationNotFoundError: <ErrorType>(error: ErrorType) => boolean;
  isThreadNotLoadedError: (error: Error) => boolean;
  waitForMilliseconds?: (durationMilliseconds: number) => Promise<void>;
}

async function waitForMilliseconds(durationMilliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMilliseconds);
  });
}

function computeNextRetryDelayMilliseconds(currentDelayMilliseconds: number): number {
  return Math.min(
    currentDelayMilliseconds * 2,
    SEND_MESSAGE_RESUME_RETRY_MAXIMUM_DELAY_MILLISECONDS,
  );
}

export class CodexMessageDispatchOwner {
  private readonly appClient: AppServerClient;
  private readonly service: CodexMonitorService;
  private readonly threadStreamStateOwner: CodexThreadStreamStateOwner;
  private readonly runAppServerCall: <ValueType>(
    operation: () => Promise<ValueType>,
  ) => Promise<ValueType>;
  private readonly isConversationNotFoundError: <ErrorType>(error: ErrorType) => boolean;
  private readonly isThreadNotLoadedError: (error: Error) => boolean;
  private readonly waitForMilliseconds: (durationMilliseconds: number) => Promise<void>;

  public constructor(options: CodexMessageDispatchOwnerOptions) {
    this.appClient = options.appClient;
    this.service = options.service;
    this.threadStreamStateOwner = options.threadStreamStateOwner;
    this.runAppServerCall = options.runAppServerCall;
    this.isConversationNotFoundError = options.isConversationNotFoundError;
    this.isThreadNotLoadedError = options.isThreadNotLoadedError;
    this.waitForMilliseconds = options.waitForMilliseconds ?? waitForMilliseconds;
  }

  public async sendMessage(input: AgentSendMessageInput, isIpcReady: boolean): Promise<void> {
    if (isIpcReady) {
      const ownerClientId = this.threadStreamStateOwner.resolveKnownOwnerClientId(
        input.threadId,
        input.ownerClientId,
      );

      if (ownerClientId !== null) {
        const turnStartTemplate = this.readTurnStartTemplate(input.threadId);
        const optimisticTurnStartParams = buildOptimisticTurnStartParams(input, turnStartTemplate);
        try {
          await this.service.sendMessage({
            threadId: input.threadId,
            ownerClientId,
            text: input.text,
            ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
            ...(typeof input.isSteering === "boolean" ? { isSteering: input.isSteering } : {}),
            ...(turnStartTemplate !== null ? { turnStartTemplate } : {}),
          });
          this.threadStreamStateOwner.stageOptimisticTurnStart({
            threadId: input.threadId,
            ownerClientId,
            turnStartParams: optimisticTurnStartParams,
            nowMilliseconds: Date.now(),
            isSteering: input.isSteering === true,
          });
          return;
        } catch (error) {
          if (!(error instanceof DesktopIpcError)) {
            throw error;
          }
          logger.warn(
            {
              threadId: input.threadId,
              ownerClientId,
              error: toErrorMessage(error),
            },
            IPC_SEND_MESSAGE_FAILURE_LOG_EVENT,
          );
          this.threadStreamStateOwner.clearThreadOwner(input.threadId);
        }
      }
    }

    let retryDelayMilliseconds = SEND_MESSAGE_RESUME_RETRY_BASE_DELAY_MILLISECONDS;
    for (
      let attemptIndex = 0;
      attemptIndex < SEND_MESSAGE_RESUME_RETRY_MAXIMUM_ATTEMPTS;
      attemptIndex += 1
    ) {
      try {
        await this.sendMessageThroughAppServer(input);
        return;
      } catch (error) {
        if (!this.shouldRetrySendMessageAfterResume(error)) {
          throw error;
        }
        await this.runAppServerCall(() =>
          this.appClient.resumeThread(input.threadId, {
            persistExtendedHistory: RESUME_WITH_EXTENDED_HISTORY,
          }),
        );
        if (attemptIndex >= SEND_MESSAGE_RESUME_RETRY_MAXIMUM_ATTEMPTS - 1) {
          throw error;
        }
        await this.waitForMilliseconds(retryDelayMilliseconds);
        retryDelayMilliseconds = computeNextRetryDelayMilliseconds(retryDelayMilliseconds);
      }
    }
  }

  private shouldRetrySendMessageAfterResume<ErrorType>(error: ErrorType): boolean {
    if (this.isConversationNotFoundError(error)) {
      return true;
    }
    if (error instanceof Error) {
      return this.isThreadNotLoadedError(error);
    }
    return false;
  }

  private async sendMessageThroughAppServer(input: AgentSendMessageInput): Promise<void> {
    if (input.isSteering === true) {
      const expectedTurnId = await this.readSteerExpectedTurnIdentifier(input.threadId);
      await this.runAppServerCall(() =>
        this.appClient.steerTurn(input.threadId, expectedTurnId, input.text),
      );
      return;
    }

    if (this.shouldResumeThreadBeforeAppServerSend(input.threadId)) {
      await this.runAppServerCall(() =>
        this.appClient.resumeThread(input.threadId, {
          persistExtendedHistory: RESUME_WITH_EXTENDED_HISTORY,
        }),
      );
    }

    const turnStartTemplate = this.readTurnStartTemplate(input.threadId);
    const optimisticTurnStartParams = buildOptimisticTurnStartParams(input, turnStartTemplate);
    await this.runAppServerCall(() =>
      this.appClient.startTurn({
        threadId: input.threadId,
        text: input.text,
        ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
        ...(turnStartTemplate !== null ? { turnStartTemplate } : {}),
      }),
    );
    this.threadStreamStateOwner.stageOptimisticTurnStart({
      threadId: input.threadId,
      ownerClientId: this.threadStreamStateOwner.resolveKnownOwnerClientId(
        input.threadId,
        input.ownerClientId,
      ),
      turnStartParams: optimisticTurnStartParams,
      nowMilliseconds: Date.now(),
      isSteering: false,
    });
  }

  private shouldResumeThreadBeforeAppServerSend(threadId: string): boolean {
    return this.threadStreamStateOwner.getProjectedConversationState(threadId) === null;
  }

  private async readSteerExpectedTurnIdentifier(threadId: string): Promise<string> {
    const projectedConversationState =
      this.threadStreamStateOwner.getProjectedConversationState(threadId);
    const projectedTurnIdentifier =
      projectedConversationState === null
        ? null
        : readLatestInProgressTurnIdentifier(projectedConversationState);
    if (projectedTurnIdentifier !== null) {
      return projectedTurnIdentifier;
    }

    const readThreadResponse = await this.runAppServerCall(() =>
      this.appClient.readThread(threadId, true),
    );
    const readThreadTurnIdentifier = readLatestInProgressTurnIdentifier(readThreadResponse.thread);
    if (readThreadTurnIdentifier !== null) {
      return readThreadTurnIdentifier;
    }

    throw new Error(STEER_TURN_IDENTIFIER_UNAVAILABLE_ERROR);
  }

  // Keep the hot send path proportional to stream-owned state. Missing projected params are
  // acceptable; blocking on a full thread reread here would delay POST /messages completion.
  private readTurnStartTemplate(threadId: string): TurnStartParams | null {
    const projectedConversationState =
      this.threadStreamStateOwner.getProjectedConversationState(threadId);

    try {
      if (projectedConversationState) {
        return findLatestTurnParamsTemplate(projectedConversationState);
      }
    } catch {
      return null;
    }

    return null;
  }
}

function buildOptimisticTurnStartParams(
  input: AgentSendMessageInput,
  turnStartTemplate: TurnStartParams | null,
): TurnStartParams {
  const normalizedCwd =
    input.cwd !== undefined && input.cwd.length > 0
      ? input.cwd
      : (turnStartTemplate?.cwd ?? undefined);
  return {
    ...(turnStartTemplate ?? {}),
    threadId: input.threadId,
    input: [
      {
        type: "text",
        text: input.text,
      },
    ],
    ...(normalizedCwd !== undefined ? { cwd: normalizedCwd } : {}),
    attachments: turnStartTemplate?.attachments ?? [],
  };
}

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

function readLatestInProgressTurnIdentifier(
  conversationState: AgentThreadConversationState,
): string | null {
  for (let turnIndex = conversationState.turns.length - 1; turnIndex >= 0; turnIndex -= 1) {
    const turn = conversationState.turns[turnIndex];
    if (turn === undefined) {
      continue;
    }

    const turnIdentifier = turn.turnId ?? turn.id ?? null;
    if (turnIdentifier === null) {
      continue;
    }

    if (
      turn.status === TURN_IN_PROGRESS_STATUS ||
      turn.status === TURN_IN_PROGRESS_UNDERSCORE_STATUS
    ) {
      return turnIdentifier;
    }
  }

  return null;
}
