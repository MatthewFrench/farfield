import {
  CommandExecutionApprovalRequestMethod,
  FileChangeApprovalRequestMethod,
  ToolCallRequestMethod,
  UserInputRequestMethod,
} from "@farfield/protocol";
import { z } from "zod";
import type {
  AgentAdapter,
  AgentId,
  AgentThreadConversationState,
  AgentThreadLiveState,
} from "../../Agents/Types.js";
import { logger } from "../../Shared/Logging/Logger.js";
import {
  type ThreadCollectionRouteDependencies,
  ThreadCollectionRouteMethodByName,
  ThreadCollectionRoutePathnameByName,
} from "./ThreadCollectionRouteContracts.js";

const ThreadCollectionRuntimeStatusRouteStatusCodeByName = {
  ok: 200,
  badRequest: 400,
  serviceUnavailable: 503,
} as const;

const ThreadCollectionRuntimeStatusRouteErrorByName = {
  invalidQuery: "Invalid thread runtime status query parameters",
  unsupportedAgent: "Thread runtime status reads are unavailable for the selected agent.",
} as const;

const ThreadCollectionRuntimeStatusRouteLogEventByName = {
  readFailed: "thread-runtime-status-read-failed",
} as const;

const ThreadRuntimeStatusTypeActive = "active";
const ThreadRuntimeActiveFlagWaitingOnApproval = "waitingOnApproval";
const ThreadRuntimeActiveFlagWaitingOnUserInput = "waitingOnUserInput";
const ThreadRuntimeStatusRouteThreadIdentifierMaximumCount = 200;
const TurnInProgressStatus = "inProgress";
const TurnInProgressUnderscoreStatus = "in_progress";

const ThreadRuntimeStatusRouteQuerySchema = z
  .object({
    agentId: z.enum(["codex", "opencode"]),
    threadIds: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(ThreadRuntimeStatusRouteThreadIdentifierMaximumCount),
  })
  .strict();

interface ThreadRuntimeStatusRoutePendingDraft {
  hasWaitingOnApproval: boolean;
  hasWaitingOnUserInput: boolean;
  latestReceivedAtMilliseconds: number;
}

interface ThreadRuntimeStatusRouteEntry {
  threadId: string;
  statusType: "active";
  activeFlags: Array<"waitingOnApproval" | "waitingOnUserInput">;
  receivedAtMilliseconds: number;
}

const CommandExecutionApprovalParamsSchema = z
  .object({
    threadId: z.string().trim().min(1),
  })
  .passthrough();

const FileChangeApprovalParamsSchema = z
  .object({
    threadId: z.string().trim().min(1),
  })
  .passthrough();

const UserInputRequestParamsSchema = z
  .object({
    threadId: z.string().trim().min(1),
  })
  .passthrough();

const ToolCallRequestParamsSchema = z
  .object({
    threadId: z.string().trim().min(1),
  })
  .passthrough();

function isThreadCollectionRuntimeStatusRouteRequest(
  method: string | undefined,
  pathname: string,
): boolean {
  return (
    method === ThreadCollectionRouteMethodByName.get &&
    pathname === ThreadCollectionRoutePathnameByName.runtimeStatuses
  );
}

function readThreadRuntimeStatusRouteQuery(
  url: URL,
): z.infer<typeof ThreadRuntimeStatusRouteQuerySchema> {
  return ThreadRuntimeStatusRouteQuerySchema.parse({
    agentId: url.searchParams.get("agentId"),
    threadIds: url.searchParams.getAll("threadId"),
  });
}

function readEnabledAgentAdapterById(
  adapters: readonly AgentAdapter[],
  agentId: AgentId,
): AgentAdapter | null {
  const matchingAdapter = adapters.find((adapter) => adapter.id === agentId) ?? null;
  if (matchingAdapter === null) {
    return null;
  }
  if (!matchingAdapter.isConnected()) {
    return null;
  }
  if (
    matchingAdapter.readLiveState === undefined &&
    matchingAdapter.readPendingServerRequests === undefined
  ) {
    return null;
  }
  return matchingAdapter;
}

function createPendingDraft(): ThreadRuntimeStatusRoutePendingDraft {
  return {
    hasWaitingOnApproval: false,
    hasWaitingOnUserInput: false,
    latestReceivedAtMilliseconds: 0,
  };
}

