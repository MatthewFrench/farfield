import {
  AppServerCollaborationModeListResponseSchema,
  AppServerListModelsResponseSchema,
} from "@farfield/protocol";
import { z } from "zod";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { request, requestInitWithOptions } from "@/Shared/Transport/FarfieldHttpTransport";

const COLLABORATION_MODES_ENDPOINT = "/api/collaboration-modes";
const MODELS_ENDPOINT = "/api/models";
const MODELS_LIST_LIMIT = 200;

const CollaborationModeListEnvelopeSchema = z
  .object({
    ok: z.literal(true),
  })
  .merge(AppServerCollaborationModeListResponseSchema)
  .transform(({ ok: _ok, ...collaborationModesResponse }) => collaborationModesResponse);
export type ApiCollaborationModesResponse = z.infer<
  typeof AppServerCollaborationModeListResponseSchema
>;

const ModelListEnvelopeSchema = z
  .object({
    ok: z.literal(true),
  })
  .merge(AppServerListModelsResponseSchema)
  .transform(({ ok: _ok, ...modelsResponse }) => modelsResponse);
export type ApiModelsResponse = z.infer<typeof AppServerListModelsResponseSchema>;

/**
 * Owns capability metadata reads for model and collaboration-mode selection.
 */
export async function listCollaborationModes(
  options?: ApiRequestOptions,
): Promise<ApiCollaborationModesResponse> {
  const data = await request(COLLABORATION_MODES_ENDPOINT, requestInitWithOptions(options));
  return CollaborationModeListEnvelopeSchema.parse(data);
}

export async function listModels(options?: ApiRequestOptions): Promise<ApiModelsResponse> {
  const data = await request(
    `${MODELS_ENDPOINT}?limit=${String(MODELS_LIST_LIMIT)}`,
    requestInitWithOptions(options),
  );
  return ModelListEnvelopeSchema.parse(data);
}
