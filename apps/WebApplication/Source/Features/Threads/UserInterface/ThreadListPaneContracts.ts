import React from "react";
import type {
  ThreadListItem,
  ThreadProjectGroup,
} from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";

export interface ThreadListPaneAgentDescriptor {
  label: string;
  projectDirectories: readonly string[];
}

export type ThreadListPaneState = "loading" | "empty" | "ready";
export type ThreadListPaneCollapsedProjectGroups = Record<string, boolean>;
export type ThreadListPaneUnreadThreadIdentifiers = Record<string, true>;
export type ThreadListPaneArchivedThreadIdentifiers = Set<string>;
export type ThreadListPaneToggleProjectGroup = (groupKey: string, nextCollapsed: boolean) => void;
export type ThreadListPaneCreateThreadForSingleAgent = (projectPath: string) => void;
export type ThreadListPaneCreateThread = (projectPath: string, agentId: AgentId) => void;
export type ThreadListPaneThreadSelectionHandler = (threadId: string) => void;
export type ThreadListPaneArchiveToggle = (nextOpen: boolean) => void;
export type ThreadListPaneDateFormatter = (value: number | string | null | undefined) => string;
export type ThreadListPaneAgentFaviconRenderer = (
  agentId: AgentId,
  label: string,
  className: string,
) => React.ReactNode;

export interface ThreadListPaneProperties {
  threadListState: ThreadListPaneState;
  threads: ThreadListItem[];
  isCoreLoading: boolean;
  availableAgentIds: AgentId[];
  selectedAgentDescriptor: ThreadListPaneAgentDescriptor | null;
  selectedAgentLabel: string;
  agentsById: Readonly<Partial<Record<AgentId, ThreadListPaneAgentDescriptor>>>;
  isBusy: boolean;
  activeProjectGroups: ThreadProjectGroup[];
  selectedThreadId: string | null;
  collapsedThreadProjectGroups: ThreadListPaneCollapsedProjectGroups;
  unreadThreadIds: ThreadListPaneUnreadThreadIdentifiers;
  isGenerating: boolean;
  onToggleThreadProjectGroup: ThreadListPaneToggleProjectGroup;
  onCreateThreadForSingleAgent: ThreadListPaneCreateThreadForSingleAgent;
  onCreateNewThread: ThreadListPaneCreateThread;
  onSelectThread: ThreadListPaneThreadSelectionHandler;
  onArchiveThread: ThreadListPaneThreadSelectionHandler;
  onForkThread: ThreadListPaneThreadSelectionHandler;
  onRollbackThread: ThreadListPaneThreadSelectionHandler;
  onStartThreadReview: ThreadListPaneThreadSelectionHandler;
  onSetThreadName: (threadId: string, name: string) => void;
  isArchivedThreadsOpen: boolean;
  onToggleArchivedThreads: ThreadListPaneArchiveToggle;
  isArchivedThreadsLoading: boolean;
  hasLoadedArchivedThreads: boolean;
  archivedSectionThreadCount: number;
  archivedThreadsTruncated: boolean;
  archivedProjectGroups: ThreadProjectGroup[];
  collapsedArchivedProjectGroups: ThreadListPaneCollapsedProjectGroups;
  archivedThreadIds: ThreadListPaneArchivedThreadIdentifiers;
  onToggleArchivedProjectGroup: ThreadListPaneToggleProjectGroup;
  onUnarchiveThread: ThreadListPaneThreadSelectionHandler;
  formatDate: ThreadListPaneDateFormatter;
  renderAgentFavicon: ThreadListPaneAgentFaviconRenderer;
}
