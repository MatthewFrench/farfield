import {
  type CommandExecutionApprovalResponsePayload,
  type DeprecatedApprovalReviewDecision,
  type FileChangeApprovalResponsePayload,
  type ToolCallResponsePayload,
} from "@farfield/protocol";
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useRef,
} from "react";
import { PendingThreadMaterializationCoordinator } from "@/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator";
import type { AgentId, ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { type NewThreadProjectPathResolution } from "../DomainModel/NewThreadProjectPathResolver";
import { type PendingApplyPatchApprovalRequest } from "../DomainModel/PendingApplyPatchApprovalRequestSelector";
import { type PendingAuthTokenRefreshRequest } from "../DomainModel/PendingAuthTokenRefreshRequestSelector";
import { type PendingCommandExecutionApprovalRequest } from "../DomainModel/PendingCommandExecutionApprovalRequestSelector";
import { type PendingExecuteCommandApprovalRequest } from "../DomainModel/PendingExecuteCommandApprovalRequestSelector";
import { type PendingFileChangeApprovalRequest } from "../DomainModel/PendingFileChangeApprovalRequestSelector";
import { type PendingToolCallRequest } from "../DomainModel/PendingToolCallRequestSelector";
import {
  PendingUserInputAnswerBuilder,
  type PendingUserInputAnswerDraftByQuestionId,
} from "../DomainModel/PendingUserInputAnswerBuilder";
import { type PendingUserInputRequest } from "../DomainModel/PendingUserInputRequestSelector";
import {
  type ChatRequestActionChatClient,
  ChatRequestActionCoordinator,
  type ChatRequestActionErrorReportInput,
  type ChatRequestActionThreadMutationClient,
} from "./ChatRequestActionCoordinator";
import {
  type CollaborationModeActionChatClient,
  CollaborationModeActionCoordinator,
  type CollaborationModeActionDraft,
  type CollaborationModeActionErrorReportInput,
  type CollaborationModeActionModeOption,
} from "./CollaborationModeActionCoordinator";
import { NewThreadFirstTurnHydrationCoordinator } from "./NewThreadFirstTurnHydrationCoordinator";
import {
  type ChatActionRequestOptions,
  type PendingUserInputAnswerField,
  useChatRequestActionHandlers,
} from "./UseChatRequestActionHandlers";
import { type LoadSelectedThreadOptions } from "./UseSelectedThreadLoaders";

type ChatActionErrorReportInput =
  | ChatRequestActionErrorReportInput
  | CollaborationModeActionErrorReportInput;
type ChatActionModeDraft = CollaborationModeActionDraft;

export interface UseChatActionHandlersInput {
  selectedThreadId: string | null;
  selectedAgentId: AgentId;
  newThreadProjectPathResolution: NewThreadProjectPathResolution;
  modes: CollaborationModeActionModeOption[];
  isModeSyncing: boolean;
  activeRequest: PendingUserInputRequest | null;
  activeAuthTokenRefreshRequest?: PendingAuthTokenRefreshRequest | null;
  activeApplyPatchApprovalRequest?: PendingApplyPatchApprovalRequest | null;
  activeCommandExecutionApprovalRequest?: PendingCommandExecutionApprovalRequest | null;
  activeExecuteCommandApprovalRequest?: PendingExecuteCommandApprovalRequest | null;
  activeFileChangeApprovalRequest?: PendingFileChangeApprovalRequest | null;
  activeToolCallRequest?: PendingToolCallRequest | null;
  answerDraft: PendingUserInputAnswerDraftByQuestionId;
  setAnswerDraft: Dispatch<SetStateAction<PendingUserInputAnswerDraftByQuestionId>>;
  buildActionRequestOptions: (actionName: string) => ChatActionRequestOptions;
  setErrorMessage: Dispatch<SetStateAction<string>>;
  setIsBusy: Dispatch<SetStateAction<boolean>>;
  setIsModeSyncing: Dispatch<SetStateAction<boolean>>;
  setSelectedThreadId: Dispatch<SetStateAction<string | null>>;
  selectedThreadIdRef: MutableRefObject<string | null>;
  eventsConnectedRef: MutableRefObject<boolean>;
  pendingThreadMaterializationCoordinator: PendingThreadMaterializationCoordinator;
  readLastAppliedModeSignature: () => string;
  writeLastAppliedModeSignature: (modeSignature: string) => void;
  chatRequestActionCoordinator: ChatRequestActionCoordinator;
  collaborationModeActionCoordinator: CollaborationModeActionCoordinator;
  chatClient: ChatRequestActionChatClient & CollaborationModeActionChatClient;
  selectedThreadReadClient: {
    readThread: (
      threadId: string,
      options?: {
        includeTurns?: boolean;
      },
    ) => Promise<{
      thread: {
        preview: string | undefined;
        status:
          | {
              type: string;
            }
          | undefined;
      };
    }>;
  };
  threadMutationClient: ChatRequestActionThreadMutationClient;
  pendingUserInputAnswerBuilder: PendingUserInputAnswerBuilder;
  onInvalidateActiveThreadQuery: () => void;
  refreshActiveThreadListTracked: () => Promise<void>;
  onReloadSelectedThread: (threadId: string, options?: LoadSelectedThreadOptions) => Promise<void>;
  reportTrackedUserInterfaceError: (input: ChatActionErrorReportInput) => Promise<void>;
}

export interface ChatActionHandlers {
  submitMessage: (draft: string) => Promise<void>;
  steerMessage: (draft: string) => Promise<void>;
  applyModeDraft: (draft: ChatActionModeDraft) => Promise<void>;
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

export function useChatActionHandlers(input: UseChatActionHandlersInput): ChatActionHandlers {
  const newThreadFirstTurnHydrationCoordinatorReference =
    useRef<NewThreadFirstTurnHydrationCoordinator | null>(null);
  if (newThreadFirstTurnHydrationCoordinatorReference.current === null) {
    newThreadFirstTurnHydrationCoordinatorReference.current =
      new NewThreadFirstTurnHydrationCoordinator({
        reloadSelectedThread: input.onReloadSelectedThread,
        readThreadWithoutTurns: async (threadId) => {
          return input.selectedThreadReadClient.readThread(threadId, { includeTurns: false });
        },
      });
  } else {
    newThreadFirstTurnHydrationCoordinatorReference.current.updateDependencies({
      reloadSelectedThread: input.onReloadSelectedThread,
      readThreadWithoutTurns: async (threadId) => {
        return input.selectedThreadReadClient.readThread(threadId, { includeTurns: false });
      },
    });
  }
  const newThreadFirstTurnHydrationCoordinator =
    newThreadFirstTurnHydrationCoordinatorReference.current;

  const refreshThreadData = useCallback(
    async (inputValue: {
      threadId: string;
      preferStreamDrivenSelectedThreadRefresh: boolean;
      preserveNoTurnsReload: boolean;
      hydrateFirstTurnInBackground: boolean;
    }): Promise<void> => {
      const shouldPreferStreamDrivenSelectedThreadRefresh =
        inputValue.preferStreamDrivenSelectedThreadRefresh &&
        !input.pendingThreadMaterializationCoordinator.isPending(inputValue.threadId);
      if (
        shouldPreferStreamDrivenSelectedThreadRefresh &&
        input.eventsConnectedRef.current &&
        input.selectedThreadIdRef.current === inputValue.threadId
      ) {
        void input.refreshActiveThreadListTracked();
        return;
      }
      await input.refreshActiveThreadListTracked();
      await input.onReloadSelectedThread(
        inputValue.threadId,
        inputValue.preserveNoTurnsReload ? { includeTurns: false } : undefined,
      );
      if (inputValue.hydrateFirstTurnInBackground) {
        newThreadFirstTurnHydrationCoordinator.scheduleHydration(inputValue.threadId);
      }
    },
    [
      input.eventsConnectedRef,
      input.onReloadSelectedThread,
      input.refreshActiveThreadListTracked,
      input.selectedThreadReadClient,
      input.selectedThreadIdRef,
      newThreadFirstTurnHydrationCoordinator,
    ],
  );

  const refreshExistingThreadData = useCallback(
    async (threadId: string): Promise<void> => {
      await refreshThreadData({
        threadId,
        preferStreamDrivenSelectedThreadRefresh: true,
        preserveNoTurnsReload: false,
        hydrateFirstTurnInBackground: false,
      });
    },
    [refreshThreadData],
  );

  const handleThreadSelected = (threadId: string): void => {
    input.setSelectedThreadId(threadId);
    const selectedThreadIdReference = input.selectedThreadIdRef;
    selectedThreadIdReference.current = threadId;
  };

  const markThreadPendingMaterialization = (threadId: string): void => {
    input.pendingThreadMaterializationCoordinator.markPending(threadId);
  };

  const submitMessage = useCallback(
    async (draft: string) => {
      const selectedThreadAlreadyExisted =
        input.selectedThreadId !== null && input.selectedThreadId.length > 0;
      if (
        !selectedThreadAlreadyExisted &&
        input.newThreadProjectPathResolution.status !== "resolved"
      ) {
        input.setErrorMessage(input.newThreadProjectPathResolution.message);
        return;
      }
      await input.chatRequestActionCoordinator.sendMessage({
        draft,
        selectedThreadId: input.selectedThreadId,
        selectedAgentId: input.selectedAgentId,
        projectPathForNewThread:
          input.newThreadProjectPathResolution.status === "resolved"
            ? input.newThreadProjectPathResolution.projectPath
            : null,
        buildActionRequestOptions: input.buildActionRequestOptions,
        onSetErrorMessage: input.setErrorMessage,
        onSetBusy: input.setIsBusy,
        onThreadSelected: handleThreadSelected,
        onMarkThreadPendingMaterialization: markThreadPendingMaterialization,
        chatClient: input.chatClient,
        threadMutationClient: input.threadMutationClient,
        onInvalidateActiveThreadQuery: input.onInvalidateActiveThreadQuery,
        onRefreshThreadData: async (threadId) => {
          await refreshThreadData({
            threadId,
            preferStreamDrivenSelectedThreadRefresh: selectedThreadAlreadyExisted,
            preserveNoTurnsReload: !selectedThreadAlreadyExisted,
            hydrateFirstTurnInBackground: !selectedThreadAlreadyExisted,
          });
        },
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      });
    },
    [
      input.buildActionRequestOptions,
      input.chatClient,
      input.chatRequestActionCoordinator,
      handleThreadSelected,
      markThreadPendingMaterialization,
      input.newThreadProjectPathResolution,
      input.onInvalidateActiveThreadQuery,
      input.reportTrackedUserInterfaceError,
      input.selectedAgentId,
      input.selectedThreadId,
      input.setErrorMessage,
      input.setIsBusy,
      input.threadMutationClient,
      refreshThreadData,
    ],
  );

  const applyModeDraft = useCallback(
    async (draft: ChatActionModeDraft) => {
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
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      });
    },
    [
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
      input.writeLastAppliedModeSignature,
    ],
  );

  const steerMessage = useCallback(
    async (draft: string) => {
      await input.chatRequestActionCoordinator.steerMessage({
        draft,
        selectedThreadId: input.selectedThreadId,
        buildActionRequestOptions: input.buildActionRequestOptions,
        onSetBusy: input.setIsBusy,
        chatClient: input.chatClient,
        onInvalidateActiveThreadQuery: input.onInvalidateActiveThreadQuery,
        onRefreshThreadData: refreshExistingThreadData,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      });
    },
    [
      input.buildActionRequestOptions,
      input.chatClient,
      input.chatRequestActionCoordinator,
      input.onInvalidateActiveThreadQuery,
      input.reportTrackedUserInterfaceError,
      input.selectedThreadId,
      input.setIsBusy,
      refreshExistingThreadData,
    ],
  );

  const {
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
  } = useChatRequestActionHandlers({
    selectedThreadId: input.selectedThreadId,
    activeRequest: input.activeRequest,
    activeAuthTokenRefreshRequest: input.activeAuthTokenRefreshRequest,
    activeApplyPatchApprovalRequest: input.activeApplyPatchApprovalRequest,
    activeCommandExecutionApprovalRequest: input.activeCommandExecutionApprovalRequest,
    activeExecuteCommandApprovalRequest: input.activeExecuteCommandApprovalRequest,
    activeFileChangeApprovalRequest: input.activeFileChangeApprovalRequest,
    activeToolCallRequest: input.activeToolCallRequest,
    answerDraft: input.answerDraft,
    setAnswerDraft: input.setAnswerDraft,
    buildActionRequestOptions: input.buildActionRequestOptions,
    setIsBusy: input.setIsBusy,
    chatRequestActionCoordinator: input.chatRequestActionCoordinator,
    chatClient: input.chatClient,
    pendingUserInputAnswerBuilder: input.pendingUserInputAnswerBuilder,
    onInvalidateActiveThreadQuery: input.onInvalidateActiveThreadQuery,
    onRefreshThreadData: refreshExistingThreadData,
    reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
  });

  return {
    submitMessage,
    steerMessage,
    applyModeDraft,
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
