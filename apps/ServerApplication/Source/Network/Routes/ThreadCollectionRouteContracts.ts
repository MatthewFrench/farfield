import type { IncomingMessage, ServerResponse } from "node:http";
import type { JsonValue } from "@farfield/protocol";
import type { AgentAdapter, AgentId } from "../../Agents/Types.js";
import type {
  ThreadListAggregationCache
} from "../ThreadListAggregationCache.js";

export interface ThreadCollectionRouteDependencies {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  url: URL;
  defaultWorkspace: string;
  threadListAggregationCache: ThreadListAggregationCache;
  listEnabledAdapters: () => AgentAdapter[];
  registerThreadAdapterOwnership: (threadId: string, agentId: AgentId) => void;
  parseInteger: (value: string | null, defaultValue: number) => number;
  parseBoolean: (value: string | null, defaultValue: boolean) => boolean;
  normalizeOptionalString: (value: string | null) => string | null;
  listThreadsTimeoutMs: number;
  resolveCreateThreadAdapter: (requestedAgentId: AgentId | undefined) => AgentAdapter | null;
  readJsonBody: (req: IncomingMessage) => Promise<JsonValue>;
  jsonResponse: (res: ServerResponse, statusCode: number, body: object) => void;
  invalidateThreadListAggregationCache: (reason: string, details?: Record<string, JsonValue>) => void;
  pushActionEventWithRequestContext: (
    action: string,
    stage: "attempt" | "success" | "error",
    details: Record<string, JsonValue>
  ) => void;
  pushActionErrorWithRequestContext: <ErrorType>(
    action: string,
    error: ErrorType,
    details: Record<string, JsonValue>
  ) => string;
  withTimeout: <ValueType>(
    promise: Promise<ValueType>,
    timeoutMs: number,
    label: string
  ) => Promise<ValueType>;
}
