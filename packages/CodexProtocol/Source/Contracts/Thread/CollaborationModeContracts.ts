import { z } from "zod";
import { NonEmptyStringSchema, NullableStringSchema } from "../../Common.js";

export const CollaborationModeSettingsSchema = z
  .object({
    model: NullableStringSchema.optional(),
    reasoning_effort: NullableStringSchema.optional(),
    developer_instructions: NullableStringSchema.optional(),
  })
  .strict();

export const CollaborationModeSchema = z
  .object({
    mode: NonEmptyStringSchema,
    settings: CollaborationModeSettingsSchema,
  })
  .strict();

export type CollaborationModeSettings = z.infer<typeof CollaborationModeSettingsSchema>;
export type CollaborationMode = z.infer<typeof CollaborationModeSchema>;
