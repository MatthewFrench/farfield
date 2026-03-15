import {
  type CommandExecutionApprovalResponsePayload,
  type DeprecatedApprovalReviewDecision,
  type FileChangeApprovalResponsePayload,
  type ToolCallResponsePayload,
} from "@farfield/protocol";
import { type Dispatch, type SetStateAction, useCallback } from "react";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { type PendingApplyPatchApprovalRequest } from "../DomainModel/PendingApplyPatchApprovalRequestSelector";
import { type PendingAuthTokenRefreshRequest } from "../DomainModel/PendingAuthTokenRefreshRequestSelector";
import { type PendingCommandExecutionApprovalRequest } from "../DomainModel/PendingCommandExecutionApprovalRequestSelector";
import { type PendingExecuteCommandApprovalRequest } from "../DomainModel/PendingExecuteCommandApprovalRequestSelector";
import { type PendingFileChangeApprovalRequest } from "../DomainModel/PendingFileChangeApprovalRequestSelector";
import { type PendingToolCallRequest } from "../DomainModel/PendingToolCallRequestSelector";
import {
  createEmptyPendingUserInputAnswerDraft,
  PendingUserInputAnswerBuilder,
  type PendingUserInputAnswerDraft,
  type PendingUserInputAnswerDraftByQuestionId,
} from "../DomainModel/PendingUserInputAnswerBuilder";
import { type PendingUserInputRequest } from "../DomainModel/PendingUserInputRequestSelector";
import {
  type ChatRequestActionChatClient,
  ChatRequestActionCoordinator,
  type ChatRequestActionErrorReportInput,
} from "./ChatRequestActionCoordinator";
import { type CollaborationModeActionErrorReportInput } from "./CollaborationModeActionCoordinator";

export interface ChatActionRequestOptions {
  actionId: string;
  requestOptions: ApiRequestOptions;
}

export type PendingUserInputAnswerField = "option" | "freeform";

export interface ChatRequestActionHandlers {
  submitPendingRequest: () => Promise<void>;
  skipPendingRequest: () => Promise<void>;
  submitAuthTokenRefreshRequest: (
    accessToken: string,
    chatgptAccountId: string,
    chatgptPlanType: string | null,
  ) => Promise<void>;
  submitApplyPatchApprovalRequest: (decision: DeprecatedApprovalReviewDecision) => Promise<void>;
  submitCommandExecutionApprovalRequest: (
    decision: CommandExecutionApprovalResponsePayload["decision"],
  ) => Promise<void>;
  submitExecuteCommandApprovalRequest: (
    decision: DeprecatedApprovalReviewDecision,
  ) => Promise<void>;
  submitFileChangeApprovalRequest: (
    decision: FileChangeApprovalResponsePayload["decision"],
  ) => Promise<void>;
  submitToolCallRequestResponse: (payload: ToolCallResponsePayload) => Promise<void>;
  runInterrupt: () => Promise<void>;
  handleAnswerChange: (
    questionId: string,
    field: PendingUserInputAnswerField,
    value: string,
  ) => void;
}

type ChatActionErrorReportInput =
  | ChatRequestActionErrorReportInput
  | CollaborationModeActionErrorReportInput;

const PENDING_USER_INPUT_ANSWER_OPTION_FIELD: PendingUserInputAnswerField = "option";
const PENDING_USER_INPUT_ANSWER_FREEFORM_FIELD: PendingUserInputAnswerField = "freeform";

function buildNextAnswerDraftByQuestionId(input: {
  previousAnswerDraftByQuestionId: PendingUserInputAnswerDraftByQuestionId;
  questionId: string;
  field: PendingUserInputAnswerField;
  value: string;
}): PendingUserInputAnswerDraftByQuestionId {
  const previousQuestionDraft =
    input.previousAnswerDraftByQuestionId[input.questionId] ??
    createEmptyPendingUserInputAnswerDraft();
  const nextQuestionDraft: PendingUserInputAnswerDraft = {
    option: previousQuestionDraft.option,
    freeform: previousQuestionDraft.freeform,
  };

  if (input.field === PENDING_USER_INPUT_ANSWER_OPTION_FIELD) {
    nextQuestionDraft.option = input.value;
  } else if (input.field === PENDING_USER_INPUT_ANSWER_FREEFORM_FIELD) {
    nextQuestionDraft.freeform = input.value;
  }

  return {
    ...input.previousAnswerDraftByQuestionId,
    [input.questionId]: nextQuestionDraft,
  };
}

