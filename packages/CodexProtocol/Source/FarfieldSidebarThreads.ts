import { z } from "zod";
import { NullableStringSchema } from "./Common.js";
import { FarfieldThreadListResponseSchema } from "./Contracts/Thread/FarfieldThreadListContracts.js";

const ThreadListSortKeySchema = z.enum(["created_at", "updated_at"]);
const SIDEBAR_THREAD_SYNC_LIMIT_MAXIMUM = 200;
const SIDEBAR_THREAD_SYNC_MAX_PAGES_MAXIMUM = 40;

export const FarfieldSidebarThreadSyncRequestSchema = z
  .object({
    archived: z.boolean(),
    limit: z.number().int().positive().max(SIDEBAR_THREAD_SYNC_LIMIT_MAXIMUM),
    maxPages: z.number().int().positive().max(SIDEBAR_THREAD_SYNC_MAX_PAGES_MAXIMUM),
    sortKey: ThreadListSortKeySchema,
    cwd: NullableStringSchema.optional().default(null),
    knownSnapshotVersion: z.string().min(1).nullable(),
  })
  .strict();

export type FarfieldSidebarThreadSyncRequest = z.infer<
  typeof FarfieldSidebarThreadSyncRequestSchema
>;

export const FarfieldSidebarThreadSyncNotModifiedResponseSchema = z
  .object({
    ok: z.literal(true),
    syncStatus: z.literal("notModified"),
    snapshotUpdatedAt: z.number().int().nonnegative(),
    snapshotVersion: z.string().min(1),
  })
  .strict();

export const FarfieldSidebarThreadSyncSnapshotResponseSchema = z
  .object({
    ok: z.literal(true),
    syncStatus: z.literal("snapshot"),
    snapshotUpdatedAt: z.number().int().nonnegative(),
    snapshotVersion: z.string().min(1),
    threadList: FarfieldThreadListResponseSchema,
  })
  .strict();

export const FarfieldSidebarThreadSyncResponseSchema = z.discriminatedUnion("syncStatus", [
  FarfieldSidebarThreadSyncNotModifiedResponseSchema,
  FarfieldSidebarThreadSyncSnapshotResponseSchema,
]);

export type FarfieldSidebarThreadSyncResponse = z.infer<
  typeof FarfieldSidebarThreadSyncResponseSchema
>;
