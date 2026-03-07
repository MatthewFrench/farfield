import type {
  AgentAdapter,
  AgentId,
  AgentListLoadedThreadsResult,
  AgentListThreadsInput,
} from "../../Agents/Types.js";
import { logger } from "../../Shared/Logging/Logger.js";
import type {
  ThreadListItemWithAgentId,
  ThreadListSortKey,
} from "../ThreadListAggregationCache.js";
import { projectThreadListItemFromAgentThreadListItem } from "./ThreadCollectionListItemProjection.js";

const ThreadCollectionRouteLogEventByName = {
  agentListThreadsFailed: "agent-list-threads-failed",
  agentListLoadedThreadsFailed: "agent-list-loaded-threads-failed",
} as const;
const ThreadCollectionRouteListThreadsTimeoutLabelPrefix = "list-threads:";
const ThreadCollectionRouteListLoadedThreadsTimeoutLabelPrefix = "list-loaded-threads:";

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
      // Keep list query semantics owned by adapter listThreads. Loaded-thread state can annotate
      // listed items, but it must not inject threads that were filtered out by archive/cwd/query rules.
      const projectedThreadListItem: ThreadListItemWithAgentId =
        projectThreadListItemFromAgentThreadListItem({
          thread,
          agentId: adapterResult.adapter.id,
          isLoadedInMemory,
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
