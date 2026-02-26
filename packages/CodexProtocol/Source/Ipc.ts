import { z } from "zod";
import {
  JsonValueSchema,
  NonEmptyStringSchema,
  NonNegativeIntSchema,
  type JsonValue
} from "./Common.js";
import {
  ThreadStreamStateChangedEventType,
  ThreadStreamStateChangedParamsSchema
} from "./Contracts/Thread/StreamStateContracts.js";
import { parseSchemaOrThrow } from "./ProtocolSchemaParsers.js";

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

export const IpcFrameSchema: z.ZodDiscriminatedUnion<
  "type",
  [
    typeof IpcRequestFrameSchema,
    typeof IpcResponseFrameSchema,
    typeof IpcBroadcastFrameSchema,
    typeof IpcClientDiscoveryRequestFrameSchema,
    typeof IpcClientDiscoveryResponseFrameSchema
  ]
> = z.discriminatedUnion("type", [
  IpcRequestFrameSchema,
  IpcResponseFrameSchema,
  IpcBroadcastFrameSchema,
  IpcClientDiscoveryRequestFrameSchema,
  IpcClientDiscoveryResponseFrameSchema
]);

export const ThreadStreamStateChangedBroadcastSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"broadcast">;
    method: z.ZodLiteral<typeof ThreadStreamStateChangedEventType>;
    sourceClientId: typeof NonEmptyStringSchema;
    params: typeof ThreadStreamStateChangedParamsSchema;
    version: typeof NonNegativeIntSchema;
  },
  "passthrough"
> = z
  .object({
    type: z.literal("broadcast"),
    method: z.literal(ThreadStreamStateChangedEventType),
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
const ParseContext = {
  ipcFrame: "IpcFrame",
  threadStreamStateChangedBroadcast: "ThreadStreamStateChangedBroadcast"
} as const;

export function parseIpcFrame(value: JsonValue): IpcFrame {
  return parseSchemaOrThrow(IpcFrameSchema, value, ParseContext.ipcFrame);
}

export function parseThreadStreamStateChangedBroadcast(
  value: JsonValue
): ThreadStreamStateChangedBroadcast {
  return parseSchemaOrThrow(
    ThreadStreamStateChangedBroadcastSchema,
    value,
    ParseContext.threadStreamStateChangedBroadcast
  );
}
