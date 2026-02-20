import { z } from "zod";
import {
  JsonValueSchema,
  NonEmptyStringSchema,
  NullableStringSchema
} from "./common.js";
import { ProtocolValidationError } from "./errors.js";
import { CollaborationModeSchema, ThreadConversationStateSchema } from "./thread.js";
import {
  CollaborationModeListResponseSchema as GeneratedCollaborationModeListResponseSchema,
  ModelListResponseSchema as GeneratedModelListResponseSchema,
  SendUserMessageParamsSchema as GeneratedSendUserMessageParamsSchema,
  SendUserMessageResponseSchema as GeneratedSendUserMessageResponseSchema,
  ThreadListResponseSchema as GeneratedThreadListResponseSchema,
  ThreadReadResponseSchema as GeneratedThreadReadResponseSchema,
  ThreadStartParamsSchema as GeneratedThreadStartParamsSchema
} from "./generated/app-server/index.js";

const AppServerThreadListResponseBaseSchema = GeneratedThreadListResponseSchema.passthrough();
const AppServerThreadReadResponseBaseSchema = GeneratedThreadReadResponseSchema.passthrough();
const AppServerModelListResponseBaseSchema = GeneratedModelListResponseSchema.passthrough();
const AppServerCollaborationModeListResponseBaseSchema =
  GeneratedCollaborationModeListResponseSchema.passthrough();
const AppServerStartThreadRequestBaseSchema = GeneratedThreadStartParamsSchema.passthrough();
const AppServerSendUserMessageRequestBaseSchema = GeneratedSendUserMessageParamsSchema.passthrough();
const AppServerSendUserMessageResponseBaseSchema = GeneratedSendUserMessageResponseSchema;

const AppServerGeneratedThreadListItemSchema = AppServerThreadListResponseBaseSchema.shape.data.element;

const OpenCodeThreadListItemSchema = z
  .object({
    id: z.string().min(1),
    preview: z.string(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    cwd: z.string().optional(),
    source: z.literal("opencode")
  })
  .passthrough();

export const AppServerThreadListItemSchema = z.union([
  AppServerGeneratedThreadListItemSchema,
  OpenCodeThreadListItemSchema
]);

export const AppServerListThreadsResponseSchema = z
  .object({
    data: z.array(AppServerThreadListItemSchema),
    nextCursor: z.union([z.string(), z.null()]).optional(),
    pages: z.number().int().nonnegative().optional(),
    truncated: z.boolean().optional()
  })
  .passthrough();

export const AppServerReadThreadResponseSchema: z.ZodObject<
  {
    thread: typeof ThreadConversationStateSchema;
  },
  "passthrough"
> = z
  .object({
    thread: ThreadConversationStateSchema
  })
  .passthrough();

export const AppServerModelSchema = AppServerModelListResponseBaseSchema.shape.data.element;

export const AppServerModelReasoningEffortSchema =
  AppServerModelSchema.shape.supportedReasoningEfforts.element;

export const AppServerListModelsResponseSchema = AppServerModelListResponseBaseSchema;

export const AppServerCollaborationModeListItemSchema =
  AppServerCollaborationModeListResponseBaseSchema.shape.data.element;

export const AppServerCollaborationModeListResponseSchema =
  AppServerCollaborationModeListResponseBaseSchema;

export const AppServerStartThreadRequestSchema = AppServerStartThreadRequestBaseSchema;

export const AppServerStartThreadResponseSchema = z
  .object({
    thread: AppServerThreadListItemSchema,
    model: z.string().optional(),
    modelProvider: z.string().optional(),
    cwd: z.string().optional(),
    approvalPolicy: z.string().optional(),
    sandbox: z.any().optional(),
    reasoningEffort: z.union([z.string(), z.null()]).optional()
  })
  .passthrough();

export const AppServerSendUserMessageRequestSchema = AppServerSendUserMessageRequestBaseSchema;

export const AppServerSendUserMessageResponseSchema = AppServerSendUserMessageResponseBaseSchema;

export const AppServerSetModeRequestSchema = z
  .object({
    conversationId: z.string().min(1),
    collaborationMode: CollaborationModeSchema
  })
  .passthrough();

export const DebugErrorOriginSchema = z.enum(["client", "server"]);

export const CreateDebugClientErrorBodySchema = z
  .object({
    source: NonEmptyStringSchema,
    operation: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
    name: NullableStringSchema.optional().default(null),
    stack: NullableStringSchema.optional().default(null),
    requestId: NullableStringSchema.optional().default(null),
    threadId: NullableStringSchema.optional().default(null),
    url: NullableStringSchema.optional().default(null),
    occurredAt: z.string().datetime().optional(),
    details: z.record(JsonValueSchema).optional().default({})
  })
  .strict();

export const DebugErrorEventSchema = z
  .object({
    errorId: NonEmptyStringSchema,
    sessionId: NonEmptyStringSchema,
    origin: DebugErrorOriginSchema,
    source: NonEmptyStringSchema,
    operation: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
    name: NullableStringSchema,
    stack: NullableStringSchema,
    requestId: NullableStringSchema,
    threadId: NullableStringSchema,
    url: NullableStringSchema,
    occurredAt: z.string().datetime(),
    recordedAt: z.string().datetime(),
    details: z.record(JsonValueSchema)
  })
  .strict();

export const DebugErrorCreateResponseSchema = z
  .object({
    errorId: NonEmptyStringSchema,
    sessionId: NonEmptyStringSchema,
    recordedAt: z.string().datetime()
  })
  .strict();

export const DebugErrorListResponseSchema = z
  .object({
    data: z.array(DebugErrorEventSchema),
    sessionId: NonEmptyStringSchema,
    sessionLogPath: NonEmptyStringSchema
  })
  .strict();

export const DebugErrorDetailResponseSchema = z
  .object({
    error: DebugErrorEventSchema,
    sessionId: NonEmptyStringSchema,
    sessionLogPath: NonEmptyStringSchema
  })
  .strict();

export type AppServerListThreadsResponse = z.infer<typeof AppServerListThreadsResponseSchema>;
export type AppServerReadThreadResponse = z.infer<typeof AppServerReadThreadResponseSchema>;
export type AppServerListModelsResponse = z.infer<typeof AppServerListModelsResponseSchema>;
export type AppServerCollaborationModeListResponse = z.infer<
  typeof AppServerCollaborationModeListResponseSchema
>;
export type AppServerStartThreadResponse = z.infer<typeof AppServerStartThreadResponseSchema>;
export type CreateDebugClientErrorBody = z.infer<typeof CreateDebugClientErrorBodySchema>;
export type DebugErrorEvent = z.infer<typeof DebugErrorEventSchema>;
export type DebugErrorCreateResponse = z.infer<typeof DebugErrorCreateResponseSchema>;
export type DebugErrorListResponse = z.infer<typeof DebugErrorListResponseSchema>;
export type DebugErrorDetailResponse = z.infer<typeof DebugErrorDetailResponseSchema>;

function parseWithSchema<Schema extends z.ZodTypeAny>(
  schema: Schema,
  value: z.input<Schema>,
  context: string
): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod(context, result.error);
  }
  return result.data;
}

