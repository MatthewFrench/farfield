import { z } from "zod";
import {
  JsonValueSchema,
  ProtocolValidationError,
  type JsonValue
} from "@farfield/protocol";

const JSON_RPC_VERSION = "2.0";

export const JsonRpcRequestSchema = z
  .object({
    jsonrpc: z.literal(JSON_RPC_VERSION),
    id: z.number().int().nonnegative(),
    method: z.string().min(1),
    params: JsonValueSchema.optional()
  })
  .passthrough();

export const JsonRpcResponseSchema = z
  .object({
    jsonrpc: z.literal(JSON_RPC_VERSION).optional(),
    id: z.number().int().nonnegative(),
    result: JsonValueSchema.optional(),
    error: z
      .object({
        code: z.number().int(),
        message: z.string(),
        data: JsonValueSchema.optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough()
  .superRefine((value, context) => {
    if (value.result === undefined && value.error === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Response must include either result or error"
      });
    }
    if (value.result !== undefined && value.error !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Response must not include both result and error"
      });
    }
  });

export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;

export function parseJsonRpcResponse(value: JsonValue): JsonRpcResponse {
  const parsed = JsonRpcResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw ProtocolValidationError.fromZod("JsonRpcResponse", parsed.error);
  }
  return parsed.data;
}

export const JsonRpcNotificationSchema = z
  .object({
    jsonrpc: z.literal(JSON_RPC_VERSION).optional(),
    method: z.string().min(1),
    params: JsonValueSchema.optional(),
    id: z.never().optional(),
    result: z.never().optional(),
    error: z.never().optional()
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
      value: parsedResponse.data
    };
  }

  const parsedNotification = JsonRpcNotificationSchema.safeParse(value);
  if (parsedNotification.success) {
    return {
      kind: "notification",
      value: parsedNotification.data
    };
  }

  const combinedError = new z.ZodError([
    ...parsedResponse.error.issues,
    ...parsedNotification.error.issues
  ]);
  throw ProtocolValidationError.fromZod("JsonRpcIncomingMessage", combinedError);
}
