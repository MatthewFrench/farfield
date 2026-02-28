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
const APP_SERVER_OWNER_CLIENT_IDENTIFIER = "app-server";
const IPC_SEND_MESSAGE_FAILURE_LOG_EVENT = "codex-ipc-send-message-failed";
const TURN_START_TEMPLATE_UNAVAILABLE_LOG_EVENT = "codex-turn-start-template-unavailable";
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
}

export class CodexMessageDispatchOwner {
  private readonly appClient: AppServerClient;
  private readonly service: CodexMonitorService;
  private readonly threadStreamStateOwner: CodexThreadStreamStateOwner;
  private readonly runAppServerCall: <ValueType>(
    operation: () => Promise<ValueType>,
  ) => Promise<ValueType>;
  private readonly isConversationNotFoundError: <ErrorType>(error: ErrorType) => boolean;

  public constructor(options: CodexMessageDispatchOwnerOptions) {
    this.appClient = options.appClient;
    this.service = options.service;
    this.threadStreamStateOwner = options.threadStreamStateOwner;
    this.runAppServerCall = options.runAppServerCall;
    this.isConversationNotFoundError = options.isConversationNotFoundError;
  }

  public async sendMessage(input: AgentSendMessageInput, isIpcReady: boolean): Promise<void> {
    if (isIpcReady) {
      const ownerClientId = this.threadStreamStateOwner.resolveKnownOwnerClientId(
        input.threadId,
        input.ownerClientId,
      );

      if (ownerClientId !== null) {
        const turnStartTemplate = await this.readTurnStartTemplate(input.threadId, ownerClientId);
        try {
          await this.service.sendMessage({
            threadId: input.threadId,
            ownerClientId,
            text: input.text,
            ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
            ...(typeof input.isSteering === "boolean" ? { isSteering: input.isSteering } : {}),
            turnStartTemplate,
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

    try {
      await this.sendMessageThroughAppServer(input);
      return;
    } catch (error) {
      if (!this.isConversationNotFoundError(error)) {
        throw error;
      }
    }

    await this.runAppServerCall(() =>
      this.appClient.resumeThread(input.threadId, {
        persistExtendedHistory: RESUME_WITH_EXTENDED_HISTORY,
      }),
    );
    await this.sendMessageThroughAppServer(input);
  }

  private async sendMessageThroughAppServer(input: AgentSendMessageInput): Promise<void> {
    if (input.isSteering === true) {
      const expectedTurnId = await this.readSteerExpectedTurnIdentifier(input.threadId);
      await this.runAppServerCall(() =>
        this.appClient.steerTurn(input.threadId, expectedTurnId, input.text),
      );
      return;
    }

    const turnStartTemplate = await this.readTurnStartTemplate(
      input.threadId,
      APP_SERVER_OWNER_CLIENT_IDENTIFIER,
    );
    await this.runAppServerCall(() =>
      this.appClient.startTurn({
        threadId: input.threadId,
        text: input.text,
        ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
        ...(turnStartTemplate !== null ? { turnStartTemplate } : {}),
      }),
    );
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

  private async readTurnStartTemplate(
    threadId: string,
    ownerClientId: string,
  ): Promise<TurnStartParams | null> {
    let turnStartTemplate: TurnStartParams | null = null;
    const projectedConversationState =
      this.threadStreamStateOwner.getProjectedConversationState(threadId);

    try {
      if (projectedConversationState) {
        turnStartTemplate = findLatestTurnParamsTemplate(projectedConversationState);
      }
    } catch {
      turnStartTemplate = null;
    }

    if (turnStartTemplate) {
      return turnStartTemplate;
    }

    try {
      const readResult = await this.runAppServerCall(() =>
        this.appClient.readThread(threadId, true),
      );
      return findLatestTurnParamsTemplate(readResult.thread);
    } catch (error) {
      logger.debug(
        {
          threadId,
          ownerClientId,
          error: toErrorMessage(error),
        },
        TURN_START_TEMPLATE_UNAVAILABLE_LOG_EVENT,
      );
      return null;
    }
  }
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
