import { type JsonValue, JsonValueSchema, ProtocolValidationError } from "@farfield/protocol";
import { z } from "zod";

/**
 * Owns JSON-RPC boundary schemas and incoming envelope classification for adapter transport payloads.
 * Parsing stays schema-first so callers only consume strict response/notification contracts.
 */
const JSON_RPC_VERSION = "2.0";
const JSON_RPC_RESPONSE_PARSE_CONTEXT = "JsonRpcResponse";
const JSON_RPC_INCOMING_MESSAGE_PARSE_CONTEXT = "JsonRpcIncomingMessage";
const RESPONSE_MUST_INCLUDE_RESULT_OR_ERROR_MESSAGE =
  "Response must include either result or error";
const RESPONSE_MUST_NOT_INCLUDE_BOTH_RESULT_AND_ERROR_MESSAGE =
  "Response must not include both result and error";

const JsonRpcErrorSchema = z
  .object({
    code: z.number().int(),
    message: z.string(),
    data: JsonValueSchema.optional(),
  })
  .passthrough();

const JsonRpcResponseEnvelopeSchema = z
  .object({
    jsonrpc: z.literal(JSON_RPC_VERSION).optional(),
    id: z.number().int().nonnegative(),
    result: JsonValueSchema.optional(),
    error: JsonRpcErrorSchema.optional(),
  })
  .passthrough();

type JsonRpcResponseEnvelope = z.infer<typeof JsonRpcResponseEnvelopeSchema>;

function validateResponseResultAndErrorExclusivity(
  value: JsonRpcResponseEnvelope,
  context: z.RefinementCtx,
): void {
  if (value.result === undefined && value.error === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: RESPONSE_MUST_INCLUDE_RESULT_OR_ERROR_MESSAGE,
    });
  }

  if (value.result !== undefined && value.error !== undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: RESPONSE_MUST_NOT_INCLUDE_BOTH_RESULT_AND_ERROR_MESSAGE,
    });
  }
}

function parseBoundarySchemaOrThrow<SchemaType extends z.ZodTypeAny>(
  schema: SchemaType,
  value: JsonValue,
  context: string,
): z.output<SchemaType> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw ProtocolValidationError.fromZod(context, parsed.error);
  }

  return parsed.data;
}

function buildIncomingMessageCombinedError(
  responseError: z.ZodError,
  notificationError: z.ZodError,
): z.ZodError {
  return new z.ZodError([...responseError.issues, ...notificationError.issues]);
}

export const JsonRpcRequestSchema = z
  .object({
    jsonrpc: z.literal(JSON_RPC_VERSION),
    id: z.number().int().nonnegative(),
    method: z.string().min(1),
    params: JsonValueSchema.optional(),
  })
  .passthrough();

export const JsonRpcResponseSchema = JsonRpcResponseEnvelopeSchema.superRefine(
  validateResponseResultAndErrorExclusivity,
);

export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;

export function parseJsonRpcResponse(value: JsonValue): JsonRpcResponse {
  return parseBoundarySchemaOrThrow(JsonRpcResponseSchema, value, JSON_RPC_RESPONSE_PARSE_CONTEXT);
}

export const JsonRpcNotificationSchema = z
  .object({
    jsonrpc: z.literal(JSON_RPC_VERSION).optional(),
    method: z.string().min(1),
    params: JsonValueSchema.optional(),
    id: z.never().optional(),
    result: z.never().optional(),
    error: z.never().optional(),
  })
  .passthrough();

export type JsonRpcNotification = z.infer<typeof JsonRpcNotificationSchema>;

export type JsonRpcIncomingMessage =
  | { kind: "response"; value: JsonRpcResponse }
  | { kind: "notification"; value: JsonRpcNotification };

export function parseJsonRpcIncomingMessage(value: JsonValue): JsonRpcIncomingMessage {
  const parsedResponse = JsonRpcResponseSchema.safeParse(value);
  if (parsedResponse.success) {
    return {
      kind: "response",
      value: parsedResponse.data,
    };
  }

  const parsedNotification = JsonRpcNotificationSchema.safeParse(value);
  if (parsedNotification.success) {
    return {
      kind: "notification",
      value: parsedNotification.data,
    };
  }

  const combinedError = buildIncomingMessageCombinedError(
    parsedResponse.error,
    parsedNotification.error,
  );
  throw ProtocolValidationError.fromZod(JSON_RPC_INCOMING_MESSAGE_PARSE_CONTEXT, combinedError);
}
