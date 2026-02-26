import {
  AppServerCollaborationModeListResponseSchema,
  AppServerListModelsResponseSchema,
  FarfieldHealthResponseSchema
} from "@farfield/protocol";
import { z } from "zod";
import {
  AgentIdSchema,
  type AgentId,
  type ApiRequestOptions
} from "@/Shared/Contracts/ApiContracts";
import {
  request,
  requestInitWithOptions
} from "@/Shared/Transport/FarfieldHttpTransport";

const HEALTH_ENDPOINT = "/api/health";
const AGENTS_ENDPOINT = "/api/agents";
const CONFIG_DEFAULTS_ENDPOINT = "/api/config/defaults";
const COLLABORATION_MODES_ENDPOINT = "/api/collaboration-modes";
const MODELS_ENDPOINT = "/api/models";
const MODELS_LIST_LIMIT = 200;

const HealthResponseSchema = FarfieldHealthResponseSchema;
export type ApiHealthResponse = z.infer<typeof HealthResponseSchema>;

const ReasoningEffortSchema = z.enum(["none", "minimal", "low", "medium", "high", "xhigh"]);
export type ApiReasoningEffort = z.infer<typeof ReasoningEffortSchema>;

const AgentCapabilitiesSchema = z
  .object({
    canListModels: z.boolean(),
    canListCollaborationModes: z.boolean(),
    canSetCollaborationMode: z.boolean(),
    canSubmitUserInput: z.boolean(),
    canReadLiveState: z.boolean(),
    canReadStreamEvents: z.boolean()
  })
  .strict();
export type ApiAgentCapabilities = z.infer<typeof AgentCapabilitiesSchema>;

const AgentsResponseSchema = z
  .object({
    ok: z.literal(true),
    agents: z.array(
      z.object({
        id: AgentIdSchema,
        label: z.string(),
        enabled: z.boolean(),
        connected: z.boolean(),
        capabilities: AgentCapabilitiesSchema,
        projectDirectories: z.array(z.string())
      })
    ),
    defaultAgentId: AgentIdSchema
  })
  .strict();
export type ApiAgentsResponse = z.infer<typeof AgentsResponseSchema>;

const ConfigDefaultsResponseSchema = z
  .object({
    ok: z.literal(true),
    agentId: z.union([AgentIdSchema, z.null()]),
    model: z.union([z.string(), z.null()]),
    reasoningEffort: z.union([ReasoningEffortSchema, z.null()])
  })
  .strict();
export type ApiConfigDefaultsResponse = z.infer<typeof ConfigDefaultsResponseSchema>;

export interface ApiConfigDefaultsOptions extends ApiRequestOptions {
  agentId?: AgentId;
}

function readConfigDefaultsPath(options?: ApiConfigDefaultsOptions): string {
  const params = new URLSearchParams();
  if (options?.agentId) {
    params.set("agentId", options.agentId);
  }
  const suffix = params.toString();
  return suffix.length > 0 ? `${CONFIG_DEFAULTS_ENDPOINT}?${suffix}` : CONFIG_DEFAULTS_ENDPOINT;
}

const CollaborationModeListEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(AppServerCollaborationModeListResponseSchema)
  .transform(({ ok: _ok, ...collaborationModesResponse }) => collaborationModesResponse);
export type ApiCollaborationModesResponse = z.infer<typeof AppServerCollaborationModeListResponseSchema>;

const ModelListEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(AppServerListModelsResponseSchema)
  .transform(({ ok: _ok, ...modelsResponse }) => modelsResponse);
export type ApiModelsResponse = z.infer<typeof AppServerListModelsResponseSchema>;

export async function getHealth(options?: ApiRequestOptions): Promise<ApiHealthResponse> {
  return HealthResponseSchema.parse(await request(HEALTH_ENDPOINT, requestInitWithOptions(options)));
}

export async function listAgents(options?: ApiRequestOptions): Promise<ApiAgentsResponse> {
  return AgentsResponseSchema.parse(await request(AGENTS_ENDPOINT, requestInitWithOptions(options)));
}

export async function getConfigDefaults(
  options?: ApiConfigDefaultsOptions
): Promise<ApiConfigDefaultsResponse> {
  return ConfigDefaultsResponseSchema.parse(
    await request(readConfigDefaultsPath(options), requestInitWithOptions(options))
  );
}

export async function listCollaborationModes(
  options?: ApiRequestOptions
): Promise<ApiCollaborationModesResponse> {
  const data = await request(COLLABORATION_MODES_ENDPOINT, requestInitWithOptions(options));
  return CollaborationModeListEnvelopeSchema.parse(data);
}

export async function listModels(options?: ApiRequestOptions): Promise<ApiModelsResponse> {
  const data = await request(
    `${MODELS_ENDPOINT}?limit=${String(MODELS_LIST_LIMIT)}`,
    requestInitWithOptions(options)
  );
  return ModelListEnvelopeSchema.parse(data);
}