interface UseChatRequestActionHandlersInput {
  selectedThreadId: string | null;
  activeRequest: PendingUserInputRequest | null;
  activeAuthTokenRefreshRequest: PendingAuthTokenRefreshRequest | null | undefined;
  activeApplyPatchApprovalRequest: PendingApplyPatchApprovalRequest | null | undefined;
  activeCommandExecutionApprovalRequest: PendingCommandExecutionApprovalRequest | null | undefined;
  activeExecuteCommandApprovalRequest: PendingExecuteCommandApprovalRequest | null | undefined;
  activeFileChangeApprovalRequest: PendingFileChangeApprovalRequest | null | undefined;
  activeToolCallRequest: PendingToolCallRequest | null | undefined;
  answerDraft: PendingUserInputAnswerDraftByQuestionId;
  setAnswerDraft: Dispatch<SetStateAction<PendingUserInputAnswerDraftByQuestionId>>;
  buildActionRequestOptions: (actionName: string) => ChatActionRequestOptions;
  setIsBusy: Dispatch<SetStateAction<boolean>>;
  chatRequestActionCoordinator: ChatRequestActionCoordinator;
  chatClient: ChatRequestActionChatClient;
  pendingUserInputAnswerBuilder: PendingUserInputAnswerBuilder;
  onInvalidateActiveThreadQuery: () => void;
  onRefreshThreadData: (threadId: string) => Promise<void>;
  reportTrackedUserInterfaceError: (input: ChatActionErrorReportInput) => Promise<void>;
}

function createSubmitCommandExecutionApprovalRequestHandler(
  input: UseChatRequestActionHandlersInput,
): (decision: CommandExecutionApprovalResponsePayload["decision"]) => Promise<void> {
  return async (decision: CommandExecutionApprovalResponsePayload["decision"]) => {
    const activeCommandExecutionApprovalRequest = input.activeCommandExecutionApprovalRequest;
    if (!activeCommandExecutionApprovalRequest) {
      return;
    }

    await input.chatRequestActionCoordinator.submitCommandExecutionApprovalRequest({
      selectedThreadId: input.selectedThreadId,
      requestId: activeCommandExecutionApprovalRequest.id,
      decision,
      buildActionRequestOptions: input.buildActionRequestOptions,
      onSetBusy: input.setIsBusy,
      chatClient: input.chatClient,
      onInvalidateActiveThreadQuery: input.onInvalidateActiveThreadQuery,
      onRefreshThreadData: input.onRefreshThreadData,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
    });
  };
}

function createSubmitApplyPatchApprovalRequestHandler(
  input: UseChatRequestActionHandlersInput,
): (decision: DeprecatedApprovalReviewDecision) => Promise<void> {
  return async (decision: DeprecatedApprovalReviewDecision) => {
    const activeApplyPatchApprovalRequest = input.activeApplyPatchApprovalRequest;
    if (!activeApplyPatchApprovalRequest) {
      return;
    }

    await input.chatRequestActionCoordinator.submitApplyPatchApprovalRequest({
      selectedThreadId: input.selectedThreadId,
      requestId: activeApplyPatchApprovalRequest.id,
      decision,
      buildActionRequestOptions: input.buildActionRequestOptions,
      onSetBusy: input.setIsBusy,
      chatClient: input.chatClient,
      onInvalidateActiveThreadQuery: input.onInvalidateActiveThreadQuery,
      onRefreshThreadData: input.onRefreshThreadData,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
    });
  };
}

