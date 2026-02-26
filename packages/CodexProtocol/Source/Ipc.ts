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

/**
 * Owns IPC envelope contracts consumed by transport adapters.
 * Schemas keep passthrough behavior so newer peers can add envelope metadata without breaking older clients.
 */
export const IpcFrameType = {
  request: "request",
  response: "response",
  broadcast: "broadcast",
  clientDiscoveryRequest: "client-discovery-request",
  clientDiscoveryResponse: "client-discovery-response"
} as const;

export const IpcResponseResultType = {
  success: "success",
  error: "error"
} as const;

export const IpcResponseResultTypeSchema = z.enum([
  IpcResponseResultType.success,
  IpcResponseResultType.error
]);

export const IpcRequestIdSchema = NonEmptyStringSchema;

export const IpcRequestFrameSchema = z
  .object({
    type: z.literal(IpcFrameType.request),
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
    type: z.literal(IpcFrameType.response),
    requestId: IpcRequestIdSchema,
    method: NonEmptyStringSchema.optional(),
    handledByClientId: NonEmptyStringSchema.optional(),
    resultType: IpcResponseResultTypeSchema,
    result: JsonValueSchema.optional(),
    error: JsonValueSchema.optional()
  })
  .passthrough();

export const IpcBroadcastFrameSchema = z
  .object({
    type: z.literal(IpcFrameType.broadcast),
    method: NonEmptyStringSchema,
    params: JsonValueSchema.optional(),
    sourceClientId: NonEmptyStringSchema.optional(),
    targetClientId: NonEmptyStringSchema.optional(),
    version: NonNegativeIntSchema.optional()
  })
  .passthrough();

export const IpcClientDiscoveryRequestFrameSchema = z
  .object({
    type: z.literal(IpcFrameType.clientDiscoveryRequest),
    requestId: IpcRequestIdSchema,
    request: IpcRequestFrameSchema
  })
  .passthrough();

export const IpcClientDiscoveryResponseFrameSchema = z
  .object({
    type: z.literal(IpcFrameType.clientDiscoveryResponse),
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
    type: z.ZodLiteral<typeof IpcFrameType.broadcast>;
    method: z.ZodLiteral<typeof ThreadStreamStateChangedEventType>;
    sourceClientId: typeof NonEmptyStringSchema;
    params: typeof ThreadStreamStateChangedParamsSchema;
    version: typeof NonNegativeIntSchema;
  },
  "passthrough"
> = z
  .object({
    // Stream consumers depend on sender identity and envelope version for deterministic replay/ownership.
    type: z.literal(IpcFrameType.broadcast),
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
