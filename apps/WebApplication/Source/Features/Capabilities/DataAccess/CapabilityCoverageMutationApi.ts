import { JsonValueSchema } from "@farfield/protocol";
import { z } from "zod";
import { type AgentId, type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { request, requestInitWithOptions } from "@/Shared/Transport/FarfieldHttpTransport";

const MCP_SERVER_OAUTH_LOGIN_ENDPOINT = "/api/mcp-servers/oauth/login";
const CONFIG_BATCH_WRITE_ENDPOINT = "/api/config/batch/write";
const CONFIG_VALUE_WRITE_ENDPOINT = "/api/config/value/write";
const SKILLS_CONFIG_WRITE_ENDPOINT = "/api/skills/config/write";
const SKILLS_REMOTE_LIST_ENDPOINT = "/api/skills/remote/list";
const SKILLS_REMOTE_EXPORT_ENDPOINT = "/api/skills/remote/export";
const COMMAND_EXEC_ENDPOINT = "/api/commands/exec";

export interface ApiMcpServerOauthLoginOptions extends ApiRequestOptions {
  agentId?: AgentId;
  name: string;
  scopes?: string[];
  timeoutSeconds?: number;
}

export interface ApiSkillsConfigWriteOptions extends ApiRequestOptions {
  agentId?: AgentId;
  path: string;
  enabled: boolean;
}

const ConfigWriteMergeStrategySchema = z.enum(["replace", "upsert"]);
export type ApiConfigWriteMergeStrategy = z.infer<typeof ConfigWriteMergeStrategySchema>;

export interface ApiConfigValueWriteOptions extends ApiRequestOptions {
  agentId?: AgentId;
  keyPath: string;
  value: z.infer<typeof JsonValueSchema>;
  mergeStrategy: ApiConfigWriteMergeStrategy;
  filePath?: string;
  expectedVersion?: string;
}

export interface ApiConfigBatchWriteEdit {
  keyPath: string;
  value: z.infer<typeof JsonValueSchema>;
  mergeStrategy: ApiConfigWriteMergeStrategy;
}

export interface ApiConfigBatchWriteOptions extends ApiRequestOptions {
  agentId?: AgentId;
  edits: ApiConfigBatchWriteEdit[];
  filePath?: string;
  expectedVersion?: string;
}

const RemoteSkillsHazelnutScopeSchema = z.enum([
  "example",
  "workspace-shared",
  "all-shared",
  "personal",
]);
export type ApiRemoteSkillsHazelnutScope = z.infer<typeof RemoteSkillsHazelnutScopeSchema>;

const RemoteSkillsProductSurfaceSchema = z.enum(["chatgpt", "codex", "api", "atlas"]);
export type ApiRemoteSkillsProductSurface = z.infer<typeof RemoteSkillsProductSurfaceSchema>;

export interface ApiListRemoteSkillsOptions extends ApiRequestOptions {
  agentId?: AgentId;
  hazelnutScope: ApiRemoteSkillsHazelnutScope;
  productSurface: ApiRemoteSkillsProductSurface;
  enabled: boolean;
}

export interface ApiExportRemoteSkillOptions extends ApiRequestOptions {
  agentId?: AgentId;
  hazelnutId: string;
}

export interface ApiCommandExecutionOptions extends ApiRequestOptions {
  agentId?: AgentId;
  command: string[];
  timeoutMs?: number;
  cwd?: string;
}

const McpServerOauthLoginResponseSchema = z
  .object({
    ok: z.literal(true),
    authorizationUrl: z.string().min(1),
  })
  .strict();
export type ApiMcpServerOauthLoginResponse = z.infer<typeof McpServerOauthLoginResponseSchema>;

const SkillsConfigWriteResponseSchema = z
  .object({
    ok: z.literal(true),
    effectiveEnabled: z.boolean(),
  })
  .strict();
export type ApiSkillsConfigWriteResponse = z.infer<typeof SkillsConfigWriteResponseSchema>;

const ConfigValueWriteResponseSchema = z
  .object({
    ok: z.literal(true),
    status: z.enum(["ok", "okOverridden"]),
    version: z.string().min(1),
    filePath: z.string().min(1),
    overriddenMetadata: z
      .object({
        message: z.string().min(1),
        overridingLayer: JsonValueSchema,
        effectiveValue: JsonValueSchema,
      })
      .nullable(),
  })
  .strict();
export type ApiConfigValueWriteResponse = z.infer<typeof ConfigValueWriteResponseSchema>;
export type ApiConfigBatchWriteResponse = z.infer<typeof ConfigValueWriteResponseSchema>;

const RemoteSkillSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
  })
  .strict();