export function parseAppServerListThreadsResponse(
  value: z.input<typeof AppServerListThreadsResponseSchema>
): AppServerListThreadsResponse {
  return parseWithSchema(AppServerListThreadsResponseSchema, value, "AppServerListThreadsResponse");
}

export function parseAppServerReadThreadResponse(
  value: z.input<typeof AppServerThreadReadResponseBaseSchema>
): AppServerReadThreadResponse {
  const parsed = parseWithSchema(
    AppServerThreadReadResponseBaseSchema,
    value,
    "GeneratedAppServerReadThreadResponse"
  );
  return {
    thread: parseWithSchema(
      ThreadConversationStateSchema,
      parsed.thread,
      "AppServerReadThreadResponse.thread"
    )
  };
}

export function parseAppServerListModelsResponse(
  value: z.input<typeof AppServerListModelsResponseSchema>
): AppServerListModelsResponse {
  return parseWithSchema(AppServerListModelsResponseSchema, value, "AppServerListModelsResponse");
}

export function parseAppServerCollaborationModeListResponse(
  value: z.input<typeof AppServerCollaborationModeListResponseSchema>
): AppServerCollaborationModeListResponse {
  return parseWithSchema(
    AppServerCollaborationModeListResponseSchema,
    value,
    "AppServerCollaborationModeListResponse"
  );
}

export function parseAppServerStartThreadResponse(
  value: z.input<typeof AppServerStartThreadResponseSchema>
): AppServerStartThreadResponse {
  return parseWithSchema(AppServerStartThreadResponseSchema, value, "AppServerStartThreadResponse");
}

export function parseCreateDebugClientErrorBody(
  value: z.input<typeof CreateDebugClientErrorBodySchema>
): CreateDebugClientErrorBody {
  return parseWithSchema(CreateDebugClientErrorBodySchema, value, "CreateDebugClientErrorBody");
}

export function parseDebugErrorEvent(value: z.input<typeof DebugErrorEventSchema>): DebugErrorEvent {
  return parseWithSchema(DebugErrorEventSchema, value, "DebugErrorEvent");
}

export function parseDebugErrorCreateResponse(
  value: z.input<typeof DebugErrorCreateResponseSchema>
): DebugErrorCreateResponse {
  return parseWithSchema(DebugErrorCreateResponseSchema, value, "DebugErrorCreateResponse");
}

export function parseDebugErrorListResponse(
  value: z.input<typeof DebugErrorListResponseSchema>
): DebugErrorListResponse {
  return parseWithSchema(DebugErrorListResponseSchema, value, "DebugErrorListResponse");
}

export function parseDebugErrorDetailResponse(
  value: z.input<typeof DebugErrorDetailResponseSchema>
): DebugErrorDetailResponse {
  return parseWithSchema(DebugErrorDetailResponseSchema, value, "DebugErrorDetailResponse");
}
