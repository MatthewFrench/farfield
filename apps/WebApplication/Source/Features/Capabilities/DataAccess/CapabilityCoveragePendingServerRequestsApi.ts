import {
  type FarfieldPendingServerRequestsSnapshot,
  FarfieldPendingServerRequestsSnapshotSchema,
} from "@farfield/protocol";
import { type AgentId, type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { request, requestInitWithOptions } from "@/Shared/Transport/FarfieldHttpTransport";

const PENDING_SERVER_REQUESTS_ENDPOINT = "/api/server-requests/pending";

export interface ApiReadPendingServerRequestsOptions extends ApiRequestOptions {
  agentId?: AgentId;
}

export type ApiPendingServerRequestsResponse = FarfieldPendingServerRequestsSnapshot;

function buildReadPendingServerRequestsPath(options?: ApiReadPendingServerRequestsOptions): string {
  const params = new URLSearchParams();
  if (options?.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  const suffix = params.toString();
  return suffix.length > 0
    ? `${PENDING_SERVER_REQUESTS_ENDPOINT}?${suffix}`
    : PENDING_SERVER_REQUESTS_ENDPOINT;
}

export async function readPendingServerRequests(
  options?: ApiReadPendingServerRequestsOptions,
): Promise<ApiPendingServerRequestsResponse> {
  const data = await request(
    buildReadPendingServerRequestsPath(options),
    requestInitWithOptions(options),
  );
  return FarfieldPendingServerRequestsSnapshotSchema.parse(data);
}
