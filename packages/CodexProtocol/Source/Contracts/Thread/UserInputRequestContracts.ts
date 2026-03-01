import { z } from "zod";
import { JsonValueSchema, NonNegativeIntSchema } from "../../Common.js";
import {
  CommandExecutionRequestApprovalParamsSchema,
  CommandExecutionRequestApprovalResponseSchema,
  DynamicToolCallParamsSchema,
  DynamicToolCallResponseSchema,
  FileChangeRequestApprovalParamsSchema,
  FileChangeRequestApprovalResponseSchema,
  ToolRequestUserInputResponseSchema,
} from "../../Generated/app-server/index.js";

export const UserInputRequestMethod = "item/tool/requestUserInput";
export const CommandExecutionApprovalRequestMethod = "item/commandExecution/requestApproval";
export const FileChangeApprovalRequestMethod = "item/fileChange/requestApproval";
export const ToolCallRequestMethod = "item/tool/call";
export const ChatGptAuthTokensRefreshRequestMethod = "account/chatgptAuthTokens/refresh";
export const ApplyPatchApprovalRequestMethod = "applyPatchApproval";
export const ExecuteCommandApprovalRequestMethod = "execCommandApproval";

export const ThreadConversationRequestMethodValues = [
  CommandExecutionApprovalRequestMethod,
  FileChangeApprovalRequestMethod,
  UserInputRequestMethod,
  ToolCallRequestMethod,
  ChatGptAuthTokensRefreshRequestMethod,
  ApplyPatchApprovalRequestMethod,
  ExecuteCommandApprovalRequestMethod,
] as const;

const ServerRequestBaseSchema = z
  .object({
    id: NonNegativeIntSchema,
    completed: z.boolean().optional(),
  })
  .passthrough();

export const UserInputOptionSchema = z
  .object({
    label: z.string(),
    description: z.string(),
  })
  .passthrough();

export const UserInputQuestionSchema = z
  .object({
    id: z.string().min(1),
    header: z.string(),
    question: z.string(),
    isOther: z.boolean(),
    isSecret: z.boolean(),
    options: z.array(UserInputOptionSchema),
  })
  .passthrough();

export const UserInputRequestParamsSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    itemId: z.string().min(1),
    questions: z.array(UserInputQuestionSchema),
  })
  .passthrough();

export const UserInputRequestSchema = ServerRequestBaseSchema.extend({
  method: z.literal(UserInputRequestMethod),
  params: UserInputRequestParamsSchema,
}).passthrough();

const CommandExecutionApprovalRequestSchema = ServerRequestBaseSchema.extend({
  method: z.literal(CommandExecutionApprovalRequestMethod),
  params: CommandExecutionRequestApprovalParamsSchema.passthrough(),
}).passthrough();

const FileChangeApprovalRequestSchema = ServerRequestBaseSchema.extend({
  method: z.literal(FileChangeApprovalRequestMethod),
  params: FileChangeRequestApprovalParamsSchema.passthrough(),
}).passthrough();

const ToolCallRequestSchema = ServerRequestBaseSchema.extend({
  method: z.literal(ToolCallRequestMethod),
  params: DynamicToolCallParamsSchema.passthrough(),
}).passthrough();

export const ChatGptAuthTokensRefreshRequestReasonSchema = z.literal("unauthorized");

export const ChatGptAuthTokensRefreshRequestParamsSchema = z
  .object({
    previousAccountId: z.string().nullable().optional(),
    reason: ChatGptAuthTokensRefreshRequestReasonSchema,
  })
  .passthrough();

const ChatGptAuthTokensRefreshRequestSchema = ServerRequestBaseSchema.extend({
  method: z.literal(ChatGptAuthTokensRefreshRequestMethod),
  params: ChatGptAuthTokensRefreshRequestParamsSchema,
}).passthrough();

const ApplyPatchApprovalRequestSchema = ServerRequestBaseSchema.extend({
  method: z.literal(ApplyPatchApprovalRequestMethod),
  params: JsonValueSchema,
}).passthrough();

const ExecuteCommandApprovalRequestSchema = ServerRequestBaseSchema.extend({
  method: z.literal(ExecuteCommandApprovalRequestMethod),
  params: JsonValueSchema,
}).passthrough();

type ThreadConversationRequestSchemaTuple = [
  typeof CommandExecutionApprovalRequestSchema,
  typeof FileChangeApprovalRequestSchema,
  typeof UserInputRequestSchema,
  typeof ToolCallRequestSchema,
  typeof ChatGptAuthTokensRefreshRequestSchema,
  typeof ApplyPatchApprovalRequestSchema,
  typeof ExecuteCommandApprovalRequestSchema,
];

const ThreadConversationRequestVariantSchemas: ThreadConversationRequestSchemaTuple = [
  CommandExecutionApprovalRequestSchema,
  FileChangeApprovalRequestSchema,
  UserInputRequestSchema,
  ToolCallRequestSchema,
  ChatGptAuthTokensRefreshRequestSchema,
  ApplyPatchApprovalRequestSchema,
  ExecuteCommandApprovalRequestSchema,
];

