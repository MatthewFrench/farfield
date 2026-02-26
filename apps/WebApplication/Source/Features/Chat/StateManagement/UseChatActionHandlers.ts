import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import type { AgentId, ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import {
  createEmptyPendingUserInputAnswerDraft,
  PendingUserInputAnswerBuilder,
  type PendingUserInputAnswerDraft,
  type PendingUserInputAnswerDraftByQuestionId
} from "../DomainModel/PendingUserInputAnswerBuilder";
import { type PendingUserInputRequest } from "../DomainModel/PendingUserInputRequestSelector";
import { PendingThreadMaterializationCoordinator } from "@/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator";
import {
  ChatRequestActionCoordinator,
  type ChatRequestActionChatClient,
  type ChatRequestActionErrorReportInput,
  type ChatRequestActionThreadMutationClient
} from "./ChatRequestActionCoordinator";
import {
  CollaborationModeActionCoordinator,
  type CollaborationModeActionDraft,
  type CollaborationModeActionChatClient,
  type CollaborationModeActionErrorReportInput,
  type CollaborationModeActionModeOption
} from "./CollaborationModeActionCoordinator";

interface ActionRequestOptions {
  actionId: string;
  requestOptions: ApiRequestOptions;
}

type ChatActionErrorReportInput = ChatRequestActionErrorReportInput | CollaborationModeActionErrorReportInput;
type PendingUserInputAnswerField = "option" | "freeform";
type ChatActionModeDraft = CollaborationModeActionDraft;

const PENDING_USER_INPUT_ANSWER_OPTION_FIELD: PendingUserInputAnswerField = "option";
const PENDING_USER_INPUT_ANSWER_FREEFORM_FIELD: PendingUserInputAnswerField = "freeform";

function buildNextAnswerDraftByQuestionId(input: {
  previousAnswerDraftByQuestionId: PendingUserInputAnswerDraftByQuestionId;
  questionId: string;
  field: PendingUserInputAnswerField;
  value: string;
}): PendingUserInputAnswerDraftByQuestionId {
  const previousQuestionDraft = input.previousAnswerDraftByQuestionId[input.questionId] ?? createEmptyPendingUserInputAnswerDraft();
  const nextQuestionDraft: PendingUserInputAnswerDraft = {
    option: previousQuestionDraft.option,
    freeform: previousQuestionDraft.freeform
  };

  if (input.field === PENDING_USER_INPUT_ANSWER_OPTION_FIELD) {
    nextQuestionDraft.option = input.value;
  } else if (input.field === PENDING_USER_INPUT_ANSWER_FREEFORM_FIELD) {
    nextQuestionDraft.freeform = input.value;
  }

  return {
    ...input.previousAnswerDraftByQuestionId,
    [input.questionId]: nextQuestionDraft
  };
}

export interface UseChatActionHandlersInput {
  selectedThreadId: string | null;
  selectedAgentId: AgentId;
  modes: CollaborationModeActionModeOption[];
  isModeSyncing: boolean;
  activeRequest: PendingUserInputRequest | null;
  answerDraft: PendingUserInputAnswerDraftByQuestionId;
  setAnswerDraft: Dispatch<SetStateAction<PendingUserInputAnswerDraftByQuestionId>>;
  buildActionRequestOptions: (actionName: string) => ActionRequestOptions;
  setIsBusy: Dispatch<SetStateAction<boolean>>;
  setIsModeSyncing: Dispatch<SetStateAction<boolean>>;
  setSelectedThreadId: Dispatch<SetStateAction<string | null>>;
  selectedThreadIdRef: MutableRefObject<string | null>;
  pendingThreadMaterializationCoordinator: PendingThreadMaterializationCoordinator;
  readLastAppliedModeSignature: () => string;
  writeLastAppliedModeSignature: (modeSignature: string) => void;
  chatRequestActionCoordinator: ChatRequestActionCoordinator;
  collaborationModeActionCoordinator: CollaborationModeActionCoordinator;
  chatClient: ChatRequestActionChatClient & CollaborationModeActionChatClient;
  threadMutationClient: ChatRequestActionThreadMutationClient;
  pendingUserInputAnswerBuilder: PendingUserInputAnswerBuilder;
  onInvalidateActiveThreadQuery: () => void;
  loadCoreDataTracked: () => Promise<void>;
  onReloadSelectedThread: (threadId: string) => Promise<void>;
  reportTrackedUserInterfaceError: (input: ChatActionErrorReportInput) => Promise<void>;
}

export interface ChatActionHandlers {
  submitMessage: (draft: string) => Promise<void>;
  applyModeDraft: (draft: ChatActionModeDraft) => Promise<void>;
  submitPendingRequest: () => Promise<void>;
  skipPendingRequest: () => Promise<void>;
  runInterrupt: () => Promise<void>;
  handleAnswerChange: (questionId: string, field: PendingUserInputAnswerField, value: string) => void;
}

export function useChatActionHandlers(input: UseChatActionHandlersInput): ChatActionHandlers {
  const refreshThreadData = useCallback(async (threadId: string): Promise<void> => {
    await input.loadCoreDataTracked();
    await input.onReloadSelectedThread(threadId);
  }, [input.loadCoreDataTracked, input.onReloadSelectedThread]);

  const handleThreadSelected = useCallback((threadId: string): void => {
    // Keep state and ref synchronized so async request callbacks observe the same thread selection.
    input.setSelectedThreadId(threadId);
    const selectedThreadIdRef = input.selectedThreadIdRef;
    selectedThreadIdRef.current = threadId;
  }, [input.selectedThreadIdRef, input.setSelectedThreadId]);

  const markThreadPendingMaterialization = useCallback((threadId: string): void => {
    input.pendingThreadMaterializationCoordinator.markPending(threadId);
  }, [input.pendingThreadMaterializationCoordinator]);

  const clearThreadPendingMaterialization = useCallback((threadId: string): void => {
    input.pendingThreadMaterializationCoordinator.clearPending(threadId);
  }, [input.pendingThreadMaterializationCoordinator]);

  const submitMessage = useCallback(async (draft: string) => {
    await input.chatRequestActionCoordinator.sendMessage({
      draft,
      selectedThreadId: input.selectedThreadId,
      selectedAgentId: input.selectedAgentId,
      buildActionRequestOptions: input.buildActionRequestOptions,
      onSetBusy: input.setIsBusy,
      onThreadSelected: handleThreadSelected,
      onMarkThreadPendingMaterialization: markThreadPendingMaterialization,
      onClearThreadPendingMaterialization: clearThreadPendingMaterialization,
      chatClient: input.chatClient,
      threadMutationClient: input.threadMutationClient,
      onInvalidateActiveThreadQuery: input.onInvalidateActiveThreadQuery,
      onRefreshThreadData: refreshThreadData,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError
    });
  }, [
    input.buildActionRequestOptions,
    input.chatClient,
    input.chatRequestActionCoordinator,
    clearThreadPendingMaterialization,
    handleThreadSelected,
    markThreadPendingMaterialization,
    input.onInvalidateActiveThreadQuery,
    refreshThreadData,
    input.reportTrackedUserInterfaceError,
    input.selectedAgentId,
    input.selectedThreadId,
    input.setIsBusy,
    input.threadMutationClient
  ]);

  const applyModeDraft = useCallback(async (draft: ChatActionModeDraft) => {
    await input.collaborationModeActionCoordinator.applyDraft({
      draft,
      selectedThreadId: input.selectedThreadId,
      modes: input.modes,
      isModeSyncing: input.isModeSyncing,
      readLastAppliedModeSignature: input.readLastAppliedModeSignature,
      writeLastAppliedModeSignature: input.writeLastAppliedModeSignature,
      buildActionRequestOptions: input.buildActionRequestOptions,
      onSetModeSyncing: input.setIsModeSyncing,
      chatClient: input.chatClient,
      onReloadSelectedThread: input.onReloadSelectedThread,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError
    });
  }, [
    input.buildActionRequestOptions,
    input.chatClient,
    input.collaborationModeActionCoordinator,
    input.isModeSyncing,
    input.modes,
    input.onReloadSelectedThread,
    input.readLastAppliedModeSignature,
    input.reportTrackedUserInterfaceError,
    input.selectedThreadId,
    input.setIsModeSyncing,
    input.writeLastAppliedModeSignature
  ]);

  const submitPendingRequest = useCallback(async () => {
    if (!input.activeRequest) {
      return;
    }
    const answers = input.pendingUserInputAnswerBuilder.buildAnswersByQuestionId({
      questions: input.activeRequest.params.questions,
      answerDraftByQuestionId: input.answerDraft
    });
    await input.chatRequestActionCoordinator.submitPendingUserInput({
      selectedThreadId: input.selectedThreadId,
      requestId: input.activeRequest.id,
      answers,
      buildActionRequestOptions: input.buildActionRequestOptions,
      onSetBusy: input.setIsBusy,
      chatClient: input.chatClient,
      onInvalidateActiveThreadQuery: input.onInvalidateActiveThreadQuery,
      onRefreshThreadData: refreshThreadData,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError
    });
  }, [
    input.activeRequest,
    input.answerDraft,
    input.buildActionRequestOptions,
    input.chatClient,
    input.chatRequestActionCoordinator,
    input.onInvalidateActiveThreadQuery,
    input.pendingUserInputAnswerBuilder,
    refreshThreadData,
    input.reportTrackedUserInterfaceError,
    input.selectedThreadId,
    input.setIsBusy
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
      onRefreshThreadData: refreshThreadData,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError
    });
  }, [
    input.activeRequest,
    input.buildActionRequestOptions,
    input.chatClient,
    input.chatRequestActionCoordinator,
    input.onInvalidateActiveThreadQuery,
    refreshThreadData,
    input.reportTrackedUserInterfaceError,
    input.selectedThreadId,
    input.setIsBusy
  ]);

  const runInterrupt = useCallback(async () => {
    await input.chatRequestActionCoordinator.interruptThread({
      selectedThreadId: input.selectedThreadId,
      buildActionRequestOptions: input.buildActionRequestOptions,
      onSetBusy: input.setIsBusy,
      chatClient: input.chatClient,
      onInvalidateActiveThreadQuery: input.onInvalidateActiveThreadQuery,
      onRefreshThreadData: refreshThreadData,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError
    });
  }, [
    input.buildActionRequestOptions,
    input.chatClient,
    input.chatRequestActionCoordinator,
    input.onInvalidateActiveThreadQuery,
    refreshThreadData,
    input.reportTrackedUserInterfaceError,
    input.selectedThreadId,
    input.setIsBusy
  ]);

  const handleAnswerChange = useCallback(
    (questionId: string, field: PendingUserInputAnswerField, value: string) => {
      input.setAnswerDraft((previousAnswerDraft) =>
        buildNextAnswerDraftByQuestionId({
          previousAnswerDraftByQuestionId: previousAnswerDraft,
          questionId,
          field,
          value
        })
      );
    },
    [input.setAnswerDraft]
  );

  return {
    submitMessage,
    applyModeDraft,
    submitPendingRequest,
    skipPendingRequest,
    runInterrupt,
    handleAnswerChange
  };
}
