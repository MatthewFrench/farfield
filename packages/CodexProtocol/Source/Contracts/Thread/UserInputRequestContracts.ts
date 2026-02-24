import { z } from "zod";
import {
  NonEmptyStringSchema,
  NonNegativeIntSchema
} from "../../Common.js";
import { ToolRequestUserInputResponseSchema } from "../../Generated/app-server/index.js";

export const UserInputOptionSchema = z
  .object({
    label: z.string(),
    description: z.string()
  })
  .passthrough();

export const UserInputQuestionSchema = z
  .object({
    id: NonEmptyStringSchema,
    header: z.string(),
    question: z.string(),
    isOther: z.boolean(),
    isSecret: z.boolean(),
    options: z.array(UserInputOptionSchema)
  })
  .passthrough();

export const UserInputRequestParamsSchema = z
  .object({
    threadId: NonEmptyStringSchema,
    turnId: NonEmptyStringSchema,
    itemId: NonEmptyStringSchema,
    questions: z.array(UserInputQuestionSchema)
  })
  .passthrough();

export const UserInputRequestSchema = z
  .object({
    method: z.literal("item/tool/requestUserInput"),
    id: NonNegativeIntSchema,
    params: UserInputRequestParamsSchema,
    completed: z.boolean().optional()
  })
  .passthrough();

export const UserInputAnswerSchema = z
  .object({
    answers: z.array(z.string())
  })
  .passthrough();

export const UserInputResponsePayloadSchema = ToolRequestUserInputResponseSchema.passthrough();

export type UserInputRequest = z.infer<typeof UserInputRequestSchema>;
export type UserInputResponsePayload = z.infer<typeof UserInputResponsePayloadSchema>;
