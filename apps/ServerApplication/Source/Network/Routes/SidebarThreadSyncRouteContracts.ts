import type { IncomingMessage, ServerResponse } from "node:http";
import type { JsonValue } from "@farfield/protocol";
import type { AgentAdapter, AgentId } from "../../Agents/Types.js";
import type { SidebarThreadSyncSnapshotCache } from "../SidebarThreadSyncSnapshotCache.js";
import type { ThreadListAggregationCache } from "../ThreadListAggregationCache.js";
import type { CreatedThreadListProjectionOwner } from "./CreatedThreadListProjectionOwner.js";

export type SidebarThreadSyncRouteMethod = "POST";

export const SidebarThreadSyncRouteMethodByName = {
  post: "POST",
} as const;

export type SidebarThreadSyncRoutePathname = "/api/sidebar/threads/sync";

export const SidebarThreadSyncRoutePathnameByName = {
  threadsSync: "/api/sidebar/threads/sync",
} as const;

export interface SidebarThreadSyncRouteDependencies {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  url: URL;
  threadListAggregationCache: ThreadListAggregationCache;
  sidebarThreadSyncSnapshotCache: SidebarThreadSyncSnapshotCache;
  createdThreadListProjectionOwner: CreatedThreadListProjectionOwner;
  listEnabledAdapters: () => AgentAdapter[];
  registerThreadAdapterOwnership: (threadId: string, agentId: AgentId) => void;
  shouldIncludeThreadInList: (threadId: string) => boolean;
  listThreadsTimeoutMs: number;
  normalizeOptionalString: (value: string | null) => string | null;
  readJsonBody: (req: IncomingMessage) => Promise<JsonValue>;
  jsonResponse: (res: ServerResponse, statusCode: number, body: object) => void;
  withTimeout: <ValueType>(
    promise: Promise<ValueType>,
    timeoutMs: number,
    label: string,
  ) => Promise<ValueType>;
}
