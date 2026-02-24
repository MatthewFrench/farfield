import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import type { AgentId, ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { PendingUserInputAnswerBuilder } from "../DomainModel/PendingUserInputAnswerBuilder";
import { type PendingUserInputRequest } from "../DomainModel/PendingUserInputRequestSelector";
import {
  ChatRequestActionCoordinator,
  type ChatRequestActionChatClient,
  type ChatRequestActionErrorReportInput,
  type ChatRequestActionThreadMutationClient
} from "./ChatRequestActionCoordinator";
import {
  CollaborationModeActionCoordinator,
  type CollaborationModeActionChatClient,
  type CollaborationModeActionErrorReportInput,
  type CollaborationModeActionModeOption
} from "./CollaborationModeActionCoordinator";

interface ActionRequestOptions {
  actionId: string;
  requestOptions: ApiRequestOptions;
}

type ChatActionErrorReportInput = ChatRequestActionErrorReportInput | CollaborationModeActionErrorReportInput;

export interface UseChatActionHandlersInput {
  selectedThreadId: string | null;
  selectedAgentId: AgentId;
  modes: CollaborationModeActionModeOption[];
  isModeSyncing: boolean;
  activeRequest: PendingUserInputRequest | null;
  answerDraft: Record<string, { option: string; freeform: string }>;
  setAnswerDraft: Dispatch<SetStateAction<Record<string, { option: string; freeform: string }>>>;
  buildActionRequestOptions: (actionName: string) => ActionRequestOptions;
  setIsBusy: Dispatch<SetStateAction<boolean>>;
  setIsModeSyncing: Dispatch<SetStateAction<boolean>>;
  setSelectedThreadId: Dispatch<SetStateAction<string | null>>;
  selectedThreadIdRef: MutableRefObject<string | null>;
  pendingMaterializationThreadIdsRef: MutableRefObject<Set<string>>;
  readLastAppliedModeSignature: () => string;
  writeLastAppliedModeSignature: (modeSignature: string) => void;
  chatRequestActionCoordinator: ChatRequestActionCoordinator;
  collaborationModeActionCoordinator: CollaborationModeActionCoordinator;
  chatClient: ChatRequestActionChatClient & CollaborationModeActionChatClient;
  threadMutationClient: ChatRequestActionThreadMutationClient;
  pendingUserInputAnswerBuilder: PendingUserInputAnswerBuilder;
  refreshAll: () => Promise<void>;
  onReloadSelectedThread: (threadId: string) => Promise<void>;
  reportTrackedUserInterfaceError: (input: ChatActionErrorReportInput) => Promise<void>;
}

export interface ChatActionHandlers {
  submitMessage: (draft: string) => Promise<void>;
  applyModeDraft: (draft: {
    modeKey: string;
    modelId: string;
    reasoningEffort: string;
  }) => Promise<void>;
  submitPendingRequest: () => Promise<void>;
  skipPendingRequest: () => Promise<void>;
  runInterrupt: () => Promise<void>;
  handleAnswerChange: (questionId: string, field: "option" | "freeform", value: string) => void;
}

export function useChatActionHandlers(input: UseChatActionHandlersInput): ChatActionHandlers {
  const submitMessage = useCallback(async (draft: string) => {
    await input.chatRequestActionCoordinator.sendMessage({
      draft,
      selectedThreadId: input.selectedThreadId,
      selectedAgentId: input.selectedAgentId,
      buildActionRequestOptions: input.buildActionRequestOptions,
      onSetBusy: input.setIsBusy,
      onThreadSelected: (threadId) => {
        input.setSelectedThreadId(threadId);
        input.selectedThreadIdRef.current = threadId;
      },
      onMarkThreadPendingMaterialization: (threadId) => {
        input.pendingMaterializationThreadIdsRef.current.add(threadId);
      },
      onClearThreadPendingMaterialization: (threadId) => {
        input.pendingMaterializationThreadIdsRef.current.delete(threadId);
      },
      chatClient: input.chatClient,
      threadMutationClient: input.threadMutationClient,
      refreshAll: input.refreshAll,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError
    });
  }, [
    input.buildActionRequestOptions,
    input.chatClient,
    input.chatRequestActionCoordinator,
    input.pendingMaterializationThreadIdsRef,
    input.refreshAll,
    input.reportTrackedUserInterfaceError,
    input.selectedAgentId,
    input.selectedThreadId,
    input.selectedThreadIdRef,
    input.setIsBusy,
    input.setSelectedThreadId,
    input.threadMutationClient
  ]);

  const applyModeDraft = useCallback(async (draft: {
    modeKey: string;
    modelId: string;
    reasoningEffort: string;
  }) => {
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
      refreshAll: input.refreshAll,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError
    });
  }, [
    input.activeRequest,
    input.answerDraft,
    input.buildActionRequestOptions,
    input.chatClient,
    input.chatRequestActionCoordinator,
    input.pendingUserInputAnswerBuilder,
    input.refreshAll,
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
      refreshAll: input.refreshAll,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError
    });
  }, [
    input.activeRequest,
    input.buildActionRequestOptions,
    input.chatClient,
    input.chatRequestActionCoordinator,
    input.refreshAll,
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
      refreshAll: input.refreshAll,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError
    });
  }, [
    input.buildActionRequestOptions,
    input.chatClient,
    input.chatRequestActionCoordinator,
    input.refreshAll,
    input.reportTrackedUserInterfaceError,
    input.selectedThreadId,
    input.setIsBusy
  ]);

  const handleAnswerChange = useCallback(
    (questionId: string, field: "option" | "freeform", value: string) => {
      input.setAnswerDraft((previousAnswerDraft) => ({
        ...previousAnswerDraft,
        [questionId]: {
          ...(previousAnswerDraft[questionId] ?? { option: "", freeform: "" }),
          [field]: value
        }
      }));
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
