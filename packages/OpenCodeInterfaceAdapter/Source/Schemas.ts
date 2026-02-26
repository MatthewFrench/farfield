import { z } from "zod";

/**
 * Owns OpenCode transport-boundary payload schemas and parsing entrypoints.
 * External payloads are validated once here, then consumed as typed adapter models.
 */
export type OpenCodeStructuredDataPrimitive = string | number | boolean | null;
export type OpenCodeStructuredDataObject = {
  [key: string]: OpenCodeStructuredDataValue | undefined;
};
export type OpenCodeStructuredDataArray = OpenCodeStructuredDataValue[];
export type OpenCodeStructuredDataValue =
  | OpenCodeStructuredDataPrimitive
  | OpenCodeStructuredDataObject
  | OpenCodeStructuredDataArray;

const OpenCodeNonEmptyStringSchema = z.string().min(1);
const OpenCodeOptionalStringSchema = z.string().optional();
const OpenCodeNonNegativeIntegerSchema = z.number().int().nonnegative();
const OpenCodeMessageRoleValues = ["user", "assistant"] as const;
const OpenCodeTextPartType = "text";
const OpenCodeReasoningPartType = "reasoning";
const OpenCodeToolPartType = "tool";
const OpenCodeFilePartType = "file";
const OpenCodeToolRunningStatus = "running";
const OpenCodeToolCompletedStatus = "completed";
const OpenCodeToolErrorStatus = "error";
const OpenCodeToolStatusDiscriminatorKey = "status";
const OpenCodePartDiscriminatorKey = "type";
const OpenCodeIgnoredPartTypeValues = [
  "step-start",
  "step-finish",
  "snapshot",
  "patch",
  "agent",
  "retry",
  "compaction",
  "subtask"
] as const;

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
const OpenCodeStructuredDataRecordSchema = z.record(OpenCodeStructuredDataValueSchema);
const OpenCodeTimeCreatedSchema = z
  .object({
    created: OpenCodeNonNegativeIntegerSchema
  })
  .passthrough();
const OpenCodeToolStartTimeSchema = z
  .object({
    start: OpenCodeNonNegativeIntegerSchema
  })
  .passthrough();
const OpenCodeToolCompletedTimeSchema = z
  .object({
    start: OpenCodeNonNegativeIntegerSchema,
    end: OpenCodeNonNegativeIntegerSchema
  })
  .passthrough();

export const OpenCodeSessionSchema = z
  .object({
    id: OpenCodeNonEmptyStringSchema,
    title: z.string().default(""),
    directory: OpenCodeNonEmptyStringSchema,
    time: z
      .object({
        created: OpenCodeNonNegativeIntegerSchema,
        updated: OpenCodeNonNegativeIntegerSchema
      })
      .strict()
  })
  .passthrough();

export type OpenCodeSession = z.infer<typeof OpenCodeSessionSchema>;

export const OpenCodeProjectSchema = z
  .object({
    worktree: OpenCodeNonEmptyStringSchema
  })
  .passthrough();

export type OpenCodeProject = z.infer<typeof OpenCodeProjectSchema>;

const OpenCodeMessageRoleSchema = z.enum(OpenCodeMessageRoleValues);

export const OpenCodeMessageSchema = z
  .object({
    id: OpenCodeNonEmptyStringSchema,
    role: OpenCodeMessageRoleSchema,
    parentID: OpenCodeNonEmptyStringSchema,
    time: OpenCodeTimeCreatedSchema,
    providerID: OpenCodeOptionalStringSchema,
    modelID: OpenCodeOptionalStringSchema,
    finish: OpenCodeOptionalStringSchema,
    error: OpenCodeStructuredDataValueSchema.optional()
  })
  .passthrough();

export type OpenCodeMessage = z.infer<typeof OpenCodeMessageSchema>;

const OpenCodeToolStateSchema = z
  .discriminatedUnion(OpenCodeToolStatusDiscriminatorKey, [
    z
      .object({
        status: z.literal(OpenCodeToolRunningStatus),
        input: OpenCodeStructuredDataRecordSchema,
        time: OpenCodeToolStartTimeSchema
      })
      .passthrough(),
    z
      .object({
        status: z.literal(OpenCodeToolCompletedStatus),
        input: OpenCodeStructuredDataRecordSchema,
        output: z.string(),
        metadata: OpenCodeStructuredDataRecordSchema.optional(),
        time: OpenCodeToolCompletedTimeSchema
      })
      .passthrough(),
    z
      .object({
        status: z.literal(OpenCodeToolErrorStatus),
        input: OpenCodeStructuredDataRecordSchema,
        error: z.string(),
        metadata: OpenCodeStructuredDataRecordSchema.optional(),
        time: OpenCodeToolCompletedTimeSchema
      })
      .passthrough()
  ]);

export type OpenCodeToolState = z.infer<typeof OpenCodeToolStateSchema>;

export const OpenCodeTextPartSchema = z
  .object({
    id: OpenCodeNonEmptyStringSchema,
    type: z.literal(OpenCodeTextPartType),
    text: z.string(),
    synthetic: z.boolean().optional(),
    ignored: z.boolean().optional(),
    sessionID: OpenCodeOptionalStringSchema
  })
  .passthrough();

export const OpenCodeReasoningPartSchema = z
  .object({
    id: OpenCodeNonEmptyStringSchema,
    type: z.literal(OpenCodeReasoningPartType),
    text: z.string(),
    sessionID: OpenCodeOptionalStringSchema
  })
  .passthrough();

export const OpenCodeToolPartSchema = z
  .object({
    id: OpenCodeNonEmptyStringSchema,
    type: z.literal(OpenCodeToolPartType),
    tool: OpenCodeNonEmptyStringSchema,
    state: OpenCodeToolStateSchema,
    sessionID: OpenCodeOptionalStringSchema
  })
  .passthrough();

export const OpenCodeFilePartSchema = z
  .object({
    id: OpenCodeNonEmptyStringSchema,
    type: z.literal(OpenCodeFilePartType),
    url: OpenCodeNonEmptyStringSchema,
    sessionID: OpenCodeOptionalStringSchema
  })
  .passthrough();

export const OpenCodeIgnoredPartSchema = z
  .object({
    id: OpenCodeNonEmptyStringSchema,
    type: z.enum(OpenCodeIgnoredPartTypeValues),
    sessionID: OpenCodeOptionalStringSchema
  })
  .passthrough();

export const OpenCodePartSchema = z.discriminatedUnion(OpenCodePartDiscriminatorKey, [
  OpenCodeTextPartSchema,
  OpenCodeReasoningPartSchema,
  OpenCodeToolPartSchema,
  OpenCodeFilePartSchema,
  OpenCodeIgnoredPartSchema
]);

export type OpenCodeTextPart = z.infer<typeof OpenCodeTextPartSchema>;
export type OpenCodeReasoningPart = z.infer<typeof OpenCodeReasoningPartSchema>;
export type OpenCodeToolPart = z.infer<typeof OpenCodeToolPartSchema>;
export type OpenCodeFilePart = z.infer<typeof OpenCodeFilePartSchema>;
export type OpenCodeIgnoredPart = z.infer<typeof OpenCodeIgnoredPartSchema>;
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
