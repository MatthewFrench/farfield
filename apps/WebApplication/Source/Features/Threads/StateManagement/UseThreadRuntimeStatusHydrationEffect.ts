import { type Dispatch, type SetStateAction, useEffect } from "react";
import { type ThreadListResponse } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import {
  type ThreadRuntimeActiveFlag,
  type ThreadRuntimeStatusByThreadIdentifier,
  type ThreadRuntimeStatusSnapshot,
} from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import { isRequestCanceledError } from "@/Shared/Errors/RequestCanceledError";
import { type ThreadServerClient } from "../DataAccess/ThreadServerClient";

const THREAD_RUNTIME_STATUS_HYDRATION_OPERATION = "hydrate-thread-runtime-statuses";
const HYDRATED_THREAD_RUNTIME_STATUS_SEQUENCE = -2;
const THREAD_RUNTIME_STATUS_TYPE_ACTIVE = "active";

export interface UseThreadRuntimeStatusHydrationEffectInput {
  ensureApiSessionBootstrapped: () => Promise<boolean>;
  canHydrateThreadRuntimeStatuses: boolean;
  selectedAgentId: AgentId;
  threads: ThreadListResponse["data"];
  threadServerClient: ThreadServerClient;
  setThreadRuntimeStatusByThreadIdentifier: Dispatch<
    SetStateAction<ThreadRuntimeStatusByThreadIdentifier>
  >;
  handleRuntimeRequestError: <ErrorType>(error: ErrorType) => void;
}

interface HydratedThreadRuntimeStatusEntry {
  threadId: string;
  activeFlags: ThreadRuntimeActiveFlag[];
  receivedAtMilliseconds: number;
}

function createHydratedThreadRuntimeStatusSnapshot(
  entry: HydratedThreadRuntimeStatusEntry,
): ThreadRuntimeStatusSnapshot {
  return {
    sequence: HYDRATED_THREAD_RUNTIME_STATUS_SEQUENCE,
    statusType: THREAD_RUNTIME_STATUS_TYPE_ACTIVE,
    activeFlags: entry.activeFlags,
    receivedAtMilliseconds: entry.receivedAtMilliseconds,
  };
}

function areActiveFlagsEqual(
  left: readonly ThreadRuntimeActiveFlag[],
  right: readonly ThreadRuntimeActiveFlag[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((activeFlag, index) => activeFlag === right[index]);
}

function areThreadRuntimeStatusSnapshotsEqual(
  left: ThreadRuntimeStatusSnapshot | undefined,
  right: ThreadRuntimeStatusSnapshot,
): boolean {
  if (left === undefined) {
    return false;
  }
  return (
    left.sequence === right.sequence &&
    left.statusType === right.statusType &&
    left.receivedAtMilliseconds === right.receivedAtMilliseconds &&
    areActiveFlagsEqual(left.activeFlags, right.activeFlags)
  );
}

function readUniqueThreadIdentifiers(threads: ThreadListResponse["data"]): string[] {
  const threadIdentifiers: string[] = [];
  const seenThreadIdentifiers = new Set<string>();
  for (const thread of threads) {
    if (seenThreadIdentifiers.has(thread.id)) {
      continue;
    }
    seenThreadIdentifiers.add(thread.id);
    threadIdentifiers.push(thread.id);
  }
  return threadIdentifiers;
}

function createThreadRuntimeStatusHydrationError<ErrorType>(error: ErrorType): Error {
  return new Error(`${THREAD_RUNTIME_STATUS_HYDRATION_OPERATION}: ${toErrorMessage(error).trim()}`);
}

function applyHydratedThreadRuntimeStatuses(input: {
  previousStatusByThreadIdentifier: ThreadRuntimeStatusByThreadIdentifier;
  requestedThreadIdentifiers: readonly string[];
  nextHydratedEntries: readonly HydratedThreadRuntimeStatusEntry[];
}): ThreadRuntimeStatusByThreadIdentifier {
  const nextHydratedEntryByThreadId = new Map(
    input.nextHydratedEntries.map((entry) => [entry.threadId, entry] as const),
  );
  let nextStatusByThreadIdentifier = input.previousStatusByThreadIdentifier;

  for (const threadId of input.requestedThreadIdentifiers) {
    const previousStatus = nextStatusByThreadIdentifier[threadId];
    const previousIsHydratedStatus =
      previousStatus?.sequence === HYDRATED_THREAD_RUNTIME_STATUS_SEQUENCE;
    const nextHydratedEntry = nextHydratedEntryByThreadId.get(threadId);

    if (nextHydratedEntry === undefined) {
      if (!previousIsHydratedStatus) {
        continue;
      }
      if (nextStatusByThreadIdentifier === input.previousStatusByThreadIdentifier) {
        nextStatusByThreadIdentifier = { ...input.previousStatusByThreadIdentifier };
      }
      delete nextStatusByThreadIdentifier[threadId];
      continue;
    }

    if (previousStatus !== undefined && !previousIsHydratedStatus) {
      continue;
    }

    const nextSnapshot = createHydratedThreadRuntimeStatusSnapshot(nextHydratedEntry);
    if (areThreadRuntimeStatusSnapshotsEqual(previousStatus, nextSnapshot)) {
      continue;
    }

    if (nextStatusByThreadIdentifier === input.previousStatusByThreadIdentifier) {
      nextStatusByThreadIdentifier = { ...input.previousStatusByThreadIdentifier };
    }
    nextStatusByThreadIdentifier[threadId] = nextSnapshot;
  }

  return nextStatusByThreadIdentifier;
}

export function useThreadRuntimeStatusHydrationEffect(
  input: UseThreadRuntimeStatusHydrationEffectInput,
): void {
  useEffect(() => {
    if (!input.canHydrateThreadRuntimeStatuses) {
      return;
    }

    const threadIdentifiers = readUniqueThreadIdentifiers(input.threads);
    if (threadIdentifiers.length === 0) {
      return;
    }

    let shouldCancelHydration = false;

    const hydrateThreadRuntimeStatuses = async (): Promise<void> => {
      try {
        const hasApiSession = await input.ensureApiSessionBootstrapped();
        if (!hasApiSession || shouldCancelHydration) {
          return;
        }

        const runtimeStatusesResponse = await input.threadServerClient.readThreadRuntimeStatuses({
          agentId: input.selectedAgentId,
          threadIds: threadIdentifiers,
        });
        if (shouldCancelHydration) {
          return;
        }

        input.setThreadRuntimeStatusByThreadIdentifier((previousStatusByThreadIdentifier) =>
          applyHydratedThreadRuntimeStatuses({
            previousStatusByThreadIdentifier,
            requestedThreadIdentifiers: threadIdentifiers,
            nextHydratedEntries: runtimeStatusesResponse.statuses.map((status) => ({
              threadId: status.threadId,
              activeFlags: status.activeFlags,
              receivedAtMilliseconds: status.receivedAtMilliseconds,
            })),
          }),
        );
      } catch (error) {
        if (shouldCancelHydration) {
          return;
        }
        if (error instanceof Error && isRequestCanceledError(error)) {
          return;
        }
        input.handleRuntimeRequestError(createThreadRuntimeStatusHydrationError(error));
      }
    };

    void hydrateThreadRuntimeStatuses();
    return () => {
      shouldCancelHydration = true;
    };
  }, [
    input.ensureApiSessionBootstrapped,
    input.canHydrateThreadRuntimeStatuses,
    input.selectedAgentId,
    input.threads,
    input.threadServerClient,
    input.setThreadRuntimeStatusByThreadIdentifier,
    input.handleRuntimeRequestError,
  ]);
}