export const ThreadConversationRequestSchema: z.ZodDiscriminatedUnion<
  "method",
  ThreadConversationRequestSchemaTuple
> = z.discriminatedUnion("method", ThreadConversationRequestVariantSchemas);

export const UserInputResponsePayloadSchema = ToolRequestUserInputResponseSchema.passthrough();
export const CommandExecutionApprovalResponsePayloadSchema =
  CommandExecutionRequestApprovalResponseSchema.passthrough();
export const FileChangeApprovalResponsePayloadSchema =
  FileChangeRequestApprovalResponseSchema.passthrough();
export const ToolCallResponsePayloadSchema = DynamicToolCallResponseSchema.passthrough();
export const ChatGptAuthTokensRefreshResponsePayloadSchema = z
  .object({
    accessToken: z.string(),
    chatgptAccountId: z.string(),
    chatgptPlanType: z.string().nullable().optional(),
  })
  .passthrough();
export const ApplyPatchApprovalResponsePayloadSchema = JsonValueSchema;
export const ExecuteCommandApprovalResponsePayloadSchema = JsonValueSchema;

export const ThreadConversationResponseMethodValues = [
  CommandExecutionApprovalRequestMethod,
  FileChangeApprovalRequestMethod,
  UserInputRequestMethod,
  ToolCallRequestMethod,
  ChatGptAuthTokensRefreshRequestMethod,
  ApplyPatchApprovalRequestMethod,
  ExecuteCommandApprovalRequestMethod,
] as const;

const ThreadConversationRequestResponseVariantSchemas = [
  z
    .object({
      method: z.literal(CommandExecutionApprovalRequestMethod),
      payload: CommandExecutionApprovalResponsePayloadSchema,
    })
    .strict(),
  z
    .object({
      method: z.literal(FileChangeApprovalRequestMethod),
      payload: FileChangeApprovalResponsePayloadSchema,
    })
    .strict(),
  z
    .object({
      method: z.literal(UserInputRequestMethod),
      payload: UserInputResponsePayloadSchema,
    })
    .strict(),
  z
    .object({
      method: z.literal(ToolCallRequestMethod),
      payload: ToolCallResponsePayloadSchema,
    })
    .strict(),
  z
    .object({
      method: z.literal(ChatGptAuthTokensRefreshRequestMethod),
      payload: ChatGptAuthTokensRefreshResponsePayloadSchema,
    })
    .strict(),
  z
    .object({
      method: z.literal(ApplyPatchApprovalRequestMethod),
      payload: ApplyPatchApprovalResponsePayloadSchema,
    })
    .strict(),
  z
    .object({
      method: z.literal(ExecuteCommandApprovalRequestMethod),
      payload: ExecuteCommandApprovalResponsePayloadSchema,
    })
    .strict(),
] as const;

export const ThreadConversationRequestResponseSchema = z.discriminatedUnion(
  "method",
  ThreadConversationRequestResponseVariantSchemas,
);

export type UserInputRequest = z.infer<typeof UserInputRequestSchema>;
export type CommandExecutionApprovalRequest = z.infer<typeof CommandExecutionApprovalRequestSchema>;
export type FileChangeApprovalRequest = z.infer<typeof FileChangeApprovalRequestSchema>;
export type ToolCallRequest = z.infer<typeof ToolCallRequestSchema>;
export type ChatGptAuthTokensRefreshRequest = z.infer<typeof ChatGptAuthTokensRefreshRequestSchema>;
export type ThreadConversationRequest = z.infer<typeof ThreadConversationRequestSchema>;
export type CommandExecutionApprovalRequestParams = z.infer<
  typeof CommandExecutionRequestApprovalParamsSchema
>;
export type FileChangeApprovalRequestParams = z.infer<typeof FileChangeRequestApprovalParamsSchema>;
export type ToolCallRequestParams = z.infer<typeof DynamicToolCallParamsSchema>;
export type UserInputResponsePayload = z.infer<typeof UserInputResponsePayloadSchema>;
export type CommandExecutionApprovalResponsePayload = z.infer<
  typeof CommandExecutionApprovalResponsePayloadSchema
>;
export type FileChangeApprovalResponsePayload = z.infer<
  typeof FileChangeApprovalResponsePayloadSchema
>;
export type ToolCallResponsePayload = z.infer<typeof ToolCallResponsePayloadSchema>;
export type ChatGptAuthTokensRefreshResponsePayload = z.infer<
  typeof ChatGptAuthTokensRefreshResponsePayloadSchema
>;
export type ApplyPatchApprovalResponsePayload = z.infer<
  typeof ApplyPatchApprovalResponsePayloadSchema
>;
export type ExecuteCommandApprovalResponsePayload = z.infer<
  typeof ExecuteCommandApprovalResponsePayloadSchema
>;
export type ThreadConversationRequestResponse = z.infer<
  typeof ThreadConversationRequestResponseSchema
>;
export type ThreadConversationRequestResponsePayload = ThreadConversationRequestResponse["payload"];
export type ThreadConversationResponseMethod =
  (typeof ThreadConversationResponseMethodValues)[number];
