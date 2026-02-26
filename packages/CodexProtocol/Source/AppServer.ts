import { z } from "zod";
import {
  JsonValueSchema,
  NonEmptyStringSchema,
  NullableStringSchema
} from "./Common.js";
import { CollaborationModeSchema } from "./Contracts/Thread/CollaborationModeContracts.js";
import { ThreadConversationStateSchema } from "./Contracts/Thread/ConversationStateContracts.js";
import { parseSchemaOrThrow } from "./ProtocolSchemaParsers.js";
import {
  CollaborationModeListResponseSchema as GeneratedCollaborationModeListResponseSchema,
  ModelListResponseSchema as GeneratedModelListResponseSchema,
  SendUserMessageParamsSchema as GeneratedSendUserMessageParamsSchema,
  SendUserMessageResponseSchema as GeneratedSendUserMessageResponseSchema,
  ThreadListResponseSchema as GeneratedThreadListResponseSchema,
  ThreadReadResponseSchema as GeneratedThreadReadResponseSchema,
  ThreadStartParamsSchema as GeneratedThreadStartParamsSchema
} from "./Generated/app-server/index.js";

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

export const AppServerReasoningEffortSchema = z.enum([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh"
]);

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
    sandbox: JsonValueSchema.optional(),
    reasoningEffort: z.union([z.string(), z.null()]).optional()
  })
  .passthrough();

export const AppServerSendUserMessageRequestSchema = AppServerSendUserMessageRequestBaseSchema;

export const AppServerSendUserMessageResponseSchema = AppServerSendUserMessageResponseBaseSchema;

const NullableAppServerReasoningEffortSchema = z.union([AppServerReasoningEffortSchema, z.null()]);

export const AppServerConfigProfileSchema = z
  .object({
    model: z.union([z.string(), z.null()]).optional().default(null),
    model_reasoning_effort: NullableAppServerReasoningEffortSchema.optional().default(null)
  })
  .passthrough();

export const AppServerConfigReadConfigSchema = z
  .object({
    profile: z.union([z.string(), z.null()]).optional().default(null),
    model: z.union([z.string(), z.null()]).optional().default(null),
    model_reasoning_effort: NullableAppServerReasoningEffortSchema.optional().default(null),
    profiles: z.record(AppServerConfigProfileSchema).optional().default({})
  })
  .passthrough();

export const AppServerConfigReadResponseSchema = z
  .object({
    config: AppServerConfigReadConfigSchema
  })
  .passthrough();

export const AppServerSetModeRequestSchema = z
  .object({
    conversationId: z.string().min(1),
    collaborationMode: CollaborationModeSchema
  })
  .passthrough();

export const DebugErrorOriginSchema = z.enum(["client", "server"]);
export const DebugErrorSeveritySchema = z.enum(["error", "warning"]);

