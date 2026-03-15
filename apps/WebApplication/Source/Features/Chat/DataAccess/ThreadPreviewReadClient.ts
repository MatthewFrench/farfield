import { z } from "zod";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { request } from "@/Shared/Transport/FarfieldHttpTransport";

const THREAD_ROUTE_PATH = "/api/threads";
const READ_THREAD_INCLUDE_TURNS_QUERY_KEY = "includeTurns";
const BOOLEAN_FALSE_QUERY_VALUE = "false";

const ThreadPreviewStatusSchema = z
  .object({
    type: z.string().min(1),
  })
  .passthrough();

const ThreadPreviewReadResponseSchema = z
  .object({
    ok: z.literal(true),
    thread: z
      .object({
        preview: z.string().optional(),
        status: ThreadPreviewStatusSchema.optional(),
      })
      .passthrough(),
  })
  .strict()
  .transform(({ ok: _ok, thread }) => ({
    thread: {
      preview: thread.preview,
      status: thread.status,
    },
  }));

export interface ThreadPreviewReadResponse {
  thread: {
    preview: string | undefined;
    status:
      | {
          type: string;
        }
      | undefined;
  };
}

function buildReadThreadPreviewRequestPath(threadId: string): string {
  const queryParameters = new URLSearchParams();
  queryParameters.set(READ_THREAD_INCLUDE_TURNS_QUERY_KEY, BOOLEAN_FALSE_QUERY_VALUE);
  return `${THREAD_ROUTE_PATH}/${encodeURIComponent(threadId)}?${queryParameters.toString()}`;
}

/**
 * Owns the narrow no-turn read contract used to detect when a newly created thread is ready for a
 * full selected-thread reload. The response is intentionally minimal so state owners can gate
 * hydration without parsing the full thread payload shape.
 */
export class ThreadPreviewReadClient {
  public async readThread(
    threadId: string,
    options?: ApiRequestOptions,
  ): Promise<ThreadPreviewReadResponse> {
    const data = await request(buildReadThreadPreviewRequestPath(threadId), {
      method: "GET",
      ...options,
    });
    return ThreadPreviewReadResponseSchema.parse(data);
  }
}
