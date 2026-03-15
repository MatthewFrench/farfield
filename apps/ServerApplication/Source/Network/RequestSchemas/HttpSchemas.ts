import {
  CollaborationModeSchema,
  type JsonValue,
  ThreadConversationRequestResponseSchema,
} from "@farfield/protocol";
import { z } from "zod";

const TRACE_LABEL_MAXIMUM_LENGTH = 120;
const TRACE_MARK_NOTE_MAXIMUM_LENGTH = 500;
const THREAD_NAME_MAXIMUM_LENGTH = 120;
const REQUEST_BODY_ISSUE_PATH_PREFIX = "body";
const REQUEST_BODY_ISSUE_PATH_SEPARATOR = ".";
const HTTP_BODY_PARSE_ERROR_PREFIX = "Invalid HTTP request body";

const RequestBodySchemaNameByParser = {
  setMode: "SetModeBody",
  startThread: "StartThreadBody",
  startThreadReview: "StartThreadReviewBody",
  sendMessage: "SendMessageBody",
  submitUserInput: "SubmitUserInputBody",
  interrupt: "InterruptBody",
  forkThread: "ForkThreadBody",
  forkThreadFromMessage: "ForkThreadFromMessageBody",
  setThreadName: "SetThreadNameBody",
  rollbackThread: "RollbackThreadBody",
  traceStart: "TraceStartBody",
  traceMark: "TraceMarkBody",
  replay: "ReplayBody",
  generic: "GenericRequestBody",
} as const;

export const HttpBodyParseErrorTypeByName = {
  invalidHttpRequestBody: "invalid-http-request-body",
} as const;

export type HttpBodyParseErrorType =
  (typeof HttpBodyParseErrorTypeByName)[keyof typeof HttpBodyParseErrorTypeByName];

export interface HttpBodyParseIssue {
  path: string;
  issueCode: z.ZodIssue["code"];
  message: string;
}

export interface HttpBodyParseErrorDetails {
  errorType: HttpBodyParseErrorType;
  schemaName: string;
  issues: ReadonlyArray<HttpBodyParseIssue>;
}

/**
 * Owns strict request-body boundary schemas and parser entry points for server HTTP routes.
 * Route owners should consume named parsers to keep per-route contract intent explicit.
 */
export const SetModeBodySchema = z
  .object({
    ownerClientId: z.string().optional(),
    collaborationMode: CollaborationModeSchema,
  })
  .strict();

export const StartThreadBodySchema = z
  .object({
    agentId: z.enum(["codex", "opencode"]).optional(),
    cwd: z.string().optional(),
    model: z.string().optional(),
    modelProvider: z.string().optional(),
    personality: z.string().optional(),
    sandbox: z.string().optional(),
    approvalPolicy: z.string().optional(),
    ephemeral: z.boolean().optional(),
  })
  .strict();

export const SendMessageBodySchema = z
  .object({
    ownerClientId: z.string().optional(),
    text: z.string().min(1),
    cwd: z.string().optional(),
    isSteering: z.boolean().optional(),
  })
  .strict();

export const SubmitUserInputBodySchema = z
  .object({
    ownerClientId: z.string().optional(),
    requestId: z.number().int().nonnegative(),
    response: ThreadConversationRequestResponseSchema,
  })
  .strict();

export const InterruptBodySchema = z
  .object({
    ownerClientId: z.string().optional(),
  })
  .strict();

export const ForkThreadBodySchema = z.object({}).strict();

export const ForkThreadFromMessageBodySchema = z
  .object({
    messageId: z.string().trim().min(1),
  })
  .strict();

export const SetThreadNameBodySchema = z
  .object({
    name: z.string().trim().min(1).max(THREAD_NAME_MAXIMUM_LENGTH),
  })
  .strict();

export const RollbackThreadBodySchema = z
  .object({
    numTurns: z.number().int().min(1),
  })
  .strict();

export const ThreadReviewDeliverySchema = z.enum(["inline", "detached"]);

