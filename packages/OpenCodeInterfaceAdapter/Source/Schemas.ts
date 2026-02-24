import { z } from "zod";

export type OpenCodeStructuredDataPrimitive = string | number | boolean | null;
export type OpenCodeStructuredDataObject = {
  [key: string]: OpenCodeStructuredDataValue | undefined;
};
export type OpenCodeStructuredDataArray = OpenCodeStructuredDataValue[];
export type OpenCodeStructuredDataValue =
  | OpenCodeStructuredDataPrimitive
  | OpenCodeStructuredDataObject
  | OpenCodeStructuredDataArray;

const OpenCodeStructuredDataPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null()
]);
export const OpenCodeStructuredDataValueSchema: z.ZodType<OpenCodeStructuredDataValue> =
  z.lazy(() =>
    z.union([
      OpenCodeStructuredDataPrimitiveSchema,
      z.array(OpenCodeStructuredDataValueSchema),
      z.record(OpenCodeStructuredDataValueSchema)
    ])
);

export const OpenCodeSessionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().default(""),
    directory: z.string().min(1),
    time: z
      .object({
        created: z.number().int().nonnegative(),
        updated: z.number().int().nonnegative()
      })
      .strict()
  })
  .passthrough();

export type OpenCodeSession = z.infer<typeof OpenCodeSessionSchema>;

export const OpenCodeProjectSchema = z
  .object({
    worktree: z.string().min(1)
  })
  .passthrough();

export type OpenCodeProject = z.infer<typeof OpenCodeProjectSchema>;

const OpenCodeMessageRoleSchema = z.enum(["user", "assistant"]);

export const OpenCodeMessageSchema = z
  .object({
    id: z.string().min(1),
    role: OpenCodeMessageRoleSchema,
    parentID: z.string().min(1),
    time: z
      .object({
        created: z.number().int().nonnegative()
      })
      .passthrough(),
    providerID: z.string().optional(),
    modelID: z.string().optional(),
    finish: z.string().optional(),
    error: OpenCodeStructuredDataValueSchema.optional()
  })
  .passthrough();

export type OpenCodeMessage = z.infer<typeof OpenCodeMessageSchema>;

const OpenCodeToolStateSchema = z
  .discriminatedUnion("status", [
    z
      .object({
        status: z.literal("running"),
        input: z.record(OpenCodeStructuredDataValueSchema),
        time: z
          .object({
            start: z.number().int().nonnegative()
          })
          .passthrough()
      })
      .passthrough(),
    z
      .object({
        status: z.literal("completed"),
        input: z.record(OpenCodeStructuredDataValueSchema),
        output: z.string(),
        metadata: z.record(OpenCodeStructuredDataValueSchema).optional(),
        time: z
          .object({
            start: z.number().int().nonnegative(),
            end: z.number().int().nonnegative()
          })
          .passthrough()
      })
      .passthrough(),
    z
      .object({
        status: z.literal("error"),
        input: z.record(OpenCodeStructuredDataValueSchema),
        error: z.string(),
        metadata: z.record(OpenCodeStructuredDataValueSchema).optional(),
        time: z
          .object({
            start: z.number().int().nonnegative(),
            end: z.number().int().nonnegative()
          })
          .passthrough()
      })
      .passthrough()
  ]);

const OpenCodeTextPartSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("text"),
    text: z.string(),
    synthetic: z.boolean().optional(),
    ignored: z.boolean().optional(),
    sessionID: z.string().optional()
  })
  .passthrough();

const OpenCodeReasoningPartSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("reasoning"),
    text: z.string(),
    sessionID: z.string().optional()
  })
  .passthrough();

const OpenCodeToolPartSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("tool"),
    tool: z.string().min(1),
    state: OpenCodeToolStateSchema,
    sessionID: z.string().optional()
  })
  .passthrough();

const OpenCodeFilePartSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("file"),
    url: z.string().min(1),
    sessionID: z.string().optional()
  })
  .passthrough();

const OpenCodeIgnoredPartSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum([
      "step-start",
      "step-finish",
      "snapshot",
      "patch",
      "agent",
      "retry",
      "compaction",
      "subtask"
    ]),
    sessionID: z.string().optional()
  })
  .passthrough();

export const OpenCodePartSchema = z.discriminatedUnion("type", [
  OpenCodeTextPartSchema,
  OpenCodeReasoningPartSchema,
  OpenCodeToolPartSchema,
  OpenCodeFilePartSchema,
  OpenCodeIgnoredPartSchema
]);

export type OpenCodePart = z.infer<typeof OpenCodePartSchema>;

const OpenCodeSessionMessageEntrySchema = z
  .object({
    info: OpenCodeMessageSchema,
    parts: z.array(OpenCodePartSchema)
  })
  .strict();

export type OpenCodeSessionMessageEntry = z.infer<typeof OpenCodeSessionMessageEntrySchema>;

const OpenCodeSessionListSchema = z.array(OpenCodeSessionSchema);
const OpenCodeProjectListSchema = z.array(OpenCodeProjectSchema);
const OpenCodeSessionMessageEntryListSchema = z.array(OpenCodeSessionMessageEntrySchema);

export function parseOpenCodeSessionList(
  value: OpenCodeStructuredDataValue
): OpenCodeSession[] {
  return OpenCodeSessionListSchema.parse(value);
}

export function parseOpenCodeProjectList(
  value: OpenCodeStructuredDataValue
): OpenCodeProject[] {
  return OpenCodeProjectListSchema.parse(value);
}

export function parseOpenCodeSession(value: OpenCodeStructuredDataValue): OpenCodeSession {
  return OpenCodeSessionSchema.parse(value);
}

export function parseOpenCodeSessionMessages(
  value: OpenCodeStructuredDataValue
): OpenCodeSessionMessageEntry[] {
  return OpenCodeSessionMessageEntryListSchema.parse(value);
}
