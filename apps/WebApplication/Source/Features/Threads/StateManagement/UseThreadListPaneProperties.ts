import { type Dispatch, type SetStateAction, useMemo } from "react";
import {
  type ThreadListItem,
  type ThreadProjectGroup,
} from "@/Features/Threads/DomainModel/ThreadGroupTypes";
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
  isGenerating: boolean;
  setCollapsedThreadProjectGroups: Dispatch<SetStateAction<Record<string, boolean>>>;
  createThreadForSingleAgent: (projectPath: string) => void;
  createNewThread: (projectPath: string, agentId: AgentId) => void | Promise<void>;
  setSelectedThreadId: (threadId: string) => void;
  setMobileSidebarOpen: (nextOpen: boolean) => void;
  archiveThread: (threadId: string) => void | Promise<void>;
  forkThread: (threadId: string) => void | Promise<void>;
  rollbackThread: (threadId: string) => void | Promise<void>;
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
    isGenerating,
    setCollapsedThreadProjectGroups,
    createThreadForSingleAgent,
    createNewThread,
    setSelectedThreadId,
    setMobileSidebarOpen,
    archiveThread,
    forkThread,
    rollbackThread,
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
      isGenerating,
      onToggleThreadProjectGroup: (groupKey, nextCollapsed) => {
        setCollapsedThreadProjectGroups((previous) => ({
          ...previous,
          [groupKey]: nextCollapsed,
        }));
      },
      onCreateThreadForSingleAgent: (projectPath) => {
        createThreadForSingleAgent(projectPath);
      },
      onCreateNewThread: (projectPath, agentId) => {
        void createNewThread(projectPath, agentId);
      },
      onSelectThread: (threadId) => {
        setSelectedThreadId(threadId);
        setMobileSidebarOpen(false);
      },
      onArchiveThread: (threadId) => {
        void archiveThread(threadId);
      },
      onForkThread: (threadId) => {
        void forkThread(threadId);
      },
      onRollbackThread: (threadId) => {
        void rollbackThread(threadId);
      },
      onSetThreadName: (threadId, name) => {
        void setThreadName(threadId, name);
      },
      isArchivedThreadsOpen,
      onToggleArchivedThreads: (nextOpen) => {
        setIsArchivedThreadsOpen(nextOpen);
      },
      isArchivedThreadsLoading,
      hasLoadedArchivedThreads,
      archivedSectionThreadCount,
      archivedThreadsTruncated,
      archivedProjectGroups,
      collapsedArchivedProjectGroups,
      archivedThreadIds,
      onToggleArchivedProjectGroup: (groupKey, nextCollapsed) => {
        setCollapsedArchivedProjectGroups((previous) => ({
          ...previous,
          [groupKey]: nextCollapsed,
        }));
      },
      onUnarchiveThread: (threadId) => {
        void unarchiveThread(threadId);
      },
      formatDate,
      renderAgentFavicon,
    }),
    [
      activeProjectGroups,
      agentsById,
      archiveThread,
      forkThread,
      rollbackThread,
      archivedProjectGroups,
      archivedSectionThreadCount,
      archivedThreadIds,
      archivedThreadsTruncated,
      availableAgentIds,
      collapsedArchivedProjectGroups,
      collapsedThreadProjectGroups,
      createNewThread,
      createThreadForSingleAgent,
      formatDate,
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
      setThreadName,
      setCollapsedArchivedProjectGroups,
      setCollapsedThreadProjectGroups,
      setIsArchivedThreadsOpen,
      setMobileSidebarOpen,
      setSelectedThreadId,
      threadListState,
      threads,
      unarchiveThread,
      unreadThreadIds,
    ],
  );
}
