import { JsonValueSchema, type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import { type ParsedReplayFrame } from "./DebugRouteContracts.js";

const ReplayFrameSchema = z
  .discriminatedUnion("type", [
    z
      .object({
        type: z.literal("request"),
        method: z.string().trim().min(1),
        params: JsonValueSchema.optional(),
        targetClientId: z.string().optional(),
        version: z.number().int().optional()
      })
      .passthrough(),
    z
      .object({
        type: z.literal("broadcast"),
        method: z.string().trim().min(1),
        params: JsonValueSchema.optional(),
        targetClientId: z.string().optional(),
        version: z.number().int().optional()
      })
      .passthrough()
  ])
  .superRefine((value, context) => {
    if (value.method.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Captured IPC frame has invalid method"
      });
    }
  });

export function parseReplayFrame(payload: JsonValue): ParsedReplayFrame {
  const parsed = ReplayFrameSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  return {
    type: parsed.data.type,
    method: parsed.data.method,
    params: parsed.data.params,
    ...(parsed.data.targetClientId ? { targetClientId: parsed.data.targetClientId } : {}),
    ...(typeof parsed.data.version === "number" ? { version: parsed.data.version } : {})
  };
}