function createSubmitExecuteCommandApprovalRequestHandler(
  input: UseChatRequestActionHandlersInput,
): (decision: DeprecatedApprovalReviewDecision) => Promise<void> {
  return async (decision: DeprecatedApprovalReviewDecision) => {
    const activeExecuteCommandApprovalRequest = input.activeExecuteCommandApprovalRequest;
    if (!activeExecuteCommandApprovalRequest) {
      return;
    }

    await input.chatRequestActionCoordinator.submitExecuteCommandApprovalRequest({
      selectedThreadId: input.selectedThreadId,
      requestId: activeExecuteCommandApprovalRequest.id,
      decision,
      buildActionRequestOptions: input.buildActionRequestOptions,
      onSetBusy: input.setIsBusy,
      chatClient: input.chatClient,
      onInvalidateActiveThreadQuery: input.onInvalidateActiveThreadQuery,
      onRefreshThreadData: input.onRefreshThreadData,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
    });
  };
}

function createSubmitFileChangeApprovalRequestHandler(
  input: UseChatRequestActionHandlersInput,
): (decision: FileChangeApprovalResponsePayload["decision"]) => Promise<void> {
  return async (decision: FileChangeApprovalResponsePayload["decision"]) => {
    const activeFileChangeApprovalRequest = input.activeFileChangeApprovalRequest;
    if (!activeFileChangeApprovalRequest) {
      return;
    }

    await input.chatRequestActionCoordinator.submitFileChangeApprovalRequest({
      selectedThreadId: input.selectedThreadId,
      requestId: activeFileChangeApprovalRequest.id,
      decision,
      buildActionRequestOptions: input.buildActionRequestOptions,
      onSetBusy: input.setIsBusy,
      chatClient: input.chatClient,
      onInvalidateActiveThreadQuery: input.onInvalidateActiveThreadQuery,
      onRefreshThreadData: input.onRefreshThreadData,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
    });
  };
}

function createSubmitToolCallRequestResponseHandler(
  input: UseChatRequestActionHandlersInput,
): (payload: ToolCallResponsePayload) => Promise<void> {
  return async (payload: ToolCallResponsePayload) => {
    const activeToolCallRequest = input.activeToolCallRequest;
    if (!activeToolCallRequest) {
      return;
    }

    await input.chatRequestActionCoordinator.submitToolCallResponseRequest({
      selectedThreadId: input.selectedThreadId,
      requestId: activeToolCallRequest.id,
      payload,
      buildActionRequestOptions: input.buildActionRequestOptions,
      onSetBusy: input.setIsBusy,
      chatClient: input.chatClient,
      onInvalidateActiveThreadQuery: input.onInvalidateActiveThreadQuery,
      onRefreshThreadData: input.onRefreshThreadData,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
    });
  };
}

