import type { AgentId } from "@/Shared/Contracts/ApiContracts";

export interface ThreadListItem {
  id: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
  cwd?: string | undefined;
  path?: string | null | undefined;
  agentId: AgentId;
  source?: string | undefined;
  removed?: boolean | undefined;
  projectRemoved?: boolean | undefined;
  projectState?: "active" | "removed" | undefined;
  isProjectRemoved?: boolean | undefined;
  hasUnreadTurn?: boolean | null | undefined;
}

export interface ThreadListResponse {
  data: ThreadListItem[];
  nextCursor: string | null;
  pages?: number | undefined;
  truncated?: boolean | undefined;
}

export interface ThreadProjectGroup {
  key: string;
  label: string;
  projectPath: string | null;
  projectCreatedAt: number;
  latestUpdatedAt: number;
  threads: ThreadListItem[];
  isRemoved: boolean;
}

export type ThreadListSortKey = "created_at" | "updated_at";

export interface ThreadListLoadOptions {
  limit: number;
  maxPages: number;
  archived: boolean;
  sortKey: ThreadListSortKey;
  cwd?: string;
  signal?: AbortSignal;
  actionId?: string;
  actionName?: string;
}
