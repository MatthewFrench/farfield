import {
  AppServerListThreadsResponseSchema,
  AppServerReadThreadResponseSchema,
  AppServerStartThreadResponseSchema
} from "@farfield/protocol";
import { z } from "zod";
import {
  AgentIdSchema,
  type AgentId,
  type ApiRequestOptions
} from "@/Shared/Contracts/ApiContracts";
import {
  applyRequestOptions,
  request,
  requestInitWithOptions
} from "@/Shared/Transport/FarfieldHttpTransport";

const THREADS_ROUTE_PATH = "/api/threads";
const LIST_THREADS_LIMIT_QUERY_KEY = "limit";
const LIST_THREADS_ARCHIVED_QUERY_KEY = "archived";
const LIST_THREADS_ALL_QUERY_KEY = "all";
const LIST_THREADS_MAX_PAGES_QUERY_KEY = "maxPages";
const LIST_THREADS_SORT_KEY_QUERY_KEY = "sortKey";
const LIST_THREADS_CURRENT_WORKING_DIRECTORY_QUERY_KEY = "cwd";
const READ_THREAD_INCLUDE_TURNS_QUERY_KEY = "includeTurns";
const BOOLEAN_TRUE_QUERY_VALUE = "true";
const BOOLEAN_FALSE_QUERY_VALUE = "false";
const THREAD_PROJECT_STATE_ACTIVE = "active";
const THREAD_PROJECT_STATE_REMOVED = "removed";
const NO_UNREAD_TURN_SIGNAL = null;

const ThreadProjectStateSchema = z.enum([
  THREAD_PROJECT_STATE_ACTIVE,
  THREAD_PROJECT_STATE_REMOVED
]);
const OptionalThreadListCursorSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => value ?? null);

// Thread-list responses come from heterogeneous adapters; parse permissive wire payloads once,
// then immediately normalize to a strict app-owned contract used by thread state owners.
const ThreadListItemWireSchema = AppServerListThreadsResponseSchema.shape.data.element.and(
  z.object({
    agentId: AgentIdSchema,
    source: z.string().optional(),
    removed: z.boolean().optional(),
    projectRemoved: z.boolean().optional(),
    projectState: ThreadProjectStateSchema.optional(),
    hasUnreadTurn: z.boolean().optional()
  }).passthrough()
);

const ThreadListItemContractSchema = z
  .object({
    id: z.string().min(1),
    preview: z.string(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    cwd: z.string().optional(),
    path: z.string().nullable().optional(),
    agentId: AgentIdSchema,
    source: z.string().optional(),
    hasUnreadTurn: z.union([z.boolean(), z.null()]),
    isProjectRemoved: z.boolean()
  })
  .strict();
type ThreadListItemWire = z.infer<typeof ThreadListItemWireSchema>;

function readThreadHasUnreadTurnSignal(value: boolean | undefined): boolean | null {
  return value ?? NO_UNREAD_TURN_SIGNAL;
}

function readThreadProjectRemovedState(value: ThreadListItemWire): boolean {
  return (
    value.projectRemoved === true
    || value.removed === true
    || value.projectState === THREAD_PROJECT_STATE_REMOVED
  );
}

const ThreadListItemSchema = ThreadListItemWireSchema.transform((value) => {
  return ThreadListItemContractSchema.parse({
    id: value.id,
    preview: value.preview,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    cwd: value.cwd,
    path: value.path,
    agentId: value.agentId,
    source: value.source,
    hasUnreadTurn: readThreadHasUnreadTurnSignal(value.hasUnreadTurn),
    isProjectRemoved: readThreadProjectRemovedState(value)
  });
});

const ThreadListResponseSchema = z
  .object({
    data: z.array(ThreadListItemSchema),
    nextCursor: OptionalThreadListCursorSchema,
    pages: z.number().int().nonnegative().optional(),
    truncated: z.boolean().optional()
  })
  .strict();
export type ApiThreadListResponse = z.infer<typeof ThreadListResponseSchema>;

export interface ApiListThreadsOptions extends ApiRequestOptions {
  limit: number;
  archived: boolean;
  all: boolean;
  maxPages: number;
  sortKey?: "created_at" | "updated_at";
  cwd?: string;
}

export type ApiThreadListItem = ApiThreadListResponse["data"][number];

const ThreadListEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(ThreadListResponseSchema)
  .strict()
  .transform(({ ok: _ok, ...threadListResponse }) => threadListResponse);

const ReadThreadResponseWithAgentSchema = AppServerReadThreadResponseSchema.extend({
  agentId: AgentIdSchema
});
export type ApiReadThreadResponse = z.infer<typeof ReadThreadResponseWithAgentSchema>;

export interface ApiReadThreadOptions extends ApiRequestOptions {
  includeTurns?: boolean;
}

const ReadThreadResponseEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(ReadThreadResponseWithAgentSchema)
  .strict()
  .transform(({ ok: _ok, ...readThreadResponse }) => readThreadResponse);

const CreateThreadResponseWireSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1),
    agentId: AgentIdSchema
  })
  .merge(AppServerStartThreadResponseSchema)
  .passthrough();

