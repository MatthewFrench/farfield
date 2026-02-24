import { z } from "zod";
import {
  NonEmptyStringSchema,
  NullableStringSchema
} from "../../Common.js";

export const CollaborationModeSettingsSchema = z
  .object({
    model: NullableStringSchema.optional(),
    reasoning_effort: NullableStringSchema.optional(),
    developer_instructions: z.union([z.string(), z.null()]).optional()
  })
  .passthrough();

export const CollaborationModeSchema = z
  .object({
    mode: NonEmptyStringSchema,
    settings: CollaborationModeSettingsSchema
  })
  .passthrough();

export type CollaborationMode = z.infer<typeof CollaborationModeSchema>;
