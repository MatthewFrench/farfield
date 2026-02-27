import type { IncomingMessage, ServerResponse } from "node:http";
import { type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import type { CodexAgentAdapter } from "../../Agents/Adapters/CodexAgentAdapter.js";
import type { AgentAdapter, AgentId } from "../../Agents/Types.js";
import type { ThreadConcurrencyCoordinator } from "../ThreadConcurrencyCoordinator.js";

export const ThreadMemberRouteMethodByName = {
  get: "GET",
  post: "POST",
} as const;

export const ThreadMemberRouteSegmentByName = {
  api: "api",
  threads: "threads",
  liveState: "live-state",
  streamEvents: "stream-events",
  messages: "messages",
  archive: "archive",
  unarchive: "unarchive",
  collaborationMode: "collaboration-mode",
  userInput: "user-input",
  interrupt: "interrupt",
} as const;

export const ThreadMemberRouteSegmentIndexByName = {
  threadIdentifier: 2,
  threadSubresource: 3,
} as const;

export const ThreadMemberRouteSegmentCountByName = {
  threadRead: 3,
  threadSubresource: 4,
} as const;

export const ThreadMemberMutationActionByName = {
  messages: ThreadMemberRouteSegmentByName.messages,
  threadArchive: "thread-archive",
  threadUnarchive: "thread-unarchive",
  collaborationMode: ThreadMemberRouteSegmentByName.collaborationMode,
  userInput: ThreadMemberRouteSegmentByName.userInput,
  interrupt: ThreadMemberRouteSegmentByName.interrupt,
} as const;

const ThreadMemberSubresourceRouteSegmentSchema = z.enum([
  ThreadMemberRouteSegmentByName.liveState,
  ThreadMemberRouteSegmentByName.streamEvents,
  ThreadMemberRouteSegmentByName.messages,
  ThreadMemberRouteSegmentByName.archive,
  ThreadMemberRouteSegmentByName.unarchive,
  ThreadMemberRouteSegmentByName.collaborationMode,
  ThreadMemberRouteSegmentByName.userInput,
  ThreadMemberRouteSegmentByName.interrupt,
]);

type ThreadMemberSubresourceRouteSegment =
  | typeof ThreadMemberRouteSegmentByName.liveState
  | typeof ThreadMemberRouteSegmentByName.streamEvents
  | typeof ThreadMemberRouteSegmentByName.messages
  | typeof ThreadMemberRouteSegmentByName.archive
  | typeof ThreadMemberRouteSegmentByName.unarchive
  | typeof ThreadMemberRouteSegmentByName.collaborationMode
  | typeof ThreadMemberRouteSegmentByName.userInput
  | typeof ThreadMemberRouteSegmentByName.interrupt;

const ThreadMemberSubresourceRouteSegmentsSchema = z.tuple([
  z.literal(ThreadMemberRouteSegmentByName.api),
  z.literal(ThreadMemberRouteSegmentByName.threads),
  z.string().min(1),
  ThreadMemberSubresourceRouteSegmentSchema,
]);

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
  resolveAdapterForThread: (threadId: string) => Promise<ResolvedThreadAdapterResult>;
  readJsonBody: (req: IncomingMessage) => Promise<JsonValue>;
  jsonResponse: (res: ServerResponse, statusCode: number, body: object) => void;
  invalidateThreadListAggregationCache: (
    reason: string,
    details?: Record<string, JsonValue>,
  ) => void;
  pushActionEventWithRequestContext: (
    action: string,
    stage: "attempt" | "success" | "error",
    details: Record<string, JsonValue>,
  ) => void;
  pushActionErrorWithRequestContext: <ErrorType>(
    action: string,
    error: ErrorType,
    details: Record<string, JsonValue>,
  ) => string;
}

export interface ThreadMemberResolvedRouteContext {
  threadId: string;
  adapter: AgentAdapter;
  agentId: AgentId;
}

// Canonical thread-member subresource matching keeps nested paths from mutating unrelated routes.
export function isThreadMemberSubresourceRoute(
  segments: readonly string[],
  subresource: ThreadMemberSubresourceRouteSegment,
): boolean {
  const parsedSegments = ThreadMemberSubresourceRouteSegmentsSchema.safeParse(segments);
  if (!parsedSegments.success) {
    return false;
  }

  return parsedSegments.data[ThreadMemberRouteSegmentIndexByName.threadSubresource] === subresource;
}