const CreateThreadResponseSchema = z
  .object({
    threadId: z.string().min(1),
    agentId: AgentIdSchema
  })
  .strict();
export type ApiCreateThreadResponse = z.infer<typeof CreateThreadResponseSchema>;

const ThreadMutationResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1)
  })
  .strict();

export interface ApiCreateThreadInput {
  agentId?: AgentId;
  cwd?: string;
  model?: string;
  modelProvider?: string;
  personality?: string;
  sandbox?: string;
  approvalPolicy?: string;
  ephemeral?: boolean;
}

function readBooleanQueryValue(value: boolean): string {
  return value ? BOOLEAN_TRUE_QUERY_VALUE : BOOLEAN_FALSE_QUERY_VALUE;
}

function buildThreadListSearchParameters(options: ApiListThreadsOptions): URLSearchParams {
  const parameters = new URLSearchParams();
  parameters.set(LIST_THREADS_LIMIT_QUERY_KEY, String(options.limit));
  parameters.set(LIST_THREADS_ARCHIVED_QUERY_KEY, readBooleanQueryValue(options.archived));
  parameters.set(LIST_THREADS_ALL_QUERY_KEY, readBooleanQueryValue(options.all));
  parameters.set(LIST_THREADS_MAX_PAGES_QUERY_KEY, String(options.maxPages));

  if (options.sortKey) {
    parameters.set(LIST_THREADS_SORT_KEY_QUERY_KEY, options.sortKey);
  }
  if (options.cwd) {
    parameters.set(LIST_THREADS_CURRENT_WORKING_DIRECTORY_QUERY_KEY, options.cwd);
  }

  return parameters;
}

function buildReadThreadRequestPath(threadId: string, includeTurns: boolean): string {
  const threadRoutePath = `${THREADS_ROUTE_PATH}/${encodeURIComponent(threadId)}`;
  const queryParameters = new URLSearchParams();
  queryParameters.set(READ_THREAD_INCLUDE_TURNS_QUERY_KEY, readBooleanQueryValue(includeTurns));
  return `${threadRoutePath}?${queryParameters.toString()}`;
}

export async function listThreads(options: ApiListThreadsOptions): Promise<ApiThreadListResponse> {
  const queryParameters = buildThreadListSearchParameters(options);
  const data = await request(
    `${THREADS_ROUTE_PATH}?${queryParameters.toString()}`,
    requestInitWithOptions(options)
  );
  return ThreadListEnvelopeSchema.parse(data);
}

export async function readThread(
  threadId: string,
  options?: ApiReadThreadOptions
): Promise<ApiReadThreadResponse> {
  const includeTurns = options?.includeTurns ?? true;
  const data = await request(
    buildReadThreadRequestPath(threadId, includeTurns),
    requestInitWithOptions(options)
  );
  return ReadThreadResponseEnvelopeSchema.parse(data);
}

export async function createThread(
  input?: ApiCreateThreadInput,
  options?: ApiRequestOptions
): Promise<ApiCreateThreadResponse> {
  const data = await request(
    THREADS_ROUTE_PATH,
    applyRequestOptions(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input ?? {})
      },
      options
    )
  );
  const parsedWireResponse = CreateThreadResponseWireSchema.parse(data);
  return CreateThreadResponseSchema.parse({
    threadId: parsedWireResponse.threadId,
    agentId: parsedWireResponse.agentId
  });
}

export async function archiveThread(threadId: string, options?: ApiRequestOptions): Promise<void> {
  const data = await request(
    `${THREADS_ROUTE_PATH}/${encodeURIComponent(threadId)}/archive`,
    applyRequestOptions(
      {
        method: "POST"
      },
      options
    )
  );
  ThreadMutationResponseSchema.parse(data);
}

export async function unarchiveThread(threadId: string, options?: ApiRequestOptions): Promise<void> {
  const data = await request(
    `${THREADS_ROUTE_PATH}/${encodeURIComponent(threadId)}/unarchive`,
    applyRequestOptions(
      {
        method: "POST"
      },
      options
    )
  );
  ThreadMutationResponseSchema.parse(data);
}
