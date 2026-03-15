import { type Dispatch, type SetStateAction, useCallback, useMemo } from "react";
import {
  type ThreadListItem,
  type ThreadProjectGroup,
} from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { type ThreadRuntimeStatusByThreadIdentifier } from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import {
  type ThreadListPaneAgentDescriptor,
  type ThreadListPaneProperties,
} from "@/Features/Threads/UserInterface/ThreadListPaneContracts";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";

export interface UseThreadListPanePropertiesInput {
  threadListState: ThreadListPaneProperties["threadListState"];
  threads: ThreadListItem[];
  isCoreLoading: boolean;
  availableAgentIds: AgentId[];
  selectedAgentDescriptor: ThreadListPaneAgentDescriptor | null;
  selectedAgentLabel: string;
  agentsById: Partial<Record<AgentId, ThreadListPaneAgentDescriptor>>;
  isBusy: boolean;
  activeProjectGroups: ThreadProjectGroup[];
  selectedThreadId: string | null;
  collapsedThreadProjectGroups: Record<string, boolean>;
  unreadThreadIds: Record<string, true>;
  threadRuntimeStatusByThreadIdentifier: ThreadRuntimeStatusByThreadIdentifier;
  isGenerating: boolean;
  setCollapsedThreadProjectGroups: Dispatch<SetStateAction<Record<string, boolean>>>;
  createThreadForSingleAgent: (projectPath: string) => void;
  createNewThread: (projectPath: string, agentId: AgentId) => void | Promise<void>;
  setSelectedThreadId: (threadId: string) => void;
  selectedThreadIdRef: { current: string | null };
  setIsSelectedThreadLoading: (nextIsLoading: boolean) => void;
  applyCachedSelectedThreadSnapshot: (threadId: string) => boolean;
  setMobileSidebarOpen: (nextOpen: boolean) => void;
  archiveThread: (threadId: string) => void | Promise<void>;
  forkThread: (threadId: string) => void | Promise<void>;
  rollbackThread: (threadId: string) => void | Promise<void>;
  compactThread: (threadId: string) => void | Promise<void>;
  cleanThreadBackgroundTerminals: (threadId: string) => void | Promise<void>;
  startThreadReview: (threadId: string) => void | Promise<void>;
  setThreadName: (threadId: string, name: string) => void | Promise<void>;
  isArchivedThreadsOpen: boolean;
  setIsArchivedThreadsOpen: (nextOpen: boolean) => void;
  isArchivedThreadsLoading: boolean;
  hasLoadedArchivedThreads: boolean;
  archivedSectionThreadCount: number;
  archivedThreadsTruncated: boolean;
  archivedProjectGroups: ThreadProjectGroup[];
  collapsedArchivedProjectGroups: Record<string, boolean>;
  archivedThreadIds: Set<string>;
  setCollapsedArchivedProjectGroups: Dispatch<SetStateAction<Record<string, boolean>>>;
  unarchiveThread: (threadId: string) => void | Promise<void>;
  formatDate: ThreadListPaneProperties["formatDate"];
  renderAgentFavicon: ThreadListPaneProperties["renderAgentFavicon"];
}

