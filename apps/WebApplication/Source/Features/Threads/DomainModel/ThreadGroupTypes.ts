import {
  FarfieldThreadListItemSchema,
  FarfieldThreadListResponseSchema,
  FarfieldThreadListSyncMetadataSchema,
} from "@farfield/protocol";
import { z } from "zod";

export const ThreadListItemSchema = FarfieldThreadListItemSchema;
export type ThreadListItem = z.infer<typeof ThreadListItemSchema>;

export const ThreadListSyncMetadataSchema = FarfieldThreadListSyncMetadataSchema;
export type ThreadListSyncMetadata = z.infer<typeof ThreadListSyncMetadataSchema>;

export const ThreadListResponseSchema = FarfieldThreadListResponseSchema;
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
