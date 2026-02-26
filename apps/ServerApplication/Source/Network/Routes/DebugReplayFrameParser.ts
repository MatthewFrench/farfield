import { JsonValueSchema, type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import {
  DebugReplayFrameTypeByName,
  type ParsedReplayFrame
} from "./DebugRouteContracts.js";

const ReplayFrameMethodSchema = z.string().trim().min(1);
const ReplayFrameTargetClientIdentifierSchema = z.string().trim().min(1);

const ReplayRequestFrameSchema = z
  .object({
    type: z.literal(DebugReplayFrameTypeByName.request),
    method: ReplayFrameMethodSchema,
    params: JsonValueSchema.optional(),
    targetClientId: ReplayFrameTargetClientIdentifierSchema.optional(),
    version: z.number().int().optional()
  })
  .passthrough();

const ReplayBroadcastFrameSchema = z
  .object({
    type: z.literal(DebugReplayFrameTypeByName.broadcast),
    method: ReplayFrameMethodSchema,
    params: JsonValueSchema.optional(),
    targetClientId: ReplayFrameTargetClientIdentifierSchema.optional(),
    version: z.number().int().optional()
  })
  .passthrough();

const ReplayFrameSchema = z
  .discriminatedUnion("type", [ReplayRequestFrameSchema, ReplayBroadcastFrameSchema]);

export function parseReplayFrame(payload: JsonValue): ParsedReplayFrame {
  const parsedReplayFrame = ReplayFrameSchema.parse(payload);

  return {
    type: parsedReplayFrame.type,
    method: parsedReplayFrame.method,
    params: parsedReplayFrame.params,
    ...(parsedReplayFrame.targetClientId !== undefined
      ? { targetClientId: parsedReplayFrame.targetClientId }
      : {}),
    ...(parsedReplayFrame.version !== undefined
      ? { version: parsedReplayFrame.version }
      : {})
  };
}
