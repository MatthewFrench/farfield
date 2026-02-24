import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import type { AgentId, ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { type ThreadListItem } from "../DomainModel/ThreadGroupTypes";
import { ThreadListStateController } from "./ThreadListStateController";
import { PendingThreadMaterializationCoordinator } from "./PendingThreadMaterializationCoordinator";
import {
  ThreadMutationActionCoordinator,
  type ThreadMutationActionErrorReportInput
} from "./ThreadMutationActionCoordinator";
import { type ThreadMutationServerClient } from "../DataAccess/ThreadMutationServerClient";

interface ActionRequestOptions {
  actionId: string;
  requestOptions: ApiRequestOptions;
}

export interface UseThreadActionHandlersInput {
  availableAgentIds: AgentId[];
  threads: ThreadListItem[];
  buildActionRequestOptions: (actionName: string) => ActionRequestOptions;
  setIsBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setSelectedThreadId: Dispatch<SetStateAction<string | null>>;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  selectedThreadIdRef: MutableRefObject<string | null>;
  pendingThreadMaterializationCoordinator: PendingThreadMaterializationCoordinator;
  threadMutationActionCoordinator: ThreadMutationActionCoordinator;
  threadMutationServerClient: ThreadMutationServerClient;
  threadListStateController: ThreadListStateController;
  loadCoreDataTracked: () => Promise<void>;
  refreshAll: () => Promise<void>;
  reportTrackedUserInterfaceError: (input: ThreadMutationActionErrorReportInput) => Promise<void>;
}

export interface ThreadActionHandlers {
  createNewThread: (projectPath: string, agentId?: AgentId) => Promise<void>;
  createThreadForSingleAgent: (projectPath: string) => void;
  runArchiveThread: (threadId: string) => Promise<void>;
  runUnarchiveThread: (threadId: string) => Promise<void>;
}

export function useThreadActionHandlers(input: UseThreadActionHandlersInput): ThreadActionHandlers {
  const createNewThread = useCallback(async (projectPath: string, agentId?: AgentId) => {
    await input.threadMutationActionCoordinator.createThread({
      projectPath,
      ...(agentId ? { agentId } : {}),
      buildActionRequestOptions: input.buildActionRequestOptions,
      onSetBusy: input.setIsBusy,
      onSetErrorMessage: input.setError,
      onMarkThreadPendingMaterialization: (threadId) => {
        input.pendingThreadMaterializationCoordinator.markPending(threadId);
      },
      onThreadSelected: (threadId) => {
        input.setSelectedThreadId(threadId);
        input.selectedThreadIdRef.current = threadId;
      },
      onSetMobileSidebarOpen: input.setMobileSidebarOpen,
      onInvalidateActiveThreadQuery: () => {
        input.threadListStateController.invalidateActiveThreadQuery();
      },
      threadMutationClient: input.threadMutationServerClient,
      refreshAll: input.refreshAll,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError
    });
  }, [
    input.buildActionRequestOptions,
    input.pendingThreadMaterializationCoordinator,
    input.refreshAll,
    input.reportTrackedUserInterfaceError,
    input.selectedThreadIdRef,
    input.setError,
    input.setIsBusy,
    input.setMobileSidebarOpen,
    input.setSelectedThreadId,
    input.threadMutationActionCoordinator,
    input.threadMutationServerClient
  ]);

  const createThreadForSingleAgent = useCallback((projectPath: string) => {
    const onlyAgentId = input.availableAgentIds[0];
    if (!onlyAgentId) {
      input.setError("Cannot create thread: no enabled agent");
      return;
    }
    void createNewThread(projectPath, onlyAgentId);
  }, [createNewThread, input.availableAgentIds, input.setError]);

  const runArchiveThread = useCallback(async (threadId: string) => {
    await input.threadMutationActionCoordinator.archiveThread({
      threadId,
      selectedThreadId: input.selectedThreadIdRef.current,
      activeThreadIdentifiersInOrder: input.threads.map((thread) => thread.id),
      buildActionRequestOptions: input.buildActionRequestOptions,
      onSetBusy: input.setIsBusy,
      onThreadSelected: (nextThreadId) => {
        input.setSelectedThreadId(nextThreadId);
        input.selectedThreadIdRef.current = nextThreadId;
      },
      onInvalidateActiveThreadQuery: () => {
        input.threadListStateController.invalidateActiveThreadQuery();
      },
      onInvalidateArchivedThreadQuery: () => {
        input.threadListStateController.invalidateArchivedThreadQuery();
      },
      loadCoreData: input.loadCoreDataTracked,
      threadMutationClient: input.threadMutationServerClient,
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError
    });
  }, [
    input.buildActionRequestOptions,
    input.loadCoreDataTracked,
    input.reportTrackedUserInterfaceError,
    input.selectedThreadIdRef,
    input.setIsBusy,
    input.setSelectedThreadId,
    input.threadListStateController,
    input.threadMutationActionCoordinator,
    input.threadMutationServerClient,
    input.threads
  ]);

  const runUnarchiveThread = useCallback(async (threadId: string) => {
    await input.threadMutationActionCoordinator.unarchiveThread({
      threadId,
      buildActionRequestOptions: input.buildActionRequestOptions,
      onSetBusy: input.setIsBusy,
      onThreadSelected: (nextThreadId) => {
        input.setSelectedThreadId(nextThreadId);
        input.selectedThreadIdRef.current = nextThreadId;
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
      reportTrackedUserInterfaceError: input.reportTrackedUserInterfaceError
    });
  }, [
    input.buildActionRequestOptions,
    input.loadCoreDataTracked,
    input.reportTrackedUserInterfaceError,
    input.selectedThreadIdRef,
    input.setIsBusy,
    input.setMobileSidebarOpen,
    input.setSelectedThreadId,
    input.threadListStateController,
    input.threadMutationActionCoordinator,
    input.threadMutationServerClient
  ]);

  return {
    createNewThread,
    createThreadForSingleAgent,
    runArchiveThread,
    runUnarchiveThread
  };
}
