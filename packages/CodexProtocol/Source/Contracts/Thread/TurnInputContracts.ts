import { z } from "zod";
import {
  JsonValueSchema,
  NonEmptyStringSchema,
  NullableStringSchema
} from "../../Common.js";
import { CollaborationModeSchema } from "./CollaborationModeContracts.js";

export const InputTextPartSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
    text_elements: z.array(JsonValueSchema).optional()
  })
  .passthrough();

export const InputImagePartSchema = z
  .object({
    type: z.literal("image"),
    url: z.string()
  })
  .passthrough();

export const InputPartSchema = z.union([InputTextPartSchema, InputImagePartSchema]);

export const TurnStartParamsSchema = z
  .object({
    threadId: NonEmptyStringSchema,
    input: z.array(InputPartSchema),
    cwd: NonEmptyStringSchema.optional(),
    model: NullableStringSchema.optional(),
    effort: NullableStringSchema.optional(),
    approvalPolicy: NonEmptyStringSchema.optional(),
    sandboxPolicy: z.object({ type: NonEmptyStringSchema }).passthrough().optional(),
    summary: z.string().optional(),
    attachments: z.array(JsonValueSchema).optional(),
    collaborationMode: z.union([CollaborationModeSchema, z.null()]).optional(),
    personality: z.union([JsonValueSchema, z.null()]).optional(),
    outputSchema: z.union([JsonValueSchema, z.null()]).optional()
  })
  .passthrough();

export type TurnStartParams = z.infer<typeof TurnStartParamsSchema>;
