import {
  AppServerListThreadsResponseSchema,
  AppServerReadThreadResponseSchema,
  AppServerStartThreadResponseSchema,
} from "@farfield/protocol";
import { z } from "zod";
import {
  type AgentId,
  AgentIdSchema,
  type ApiRequestOptions,
} from "@/Shared/Contracts/ApiContracts";
import {
  applyRequestOptions,
  request,
  requestInitWithOptions,
} from "@/Shared/Transport/FarfieldHttpTransport";

/**
 * Owns thread endpoint boundary parsing and wire-to-contract normalization for thread data access.
 * Invariant: each API payload is parsed once at the boundary and then mapped into strict app-owned contracts.
 */
const THREADS_ROUTE_PATH = "/api/threads";
const LIST_THREADS_LIMIT_QUERY_KEY = "limit";
const LIST_THREADS_ARCHIVED_QUERY_KEY = "archived";
const LIST_THREADS_ALL_QUERY_KEY = "all";
const LIST_THREADS_MAX_PAGES_QUERY_KEY = "maxPages";
const LIST_THREADS_SORT_KEY_QUERY_KEY = "sortKey";
const LIST_THREADS_CURRENT_WORKING_DIRECTORY_QUERY_KEY = "cwd";
const LIST_THREADS_SINCE_UPDATED_AT_QUERY_KEY = "sinceUpdatedAt";
const READ_THREAD_INCLUDE_TURNS_QUERY_KEY = "includeTurns";
const BOOLEAN_TRUE_QUERY_VALUE = "true";
const BOOLEAN_FALSE_QUERY_VALUE = "false";
const THREAD_PROJECT_STATE_ACTIVE = "active";
const THREAD_PROJECT_STATE_REMOVED = "removed";
const THREAD_ARCHIVE_ROUTE_SEGMENT = "archive";
const THREAD_UNARCHIVE_ROUTE_SEGMENT = "unarchive";
const THREAD_FORK_ROUTE_SEGMENT = "fork";
const THREAD_NAME_ROUTE_SEGMENT = "name";
const THREAD_ROLLBACK_ROUTE_SEGMENT = "rollback";
const HTTP_POST_METHOD = "POST";
const APPLICATION_JSON_CONTENT_TYPE_HEADER_NAME = "Content-Type";
const APPLICATION_JSON_CONTENT_TYPE = "application/json";
const NO_UNREAD_TURN_SIGNAL = null;
const THREAD_NAME_MAXIMUM_LENGTH = 120;

const ThreadProjectStateSchema = z.enum([
  THREAD_PROJECT_STATE_ACTIVE,
  THREAD_PROJECT_STATE_REMOVED,
]);
const OptionalThreadListCursorSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => value ?? null);
const OptionalThreadListItemPathSchema = z.union([z.string(), z.null(), z.undefined()]);
const OptionalThreadDisplayNameSchema = z.union([z.string(), z.null(), z.undefined()]);
const OptionalThreadListSinceUpdatedAtSchema = z
  .union([z.number().int().nonnegative(), z.undefined()])
  .transform((value) => value ?? undefined);

// Thread-list responses come from heterogeneous adapters; parse permissive wire payloads once,
// then immediately normalize to a strict app-owned contract used by thread state owners.
const ThreadListItemWireSchema = AppServerListThreadsResponseSchema.shape.data.element.and(
  z
    .object({
      agentId: AgentIdSchema,
      source: z.string().optional(),
      removed: z.boolean().optional(),
      projectRemoved: z.boolean().optional(),
      projectState: ThreadProjectStateSchema.optional(),
      hasUnreadTurn: z.boolean().optional(),
      title: z.union([z.string(), z.null()]).optional(),
      threadName: z.union([z.string(), z.null()]).optional(),
      name: z.union([z.string(), z.null()]).optional(),
    })
    .passthrough(),
);

