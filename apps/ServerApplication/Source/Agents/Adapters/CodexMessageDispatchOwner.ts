import {
  AppServerClient,
  CodexMonitorService,
  DesktopIpcError,
  findLatestTurnParamsTemplate
} from "@farfield/api";
import type { TurnStartParams } from "@farfield/protocol";
import { logger } from "../../Logger.js";
import type { AgentSendMessageInput } from "../Types.js";
import type { CodexThreadStreamStateOwner } from "./CodexThreadStreamStateOwner.js";

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
  private readonly runAppServerCall: <ValueType>(operation: () => Promise<ValueType>) => Promise<ValueType>;
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
        input.ownerClientId
      );

      if (ownerClientId) {
        const turnStartTemplate = await this.readTurnStartTemplate(input.threadId, ownerClientId);
        try {
          await this.service.sendMessage({
            threadId: input.threadId,
            ownerClientId,
            text: input.text,
            ...(input.cwd ? { cwd: input.cwd } : {}),
            ...(typeof input.isSteering === "boolean" ? { isSteering: input.isSteering } : {}),
            turnStartTemplate
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
              error: toErrorMessage(error)
            },
            "codex-ipc-send-message-failed"
          );
          this.threadStreamStateOwner.clearThreadOwner(input.threadId);
        }
      }
    }

    try {
      await this.runAppServerCall(() =>
        this.appClient.sendUserMessage(input.threadId, input.text)
      );
      return;
    } catch (error) {
      if (!this.isConversationNotFoundError(error)) {
        throw error;
      }
    }

    await this.runAppServerCall(() =>
      this.appClient.resumeThread(input.threadId, { persistExtendedHistory: true })
    );
    await this.runAppServerCall(() =>
      this.appClient.sendUserMessage(input.threadId, input.text)
    );
  }

  private async readTurnStartTemplate(
    threadId: string,
    ownerClientId: string
  ): Promise<TurnStartParams | null> {
    let turnStartTemplate: TurnStartParams | null = null;
    const projectedConversationState = this.threadStreamStateOwner.getProjectedConversationState(
      threadId
    );

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
        this.appClient.readThread(threadId, true)
      );
      return findLatestTurnParamsTemplate(readResult.thread);
    } catch (error) {
      logger.debug(
        {
          threadId,
          ownerClientId,
          error: toErrorMessage(error)
        },
        "codex-turn-start-template-unavailable"
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
