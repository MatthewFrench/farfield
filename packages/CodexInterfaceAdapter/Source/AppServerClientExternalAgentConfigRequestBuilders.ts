import { z } from "zod";
import type {
  ExternalAgentConfigDetectOptions,
  ExternalAgentConfigImportOptions,
} from "./AppServerClient.js";

const AppServerExternalAgentConfigMigrationItemTypeSchema = z.enum([
  "AGENTS_MD",
  "CONFIG",
  "SKILLS",
  "MCP_SERVER_CONFIG",
]);
const AppServerExternalAgentConfigMigrationItemSchema = z
  .object({
    itemType: AppServerExternalAgentConfigMigrationItemTypeSchema,
    description: z.string().min(1),
    cwd: z.string().min(1).nullable().optional(),
  })
  .passthrough();
const AppServerExternalAgentConfigDetectRequestSchema = z
  .object({
    includeHome: z.boolean().optional(),
    cwds: z.array(z.string().min(1)).optional(),
  })
  .passthrough();
const AppServerExternalAgentConfigImportRequestSchema = z
  .object({
    migrationItems: z.array(AppServerExternalAgentConfigMigrationItemSchema).min(1),
  })
  .passthrough();

interface ExternalAgentConfigMigrationItemRequestParameters {
  itemType: "AGENTS_MD" | "CONFIG" | "SKILLS" | "MCP_SERVER_CONFIG";
  description: string;
  cwd?: string | null | undefined;
}

interface ExternalAgentConfigDetectRequestParameters {
  includeHome?: boolean | undefined;
  cwds?: string[] | undefined;
}

interface ExternalAgentConfigImportRequestParameters {
  migrationItems: ExternalAgentConfigMigrationItemRequestParameters[];
}

export function buildExternalAgentConfigDetectRequestParameters(
  options: ExternalAgentConfigDetectOptions,
): ExternalAgentConfigDetectRequestParameters {
  return AppServerExternalAgentConfigDetectRequestSchema.parse({
    includeHome: options.includeHome,
    ...(options.cwds !== undefined ? { cwds: options.cwds } : {}),
  });
}

export function buildExternalAgentConfigImportRequestParameters(
  options: ExternalAgentConfigImportOptions,
): ExternalAgentConfigImportRequestParameters {
  return AppServerExternalAgentConfigImportRequestSchema.parse({
    migrationItems: options.migrationItems.map((migrationItem) => ({
      itemType: migrationItem.itemType,
      description: migrationItem.description,
      ...(migrationItem.cwd !== undefined ? { cwd: migrationItem.cwd } : {}),
    })),
  });
}
