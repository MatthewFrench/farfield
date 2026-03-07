import type { IncomingMessage, ServerResponse } from "node:http";
import type { JsonValue } from "@farfield/protocol";
import type { AgentAdapter, AgentId } from "../../Agents/Types.js";
import type { ThreadListAggregationCache } from "../ThreadListAggregationCache.js";

export type ThreadCollectionRouteMethod = "GET" | "POST";

export interface ThreadCollectionRouteMethodMap {
  get: "GET";
  post: "POST";
}

export const ThreadCollectionRouteMethodByName: Readonly<ThreadCollectionRouteMethodMap> = {
  get: "GET",
  post: "POST",
};

export type ThreadCollectionRoutePathname = "/api/threads";

export interface ThreadCollectionRoutePathnameMap {
  threads: ThreadCollectionRoutePathname;
}

export const ThreadCollectionRoutePathnameByName: Readonly<ThreadCollectionRoutePathnameMap> = {
  threads: "/api/threads",
};

export type ThreadCollectionRouteActionStage = "attempt" | "success" | "error";
export type ThreadCollectionRouteActionDetails = Record<string, JsonValue>;

export interface ThreadCollectionRouteDependencies {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  url: URL;
  defaultWorkspace: string;
  threadListAggregationCache: ThreadListAggregationCache;
  listEnabledAdapters: () => AgentAdapter[];
  registerThreadAdapterOwnership: (threadId: string, agentId: AgentId) => void;
  shouldIncludeThreadInList: (threadId: string) => boolean;
  parseInteger: (value: string | null, defaultValue: number) => number;
  parseBoolean: (value: string | null, defaultValue: boolean) => boolean;
  normalizeOptionalString: (value: string | null) => string | null;
  listThreadsTimeoutMs: number;
  resolveCreateThreadAdapter: (requestedAgentId: AgentId | undefined) => AgentAdapter | null;
  readJsonBody: (req: IncomingMessage) => Promise<JsonValue>;
  jsonResponse: (res: ServerResponse, statusCode: number, body: object) => void;
  invalidateThreadListAggregationCache: (
    reason: string,
    details?: Record<string, JsonValue>,
  ) => void;
  pushActionEventWithRequestContext: (
    action: string,
    stage: ThreadCollectionRouteActionStage,
    details: ThreadCollectionRouteActionDetails,
  ) => void;
  pushActionErrorWithRequestContext: <ErrorType>(
    action: string,
    error: ErrorType,
    details: ThreadCollectionRouteActionDetails,
  ) => string;
  withTimeout: <ValueType>(
    promise: Promise<ValueType>,
    timeoutMs: number,
    label: string,
  ) => Promise<ValueType>;
}