export const ThreadReviewTargetSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("uncommittedChanges"),
    })
    .strict(),
  z
    .object({
      type: z.literal("baseBranch"),
      branch: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("commit"),
      sha: z.string().min(1),
      title: z.union([z.string(), z.null()]).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("custom"),
      instructions: z.string().min(1),
    })
    .strict(),
]);

export const StartThreadReviewBodySchema = z
  .object({
    delivery: ThreadReviewDeliverySchema.nullable().optional(),
    target: ThreadReviewTargetSchema.optional(),
  })
  .strict();

export const TraceStartBodySchema = z
  .object({
    // Limit keeps trace labels concise enough for list and activity surfaces.
    label: z.string().min(1).max(TRACE_LABEL_MAXIMUM_LENGTH),
  })
  .strict();

export const TraceMarkBodySchema = z
  .object({
    note: z.string().max(TRACE_MARK_NOTE_MAXIMUM_LENGTH),
  })
  .strict();

export const ReplayBodySchema = z
  .object({
    entryId: z.string().min(1),
    waitForResponse: z.boolean().optional(),
  })
  .strict();

export type SetModeBody = z.infer<typeof SetModeBodySchema>;
export type StartThreadBody = z.infer<typeof StartThreadBodySchema>;
export type SendMessageBody = z.infer<typeof SendMessageBodySchema>;
export type SubmitUserInputBody = z.infer<typeof SubmitUserInputBodySchema>;
export type InterruptBody = z.infer<typeof InterruptBodySchema>;
export type ForkThreadBody = z.infer<typeof ForkThreadBodySchema>;
export type ForkThreadFromMessageBody = z.infer<typeof ForkThreadFromMessageBodySchema>;
export type SetThreadNameBody = z.infer<typeof SetThreadNameBodySchema>;
export type RollbackThreadBody = z.infer<typeof RollbackThreadBodySchema>;
export type StartThreadReviewBody = z.infer<typeof StartThreadReviewBodySchema>;
export type TraceStartBody = z.infer<typeof TraceStartBodySchema>;
export type TraceMarkBody = z.infer<typeof TraceMarkBodySchema>;
export type ReplayBody = z.infer<typeof ReplayBodySchema>;

function buildHttpBodyParseErrorMessage(details: HttpBodyParseErrorDetails): string {
  const firstIssue = details.issues[0];
  if (!firstIssue) {
    return `${HTTP_BODY_PARSE_ERROR_PREFIX} for ${details.schemaName}`;
  }

  return `${HTTP_BODY_PARSE_ERROR_PREFIX} for ${details.schemaName} at ${firstIssue.path}: ${firstIssue.message}`;
}

/**
 * Extends ZodError so request-validation transport mapping stays stable while exposing
 * deterministic issue localization metadata for boundary diagnostics.
 */
export class HttpBodyParseError extends z.ZodError<JsonValue> {
  public readonly details: HttpBodyParseErrorDetails;

  public constructor(details: HttpBodyParseErrorDetails, issues: z.ZodIssue[]) {
    super(issues);
    this.name = "HttpBodyParseError";
    this.details = details;
  }

  public override get message(): string {
    return buildHttpBodyParseErrorMessage(this.details);
  }
}

function mapHttpBodyParseIssues(issues: ReadonlyArray<z.ZodIssue>): HttpBodyParseIssue[] {
  return issues.map((issue) => ({
    path: buildRequestBodyIssuePath(issue.path),
    issueCode: issue.code,
    message: issue.message,
  }));
}

function buildRequestBodyIssuePath(pathSegments: ReadonlyArray<string | number>): string {
  if (pathSegments.length === 0) {
    return REQUEST_BODY_ISSUE_PATH_PREFIX;
  }

  return `${REQUEST_BODY_ISSUE_PATH_PREFIX}${REQUEST_BODY_ISSUE_PATH_SEPARATOR}${pathSegments
    .map((segment) => String(segment))
    .join(REQUEST_BODY_ISSUE_PATH_SEPARATOR)}`;
}

