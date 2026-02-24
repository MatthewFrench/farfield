import type { IncomingMessage, ServerResponse } from "node:http";
import { type JsonValue } from "@farfield/protocol";
import type { CodexAgentAdapter } from "../../Agents/Adapters/CodexAgentAdapter.js";
import type { AgentAdapter, AgentId } from "../../Agents/Types.js";
import type { ThreadConcurrencyCoordinator } from "../ThreadConcurrencyCoordinator.js";

export type ResolvedThreadAdapterResult =
  | { ok: true; adapter: AgentAdapter; agentId: AgentId }
  | { ok: false; status: number; error: string };

export interface ThreadMemberRouteDependencies {
  req: IncomingMessage;
  res: ServerResponse;
  segments: string[];
  url: URL;
  codexAdapter: CodexAgentAdapter | null;
  parseInteger: (value: string | null, defaultValue: number) => number;
  parseBoolean: (value: string | null, defaultValue: boolean) => boolean;
  threadConcurrencyCoordinator: ThreadConcurrencyCoordinator;
  resolveAdapterForThread: (threadId: string) => ResolvedThreadAdapterResult;
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
}

export interface ThreadMemberResolvedRouteContext {
  threadId: string;
  adapter: AgentAdapter;
  agentId: AgentId;
}
