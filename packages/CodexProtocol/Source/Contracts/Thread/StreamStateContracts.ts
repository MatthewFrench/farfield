import { z } from "zod";
import {
  JsonValueSchema,
  NonEmptyStringSchema,
  NonNegativeIntSchema
} from "../../Common.js";
import { ThreadConversationStateSchema } from "./ConversationStateContracts.js";

export const ThreadStreamPatchPathSegmentSchema = z.union([
  NonNegativeIntSchema,
  NonEmptyStringSchema
]);

const ThreadStreamPatchBaseSchema = z
  .object({
    path: z.array(ThreadStreamPatchPathSegmentSchema).min(1)
  })
  .passthrough();

const ThreadStreamAddPatchSchema = ThreadStreamPatchBaseSchema.extend({
  op: z.literal("add"),
  value: JsonValueSchema
});

const ThreadStreamReplacePatchSchema = ThreadStreamPatchBaseSchema.extend({
  op: z.literal("replace"),
  value: JsonValueSchema
});

const ThreadStreamRemovePatchSchema = ThreadStreamPatchBaseSchema.extend({
  op: z.literal("remove"),
  // Remove patches target existing state and must not include payloads.
  value: z.never().optional()
});

export const ThreadStreamPatchSchema: z.ZodDiscriminatedUnion<
  "op",
  [
    typeof ThreadStreamAddPatchSchema,
    typeof ThreadStreamReplacePatchSchema,
    typeof ThreadStreamRemovePatchSchema
  ]
> = z.discriminatedUnion("op", [
  ThreadStreamAddPatchSchema,
  ThreadStreamReplacePatchSchema,
  ThreadStreamRemovePatchSchema
]);

export const ThreadStreamSnapshotChangeSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"snapshot">;
    conversationState: typeof ThreadConversationStateSchema;
  },
  "passthrough"
> = z
  .object({
    type: z.literal("snapshot"),
    conversationState: ThreadConversationStateSchema
  })
  .passthrough();

export const ThreadStreamPatchesChangeSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"patches">;
    patches: z.ZodArray<typeof ThreadStreamPatchSchema>;
  },
  "passthrough"
> = z
  .object({
    type: z.literal("patches"),
    patches: z.array(ThreadStreamPatchSchema)
  })
  .passthrough();

export const ThreadStreamChangeSchema: z.ZodDiscriminatedUnion<
  "type",
  [typeof ThreadStreamSnapshotChangeSchema, typeof ThreadStreamPatchesChangeSchema]
> = z.discriminatedUnion("type", [
  ThreadStreamSnapshotChangeSchema,
  ThreadStreamPatchesChangeSchema
]);

export const ThreadStreamStateChangedEventType = "thread-stream-state-changed";

export const ThreadStreamStateChangedParamsSchema: z.ZodObject<
  {
    conversationId: typeof NonEmptyStringSchema;
    change: typeof ThreadStreamChangeSchema;
    version: typeof NonNegativeIntSchema;
    type: z.ZodLiteral<typeof ThreadStreamStateChangedEventType>;
  },
  "passthrough"
> = z
  .object({
    conversationId: NonEmptyStringSchema,
    change: ThreadStreamChangeSchema,
    version: NonNegativeIntSchema,
    type: z.literal(ThreadStreamStateChangedEventType)
  })
  .passthrough();

export type ThreadStreamPatch = z.infer<typeof ThreadStreamPatchSchema>;
export type ThreadStreamStateChangedParams = z.infer<typeof ThreadStreamStateChangedParamsSchema>;
