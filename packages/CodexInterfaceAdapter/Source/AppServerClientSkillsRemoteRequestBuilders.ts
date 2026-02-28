import { z } from "zod";
import type { ExportRemoteSkillOptions, ListRemoteSkillsOptions } from "./AppServerClient.js";

const AppServerSkillsRemoteListRequestSchema = z
  .object({
    hazelnutScope: z.enum(["example", "workspace-shared", "all-shared", "personal"]),
    productSurface: z.enum(["chatgpt", "codex", "api", "atlas"]),
    enabled: z.boolean(),
  })
  .passthrough();
const AppServerSkillsRemoteExportRequestSchema = z
  .object({
    hazelnutId: z.string().min(1),
  })
  .passthrough();

interface ListRemoteSkillsRequestParameters {
  hazelnutScope: "example" | "workspace-shared" | "all-shared" | "personal";
  productSurface: "chatgpt" | "codex" | "api" | "atlas";
  enabled: boolean;
}

interface ExportRemoteSkillRequestParameters {
  hazelnutId: string;
}

export function buildListRemoteSkillsRequestParameters(
  options: ListRemoteSkillsOptions,
): ListRemoteSkillsRequestParameters {
  return AppServerSkillsRemoteListRequestSchema.parse({
    hazelnutScope: options.hazelnutScope,
    productSurface: options.productSurface,
    enabled: options.enabled,
  });
}

export function buildExportRemoteSkillRequestParameters(
  options: ExportRemoteSkillOptions,
): ExportRemoteSkillRequestParameters {
  return AppServerSkillsRemoteExportRequestSchema.parse({
    hazelnutId: options.hazelnutId,
  });
}
