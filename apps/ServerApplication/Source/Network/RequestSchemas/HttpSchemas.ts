import {
  CollaborationModeSchema,
  UserInputResponsePayloadSchema,
  type JsonValue
} from "@farfield/protocol";
import { z } from "zod";

const TRACE_LABEL_MAXIMUM_LENGTH = 120;
const TRACE_MARK_NOTE_MAXIMUM_LENGTH = 500;

/**
 * Owns strict request-body boundary schemas and parser entry points for server HTTP routes.
 * Route owners should consume named parsers to keep per-route contract intent explicit.
 */
export const SetModeBodySchema = z
  .object({
    ownerClientId: z.string().optional(),
    collaborationMode: CollaborationModeSchema
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
    ephemeral: z.boolean().optional()
  })
  .strict();

export const SendMessageBodySchema = z
  .object({
    ownerClientId: z.string().optional(),
    text: z.string().min(1),
    cwd: z.string().optional(),
    isSteering: z.boolean().optional()
  })
  .strict();

export const SubmitUserInputBodySchema = z
  .object({
    ownerClientId: z.string().optional(),
    requestId: z.number().int().nonnegative(),
    response: UserInputResponsePayloadSchema
  })
  .strict();

export const InterruptBodySchema = z
  .object({
    ownerClientId: z.string().optional()
  })
  .strict();

export const TraceStartBodySchema = z
  .object({
    // Limit keeps trace labels concise enough for list and activity surfaces.
    label: z.string().min(1).max(TRACE_LABEL_MAXIMUM_LENGTH)
  })
  .strict();

export const TraceMarkBodySchema = z
  .object({
    note: z.string().max(TRACE_MARK_NOTE_MAXIMUM_LENGTH)
  })
  .strict();

export const ReplayBodySchema = z
  .object({
    entryId: z.string().min(1),
    waitForResponse: z.boolean().optional()
  })
  .strict();

export type SetModeBody = z.infer<typeof SetModeBodySchema>;
export type StartThreadBody = z.infer<typeof StartThreadBodySchema>;
export type SendMessageBody = z.infer<typeof SendMessageBodySchema>;
export type SubmitUserInputBody = z.infer<typeof SubmitUserInputBodySchema>;
export type InterruptBody = z.infer<typeof InterruptBodySchema>;
export type TraceStartBody = z.infer<typeof TraceStartBodySchema>;
export type TraceMarkBody = z.infer<typeof TraceMarkBodySchema>;
export type ReplayBody = z.infer<typeof ReplayBodySchema>;

function parseOwnedRequestBody<Schema extends z.ZodTypeAny>(
  schema: Schema,
  value: JsonValue
): z.infer<Schema> {
  return schema.parse(value);
}

export function parseSetModeBody(value: JsonValue): SetModeBody {
  return parseOwnedRequestBody(SetModeBodySchema, value);
}

export function parseStartThreadBody(value: JsonValue): StartThreadBody {
  return parseOwnedRequestBody(StartThreadBodySchema, value);
}

export function parseSendMessageBody(value: JsonValue): SendMessageBody {
  return parseOwnedRequestBody(SendMessageBodySchema, value);
}

export function parseSubmitUserInputBody(value: JsonValue): SubmitUserInputBody {
  return parseOwnedRequestBody(SubmitUserInputBodySchema, value);
}

export function parseInterruptBody(value: JsonValue): InterruptBody {
  return parseOwnedRequestBody(InterruptBodySchema, value);
}

export function parseTraceStartBody(value: JsonValue): TraceStartBody {
  return parseOwnedRequestBody(TraceStartBodySchema, value);
}

export function parseTraceMarkBody(value: JsonValue): TraceMarkBody {
  return parseOwnedRequestBody(TraceMarkBodySchema, value);
}

export function parseReplayBody(value: JsonValue): ReplayBody {
  return parseOwnedRequestBody(ReplayBodySchema, value);
}

export function parseBody<Schema extends z.ZodTypeAny>(
  schema: Schema,
  value: JsonValue
): z.infer<Schema> {
  return parseOwnedRequestBody(schema, value);
}