function readActiveFlagsFromPendingDraft(
  pendingDraft: ThreadRuntimeStatusRoutePendingDraft,
): Array<"waitingOnApproval" | "waitingOnUserInput"> {
  const activeFlags: Array<"waitingOnApproval" | "waitingOnUserInput"> = [];
  if (pendingDraft.hasWaitingOnApproval) {
    activeFlags.push(ThreadRuntimeActiveFlagWaitingOnApproval);
  }
  if (pendingDraft.hasWaitingOnUserInput) {
    activeFlags.push(ThreadRuntimeActiveFlagWaitingOnUserInput);
  }
  return activeFlags;
}

function readLatestTurnIsInProgress(
  conversationState: AgentThreadConversationState | null,
): boolean {
  if (conversationState === null) {
    return false;
  }

  for (let turnIndex = conversationState.turns.length - 1; turnIndex >= 0; turnIndex -= 1) {
    const turn = conversationState.turns[turnIndex];
    if (turn === undefined) {
      continue;
    }
    if (turn.status === TurnInProgressStatus || turn.status === TurnInProgressUnderscoreStatus) {
      return true;
    }
    return false;
  }

  return false;
}

async function readRequestedThreadLiveStateActivityMap(input: {
  adapter: AgentAdapter;
  threadIds: readonly string[];
}): Promise<ReadonlyMap<string, AgentThreadLiveState>> {
  if (input.adapter.readLiveState === undefined) {
    return new Map();
  }

  const liveStateEntries = await Promise.all(
    input.threadIds.map(async (threadId) => {
      const liveState = await input.adapter.readLiveState?.(threadId);
      return [threadId, liveState ?? null] as const;
    }),
  );

  const liveStateByThreadId = new Map<string, AgentThreadLiveState>();
  for (const [threadId, liveState] of liveStateEntries) {
    if (liveState !== null) {
      liveStateByThreadId.set(threadId, liveState);
    }
  }
  return liveStateByThreadId;
}

async function readPendingDraftByThreadId(input: {
  adapter: AgentAdapter;
  requestedThreadIdentifierSet: ReadonlySet<string>;
}): Promise<ReadonlyMap<string, ThreadRuntimeStatusRoutePendingDraft>> {
  if (input.adapter.readPendingServerRequests === undefined) {
    return new Map();
  }

  const pendingRequests = await input.adapter.readPendingServerRequests();
  const pendingDraftByThreadId = new Map<string, ThreadRuntimeStatusRoutePendingDraft>();

  for (const request of pendingRequests.requests) {
    if (request.method === CommandExecutionApprovalRequestMethod) {
      const parsedParams = CommandExecutionApprovalParamsSchema.parse(request.params);
      const threadId = parsedParams.threadId;
      if (!input.requestedThreadIdentifierSet.has(threadId)) {
        continue;
      }
      const previousDraft = pendingDraftByThreadId.get(threadId) ?? createPendingDraft();
      pendingDraftByThreadId.set(threadId, {
        hasWaitingOnApproval: true,
        hasWaitingOnUserInput: previousDraft.hasWaitingOnUserInput,
        latestReceivedAtMilliseconds: Math.max(
          previousDraft.latestReceivedAtMilliseconds,
          request.receivedAtMilliseconds,
        ),
      });
      continue;
    }

    if (request.method === FileChangeApprovalRequestMethod) {
      const parsedParams = FileChangeApprovalParamsSchema.parse(request.params);
      const threadId = parsedParams.threadId;
      if (!input.requestedThreadIdentifierSet.has(threadId)) {
        continue;
      }
      const previousDraft = pendingDraftByThreadId.get(threadId) ?? createPendingDraft();
      pendingDraftByThreadId.set(threadId, {
        hasWaitingOnApproval: true,
        hasWaitingOnUserInput: previousDraft.hasWaitingOnUserInput,
        latestReceivedAtMilliseconds: Math.max(
          previousDraft.latestReceivedAtMilliseconds,
          request.receivedAtMilliseconds,
        ),
      });
      continue;
    }

    if (request.method === UserInputRequestMethod) {
      const parsedParams = UserInputRequestParamsSchema.parse(request.params);
      const threadId = parsedParams.threadId;
      if (!input.requestedThreadIdentifierSet.has(threadId)) {
        continue;
      }
      const previousDraft = pendingDraftByThreadId.get(threadId) ?? createPendingDraft();
      pendingDraftByThreadId.set(threadId, {
        hasWaitingOnApproval: previousDraft.hasWaitingOnApproval,
        hasWaitingOnUserInput: true,
        latestReceivedAtMilliseconds: Math.max(
          previousDraft.latestReceivedAtMilliseconds,
          request.receivedAtMilliseconds,
        ),
      });
      continue;
    }

    if (request.method !== ToolCallRequestMethod) {
      continue;
    }

    const parsedParams = ToolCallRequestParamsSchema.parse(request.params);
    const threadId = parsedParams.threadId;
    if (!input.requestedThreadIdentifierSet.has(threadId)) {
      continue;
    }
    const previousDraft = pendingDraftByThreadId.get(threadId) ?? createPendingDraft();
    pendingDraftByThreadId.set(threadId, {
      hasWaitingOnApproval: previousDraft.hasWaitingOnApproval,
      hasWaitingOnUserInput: true,
      latestReceivedAtMilliseconds: Math.max(
        previousDraft.latestReceivedAtMilliseconds,
        request.receivedAtMilliseconds,
      ),
    });
  }

  return pendingDraftByThreadId;
}