const ThreadListItemContractSchema = z
  .object({
    id: z.string().min(1),
    preview: z.string(),
    displayName: z.string().optional(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    cwd: z.string().optional(),
    path: z.string().nullable().optional(),
    agentId: AgentIdSchema,
    source: z.string().optional(),
    hasUnreadTurn: z.union([z.boolean(), z.null()]),
    isProjectRemoved: z.boolean(),
  })
  .strict();
type ThreadListItemWire = z.infer<typeof ThreadListItemWireSchema>;
type ThreadListItemContract = z.infer<typeof ThreadListItemContractSchema>;

function readThreadHasUnreadTurnSignal(value: boolean | undefined): boolean | null {
  return value ?? NO_UNREAD_TURN_SIGNAL;
}

function normalizeOptionalThreadDisplayName(value: string | null | undefined): string | undefined {
  const parsedValue = OptionalThreadDisplayNameSchema.parse(value);
  if (parsedValue === undefined || parsedValue === null) {
    return undefined;
  }
  const trimmedValue = parsedValue.trim();
  if (trimmedValue.length === 0) {
    return undefined;
  }
  return trimmedValue;
}

function readThreadDisplayName(value: ThreadListItemWire): string | undefined {
  const parsedThreadName = normalizeOptionalThreadDisplayName(value.threadName);
  if (parsedThreadName !== undefined) {
    return parsedThreadName;
  }
  const parsedTitle = normalizeOptionalThreadDisplayName(value.title);
  if (parsedTitle !== undefined) {
    return parsedTitle;
  }
  return normalizeOptionalThreadDisplayName(value.name);
}

// Legacy adapters expose project removal with multiple fields; treat any explicit removal signal as removed.
function readThreadProjectRemovedState(value: ThreadListItemWire): boolean {
  return (
    value.projectRemoved === true ||
    value.removed === true ||
    value.projectState === THREAD_PROJECT_STATE_REMOVED
  );
}

function mapThreadListItemWireToContract(value: ThreadListItemWire): ThreadListItemContract {
  return {
    id: value.id,
    preview: value.preview,
    displayName: readThreadDisplayName(value),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    cwd: value.cwd,
    path: OptionalThreadListItemPathSchema.parse(value.path),
    agentId: value.agentId,
    source: value.source,
    hasUnreadTurn: readThreadHasUnreadTurnSignal(value.hasUnreadTurn),
    isProjectRemoved: readThreadProjectRemovedState(value),
  };
}

const ThreadListItemSchema = ThreadListItemWireSchema.transform(
  mapThreadListItemWireToContract,
).pipe(ThreadListItemContractSchema);

const ThreadListSyncMetadataSchema = z
  .object({
    mode: z.enum(["full", "delta"]),
    sinceUpdatedAt: z.number().int().nonnegative().nullable(),
    snapshotUpdatedAt: z.number().int().nonnegative(),
  })
  .strict();

const ThreadListResponseSchema = z
  .object({
    data: z.array(ThreadListItemSchema),
    nextCursor: OptionalThreadListCursorSchema,
    pages: z.number().int().nonnegative().optional(),
    truncated: z.boolean().optional(),
    orderedThreadIds: z.array(z.string().min(1)).optional(),
    sync: ThreadListSyncMetadataSchema.optional(),
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
  sinceUpdatedAt?: number;
}

export type ApiThreadListItem = ApiThreadListResponse["data"][number];

const ThreadListEnvelopeSchema = z
  .object({
    ok: z.literal(true),
  })
  .merge(ThreadListResponseSchema)
  .strict()
  .transform(({ ok: _ok, ...threadListResponse }) => threadListResponse);

const ReadThreadResponseWithAgentSchema = AppServerReadThreadResponseSchema.extend({
  agentId: AgentIdSchema,
});
export type ApiReadThreadResponse = z.infer<typeof ReadThreadResponseWithAgentSchema>;

export interface ApiReadThreadOptions extends ApiRequestOptions {
  includeTurns?: boolean;
}

const ReadThreadResponseEnvelopeSchema = z
  .object({
    ok: z.literal(true),
  })
  .merge(ReadThreadResponseWithAgentSchema)
  .strict()
  .transform(({ ok: _ok, ...readThreadResponse }) => readThreadResponse);

const CreateThreadResponseWireSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1),
    agentId: AgentIdSchema,
  })
  .merge(AppServerStartThreadResponseSchema)
  .passthrough()
  .transform((response) => ({
    threadId: response.threadId,
    agentId: response.agentId,
  }));

const CreateThreadResponseSchema = z
  .object({
    threadId: z.string().min(1),
    agentId: AgentIdSchema,
  })
  .strict();
export type ApiCreateThreadResponse = z.infer<typeof CreateThreadResponseSchema>;

const ThreadMutationResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1),
  })
  .strict();

const ForkThreadResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1),
    sourceThreadId: z.string().min(1),
  })
  .strict()
  .transform(({ ok: _ok, ...forkThreadResponse }) => forkThreadResponse);

const SetThreadNameInputSchema = z
  .object({
    threadId: z.string().min(1),
    name: z.string().trim().min(1).max(THREAD_NAME_MAXIMUM_LENGTH),
  })
  .strict();
type SetThreadNameInput = z.infer<typeof SetThreadNameInputSchema>;
const SetThreadNameRequestBodySchema = SetThreadNameInputSchema.omit({
  threadId: true,
}).strict();
type SetThreadNameRequestBody = z.infer<typeof SetThreadNameRequestBodySchema>;

const RollbackThreadInputSchema = z
  .object({
    threadId: z.string().min(1),
    numTurns: z.number().int().min(1),
  })
  .strict();
type RollbackThreadInput = z.infer<typeof RollbackThreadInputSchema>;
const RollbackThreadRequestBodySchema = RollbackThreadInputSchema.omit({
  threadId: true,
}).strict();
type RollbackThreadRequestBody = z.infer<typeof RollbackThreadRequestBodySchema>;

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

type ThreadMutationRouteSegment =
  | typeof THREAD_ARCHIVE_ROUTE_SEGMENT
  | typeof THREAD_UNARCHIVE_ROUTE_SEGMENT
  | typeof THREAD_FORK_ROUTE_SEGMENT
  | typeof THREAD_NAME_ROUTE_SEGMENT
  | typeof THREAD_ROLLBACK_ROUTE_SEGMENT;

function readBooleanQueryValue(value: boolean): string {
  return value ? BOOLEAN_TRUE_QUERY_VALUE : BOOLEAN_FALSE_QUERY_VALUE;
}

function buildThreadMemberRequestPath(threadId: string): string {
  return `${THREADS_ROUTE_PATH}/${encodeURIComponent(threadId)}`;
}

function buildThreadMutationRequestPath(
  threadId: string,
  mutationRouteSegment: ThreadMutationRouteSegment,
): string {
  return `${buildThreadMemberRequestPath(threadId)}/${mutationRouteSegment}`;
}

function buildThreadListSearchParameters(options: ApiListThreadsOptions): URLSearchParams {
  const parameters = new URLSearchParams();
  parameters.set(LIST_THREADS_LIMIT_QUERY_KEY, String(options.limit));
  parameters.set(LIST_THREADS_ARCHIVED_QUERY_KEY, readBooleanQueryValue(options.archived));
  parameters.set(LIST_THREADS_ALL_QUERY_KEY, readBooleanQueryValue(options.all));
  parameters.set(LIST_THREADS_MAX_PAGES_QUERY_KEY, String(options.maxPages));

  if (options.sortKey !== undefined && options.sortKey.length > 0) {
    parameters.set(LIST_THREADS_SORT_KEY_QUERY_KEY, options.sortKey);
  }
  if (options.cwd !== undefined && options.cwd.length > 0) {
    parameters.set(LIST_THREADS_CURRENT_WORKING_DIRECTORY_QUERY_KEY, options.cwd);
  }
  const parsedSinceUpdatedAt = OptionalThreadListSinceUpdatedAtSchema.parse(options.sinceUpdatedAt);
  if (parsedSinceUpdatedAt !== undefined) {
    parameters.set(LIST_THREADS_SINCE_UPDATED_AT_QUERY_KEY, String(parsedSinceUpdatedAt));
  }

  return parameters;
}

function buildReadThreadRequestPath(threadId: string, includeTurns: boolean): string {
  const queryParameters = new URLSearchParams();
  queryParameters.set(READ_THREAD_INCLUDE_TURNS_QUERY_KEY, readBooleanQueryValue(includeTurns));
  return `${buildThreadMemberRequestPath(threadId)}?${queryParameters.toString()}`;
}

function buildThreadMutationRequestInit(options?: ApiRequestOptions): RequestInit {
  return applyRequestOptions(
    {
      method: HTTP_POST_METHOD,
    },
    options,
  );
}

function buildThreadMutationJsonRequestInit(
  body: object,
  options?: ApiRequestOptions,
): RequestInit {
  return applyRequestOptions(
    {
      method: HTTP_POST_METHOD,
      headers: {
        [APPLICATION_JSON_CONTENT_TYPE_HEADER_NAME]: APPLICATION_JSON_CONTENT_TYPE,
      },
      body: JSON.stringify(body),
    },
    options,
  );
}

