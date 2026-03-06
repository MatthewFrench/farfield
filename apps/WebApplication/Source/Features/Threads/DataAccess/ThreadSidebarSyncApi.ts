import {
  FarfieldSidebarThreadSyncRequestSchema,
  FarfieldSidebarThreadSyncResponseSchema,
} from "@farfield/protocol";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { request } from "@/Shared/Transport/FarfieldHttpTransport";
import { applyRequestOptions } from "@/Shared/Transport/FarfieldHttpTransportRequestOptionsOwner";
import { type ThreadListResponse } from "../DomainModel/ThreadGroupTypes";

const THREAD_SIDEBAR_SYNC_ENDPOINT = "/api/sidebar/threads/sync";
const HTTP_POST_METHOD = "POST";
const APPLICATION_JSON_CONTENT_TYPE_HEADER_NAME = "Content-Type";
const APPLICATION_JSON_CONTENT_TYPE = "application/json";

export interface ApiThreadSidebarSyncInput extends ApiRequestOptions {
  archived: boolean;
  limit: number;
  maxPages: number;
  sortKey: "created_at" | "updated_at";
  cwd?: string;
  knownSnapshotVersion: string | null;
}

export interface ApiThreadSidebarSyncNotModifiedResult {
  syncStatus: "notModified";
  snapshotUpdatedAt: number;
  snapshotVersion: string;
}

export interface ApiThreadSidebarSyncSnapshotResult {
  syncStatus: "snapshot";
  snapshotUpdatedAt: number;
  snapshotVersion: string;
  threadList: ThreadListResponse;
}

export type ApiThreadSidebarSyncResult =
  | ApiThreadSidebarSyncNotModifiedResult
  | ApiThreadSidebarSyncSnapshotResult;

const SidebarThreadSyncRequestBodySchema = FarfieldSidebarThreadSyncRequestSchema;

const SidebarThreadSyncResultSchema = FarfieldSidebarThreadSyncResponseSchema.transform(
  (value): ApiThreadSidebarSyncResult => {
    if (value.syncStatus === "notModified") {
      return {
        syncStatus: "notModified",
        snapshotUpdatedAt: value.snapshotUpdatedAt,
        snapshotVersion: value.snapshotVersion,
      };
    }

    const threadList: ThreadListResponse = value.threadList;

    return {
      syncStatus: "snapshot",
      snapshotUpdatedAt: value.snapshotUpdatedAt,
      snapshotVersion: value.snapshotVersion,
      threadList,
    };
  },
);

function buildSidebarThreadSyncRequestInit(input: ApiThreadSidebarSyncInput): RequestInit {
  const requestBody = SidebarThreadSyncRequestBodySchema.parse({
    archived: input.archived,
    limit: input.limit,
    maxPages: input.maxPages,
    sortKey: input.sortKey,
    cwd: input.cwd ?? null,
    knownSnapshotVersion: input.knownSnapshotVersion,
  });

  return applyRequestOptions(
    {
      method: HTTP_POST_METHOD,
      headers: {
        [APPLICATION_JSON_CONTENT_TYPE_HEADER_NAME]: APPLICATION_JSON_CONTENT_TYPE,
      },
      body: JSON.stringify(requestBody),
    },
    input,
  );
}

export async function syncSidebarThreadList(
  input: ApiThreadSidebarSyncInput,
): Promise<ApiThreadSidebarSyncResult> {
  const data = await request(
    THREAD_SIDEBAR_SYNC_ENDPOINT,
    buildSidebarThreadSyncRequestInit(input),
  );
  return SidebarThreadSyncResultSchema.parse(data);
}
