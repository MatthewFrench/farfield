import {
  type ThreadRuntimeStatusByThreadIdentifier,
  type ThreadRuntimeStatusSnapshot,
} from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { type RuntimeThreadStatusUpdate } from "./RuntimeNotificationProjectionParser";

export interface RuntimeThreadStatusUpdateApplicationStats {
  processedUpdateCount: number;
  appliedUpdateCount: number;
  ignoredStaleUpdateCount: number;
  createdEntryCount: number;
  updatedEntryCount: number;
  clonedStateCount: number;
}

export interface RuntimeThreadStatusUpdateApplicationResult {
  nextStatusByThreadIdentifier: ThreadRuntimeStatusByThreadIdentifier;
  stats: RuntimeThreadStatusUpdateApplicationStats;
}

function createNoopApplicationStats(
  processedUpdateCount: number,
): RuntimeThreadStatusUpdateApplicationStats {
  return {
    processedUpdateCount,
    appliedUpdateCount: 0,
    ignoredStaleUpdateCount: processedUpdateCount,
    createdEntryCount: 0,
    updatedEntryCount: 0,
    clonedStateCount: 0,
  };
}

function createThreadStatusSnapshot(
  update: RuntimeThreadStatusUpdate,
): ThreadRuntimeStatusSnapshot {
  return {
    sequence: update.sequence,
    statusType: update.statusType,
    activeFlags: update.activeFlags,
    receivedAtMilliseconds: update.receivedAtMilliseconds,
  };
}

/**
 * Applies thread-status notification deltas with per-thread sequence ordering.
 * Updates older than the stored sequence are ignored deterministically.
 */
export function applyRuntimeThreadStatusUpdates(input: {
  previousStatusByThreadIdentifier: ThreadRuntimeStatusByThreadIdentifier;
  updates: RuntimeThreadStatusUpdate[];
}): RuntimeThreadStatusUpdateApplicationResult {
  if (input.updates.length === 0) {
    return {
      nextStatusByThreadIdentifier: input.previousStatusByThreadIdentifier,
      stats: {
        processedUpdateCount: 0,
        appliedUpdateCount: 0,
        ignoredStaleUpdateCount: 0,
        createdEntryCount: 0,
        updatedEntryCount: 0,
        clonedStateCount: 0,
      },
    };
  }

  let nextStatusByThreadIdentifier = input.previousStatusByThreadIdentifier;
  let appliedUpdateCount = 0;
  let ignoredStaleUpdateCount = 0;
  let createdEntryCount = 0;
  let updatedEntryCount = 0;
  let clonedStateCount = 0;

  for (const update of input.updates) {
    const previousStatus = nextStatusByThreadIdentifier[update.threadId];
    if (previousStatus !== undefined && update.sequence <= previousStatus.sequence) {
      ignoredStaleUpdateCount += 1;
      continue;
    }

    if (nextStatusByThreadIdentifier === input.previousStatusByThreadIdentifier) {
      nextStatusByThreadIdentifier = { ...nextStatusByThreadIdentifier };
      clonedStateCount += 1;
    }

    nextStatusByThreadIdentifier[update.threadId] = createThreadStatusSnapshot(update);
    appliedUpdateCount += 1;
    if (previousStatus === undefined) {
      createdEntryCount += 1;
    } else {
      updatedEntryCount += 1;
    }
  }

  if (appliedUpdateCount === 0) {
    return {
      nextStatusByThreadIdentifier: input.previousStatusByThreadIdentifier,
      stats: createNoopApplicationStats(input.updates.length),
    };
  }

  return {
    nextStatusByThreadIdentifier,
    stats: {
      processedUpdateCount: input.updates.length,
      appliedUpdateCount,
      ignoredStaleUpdateCount,
      createdEntryCount,
      updatedEntryCount,
      clonedStateCount,
    },
  };
}