function buildCreateThreadRequestInit(
  input?: ApiCreateThreadInput,
  options?: ApiRequestOptions,
): RequestInit {
  return applyRequestOptions(
    {
      method: HTTP_POST_METHOD,
      headers: {
        [APPLICATION_JSON_CONTENT_TYPE_HEADER_NAME]: APPLICATION_JSON_CONTENT_TYPE,
      },
      body: JSON.stringify(input ?? {}),
    },
    options,
  );
}

async function runThreadMutation(
  threadId: string,
  mutationRouteSegment: ThreadMutationRouteSegment,
  options?: ApiRequestOptions,
): Promise<void> {
  const data = await request(
    buildThreadMutationRequestPath(threadId, mutationRouteSegment),
    buildThreadMutationRequestInit(options),
  );
  ThreadMutationResponseSchema.parse(data);
}

export async function listThreads(options: ApiListThreadsOptions): Promise<ApiThreadListResponse> {
  const queryParameters = buildThreadListSearchParameters(options);
  const data = await request(
    `${THREADS_ROUTE_PATH}?${queryParameters.toString()}`,
    requestInitWithOptions(options),
  );
  return ThreadListEnvelopeSchema.parse(data);
}

export async function readThread(
  threadId: string,
  options?: ApiReadThreadOptions,
): Promise<ApiReadThreadResponse> {
  const includeTurns = options?.includeTurns ?? true;
  const data = await request(
    buildReadThreadRequestPath(threadId, includeTurns),
    requestInitWithOptions(options),
  );
  return ReadThreadResponseEnvelopeSchema.parse(data);
}

export async function createThread(
  input?: ApiCreateThreadInput,
  options?: ApiRequestOptions,
): Promise<ApiCreateThreadResponse> {
  const data = await request(THREADS_ROUTE_PATH, buildCreateThreadRequestInit(input, options));
  return CreateThreadResponseSchema.parse(CreateThreadResponseWireSchema.parse(data));
}

export async function archiveThread(threadId: string, options?: ApiRequestOptions): Promise<void> {
  await runThreadMutation(threadId, THREAD_ARCHIVE_ROUTE_SEGMENT, options);
}

export async function unarchiveThread(
  threadId: string,
  options?: ApiRequestOptions,
): Promise<void> {
  await runThreadMutation(threadId, THREAD_UNARCHIVE_ROUTE_SEGMENT, options);
}

export interface ApiForkThreadResponse {
  threadId: string;
  sourceThreadId: string;
}

export async function forkThread(
  threadId: string,
  options?: ApiRequestOptions,
): Promise<ApiForkThreadResponse> {
  const data = await request(
    buildThreadMutationRequestPath(threadId, THREAD_FORK_ROUTE_SEGMENT),
    buildThreadMutationRequestInit(options),
  );
  return ForkThreadResponseSchema.parse(data);
}

export async function setThreadName(
  input: SetThreadNameInput,
  options?: ApiRequestOptions,
): Promise<void> {
  const parsedInput = SetThreadNameInputSchema.parse(input);
  const parsedRequestBody: SetThreadNameRequestBody = SetThreadNameRequestBodySchema.parse({
    name: parsedInput.name,
  });

  const data = await request(
    buildThreadMutationRequestPath(parsedInput.threadId, THREAD_NAME_ROUTE_SEGMENT),
    buildThreadMutationJsonRequestInit(parsedRequestBody, options),
  );
  ThreadMutationResponseSchema.parse(data);
}

export async function rollbackThread(
  input: RollbackThreadInput,
  options?: ApiRequestOptions,
): Promise<void> {
  const parsedInput = RollbackThreadInputSchema.parse(input);
  const parsedRequestBody: RollbackThreadRequestBody = RollbackThreadRequestBodySchema.parse({
    numTurns: parsedInput.numTurns,
  });

  const data = await request(
    buildThreadMutationRequestPath(parsedInput.threadId, THREAD_ROLLBACK_ROUTE_SEGMENT),
    buildThreadMutationJsonRequestInit(parsedRequestBody, options),
  );
  ThreadMutationResponseSchema.parse(data);
}
