import { z } from "zod";
import { type AgentId, AgentIdSchema } from "@/Shared/Contracts/ApiContracts";

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

export const ThreadListItemSchema = z
  .object({
    id: z.string().min(1),
    preview: z.string(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    cwd: z.string().optional(),
    path: z.string().nullable().optional(),
    agentId: AgentIdSchema,
    source: z.string().optional(),
    removed: z.boolean().optional(),
    projectRemoved: z.boolean().optional(),
    projectState: z.enum(["active", "removed"]).optional(),
    isProjectRemoved: z.boolean().optional(),
    hasUnreadTurn: z.boolean().nullable().optional(),
  })
  .strict();

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

export const ThreadProjectGroupSchema = z
  .object({
    key: z.string().min(1),
    label: z.string(),
    projectPath: z.string().nullable(),
    projectCreatedAt: z.number().int().nonnegative(),
    latestUpdatedAt: z.number().int().nonnegative(),
    threads: z.array(ThreadListItemSchema),
    isRemoved: z.boolean(),
  })
  .strict();

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
