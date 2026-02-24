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
  return HealthResponseSchema.parse(await request("/api/health", requestInitWithOptions(options)));
}

export async function listAgents(options?: ApiRequestOptions): Promise<ApiAgentsResponse> {
  return AgentsResponseSchema.parse(await request("/api/agents", requestInitWithOptions(options)));
}

export async function getConfigDefaults(
  options?: ApiConfigDefaultsOptions
): Promise<ApiConfigDefaultsResponse> {
  const params = new URLSearchParams();
  if (options?.agentId) {
    params.set("agentId", options.agentId);
  }
  const suffix = params.toString();
  return ConfigDefaultsResponseSchema.parse(
    await request(
      suffix.length > 0 ? `/api/config/defaults?${suffix}` : "/api/config/defaults",
      requestInitWithOptions(options)
    )
  );
}

export async function listCollaborationModes(
  options?: ApiRequestOptions
): Promise<ApiCollaborationModesResponse> {
  const data = await request("/api/collaboration-modes", requestInitWithOptions(options));
  return CollaborationModeListEnvelopeSchema.parse(data);
}

export async function listModels(options?: ApiRequestOptions): Promise<ApiModelsResponse> {
  const data = await request("/api/models?limit=200", requestInitWithOptions(options));
  return ModelListEnvelopeSchema.parse(data);
}
