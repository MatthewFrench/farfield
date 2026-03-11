import { z } from "zod";
import {
  type AgentId,
  AgentIdSchema,
  type ApiRequestOptions,
} from "@/Shared/Contracts/ApiContracts";
import { request, requestInitWithOptions } from "@/Shared/Transport/FarfieldHttpTransport";

const THREAD_RUNTIME_STATUSES_ENDPOINT = "/api/threads/runtime-statuses";
const THREAD_IDENTIFIER_QUERY_PARAMETER = "threadId";
const AGENT_IDENTIFIER_QUERY_PARAMETER = "agentId";
const THREAD_RUNTIME_STATUS_TYPE_ACTIVE = "active";
const THREAD_RUNTIME_ACTIVE_FLAG_WAITING_ON_APPROVAL = "waitingOnApproval";
const THREAD_RUNTIME_ACTIVE_FLAG_WAITING_ON_USER_INPUT = "waitingOnUserInput";
const THREAD_RUNTIME_STATUS_THREAD_IDENTIFIER_MAXIMUM_COUNT = 200;

const ThreadRuntimeStatusReadInputSchema = z
  .object({
    agentId: AgentIdSchema,
    threadIds: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(THREAD_RUNTIME_STATUS_THREAD_IDENTIFIER_MAXIMUM_COUNT),
  })
  .strict();

const ThreadRuntimeActiveFlagSchema = z.union([
  z.literal(THREAD_RUNTIME_ACTIVE_FLAG_WAITING_ON_APPROVAL),
  z.literal(THREAD_RUNTIME_ACTIVE_FLAG_WAITING_ON_USER_INPUT),
]);

const ThreadRuntimeStatusEntrySchema = z
  .object({
    threadId: z.string().trim().min(1),
    statusType: z.literal(THREAD_RUNTIME_STATUS_TYPE_ACTIVE),
    activeFlags: z.array(ThreadRuntimeActiveFlagSchema),
    receivedAtMilliseconds: z.number().int().nonnegative(),
  })
  .strict();

const ThreadRuntimeStatusesResponseSchema = z
  .object({
    ok: z.literal(true),
    statuses: z.array(ThreadRuntimeStatusEntrySchema),
  })
  .strict();

export interface ApiReadThreadRuntimeStatusesInput extends ApiRequestOptions {
  agentId: AgentId;
  threadIds: readonly string[];
}

export type ApiThreadRuntimeStatusEntry = z.infer<typeof ThreadRuntimeStatusEntrySchema>;

export interface ApiReadThreadRuntimeStatusesResponse {
  statuses: ApiThreadRuntimeStatusEntry[];
}

function buildThreadRuntimeStatusesPath(input: ApiReadThreadRuntimeStatusesInput): string {
  const parsedInput = ThreadRuntimeStatusReadInputSchema.parse({
    agentId: input.agentId,
    threadIds: [...input.threadIds],
  });
  const searchParameters = new URLSearchParams();
  searchParameters.set(AGENT_IDENTIFIER_QUERY_PARAMETER, parsedInput.agentId);
  for (const threadId of parsedInput.threadIds) {
    searchParameters.append(THREAD_IDENTIFIER_QUERY_PARAMETER, threadId);
  }
  return `${THREAD_RUNTIME_STATUSES_ENDPOINT}?${searchParameters.toString()}`;
}

export async function readThreadRuntimeStatuses(
  input: ApiReadThreadRuntimeStatusesInput,
): Promise<ApiReadThreadRuntimeStatusesResponse> {
  const response = await request(
    buildThreadRuntimeStatusesPath(input),
    requestInitWithOptions(input),
  );
  const parsedResponse = ThreadRuntimeStatusesResponseSchema.parse(response);
  return {
    statuses: parsedResponse.statuses,
  };
}