export type ApiRemoteSkillSummary = z.infer<typeof RemoteSkillSummarySchema>;

const RemoteSkillsListResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(RemoteSkillSummarySchema),
  })
  .strict();
export type ApiRemoteSkillsListResponse = z.infer<typeof RemoteSkillsListResponseSchema>;

const RemoteSkillExportResponseSchema = z
  .object({
    ok: z.literal(true),
    id: z.string().min(1),
    path: z.string().min(1),
  })
  .strict();
export type ApiRemoteSkillExportResponse = z.infer<typeof RemoteSkillExportResponseSchema>;

const CommandExecutionResponseSchema = z
  .object({
    ok: z.literal(true),
    exitCode: z.number().int(),
    stdout: z.string(),
    stderr: z.string(),
  })
  .strict();
export type ApiCommandExecutionResponse = z.infer<typeof CommandExecutionResponseSchema>;

const CommandExecutionInputSchema = z
  .object({
    command: z.array(z.string().min(1)).min(1),
    timeoutMs: z.number().int().nonnegative().optional(),
    cwd: z.string().min(1).optional(),
  })
  .strict();

const ConfigValueWriteInputSchema = z
  .object({
    keyPath: z.string().min(1),
    value: JsonValueSchema,
    mergeStrategy: ConfigWriteMergeStrategySchema,
    filePath: z.string().min(1).optional(),
    expectedVersion: z.string().min(1).optional(),
  })
  .strict();

const ConfigBatchWriteInputSchema = z
  .object({
    edits: z
      .array(
        z
          .object({
            keyPath: z.string().min(1),
            value: JsonValueSchema,
            mergeStrategy: ConfigWriteMergeStrategySchema,
          })
          .strict(),
      )
      .min(1),
    filePath: z.string().min(1).optional(),
    expectedVersion: z.string().min(1).optional(),
  })
  .strict();

function readMcpServerOauthLoginPath(options: ApiMcpServerOauthLoginOptions): string {
  const params = new URLSearchParams();
  params.set("name", options.name);
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  if (options.scopes !== undefined && options.scopes.length > 0) {
    params.set("scopes", options.scopes.join(","));
  }
  if (options.timeoutSeconds !== undefined) {
    params.set("timeoutSeconds", String(options.timeoutSeconds));
  }
  return `${MCP_SERVER_OAUTH_LOGIN_ENDPOINT}?${params.toString()}`;
}

function readSkillsConfigWritePath(options: ApiSkillsConfigWriteOptions): string {
  const params = new URLSearchParams();
  params.set("path", options.path);
  params.set("enabled", options.enabled ? "true" : "false");
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  return `${SKILLS_CONFIG_WRITE_ENDPOINT}?${params.toString()}`;
}

function readConfigValueWritePath(options: ApiConfigValueWriteOptions): string {
  const parsedInput = ConfigValueWriteInputSchema.parse({
    keyPath: options.keyPath,
    value: options.value,
    mergeStrategy: options.mergeStrategy,
    ...(options.filePath !== undefined ? { filePath: options.filePath } : {}),
    ...(options.expectedVersion !== undefined ? { expectedVersion: options.expectedVersion } : {}),
  });
  const params = new URLSearchParams();
  params.set("keyPath", parsedInput.keyPath);
  params.set("value", JSON.stringify(parsedInput.value));
  params.set("mergeStrategy", parsedInput.mergeStrategy);
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  if (parsedInput.filePath !== undefined) {
    params.set("filePath", parsedInput.filePath);
  }
  if (parsedInput.expectedVersion !== undefined) {
    params.set("expectedVersion", parsedInput.expectedVersion);
  }
  return `${CONFIG_VALUE_WRITE_ENDPOINT}?${params.toString()}`;
}