export function useThreadListPaneProperties(
  input: UseThreadListPanePropertiesInput,
): ThreadListPaneProperties {
  const {
    threadListState,
    threads,
    isCoreLoading,
    availableAgentIds,
    selectedAgentDescriptor,
    selectedAgentLabel,
    agentsById,
    isBusy,
    activeProjectGroups,
    selectedThreadId,
    collapsedThreadProjectGroups,
    unreadThreadIds,
    threadRuntimeStatusByThreadIdentifier,
    isGenerating,
    setCollapsedThreadProjectGroups,
    createThreadForSingleAgent,
    createNewThread,
    setSelectedThreadId,
    selectedThreadIdRef,
    setIsSelectedThreadLoading,
    applyCachedSelectedThreadSnapshot,
    setMobileSidebarOpen,
    archiveThread,
    forkThread,
    rollbackThread,
    compactThread,
    cleanThreadBackgroundTerminals,
    startThreadReview,
    setThreadName,
    isArchivedThreadsOpen,
    setIsArchivedThreadsOpen,
    isArchivedThreadsLoading,
    hasLoadedArchivedThreads,
    archivedSectionThreadCount,
    archivedThreadsTruncated,
    archivedProjectGroups,
    collapsedArchivedProjectGroups,
    archivedThreadIds,
    setCollapsedArchivedProjectGroups,
    unarchiveThread,
    formatDate,
    renderAgentFavicon,
  } = input;

  const handleToggleThreadProjectGroup = useCallback(
    (groupKey: string, nextCollapsed: boolean): void => {
      setCollapsedThreadProjectGroups((previous) => ({
        ...previous,
        [groupKey]: nextCollapsed,
      }));
    },
    [setCollapsedThreadProjectGroups],
  );

  const handleCreateThreadForSingleAgent = useCallback(
    (projectPath: string): void => {
      createThreadForSingleAgent(projectPath);
    },
    [createThreadForSingleAgent],
  );

  const handleCreateNewThread = useCallback(
    (projectPath: string, agentId: AgentId): void => {
      void createNewThread(projectPath, agentId);
    },
    [createNewThread],
  );

  const handleSelectThread = useCallback(
    (threadId: string): void => {
      selectedThreadIdRef.current = threadId;
      setIsSelectedThreadLoading(true);
      applyCachedSelectedThreadSnapshot(threadId);
      setSelectedThreadId(threadId);
      setMobileSidebarOpen(false);
    },
    [
      applyCachedSelectedThreadSnapshot,
      selectedThreadIdRef,
      setIsSelectedThreadLoading,
      setMobileSidebarOpen,
      setSelectedThreadId,
    ],
  );

  const handleArchiveThread = useCallback(
    (threadId: string): void => {
      void archiveThread(threadId);
    },
    [archiveThread],
  );

  const handleCopyThreadId = useCallback((threadId: string): void => {
    void navigator.clipboard.writeText(threadId);
  }, []);

  const handleForkThread = useCallback(
    (threadId: string): void => {
      void forkThread(threadId);
    },
    [forkThread],
  );

  const handleRollbackThread = useCallback(
    (threadId: string): void => {
      void rollbackThread(threadId);
    },
    [rollbackThread],
  );

  const handleCompactThread = useCallback(
    (threadId: string): void => {
      void compactThread(threadId);
    },
    [compactThread],
  );

  const handleCleanThreadBackgroundTerminals = useCallback(
    (threadId: string): void => {
      void cleanThreadBackgroundTerminals(threadId);
    },
    [cleanThreadBackgroundTerminals],
  );

  const handleStartThreadReview = useCallback(
    (threadId: string): void => {
      void startThreadReview(threadId);
    },
    [startThreadReview],
  );

  const handleSetThreadName = useCallback(
    (threadId: string, name: string): void => {
      void setThreadName(threadId, name);
    },
    [setThreadName],
  );

  const handleToggleArchivedThreads = useCallback(
    (nextOpen: boolean): void => {
      setIsArchivedThreadsOpen(nextOpen);
    },
    [setIsArchivedThreadsOpen],
  );

  const handleToggleArchivedProjectGroup = useCallback(
    (groupKey: string, nextCollapsed: boolean): void => {
      setCollapsedArchivedProjectGroups((previous) => ({
        ...previous,
        [groupKey]: nextCollapsed,
      }));
    },
    [setCollapsedArchivedProjectGroups],
  );

  const handleUnarchiveThread = useCallback(
    (threadId: string): void => {
      void unarchiveThread(threadId);
    },
    [unarchiveThread],
  );

  return useMemo<ThreadListPaneProperties>(
    () => ({
      threadListState,
      threads,
      isCoreLoading,
      availableAgentIds,
      selectedAgentDescriptor,
      selectedAgentLabel,
      agentsById,
      isBusy,
      activeProjectGroups,
      selectedThreadId,
      collapsedThreadProjectGroups,
      unreadThreadIds,
      threadRuntimeStatusByThreadIdentifier,
      isGenerating,
      onToggleThreadProjectGroup: handleToggleThreadProjectGroup,
      onCreateThreadForSingleAgent: handleCreateThreadForSingleAgent,
      onCreateNewThread: handleCreateNewThread,
      onSelectThread: handleSelectThread,
      onCopyThreadId: handleCopyThreadId,
      onArchiveThread: handleArchiveThread,
      onForkThread: handleForkThread,
      onRollbackThread: handleRollbackThread,
      onCompactThread: handleCompactThread,
      onCleanThreadBackgroundTerminals: handleCleanThreadBackgroundTerminals,
      onStartThreadReview: handleStartThreadReview,
      onSetThreadName: handleSetThreadName,
      isArchivedThreadsOpen,
      onToggleArchivedThreads: handleToggleArchivedThreads,
      isArchivedThreadsLoading,
      hasLoadedArchivedThreads,
      archivedSectionThreadCount,
      archivedThreadsTruncated,
      archivedProjectGroups,
      collapsedArchivedProjectGroups,
      archivedThreadIds,
      onToggleArchivedProjectGroup: handleToggleArchivedProjectGroup,
      onUnarchiveThread: handleUnarchiveThread,
      formatDate,
      renderAgentFavicon,
    }),
    [
      activeProjectGroups,
      agentsById,
      archiveThread,
      compactThread,
      cleanThreadBackgroundTerminals,
      forkThread,
      rollbackThread,
      startThreadReview,
      archivedProjectGroups,
      archivedSectionThreadCount,
      archivedThreadIds,
      archivedThreadsTruncated,
      availableAgentIds,
      collapsedArchivedProjectGroups,
      collapsedThreadProjectGroups,
      formatDate,
      handleArchiveThread,
      handleCleanThreadBackgroundTerminals,
      handleCompactThread,
      handleCopyThreadId,
      handleCreateNewThread,
      handleCreateThreadForSingleAgent,
      handleForkThread,
      handleRollbackThread,
      handleSelectThread,
      handleSetThreadName,
      handleStartThreadReview,
      handleToggleArchivedProjectGroup,
      handleToggleArchivedThreads,
      handleToggleThreadProjectGroup,
      handleUnarchiveThread,
      hasLoadedArchivedThreads,
      isArchivedThreadsLoading,
      isArchivedThreadsOpen,
      isBusy,
      isCoreLoading,
      isGenerating,
      renderAgentFavicon,
      selectedAgentDescriptor,
      selectedAgentLabel,
      selectedThreadId,
      threadListState,
      threads,
      threadRuntimeStatusByThreadIdentifier,
      unreadThreadIds,
    ],
  );
}
