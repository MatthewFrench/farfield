import { z } from "zod";
import { JsonValueSchema } from "../../Common.js";

/**
 * Owns structured thread-input and user-message content-part contracts shared by
 * live stream snapshots and turn-start params so protocol variants stay aligned.
 */
export const StructuredInputTextPartSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
    text_elements: z.array(JsonValueSchema).optional(),
  })
  .passthrough();

export const StructuredInputImagePartSchema = z
  .object({
    type: z.literal("image"),
    url: z.string(),
  })
  .passthrough();

export const StructuredInputLocalImagePartSchema = z
  .object({
    type: z.literal("localImage"),
    path: z.string(),
  })
  .passthrough();

export const StructuredInputSkillPartSchema = z
  .object({
    type: z.literal("skill"),
    name: z.string(),
    path: z.string(),
  })
  .passthrough();

export const StructuredInputMentionPartSchema = z
  .object({
    type: z.literal("mention"),
    name: z.string(),
    path: z.string(),
  })
  .passthrough();

export const StructuredInputPartSchema = z.union([
  StructuredInputTextPartSchema,
  StructuredInputImagePartSchema,
  StructuredInputLocalImagePartSchema,
  StructuredInputSkillPartSchema,
  StructuredInputMentionPartSchema,
]);

export type StructuredInputPart = z.infer<typeof StructuredInputPartSchema>;
