import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback } from "react";
import type { AgentId } from "@/Shared/Contracts/ApiContracts";
import { type ThreadMutationServerClient } from "../DataAccess/ThreadMutationServerClient";
import { type ThreadListItem } from "../DomainModel/ThreadGroupTypes";
import { PendingThreadMaterializationCoordinator } from "./PendingThreadMaterializationCoordinator";
import { type ThreadDisplayNameStateOwner } from "./ThreadDisplayNameStateOwner";
import { ThreadListStateController } from "./ThreadListStateController";
import {
  type CreateThreadActionInput,
  ThreadMutationActionCoordinator,
  type ThreadMutationActionErrorReportInput,
  type ThreadMutationActionRequestOptions,
  type ThreadMutationOperationName,
} from "./ThreadMutationActionCoordinator";

export interface UseThreadActionHandlersInput {
  availableAgentIds: AgentId[];
  threads: ThreadListItem[];
  buildActionRequestOptions: (
    actionName: ThreadMutationOperationName,
  ) => ThreadMutationActionRequestOptions;
  setIsBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setSelectedThreadId: Dispatch<SetStateAction<string | null>>;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  selectedThreadIdRef: MutableRefObject<string | null>;
  pendingThreadMaterializationCoordinator: PendingThreadMaterializationCoordinator;
  threadMutationActionCoordinator: ThreadMutationActionCoordinator;
  threadMutationServerClient: ThreadMutationServerClient;
  threadDisplayNameStateOwner: ThreadDisplayNameStateOwner;
  threadListStateController: ThreadListStateController;
  loadCoreDataTracked: () => Promise<void>;
  loadSelectedThreadTracked: (threadId: string) => Promise<void>;
  reportTrackedUserInterfaceError: (input: ThreadMutationActionErrorReportInput) => Promise<void>;
}

export interface ThreadActionHandlers {
  createNewThread: (projectPath: string, agentId?: AgentId) => Promise<void>;
  createThreadForSingleAgent: (projectPath: string) => void;
  runArchiveThread: (threadId: string) => Promise<void>;
  runForkThread: (threadId: string) => Promise<void>;
  runRollbackThread: (threadId: string) => Promise<void>;
  runStartThreadReview: (threadId: string) => Promise<void>;
  runSetThreadName: (threadId: string, name: string) => Promise<void>;
  runUnarchiveThread: (threadId: string) => Promise<void>;
}

