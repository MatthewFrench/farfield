import React from "react";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import type { ThreadListItem, ThreadProjectGroup } from "@/Features/Threads/DomainModel/ThreadGroupTypes";

export interface ThreadListPaneAgentDescriptor {
  label: string;
  projectDirectories: string[];
}

export interface ThreadListPaneProperties {
  threadListState: "loading" | "empty" | "ready";
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
  onToggleThreadProjectGroup: (groupKey: string, nextCollapsed: boolean) => void;
  onCreateThreadForSingleAgent: (projectPath: string) => void;
  onCreateNewThread: (projectPath: string, agentId: AgentId) => void;
  onSelectThread: (threadId: string) => void;
  onArchiveThread: (threadId: string) => void;
  isArchivedThreadsOpen: boolean;
  onToggleArchivedThreads: (nextOpen: boolean) => void;
  isArchivedThreadsLoading: boolean;
  hasLoadedArchivedThreads: boolean;
  archivedSectionThreadCount: number;
  archivedThreadsTruncated: boolean;
  archivedProjectGroups: ThreadProjectGroup[];
  collapsedArchivedProjectGroups: Record<string, boolean>;
  archivedThreadIds: Set<string>;
  onToggleArchivedProjectGroup: (groupKey: string, nextCollapsed: boolean) => void;
  onUnarchiveThread: (threadId: string) => void;
  formatDate: (value: number | string | null | undefined) => string;
  renderAgentFavicon: (agentId: AgentId, label: string, className: string) => React.ReactNode;
}
