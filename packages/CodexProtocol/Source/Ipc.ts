import { z } from "zod";
import {
  JsonValueSchema,
  NonEmptyStringSchema,
  NonNegativeIntSchema,
  type JsonValue
} from "./Common.js";
import { ProtocolValidationError } from "./Errors.js";
import { ThreadStreamStateChangedParamsSchema } from "./Contracts/Thread/StreamStateContracts.js";

export const IpcRequestIdSchema = NonEmptyStringSchema;

export const IpcRequestFrameSchema = z
  .object({
    type: z.literal("request"),
    requestId: IpcRequestIdSchema,
    method: NonEmptyStringSchema,
    params: JsonValueSchema.optional(),
    targetClientId: NonEmptyStringSchema.optional(),
    sourceClientId: NonEmptyStringSchema.optional(),
    version: NonNegativeIntSchema.optional()
  })
  .passthrough();

export const IpcResponseFrameSchema = z
  .object({
    type: z.literal("response"),
    requestId: IpcRequestIdSchema,
    method: NonEmptyStringSchema.optional(),
    handledByClientId: NonEmptyStringSchema.optional(),
    resultType: z.enum(["success", "error"]),
    result: JsonValueSchema.optional(),
    error: JsonValueSchema.optional()
  })
  .passthrough();

export const IpcBroadcastFrameSchema = z
  .object({
    type: z.literal("broadcast"),
    method: NonEmptyStringSchema,
    params: JsonValueSchema.optional(),
    sourceClientId: NonEmptyStringSchema.optional(),
    targetClientId: NonEmptyStringSchema.optional(),
    version: NonNegativeIntSchema.optional()
  })
  .passthrough();

export const IpcClientDiscoveryRequestFrameSchema = z
  .object({
    type: z.literal("client-discovery-request"),
    requestId: IpcRequestIdSchema,
    request: IpcRequestFrameSchema
  })
  .passthrough();

export const IpcClientDiscoveryResponseFrameSchema = z
  .object({
    type: z.literal("client-discovery-response"),
    requestId: IpcRequestIdSchema,
    response: z
      .object({
        canHandle: z.boolean()
      })
      .passthrough()
  })
  .passthrough();

export const IpcFrameSchema = z.union([
  IpcRequestFrameSchema,
  IpcResponseFrameSchema,
  IpcBroadcastFrameSchema,
  IpcClientDiscoveryRequestFrameSchema,
  IpcClientDiscoveryResponseFrameSchema
]);

export const ThreadStreamStateChangedBroadcastSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"broadcast">;
    method: z.ZodLiteral<"thread-stream-state-changed">;
    sourceClientId: typeof NonEmptyStringSchema;
    params: typeof ThreadStreamStateChangedParamsSchema;
    version: typeof NonNegativeIntSchema;
  },
  "passthrough"
> = z
  .object({
    type: z.literal("broadcast"),
    method: z.literal("thread-stream-state-changed"),
    sourceClientId: NonEmptyStringSchema,
    params: ThreadStreamStateChangedParamsSchema,
    version: NonNegativeIntSchema
  })
  .passthrough();

export type IpcFrame = z.infer<typeof IpcFrameSchema>;
export type IpcRequestFrame = z.infer<typeof IpcRequestFrameSchema>;
export type IpcResponseFrame = z.infer<typeof IpcResponseFrameSchema>;
export type IpcBroadcastFrame = z.infer<typeof IpcBroadcastFrameSchema>;
export type IpcClientDiscoveryRequestFrame = z.infer<typeof IpcClientDiscoveryRequestFrameSchema>;
export type IpcClientDiscoveryResponseFrame = z.infer<typeof IpcClientDiscoveryResponseFrameSchema>;
export type ThreadStreamStateChangedBroadcast = z.infer<
  typeof ThreadStreamStateChangedBroadcastSchema
>;

export function parseIpcFrame(value: JsonValue): IpcFrame {
  const result = IpcFrameSchema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod("IpcFrame", result.error);
  }
  return result.data;
}

export function parseThreadStreamStateChangedBroadcast(
  value: JsonValue
): ThreadStreamStateChangedBroadcast {
  const result = ThreadStreamStateChangedBroadcastSchema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod(
      "ThreadStreamStateChangedBroadcast",
      result.error
    );
  }
  return result.data;
}
