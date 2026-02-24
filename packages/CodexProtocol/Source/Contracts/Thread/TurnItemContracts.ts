import { z } from "zod";
import {
  JsonValueSchema,
  NonEmptyStringSchema,
  NonNegativeIntSchema,
  NullableStringSchema
} from "../../Common.js";

export const UserMessageContentPartSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
    text_elements: z.array(JsonValueSchema).optional()
  })
  .passthrough();

export const UserMessageImageContentPartSchema = z
  .object({
    type: z.literal("image"),
    url: z.string()
  })
  .passthrough();

export const UserMessagePartSchema = z.union([
  UserMessageContentPartSchema,
  UserMessageImageContentPartSchema
]);

export const UserMessageItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("userMessage"),
    content: z.array(UserMessagePartSchema)
  })
  .passthrough();

export const SteeringUserMessageItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("steeringUserMessage"),
    content: z.array(UserMessagePartSchema),
    attachments: z.array(JsonValueSchema).optional()
  })
  .passthrough();

export const AgentMessageItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("agentMessage"),
    text: z.string()
  })
  .passthrough();

export const ErrorItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("error"),
    message: z.string(),
    willRetry: z.boolean().optional(),
    errorInfo: z.union([z.string(), z.null()]).optional(),
    additionalDetails: z.union([JsonValueSchema, z.null()]).optional()
  })
  .passthrough();

export const ReasoningItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("reasoning"),
    summary: z.array(z.string()).optional(),
    content: z.array(JsonValueSchema).optional(),
    text: z.string().optional()
  })
  .passthrough();

export const PlanItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("plan"),
    text: z.string()
  })
  .passthrough();

export const PlanImplementationItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("planImplementation"),
    turnId: NonEmptyStringSchema,
    planContent: z.string(),
    isCompleted: z.boolean().optional()
  })
  .passthrough();

export const TurnPlanStepStatusSchema = z.enum(["pending", "inProgress", "completed"]);

export const TodoListPlanStepSchema = z
  .object({
    step: z.string(),
    status: TurnPlanStepStatusSchema
  })
  .passthrough();

export const TodoListItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("todo-list"),
    explanation: z.union([z.string(), z.null()]).optional(),
    plan: z.array(TodoListPlanStepSchema)
  })
  .passthrough();

export const UserInputAnsweredQuestionSchema = z
  .object({
    id: NonEmptyStringSchema,
    header: z.string().optional(),
    question: z.string().optional()
  })
  .passthrough();

export const UserInputResponseItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("userInputResponse"),
    requestId: NonNegativeIntSchema,
    turnId: NonEmptyStringSchema,
    questions: z.array(UserInputAnsweredQuestionSchema),
    answers: z.record(z.array(z.string())),
    completed: z.boolean().optional()
  })
  .passthrough();

export const CommandActionSchema = z
  .object({
    type: NonEmptyStringSchema,
    command: z.string().optional(),
    name: z.string().optional(),
    path: z.union([z.string(), z.null()]).optional(),
    query: z.string().optional()
  })
  .passthrough();

export const CommandExecutionItemSchema = z
  .object({
    type: z.literal("commandExecution"),
    id: NonEmptyStringSchema,
    command: z.string(),
    cwd: z.string().optional(),
    processId: z.string().optional(),
    status: NonEmptyStringSchema,
    commandActions: z.array(CommandActionSchema).optional(),
    aggregatedOutput: z.union([z.string(), z.null()]).optional(),
    exitCode: z.union([z.number().int(), z.null()]).optional(),
    durationMs: z.union([NonNegativeIntSchema, z.null()]).optional()
  })
  .passthrough();

export const FileChangeKindSchema = z
  .object({
    type: NonEmptyStringSchema,
    move_path: z.union([z.string(), z.null()]).optional()
  })
  .passthrough();

export const FileChangeEntrySchema = z
  .object({
    path: z.string(),
    kind: FileChangeKindSchema,
    diff: z.string().optional()
  })
  .passthrough();

export const FileChangeItemSchema = z
  .object({
    type: z.literal("fileChange"),
    id: NonEmptyStringSchema,
    changes: z.array(FileChangeEntrySchema),
    status: NonEmptyStringSchema
  })
  .passthrough();

export const ContextCompactionItemSchema = z
  .object({
    type: z.literal("contextCompaction"),
    id: NonEmptyStringSchema,
    completed: z.boolean().optional()
  })
  .passthrough();