export const CreateDebugClientErrorBodySchema = z
  .object({
    source: NonEmptyStringSchema,
    operation: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
    severity: DebugErrorSeveritySchema.optional().default("error"),
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
    severity: DebugErrorSeveritySchema.optional().default("error"),
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

export const DebugErrorClearResponseSchema = z
  .object({
    clearedCount: z.number().int().nonnegative(),
    sessionId: NonEmptyStringSchema,
    sessionLogPath: NonEmptyStringSchema
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
export type AppServerConfigReadResponse = z.infer<typeof AppServerConfigReadResponseSchema>;
export type CreateDebugClientErrorBody = z.infer<typeof CreateDebugClientErrorBodySchema>;
export type DebugErrorSeverity = z.infer<typeof DebugErrorSeveritySchema>;
export type DebugErrorEvent = z.infer<typeof DebugErrorEventSchema>;
export type DebugErrorCreateResponse = z.infer<typeof DebugErrorCreateResponseSchema>;
export type DebugErrorClearResponse = z.infer<typeof DebugErrorClearResponseSchema>;
export type DebugErrorListResponse = z.infer<typeof DebugErrorListResponseSchema>;
export type DebugErrorDetailResponse = z.infer<typeof DebugErrorDetailResponseSchema>;
const ParseContext = {
  listThreadsResponse: "AppServerListThreadsResponse",
  readThreadGeneratedResponse: "GeneratedAppServerReadThreadResponse",
  readThreadConversationState: "AppServerReadThreadResponse.thread",
  listModelsResponse: "AppServerListModelsResponse",
  collaborationModeListResponse: "AppServerCollaborationModeListResponse",
  startThreadResponse: "AppServerStartThreadResponse",
  configReadResponse: "AppServerConfigReadResponse",
  createDebugClientErrorBody: "CreateDebugClientErrorBody",
  debugErrorEvent: "DebugErrorEvent",
  debugErrorCreateResponse: "DebugErrorCreateResponse",
  debugErrorClearResponse: "DebugErrorClearResponse",
  debugErrorListResponse: "DebugErrorListResponse",
  debugErrorDetailResponse: "DebugErrorDetailResponse"
} as const;

export function parseAppServerListThreadsResponse(
  value: z.input<typeof AppServerListThreadsResponseSchema>
): AppServerListThreadsResponse {
  return parseSchemaOrThrow(
    AppServerListThreadsResponseSchema,
    value,
    ParseContext.listThreadsResponse
  );
}

export function parseAppServerReadThreadResponse(
  value: z.input<typeof AppServerThreadReadResponseBaseSchema>
): AppServerReadThreadResponse {
  const parsed = parseSchemaOrThrow(
    AppServerThreadReadResponseBaseSchema,
    value,
    ParseContext.readThreadGeneratedResponse
  );

  return {
    thread: parseSchemaOrThrow(
      ThreadConversationStateSchema,
      parsed.thread,
      ParseContext.readThreadConversationState
    )
  };
}

export function parseAppServerListModelsResponse(
  value: z.input<typeof AppServerListModelsResponseSchema>
): AppServerListModelsResponse {
  return parseSchemaOrThrow(
    AppServerListModelsResponseSchema,
    value,
    ParseContext.listModelsResponse
  );
}

export function parseAppServerCollaborationModeListResponse(
  value: z.input<typeof AppServerCollaborationModeListResponseSchema>
): AppServerCollaborationModeListResponse {
  return parseSchemaOrThrow(
    AppServerCollaborationModeListResponseSchema,
    value,
    ParseContext.collaborationModeListResponse
  );
}

export function parseAppServerStartThreadResponse(
  value: z.input<typeof AppServerStartThreadResponseSchema>
): AppServerStartThreadResponse {
  return parseSchemaOrThrow(
    AppServerStartThreadResponseSchema,
    value,
    ParseContext.startThreadResponse
  );
}

export function parseAppServerConfigReadResponse(
  value: z.input<typeof AppServerConfigReadResponseSchema>
): AppServerConfigReadResponse {
  return parseSchemaOrThrow(
    AppServerConfigReadResponseSchema,
    value,
    ParseContext.configReadResponse
  );
}

export function parseCreateDebugClientErrorBody(
  value: z.input<typeof CreateDebugClientErrorBodySchema>
): CreateDebugClientErrorBody {
  return parseSchemaOrThrow(
    CreateDebugClientErrorBodySchema,
    value,
    ParseContext.createDebugClientErrorBody
  );
}

export function parseDebugErrorEvent(value: z.input<typeof DebugErrorEventSchema>): DebugErrorEvent {
  return parseSchemaOrThrow(DebugErrorEventSchema, value, ParseContext.debugErrorEvent);
}

export function parseDebugErrorCreateResponse(
  value: z.input<typeof DebugErrorCreateResponseSchema>
): DebugErrorCreateResponse {
  return parseSchemaOrThrow(
    DebugErrorCreateResponseSchema,
    value,
    ParseContext.debugErrorCreateResponse
  );
}

export function parseDebugErrorClearResponse(
  value: z.input<typeof DebugErrorClearResponseSchema>
): DebugErrorClearResponse {
  return parseSchemaOrThrow(
    DebugErrorClearResponseSchema,
    value,
    ParseContext.debugErrorClearResponse
  );
}

export function parseDebugErrorListResponse(
  value: z.input<typeof DebugErrorListResponseSchema>
): DebugErrorListResponse {
  return parseSchemaOrThrow(
    DebugErrorListResponseSchema,
    value,
    ParseContext.debugErrorListResponse
  );
}

export function parseDebugErrorDetailResponse(
  value: z.input<typeof DebugErrorDetailResponseSchema>
): DebugErrorDetailResponse {
  return parseSchemaOrThrow(
    DebugErrorDetailResponseSchema,
    value,
    ParseContext.debugErrorDetailResponse
  );
}
