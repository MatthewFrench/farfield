import { z } from "zod";

export const AgentIdSchema = z.enum(["codex", "opencode"]);

export type AgentId = z.infer<typeof AgentIdSchema>;

export interface ApiRequestOptions {
  signal?: AbortSignal;
  actionId?: string;
  actionName?: string;
}
