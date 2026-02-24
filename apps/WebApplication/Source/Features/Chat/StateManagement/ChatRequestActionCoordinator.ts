import type { AgentId, ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/SharedUtilities/DebugHelpers";

export interface ChatRequestActionRequestOptions {
  actionId: string;
  requestOptions: ApiRequestOptions;
}

export interface ChatRequestActionErrorReportInput {
  operation: string;
  actionId: string;
  threadId: string | null;
  error: Error | string | number | boolean | bigint | symbol | null | undefined | object;
  details?: Record<string, string | number | boolean | null>;
}

export interface ChatRequestActionChatClient {
  sendMessage(
    input: {
      threadId: string;
      text: string;
    },
    options?: ApiRequestOptions
  ): Promise<void>;
  submitUserInput(
    input: {
      threadId: string;
      requestId: number;
      response: {
        answers: Record<string, { answers: string[] }>;
      };
    },
    options?: ApiRequestOptions
  ): Promise<void>;
  interruptThread(
    input: {
      threadId: string;
    },
    options?: ApiRequestOptions
  ): Promise<void>;
}

export interface ChatRequestActionThreadMutationClient {
  createThread(
    input?: {
      agentId?: AgentId | undefined;
    },
    options?: ApiRequestOptions
  ): Promise<{
    threadId: string;
  }>;
}

export interface SendMessageActionInput {
  draft: string;
  selectedThreadId: string | null;
  selectedAgentId: AgentId;
  buildActionRequestOptions: (actionName: string) => ChatRequestActionRequestOptions;
  onSetBusy: (isBusy: boolean) => void;
  onThreadSelected: (threadId: string) => void;
  onMarkThreadPendingMaterialization: (threadId: string) => void;
  onClearThreadPendingMaterialization: (threadId: string) => void;
  chatClient: ChatRequestActionChatClient;
  threadMutationClient: ChatRequestActionThreadMutationClient;
  refreshAll: () => Promise<void>;
  reportTrackedUserInterfaceError: (input: ChatRequestActionErrorReportInput) => Promise<void>;
}

export interface SubmitPendingUserInputActionInput {
  selectedThreadId: string | null;
  requestId: number;
  answers: Record<string, { answers: string[] }>;
  buildActionRequestOptions: (actionName: string) => ChatRequestActionRequestOptions;
  onSetBusy: (isBusy: boolean) => void;
  chatClient: ChatRequestActionChatClient;
  refreshAll: () => Promise<void>;
  reportTrackedUserInterfaceError: (input: ChatRequestActionErrorReportInput) => Promise<void>;
}

export interface SkipPendingUserInputActionInput {
  selectedThreadId: string | null;
  requestId: number;
  buildActionRequestOptions: (actionName: string) => ChatRequestActionRequestOptions;
  onSetBusy: (isBusy: boolean) => void;
  chatClient: ChatRequestActionChatClient;
  refreshAll: () => Promise<void>;
  reportTrackedUserInterfaceError: (input: ChatRequestActionErrorReportInput) => Promise<void>;
}

export interface InterruptThreadActionInput {
  selectedThreadId: string | null;
  buildActionRequestOptions: (actionName: string) => ChatRequestActionRequestOptions;
  onSetBusy: (isBusy: boolean) => void;
  chatClient: ChatRequestActionChatClient;
  refreshAll: () => Promise<void>;
  reportTrackedUserInterfaceError: (input: ChatRequestActionErrorReportInput) => Promise<void>;
}

export class ChatRequestActionCoordinator {
  public async sendMessage(input: SendMessageActionInput): Promise<void> {
    const trimmedDraft = input.draft.trim();
    if (!trimmedDraft) {
      return;
    }

    const { actionId, requestOptions } = input.buildActionRequestOptions("send-message");
    let threadId: string | null = input.selectedThreadId;
    input.onSetBusy(true);
    try {
      if (!threadId) {
        const created = await input.threadMutationClient.createThread({
          agentId: input.selectedAgentId
        }, requestOptions);
        threadId = created.threadId;
        input.onMarkThreadPendingMaterialization(threadId);
        input.onThreadSelected(threadId);
      }

      if (!threadId) {
        throw new Error("No thread available for send-message");
      }

      await input.chatClient.sendMessage({ threadId, text: input.draft }, requestOptions);
      input.onClearThreadPendingMaterialization(threadId);
      await input.refreshAll();
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: "send-message",
        actionId,
        threadId,
        error: toErrorMessage(error),
        details: {
          draftLength: trimmedDraft.length
        }
      });
    } finally {
      input.onSetBusy(false);
    }
  }

  public async submitPendingUserInput(input: SubmitPendingUserInputActionInput): Promise<void> {
    if (!input.selectedThreadId) {
      return;
    }

    const { actionId, requestOptions } = input.buildActionRequestOptions("submit-user-input");
    input.onSetBusy(true);
    try {
      await input.chatClient.submitUserInput({
        threadId: input.selectedThreadId,
        requestId: input.requestId,
        response: {
          answers: input.answers
        }
      }, requestOptions);
      await input.refreshAll();
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: "submit-user-input",
        actionId,
        threadId: input.selectedThreadId,
        error: toErrorMessage(error),
        details: {
          requestId: input.requestId
        }
      });
    } finally {
      input.onSetBusy(false);
    }
  }

  public async skipPendingUserInput(input: SkipPendingUserInputActionInput): Promise<void> {
    if (!input.selectedThreadId) {
      return;
    }

    const { actionId, requestOptions } = input.buildActionRequestOptions("skip-user-input");
    input.onSetBusy(true);
    try {
      await input.chatClient.submitUserInput({
        threadId: input.selectedThreadId,
        requestId: input.requestId,
        response: {
          answers: {}
        }
      }, requestOptions);
      await input.refreshAll();
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: "skip-user-input",
        actionId,
        threadId: input.selectedThreadId,
        error: toErrorMessage(error),
        details: {
          requestId: input.requestId
        }
      });
    } finally {
      input.onSetBusy(false);
    }
  }

  public async interruptThread(input: InterruptThreadActionInput): Promise<void> {
    if (!input.selectedThreadId) {
      return;
    }

    const { actionId, requestOptions } = input.buildActionRequestOptions("interrupt-thread");
    input.onSetBusy(true);
    try {
      await input.chatClient.interruptThread({
        threadId: input.selectedThreadId
      }, requestOptions);
      await input.refreshAll();
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: "interrupt-thread",
        actionId,
        threadId: input.selectedThreadId,
        error: toErrorMessage(error)
      });
    } finally {
      input.onSetBusy(false);
    }
  }
}
