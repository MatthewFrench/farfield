import { z } from "zod";
import {
  JsonValueSchema,
  NonEmptyStringSchema,
  NonNegativeIntSchema,
  NullableNonEmptyStringSchema,
  NullableStringSchema,
} from "../../Common.js";
import { CollaborationModeSchema } from "./CollaborationModeContracts.js";
import { TurnStartParamsSchema } from "./TurnInputContracts.js";
import { TurnItemSchema } from "./TurnItemContracts.js";
import { UserInputRequestSchema } from "./UserInputRequestContracts.js";

const OptionalNullableTurnIdentifierSchema = NullableNonEmptyStringSchema.optional();
const OptionalNullableJsonValueSchema = z.union([JsonValueSchema, z.null()]).optional();
const OptionalNullableCollaborationModeSchema = z
  .union([CollaborationModeSchema, z.null()])
  .optional();

export const ThreadTurnSchema = z
  .object({
    params: TurnStartParamsSchema.optional(),
    turnId: OptionalNullableTurnIdentifierSchema,
    id: NonEmptyStringSchema.optional(),
    status: NonEmptyStringSchema,
    turnStartedAtMs: z.union([NonNegativeIntSchema, z.null()]).optional(),
    finalAssistantStartedAtMs: z.union([NonNegativeIntSchema, z.null()]).optional(),
    error: OptionalNullableJsonValueSchema,
    diff: OptionalNullableJsonValueSchema,
    items: z.array(TurnItemSchema),
  })
  .passthrough();

export const ThreadConversationStateSchema = z
  .object({
    id: NonEmptyStringSchema,
    turns: z.array(ThreadTurnSchema),
    requests: z.array(UserInputRequestSchema).default([]),
    createdAt: NonNegativeIntSchema.optional(),
    updatedAt: NonNegativeIntSchema.optional(),
    title: NullableStringSchema.optional(),
    latestModel: NullableStringSchema.optional(),
    latestReasoningEffort: NullableStringSchema.optional(),
    previousTurnModel: NullableStringSchema.optional(),
    latestCollaborationMode: OptionalNullableCollaborationModeSchema,
    hasUnreadTurn: z.boolean().optional(),
    rolloutPath: z.string().optional(),
    cwd: z.string().optional(),
    gitInfo: OptionalNullableJsonValueSchema,
    resumeState: z.string().optional(),
    latestTokenUsageInfo: JsonValueSchema.optional(),
    source: z.string().optional(),
  })
  .passthrough();

export type ThreadConversationState = z.infer<typeof ThreadConversationStateSchema>;
