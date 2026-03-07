import type {
  AgentAdapter,
  AgentId,
  AgentListLoadedThreadsResult,
  AgentListThreadsInput,
  AgentReadThreadInput,
  AgentReadThreadResult,
} from "../../Agents/Types.js";
import { logger } from "../../Shared/Logging/Logger.js";
import type {
  ThreadListItemWithAgentId,
  ThreadListSortKey,
} from "../ThreadListAggregationCache.js";
import {
  projectThreadListItemFromAgentThreadListItem,
  type ThreadCollectionListItemProjectionSource,
} from "./ThreadCollectionListItemProjection.js";

const ThreadCollectionRouteLogEventByName = {
  agentListThreadsFailed: "agent-list-threads-failed",
  agentListLoadedThreadsFailed: "agent-list-loaded-threads-failed",
  agentReadThreadFailed: "agent-read-thread-failed",
} as const;
const ThreadCollectionRouteListThreadsTimeoutLabelPrefix = "list-threads:";
const ThreadCollectionRouteListLoadedThreadsTimeoutLabelPrefix = "list-loaded-threads:";
const ThreadCollectionRouteReadThreadTimeoutLabelPrefix = "read-thread:";
const THREAD_READ_WITH_TURNS_INPUT: Pick<AgentReadThreadInput, "includeTurns"> = {
  includeTurns: true,
};

type ThreadCollectionRouteWithTimeout = <ValueType>(
  promise: Promise<ValueType>,
  timeoutMs: number,
  label: string,
) => Promise<ValueType>;

type ThreadCollectionRouteThreadOwnershipRegistrar = (threadId: string, agentId: AgentId) => void;

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

function buildListThreadsTimeoutLabel(agentId: AgentId): string {
  return `${ThreadCollectionRouteListThreadsTimeoutLabelPrefix}${agentId}`;
}

function buildListLoadedThreadsTimeoutLabel(agentId: AgentId): string {
  return `${ThreadCollectionRouteListLoadedThreadsTimeoutLabelPrefix}${agentId}`;
}

function buildReadThreadTimeoutLabel(agentId: AgentId, threadId: string): string {
  return `${ThreadCollectionRouteReadThreadTimeoutLabelPrefix}${agentId}:${threadId}`;
}

function mapLoadedThreadIdentifierSet(loadedThreads: AgentListLoadedThreadsResult): Set<string> {
  return new Set(loadedThreads.data);
}

async function loadAdapterLoadedThreadIdentifierSet(input: {
  adapter: AgentAdapter;
  listThreadsTimeoutMs: number;
  withTimeout: ThreadCollectionRouteWithTimeout;
}): Promise<Set<string> | null> {
  if (input.adapter.listLoadedThreads === undefined) {
    return null;
  }

  try {
    const loadedThreads = await input.withTimeout(
      input.adapter.listLoadedThreads(),
      input.listThreadsTimeoutMs,
      buildListLoadedThreadsTimeoutLabel(input.adapter.id),
    );
    return mapLoadedThreadIdentifierSet(loadedThreads);
  } catch (error) {
    logger.warn(
      {
        agentId: input.adapter.id,
        error: toErrorMessage(error),
      },
      ThreadCollectionRouteLogEventByName.agentListLoadedThreadsFailed,
    );
    return null;
  }
}

async function readLoadedThreadResultIfMissingFromList(input: {
  adapter: AgentAdapter;
  threadId: string;
  listThreadsTimeoutMs: number;
  withTimeout: ThreadCollectionRouteWithTimeout;
}): Promise<AgentReadThreadResult | null> {
  try {
    return await input.withTimeout(
      input.adapter.readThread({
        threadId: input.threadId,
        includeTurns: THREAD_READ_WITH_TURNS_INPUT.includeTurns,
      }),
      input.listThreadsTimeoutMs,
      buildReadThreadTimeoutLabel(input.adapter.id, input.threadId),
    );
  } catch (error) {
    logger.warn(
      {
        agentId: input.adapter.id,
        threadId: input.threadId,
        error: toErrorMessage(error),
      },
      ThreadCollectionRouteLogEventByName.agentReadThreadFailed,
    );
    return null;
  }
}

function buildBackfilledThreadListProjectionSource(
  readThreadResult: AgentReadThreadResult,
): ThreadCollectionListItemProjectionSource | null {
  const createdAt = readThreadResult.thread.createdAt;
  const updatedAt = readThreadResult.thread.updatedAt;
  if (createdAt === undefined || updatedAt === undefined) {
    return null;
  }

  return {
    id: readThreadResult.thread.id,
    createdAt,
    updatedAt,
    cwd: readThreadResult.thread.cwd,
    path: null,
    turns: readThreadResult.thread.turns,
    hasUnreadTurn: undefined,
    isLoadedInMemory: true,
  };
}