export const WebSearchActionSchema = z
  .object({
    type: NonEmptyStringSchema,
    query: z.string().optional(),
    queries: z.array(z.string()).optional()
  })
  .passthrough();

export const WebSearchItemSchema = z
  .object({
    type: z.literal("webSearch"),
    id: NonEmptyStringSchema,
    query: z.string(),
    action: WebSearchActionSchema
  })
  .passthrough();

export const ModelChangedItemSchema = z
  .object({
    type: z.literal("modelChanged"),
    id: NonEmptyStringSchema,
    fromModel: NullableStringSchema.optional(),
    toModel: NullableStringSchema.optional()
  })
  .passthrough();

export const McpToolCallStatusSchema = z.enum(["inProgress", "completed", "failed"]);

export const McpToolCallResultSchema = z
  .object({
    content: z.array(JsonValueSchema),
    structuredContent: z.union([JsonValueSchema, z.null()]).optional()
  })
  .passthrough();

export const McpToolCallErrorSchema = z
  .object({
    message: z.string()
  })
  .passthrough();

export const McpToolCallItemSchema = z
  .object({
    type: z.literal("mcpToolCall"),
    id: NonEmptyStringSchema,
    server: z.string(),
    tool: z.string(),
    status: McpToolCallStatusSchema,
    arguments: JsonValueSchema,
    result: z.union([McpToolCallResultSchema, z.null()]).optional(),
    error: z.union([McpToolCallErrorSchema, z.null()]).optional(),
    durationMs: z.union([NonNegativeIntSchema, z.null()]).optional()
  })
  .passthrough();

export const CollabAgentToolSchema = z.enum([
  "spawnAgent",
  "sendInput",
  "resumeAgent",
  "wait",
  "closeAgent"
]);

export const CollabAgentStatusSchema = z.enum([
  "pendingInit",
  "running",
  "completed",
  "errored",
  "shutdown",
  "notFound"
]);

export const CollabAgentStateSchema = z
  .object({
    status: CollabAgentStatusSchema,
    message: z.union([z.string(), z.null()]).optional()
  })
  .passthrough();

export const CollabAgentToolCallStatusSchema = z.enum(["inProgress", "completed", "failed"]);

const CollabToolCallItemSharedSchema = z
  .object({
    id: NonEmptyStringSchema,
    tool: CollabAgentToolSchema,
    status: CollabAgentToolCallStatusSchema,
    senderThreadId: z.string(),
    receiverThreadIds: z.array(z.string()),
    prompt: z.union([z.string(), z.null()]).optional(),
    agentsStates: z.record(CollabAgentStateSchema)
  })
  .passthrough();

export const CollabAgentToolCallItemSchema = CollabToolCallItemSharedSchema.extend({
  type: z.literal("collabAgentToolCall")
}).passthrough();

export const CollabToolCallItemSchema = CollabToolCallItemSharedSchema.extend({
  type: z.literal("collabToolCall")
}).passthrough();

export const ImageViewItemSchema = z
  .object({
    type: z.literal("imageView"),
    id: NonEmptyStringSchema,
    path: z.string()
  })
  .passthrough();

export const EnteredReviewModeItemSchema = z
  .object({
    type: z.literal("enteredReviewMode"),
    id: NonEmptyStringSchema,
    review: z.string()
  })
  .passthrough();

export const ExitedReviewModeItemSchema = z
  .object({
    type: z.literal("exitedReviewMode"),
    id: NonEmptyStringSchema,
    review: z.string()
  })
  .passthrough();

export const TurnItemSchema = z.discriminatedUnion("type", [
  UserMessageItemSchema,
  SteeringUserMessageItemSchema,
  AgentMessageItemSchema,
  ErrorItemSchema,
  ReasoningItemSchema,
  PlanItemSchema,
  PlanImplementationItemSchema,
  TodoListItemSchema,
  UserInputResponseItemSchema,
  CommandExecutionItemSchema,
  FileChangeItemSchema,
  ContextCompactionItemSchema,
  WebSearchItemSchema,
  McpToolCallItemSchema,
  CollabAgentToolCallItemSchema,
  CollabToolCallItemSchema,
  ImageViewItemSchema,
  EnteredReviewModeItemSchema,
  ExitedReviewModeItemSchema,
  ModelChangedItemSchema
]);