export function useThreadActionHandlers(input: UseThreadActionHandlersInput): ThreadActionHandlers {
  const selectedThreadIdRef = input.selectedThreadIdRef;

  const refreshCreatedThreadData = useCallback(
    async (threadId: string): Promise<void> => {
      await input.loadCoreDataTracked();
      await input.loadSelectedThreadTracked(threadId);
    },
    [input.loadCoreDataTracked, input.loadSelectedThreadTracked],
  );

  const createNewThread = useCallback(
    async (projectPath: string, agentId?: AgentId) => {
      const createThreadInput: CreateThreadActionInput = {
        projectPath,
        buildActionRequestOptions: input.buildActionRequestOptions,
        onSetBusy: input.setIsBusy,
        onSetErrorMessage: input.setError,
        onMarkThreadPendingMaterialization: (threadId) => {
          input.pendingThreadMaterializationCoordinator.markPending(threadId);
        },
        onThreadSelected: (threadId) => {
          input.setSelectedThreadId(threadId);
          selectedThreadIdRef.current = threadId;
        },
        onSetMobileSidebarOpen: input.setMobileSidebarOpen,
        onInvalidateActiveThreadQuery: () => {
          input.threadListStateController.invalidateActiveThreadQuery();
        },
        threadMutationClient: input.threadMutationServerClient,
        onRefreshCreatedThreadData: refreshCreatedThreadData,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      };
      if (agentId !== undefined) {
        createThreadInput.agentId = agentId;
      }
      await input.threadMutationActionCoordinator.createThread(createThreadInput);
    },
    [
      input.buildActionRequestOptions,
      input.loadCoreDataTracked,
      input.loadSelectedThreadTracked,
      input.pendingThreadMaterializationCoordinator,
      input.reportTrackedUserInterfaceError,
      refreshCreatedThreadData,
      selectedThreadIdRef,
      input.setError,
      input.setIsBusy,
      input.setMobileSidebarOpen,
      input.setSelectedThreadId,
      input.threadMutationActionCoordinator,
      input.threadMutationServerClient,
    ],
  );

  const createThreadForSingleAgent = useCallback(
    (projectPath: string) => {
      const onlyAgentId = input.availableAgentIds[0];
      if (onlyAgentId === undefined) {
        input.setError("Cannot create thread: no enabled agent");
        return;
      }
      void createNewThread(projectPath, onlyAgentId);
    },
    [createNewThread, input.availableAgentIds, input.setError],
  );

  const runArchiveThread = useCallback(
    async (threadId: string) => {
      await input.threadMutationActionCoordinator.archiveThread({
        threadId,
        selectedThreadId: selectedThreadIdRef.current,
        activeThreadIdentifiersInOrder: input.threads.map((thread) => thread.id),
        buildActionRequestOptions: input.buildActionRequestOptions,
        onSetBusy: input.setIsBusy,
        onThreadSelected: (nextThreadId) => {
          input.setSelectedThreadId(nextThreadId);
          selectedThreadIdRef.current = nextThreadId;
        },
        onInvalidateActiveThreadQuery: () => {
          input.threadListStateController.invalidateActiveThreadQuery();
        },
        onInvalidateArchivedThreadQuery: () => {
          input.threadListStateController.invalidateArchivedThreadQuery();
        },
        loadCoreData: input.loadCoreDataTracked,
        threadMutationClient: input.threadMutationServerClient,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      });
    },
    [
      input.buildActionRequestOptions,
      input.loadCoreDataTracked,
      input.reportTrackedUserInterfaceError,
      selectedThreadIdRef,
      input.setIsBusy,
      input.setSelectedThreadId,
      input.threadListStateController,
      input.threadMutationActionCoordinator,
      input.threadMutationServerClient,
      input.threads,
    ],
  );

  const runUnarchiveThread = useCallback(
    async (threadId: string) => {
      await input.threadMutationActionCoordinator.unarchiveThread({
        threadId,
        buildActionRequestOptions: input.buildActionRequestOptions,
        onSetBusy: input.setIsBusy,
        onThreadSelected: (nextThreadId) => {
          input.setSelectedThreadId(nextThreadId);
          selectedThreadIdRef.current = nextThreadId;
        },
        onSetMobileSidebarOpen: input.setMobileSidebarOpen,
        onInvalidateActiveThreadQuery: () => {
          input.threadListStateController.invalidateActiveThreadQuery();
        },
        onInvalidateArchivedThreadQuery: () => {
          input.threadListStateController.invalidateArchivedThreadQuery();
        },
        loadCoreData: input.loadCoreDataTracked,
        threadMutationClient: input.threadMutationServerClient,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      });
    },
    [
      input.buildActionRequestOptions,
      input.loadCoreDataTracked,
      input.reportTrackedUserInterfaceError,
      selectedThreadIdRef,
      input.setIsBusy,
      input.setMobileSidebarOpen,
      input.setSelectedThreadId,
      input.threadListStateController,
      input.threadMutationActionCoordinator,
      input.threadMutationServerClient,
    ],
  );

  const runForkThread = useCallback(
    async (threadId: string) => {
      await input.threadMutationActionCoordinator.forkThread({
        threadId,
        buildActionRequestOptions: input.buildActionRequestOptions,
        onSetBusy: input.setIsBusy,
        onMarkThreadPendingMaterialization: (nextThreadId) => {
          input.pendingThreadMaterializationCoordinator.markPending(nextThreadId);
        },
        onThreadSelected: (nextThreadId) => {
          input.setSelectedThreadId(nextThreadId);
          selectedThreadIdRef.current = nextThreadId;
        },
        onSetMobileSidebarOpen: input.setMobileSidebarOpen,
        onInvalidateActiveThreadQuery: () => {
          input.threadListStateController.invalidateActiveThreadQuery();
        },
        onRefreshCreatedThreadData: refreshCreatedThreadData,
        threadMutationClient: input.threadMutationServerClient,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      });
    },
    [
      input.buildActionRequestOptions,
      input.pendingThreadMaterializationCoordinator,
      input.reportTrackedUserInterfaceError,
      refreshCreatedThreadData,
      selectedThreadIdRef,
      input.setIsBusy,
      input.setMobileSidebarOpen,
      input.setSelectedThreadId,
      input.threadListStateController,
      input.threadMutationActionCoordinator,
      input.threadMutationServerClient,
    ],
  );

  const runSetThreadName = useCallback(
    async (threadId: string, name: string) => {
      await input.threadMutationActionCoordinator.setThreadName({
        threadId,
        name,
        buildActionRequestOptions: input.buildActionRequestOptions,
        onSetBusy: input.setIsBusy,
        onSetErrorMessage: input.setError,
        onInvalidateActiveThreadQuery: () => {
          input.threadListStateController.invalidateActiveThreadQuery();
        },
        onInvalidateArchivedThreadQuery: () => {
          input.threadListStateController.invalidateArchivedThreadQuery();
        },
        onThreadNameUpdated: (updatedThreadIdentifier, threadName) => {
          input.threadDisplayNameStateOwner.writeThreadDisplayName(
            updatedThreadIdentifier,
            threadName,
          );
        },
        loadCoreData: input.loadCoreDataTracked,
        threadMutationClient: input.threadMutationServerClient,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      });
    },
    [
      input.buildActionRequestOptions,
      input.loadCoreDataTracked,
      input.reportTrackedUserInterfaceError,
      input.setError,
      input.setIsBusy,
      input.threadDisplayNameStateOwner,
      input.threadListStateController,
      input.threadMutationActionCoordinator,
      input.threadMutationServerClient,
    ],
  );

  const runRollbackThread = useCallback(
    async (threadId: string) => {
      await input.threadMutationActionCoordinator.rollbackThread({
        threadId,
        numTurns: 1,
        selectedThreadId: selectedThreadIdRef.current,
        buildActionRequestOptions: input.buildActionRequestOptions,
        onSetBusy: input.setIsBusy,
        onSetErrorMessage: input.setError,
        onInvalidateActiveThreadQuery: () => {
          input.threadListStateController.invalidateActiveThreadQuery();
        },
        loadCoreData: input.loadCoreDataTracked,
        onRefreshRolledBackThreadData: refreshCreatedThreadData,
        threadMutationClient: input.threadMutationServerClient,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      });
    },
    [
      input.buildActionRequestOptions,
      input.loadCoreDataTracked,
      input.reportTrackedUserInterfaceError,
      refreshCreatedThreadData,
      selectedThreadIdRef,
      input.setError,
      input.setIsBusy,
      input.threadListStateController,
      input.threadMutationActionCoordinator,
      input.threadMutationServerClient,
    ],
  );

  const runStartThreadReview = useCallback(
    async (threadId: string) => {
      await input.threadMutationActionCoordinator.startThreadReview({
        threadId,
        buildActionRequestOptions: input.buildActionRequestOptions,
        onSetBusy: input.setIsBusy,
        onThreadSelected: (nextThreadId) => {
          input.setSelectedThreadId(nextThreadId);
          selectedThreadIdRef.current = nextThreadId;
        },
        onSetMobileSidebarOpen: input.setMobileSidebarOpen,
        onInvalidateActiveThreadQuery: () => {
          input.threadListStateController.invalidateActiveThreadQuery();
        },
        onRefreshReviewThreadData: refreshCreatedThreadData,
        threadMutationClient: input.threadMutationServerClient,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      });
    },
    [
      input.buildActionRequestOptions,
      input.reportTrackedUserInterfaceError,
      refreshCreatedThreadData,
      selectedThreadIdRef,
      input.setIsBusy,
      input.setMobileSidebarOpen,
      input.setSelectedThreadId,
      input.threadListStateController,
      input.threadMutationActionCoordinator,
      input.threadMutationServerClient,
    ],
  );

  return {
    createNewThread,
    createThreadForSingleAgent,
    runArchiveThread,
    runForkThread,
    runRollbackThread,
    runStartThreadReview,
    runSetThreadName,
    runUnarchiveThread,
  };
}
