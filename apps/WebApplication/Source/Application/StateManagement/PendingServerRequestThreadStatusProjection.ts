import {
  CommandExecutionApprovalRequestMethod,
  FileChangeApprovalRequestMethod,
  JsonValueSchema,
  ThreadConversationRequestMethodValues,
  ThreadConversationRequestSchema,
  ToolCallRequestMethod,
  UserInputRequestMethod,
} from "@farfield/protocol";
import { z } from "zod";
import { type CapabilityPendingServerRequestsResponse } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import {
  type ThreadRuntimeActiveFlag,
  type ThreadRuntimeStatusByThreadIdentifier,
  type ThreadRuntimeStatusSnapshot,
} from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";

const THREAD_STATUS_TYPE_ACTIVE = "active";
const PENDING_THREAD_STATUS_FLAG_WAITING_ON_APPROVAL: ThreadRuntimeActiveFlag = "waitingOnApproval";
const PENDING_THREAD_STATUS_FLAG_WAITING_ON_USER_INPUT: ThreadRuntimeActiveFlag =
  "waitingOnUserInput";
const THREAD_RUNTIME_ACTIVE_FLAG_ORDER: readonly ThreadRuntimeActiveFlag[] = [
  PENDING_THREAD_STATUS_FLAG_WAITING_ON_APPROVAL,
  PENDING_THREAD_STATUS_FLAG_WAITING_ON_USER_INPUT,
];

export const PENDING_SERVER_REQUEST_THREAD_STATUS_SEQUENCE = -1;

interface ThreadStatusProjection {
  kind: "threadStatus";
  threadId: string;
  activeFlag: ThreadRuntimeActiveFlag;
  receivedAtMilliseconds: number;
}

interface IgnoredThreadStatusProjection {
  kind: "ignored";
}

type PendingServerRequestThreadStatusProjection =
  | ThreadStatusProjection
  | IgnoredThreadStatusProjection;

interface PendingThreadStatusDraft {
  hasWaitingOnApproval: boolean;
  hasWaitingOnUserInput: boolean;
  latestReceivedAtMilliseconds: number;
}

const KnownPendingServerRequestMethodSchema = z.enum(ThreadConversationRequestMethodValues);

const PendingServerRequestThreadStatusProjectionSchema = z
  .object({
    requestId: z.number().int().nonnegative(),
    method: z.string().min(1),
    params: JsonValueSchema.nullable(),
    receivedAtMilliseconds: z.number().int().nonnegative(),
  })
  .strict()
  .transform((value): PendingServerRequestThreadStatusProjection => {
    const parsedKnownMethod = KnownPendingServerRequestMethodSchema.safeParse(value.method);
    if (!parsedKnownMethod.success) {
      return {
        kind: "ignored",
      };
    }

    const request = ThreadConversationRequestSchema.parse({
      id: value.requestId,
      method: parsedKnownMethod.data,
      params: value.params,
      completed: false,
    });

    if (
      request.method === CommandExecutionApprovalRequestMethod ||
      request.method === FileChangeApprovalRequestMethod
    ) {
      return {
        kind: "threadStatus",
        threadId: request.params.threadId,
        activeFlag: PENDING_THREAD_STATUS_FLAG_WAITING_ON_APPROVAL,
        receivedAtMilliseconds: value.receivedAtMilliseconds,
      };
    }

    if (request.method === UserInputRequestMethod || request.method === ToolCallRequestMethod) {
      return {
        kind: "threadStatus",
        threadId: request.params.threadId,
        activeFlag: PENDING_THREAD_STATUS_FLAG_WAITING_ON_USER_INPUT,
        receivedAtMilliseconds: value.receivedAtMilliseconds,
      };
    }

    return {
      kind: "ignored",
    };
  });

function createPendingThreadStatusDraft(): PendingThreadStatusDraft {
  return {
    hasWaitingOnApproval: false,
    hasWaitingOnUserInput: false,
    latestReceivedAtMilliseconds: 0,
  };
}

function buildOrderedActiveFlags(draft: PendingThreadStatusDraft): ThreadRuntimeActiveFlag[] {
  return THREAD_RUNTIME_ACTIVE_FLAG_ORDER.filter((activeFlag) => {
    if (activeFlag === PENDING_THREAD_STATUS_FLAG_WAITING_ON_APPROVAL) {
      return draft.hasWaitingOnApproval;
    }
    return draft.hasWaitingOnUserInput;
  });
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
  right: ThreadRuntimeStatusSnapshot | undefined,
): boolean {
  if (left === right) {
    return true;
  }
  if (left === undefined || right === undefined) {
    return false;
  }
  return (
    left.sequence === right.sequence &&
    left.statusType === right.statusType &&
    left.receivedAtMilliseconds === right.receivedAtMilliseconds &&
    areActiveFlagsEqual(left.activeFlags, right.activeFlags)
  );
}

