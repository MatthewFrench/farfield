import { z } from "zod";

const FarfieldThreadListAgentIdentifierValues = ["codex", "opencode"] as const;

/**
 * Owns the Farfield thread-list contract consumed by the sidebar/thread-list feature.
 * This surface is intentionally slimmer than upstream app-server thread list payloads and
 * excludes full turn payloads and transport-only metadata.
 */
export const FarfieldThreadListAgentIdentifierSchema = z.enum(
  FarfieldThreadListAgentIdentifierValues,
);

export const FarfieldThreadListItemSchema = z
  .object({
    id: z.string().min(1),
    preview: z.string(),
    displayName: z.string().optional(),
    lastUserMessage: z.string().optional(),
    latestActivityIsUserMessage: z.boolean().optional(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    cwd: z.string().optional(),
    path: z.string().nullable().optional(),
    agentId: FarfieldThreadListAgentIdentifierSchema,
    isProjectRemoved: z.boolean().optional().default(false),
    hasUnreadTurn: z
      .union([z.boolean(), z.null(), z.undefined()])
      .transform((value) => value ?? null),
    isLoadedInMemory: z.boolean().optional(),
  })
  .strict();

export type FarfieldThreadListItem = z.infer<typeof FarfieldThreadListItemSchema>;

export const FarfieldThreadListSyncMetadataSchema = z
  .object({
    mode: z.enum(["full", "delta"]),
    sinceUpdatedAt: z.number().int().nonnegative().nullable(),
    snapshotUpdatedAt: z.number().int().nonnegative(),
    snapshotVersion: z.string().min(1),
  })
  .strict();

export type FarfieldThreadListSyncMetadata = z.infer<typeof FarfieldThreadListSyncMetadataSchema>;

export const FarfieldThreadListResponseSchema = z
  .object({
    data: z.array(FarfieldThreadListItemSchema),
    nextCursor: z.union([z.string(), z.null(), z.undefined()]).transform((value) => value ?? null),
    pages: z.number().int().nonnegative().optional(),
    truncated: z.boolean().optional(),
    orderedThreadIds: z.array(z.string().min(1)).optional(),
    sync: FarfieldThreadListSyncMetadataSchema.optional(),
  })
  .strict();

export type FarfieldThreadListResponse = z.infer<typeof FarfieldThreadListResponseSchema>;