export function buildAggregationAdapterListThreadsInput(input: {
  limit: number;
  archived: boolean;
  maxPages: number;
  sortKey: ThreadListSortKey;
  cwd: string | null;
}): AgentListThreadsInput {
  return {
    limit: input.limit,
    archived: input.archived,
    all: true,
    maxPages: input.maxPages,
    cursor: null,
    sortKey: input.sortKey,
    cwd: input.cwd,
  };
}

export async function loadThreadListAggregationSnapshot(input: {
  enabledAdapterList: AgentAdapter[];
  adapterListThreadsInput: AgentListThreadsInput;
  listThreadsTimeoutMs: number;
  withTimeout: ThreadCollectionRouteWithTimeout;
  registerThreadAdapterOwnership: ThreadCollectionRouteThreadOwnershipRegistrar;
  sortItems: (left: ThreadListItemWithAgentId, right: ThreadListItemWithAgentId) => number;
}): Promise<{
  mergedData: ThreadListItemWithAgentId[];
  combinedTruncated: boolean;
}> {
  const mergedData: ThreadListItemWithAgentId[] = [];
  let combinedTruncated = false;

  const adapterResults = await Promise.all(
    input.enabledAdapterList.map(async (adapter) => {
      try {
        const loadedThreadIdentifierSet = await loadAdapterLoadedThreadIdentifierSet({
          adapter,
          listThreadsTimeoutMs: input.listThreadsTimeoutMs,
          withTimeout: input.withTimeout,
        });
        const boundedResult = await input.withTimeout(
          adapter.listThreads(input.adapterListThreadsInput),
          input.listThreadsTimeoutMs,
          buildListThreadsTimeoutLabel(adapter.id),
        );

        return {
          ok: true as const,
          adapter,
          result: boundedResult,
          loadedThreadIdentifierSet,
        };
      } catch (error) {
        logger.warn(
          {
            agentId: adapter.id,
            error: toErrorMessage(error),
          },
          ThreadCollectionRouteLogEventByName.agentListThreadsFailed,
        );

        return {
          ok: false as const,
          adapter,
        };
      }
    }),
  );

  for (const adapterResult of adapterResults) {
    if (!adapterResult.ok) {
      continue;
    }

    combinedTruncated = combinedTruncated || (adapterResult.result.truncated ?? false);
    const listedThreadIdentifierSet = new Set<string>();
    for (const thread of adapterResult.result.data) {
      listedThreadIdentifierSet.add(thread.id);
      input.registerThreadAdapterOwnership(thread.id, adapterResult.adapter.id);
      const isLoadedInMemory =
        adapterResult.loadedThreadIdentifierSet !== null
          ? adapterResult.loadedThreadIdentifierSet.has(thread.id)
          : undefined;
      const projectedThreadListItem: ThreadListItemWithAgentId =
        projectThreadListItemFromAgentThreadListItem({
          thread,
          agentId: adapterResult.adapter.id,
          isLoadedInMemory,
        });
      mergedData.push(projectedThreadListItem);
    }

    if (adapterResult.loadedThreadIdentifierSet === null) {
      continue;
    }

    for (const loadedThreadIdentifier of adapterResult.loadedThreadIdentifierSet) {
      if (listedThreadIdentifierSet.has(loadedThreadIdentifier)) {
        continue;
      }

      const readThreadResult = await readLoadedThreadResultIfMissingFromList({
        adapter: adapterResult.adapter,
        threadId: loadedThreadIdentifier,
        listThreadsTimeoutMs: input.listThreadsTimeoutMs,
        withTimeout: input.withTimeout,
      });
      if (readThreadResult === null) {
        continue;
      }

      input.registerThreadAdapterOwnership(loadedThreadIdentifier, adapterResult.adapter.id);
      const backfilledThreadProjectionSource =
        buildBackfilledThreadListProjectionSource(readThreadResult);
      if (backfilledThreadProjectionSource === null) {
        continue;
      }
      const projectedThreadListItem = projectThreadListItemFromAgentThreadListItem({
        thread: backfilledThreadProjectionSource,
        agentId: adapterResult.adapter.id,
        isLoadedInMemory: true,
      });
      mergedData.push(projectedThreadListItem);
    }
  }

  mergedData.sort(input.sortItems);

  return {
    mergedData,
    combinedTruncated,
  };
}
