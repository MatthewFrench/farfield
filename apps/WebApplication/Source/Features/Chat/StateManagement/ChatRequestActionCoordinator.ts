import {
  ChatGptAuthTokensRefreshRequestMethod,
  type ThreadConversationRequestResponse,
  UserInputRequestMethod,
} from "@farfield/protocol";
import type { AgentId, ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";

const SEND_MESSAGE_ACTION_NAME = "send-message";
const STEER_MESSAGE_ACTION_NAME = "steer-message";
const SUBMIT_USER_INPUT_ACTION_NAME = "submit-user-input";
const SUBMIT_AUTH_TOKEN_REFRESH_ACTION_NAME = "submit-auth-token-refresh";
const SKIP_USER_INPUT_ACTION_NAME = "skip-user-input";
const INTERRUPT_THREAD_ACTION_NAME = "interrupt-thread";

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
      isSteering?: boolean;
    },
    options?: ApiRequestOptions,
  ): Promise<void>;
  submitUserInput(
    input: {
      threadId: string;
      requestId: number;
      response: ThreadConversationRequestResponse;
    },
    options?: ApiRequestOptions,
  ): Promise<void>;
  interruptThread(
    input: {
      threadId: string;
    },
    options?: ApiRequestOptions,
  ): Promise<void>;
}

