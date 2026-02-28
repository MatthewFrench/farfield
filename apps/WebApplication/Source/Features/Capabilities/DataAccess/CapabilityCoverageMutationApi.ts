import { z } from "zod";
import { type AgentId, type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { request, requestInitWithOptions } from "@/Shared/Transport/FarfieldHttpTransport";

const MCP_SERVER_OAUTH_LOGIN_ENDPOINT = "/api/mcp-servers/oauth/login";
const SKILLS_CONFIG_WRITE_ENDPOINT = "/api/skills/config/write";

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