async function readThreadRuntimeStatusRouteEntries(input: {
  adapter: AgentAdapter;
  threadIds: readonly string[];
}): Promise<ThreadRuntimeStatusRouteEntry[]> {
  const requestedThreadIdentifierSet = new Set(input.threadIds);
  const [liveStateByThreadId, pendingDraftByThreadId] = await Promise.all([
    readRequestedThreadLiveStateActivityMap(input),
    readPendingDraftByThreadId({
      adapter: input.adapter,
      requestedThreadIdentifierSet,
    }),
  ]);
  const nowMilliseconds = Date.now();
  const entries: ThreadRuntimeStatusRouteEntry[] = [];

  for (const threadId of input.threadIds) {
    const pendingDraft = pendingDraftByThreadId.get(threadId);
    const liveState = liveStateByThreadId.get(threadId) ?? null;
    const hasLiveStateActivity = readLatestTurnIsInProgress(liveState?.conversationState ?? null);
    if (pendingDraft === undefined && !hasLiveStateActivity) {
      continue;
    }

    entries.push({
      threadId,
      statusType: ThreadRuntimeStatusTypeActive,
      activeFlags: pendingDraft === undefined ? [] : readActiveFlagsFromPendingDraft(pendingDraft),
      receivedAtMilliseconds: pendingDraft?.latestReceivedAtMilliseconds ?? nowMilliseconds,
    });
  }

  return entries;
}

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

export async function handleThreadCollectionRuntimeStatusRoute(
  deps: ThreadCollectionRouteDependencies,
): Promise<boolean> {
  if (!isThreadCollectionRuntimeStatusRouteRequest(deps.req.method, deps.pathname)) {
    return false;
  }

  const parsedQuery = ThreadRuntimeStatusRouteQuerySchema.safeParse({
    agentId: deps.url.searchParams.get("agentId"),
    threadIds: deps.url.searchParams.getAll("threadId"),
  });
  if (!parsedQuery.success) {
    deps.jsonResponse(deps.res, ThreadCollectionRuntimeStatusRouteStatusCodeByName.badRequest, {
      ok: false,
      error: ThreadCollectionRuntimeStatusRouteErrorByName.invalidQuery,
      issues: parsedQuery.error.issues,
    });
    return true;
  }

  const query = readThreadRuntimeStatusRouteQuery(deps.url);
  const adapter = readEnabledAgentAdapterById(deps.listEnabledAdapters(), query.agentId);
  if (adapter === null) {
    deps.jsonResponse(
      deps.res,
      ThreadCollectionRuntimeStatusRouteStatusCodeByName.serviceUnavailable,
      {
        ok: false,
        error: ThreadCollectionRuntimeStatusRouteErrorByName.unsupportedAgent,
      },
    );
    return true;
  }

  try {
    const entries = await readThreadRuntimeStatusRouteEntries({
      adapter,
      threadIds: query.threadIds,
    });
    deps.jsonResponse(deps.res, ThreadCollectionRuntimeStatusRouteStatusCodeByName.ok, {
      ok: true,
      statuses: entries,
    });
  } catch (error) {
    logger.warn(
      {
        agentId: query.agentId,
        threadIds: query.threadIds,
        error: toErrorMessage(error),
      },
      ThreadCollectionRuntimeStatusRouteLogEventByName.readFailed,
    );
    deps.jsonResponse(
      deps.res,
      ThreadCollectionRuntimeStatusRouteStatusCodeByName.serviceUnavailable,
      {
        ok: false,
        error: `${ThreadCollectionRuntimeStatusRouteErrorByName.unsupportedAgent} ${toErrorMessage(error)}`,
      },
    );
  }

  return true;
}