/**
 * Owns the strict projection from generic pending server-request envelopes into
 * thread-runtime status badges. This keeps request-shape parsing at one boundary
 * while the rest of the application consumes explicit thread-status contracts.
 */
export function projectPendingServerRequestsToThreadRuntimeStatuses(
  response: CapabilityPendingServerRequestsResponse,
): ThreadRuntimeStatusByThreadIdentifier {
  const draftByThreadIdentifier: Record<string, PendingThreadStatusDraft> = {};

  for (const request of response.requests) {
    const projection = PendingServerRequestThreadStatusProjectionSchema.parse(request);
    if (projection.kind === "ignored") {
      continue;
    }

    const previousDraft =
      draftByThreadIdentifier[projection.threadId] ?? createPendingThreadStatusDraft();
    const nextDraft: PendingThreadStatusDraft = {
      hasWaitingOnApproval:
        previousDraft.hasWaitingOnApproval ||
        projection.activeFlag === PENDING_THREAD_STATUS_FLAG_WAITING_ON_APPROVAL,
      hasWaitingOnUserInput:
        previousDraft.hasWaitingOnUserInput ||
        projection.activeFlag === PENDING_THREAD_STATUS_FLAG_WAITING_ON_USER_INPUT,
      latestReceivedAtMilliseconds: Math.max(
        previousDraft.latestReceivedAtMilliseconds,
        projection.receivedAtMilliseconds,
      ),
    };
    draftByThreadIdentifier[projection.threadId] = nextDraft;
  }

  const statusByThreadIdentifier: ThreadRuntimeStatusByThreadIdentifier = {};
  for (const [threadId, draft] of Object.entries(draftByThreadIdentifier)) {
    statusByThreadIdentifier[threadId] = {
      sequence: PENDING_SERVER_REQUEST_THREAD_STATUS_SEQUENCE,
      statusType: THREAD_STATUS_TYPE_ACTIVE,
      activeFlags: buildOrderedActiveFlags(draft),
      receivedAtMilliseconds: draft.latestReceivedAtMilliseconds,
    };
  }

  return statusByThreadIdentifier;
}

export function isPendingServerRequestThreadStatus(
  status: ThreadRuntimeStatusSnapshot | undefined,
): boolean {
  return status?.sequence === PENDING_SERVER_REQUEST_THREAD_STATUS_SEQUENCE;
}

export function applyPendingServerRequestThreadStatuses(input: {
  previousStatusByThreadIdentifier: ThreadRuntimeStatusByThreadIdentifier;
  nextPendingStatusByThreadIdentifier: ThreadRuntimeStatusByThreadIdentifier;
}): ThreadRuntimeStatusByThreadIdentifier {
  const nextPendingThreadIdentifiers = new Set(
    Object.keys(input.nextPendingStatusByThreadIdentifier),
  );
  let nextStatusByThreadIdentifier = input.previousStatusByThreadIdentifier;

  for (const [threadId, previousStatus] of Object.entries(input.previousStatusByThreadIdentifier)) {
    if (!isPendingServerRequestThreadStatus(previousStatus)) {
      continue;
    }
    if (nextPendingThreadIdentifiers.has(threadId)) {
      continue;
    }

    if (nextStatusByThreadIdentifier === input.previousStatusByThreadIdentifier) {
      nextStatusByThreadIdentifier = { ...input.previousStatusByThreadIdentifier };
    }
    delete nextStatusByThreadIdentifier[threadId];
  }

  for (const [threadId, nextPendingStatus] of Object.entries(
    input.nextPendingStatusByThreadIdentifier,
  )) {
    const previousStatus = nextStatusByThreadIdentifier[threadId];
    if (areThreadRuntimeStatusSnapshotsEqual(previousStatus, nextPendingStatus)) {
      continue;
    }

    if (nextStatusByThreadIdentifier === input.previousStatusByThreadIdentifier) {
      nextStatusByThreadIdentifier = { ...input.previousStatusByThreadIdentifier };
    }
    nextStatusByThreadIdentifier[threadId] = nextPendingStatus;
  }

  return nextStatusByThreadIdentifier;
}