export interface ChatRequestActionThreadMutationClient {
  createThread(
    input?: {
      agentId?: AgentId | undefined;
    },
    options?: ApiRequestOptions,
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
  onInvalidateActiveThreadQuery: () => void;
  onRefreshThreadData: (threadId: string) => Promise<void>;
  reportTrackedUserInterfaceError: (input: ChatRequestActionErrorReportInput) => Promise<void>;
}

export interface SubmitPendingUserInputActionInput {
  selectedThreadId: string | null;
  requestId: number;
  answers: Record<string, { answers: string[] }>;
  buildActionRequestOptions: (actionName: string) => ChatRequestActionRequestOptions;
  onSetBusy: (isBusy: boolean) => void;
  chatClient: ChatRequestActionChatClient;
  onInvalidateActiveThreadQuery: () => void;
  onRefreshThreadData: (threadId: string) => Promise<void>;
  reportTrackedUserInterfaceError: (input: ChatRequestActionErrorReportInput) => Promise<void>;
}

export interface SteerMessageActionInput {
  draft: string;
  selectedThreadId: string | null;
  buildActionRequestOptions: (actionName: string) => ChatRequestActionRequestOptions;
  onSetBusy: (isBusy: boolean) => void;
  chatClient: ChatRequestActionChatClient;
  onInvalidateActiveThreadQuery: () => void;
  onRefreshThreadData: (threadId: string) => Promise<void>;
  reportTrackedUserInterfaceError: (input: ChatRequestActionErrorReportInput) => Promise<void>;
}

export interface SubmitAuthTokenRefreshActionInput {
  selectedThreadId: string | null;
  requestId: number;
  accessToken: string;
  chatgptAccountId: string;
  chatgptPlanType: string | null;
  buildActionRequestOptions: (actionName: string) => ChatRequestActionRequestOptions;
  onSetBusy: (isBusy: boolean) => void;
  chatClient: ChatRequestActionChatClient;
  onInvalidateActiveThreadQuery: () => void;
  onRefreshThreadData: (threadId: string) => Promise<void>;
  reportTrackedUserInterfaceError: (input: ChatRequestActionErrorReportInput) => Promise<void>;
}

export interface SkipPendingUserInputActionInput {
  selectedThreadId: string | null;
  requestId: number;
  buildActionRequestOptions: (actionName: string) => ChatRequestActionRequestOptions;
  onSetBusy: (isBusy: boolean) => void;
  chatClient: ChatRequestActionChatClient;
  onInvalidateActiveThreadQuery: () => void;
  onRefreshThreadData: (threadId: string) => Promise<void>;
  reportTrackedUserInterfaceError: (input: ChatRequestActionErrorReportInput) => Promise<void>;
}

export interface InterruptThreadActionInput {
  selectedThreadId: string | null;
  buildActionRequestOptions: (actionName: string) => ChatRequestActionRequestOptions;
  onSetBusy: (isBusy: boolean) => void;
  chatClient: ChatRequestActionChatClient;
  onInvalidateActiveThreadQuery: () => void;
  onRefreshThreadData: (threadId: string) => Promise<void>;
  reportTrackedUserInterfaceError: (input: ChatRequestActionErrorReportInput) => Promise<void>;
}

export class ChatRequestActionCoordinator {
  public async sendMessage(input: SendMessageActionInput): Promise<void> {
    const trimmedDraft = input.draft.trim();
    if (trimmedDraft.length === 0) {
      return;
    }

    const { actionId, requestOptions } = input.buildActionRequestOptions(SEND_MESSAGE_ACTION_NAME);
    let threadId: string | null = input.selectedThreadId;
    input.onSetBusy(true);
    try {
      if (threadId === null || threadId.length === 0) {
        const created = await input.threadMutationClient.createThread(
          {
            agentId: input.selectedAgentId,
          },
          requestOptions,
        );
        threadId = created.threadId;
        input.onMarkThreadPendingMaterialization(threadId);
        input.onThreadSelected(threadId);
      }

      await input.chatClient.sendMessage({ threadId, text: input.draft }, requestOptions);
      input.onClearThreadPendingMaterialization(threadId);
      input.onInvalidateActiveThreadQuery();
      await input.onRefreshThreadData(threadId);
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: SEND_MESSAGE_ACTION_NAME,
        actionId,
        threadId,
        error: toErrorMessage(error),
        details: {
          draftLength: trimmedDraft.length,
        },
      });
    } finally {
      input.onSetBusy(false);
    }
  }

  public async steerMessage(input: SteerMessageActionInput): Promise<void> {
    const trimmedDraft = input.draft.trim();
    if (
      input.selectedThreadId === null ||
      input.selectedThreadId.length === 0 ||
      trimmedDraft.length === 0
    ) {
      return;
    }

    const { actionId, requestOptions } = input.buildActionRequestOptions(STEER_MESSAGE_ACTION_NAME);
    input.onSetBusy(true);
    try {
      await input.chatClient.sendMessage(
        {
          threadId: input.selectedThreadId,
          text: input.draft,
          isSteering: true,
        },
        requestOptions,
      );
      input.onInvalidateActiveThreadQuery();
      await input.onRefreshThreadData(input.selectedThreadId);
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: STEER_MESSAGE_ACTION_NAME,
        actionId,
        threadId: input.selectedThreadId,
        error: toErrorMessage(error),
        details: {
          draftLength: trimmedDraft.length,
        },
      });
    } finally {
      input.onSetBusy(false);
    }
  }

  public async submitPendingUserInput(input: SubmitPendingUserInputActionInput): Promise<void> {
    if (input.selectedThreadId === null || input.selectedThreadId.length === 0) {
      return;
    }

    const { actionId, requestOptions } = input.buildActionRequestOptions(
      SUBMIT_USER_INPUT_ACTION_NAME,
    );
    input.onSetBusy(true);
    try {
      await input.chatClient.submitUserInput(
        {
          threadId: input.selectedThreadId,
          requestId: input.requestId,
          response: {
            method: UserInputRequestMethod,
            payload: {
              answers: input.answers,
            },
          },
        },
        requestOptions,
      );
      input.onInvalidateActiveThreadQuery();
      await input.onRefreshThreadData(input.selectedThreadId);
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: SUBMIT_USER_INPUT_ACTION_NAME,
        actionId,
        threadId: input.selectedThreadId,
        error: toErrorMessage(error),
        details: {
          requestId: input.requestId,
        },
      });
    } finally {
      input.onSetBusy(false);
    }
  }

  public async skipPendingUserInput(input: SkipPendingUserInputActionInput): Promise<void> {
    if (input.selectedThreadId === null || input.selectedThreadId.length === 0) {
      return;
    }

    const { actionId, requestOptions } = input.buildActionRequestOptions(
      SKIP_USER_INPUT_ACTION_NAME,
    );
    input.onSetBusy(true);
    try {
      await input.chatClient.submitUserInput(
        {
          threadId: input.selectedThreadId,
          requestId: input.requestId,
          response: {
            method: UserInputRequestMethod,
            payload: {
              answers: {},
            },
          },
        },
        requestOptions,
      );
      input.onInvalidateActiveThreadQuery();
      await input.onRefreshThreadData(input.selectedThreadId);
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: SKIP_USER_INPUT_ACTION_NAME,
        actionId,
        threadId: input.selectedThreadId,
        error: toErrorMessage(error),
        details: {
          requestId: input.requestId,
        },
      });
    } finally {
      input.onSetBusy(false);
    }
  }

  public async submitAuthTokenRefreshRequest(
    input: SubmitAuthTokenRefreshActionInput,
  ): Promise<void> {
    if (input.selectedThreadId === null || input.selectedThreadId.length === 0) {
      return;
    }

    const { actionId, requestOptions } = input.buildActionRequestOptions(
      SUBMIT_AUTH_TOKEN_REFRESH_ACTION_NAME,
    );
    input.onSetBusy(true);
    try {
      await input.chatClient.submitUserInput(
        {
          threadId: input.selectedThreadId,
          requestId: input.requestId,
          response: {
            method: ChatGptAuthTokensRefreshRequestMethod,
            payload: {
              accessToken: input.accessToken,
              chatgptAccountId: input.chatgptAccountId,
              chatgptPlanType: input.chatgptPlanType,
            },
          },
        },
        requestOptions,
      );
      input.onInvalidateActiveThreadQuery();
      await input.onRefreshThreadData(input.selectedThreadId);
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: SUBMIT_AUTH_TOKEN_REFRESH_ACTION_NAME,
        actionId,
        threadId: input.selectedThreadId,
        error: toErrorMessage(error),
        details: {
          requestId: input.requestId,
        },
      });
    } finally {
      input.onSetBusy(false);
    }
  }

  public async interruptThread(input: InterruptThreadActionInput): Promise<void> {
    if (input.selectedThreadId === null || input.selectedThreadId.length === 0) {
      return;
    }

    const { actionId, requestOptions } = input.buildActionRequestOptions(
      INTERRUPT_THREAD_ACTION_NAME,
    );
    input.onSetBusy(true);
    try {
      await input.chatClient.interruptThread(
        {
          threadId: input.selectedThreadId,
        },
        requestOptions,
      );
      input.onInvalidateActiveThreadQuery();
      await input.onRefreshThreadData(input.selectedThreadId);
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: INTERRUPT_THREAD_ACTION_NAME,
        actionId,
        threadId: input.selectedThreadId,
        error: toErrorMessage(error),
      });
    } finally {
      input.onSetBusy(false);
    }
  }
}