export function useChatRequestActionHandlers(
  input: UseChatRequestActionHandlersInput,
): ChatRequestActionHandlers {
  const submitPendingRequest = useCallback(async () => {
    if (!input.activeRequest) {
      return;
    }
    const answers = input.pendingUserInputAnswerBuilder.buildAnswersByQuestionId({
      questions: input.activeRequest.params.questions,
      answerDraftByQuestionId: input.answerDraft,
    });
    await input.chatRequestActionCoordinator.submitPendingUserInput({
      selectedThreadId: input.selectedThreadId,
      requestId: input.activeRequest.id,
      answers,
      buildActionRequestOptions: input.buildActionRequestOptions,
      onSetBusy: input.setIsBusy,
      chatClient: input.chatClient,
      onInvalidateActiveThreadQuery: input.onInvalidateActiveThreadQuery,
      onRefreshThreadData: input.onRefreshThreadData,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
    });
  }, [
    input.activeRequest,
    input.answerDraft,
    input.buildActionRequestOptions,
    input.chatClient,
    input.chatRequestActionCoordinator,
    input.onInvalidateActiveThreadQuery,
    input.onRefreshThreadData,
    input.pendingUserInputAnswerBuilder,
    input.reportTrackedUserInterfaceError,
    input.selectedThreadId,
    input.setIsBusy,
  ]);

  const skipPendingRequest = useCallback(async () => {
    if (!input.activeRequest) {
      return;
    }
    await input.chatRequestActionCoordinator.skipPendingUserInput({
      selectedThreadId: input.selectedThreadId,
      requestId: input.activeRequest.id,
      buildActionRequestOptions: input.buildActionRequestOptions,
      onSetBusy: input.setIsBusy,
      chatClient: input.chatClient,
      onInvalidateActiveThreadQuery: input.onInvalidateActiveThreadQuery,
      onRefreshThreadData: input.onRefreshThreadData,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
    });
  }, [
    input.activeRequest,
    input.buildActionRequestOptions,
    input.chatClient,
    input.chatRequestActionCoordinator,
    input.onInvalidateActiveThreadQuery,
    input.onRefreshThreadData,
    input.reportTrackedUserInterfaceError,
    input.selectedThreadId,
    input.setIsBusy,
  ]);

  const submitAuthTokenRefreshRequest = useCallback(
    async (accessToken: string, chatgptAccountId: string, chatgptPlanType: string | null) => {
      const activeAuthTokenRefreshRequest = input.activeAuthTokenRefreshRequest;
      if (!activeAuthTokenRefreshRequest) {
        return;
      }

      await input.chatRequestActionCoordinator.submitAuthTokenRefreshRequest({
        selectedThreadId: input.selectedThreadId,
        requestId: activeAuthTokenRefreshRequest.id,
        accessToken,
        chatgptAccountId,
        chatgptPlanType,
        buildActionRequestOptions: input.buildActionRequestOptions,
        onSetBusy: input.setIsBusy,
        chatClient: input.chatClient,
        onInvalidateActiveThreadQuery: input.onInvalidateActiveThreadQuery,
        onRefreshThreadData: input.onRefreshThreadData,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      });
    },
    [
      input.activeAuthTokenRefreshRequest,
      input.buildActionRequestOptions,
      input.chatClient,
      input.chatRequestActionCoordinator,
      input.onInvalidateActiveThreadQuery,
      input.onRefreshThreadData,
      input.reportTrackedUserInterfaceError,
      input.selectedThreadId,
      input.setIsBusy,
    ],
  );

  const submitApplyPatchApprovalRequest = createSubmitApplyPatchApprovalRequestHandler(input);
  const submitCommandExecutionApprovalRequest =
    createSubmitCommandExecutionApprovalRequestHandler(input);
  const submitExecuteCommandApprovalRequest =
    createSubmitExecuteCommandApprovalRequestHandler(input);
  const submitFileChangeApprovalRequest = createSubmitFileChangeApprovalRequestHandler(input);
  const submitToolCallRequestResponse = createSubmitToolCallRequestResponseHandler(input);

  const runInterrupt = useCallback(async () => {
    await input.chatRequestActionCoordinator.interruptThread({
      selectedThreadId: input.selectedThreadId,
      buildActionRequestOptions: input.buildActionRequestOptions,
      onSetBusy: input.setIsBusy,
      chatClient: input.chatClient,
      onInvalidateActiveThreadQuery: input.onInvalidateActiveThreadQuery,
      onRefreshThreadData: input.onRefreshThreadData,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
    });
  }, [
    input.buildActionRequestOptions,
    input.chatClient,
    input.chatRequestActionCoordinator,
    input.onInvalidateActiveThreadQuery,
    input.onRefreshThreadData,
    input.reportTrackedUserInterfaceError,
    input.selectedThreadId,
    input.setIsBusy,
  ]);

  const handleAnswerChange = useCallback(
    (questionId: string, field: PendingUserInputAnswerField, value: string) => {
      input.setAnswerDraft((previousAnswerDraft) =>
        buildNextAnswerDraftByQuestionId({
          previousAnswerDraftByQuestionId: previousAnswerDraft,
          questionId,
          field,
          value,
        }),
      );
    },
    [input.setAnswerDraft],
  );

  return {
    submitPendingRequest,
    skipPendingRequest,
    submitAuthTokenRefreshRequest,
    submitApplyPatchApprovalRequest,
    submitCommandExecutionApprovalRequest,
    submitExecuteCommandApprovalRequest,
    submitFileChangeApprovalRequest,
    submitToolCallRequestResponse,
    runInterrupt,
    handleAnswerChange,
  };
}
