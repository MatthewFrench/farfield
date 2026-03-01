import { z } from "zod";
import { type AgentId, type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { request, requestInitWithOptions } from "@/Shared/Transport/FarfieldHttpTransport";

const EXTERNAL_AGENT_CONFIG_DETECT_ENDPOINT = "/api/external-agent-config/detect";
const EXTERNAL_AGENT_CONFIG_IMPORT_ENDPOINT = "/api/external-agent-config/import";

const ExternalAgentConfigMigrationItemTypeSchema = z.enum([
  "AGENTS_MD",
  "CONFIG",
  "SKILLS",
  "MCP_SERVER_CONFIG",
]);
export type ApiExternalAgentConfigMigrationItemType = z.infer<
  typeof ExternalAgentConfigMigrationItemTypeSchema
>;

const ExternalAgentConfigMigrationItemSchema = z
  .object({
    itemType: ExternalAgentConfigMigrationItemTypeSchema,
    description: z.string().min(1),
    cwd: z.string().min(1).nullable(),
  })
  .strict();
export type ApiExternalAgentConfigMigrationItem = z.infer<
  typeof ExternalAgentConfigMigrationItemSchema
>;

export interface ApiExternalAgentConfigDetectOptions extends ApiRequestOptions {
  agentId?: AgentId;
  includeHome: boolean;
  cwds?: string[];
}

export interface ApiExternalAgentConfigImportOptions extends ApiRequestOptions {
  agentId?: AgentId;
  migrationItems: ApiExternalAgentConfigMigrationItem[];
}

const ExternalAgentConfigDetectInputSchema = z
  .object({
    includeHome: z.boolean(),
    cwds: z.array(z.string().min(1)).optional(),
  })
  .strict();
const ExternalAgentConfigImportInputSchema = z
  .object({
    migrationItems: z.array(ExternalAgentConfigMigrationItemSchema).min(1),
  })
  .strict();

const ExternalAgentConfigDetectResponseSchema = z
  .object({
    ok: z.literal(true),
    items: z.array(ExternalAgentConfigMigrationItemSchema),
  })
  .strict();
export type ApiExternalAgentConfigDetectResponse = z.infer<
  typeof ExternalAgentConfigDetectResponseSchema
>;

const ExternalAgentConfigImportResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .strict();
export type ApiExternalAgentConfigImportResponse = z.infer<
  typeof ExternalAgentConfigImportResponseSchema
>;

function readExternalAgentConfigDetectPath(options: ApiExternalAgentConfigDetectOptions): string {
  const parsedInput = ExternalAgentConfigDetectInputSchema.parse({
    includeHome: options.includeHome,
    ...(options.cwds !== undefined ? { cwds: options.cwds } : {}),
  });
  const params = new URLSearchParams();
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  params.set("includeHome", parsedInput.includeHome ? "true" : "false");
  if (parsedInput.cwds !== undefined) {
    for (const cwd of parsedInput.cwds) {
      params.append("cwd", cwd);
    }
  }
  return `${EXTERNAL_AGENT_CONFIG_DETECT_ENDPOINT}?${params.toString()}`;
}

function readExternalAgentConfigImportPath(options: ApiExternalAgentConfigImportOptions): string {
  const parsedInput = ExternalAgentConfigImportInputSchema.parse({
    migrationItems: options.migrationItems.map((migrationItem) => ({
      itemType: migrationItem.itemType,
      description: migrationItem.description,
      cwd: migrationItem.cwd,
    })),
  });
  const params = new URLSearchParams();
  params.set("migrationItems", JSON.stringify(parsedInput.migrationItems));
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  return `${EXTERNAL_AGENT_CONFIG_IMPORT_ENDPOINT}?${params.toString()}`;
}

export async function detectExternalAgentConfig(
  options: ApiExternalAgentConfigDetectOptions,
): Promise<ApiExternalAgentConfigDetectResponse> {
  return ExternalAgentConfigDetectResponseSchema.parse(
    await request(readExternalAgentConfigDetectPath(options), requestInitWithOptions(options)),
  );
}

export async function importExternalAgentConfig(
  options: ApiExternalAgentConfigImportOptions,
): Promise<ApiExternalAgentConfigImportResponse> {
  return ExternalAgentConfigImportResponseSchema.parse(
    await request(readExternalAgentConfigImportPath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}
