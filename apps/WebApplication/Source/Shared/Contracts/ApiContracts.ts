import { z } from "zod";
import { RequestMetadataTokenSchema } from "@/Shared/Contracts/RequestMetadataContracts";

export const AgentIdSchema = z.enum(["codex", "opencode"]);

export type AgentId = z.infer<typeof AgentIdSchema>;

export const ApiRequestActionIdentifierSchema = RequestMetadataTokenSchema;
export type ApiRequestActionIdentifier = z.infer<typeof ApiRequestActionIdentifierSchema>;

export const ApiRequestActionNameSchema = RequestMetadataTokenSchema;
export type ApiRequestActionName = z.infer<typeof ApiRequestActionNameSchema>;

export const ApiRequestHeaderOptionsSchema = z
  .object({
    actionId: ApiRequestActionIdentifierSchema.optional(),
    actionName: ApiRequestActionNameSchema.optional()
  })
  .strict();

export type ApiRequestHeaderOptions = z.infer<typeof ApiRequestHeaderOptionsSchema>;

export interface ApiRequestOptions extends ApiRequestHeaderOptions {
  signal?: AbortSignal;
}
