import { z } from "zod";
import { JsonValueSchema, NonEmptyStringSchema, NonNegativeIntSchema } from "../../Common.js";
import { ToolRequestUserInputResponseSchema } from "../../Generated/app-server/index.js";

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

export const UserInputOptionSchema = z
  .object({
    label: z.string(),
    description: z.string(),
  })
  .passthrough();

export const UserInputQuestionSchema = z
  .object({
    id: NonEmptyStringSchema,
    header: z.string(),
    question: z.string(),
    isOther: z.boolean(),
    isSecret: z.boolean(),
    options: z.array(UserInputOptionSchema),
  })
  .passthrough();

export const UserInputRequestParamsSchema = z
  .object({
    threadId: NonEmptyStringSchema,
    turnId: NonEmptyStringSchema,
    itemId: NonEmptyStringSchema,
    questions: z.array(UserInputQuestionSchema),
  })
  .passthrough();

export const UserInputRequestSchema = z
  .object({
    method: z.literal(UserInputRequestMethod),
    id: NonNegativeIntSchema,
    params: UserInputRequestParamsSchema,
    completed: z.boolean().optional(),
  })
  .passthrough();

const ServerRequestBaseSchema = z
  .object({
    id: NonNegativeIntSchema,
    params: JsonValueSchema,
    completed: z.boolean().optional(),
  })
  .passthrough();

const CommandExecutionApprovalRequestSchema = ServerRequestBaseSchema.extend({
  method: z.literal(CommandExecutionApprovalRequestMethod),
}).passthrough();

const FileChangeApprovalRequestSchema = ServerRequestBaseSchema.extend({
  method: z.literal(FileChangeApprovalRequestMethod),
}).passthrough();

const ToolCallRequestSchema = ServerRequestBaseSchema.extend({
  method: z.literal(ToolCallRequestMethod),
}).passthrough();

const ChatGptAuthTokensRefreshRequestSchema = ServerRequestBaseSchema.extend({
  method: z.literal(ChatGptAuthTokensRefreshRequestMethod),
}).passthrough();

const ApplyPatchApprovalRequestSchema = ServerRequestBaseSchema.extend({
  method: z.literal(ApplyPatchApprovalRequestMethod),
}).passthrough();

const ExecuteCommandApprovalRequestSchema = ServerRequestBaseSchema.extend({
  method: z.literal(ExecuteCommandApprovalRequestMethod),
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

export const UserInputAnswerSchema = z
  .object({
    answers: z.array(z.string()),
  })
  .passthrough();

export const UserInputResponsePayloadSchema = ToolRequestUserInputResponseSchema.passthrough();

export type UserInputRequest = z.infer<typeof UserInputRequestSchema>;
export type ThreadConversationRequest = z.infer<typeof ThreadConversationRequestSchema>;
export type UserInputResponsePayload = z.infer<typeof UserInputResponsePayloadSchema>;