function readConfigBatchWritePath(options: ApiConfigBatchWriteOptions): string {
  const parsedInput = ConfigBatchWriteInputSchema.parse({
    edits: options.edits.map((edit) => ({
      keyPath: edit.keyPath,
      value: edit.value,
      mergeStrategy: edit.mergeStrategy,
    })),
    ...(options.filePath !== undefined ? { filePath: options.filePath } : {}),
    ...(options.expectedVersion !== undefined ? { expectedVersion: options.expectedVersion } : {}),
  });
  const params = new URLSearchParams();
  params.set("edits", JSON.stringify(parsedInput.edits));
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  if (parsedInput.filePath !== undefined) {
    params.set("filePath", parsedInput.filePath);
  }
  if (parsedInput.expectedVersion !== undefined) {
    params.set("expectedVersion", parsedInput.expectedVersion);
  }
  return `${CONFIG_BATCH_WRITE_ENDPOINT}?${params.toString()}`;
}

function readRemoteSkillsListPath(options: ApiListRemoteSkillsOptions): string {
  const params = new URLSearchParams();
  params.set("hazelnutScope", options.hazelnutScope);
  params.set("productSurface", options.productSurface);
  params.set("enabled", options.enabled ? "true" : "false");
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  return `${SKILLS_REMOTE_LIST_ENDPOINT}?${params.toString()}`;
}

function readRemoteSkillExportPath(options: ApiExportRemoteSkillOptions): string {
  const params = new URLSearchParams();
  params.set("hazelnutId", options.hazelnutId);
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  return `${SKILLS_REMOTE_EXPORT_ENDPOINT}?${params.toString()}`;
}

function readCommandExecutionPath(options: ApiCommandExecutionOptions): string {
  const parsedInput = CommandExecutionInputSchema.parse({
    command: options.command,
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
  });
  const params = new URLSearchParams();
  for (const commandValue of parsedInput.command) {
    params.append("command", commandValue);
  }
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  if (parsedInput.timeoutMs !== undefined) {
    params.set("timeoutMs", String(parsedInput.timeoutMs));
  }
  if (parsedInput.cwd !== undefined) {
    params.set("cwd", parsedInput.cwd);
  }
  return `${COMMAND_EXEC_ENDPOINT}?${params.toString()}`;
}

export async function startMcpServerOauthLogin(
  options: ApiMcpServerOauthLoginOptions,
): Promise<ApiMcpServerOauthLoginResponse> {
  return McpServerOauthLoginResponseSchema.parse(
    await request(readMcpServerOauthLoginPath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}

export async function writeSkillsConfig(
  options: ApiSkillsConfigWriteOptions,
): Promise<ApiSkillsConfigWriteResponse> {
  return SkillsConfigWriteResponseSchema.parse(
    await request(readSkillsConfigWritePath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}

export async function writeConfigValue(
  options: ApiConfigValueWriteOptions,
): Promise<ApiConfigValueWriteResponse> {
  return ConfigValueWriteResponseSchema.parse(
    await request(readConfigValueWritePath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}

export async function writeConfigBatch(
  options: ApiConfigBatchWriteOptions,
): Promise<ApiConfigBatchWriteResponse> {
  return ConfigValueWriteResponseSchema.parse(
    await request(readConfigBatchWritePath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}

export async function listRemoteSkills(
  options: ApiListRemoteSkillsOptions,
): Promise<ApiRemoteSkillsListResponse> {
  return RemoteSkillsListResponseSchema.parse(
    await request(readRemoteSkillsListPath(options), requestInitWithOptions(options)),
  );
}

export async function exportRemoteSkill(
  options: ApiExportRemoteSkillOptions,
): Promise<ApiRemoteSkillExportResponse> {
  return RemoteSkillExportResponseSchema.parse(
    await request(readRemoteSkillExportPath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}

export async function executeCommand(
  options: ApiCommandExecutionOptions,
): Promise<ApiCommandExecutionResponse> {
  return CommandExecutionResponseSchema.parse(
    await request(readCommandExecutionPath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}
