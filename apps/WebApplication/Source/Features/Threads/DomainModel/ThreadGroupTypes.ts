import { z } from "zod";
import { type AgentId, AgentIdSchema } from "@/Shared/Contracts/ApiContracts";

export interface ThreadListItem {
  id: string;
  preview: string;
  displayName?: string | undefined;
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
    displayName: z.string().optional(),
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

export const ThreadListSyncMetadataSchema = z
  .object({
    mode: z.enum(["full", "delta"]),
    sinceUpdatedAt: z.number().int().nonnegative().nullable(),
    snapshotUpdatedAt: z.number().int().nonnegative(),
  })
  .strict();
export type ThreadListSyncMetadata = z.infer<typeof ThreadListSyncMetadataSchema>;

export const ThreadListResponseSchema = z
  .object({
    data: z.array(ThreadListItemSchema),
    nextCursor: z.string().nullable(),
    pages: z.number().int().nonnegative().optional(),
    truncated: z.boolean().optional(),
    orderedThreadIds: z.array(z.string().min(1)).optional(),
    sync: ThreadListSyncMetadataSchema.optional(),
  })
  .strict();
export type ThreadListResponse = z.infer<typeof ThreadListResponseSchema>;

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
  sinceUpdatedAt?: number;
  cwd?: string;
  signal?: AbortSignal;
  actionId?: string;
  actionName?: string;
}
