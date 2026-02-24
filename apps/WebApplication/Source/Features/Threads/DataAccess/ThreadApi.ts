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

const ThreadListItemWithAgentSchema = AppServerListThreadsResponseSchema.shape.data.element.and(
  z
    .object({
      agentId: z.enum(["codex", "opencode"]),
      source: z.string().optional(),
      removed: z.boolean().optional(),
      projectRemoved: z.boolean().optional(),
      projectState: z.enum(["active", "removed"]).optional()
    })
    .passthrough()
);

const ThreadListResponseSchema = z
  .object({
    data: z.array(ThreadListItemWithAgentSchema),
    nextCursor: z.union([z.string(), z.null(), z.undefined()]).transform((v) => v ?? null),
    pages: z.number().int().nonnegative().optional(),
    truncated: z.boolean().optional()
  });
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
  .transform(({ ok: _ok, ...threadListResponse }) => threadListResponse);

const ReadThreadResponseWithAgentSchema = AppServerReadThreadResponseSchema.extend({
  agentId: z.enum(["codex", "opencode"])
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
  .transform(({ ok: _ok, ...readThreadResponse }) => readThreadResponse);

const CreateThreadResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string(),
    agentId: z.enum(["codex", "opencode"])
  })
  .merge(AppServerStartThreadResponseSchema)
  .passthrough();
export type ApiCreateThreadResponse = z.infer<typeof CreateThreadResponseSchema>;

const ArchiveThreadResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1)
  })
  .strict();

const UnarchiveThreadResponseSchema = z
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

export async function listThreads(options: ApiListThreadsOptions): Promise<ApiThreadListResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit));
  params.set("archived", options.archived ? "1" : "0");
  params.set("all", options.all ? "1" : "0");
  params.set("maxPages", String(options.maxPages));
  if (options.sortKey) {
    params.set("sortKey", options.sortKey);
  }
  if (options.cwd) {
    params.set("cwd", options.cwd);
  }

  const data = await request(`/api/threads?${params.toString()}`, requestInitWithOptions(options));
  return ThreadListEnvelopeSchema.parse(data);
}

export async function readThread(
  threadId: string,
  options?: ApiReadThreadOptions
): Promise<ApiReadThreadResponse> {
  const includeTurns = options?.includeTurns ?? true;
  const data = await request(
    `/api/threads/${encodeURIComponent(threadId)}?includeTurns=${includeTurns ? "true" : "false"}`,
    requestInitWithOptions(options)
  );
  return ReadThreadResponseEnvelopeSchema.parse(data);
}

export async function createThread(
  input?: ApiCreateThreadInput,
  options?: ApiRequestOptions
): Promise<ApiCreateThreadResponse> {
  const data = await request(
    "/api/threads",
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
  return CreateThreadResponseSchema.parse(data);
}

export async function archiveThread(threadId: string, options?: ApiRequestOptions): Promise<void> {
  const data = await request(
    `/api/threads/${encodeURIComponent(threadId)}/archive`,
    applyRequestOptions(
      {
        method: "POST"
      },
      options
    )
  );
  ArchiveThreadResponseSchema.parse(data);
}

export async function unarchiveThread(threadId: string, options?: ApiRequestOptions): Promise<void> {
  const data = await request(
    `/api/threads/${encodeURIComponent(threadId)}/unarchive`,
    applyRequestOptions(
      {
        method: "POST"
      },
      options
    )
  );
  UnarchiveThreadResponseSchema.parse(data);
}