function parseOwnedRequestBody<Schema extends z.ZodTypeAny>(
  schema: Schema,
  value: JsonValue,
  schemaName: string,
): z.infer<Schema> {
  const parsedRequestBodyResult = schema.safeParse(value);
  if (!parsedRequestBodyResult.success) {
    throw new HttpBodyParseError(
      {
        errorType: HttpBodyParseErrorTypeByName.invalidHttpRequestBody,
        schemaName,
        issues: mapHttpBodyParseIssues(parsedRequestBodyResult.error.issues),
      },
      parsedRequestBodyResult.error.issues,
    );
  }

  return parsedRequestBodyResult.data;
}

export function parseSetModeBody(value: JsonValue): SetModeBody {
  return parseOwnedRequestBody(SetModeBodySchema, value, RequestBodySchemaNameByParser.setMode);
}

export function parseStartThreadBody(value: JsonValue): StartThreadBody {
  return parseOwnedRequestBody(
    StartThreadBodySchema,
    value,
    RequestBodySchemaNameByParser.startThread,
  );
}

export function parseSendMessageBody(value: JsonValue): SendMessageBody {
  return parseOwnedRequestBody(
    SendMessageBodySchema,
    value,
    RequestBodySchemaNameByParser.sendMessage,
  );
}

export function parseSubmitUserInputBody(value: JsonValue): SubmitUserInputBody {
  return parseOwnedRequestBody(
    SubmitUserInputBodySchema,
    value,
    RequestBodySchemaNameByParser.submitUserInput,
  );
}

export function parseInterruptBody(value: JsonValue): InterruptBody {
  return parseOwnedRequestBody(InterruptBodySchema, value, RequestBodySchemaNameByParser.interrupt);
}

export function parseForkThreadBody(value: JsonValue): ForkThreadBody {
  return parseOwnedRequestBody(
    ForkThreadBodySchema,
    value,
    RequestBodySchemaNameByParser.forkThread,
  );
}

export function parseForkThreadFromMessageBody(value: JsonValue): ForkThreadFromMessageBody {
  return parseOwnedRequestBody(
    ForkThreadFromMessageBodySchema,
    value,
    RequestBodySchemaNameByParser.forkThreadFromMessage,
  );
}

export function parseSetThreadNameBody(value: JsonValue): SetThreadNameBody {
  return parseOwnedRequestBody(
    SetThreadNameBodySchema,
    value,
    RequestBodySchemaNameByParser.setThreadName,
  );
}

export function parseRollbackThreadBody(value: JsonValue): RollbackThreadBody {
  return parseOwnedRequestBody(
    RollbackThreadBodySchema,
    value,
    RequestBodySchemaNameByParser.rollbackThread,
  );
}

export function parseStartThreadReviewBody(value: JsonValue): StartThreadReviewBody {
  return parseOwnedRequestBody(
    StartThreadReviewBodySchema,
    value,
    RequestBodySchemaNameByParser.startThreadReview,
  );
}

export function parseTraceStartBody(value: JsonValue): TraceStartBody {
  return parseOwnedRequestBody(
    TraceStartBodySchema,
    value,
    RequestBodySchemaNameByParser.traceStart,
  );
}

export function parseTraceMarkBody(value: JsonValue): TraceMarkBody {
  return parseOwnedRequestBody(TraceMarkBodySchema, value, RequestBodySchemaNameByParser.traceMark);
}

export function parseReplayBody(value: JsonValue): ReplayBody {
  return parseOwnedRequestBody(ReplayBodySchema, value, RequestBodySchemaNameByParser.replay);
}

export function parseBody<Schema extends z.ZodTypeAny>(
  schema: Schema,
  value: JsonValue,
): z.infer<Schema> {
  return parseOwnedRequestBody(schema, value, RequestBodySchemaNameByParser.generic);
}
