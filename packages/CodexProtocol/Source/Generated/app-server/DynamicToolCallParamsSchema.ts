// GENERATED FILE. DO NOT EDIT.
// Source: vendor/codex-app-server-schema/stable/json/DynamicToolCallParams.json
import { z } from "zod";

export const DynamicToolCallParamsSchema = z.object({
  arguments: z.any(),
  callId: z.string(),
  threadId: z.string(),
  tool: z.string(),
  turnId: z.string(),
});
