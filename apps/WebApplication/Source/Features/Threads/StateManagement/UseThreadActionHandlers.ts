import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback } from "react";
import { type SuccessBannerDetails } from "@/Features/Debugging/DomainModel/DebugIssueContracts";
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
  setSuccessBannerDetails: Dispatch<SetStateAction<SuccessBannerDetails | null>>;
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
  runCompactThread: (threadId: string) => Promise<void>;
  runCleanThreadBackgroundTerminals: (threadId: string) => Promise<void>;
  runStartThreadReview: (threadId: string) => Promise<void>;
  runSetThreadName: (threadId: string, name: string) => Promise<void>;
  runUnarchiveThread: (threadId: string) => Promise<void>;
}

async function refreshCreatedThreadData(
  loadCoreDataTracked: () => Promise<void>,
  loadSelectedThreadTracked: (threadId: string) => Promise<void>,
  threadListStateController: ThreadListStateController,
  threadId: string,
): Promise<void> {
  await threadListStateController.prepareActiveThreadQueryForExplicitRefresh();
  await loadCoreDataTracked();
  await loadSelectedThreadTracked(threadId);
}

export function useThreadActionHandlers(input: UseThreadActionHandlersInput): ThreadActionHandlers {
  const selectedThreadIdRef = input.selectedThreadIdRef;
  const refreshCreatedThreadDataForThread = useCallback(
    (threadId: string): Promise<void> =>
      refreshCreatedThreadData(
        input.loadCoreDataTracked,
        input.loadSelectedThreadTracked,
        input.threadListStateController,
        threadId,
      ),
    [input.loadCoreDataTracked, input.loadSelectedThreadTracked, input.threadListStateController],
  );
  const markThreadPendingMaterialization = useCallback(
    (threadId: string): void => {
      input.pendingThreadMaterializationCoordinator.markPending(threadId);
    },
    [input.pendingThreadMaterializationCoordinator],
  );
  const handleThreadSelected = useCallback(
    (threadId: string | null): void => {
      input.setSelectedThreadId(threadId);
      selectedThreadIdRef.current = threadId;
    },
    [input.setSelectedThreadId, selectedThreadIdRef],
  );
  const invalidateActiveThreadQuery = useCallback((): void => {
    input.threadListStateController.invalidateActiveThreadQuery();
  }, [input.threadListStateController]);
  const invalidateArchivedThreadQuery = useCallback((): void => {
    input.threadListStateController.invalidateArchivedThreadQuery();
  }, [input.threadListStateController]);

  const createNewThread = useCallback(
    async (projectPath: string, agentId?: AgentId) => {
      const createThreadInput: CreateThreadActionInput = {
        projectPath,
        buildActionRequestOptions: input.buildActionRequestOptions,
        onSetBusy: input.setIsBusy,
        onSetErrorMessage: input.setError,
        onMarkThreadPendingMaterialization: markThreadPendingMaterialization,
        onThreadSelected: handleThreadSelected,
        onSetMobileSidebarOpen: input.setMobileSidebarOpen,
        onInvalidateActiveThreadQuery: invalidateActiveThreadQuery,
        threadMutationClient: input.threadMutationServerClient,
        onRefreshCreatedThreadData: refreshCreatedThreadDataForThread,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      };
      if (agentId !== undefined) {
        createThreadInput.agentId = agentId;
      }
      await input.threadMutationActionCoordinator.createThread(createThreadInput);
    },
    [
      input.buildActionRequestOptions,
      handleThreadSelected,
      invalidateActiveThreadQuery,
      markThreadPendingMaterialization,
      input.reportTrackedUserInterfaceError,
      refreshCreatedThreadDataForThread,
      input.setError,
      input.setIsBusy,
      input.setMobileSidebarOpen,
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
        onThreadSelected: handleThreadSelected,
        onInvalidateActiveThreadQuery: invalidateActiveThreadQuery,
        onInvalidateArchivedThreadQuery: invalidateArchivedThreadQuery,
        loadCoreData: input.loadCoreDataTracked,
        threadMutationClient: input.threadMutationServerClient,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      });
    },
    [
      input.buildActionRequestOptions,
      handleThreadSelected,
      invalidateActiveThreadQuery,
      invalidateArchivedThreadQuery,
      input.loadCoreDataTracked,
      input.reportTrackedUserInterfaceError,
      input.setIsBusy,
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
        onThreadSelected: handleThreadSelected,
        onSetMobileSidebarOpen: input.setMobileSidebarOpen,
        onInvalidateActiveThreadQuery: invalidateActiveThreadQuery,
        onInvalidateArchivedThreadQuery: invalidateArchivedThreadQuery,
        loadCoreData: input.loadCoreDataTracked,
        threadMutationClient: input.threadMutationServerClient,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      });
    },
    [
      input.buildActionRequestOptions,
      handleThreadSelected,
      invalidateActiveThreadQuery,
      invalidateArchivedThreadQuery,
      input.loadCoreDataTracked,
      input.reportTrackedUserInterfaceError,
      input.setIsBusy,
      input.setMobileSidebarOpen,
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
        onMarkThreadPendingMaterialization: markThreadPendingMaterialization,
        onThreadSelected: handleThreadSelected,
        onSetMobileSidebarOpen: input.setMobileSidebarOpen,
        onInvalidateActiveThreadQuery: invalidateActiveThreadQuery,
        onRefreshCreatedThreadData: refreshCreatedThreadDataForThread,
        threadMutationClient: input.threadMutationServerClient,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      });
    },
    [
      input.buildActionRequestOptions,
      handleThreadSelected,
      invalidateActiveThreadQuery,
      markThreadPendingMaterialization,
      input.reportTrackedUserInterfaceError,
      refreshCreatedThreadDataForThread,
      input.setIsBusy,
      input.setMobileSidebarOpen,
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
        onInvalidateActiveThreadQuery: invalidateActiveThreadQuery,
        onInvalidateArchivedThreadQuery: invalidateArchivedThreadQuery,
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
      invalidateActiveThreadQuery,
      invalidateArchivedThreadQuery,
      input.loadCoreDataTracked,
      input.reportTrackedUserInterfaceError,
      input.setError,
      input.setIsBusy,
      input.threadDisplayNameStateOwner,
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
        onInvalidateActiveThreadQuery: invalidateActiveThreadQuery,
        loadCoreData: input.loadCoreDataTracked,
        onRefreshRolledBackThreadData: refreshCreatedThreadDataForThread,
        threadMutationClient: input.threadMutationServerClient,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      });
    },
    [
      input.buildActionRequestOptions,
      invalidateActiveThreadQuery,
      input.loadCoreDataTracked,
      input.reportTrackedUserInterfaceError,
      refreshCreatedThreadDataForThread,
      selectedThreadIdRef,
      input.setError,
      input.setIsBusy,
      input.threadMutationActionCoordinator,
      input.threadMutationServerClient,
    ],
  );

  const runCompactThread = useCallback(
    async (threadId: string) => {
      await input.threadMutationActionCoordinator.compactThread({
        threadId,
        selectedThreadId: selectedThreadIdRef.current,
        buildActionRequestOptions: input.buildActionRequestOptions,
        onSetBusy: input.setIsBusy,
        onInvalidateActiveThreadQuery: invalidateActiveThreadQuery,
        loadCoreData: input.loadCoreDataTracked,
        onRefreshCompactedThreadData: refreshCreatedThreadDataForThread,
        threadMutationClient: input.threadMutationServerClient,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
        onReportSuccess: ({ actionId }) => {
          input.setSuccessBannerDetails({
            operation: "compact-thread",
            message: "Compaction started.",
            actionId,
          });
        },
      });
    },
    [
      input.buildActionRequestOptions,
      invalidateActiveThreadQuery,
      input.loadCoreDataTracked,
      input.reportTrackedUserInterfaceError,
      refreshCreatedThreadDataForThread,
      selectedThreadIdRef,
      input.setIsBusy,
      input.threadMutationActionCoordinator,
      input.threadMutationServerClient,
    ],
  );

  const runCleanThreadBackgroundTerminals = useCallback(
    async (threadId: string) => {
      await input.threadMutationActionCoordinator.cleanThreadBackgroundTerminals({
        threadId,
        selectedThreadId: selectedThreadIdRef.current,
        buildActionRequestOptions: input.buildActionRequestOptions,
        onSetBusy: input.setIsBusy,
        onInvalidateActiveThreadQuery: invalidateActiveThreadQuery,
        loadCoreData: input.loadCoreDataTracked,
        onRefreshCleanedThreadData: refreshCreatedThreadDataForThread,
        threadMutationClient: input.threadMutationServerClient,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
        onReportSuccess: ({ actionId }) => {
          input.setSuccessBannerDetails({
            operation: "clean-thread-background-terminals",
            message: "Background terminals cleaned.",
            actionId,
          });
        },
      });
    },
    [
      input.buildActionRequestOptions,
      invalidateActiveThreadQuery,
      input.loadCoreDataTracked,
      input.reportTrackedUserInterfaceError,
      refreshCreatedThreadDataForThread,
      selectedThreadIdRef,
      input.setIsBusy,
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
        onThreadSelected: handleThreadSelected,
        onSetMobileSidebarOpen: input.setMobileSidebarOpen,
        onInvalidateActiveThreadQuery: invalidateActiveThreadQuery,
        onRefreshReviewThreadData: refreshCreatedThreadDataForThread,
        threadMutationClient: input.threadMutationServerClient,
        reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError,
      });
    },
    [
      input.buildActionRequestOptions,
      handleThreadSelected,
      invalidateActiveThreadQuery,
      input.reportTrackedUserInterfaceError,
      refreshCreatedThreadDataForThread,
      input.setIsBusy,
      input.setMobileSidebarOpen,
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
    runCompactThread,
    runCleanThreadBackgroundTerminals,
    runStartThreadReview,
    runSetThreadName,
    runUnarchiveThread,
  };
}
